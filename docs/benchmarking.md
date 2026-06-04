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
  --json
```

Local mode reports:

- `cold`: a fresh Wazero runtime and empty compilation cache for each measured
  run.
- `rehydrate`: the module is evicted from the in-process compiled-module warm
  pool, then loaded again through Wazero's file-backed compilation cache.
- `warm`: the steady-state path through the long-lived engine, compiled-module
  warm pool, bounded dispatcher, and autoscaled workers.

This is not a proto-faaslet snapshot benchmark yet. It does not prove CoW
snapshot restore, lazy page restore, OS fork restore, or reusable instance-pool
latency.

## HTTP baseline benchmark

```bash
wasmdee bench http://127.0.0.1:8080/invoke/hello \
  --label wasmdee-http \
  --iterations 1000 \
  --warmup 100 \
  --concurrency 8 \
  --data '{"name":"world"}' \
  --json
```

Run the same command against an OpenFaaS function, a Docker container endpoint,
or another baseline:

```bash
wasmdee bench http://127.0.0.1:8081/function/hello --label openfaas --json
wasmdee bench http://127.0.0.1:8082/hello --label docker --json
```

HTTP mode reports the same p50, p95, p99, min, max, error count, and throughput
fields. It intentionally does not know whether the target is OpenFaaS, Docker,
or another system; the label is supplied by the experiment runner.

## Publishing Rules

Before claiming `N x faster`, publish:

- wasmdee commit SHA.
- CPU model, core count, RAM, OS, Go version, and Wazero version.
- Function source code and compiled Wasm artifact.
- Exact `wasmdee bench` commands.
- Raw JSON output for wasmdee and each baseline.
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
output buffer, and returns a packed status/size value. This bypasses HTTP, but it
still needs SDK examples, call-chain limits, tracing, and policy controls before
it should be presented as the final fast path.

The planned faaslet path should introduce a handler ABI where a module exports a
stable function such as `handle(ptr, len) -> result`. That ABI can support:

- pre-instantiated template modules,
- direct function-to-function host calls,
- snapshot-after-init experiments,
- memory reset or pseudo-snapshot restore,
- eventual lower-level CoW/lazy page restore if the runtime exposes the needed
  memory controls.
