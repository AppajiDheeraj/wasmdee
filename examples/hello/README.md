# hello example

This folder is a manifest template for a conventional WASI command function.
Provide a `hello.wasm` compiled for WASI before deploying it.

`wasmdee.yaml` shows the deployment manifest format. It registers one
function, assigns an HTTP route, records a custom public URL, and captures
function-level controls enforced by the local runtime.

```bash
wasmdee deploy --config examples/hello/wasmdee.yaml
wasmdee serve --preload
curl -X POST http://127.0.0.1:8080/hello -d '{"name":"world"}'
```

For a runnable fixture that exercises the reusable instance pool, use
[`examples/handler`](../handler/README.md).
