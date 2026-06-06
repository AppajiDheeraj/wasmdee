package state

import (
	"path/filepath"
	"testing"
)

func TestFunctionRegistryRoundTrip(t *testing.T) {
	CloseDB()
	Configure(filepath.Join(t.TempDir(), "wasmdee.db"))
	t.Cleanup(CloseDB)

	fn := Function{
		Name:         "hello",
		WasmPath:     "/tmp/hello.wasm",
		Capabilities: "{}",
		CreatedAt:    123,
	}
	if err := SaveFunction(fn); err != nil {
		t.Fatalf("SaveFunction() error = %v", err)
	}

	got, err := GetFunction("hello")
	if err != nil {
		t.Fatalf("GetFunction() error = %v", err)
	}
	if got != fn {
		t.Fatalf("GetFunction() = %+v, want %+v", got, fn)
	}

	functions, err := ListFunctions()
	if err != nil {
		t.Fatalf("ListFunctions() error = %v", err)
	}
	if len(functions) != 1 || functions[0] != fn {
		t.Fatalf("ListFunctions() = %+v, want [%+v]", functions, fn)
	}
}

func TestSaveFunctionReplacesExistingRecord(t *testing.T) {
	CloseDB()
	Configure(filepath.Join(t.TempDir(), "wasmdee.db"))
	t.Cleanup(CloseDB)

	first := Function{Name: "hello", WasmPath: "/tmp/one.wasm", Capabilities: "{}", CreatedAt: 1}
	second := Function{Name: "hello", WasmPath: "/tmp/two.wasm", Capabilities: `{"kv":true}`, CreatedAt: 2}
	if err := SaveFunction(first); err != nil {
		t.Fatalf("SaveFunction(first) error = %v", err)
	}
	if err := SaveFunction(second); err != nil {
		t.Fatalf("SaveFunction(second) error = %v", err)
	}

	got, err := GetFunction("hello")
	if err != nil {
		t.Fatalf("GetFunction() error = %v", err)
	}
	if got != second {
		t.Fatalf("GetFunction() = %+v, want %+v", got, second)
	}
}

func TestGetFunctionByRoute(t *testing.T) {
	CloseDB()
	Configure(filepath.Join(t.TempDir(), "wasmdee.db"))
	t.Cleanup(CloseDB)

	fn := Function{
		Name:           "hello",
		WasmPath:       "/tmp/hello.wasm",
		Capabilities:   "{}",
		Route:          "/hello",
		PublicURL:      "https://demo.example.com/hello",
		Domain:         "demo.example.com",
		AppName:        "demo",
		DeploymentName: "demo",
		CreatedAt:      123,
	}
	if err := SaveFunction(fn); err != nil {
		t.Fatalf("SaveFunction() error = %v", err)
	}

	got, err := GetFunctionByRoute("/hello")
	if err != nil {
		t.Fatalf("GetFunctionByRoute() error = %v", err)
	}
	if got != fn {
		t.Fatalf("GetFunctionByRoute() = %+v, want %+v", got, fn)
	}
}
