# wasmdee

> Self-hostable serverless functions powered by WebAssembly. Deploy a `.wasm` file, get an HTTP trigger, and run it through one local Wasm runtime instead of one container per function.

![status](https://img.shields.io/badge/status-building-amber) ![license](https://img.shields.io/badge/license-Apache%202.0-blue) ![language](https://img.shields.io/badge/Go-1.22+-00ADD8)

---

## what it is today

A Wasm-native serverless runtime MVP. It runs WASI command modules through Wazero, keeps one long-lived runtime per process, preloads deployed modules, reuses compiled modules, admits traffic through an autoscaled bounded dispatcher, and can evict idle compiled modules back to zero warm in-process modules.

The research target is proto-faaslet templates, hardened direct function-to-function calls, and snapshot/CoW restore. Those are tracked as architecture milestones and must be proven by benchmarks before they become launch claims.

---

## quick start

```bash
go install github.com/dheeraj/wasmdee/cmd/wasmdee@latest

wasmdee deploy hello.wasm --name hello
wasmdee invoke hello --data '{"name":"world"}' --arg optional-value
wasmdee serve --min-workers 2 --max-workers 16 --queue-size 1024 --preload
```

```bash
curl -X POST http://127.0.0.1:8080/invoke/hello \
  -d '{"name": "world"}'
```

---

## how it works today

| path | status |
|---|---|
| fresh CLI invoke | creates an engine, compiles/loads the module, runs one WASI command |
| warm gateway invoke | reuses the process runtime and compiled-module warm pool, then creates a fresh isolated module instance |
| rehydrate after scale-to-zero | reloads the compiled module through Wazero's file-backed compilation cache |
| true CoW snapshot restore | planned research/runtime milestone |
| reusable faaslet instance pool | planned for a non-WASI handler ABI |

Each invocation still gets isolated Wasm linear memory. The current warm pool is a compiled-module pool, not a reusable memory instance pool.

---

## architecture

```
HTTP gateway  ->  bounded autoscaled dispatcher  ->  long-lived Wazero engine
                                                        |
                                                        v
                                                compiled-module warm pool
                                                        |
                                                        v
                                                fresh WASI module instance
                                                        |
                                                        v
                                                stdout/stderr/exit code
```

Built on ideas from FAASM, Catalyzer, Nightcore, SAND, and Cloudflare Workers.

---

## status

🚧 **actively building** — not production ready.

| phase | status |
|---|---|
| core runtime skeleton (wasmdee deploy + invoke) | ✅ working MVP |
| HTTP trigger | ✅ working MVP |
| long-lived runtime + bounded dispatcher | ✅ working MVP |
| preload + per-function telemetry | ✅ working MVP |
| worker autoscaling + compiled-module scale-to-zero | ✅ working MVP |
| benchmark command for local/HTTP comparison | ✅ working MVP |
| experimental in-process host-call ABI | ✅ initial |
| reusable faaslet instance pool | 🔲 planned |
| snapshot + CoW cold-start | 🔲 planned |
| state tiers + host APIs | 🔲 planned |
| verified Docker/OpenFaaS benchmark report | 🔲 planned |

## current runtime contract

The first working path runs WASI command modules. A function receives the request body on stdin and returns the response on stdout. `deploy` validates the `.wasm`, stores it in the local content-addressed module store, and registers metadata in SQLite. `serve` keeps a long-lived Wazero runtime, preloads deployed modules by default, reuses compiled modules, admits work through a bounded autoscaled dispatcher, and exposes runtime telemetry at `GET /runtime`. CLI `invoke` uses the same runtime path for a single call.

Use `--min-workers`, `--max-workers`, and `--scale-down-after` to tune local worker autoscaling. Use `--scale-to-zero-after` to evict idle compiled modules from the in-process warm pool while keeping the file-backed compilation cache.

Set `WASMDEE_HOME=/path/to/state` to override the default per-user state directory, which is useful for tests and demos.

## development

```bash
make verify
```

CI runs formatting, root Go tests, CLI build, GUI frontend build, and GUI Go package tests.

## benchmarking

Measure wasmdee directly:

```bash
wasmdee bench ./hello.wasm --iterations 1000 --warmup 100 --concurrency 8 --json
```

Measure any HTTP baseline with the same histogram code:

```bash
wasmdee bench http://127.0.0.1:8080/invoke/hello --label wasmdee-http
wasmdee bench http://127.0.0.1:8081/function/hello --label openfaas
```

The command reports cold, rehydrate, and warm latency for local Wasm modules, plus warm HTTP latency for comparable endpoints. See `docs/benchmarking.md` before publishing performance claims.

## desktop console

The Wails GUI is connected to the local runtime. When Supabase auth is not configured, it opens directly as a local desktop console. It can read deployed functions, display engine/dispatcher telemetry, invoke functions, and deploy `.wasm` modules through a native file picker.

Star the repo to follow along. Contributions welcome once Phase 1 ships.

---

## capability model

Each function ships with a `wasmdee.toml` declaring what it can access:

```toml
[capabilities]
network = true
kv      = true
fs      = ["./data"]
```

Everything not listed is denied at the host import layer.

---

## tech stack

Go · Wazero · Cobra · SQLite · Wails · React

---

## license

Apache 2.0 — see [LICENSE](LICENSE)
