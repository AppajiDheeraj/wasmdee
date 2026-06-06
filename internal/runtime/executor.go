package runtime

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/dheeraj/wasmdee/internal/state"
	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
	"github.com/tetratelabs/wazero/sys"
)

const (
	hostInvokeOK uint64 = iota
	hostInvokeInvalidMemory
	hostInvokeTargetError
	hostInvokeOutputTooLarge
	hostInvokeNonZeroExit
)

// Invocation captures the inputs for a single Wasm function run.
type Invocation struct {
	Function state.Function
	Stdin    []byte
	Args     []string
	CacheDir string
	Timeout  time.Duration
}

// Result is the host-observed output of a Wasm invocation.
type Result struct {
	Stdout   string        `json:"stdout"`
	Stderr   string        `json:"stderr"`
	ExitCode uint32        `json:"exit_code"`
	Latency  time.Duration `json:"-"`
}

// EngineConfig controls the long-lived runtime process for Wasm execution.
type EngineConfig struct {
	CacheDir         string
	ScaleToZeroAfter time.Duration
	HostCallTimeout  time.Duration
}

// EngineStats exposes lightweight counters for gateway health and debugging.
type EngineStats struct {
	CompiledModules    uint64  `json:"compiled_modules"`
	CompileRequests    uint64  `json:"compile_requests"`
	CompileHits        uint64  `json:"compile_hits"`
	Invocations        uint64  `json:"invocations"`
	Evictions          uint64  `json:"evictions"`
	HostCalls          uint64  `json:"host_calls"`
	HostCallFailures   uint64  `json:"host_call_failures"`
	ProtoFaaslets      int     `json:"proto_faaslets"`
	InstancePools      int     `json:"instance_pools"`
	WarmInstances      int     `json:"warm_instances"`
	ScaleToZeroAfterMS float64 `json:"scale_to_zero_after_ms,omitempty"`
}

// PreloadError captures a function that failed pre-compilation.
type PreloadError struct {
	Name string `json:"name"`
	Err  string `json:"error"`
}

// PreloadResult summarizes startup compilation of deployed functions.
type PreloadResult struct {
	Requested int            `json:"requested"`
	Compiled  int            `json:"compiled"`
	Failed    []PreloadError `json:"failed,omitempty"`
}

// EvictionResult summarizes compiled modules released from the warm pool.
type EvictionResult struct {
	Requested int      `json:"requested"`
	Evicted   int      `json:"evicted"`
	Skipped   int      `json:"skipped"`
	Errors    []string `json:"errors,omitempty"`
}

type compiledEntry struct {
	module   wazero.CompiledModule
	name     string
	lastUsed time.Time
}

// Engine owns the shared Wazero runtime, WASI imports, compilation cache, and
// in-memory compiled module map. Invocations still get isolated module
// instances; only compiled code and host runtime state are shared.
type Engine struct {
	cache wazero.CompilationCache
	rt    wazero.Runtime

	mu       sync.RWMutex
	compiled map[string]*compiledEntry
	closed   bool
	proto    *protoStore
	pools    *instancePoolStore

	scaleToZeroAfter time.Duration
	hostCallTimeout  time.Duration
	reaperStop       chan struct{}
	reaperDone       chan struct{}

	compileRequests  atomic.Uint64
	compileHits      atomic.Uint64
	invocations      atomic.Uint64
	evictions        atomic.Uint64
	hostCalls        atomic.Uint64
	hostCallFailures atomic.Uint64
}

// NewEngine creates a long-lived Wasm runtime process.
func NewEngine(ctx context.Context, cfg EngineConfig) (*Engine, error) {
	cache, err := wazero.NewCompilationCacheWithDir(cfg.CacheDir)
	if err != nil {
		return nil, fmt.Errorf("open compilation cache: %w", err)
	}

	runtimeConfig := wazero.NewRuntimeConfigCompiler().
		WithCompilationCache(cache).
		WithCloseOnContextDone(true)
	rt := wazero.NewRuntimeWithConfig(ctx, runtimeConfig)
	if _, err := wasi_snapshot_preview1.Instantiate(ctx, rt); err != nil {
		_ = rt.Close(ctx)
		_ = cache.Close(ctx)
		return nil, fmt.Errorf("instantiate WASI host module: %w", err)
	}

	engine := &Engine{
		cache:            cache,
		rt:               rt,
		compiled:         make(map[string]*compiledEntry),
		proto:            newProtoStore(),
		pools:            newInstancePoolStore(),
		scaleToZeroAfter: cfg.ScaleToZeroAfter,
		hostCallTimeout:  cfg.HostCallTimeout,
		reaperStop:       make(chan struct{}),
		reaperDone:       make(chan struct{}),
	}
	if engine.hostCallTimeout <= 0 {
		engine.hostCallTimeout = 5 * time.Second
	}
	if err := engine.instantiateHostABI(ctx); err != nil {
		_ = rt.Close(ctx)
		_ = cache.Close(ctx)
		return nil, err
	}
	if cfg.ScaleToZeroAfter > 0 {
		go engine.reapIdleModules(ctx, cfg.ScaleToZeroAfter)
	} else {
		close(engine.reaperDone)
	}
	return engine, nil
}

