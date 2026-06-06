# System Trace

This document follows the implemented wasmdee code paths as they exist today.
It is meant to be the source material for architecture diagrams, talks, and
contributor onboarding.

## Mental Model

wasmdee is a local-first control plane plus a single-process Wasm data plane.
The durable control-plane state is small: a SQLite registry and a
content-addressed module store. The hot data-plane path is a long-lived Wazero
engine, a bounded autoscaling dispatcher, and one fresh WASI module instance per
invocation.

```mermaid
flowchart LR
    Developer["Developer"]
    CLI["wasmdee CLI"]
    GUI["Wails GUI"]
    HTTP["HTTP gateway"]
    State["SQLite function registry"]
    Store["Content-addressed module store"]
    Dispatcher["Bounded autoscaling dispatcher"]
    Engine["Long-lived Wazero engine"]
    WarmPool["Compiled-module warm pool"]
    Cache["File-backed compilation cache"]
    Instance["Fresh WASI module instance"]
    Telemetry["Runtime and function telemetry"]

    Developer --> CLI
    Developer --> GUI
    CLI --> State
    CLI --> Store
    GUI --> State
    GUI --> Store
    HTTP --> State
    GUI --> Dispatcher
    HTTP --> Dispatcher
    Dispatcher --> Engine
    Engine --> WarmPool
    Engine --> Cache
    WarmPool --> Instance
    Instance --> Telemetry
    Dispatcher --> Telemetry
    Engine --> Telemetry
```

## Deploy Trace

Deploying a function is a metadata and validation operation. It does not create
a permanently running function process.

```mermaid
sequenceDiagram
    participant User
    participant CLI as "wasmdee deploy"
    participant Manifest as "deploy manifest parser"
    participant Store as "module store"
    participant Validator as "temporary Wazero engine"
    participant DB as "SQLite registry"

    User->>CLI: deploy hello.wasm or --config wasmdee.yaml
    CLI->>Manifest: parse YAML when --config is present
    Manifest->>Manifest: validate app, names, routes, domains, controls
    CLI->>Store: hash and copy .wasm as sha256.wasm
    CLI->>Validator: compile stored module once
    Validator-->>CLI: valid Wasm or deploy error
    CLI->>DB: save function metadata
    DB-->>User: name, route, public URL metadata
```

Implemented pieces:

- `internal/cli/deploy.go` owns command arguments and output.
- `internal/deploy/manifest.go` parses YAML deployments.
- `internal/deploy/validation.go` validates names, routes, and domains.
- `internal/deploy/deploy.go` hashes, stores, validates, and registers modules.
- `internal/state/db.go` persists function metadata.

Important boundary: public URLs and custom domains are metadata today. Actual
DNS, TLS, and external routing are future control-plane work.

## Gateway Startup Trace

`wasmdee serve` is where the hot path becomes long-lived. The process creates
one Wazero runtime, installs WASI and the experimental `wasmdee.invoke` host ABI,
optionally precompiles deployed modules, then starts an autoscaling dispatcher.

```mermaid
sequenceDiagram
    participant CLI as "wasmdee serve"
    participant Engine as "Wazero engine"
    participant DB as "SQLite registry"
    participant Dispatcher as "Dispatcher"
    participant HTTP as "HTTP mux"

    CLI->>Engine: NewEngine(cache dir, scale-to-zero policy)
    Engine->>Engine: instantiate WASI imports
    Engine->>Engine: instantiate wasmdee.invoke host ABI
    CLI->>DB: ListFunctions()
    CLI->>Engine: Preload(functions)
    Engine->>Engine: compile modules into warm pool
    CLI->>Dispatcher: NewDispatcher(min/max workers, queue size)
    CLI->>HTTP: register /functions, /runtime, /healthz, /invoke/{name}, route paths
    HTTP-->>CLI: listen on configured address
```

Implemented pieces:

- `internal/cli/serve.go` wires the gateway and JSON endpoints.
- `internal/runtime/executor.go` owns Wazero, WASI, compilation, and invocation.
- `internal/runtime/dispatcher.go` owns admission control and worker scaling.

