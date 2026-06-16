# Internship Demo Runbook

This runbook demonstrates only behavior implemented by the repository.

## 1. Verify

```bash
make verify
cd gui/frontend && npm ci && npm run build
cd ../.. && go test -race ./internal/runtime
```

## 2. Generate and Deploy the Handler

```bash
go run ./tools/handler-example
export WASMDEE_HOME=/tmp/wasmdee-internship
go run ./cmd/wasmdee deploy --config examples/handler/wasmdee.yaml
```

Deployment hashes the module, stores it by digest, validates it with Wazero, and
records route and policy metadata in SQLite.

## 3. Run the Gateway

```bash
go run ./cmd/wasmdee serve \
  --addr 127.0.0.1:8080 \
  --min-workers 1 \
  --max-workers 8 \
  --handler-pool-size 4
```

Invoke the route:

```bash
curl --request POST --data 'hello internship' http://127.0.0.1:8080/echo
curl http://127.0.0.1:8080/runtime
```

Point out the handler invocation count, available instances, pool waits,
discard count, dispatcher workers, and per-function telemetry.

## 4. Show Scale-to-Zero

Set a short `scale_to_zero_after` in a temporary manifest, deploy it, invoke
once, wait for the policy interval, then compare `/runtime` before and after.
The compiled in-process entry and handler pool are released; the file-backed
compilation cache remains for rehydration.

## 5. Benchmark

Local handler measurement:

```bash
go run ./cmd/wasmdee bench examples/handler/echo.wasm \
  --data benchmark-payload \
  --iterations 1000 \
  --warmup 100 \
  --concurrency 16 \
  --handler-pool-size 16 \
  --report /tmp/wasmdee-handler.json
```

Same-machine Docker comparison:

```bash
./scripts/benchmark-compare.sh
```

The Docker script requires a running Docker daemon. Present only the generated
results and environment metadata. Do not reuse numbers from another machine as
if they were measured here.

## 6. Open the Desktop Console

```bash
cd gui
wails dev
```

Show deployment, ABI-aware invocation, stdout, latency, runtime telemetry, and
instance-pool counters.

## Defensible Project Summary

wasmdee is a single-node Wasm FaaS prototype with content-addressed deployment,
SQLite routing metadata, a long-lived Wazero engine, bounded autoscaling
dispatch, fresh WASI execution, reusable handler instances, per-function
controls, direct local calls, scale-to-zero rehydration, a desktop console, and
reproducible benchmark tooling.

It does not yet provide multi-node scheduling, external DNS/TLS provisioning,
hard multi-tenant isolation, page-level snapshots, CoW restore, or lazy page
faulting.