// Close releases compiled modules and runtime resources.
func (e *Engine) Close(ctx context.Context) error {
	e.mu.Lock()
	if e.closed {
		e.mu.Unlock()
		return nil
	}
	e.closed = true
	e.mu.Unlock()

	close(e.reaperStop)
	<-e.reaperDone

	e.pools.close(ctx)
	if err := e.rt.Close(ctx); err != nil {
		_ = e.cache.Close(ctx)
		return err
	}
	return e.cache.Close(ctx)
}

// Stats returns a snapshot of engine counters.
func (e *Engine) Stats() EngineStats {
	e.mu.RLock()
	compiled := uint64(len(e.compiled))
	e.mu.RUnlock()
	poolStats := e.pools.stats()
	protoStats := e.proto.stats(poolStats)

	stats := EngineStats{
		CompiledModules:  compiled,
		CompileRequests:  e.compileRequests.Load(),
		CompileHits:      e.compileHits.Load(),
		Invocations:      e.invocations.Load(),
		Evictions:        e.evictions.Load(),
		HostCalls:        e.hostCalls.Load(),
		HostCallFailures: e.hostCallFailures.Load(),
		ProtoFaaslets:    protoStats.Templates,
		InstancePools:    protoStats.InstancePools,
		WarmInstances:    protoStats.WarmInstances,
	}
	if e.scaleToZeroAfter > 0 {
		stats.ScaleToZeroAfterMS = float64(e.scaleToZeroAfter.Microseconds()) / 1000.0
	}
	return stats
}

// Preload compiles deployed functions before the first request reaches them.
func (e *Engine) Preload(ctx context.Context, functions []state.Function) PreloadResult {
	result := PreloadResult{Requested: len(functions)}
	for _, fn := range functions {
		compiled, err := e.Compile(ctx, fn)
		if err != nil {
			result.Failed = append(result.Failed, PreloadError{Name: fn.Name, Err: err.Error()})
			continue
		}
		if isHandlerABI(compiled) {
			poolSize, err := e.pools.ensure(ctx, e.rt, compiled, fn, 1)
			if err != nil {
				result.Failed = append(result.Failed, PreloadError{Name: fn.Name, Err: err.Error()})
				continue
			}
			e.proto.recordCompiled(fn, abiHandler, poolSize)
		}
		result.Compiled++
	}
	return result
}

// ProtoFaaslets returns the current compiled-template and instance-pool view.
func (e *Engine) ProtoFaaslets() []ProtoFaaslet {
	return e.proto.snapshot()
}

// Compile validates and caches a deployed function's Wasm module.
func (e *Engine) Compile(ctx context.Context, fn state.Function) (wazero.CompiledModule, error) {
	key := fn.WasmPath
	if key == "" {
		return nil, fmt.Errorf("function %q has no wasm path", fn.Name)
	}

	e.compileRequests.Add(1)
	e.mu.RLock()
	if e.closed {
		e.mu.RUnlock()
		return nil, fmt.Errorf("runtime engine is closed")
	}
	entry := e.compiled[key]
	e.mu.RUnlock()
	if entry != nil {
		e.compileHits.Add(1)
		e.touch(key)
		e.proto.touch(key, e.pools.size(key))
		return entry.module, nil
	}

	e.mu.Lock()
	defer e.mu.Unlock()
	if e.closed {
		return nil, fmt.Errorf("runtime engine is closed")
	}
	if entry = e.compiled[key]; entry != nil {
		e.compileHits.Add(1)
		entry.lastUsed = time.Now()
		e.proto.touch(key, e.pools.size(key))
		return entry.module, nil
	}

	wasmBytes, err := os.ReadFile(key)
	if err != nil {
		return nil, fmt.Errorf("read wasm module: %w", err)
	}
	compiled, err := e.rt.CompileModule(ctx, wasmBytes)
	if err != nil {
		return nil, fmt.Errorf("compile wasm module: %w", err)
	}
	e.compiled[key] = &compiledEntry{module: compiled, name: fn.Name, lastUsed: time.Now()}
	e.proto.recordCompiled(fn, detectABI(compiled), e.pools.size(fn.WasmPath))
	return compiled, nil
}

