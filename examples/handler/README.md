# Pooled Handler Example

This example exercises wasmdee's reusable handler-instance path. The function
echoes the request body and exports the complete handler ABI:

```text
memory
wasmdee_alloc(size i32) -> pointer i32
wasmdee_handle(request_ptr i32, request_len i32) -> packed_response i64
wasmdee_reset() -> status i32
```

The handler result packs the response pointer into the upper 32 bits and the
response length into the lower 32 bits. A zero reset status tells the runtime
that the borrowed instance is safe to return to the pool. Failed or timed-out
instances are closed and replaced on a later invocation.

Generate the fixture:

```bash
go run ./tools/handler-example
```

Deploy and start the gateway:

```bash
export WASMDEE_HOME=/tmp/wasmdee-handler-demo
go run ./cmd/wasmdee deploy --config examples/handler/wasmdee.yaml
go run ./cmd/wasmdee serve --addr 127.0.0.1:8080 --handler-pool-size 4
```

Invoke it:

```bash
curl --request POST --data 'hello pooled runtime' http://127.0.0.1:8080/echo
curl http://127.0.0.1:8080/runtime
```

The response appears in `stdout`. The runtime endpoint reports handler
invocations, available and in-use instances, waits, and discarded instances.
