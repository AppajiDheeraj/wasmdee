package runtime

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/dheeraj/wasmdee/internal/state"
)

var emptyStartWasm = []byte{
	0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
	0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
	0x03, 0x02, 0x01, 0x00,
	0x07, 0x0a, 0x01, 0x06, 0x5f, 0x73, 0x74, 0x61, 0x72, 0x74, 0x00, 0x00,
	0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b,
}

var infiniteLoopWasm = []byte{
	0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
	0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
	0x03, 0x02, 0x01, 0x00,
	0x07, 0x0a, 0x01, 0x06, 0x5f, 0x73, 0x74, 0x61, 0x72, 0x74, 0x00, 0x00,
	0x0a, 0x09, 0x01, 0x07, 0x00, 0x03, 0x40, 0x0c, 0x00, 0x0b, 0x0b,
}

var handlerWasm = []byte{
	0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
	0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
	0x03, 0x02, 0x01, 0x00,
	0x07, 0x12, 0x01, 0x0e, 0x77, 0x61, 0x73, 0x6d, 0x64, 0x65, 0x65, 0x5f, 0x68, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x00, 0x00,
	0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x07, 0x0b,
}

func TestEngineInvokeReusesCompiledModule(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	wasmPath := writeTestWasm(t, dir, "empty.wasm", emptyStartWasm)

	engine, err := NewEngine(ctx, EngineConfig{CacheDir: filepath.Join(dir, "cache")})
	if err != nil {
		t.Fatalf("NewEngine() error = %v", err)
	}
	defer engine.Close(ctx)

	fn := state.Function{Name: "empty", WasmPath: wasmPath}
	for i := 0; i < 2; i++ {
		result, err := engine.Invoke(ctx, Invocation{Function: fn, Timeout: time.Second})
		if err != nil {
			t.Fatalf("Invoke() run %d error = %v", i+1, err)
		}
		if result.ExitCode != 0 {
			t.Fatalf("Invoke() run %d exit code = %d", i+1, result.ExitCode)
		}
	}

	stats := engine.Stats()
	if stats.CompiledModules != 1 {
		t.Fatalf("CompiledModules = %d, want 1", stats.CompiledModules)
	}
	if stats.CompileRequests != 2 {
		t.Fatalf("CompileRequests = %d, want 2", stats.CompileRequests)
	}
	if stats.CompileHits != 1 {
		t.Fatalf("CompileHits = %d, want 1", stats.CompileHits)
	}
	if stats.Invocations != 2 {
		t.Fatalf("Invocations = %d, want 2", stats.Invocations)
	}
}

func TestEnginePreloadCompilesFunctions(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	wasmPath := writeTestWasm(t, dir, "empty.wasm", emptyStartWasm)

	engine, err := NewEngine(ctx, EngineConfig{CacheDir: filepath.Join(dir, "cache")})
	if err != nil {
		t.Fatalf("NewEngine() error = %v", err)
	}
	defer engine.Close(ctx)

	result := engine.Preload(ctx, []state.Function{{Name: "empty", WasmPath: wasmPath}})
	if result.Requested != 1 || result.Compiled != 1 || len(result.Failed) != 0 {
		t.Fatalf("Preload() = %+v, want requested=1 compiled=1 failed=0", result)
	}
	if got := engine.Stats().CompiledModules; got != 1 {
		t.Fatalf("CompiledModules = %d, want 1", got)
	}
}

func TestEngineProtoStoreTracksWASICommandTemplate(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	wasmPath := writeTestWasm(t, dir, "empty.wasm", emptyStartWasm)

	engine, err := NewEngine(ctx, EngineConfig{CacheDir: filepath.Join(dir, "cache")})
	if err != nil {
		t.Fatalf("NewEngine() error = %v", err)
	}
	defer engine.Close(ctx)

	fn := state.Function{Name: "empty", WasmPath: wasmPath}
	if result := engine.Preload(ctx, []state.Function{fn}); result.Compiled != 1 {
		t.Fatalf("Preload().Compiled = %d, want 1", result.Compiled)
	}

	stats := engine.Stats()
	if stats.ProtoFaaslets != 1 {
		t.Fatalf("ProtoFaaslets = %d, want 1", stats.ProtoFaaslets)
	}
	if stats.InstancePools != 0 || stats.WarmInstances != 0 {
		t.Fatalf("InstancePools/WarmInstances = %d/%d, want 0/0", stats.InstancePools, stats.WarmInstances)
	}
	templates := engine.ProtoFaaslets()
	if len(templates) != 1 {
		t.Fatalf("ProtoFaaslets() len = %d, want 1", len(templates))
	}
	if templates[0].ABI != abiWASICommand || templates[0].PoolEligible {
		t.Fatalf("template = %+v, want wasi-command and not pool eligible", templates[0])
	}
}

