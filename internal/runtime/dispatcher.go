package runtime

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

var (
	// ErrQueueFull means the runtime is saturated and the caller should retry.
	ErrQueueFull = errors.New("runtime dispatcher queue is full")

	// ErrDispatcherClosed means the dispatcher is no longer accepting work.
	ErrDispatcherClosed = errors.New("runtime dispatcher is closed")
)

// DispatcherConfig controls admission and worker sizing.
type DispatcherConfig struct {
	Workers        int
	MinWorkers     int
	MaxWorkers     int
	QueueSize      int
	DefaultTimeout time.Duration
	ScaleDownAfter time.Duration
}

// DispatcherStats exposes queue and worker counters for health endpoints.
type DispatcherStats struct {
	Workers        int     `json:"workers"`
	MinWorkers     int     `json:"min_workers"`
	MaxWorkers     int     `json:"max_workers"`
	QueueSize      int     `json:"queue_size"`
	Queued         int     `json:"queued"`
	Utilization    float64 `json:"utilization"`
	Accepted       uint64  `json:"accepted"`
	Rejected       uint64  `json:"rejected"`
	Completed      uint64  `json:"completed"`
	ScaleUps       uint64  `json:"scale_ups"`
	ScaleDowns     uint64  `json:"scale_downs"`
	ScaleDownAfter float64 `json:"scale_down_after_ms,omitempty"`
}

// Dispatcher is a bounded invocation scheduler over a shared Engine.
type Dispatcher struct {
	engine *Engine
	cfg    DispatcherConfig
	tel    *telemetry

	jobs   chan dispatchJob
	done   chan struct{}
	mu     sync.RWMutex
	wg     sync.WaitGroup
	closed atomic.Bool

	accepted  atomic.Uint64
	rejected  atomic.Uint64
	completed atomic.Uint64
	active    atomic.Int64
	scaleUps  atomic.Uint64
	scaleDown atomic.Uint64
}

type dispatchJob struct {
	ctx context.Context
	inv Invocation
	res chan dispatchResult
}

type dispatchResult struct {
	result Result
	err    error
}

// NewDispatcher starts a fixed-size worker pool.
func NewDispatcher(engine *Engine, cfg DispatcherConfig) (*Dispatcher, error) {
	if engine == nil {
		return nil, fmt.Errorf("engine is required")
	}
	cfg = normalizeDispatcherConfig(cfg)
	if cfg.MinWorkers <= 0 {
		return nil, fmt.Errorf("min workers must be greater than zero")
	}
	if cfg.MaxWorkers < cfg.MinWorkers {
		return nil, fmt.Errorf("max workers must be greater than or equal to min workers")
	}
	if cfg.QueueSize <= 0 {
		return nil, fmt.Errorf("queue size must be greater than zero")
	}
	if cfg.DefaultTimeout <= 0 {
		cfg.DefaultTimeout = 10 * time.Second
	}

	d := &Dispatcher{
		engine: engine,
		cfg:    cfg,
		tel:    newTelemetry(),
		jobs:   make(chan dispatchJob, cfg.QueueSize),
		done:   make(chan struct{}),
	}
	for i := 0; i < cfg.MinWorkers; i++ {
		d.spawnWorkerLocked()
	}
	return d, nil
}

// Submit enqueues one invocation or returns ErrQueueFull immediately.
func (d *Dispatcher) Submit(ctx context.Context, inv Invocation) (Result, error) {
	d.mu.RLock()
	if d.closed.Load() {
		d.mu.RUnlock()
		return Result{}, ErrDispatcherClosed
	}
	if inv.Timeout <= 0 {
		inv.Timeout = d.cfg.DefaultTimeout
	}

	res := make(chan dispatchResult, 1)
	job := dispatchJob{ctx: ctx, inv: inv, res: res}
	select {
	case d.jobs <- job:
		d.accepted.Add(1)
		d.tel.RecordAccepted(inv.Function.Name, time.Now())
		d.mu.RUnlock()
		d.maybeScaleUp()
	case <-ctx.Done():
		d.mu.RUnlock()
		return Result{}, ctx.Err()
	default:
		d.rejected.Add(1)
		d.tel.RecordRejected(inv.Function.Name)
		d.mu.RUnlock()
		return Result{}, ErrQueueFull
	}

	select {
	case out := <-res:
		return out.result, out.err
	case <-ctx.Done():
		return Result{}, ctx.Err()
	case <-d.done:
		return Result{}, ErrDispatcherClosed
	}
}

