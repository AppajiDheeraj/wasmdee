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

	abiWASICommand = "wasi-command"
	abiHandler     = "wasmdee-handler"
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
	if abi != abiHandler {
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
}

type pooledInstance struct {
	module api.Module
}

type instancePool struct {
	functionName string
	wasmPath     string
	instances    []pooledInstance
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
	if !isHandlerABI(compiled) {
		return 0, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	pool := s.pools[fn.WasmPath]
	if pool == nil {
		pool = &instancePool{functionName: fn.Name, wasmPath: fn.WasmPath}
		s.pools[fn.WasmPath] = pool
	}
	for len(pool.instances) < size {
		name := fmt.Sprintf("%s.proto.%d", fn.Name, len(pool.instances)+1)
		module, err := rt.InstantiateModule(ctx, compiled, wazero.NewModuleConfig().WithName(name))
		if err != nil {
			return len(pool.instances), fmt.Errorf("instantiate proto-faaslet %q: %w", fn.Name, err)
		}
		pool.instances = append(pool.instances, pooledInstance{module: module})
	}
	return len(pool.instances), nil
}

func (s *instancePoolStore) size(wasmPath string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if pool := s.pools[wasmPath]; pool != nil {
		return len(pool.instances)
	}
	return 0
}

func (s *instancePoolStore) remove(ctx context.Context, wasmPath string) {
	s.mu.Lock()
	pool := s.pools[wasmPath]
	delete(s.pools, wasmPath)
	s.mu.Unlock()
	if pool == nil {
		return
	}
	for _, instance := range pool.instances {
		_ = instance.module.Close(ctx)
	}
}

func (s *instancePoolStore) close(ctx context.Context) {
	s.mu.Lock()
	pools := s.pools
	s.pools = make(map[string]*instancePool)
	s.mu.Unlock()
	for _, pool := range pools {
		for _, instance := range pool.instances {
			_ = instance.module.Close(ctx)
		}
	}
}

func (s *instancePoolStore) stats() InstancePoolStats {
	s.mu.Lock()
	defer s.mu.Unlock()
	stats := InstancePoolStats{Pools: len(s.pools)}
	for _, pool := range s.pools {
		stats.WarmInstances += len(pool.instances)
	}
	return stats
}

func detectABI(compiled wazero.CompiledModule) string {
	if isHandlerABI(compiled) {
		return abiHandler
	}
	return abiWASICommand
}

func isHandlerABI(compiled wazero.CompiledModule) bool {
	if compiled == nil {
		return false
	}
	_, ok := compiled.ExportedFunctions()[handlerExportName]
	return ok
}
