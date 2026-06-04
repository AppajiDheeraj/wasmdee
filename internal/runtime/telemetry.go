package runtime

import (
	"sort"
	"sync"
	"time"
)

const ewmaAlpha = 0.2

// FunctionStats is a public snapshot of one function's local runtime behavior.
type FunctionStats struct {
	Name              string  `json:"name"`
	Accepted          uint64  `json:"accepted"`
	Rejected          uint64  `json:"rejected"`
	Started           uint64  `json:"started"`
	Completed         uint64  `json:"completed"`
	Failed            uint64  `json:"failed"`
	InFlight          int64   `json:"in_flight"`
	AvgLatencyMS      float64 `json:"avg_latency_ms"`
	LastLatencyMS     float64 `json:"last_latency_ms"`
	ArrivalRatePerSec float64 `json:"arrival_rate_per_sec"`
	LastInvokedAt     string  `json:"last_invoked_at,omitempty"`
	LastError         string  `json:"last_error,omitempty"`
}

type telemetry struct {
	mu        sync.Mutex
	functions map[string]*functionTelemetry
}

type functionTelemetry struct {
	stats           FunctionStats
	lastArrivalTime time.Time
	arrivalRate     float64
	avgLatencyMS    float64
}

func newTelemetry() *telemetry {
	return &telemetry{functions: make(map[string]*functionTelemetry)}
}

func (t *telemetry) RecordAccepted(name string, at time.Time) {
	t.mu.Lock()
	defer t.mu.Unlock()

	fn := t.getLocked(name)
	fn.stats.Accepted++
	if !fn.lastArrivalTime.IsZero() {
		intervalSeconds := at.Sub(fn.lastArrivalTime).Seconds()
		if intervalSeconds > 0 {
			rate := 1 / intervalSeconds
			if fn.arrivalRate == 0 {
				fn.arrivalRate = rate
			} else {
				fn.arrivalRate = ewmaAlpha*rate + (1-ewmaAlpha)*fn.arrivalRate
			}
		}
	}
	fn.lastArrivalTime = at
}

func (t *telemetry) RecordRejected(name string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	fn := t.getLocked(name)
	fn.stats.Rejected++
}

func (t *telemetry) RecordStarted(name string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	fn := t.getLocked(name)
	fn.stats.Started++
	fn.stats.InFlight++
}

func (t *telemetry) RecordCompleted(name string, result Result, err error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	fn := t.getLocked(name)
	fn.stats.Completed++
	fn.stats.InFlight--
	latencyMS := float64(result.Latency.Microseconds()) / 1000.0
	fn.stats.LastLatencyMS = latencyMS
	if fn.avgLatencyMS == 0 {
		fn.avgLatencyMS = latencyMS
	} else {
		fn.avgLatencyMS = ewmaAlpha*latencyMS + (1-ewmaAlpha)*fn.avgLatencyMS
	}
	fn.stats.AvgLatencyMS = fn.avgLatencyMS
	fn.stats.ArrivalRatePerSec = fn.arrivalRate
	fn.stats.LastInvokedAt = time.Now().UTC().Format(time.RFC3339Nano)

	if err != nil || result.ExitCode != 0 {
		fn.stats.Failed++
		if err != nil {
			fn.stats.LastError = err.Error()
		}
	}
}

func (t *telemetry) Snapshot() []FunctionStats {
	t.mu.Lock()
	defer t.mu.Unlock()

	stats := make([]FunctionStats, 0, len(t.functions))
	for _, fn := range t.functions {
		snapshot := fn.stats
		snapshot.ArrivalRatePerSec = fn.arrivalRate
		snapshot.AvgLatencyMS = fn.avgLatencyMS
		stats = append(stats, snapshot)
	}
	sort.Slice(stats, func(i, j int) bool {
		return stats[i].Name < stats[j].Name
	})
	return stats
}

func (t *telemetry) getLocked(name string) *functionTelemetry {
	if name == "" {
		name = "unknown"
	}
	fn := t.functions[name]
	if fn == nil {
		fn = &functionTelemetry{stats: FunctionStats{Name: name}}
		t.functions[name] = fn
	}
	return fn
}
