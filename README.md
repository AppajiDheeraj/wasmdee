# wasmdee

> Self-hostable serverless functions powered by WebAssembly. Deploy a `.wasm` file, get an HTTP trigger, zero containers, zero overhead.

![status](https://img.shields.io/badge/status-building-amber) ![license](https://img.shields.io/badge/license-Apache%202.0-blue) ![language](https://img.shields.io/badge/Go-1.22+-00ADD8)

---

## what it is

A Wasm-native serverless runtime that runs functions at microsecond scale — using CoW snapshots for near-zero cold starts and in-process dispatch to eliminate inter-function latency. Single binary. No containers. No orchestrator.

---

## quick start

```bash
go install github.com/dheeraj/wasmdee/cmd/wrun@latest

wrun deploy hello.wasm
wrun invoke hello
wrun serve   # HTTP on :8080
```

```bash
curl -X POST http://localhost:8080/invoke/hello \
  -d '{"name": "world"}'
```

---

## how it works

| invocation path | latency |
|---|---|
| warm pool hit (fork template) | < 3ms |
| CoW restore from snapshot | < 50ms |
| in-process function-to-function call | ~0 (no HTTP) |

Functions are threads, not processes. Isolation is handled by Wasm linear memory — not containers. Cold start is eliminated by snapshotting after init, not at binary load.

---

## architecture

```
HTTP gateway  →  epoll dispatcher  →  instance pool
                                           ↓
                                     faaslet executes
                                     (linear memory, caps bound)
                                           ↓
                                     return result
```

Built on ideas from FAASM, Catalyzer, Nightcore, SAND, and Cloudflare Workers.

---

## status

🚧 **actively building** — not production ready.

| phase | status |
|---|---|
| core runtime skeleton (wrun deploy + invoke) | 🔲 in progress |
| instance pool + HTTP trigger | 🔲 planned |
| snapshot + CoW cold-start | 🔲 planned |
| state tiers + host APIs | 🔲 planned |
| benchmarks + launch | 🔲 planned |

Star the repo to follow along. Contributions welcome once Phase 1 ships.

---

## capability model

Each function ships with a `wrun.toml` declaring what it can access:

```toml
[capabilities]
network = true
kv      = true
fs      = ["./data"]
```

Everything not listed is denied at the host import layer.

---

## tech stack

Go 1.22+ · Wazero · Cobra · BoltDB · go-redis · Prometheus

---

## license

Apache 2.0 — see [LICENSE](LICENSE)