func TestEnginePreloadCreatesHandlerInstancePool(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	wasmPath := writeTestWasm(t, dir, "handler.wasm", handlerWasm)

	engine, err := NewEngine(ctx, EngineConfig{CacheDir: filepath.Join(dir, "cache")})
	if err != nil {
		t.Fatalf("NewEngine() error = %v", err)
	}
	defer engine.Close(ctx)

	fn := state.Function{Name: "handler", WasmPath: wasmPath}
	if result := engine.Preload(ctx, []state.Function{fn}); result.Compiled != 1 || len(result.Failed) != 0 {
		t.Fatalf("Preload() = %+v, want compiled=1 failed=0", result)
	}

	stats := engine.Stats()
	if stats.ProtoFaaslets != 1 {
		t.Fatalf("ProtoFaaslets = %d, want 1", stats.ProtoFaaslets)
	}
	if stats.InstancePools != 1 || stats.WarmInstances != 1 {
		t.Fatalf("InstancePools/WarmInstances = %d/%d, want 1/1", stats.InstancePools, stats.WarmInstances)
	}
	templates := engine.ProtoFaaslets()
	if len(templates) != 1 {
		t.Fatalf("ProtoFaaslets() len = %d, want 1", len(templates))
	}
	if templates[0].ABI != abiHandler || !templates[0].PoolEligible || templates[0].PoolSize != 1 {
		t.Fatalf("template = %+v, want handler pool size 1", templates[0])
	}
}

func TestEngineEvictsAndRehydratesCompiledModule(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	wasmPath := writeTestWasm(t, dir, "empty.wasm", emptyStartWasm)

	engine, err := NewEngine(ctx, EngineConfig{CacheDir: filepath.Join(dir, "cache")})
	if err != nil {
		t.Fatalf("NewEngine() error = %v", err)
	}
	defer engine.Close(ctx)

	fn := state.Function{Name: "empty", WasmPath: wasmPath}
	if result := engine.Preload(ctx, []state.Function{fn}); result.Compiled != 1 {
		t.Fatalf("Preload().Compiled = %d, want 1", result.Compiled)
	}

	evicted := engine.EvictFunction(ctx, fn)
	if evicted.Evicted != 1 || evicted.Skipped != 0 {
		t.Fatalf("EvictFunction() = %+v, want evicted=1 skipped=0", evicted)
	}
	if got := engine.Stats().CompiledModules; got != 0 {
		t.Fatalf("CompiledModules after eviction = %d, want 0", got)
	}

	if _, err := engine.Invoke(ctx, Invocation{Function: fn, Timeout: time.Second}); err != nil {
		t.Fatalf("Invoke() after eviction error = %v", err)
	}
	stats := engine.Stats()
	if stats.CompiledModules != 1 {
		t.Fatalf("CompiledModules after rehydrate = %d, want 1", stats.CompiledModules)
	}
	if stats.Evictions != 1 {
		t.Fatalf("Evictions = %d, want 1", stats.Evictions)
	}
}

func TestEngineEvictsIdleCompiledModules(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	wasmPath := writeTestWasm(t, dir, "empty.wasm", emptyStartWasm)

	engine, err := NewEngine(ctx, EngineConfig{CacheDir: filepath.Join(dir, "cache")})
	if err != nil {
		t.Fatalf("NewEngine() error = %v", err)
	}
	defer engine.Close(ctx)

	fn := state.Function{Name: "empty", WasmPath: wasmPath}
	if _, err := engine.Compile(ctx, fn); err != nil {
		t.Fatalf("Compile() error = %v", err)
	}
	time.Sleep(2 * time.Millisecond)

	evicted := engine.EvictIdle(ctx, time.Millisecond)
	if evicted.Evicted != 1 || evicted.Skipped != 0 {
		t.Fatalf("EvictIdle() = %+v, want evicted=1 skipped=0", evicted)
	}
}

