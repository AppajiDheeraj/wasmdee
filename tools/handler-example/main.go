package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/dheeraj/wasmdee/internal/wasmfixture"
)

func main() {
	output := flag.String("out", "examples/handler/echo.wasm", "output WebAssembly module")
	flag.Parse()

	if err := os.MkdirAll(filepath.Dir(*output), 0o755); err != nil {
		fail(err)
	}
	if err := os.WriteFile(*output, wasmfixture.EchoHandler(0), 0o644); err != nil {
		fail(err)
	}
	fmt.Printf("wrote %s\n", *output)
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