## HTTP Invocation Trace

There are two HTTP invocation routes:

- `POST /invoke/{name}` resolves by function name.
- `POST /{route}` resolves by deployment route.

Both paths converge before execution.

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as "HTTP gateway"
    participant DB as "SQLite registry"
    participant Dispatcher as "Dispatcher"
    participant Worker as "Worker"
    participant Engine as "Wazero engine"
    participant Module as "Fresh WASI instance"

    Client->>Gateway: POST /hello body + ?arg=
    Gateway->>DB: GetFunctionByRoute("/hello")
    DB-->>Gateway: function metadata
    Gateway->>Dispatcher: Submit(invocation)
    alt queue has capacity
        Dispatcher->>Worker: enqueue job
        Worker->>Engine: Invoke(function, stdin, argv)
        Engine->>Engine: Compile() or warm-pool hit
        Engine->>Module: Instantiate compiled module with stdin/stdout/stderr
        Module-->>Engine: stdout, stderr, exit code
        Engine-->>Worker: result + latency
        Worker-->>Dispatcher: complete telemetry
        Dispatcher-->>Gateway: result
        Gateway-->>Client: JSON response
    else queue full
        Dispatcher-->>Gateway: ErrQueueFull
        Gateway-->>Client: 429 Too Many Requests
    end
```

Current isolation model:

- Shared: Go process, Wazero runtime, WASI imports, compiled modules, file-backed
  compilation cache, dispatcher workers.
- Per invocation: Wasm instance, linear memory, stdin/stdout/stderr buffers,
  argv, timeout context.

This is why the stable request path remains a compiled-module warm pool plus a
fresh WASI instance. The runtime now also records proto-faaslet templates and can
pre-instantiate modules that expose the experimental `wasmdee_handle` handler
ABI, but that handler path still needs an SDK and request/response ABI before it
becomes the normal invocation route.

## GUI Trace

The GUI is not a separate runtime model. It embeds the same runtime packages
behind Wails bindings.

```mermaid
sequenceDiagram
    participant React as "React frontend"
    participant Wails as "Wails bridge"
    participant App as "gui/app.go"
    participant DB as "SQLite registry"
    participant Dispatcher as "Dispatcher"
    participant Engine as "Wazero engine"

    React->>Wails: RuntimeSnapshot()
    Wails->>App: RuntimeSnapshot
    App->>DB: ListFunctions()
    App->>Engine: Stats()
    App->>Dispatcher: Stats() + FunctionStats()
    App-->>React: functions, engine, dispatcher, preload, telemetry

    React->>Wails: InvokeFunction(name, body, args)
    Wails->>App: InvokeFunction
    App->>DB: GetFunction(name)
    App->>Dispatcher: Submit(invocation)
    Dispatcher->>Engine: Invoke()
    Engine-->>React: stdout, stderr, exit code, latency
```

Implemented pieces:

- `gui/app.go` initializes the embedded engine and dispatcher.
- `gui/frontend/src/lib/wasmdee-runtime.js` calls generated Wails bindings.
- `gui/frontend/src/pages/dashboard-page.jsx` renders the live snapshot.

Design boundary: the GUI should remain a client over the same deploy, state, and
runtime packages. It should not become a second control plane with different
semantics.

## Benchmark Trace

Benchmarking has two modes.

```mermaid
flowchart TB
    Bench["wasmdee bench"]
    Local["Local .wasm target"]
    HTTP["HTTP endpoint target"]
    Cold["Cold: fresh engine and empty in-process cache"]
    Rehydrate["Rehydrate: evict warm compiled module, reuse file cache"]
    Warm["Warm: dispatcher + warm compiled module + fresh instance"]
    Report["Text, JSON, or HTML report"]
    Docker["Docker/OpenFaaS endpoint"]

    Bench --> Local
    Bench --> HTTP
    Local --> Cold
    Local --> Rehydrate
    Local --> Warm
    HTTP --> Docker
    HTTP --> Warm
    Cold --> Report
    Rehydrate --> Report
    Warm --> Report
