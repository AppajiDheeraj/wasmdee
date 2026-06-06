# hello example

This folder will hold the simplest deployable WebAssembly function for `wasmdee`.

`wasmdee.yaml` shows the production-style deployment manifest. It registers one
function, assigns an HTTP route, records a custom public URL, and captures
function-level controls that the runtime/control plane can enforce as the
platform matures.

```bash
wasmdee deploy --config examples/hello/wasmdee.yaml
wasmdee serve --preload
curl -X POST http://127.0.0.1:8080/hello -d '{"name":"world"}'
```
