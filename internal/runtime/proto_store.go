package runtime

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/dheeraj/wasmdee/internal/state"
	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
)

const (
	handlerExportName = "wasmdee_handle"
	handlerAllocName  = "wasmdee_alloc"
	handlerResetName  = "wasmdee_reset"

	abiWASICommand    = "wasi-command"
	abiHandler        = "wasmdee-handler"
	abiInvalidHandler = "invalid-handler"
)

// ProtoFaaslet describes the reusable template state wasmdee can prove today.
// It is intentionally not a memory snapshot: for WASI command modules, the
// current template is the compiled module plus metadata needed to decide if a
// future handler ABI can be pooled.
type ProtoFaaslet struct {
	FunctionName      string `json:"function_name"`
	WasmPath          string `json:"wasm_path"`
	ABI               string `json:"abi"`
	State             string `json:"state"`
	PoolEligible      bool   `json:"pool_eligible"`
	PoolSize          int    `json:"pool_size"`
	UnsupportedReason string `json:"unsupported_reason,omitempty"`
	CreatedAtUnix     int64  `json:"created_at"`
	LastUsedUnix      int64  `json:"last_used_at"`
}

// ProtoStoreStats summarizes template and instance-pool state.
type ProtoStoreStats struct {
	Templates     int `json:"templates"`
	PoolEligible  int `json:"pool_eligible"`
	InstancePools int `json:"instance_pools"`
	WarmInstances int `json:"warm_instances"`
}

type protoStore struct {
	mu      sync.RWMutex
	entries map[string]ProtoFaaslet
}

func newProtoStore() *protoStore {
	return &protoStore{entries: make(map[string]ProtoFaaslet)}
}

func (s *protoStore) recordCompiled(fn state.Function, abi string, poolSize int) {
	now := time.Now().Unix()
	entry := ProtoFaaslet{
		FunctionName:  fn.Name,
		WasmPath:      fn.WasmPath,
		ABI:           abi,
		State:         "compiled-template",
		PoolEligible:  abi == abiHandler,
		PoolSize:      poolSize,
		CreatedAtUnix: now,
		LastUsedUnix:  now,
	}
	switch abi {
	case abiHandler:
	case abiInvalidHandler:
		entry.UnsupportedReason = "module exports wasmdee_handle but does not satisfy the complete handler ABI"
	default:
		entry.UnsupportedReason = "WASI command modules run _start once and are not safe to reuse as live instances"
	}

	s.mu.Lock()
	if existing, ok := s.entries[fn.WasmPath]; ok {
		entry.CreatedAtUnix = existing.CreatedAtUnix
	}
	s.entries[fn.WasmPath] = entry
	s.mu.Unlock()
}

func (s *protoStore) touch(wasmPath string, poolSize int) {
	if wasmPath == "" {
		return
	}
	s.mu.Lock()
	entry, ok := s.entries[wasmPath]
	if ok {
		entry.LastUsedUnix = time.Now().Unix()
		entry.PoolSize = poolSize
		s.entries[wasmPath] = entry
	}
	s.mu.Unlock()
}

func (s *protoStore) remove(wasmPath string) {
	s.mu.Lock()
	delete(s.entries, wasmPath)
	s.mu.Unlock()
}

func (s *protoStore) snapshot() []ProtoFaaslet {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]ProtoFaaslet, 0, len(s.entries))
	for _, entry := range s.entries {
		out = append(out, entry)
	}
	return out
}

func (s *protoStore) stats(poolStats InstancePoolStats) ProtoStoreStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	stats := ProtoStoreStats{
		Templates:     len(s.entries),
		InstancePools: poolStats.Pools,
		WarmInstances: poolStats.WarmInstances,
	}
	for _, entry := range s.entries {
		if entry.PoolEligible {
			stats.PoolEligible++
		}
	}
	return stats
}