```

Local `.wasm` mode measures cold, rehydrate, and warm phases inside wasmdee.
HTTP mode measures round-trip latency for any POST endpoint. Docker and OpenFaaS
comparisons are valid only when those systems are actually running as endpoints
under the same payload, machine, concurrency, and iteration settings.

## Autoscaling and Scale-To-Zero Trace

```mermaid
flowchart LR
    Queue["Invocation queue"]
    Workers["Active workers"]
    ScaleUp["maybeScaleUp()"]
    IdleTimer["worker idle timer"]
    Retire["retire extra worker"]
    Engine["Engine warm pool"]
    Reaper["idle module reaper"]
    Cache["file-backed compilation cache"]

    Queue --> Workers
    Queue --> ScaleUp
    ScaleUp --> Workers
    Workers --> IdleTimer
    IdleTimer --> Retire
    Engine --> Reaper
    Reaper --> Cache
```

Worker autoscaling is local process concurrency, not Kubernetes-style replica
autoscaling. Scale-to-zero currently evicts compiled modules from the in-process
warm pool while keeping the file-backed compilation cache. It is not yet
snapshot/CoW memory restore.

## End-To-End Architecture Diagram

```mermaid
flowchart TB
    subgraph Interfaces["Developer interfaces"]
        CLI["CLI commands"]
        GUI["Wails desktop GUI"]
        Client["HTTP clients"]
    end

    subgraph ControlPlane["Local control plane"]
        Manifest["YAML manifest parser"]
        Validation["Name, route, domain validation"]
        Registry["SQLite function registry"]
        ModuleStore["Content-addressed .wasm store"]
    end

    subgraph DataPlane["Single-process Wasm data plane"]
        Gateway["HTTP gateway"]
        Dispatcher["Bounded autoscaling dispatcher"]
        Engine["Long-lived Wazero engine"]
        WASI["WASI imports"]
        HostABI["wasmdee.invoke host ABI"]
        WarmPool["Compiled-module warm pool"]
        FileCache["Compilation cache"]
        Instance["Fresh WASI instance per request"]
        Telemetry["Engine, dispatcher, function telemetry"]
    end

    CLI --> Manifest
    Manifest --> Validation
    CLI --> Validation
    Validation --> ModuleStore
    Validation --> Registry
    GUI --> Registry
    GUI --> Dispatcher
    Client --> Gateway
    Gateway --> Registry
    Gateway --> Dispatcher
    Dispatcher --> Engine
    Engine --> WASI
    Engine --> HostABI
    Engine --> WarmPool
    Engine --> FileCache
    WarmPool --> Instance
    Instance --> Telemetry
    Dispatcher --> Telemetry
    Engine --> Telemetry
    HostABI --> Registry
    HostABI --> Engine
```

## What To Say In A Review

The concise explanation:

> wasmdee pays runtime setup once per node, stores functions as Wasm modules
> instead of container images, admits requests through a bounded dispatcher, and
> executes stable WASI command requests as fresh isolated instances from a warm
> compiled module. The current system proves compiled-module reuse, route
> deployment, local autoscaling, scale-to-zero rehydration, proto-faaslet
> template tracking, handler-ABI pool scaffolding, direct host-call experiments,
> and benchmark reporting. Snapshot/CoW restore is the next research milestone,
> not a current launch claim.

## Current Truth Table

| capability | current behavior |
|---|---|
| YAML deployment | implemented |
| route-based HTTP invoke | implemented |
| public URL metadata | implemented, no DNS/TLS provisioning yet |
| long-lived runtime | implemented |
| compiled-module warm pool | implemented |
| proto-faaslet template store | implemented |
| handler-ABI instance pool | initial scaffolding |
| fresh memory per invocation | implemented |
| local worker autoscaling | implemented |
| compiled-module scale-to-zero | implemented |
| proto-faaslet snapshot/CoW restore | planned |
| lazy page restore/fork restore | research |
| Docker/OpenFaaS comparison | benchmark harness implemented; data must be measured |
