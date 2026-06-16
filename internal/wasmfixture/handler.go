// Package wasmfixture builds the small WebAssembly modules used by tests and demos.
package wasmfixture

// EchoHandler returns a handler-ABI module that echoes its request body.
// A non-zero resetStatus is useful for testing instance discard behavior.
func EchoHandler(resetStatus byte) []byte {
	module := []byte{0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00}
	module = appendSection(module, 1, vector(
		functionType([]byte{0x7f}, []byte{0x7f}),
		functionType([]byte{0x7f, 0x7f}, []byte{0x7e}),
		functionType(nil, []byte{0x7f}),
	))
	module = appendSection(module, 3, vector([]byte{0x00}, []byte{0x01}, []byte{0x02}))
	module = appendSection(module, 5, vector([]byte{0x00, 0x02}))
	module = appendSection(module, 6, vector([]byte{0x7f, 0x01, 0x41, 0x80, 0x08, 0x0b}))
	module = appendSection(module, 7, vector(
		export("memory", 0x02, 0),
		export("wasmdee_alloc", 0x00, 0),
		export("wasmdee_handle", 0x00, 1),
		export("wasmdee_reset", 0x00, 2),
	))

	allocBody := []byte{
		0x01, 0x01, 0x7f,
		0x23, 0x00,
		0x21, 0x01,
		0x23, 0x00,
		0x20, 0x00,
		0x6a,
		0x24, 0x00,
		0x20, 0x01,
		0x0b,
	}
	handleBody := []byte{
		0x00,
		0x20, 0x00,
		0xad,
		0x42, 0x20,
		0x86,
		0x20, 0x01,
		0xad,
		0x84,
		0x0b,
	}
	resetBody := []byte{
		0x00,
		0x41, 0x80, 0x08,
		0x24, 0x00,
		0x41, resetStatus,
		0x0b,
	}
	module = appendSection(module, 10, vector(
		append(uleb(uint64(len(allocBody))), allocBody...),
		append(uleb(uint64(len(handleBody))), handleBody...),
		append(uleb(uint64(len(resetBody))), resetBody...),
	))
	return module
}

func functionType(params, results []byte) []byte {
	out := []byte{0x60}
	out = append(out, uleb(uint64(len(params)))...)
	out = append(out, params...)
	out = append(out, uleb(uint64(len(results)))...)
	return append(out, results...)
}

func export(name string, kind byte, index uint64) []byte {
	out := uleb(uint64(len(name)))
	out = append(out, name...)
	out = append(out, kind)
	return append(out, uleb(index)...)
}

func vector(items ...[]byte) []byte {
	out := uleb(uint64(len(items)))
	for _, item := range items {
		out = append(out, item...)
	}
	return out
}

func appendSection(module []byte, id byte, payload []byte) []byte {
	module = append(module, id)
	module = append(module, uleb(uint64(len(payload)))...)
	return append(module, payload...)
}

func uleb(value uint64) []byte {
	var out []byte
	for {
		next := byte(value & 0x7f)
		value >>= 7
		if value != 0 {
			next |= 0x80
		}
		out = append(out, next)
		if value == 0 {
			return out
		}
	}
}
