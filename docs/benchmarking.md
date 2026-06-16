# Benchmarking

wasmdee should publish performance claims only when they can be reproduced from
this repository on a named machine profile.

The benchmark command supports two paths:

1. Local Wasm module benchmarking.
2. HTTP endpoint benchmarking for wasmdee, OpenFaaS, Dockerized functions, or
   any other comparable function URL.

## Local Wasm benchmark

```bash
wasmdee bench ./hello.wasm \
  --name hello \
  --iterations 1000 \
  --warmup 100 \
  --concurrency 8 \
  --report reports/hello-local.html \
  --json
```

Local mode reports:

- `cold`: a fresh Wazero runtime and empty compilation cache for each measured
  run.
- `rehydrate`: the module is evicted from the in-process compiled-module warm
  pool, then loaded again through Wazero's file-backed compilation cache.
- `warm`: the steady-state path through the long-lived engine, compiled-module
  warm pool, bounded dispatcher, and autoscaled workers.
- `memory`: Go heap allocation before and after the warm run, included in JSON
  and HTML reports.

When the target implements the handler ABI, the warm series measures exclusive
borrowing from the reusable instance pool, request/response transfer through
linear memory, reset, and return to the pool. The report records
`execution_abi`, handler invocation count, pool waits, and discarded instances.

This is not a proto-faaslet snapshot benchmark. It does not prove CoW snapshot
restore, lazy page restore, or OS fork restore.

Use `--report path/to/result.html` for a shareable visual report or
`--report path/to/result.json` for raw data that can be checked into a benchmark
dataset.

## HTTP baseline benchmark

```bash
wasmdee bench http://127.0.0.1:8080/invoke/hello \
  --label wasmdee-http \
  --iterations 1000 \
  --warmup 100 \
  --concurrency 8 \
  --data '{"name":"world"}' \
  --report reports/wasmdee-http.html \
  --json
```

Run the same command against an OpenFaaS function, a Docker container endpoint,
or another baseline:

```bash
wasmdee bench http://127.0.0.1:8081/function/hello --label openfaas --report reports/openfaas.html --json
wasmdee bench http://127.0.0.1:8082/hello --label docker --report reports/docker.html --json
```

HTTP mode reports the same p50, p95, p99, min, max, error count, and throughput
fields. It intentionally does not know whether the target is OpenFaaS, Docker,
or another system; the label is supplied by the experiment runner.

For 100+ concurrent functions, run the same manifest shape across each platform:

```bash
wasmdee deploy --config wasmdee.yaml
wasmdee serve --min-workers 8 --max-workers 256 --queue-size 4096 --preload
wasmdee bench http://127.0.0.1:8080/hello --label wasmdee-100fn --concurrency 128 --iterations 10000 --report reports/wasmdee-100fn.html --json
```

Then repeat against the Docker/OpenFaaS endpoints with identical payload,
concurrency, iteration count, host, and function code.

## Publishing Rules

Before claiming `N x faster`, publish:

- wasmdee commit SHA.
- CPU model, core count, RAM, OS, Go version, and Wazero version.
- Function source code and compiled Wasm artifact.
- Exact `wasmdee bench` commands.
- Raw JSON output for wasmdee and each baseline.
- HTML reports when presenting the result publicly.
- Whether the measured path is local, HTTP, cold, rehydrate, or warm.
- Whether the baseline was already warm or had to cold-start a container.

Do not claim `<1ms cold start`, `1000x speedup`, or `12x density` from the
current runtime alone. The current runtime can prove compiled-module reuse,
dispatcher throughput, and rehydrate-after-eviction behavior. True CoW/lazy
restore and density claims need a later snapshot/runtime milestone plus memory
footprint measurements.

## Architecture Implications

WASI command modules are single-shot: instantiation runs `_start`, the command
exits, and the module instance is closed. That path is excellent for portability
and early adoption, but it is not the right shape for a reusable faaslet pool.

The current engine exposes an experimental `wasmdee.invoke` host import:

```wat
(import "wasmdee" "invoke"
  (func $invoke
    (param i32 i32 i32 i32 i32 i32)
    (result i64)))
```

The ABI reads a target function name and payload from caller memory, invokes the
target deployed function in the same process, writes stdout into the caller's
output buffer, and returns a packed status/size value. This bypasses HTTP. The
runtime enforces call-cycle and maximum-depth limits, while distributed tracing
and richer authorization policy remain future work.

Handler-ABI modules borrow a pre-instantiated instance, exchange request and
response bytes through linear memory, reset the instance, and return it to the
pool. See `docs/handler-abi.md` for the exact contract.

Use `scripts/benchmark-compare.sh` for a same-machine wasmdee-versus-Docker HTTP
comparison. The script requires a running Docker daemon and writes raw JSON,
runtime telemetry, logs, and environment metadata under `benchmark-results/`.
Online benchmark numbers are background context only and must not be mixed with
locally measured wasmdee data.