// InstancePoolStats summarizes live handler-ABI module pools.
type InstancePoolStats struct {
	Pools         int `json:"pools"`
	WarmInstances int `json:"warm_instances"`
	Available     int `json:"available"`
	InUse         int `json:"in_use"`
}

type pooledInstance struct {
	module api.Module
}

type instancePool struct {
	functionName string
	wasmPath     string
	capacity     int
	total        int
	nextID       int
	available    chan pooledInstance
	closed       bool
	createMu     sync.Mutex
}

type instancePoolStore struct {
	mu    sync.Mutex
	pools map[string]*instancePool
}

func newInstancePoolStore() *instancePoolStore {
	return &instancePoolStore{pools: make(map[string]*instancePool)}
}

func (s *instancePoolStore) ensure(ctx context.Context, rt wazero.Runtime, compiled wazero.CompiledModule, fn state.Function, size int) (int, error) {
	if size <= 0 {
		return 0, nil
	}
	if err := validateHandlerABI(compiled); err != nil {
		return 0, nil
	}

	s.mu.Lock()
	pool := s.pools[fn.WasmPath]
	if pool == nil {
		pool = &instancePool{
			functionName: fn.Name,
			wasmPath:     fn.WasmPath,
			capacity:     size,
			available:    make(chan pooledInstance, size),
		}
		s.pools[fn.WasmPath] = pool
	}
	if pool.closed {
		s.mu.Unlock()
		return 0, fmt.Errorf("instance pool for %q is closed", fn.Name)
	}
	if size != pool.capacity {
		total := pool.total
		s.mu.Unlock()
		return total, fmt.Errorf("instance pool for %q already has capacity %d", fn.Name, pool.capacity)
	}
	s.mu.Unlock()

	pool.createMu.Lock()
	defer pool.createMu.Unlock()
	for {
		s.mu.Lock()
		if s.pools[fn.WasmPath] != pool || pool.closed {
			s.mu.Unlock()
			return 0, fmt.Errorf("instance pool for %q is closed", fn.Name)
		}
		if pool.total >= size {
			total := pool.total
			s.mu.Unlock()
			return total, nil
		}
		pool.total++
		pool.nextID++
		instanceNumber := pool.nextID
		s.mu.Unlock()

		name := fmt.Sprintf("%s.pool.%d", fn.Name, instanceNumber)
		module, err := rt.InstantiateModule(ctx, compiled, wazero.NewModuleConfig().WithName(name))
		if err != nil {
			s.mu.Lock()
			pool.total--
			total := pool.total
			s.mu.Unlock()
			return total, fmt.Errorf("instantiate handler instance %q: %w", fn.Name, err)
		}

		s.mu.Lock()
		if s.pools[fn.WasmPath] != pool || pool.closed {
			pool.total--
			s.mu.Unlock()
			_ = module.Close(ctx)
			return 0, fmt.Errorf("instance pool for %q closed during creation", fn.Name)
		}
		pool.available <- pooledInstance{module: module}
		s.mu.Unlock()
	}
}

func (s *instancePoolStore) acquire(ctx context.Context, wasmPath string) (pooledInstance, error) {
	s.mu.Lock()
	pool := s.pools[wasmPath]
	s.mu.Unlock()
	if pool == nil {
		return pooledInstance{}, fmt.Errorf("instance pool is not initialized")
	}

	select {
	case instance, ok := <-pool.available:
		if !ok {
			return pooledInstance{}, fmt.Errorf("instance pool is closed")
		}
		return instance, nil
	case <-ctx.Done():
		return pooledInstance{}, ctx.Err()
	}
}

func (s *instancePoolStore) release(ctx context.Context, wasmPath string, instance pooledInstance, reusable bool) {
	s.mu.Lock()
	pool := s.pools[wasmPath]
	if pool == nil || pool.closed || !reusable {
		if pool != nil && pool.total > 0 {
			pool.total--
		}
		s.mu.Unlock()
		_ = instance.module.Close(ctx)
		return
	}

	select {
	case pool.available <- instance:
		s.mu.Unlock()
	default:
		if pool.total > 0 {
			pool.total--
		}
		s.mu.Unlock()
		_ = instance.module.Close(ctx)
	}
}

