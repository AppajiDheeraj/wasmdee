# Diagram Generation Prompts

Use these prompts when you want more diagrams in the same technical illustration
style as `wasmdee_arrow_architecture.svg`.

## Wide Architecture Board

```text
Create an editable SVG technical architecture illustration for "WASMDEE SERVERLESS FASTPATH".

Style:
- cream engineering-paper background with subtle paper grain
- black pixel/monospace title, all caps
- isometric purple and blue hardware-like blocks
- thick electric-blue arrows for hot-path data flow
- dashed purple arrows for metadata, cache, or future/research paths
- tiny mono callouts, no marketing copy, no fake benchmark numbers
- clean, legible, presentation-ready, 16:9 layout

Content:
- left: Events: HTTP request, CLI invoke, GUI action
- middle-left: Deploy control: YAML manifest, route validation, SQLite registry, content-addressed module store
- middle: Gateway + Dispatcher: route lookup, bounded queue, worker autoscale, 429 when saturated
- right: Wazero Engine: WASI imports, wasmdee.invoke host ABI, compiled-module warm pool, file-backed compilation cache
- far right or bottom: Fresh WASI instance per request: isolated linear memory, stdin/stdout/stderr, argv, timeout
- bottom: Telemetry: engine stats, dispatcher stats, function latency, errors
- dashed future lane: handler ABI -> proto-faaslet template -> snapshot / CoW restore

Important truth:
- Label compiled-module warm pool as implemented.
- Label snapshot/CoW/lazy page restore as future research, not current behavior.
- Do not claim 1000x, <1ms cold start, or 12x density unless benchmark data is shown as measured.
```

## Tall Excalidraw Process

```text
Create a tall Excalidraw-style process diagram named "WASMDEE EVENT TRACE".

Canvas:
- vertical layout, cream background
- hand-drawn rounded rectangles with hachure fills
- blue arrows connecting each stage
- purple dashed arrow to future milestone
- monospace labels

Stages:
1. EVENTS: HTTP request, CLI invoke, GUI action
2. RESOLVE FUNCTION: route/name -> SQLite registry -> function metadata
3. ADMIT REQUEST: bounded dispatcher queue, autoscaling workers, queue full returns 429
4. WAZERO ENGINE: compile or warm-pool hit, file-backed cache supports rehydrate
5. FRESH WASI INSTANCE: isolated linear memory, stdin, argv, stdout, stderr, exit code
6. RESPONSE + TELEMETRY: JSON response, latency, engine counters, dispatcher counters
7. NEXT MILESTONE: handler ABI, proto-faaslet template, snapshot/CoW restore after measurement

Side note:
"implemented truth: shared compiled code, not shared mutable memory, not true CoW snapshots yet"
```

## Component Deep-Dive: Runtime Core

```text
Generate an editable SVG component diagram for "WASMDEE RUNTIME CORE".

Use a cream technical-board background, mono labels, purple/blue isometric
modules, and dashed callout arrows.

Show:
- Dispatcher queue
- Min workers
- Burst workers
- Engine.Invoke()
- Engine.Compile()
- compiled map keyed by wasm path
- Wazero compilation cache on disk
- WASI module instance created per invocation
- stdout/stderr/exit code returned to caller
- telemetry updates after completion

Make the central message obvious:
"compiled code is reused; execution memory is fresh per request"
```

## Component Deep-Dive: Benchmark Proof

```text
Generate an editable SVG diagram for "WASMDEE BENCHMARK PROOF PIPELINE".

Style:
- technical mono diagram, cream background, electric-blue arrows
- use measurement instruments, report sheets, and endpoint blocks
- avoid fake numeric results

Flow:
- local .wasm target -> cold run -> rehydrate run -> warm run
- HTTP endpoint target -> warm round-trip run
- labels: wasmdee, Docker endpoint, OpenFaaS endpoint
- report outputs: text, JSON, HTML
- validation box: same host, same function, same payload, same concurrency, raw artifacts published

Add warning:
"online baseline data may be shown only as external reference"
```