// EvictFunction releases one compiled function from the in-process warm pool.
// The file-backed compilation cache remains, so a later call can rehydrate
// without parsing the original source from scratch.
func (e *Engine) EvictFunction(ctx context.Context, fn state.Function) EvictionResult {
	result := EvictionResult{Requested: 1}
	if fn.WasmPath == "" {
		result.Skipped = 1
		result.Errors = append(result.Errors, fmt.Sprintf("function %q has no wasm path", fn.Name))
		return result
	}

	e.mu.Lock()
	entry := e.compiled[fn.WasmPath]
	if entry == nil {
		e.mu.Unlock()
		result.Skipped = 1
		return result
	}
	delete(e.compiled, fn.WasmPath)
	e.mu.Unlock()

	e.pools.remove(ctx, fn.WasmPath)
	e.proto.remove(fn.WasmPath)
	if err := entry.module.Close(ctx); err != nil {
		result.Errors = append(result.Errors, err.Error())
	}
	result.Evicted = 1
	e.evictions.Add(1)
	return result
}

// EvictIdle releases compiled modules that have not been touched recently.
func (e *Engine) EvictIdle(ctx context.Context, idleFor time.Duration) EvictionResult {
	result := EvictionResult{}
	if idleFor <= 0 {
		return result
	}

	cutoff := time.Now().Add(-idleFor)
	var evict []*compiledEntry
	var evictKeys []string
	e.mu.Lock()
	for key, entry := range e.compiled {
		result.Requested++
		if entry.lastUsed.After(cutoff) {
			result.Skipped++
			continue
		}
		delete(e.compiled, key)
		evict = append(evict, entry)
		evictKeys = append(evictKeys, key)
	}
	e.mu.Unlock()

	for i, entry := range evict {
		e.pools.remove(ctx, evictKeys[i])
		e.proto.remove(evictKeys[i])
		if err := entry.module.Close(ctx); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", entry.name, err))
		}
		result.Evicted++
		e.evictions.Add(1)
	}
	return result
}

// ValidateModule compiles a Wasm module once to catch invalid binaries during deploy.
func ValidateModule(ctx context.Context, wasmPath, cacheDir string) error {
	engine, err := NewEngine(ctx, EngineConfig{CacheDir: cacheDir})
	if err != nil {
		return err
	}
	defer engine.Close(ctx)

	_, err = engine.Compile(ctx, state.Function{Name: "deploy-validation", WasmPath: wasmPath})
	return nil
}

// Invoke runs a WASI command-style module and captures stdout/stderr.
func Invoke(ctx context.Context, inv Invocation) (Result, error) {
	engine, err := NewEngine(ctx, EngineConfig{CacheDir: inv.CacheDir})
	if err != nil {
		return Result{}, err
	}
	defer engine.Close(ctx)

	return engine.Invoke(ctx, inv)
}

// Invoke runs a WASI command-style module through this long-lived runtime.
func (e *Engine) Invoke(ctx context.Context, inv Invocation) (Result, error) {
	if inv.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, inv.Timeout)
		defer cancel()
	}

	compiled, err := e.Compile(ctx, inv.Function)
	if err != nil {
		return Result{}, err
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	args := append([]string{inv.Function.Name}, inv.Args...)
	moduleConfig := wazero.NewModuleConfig().
		WithName("").
		WithArgs(args...).
		WithStdin(bytes.NewReader(inv.Stdin)).
		WithStdout(&stdout).
		WithStderr(&stderr)

	start := time.Now()
	module, err := e.rt.InstantiateModule(ctx, compiled, moduleConfig)
	if module != nil {
		defer module.Close(ctx)
	}
	result := Result{
		Stdout:  stdout.String(),
		Stderr:  stderr.String(),
		Latency: time.Since(start),
	}
	e.invocations.Add(1)
	e.touch(inv.Function.WasmPath)
	e.proto.touch(inv.Function.WasmPath, e.pools.size(inv.Function.WasmPath))

	if err == nil {
		return result, nil
	}

	var exitErr *sys.ExitError
	if errors.As(err, &exitErr) {
		result.ExitCode = exitErr.ExitCode()
		return result, nil
	}

	return result, fmt.Errorf("invoke %q: %w", inv.Function.Name, err)
}

