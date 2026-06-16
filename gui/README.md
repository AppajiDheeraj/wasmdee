# wasmdee Desktop Console

The desktop console is a Wails application over the same Go deployment,
registry, dispatcher, and runtime packages used by the CLI.

It supports:

- selecting and deploying a local `.wasm` module;
- listing registered functions and routes;
- invoking WASI command and pooled handler functions;
- showing stdout, stderr, exit status, and measured latency;
- inspecting dispatcher, preload, proto-template, and instance-pool telemetry.

## Development

Install frontend dependencies once:

```bash
cd gui/frontend
npm ci
```

Run the native application with Wails:

```bash
cd gui
wails dev
```

The browser-only frontend preview is useful for layout work:

```bash
cd gui/frontend
npm run dev
```

Browser preview does not have the Wails Go bridge, so deployment and invocation
are intentionally unavailable there.

## Verification

```bash
cd gui/frontend
npm run build

cd ..
go test ./...
```

Supabase authentication is optional. Without frontend environment credentials,
the application opens directly as a local runtime console.