func (s *instancePoolStore) size(wasmPath string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if pool := s.pools[wasmPath]; pool != nil {
		return pool.total
	}
	return 0
}

func (s *instancePoolStore) available(wasmPath string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if pool := s.pools[wasmPath]; pool != nil {
		return len(pool.available)
	}
	return 0
}

func (s *instancePoolStore) remove(ctx context.Context, wasmPath string) {
	s.mu.Lock()
	pool := s.pools[wasmPath]
	delete(s.pools, wasmPath)
	s.markClosed(pool)
	s.mu.Unlock()
	if pool == nil {
		return
	}
	s.closePool(ctx, pool)
}

func (s *instancePoolStore) markClosed(pool *instancePool) {
	if pool == nil || pool.closed {
		return
	}
	pool.closed = true
	close(pool.available)
}

func (s *instancePoolStore) closePool(ctx context.Context, pool *instancePool) {
	if pool == nil {
		return
	}
	for instance := range pool.available {
		_ = instance.module.Close(ctx)
	}
}

func (s *instancePoolStore) close(ctx context.Context) {
	s.mu.Lock()
	pools := s.pools
	s.pools = make(map[string]*instancePool)
	for _, pool := range pools {
		s.markClosed(pool)
	}
	s.mu.Unlock()
	for _, pool := range pools {
		s.closePool(ctx, pool)
	}
}

func (s *instancePoolStore) stats() InstancePoolStats {
	s.mu.Lock()
	defer s.mu.Unlock()
	stats := InstancePoolStats{Pools: len(s.pools)}
	for _, pool := range s.pools {
		available := len(pool.available)
		stats.WarmInstances += pool.total
		stats.Available += available
		stats.InUse += pool.total - available
	}
	return stats
}

func detectABI(compiled wazero.CompiledModule) string {
	if isHandlerABI(compiled) {
		return abiHandler
	}
	if hasHandlerExport(compiled) {
		return abiInvalidHandler
	}
	return abiWASICommand
}

func isHandlerABI(compiled wazero.CompiledModule) bool {
	return validateHandlerABI(compiled) == nil
}

func hasHandlerExport(compiled wazero.CompiledModule) bool {
	if compiled == nil {
		return false
	}
	_, ok := compiled.ExportedFunctions()[handlerExportName]
	return ok
}

func validateHandlerABI(compiled wazero.CompiledModule) error {
	if compiled == nil {
		return fmt.Errorf("compiled module is required")
	}
	if len(compiled.ExportedMemories()) == 0 {
		return fmt.Errorf("handler ABI requires an exported memory")
	}
	exports := compiled.ExportedFunctions()
	if err := validateFunctionSignature(exports[handlerAllocName], handlerAllocName, []api.ValueType{api.ValueTypeI32}, []api.ValueType{api.ValueTypeI32}); err != nil {
		return err
	}
	if err := validateFunctionSignature(exports[handlerExportName], handlerExportName, []api.ValueType{api.ValueTypeI32, api.ValueTypeI32}, []api.ValueType{api.ValueTypeI64}); err != nil {
		return err
	}
	return validateFunctionSignature(exports[handlerResetName], handlerResetName, nil, []api.ValueType{api.ValueTypeI32})
}

func validateFunctionSignature(def api.FunctionDefinition, name string, params, results []api.ValueType) error {
	if def == nil {
		return fmt.Errorf("handler ABI requires export %q", name)
	}
	if !sameValueTypes(def.ParamTypes(), params) || !sameValueTypes(def.ResultTypes(), results) {
		return fmt.Errorf("handler ABI export %q has an invalid signature", name)
	}
	return nil
}

func sameValueTypes(got, want []api.ValueType) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}