func TestDispatcherRejectsWhenQueueFull(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	wasmPath := writeTestWasm(t, dir, "loop.wasm", infiniteLoopWasm)

	engine, err := NewEngine(ctx, EngineConfig{CacheDir: filepath.Join(dir, "cache")})
	if err != nil {
		t.Fatalf("NewEngine() error = %v", err)
	}
	defer engine.Close(ctx)

	dispatcher, err := NewDispatcher(engine, DispatcherConfig{
		Workers:        1,
		QueueSize:      1,
		DefaultTimeout: 500 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("NewDispatcher() error = %v", err)
	}
	defer dispatcher.Close()

	fn := state.Function{Name: "loop", WasmPath: wasmPath}
	done := make(chan error, 2)
	go func() {
		_, err := dispatcher.Submit(ctx, Invocation{Function: fn})
		done <- err
	}()

	waitFor(t, time.Second, func() bool {
		return dispatcher.Stats().Accepted == 1
	})

	go func() {
		_, err := dispatcher.Submit(ctx, Invocation{Function: fn})
		done <- err
	}()

	waitFor(t, time.Second, func() bool {
		stats := dispatcher.Stats()
		return stats.Accepted == 2 && stats.Queued == 1
	})

	_, err = dispatcher.Submit(ctx, Invocation{Function: fn})
	if !errors.Is(err, ErrQueueFull) {
		t.Fatalf("Submit() error = %v, want %v", err, ErrQueueFull)
	}

	stats := dispatcher.FunctionStats()
	if len(stats) != 1 {
		t.Fatalf("FunctionStats() len = %d, want 1", len(stats))
	}
	if stats[0].Name != "loop" {
		t.Fatalf("FunctionStats()[0].Name = %q, want loop", stats[0].Name)
	}
	if stats[0].Accepted != 2 {
		t.Fatalf("FunctionStats()[0].Accepted = %d, want 2", stats[0].Accepted)
	}
	if stats[0].Rejected != 1 {
		t.Fatalf("FunctionStats()[0].Rejected = %d, want 1", stats[0].Rejected)
	}
}

func TestDispatcherScalesWorkersDownAfterIdle(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	wasmPath := writeTestWasm(t, dir, "loop.wasm", infiniteLoopWasm)

	engine, err := NewEngine(ctx, EngineConfig{CacheDir: filepath.Join(dir, "cache")})
	if err != nil {
		t.Fatalf("NewEngine() error = %v", err)
	}
	defer engine.Close(ctx)

	dispatcher, err := NewDispatcher(engine, DispatcherConfig{
		MinWorkers:     1,
		MaxWorkers:     3,
		QueueSize:      4,
		DefaultTimeout: 50 * time.Millisecond,
		ScaleDownAfter: 20 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("NewDispatcher() error = %v", err)
	}
	defer dispatcher.Close()

	fn := state.Function{Name: "loop", WasmPath: wasmPath}
	done := make(chan error, 3)
	for i := 0; i < 3; i++ {
		go func() {
			_, err := dispatcher.Submit(ctx, Invocation{Function: fn})
			done <- err
		}()
	}

	waitFor(t, time.Second, func() bool {
		return dispatcher.Stats().Workers > 1
	})

	for i := 0; i < 3; i++ {
		<-done
	}

	waitFor(t, time.Second, func() bool {
		stats := dispatcher.Stats()
		return stats.Workers == 1 && stats.ScaleDowns > 0
	})
}

func writeTestWasm(t *testing.T, dir, name string, wasm []byte) string {
	t.Helper()
	wasmPath := filepath.Join(dir, name)
	if err := os.WriteFile(wasmPath, wasm, 0o644); err != nil {
		t.Fatalf("WriteFile(%q) error = %v", wasmPath, err)
	}
	return wasmPath
}

func waitFor(t *testing.T, timeout time.Duration, condition func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("condition not met within %s", timeout)
}
