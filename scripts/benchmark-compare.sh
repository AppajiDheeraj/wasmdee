#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RESULTS="${RESULTS_DIR:-$ROOT/benchmark-results/$STAMP}"
WASMDEE_PORT="${WASMDEE_PORT:-18080}"
DOCKER_PORT="${DOCKER_PORT:-18081}"
ITERATIONS="${ITERATIONS:-1000}"
CONCURRENCY="${CONCURRENCY:-16}"
WARMUP="${WARMUP:-100}"
HOME_DIR="$(mktemp -d "${TMPDIR:-/tmp}/wasmdee-bench.XXXXXX")"
WASMDEE_PID=""

cleanup() {
  if [[ -n "$WASMDEE_PID" ]]; then
    kill "$WASMDEE_PID" 2>/dev/null || true
    wait "$WASMDEE_PID" 2>/dev/null || true
  fi
  docker rm -f wasmdee-docker-baseline >/dev/null 2>&1 || true
  rm -rf "$HOME_DIR"
}
trap cleanup EXIT

command -v docker >/dev/null
docker info >/dev/null

mkdir -p "$RESULTS"
cd "$ROOT"

go run ./tools/handler-example
go build -o "$HOME_DIR/wasmdee" ./cmd/wasmdee

WASMDEE_HOME="$HOME_DIR/home" "$HOME_DIR/wasmdee" deploy --config examples/handler/wasmdee.yaml
WASMDEE_HOME="$HOME_DIR/home" "$HOME_DIR/wasmdee" serve \
  --addr "127.0.0.1:$WASMDEE_PORT" \
  --min-workers 1 \
  --max-workers "$CONCURRENCY" \
  --handler-pool-size "$CONCURRENCY" \
  >"$RESULTS/wasmdee-server.log" 2>&1 &
WASMDEE_PID=$!

docker build -t wasmdee-docker-baseline benchmarks/docker
docker run --rm --name wasmdee-docker-baseline -p "$DOCKER_PORT:8080" \
  wasmdee-docker-baseline >"$RESULTS/docker-server.log" 2>&1 &

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$WASMDEE_PORT/healthz" >/dev/null &&
     curl -fsS "http://127.0.0.1:$DOCKER_PORT/healthz" >/dev/null; then
    break
  fi
  sleep 0.25
done

curl -fsS "http://127.0.0.1:$WASMDEE_PORT/healthz" >/dev/null
curl -fsS "http://127.0.0.1:$DOCKER_PORT/healthz" >/dev/null

"$HOME_DIR/wasmdee" bench examples/handler/echo.wasm \
  --label wasmdee-local-handler \
  --data benchmark-payload \
  --iterations "$ITERATIONS" \
  --warmup "$WARMUP" \
  --concurrency "$CONCURRENCY" \
  --handler-pool-size "$CONCURRENCY" \
  --report "$RESULTS/wasmdee-local.json"

"$HOME_DIR/wasmdee" bench "http://127.0.0.1:$WASMDEE_PORT/echo" \
  --label wasmdee-http \
  --data benchmark-payload \
  --iterations "$ITERATIONS" \
  --warmup "$WARMUP" \
  --concurrency "$CONCURRENCY" \
  --report "$RESULTS/wasmdee-http.json"

"$HOME_DIR/wasmdee" bench "http://127.0.0.1:$DOCKER_PORT/echo" \
  --label docker-http \
  --data benchmark-payload \
  --iterations "$ITERATIONS" \
  --warmup "$WARMUP" \
  --concurrency "$CONCURRENCY" \
  --report "$RESULTS/docker-http.json"

{
  echo "generated_at=$STAMP"
  echo "iterations=$ITERATIONS"
  echo "concurrency=$CONCURRENCY"
  echo "warmup=$WARMUP"
  echo "go=$(go version)"
  echo "docker=$(docker version --format '{{.Server.Version}}')"
  uname -a
} >"$RESULTS/environment.txt"

curl -fsS "http://127.0.0.1:$WASMDEE_PORT/runtime" >"$RESULTS/wasmdee-runtime.json"
echo "benchmark artifacts written to $RESULTS"
