# Handler ABI

The handler ABI is wasmdee's reusable function contract. A compatible module
must export:

```text
memory
wasmdee_alloc(size i32) -> pointer i32
wasmdee_handle(request_ptr i32, request_len i32) -> packed_response i64
wasmdee_reset() -> status i32
```

`wasmdee_handle` packs the response pointer into the upper 32 bits and the
response length into the lower 32 bits:

```text
packed_response = (response_pointer << 32) | response_length
```

## Invocation Lifecycle

1. Compile the module once and validate all export signatures.
2. Pre-instantiate the configured number of handler instances.
3. Borrow one instance exclusively for a request.
4. Call `wasmdee_alloc` and copy the request into linear memory.
5. Call `wasmdee_handle` and copy the returned response out of memory.
6. Call `wasmdee_reset`.
7. Return the instance only when reset succeeds.

Timeouts, traps, invalid memory ranges, oversized responses, and reset failures
cause the instance to be closed. The pool replenishes on a later invocation.

## Reset Contract

`wasmdee_reset` must restore all mutable application state that may affect a
later request, including allocator cursors, request-local globals, and mutable
buffers. Returning zero declares the instance reusable.

This is cooperative reset, not snapshot restoration. The runtime cannot verify
that user code reset every byte of mutable memory. Functions with secrets or
complex mutable state should use the fresh WASI command path until stronger
restoration is available.

## Limits

The gateway and engine enforce:

- HTTP request-body limits;
- handler request and response memory limits;
- exclusive instance borrowing;
- invocation deadlines;
- per-function `max_concurrency`;
- direct-call cycle and depth limits.

See [`examples/handler`](../examples/handler/README.md) for a runnable module.