func (e *Engine) instantiateHostABI(ctx context.Context) error {
	_, err := e.rt.NewHostModuleBuilder("wasmdee").
		NewFunctionBuilder().
		WithFunc(e.hostInvoke).
		Export("invoke").
		Instantiate(ctx)
	if err != nil {
		return fmt.Errorf("instantiate wasmdee host ABI: %w", err)
	}
	return nil
}

// hostInvoke lets a Wasm function call another deployed function in-process.
//
// ABI:
//
//	import "wasmdee" "invoke"
//	func invoke(name_ptr, name_len, payload_ptr, payload_len, out_ptr, out_cap u32) u64
//
// The upper 32 bits are a status code. The lower 32 bits are bytes written, or
// the required output size when the output buffer is too small.
func (e *Engine) hostInvoke(ctx context.Context, module api.Module, namePtr, nameLen, payloadPtr, payloadLen, outPtr, outCap uint32) uint64 {
	e.hostCalls.Add(1)
	mem := module.Memory()
	if mem == nil {
		e.hostCallFailures.Add(1)
		return packHostInvokeResult(hostInvokeInvalidMemory, 0)
	}

	nameBytes, ok := mem.Read(namePtr, nameLen)
	if !ok {
		e.hostCallFailures.Add(1)
		return packHostInvokeResult(hostInvokeInvalidMemory, 0)
	}
	payload, ok := mem.Read(payloadPtr, payloadLen)
	if !ok {
		e.hostCallFailures.Add(1)
		return packHostInvokeResult(hostInvokeInvalidMemory, 0)
	}

	target, err := state.GetFunction(string(nameBytes))
	if err != nil {
		e.hostCallFailures.Add(1)
		return packHostInvokeResult(hostInvokeTargetError, 0)
	}

	callCtx, cancel := context.WithTimeout(ctx, e.hostCallTimeout)
	defer cancel()
	result, err := e.Invoke(callCtx, Invocation{
		Function: target,
		Stdin:    append([]byte(nil), payload...),
		Timeout:  e.hostCallTimeout,
	})
	if err != nil {
		e.hostCallFailures.Add(1)
		return packHostInvokeResult(hostInvokeTargetError, 0)
	}

	output := []byte(result.Stdout)
	if uint32(len(output)) > outCap {
		if outCap > 0 && !mem.Write(outPtr, output[:outCap]) {
			e.hostCallFailures.Add(1)
			return packHostInvokeResult(hostInvokeInvalidMemory, 0)
		}
		e.hostCallFailures.Add(1)
		return packHostInvokeResult(hostInvokeOutputTooLarge, uint32(len(output)))
	}
	if len(output) > 0 && !mem.Write(outPtr, output) {
		e.hostCallFailures.Add(1)
		return packHostInvokeResult(hostInvokeInvalidMemory, 0)
	}
	if result.ExitCode != 0 {
		e.hostCallFailures.Add(1)
		return packHostInvokeResult(hostInvokeNonZeroExit, uint32(len(output)))
	}
	return packHostInvokeResult(hostInvokeOK, uint32(len(output)))
}

func packHostInvokeResult(status uint64, size uint32) uint64 {
	return status<<32 | uint64(size)
}

func (e *Engine) touch(key string) {
	if key == "" {
		return
	}
	e.mu.Lock()
	if entry := e.compiled[key]; entry != nil {
		entry.lastUsed = time.Now()
	}
	e.mu.Unlock()
}

func (e *Engine) reapIdleModules(ctx context.Context, idleFor time.Duration) {
	defer close(e.reaperDone)
	interval := idleFor / 2
	if interval < time.Second {
		interval = time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			_ = e.EvictIdle(ctx, idleFor)
		case <-e.reaperStop:
			return
		case <-ctx.Done():
			return
		}
	}
}