// Stats returns a snapshot of dispatcher counters.
func (d *Dispatcher) Stats() DispatcherStats {
	workers := int(d.active.Load())
	queued := len(d.jobs)
	utilization := 0.0
	if workers > 0 {
		utilization = float64(queued) / float64(workers)
	}
	stats := DispatcherStats{
		Workers:     workers,
		MinWorkers:  d.cfg.MinWorkers,
		MaxWorkers:  d.cfg.MaxWorkers,
		QueueSize:   d.cfg.QueueSize,
		Queued:      queued,
		Utilization: utilization,
		Accepted:    d.accepted.Load(),
		Rejected:    d.rejected.Load(),
		Completed:   d.completed.Load(),
		ScaleUps:    d.scaleUps.Load(),
		ScaleDowns:  d.scaleDown.Load(),
	}
	if d.cfg.ScaleDownAfter > 0 && d.cfg.MaxWorkers > d.cfg.MinWorkers {
		stats.ScaleDownAfter = float64(d.cfg.ScaleDownAfter.Microseconds()) / 1000.0
	}
	return stats
}

// FunctionStats returns per-function telemetry gathered by this dispatcher.
func (d *Dispatcher) FunctionStats() []FunctionStats {
	return d.tel.Snapshot()
}

// Close stops workers after draining accepted jobs.
func (d *Dispatcher) Close() {
	d.mu.Lock()
	defer d.mu.Unlock()
	if !d.closed.CompareAndSwap(false, true) {
		return
	}
	close(d.jobs)
	d.wg.Wait()
	close(d.done)
}

func (d *Dispatcher) worker() {
	retired := false
	defer func() {
		if !retired {
			d.active.Add(-1)
		}
		d.wg.Done()
	}()

	idle := time.NewTimer(d.cfg.ScaleDownAfter)
	defer idle.Stop()

	for {
		select {
		case job, ok := <-d.jobs:
			if !ok {
				return
			}
			if !idle.Stop() {
				select {
				case <-idle.C:
				default:
				}
			}
			d.handle(job)
			idle.Reset(d.cfg.ScaleDownAfter)
		case <-idle.C:
			if d.tryRetireWorker() {
				retired = true
				return
			}
			idle.Reset(d.cfg.ScaleDownAfter)
		}
	}
}

func (d *Dispatcher) handle(job dispatchJob) {
	d.tel.RecordStarted(job.inv.Function.Name)
	result, err := d.engine.Invoke(job.ctx, job.inv)
	d.tel.RecordCompleted(job.inv.Function.Name, result, err)
	d.completed.Add(1)
	job.res <- dispatchResult{result: result, err: err}
}

func (d *Dispatcher) maybeScaleUp() {
	if d.cfg.MaxWorkers <= d.cfg.MinWorkers {
		return
	}
	if len(d.jobs) < int(d.active.Load()) {
		return
	}

	d.mu.Lock()
	defer d.mu.Unlock()
	if d.closed.Load() || int(d.active.Load()) >= d.cfg.MaxWorkers {
		return
	}
	d.spawnWorkerLocked()
	d.scaleUps.Add(1)
}

func (d *Dispatcher) spawnWorkerLocked() {
	d.active.Add(1)
	d.wg.Add(1)
	go d.worker()
}

func (d *Dispatcher) tryRetireWorker() bool {
	if d.cfg.MaxWorkers <= d.cfg.MinWorkers {
		return false
	}
	for {
		current := d.active.Load()
		if int(current) <= d.cfg.MinWorkers {
			return false
		}
		if d.active.CompareAndSwap(current, current-1) {
			d.scaleDown.Add(1)
			return true
		}
	}
}

func normalizeDispatcherConfig(cfg DispatcherConfig) DispatcherConfig {
	if cfg.MinWorkers <= 0 {
		cfg.MinWorkers = cfg.Workers
	}
	if cfg.MaxWorkers <= 0 {
		cfg.MaxWorkers = cfg.MinWorkers
	}
	if cfg.ScaleDownAfter <= 0 {
		cfg.ScaleDownAfter = 30 * time.Second
	}
	return cfg
}
