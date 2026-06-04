package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	goruntime "runtime"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/dheeraj/wasmdee/internal/config"
	wasmrt "github.com/dheeraj/wasmdee/internal/runtime"
	"github.com/dheeraj/wasmdee/internal/state"
	"github.com/spf13/cobra"
)

var (
	benchName        string
	benchLabel       string
	benchData        string
	benchArgs        []string
	benchIterations  int
	benchColdRuns    int
	benchWarmup      int
	benchConcurrency int
	benchTimeout     time.Duration
	benchMinWorkers  int
	benchMaxWorkers  int
	benchScaleDown   time.Duration
	benchScaleToZero time.Duration
	benchJSON        bool
)

var benchCmd = &cobra.Command{
	Use:   "bench <wasm-path-or-http-url>",
	Short: "Benchmark wasmdee or a comparable HTTP function endpoint",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		target := args[0]
		if strings.HasPrefix(target, "http://") || strings.HasPrefix(target, "https://") {
			report, err := benchmarkHTTP(cmd.Context(), target)
			if err != nil {
				return err
			}
			return writeBenchReport(cmd, report)
		}

		report, err := benchmarkWasm(cmd.Context(), target)
		if err != nil {
			return err
		}
		return writeBenchReport(cmd, report)
	},
}

type benchReport struct {
	Label       string                  `json:"label,omitempty"`
	Target      string                  `json:"target"`
	Mode        string                  `json:"mode"`
	Iterations  int                     `json:"iterations"`
	Warmup      int                     `json:"warmup"`
	Concurrency int                     `json:"concurrency"`
	Cold        *benchSeries            `json:"cold,omitempty"`
	Rehydrate   *benchSeries            `json:"rehydrate,omitempty"`
	Warm        benchSeries             `json:"warm"`
	Engine      *wasmrt.EngineStats     `json:"engine,omitempty"`
	Dispatcher  *wasmrt.DispatcherStats `json:"dispatcher,omitempty"`
	Notes       []string                `json:"notes,omitempty"`
}

type benchSeries struct {
	Count        int     `json:"count"`
	Errors       int     `json:"errors"`
	AvgMS        float64 `json:"avg_ms"`
	P50MS        float64 `json:"p50_ms"`
	P95MS        float64 `json:"p95_ms"`
	P99MS        float64 `json:"p99_ms"`
	MinMS        float64 `json:"min_ms"`
	MaxMS        float64 `json:"max_ms"`
	ThroughputPS float64 `json:"throughput_per_sec"`
}

func init() {
	benchCmd.Flags().StringVar(&benchName, "name", "", "function name for local Wasm benchmarks")
	benchCmd.Flags().StringVar(&benchLabel, "label", "", "human label for this benchmark run, e.g. wasmdee, openfaas, docker")
	benchCmd.Flags().StringVarP(&benchData, "data", "d", "", "request body or stdin payload")
	benchCmd.Flags().StringArrayVar(&benchArgs, "arg", nil, "argument passed to local Wasm modules; repeat for multiple args")
	benchCmd.Flags().IntVar(&benchIterations, "iterations", 100, "measured warm invocations")
	benchCmd.Flags().IntVar(&benchColdRuns, "cold-runs", 5, "fresh-engine cold runs for local Wasm modules")
	benchCmd.Flags().IntVar(&benchWarmup, "warmup", 10, "warmup invocations excluded from measured results")
	benchCmd.Flags().IntVar(&benchConcurrency, "concurrency", 1, "parallel measured invocations")
	benchCmd.Flags().DurationVar(&benchTimeout, "timeout", 5*time.Second, "per-invocation timeout")
	benchCmd.Flags().IntVar(&benchMinWorkers, "min-workers", 1, "minimum local benchmark dispatcher workers")
	benchCmd.Flags().IntVar(&benchMaxWorkers, "max-workers", max(1, goruntime.NumCPU()*4), "maximum local benchmark dispatcher workers")
	benchCmd.Flags().DurationVar(&benchScaleDown, "scale-down-after", 5*time.Second, "idle time before benchmark workers retire")
	benchCmd.Flags().DurationVar(&benchScaleToZero, "scale-to-zero-after", 0, "idle time before local compiled modules are evicted; 0 disables background eviction")
	benchCmd.Flags().BoolVar(&benchJSON, "json", false, "print machine-readable JSON")
}

func benchmarkWasm(ctx context.Context, wasmPath string) (benchReport, error) {
	if benchIterations <= 0 {
		return benchReport{}, fmt.Errorf("iterations must be greater than zero")
	}
	if benchConcurrency <= 0 {
		return benchReport{}, fmt.Errorf("concurrency must be greater than zero")
	}
	if _, err := os.Stat(wasmPath); err != nil {
		return benchReport{}, fmt.Errorf("read benchmark module: %w", err)
	}

	name := benchName
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(wasmPath), filepath.Ext(wasmPath))
	}
	fn := state.Function{Name: name, WasmPath: wasmPath}
	report := benchReport{
		Label:       benchLabel,
		Target:      wasmPath,
		Mode:        "wasmdee-local",
		Iterations:  benchIterations,
		Warmup:      benchWarmup,
		Concurrency: benchConcurrency,
		Notes: []string{
			"cold measures a fresh wazero runtime and empty compile cache per run",
			"rehydrate measures reload after evicting the in-process compiled module while retaining the file-backed compilation cache",
			"warm measures the long-lived engine, compiled-module warm pool, bounded dispatcher, and autoscaled workers",
		},
	}

	if benchColdRuns > 0 {
		cold, err := runLocalCold(ctx, fn)
		if err != nil {
			return benchReport{}, err
		}
		report.Cold = &cold
	}

	engine, err := wasmrt.NewEngine(ctx, wasmrt.EngineConfig{
		CacheDir:         config.GetCacheDir(),
		ScaleToZeroAfter: benchScaleToZero,
	})
	if err != nil {
		return benchReport{}, err
	}
	defer engine.Close(ctx)

	preload := engine.Preload(ctx, []state.Function{fn})
	if len(preload.Failed) > 0 {
		return benchReport{}, fmt.Errorf("preload failed: %s", preload.Failed[0].Err)
	}

	dispatcher, err := wasmrt.NewDispatcher(engine, wasmrt.DispatcherConfig{
		MinWorkers:     benchMinWorkers,
		MaxWorkers:     benchMaxWorkers,
		QueueSize:      max(benchConcurrency*2, 64),
		DefaultTimeout: benchTimeout,
		ScaleDownAfter: benchScaleDown,
	})
	if err != nil {
		return benchReport{}, err
	}
	defer dispatcher.Close()

	for i := 0; i < benchWarmup; i++ {
		if _, err := dispatcher.Submit(ctx, benchmarkInvocation(fn)); err != nil {
			return benchReport{}, fmt.Errorf("warmup invoke: %w", err)
		}
	}

	if benchColdRuns > 0 {
		rehydrate, err := runLocalRehydrate(ctx, engine, fn)
		if err != nil {
			return benchReport{}, err
		}
		report.Rehydrate = &rehydrate
	}

	report.Warm = runMeasured(benchIterations, benchConcurrency, func() error {
		_, err := dispatcher.Submit(ctx, benchmarkInvocation(fn))
		return err
	})
	engineStats := engine.Stats()
	dispatcherStats := dispatcher.Stats()
	report.Engine = &engineStats
	report.Dispatcher = &dispatcherStats
	return report, nil
}

func benchmarkHTTP(ctx context.Context, target string) (benchReport, error) {
	if benchIterations <= 0 {
		return benchReport{}, fmt.Errorf("iterations must be greater than zero")
	}
	if benchConcurrency <= 0 {
		return benchReport{}, fmt.Errorf("concurrency must be greater than zero")
	}

	client := &http.Client{Timeout: benchTimeout}
	body := []byte(benchData)
	call := func() error {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, target, bytes.NewReader(body))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/octet-stream")
		res, err := client.Do(req)
		if err != nil {
			return err
		}
		defer res.Body.Close()
		if res.StatusCode >= 500 {
			return fmt.Errorf("HTTP %d", res.StatusCode)
		}
		return nil
	}

	for i := 0; i < benchWarmup; i++ {
		if err := call(); err != nil {
			return benchReport{}, fmt.Errorf("warmup request: %w", err)
		}
	}

	return benchReport{
		Label:       benchLabel,
		Target:      target,
		Mode:        "http",
		Iterations:  benchIterations,
		Warmup:      benchWarmup,
		Concurrency: benchConcurrency,
		Warm:        runMeasured(benchIterations, benchConcurrency, call),
		Notes: []string{
			"HTTP mode is intended for apples-to-apples comparison against wasmdee serve, OpenFaaS, or a Dockerized endpoint",
		},
	}, nil
}

func runLocalCold(ctx context.Context, fn state.Function) (benchSeries, error) {
	var latencies []time.Duration
	errors := 0
	startAll := time.Now()
	for i := 0; i < benchColdRuns; i++ {
		cacheDir, err := os.MkdirTemp(config.GetCacheDir(), "bench-cold-*")
		if err != nil {
			return benchSeries{}, err
		}
		engine, err := wasmrt.NewEngine(ctx, wasmrt.EngineConfig{CacheDir: cacheDir})
		if err != nil {
			return benchSeries{}, err
		}
		start := time.Now()
		_, err = engine.Invoke(ctx, benchmarkInvocation(fn))
		latencies = append(latencies, time.Since(start))
		if err != nil {
			errors++
		}
		_ = engine.Close(ctx)
	}
	return summarize(latencies, errors, time.Since(startAll)), nil
}

func runLocalRehydrate(ctx context.Context, engine *wasmrt.Engine, fn state.Function) (benchSeries, error) {
	var latencies []time.Duration
	errors := 0
	startAll := time.Now()
	for i := 0; i < benchColdRuns; i++ {
		engine.EvictFunction(ctx, fn)
		start := time.Now()
		_, err := engine.Invoke(ctx, benchmarkInvocation(fn))
		latencies = append(latencies, time.Since(start))
		if err != nil {
			errors++
		}
	}
	return summarize(latencies, errors, time.Since(startAll)), nil
}

func runMeasured(iterations, concurrency int, call func() error) benchSeries {
	latencies := make([]time.Duration, iterations)
	var errors atomic.Int64
	var next atomic.Int64
	var wg sync.WaitGroup
	startAll := time.Now()

	for worker := 0; worker < concurrency; worker++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				index := int(next.Add(1)) - 1
				if index >= iterations {
					return
				}
				start := time.Now()
				if err := call(); err != nil {
					errors.Add(1)
				}
				latencies[index] = time.Since(start)
			}
		}()
	}
	wg.Wait()
	return summarize(latencies, int(errors.Load()), time.Since(startAll))
}

func benchmarkInvocation(fn state.Function) wasmrt.Invocation {
	return wasmrt.Invocation{
		Function: fn,
		Stdin:    []byte(benchData),
		Args:     benchArgs,
		Timeout:  benchTimeout,
	}
}

func summarize(latencies []time.Duration, errors int, elapsed time.Duration) benchSeries {
	if len(latencies) == 0 {
		return benchSeries{Errors: errors}
	}
	values := make([]float64, 0, len(latencies))
	total := 0.0
	for _, latency := range latencies {
		ms := float64(latency.Microseconds()) / 1000.0
		values = append(values, ms)
		total += ms
	}
	sort.Float64s(values)
	throughput := 0.0
	if elapsed > 0 {
		throughput = float64(len(values)) / elapsed.Seconds()
	}
	return benchSeries{
		Count:        len(values),
		Errors:       errors,
		AvgMS:        total / float64(len(values)),
		P50MS:        percentile(values, 0.50),
		P95MS:        percentile(values, 0.95),
		P99MS:        percentile(values, 0.99),
		MinMS:        values[0],
		MaxMS:        values[len(values)-1],
		ThroughputPS: throughput,
	}
}

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	index := int(float64(len(sorted)-1) * p)
	if index < 0 {
		index = 0
	}
	if index >= len(sorted) {
		index = len(sorted) - 1
	}
	return sorted[index]
}

func writeBenchReport(cmd *cobra.Command, report benchReport) error {
	if benchJSON {
		encoder := json.NewEncoder(cmd.OutOrStdout())
		encoder.SetIndent("", "  ")
		return encoder.Encode(report)
	}

	label := report.Label
	if label == "" {
		label = report.Mode
	}
	fmt.Fprintf(cmd.OutOrStdout(), "benchmark: %s\n", label)
	fmt.Fprintf(cmd.OutOrStdout(), "target: %s\n", report.Target)
	fmt.Fprintf(cmd.OutOrStdout(), "iterations=%d warmup=%d concurrency=%d\n\n", report.Iterations, report.Warmup, report.Concurrency)
	if report.Cold != nil {
		printBenchSeries(cmd, "cold", *report.Cold)
	}
	if report.Rehydrate != nil {
		printBenchSeries(cmd, "rehydrate", *report.Rehydrate)
	}
	printBenchSeries(cmd, "warm", report.Warm)
	if report.Engine != nil {
		fmt.Fprintf(cmd.OutOrStdout(), "\nengine: compiled=%d compile_requests=%d hits=%d evictions=%d invocations=%d host_calls=%d host_call_failures=%d\n",
			report.Engine.CompiledModules,
			report.Engine.CompileRequests,
			report.Engine.CompileHits,
			report.Engine.Evictions,
			report.Engine.Invocations,
			report.Engine.HostCalls,
			report.Engine.HostCallFailures,
		)
	}
	if report.Dispatcher != nil {
		fmt.Fprintf(cmd.OutOrStdout(), "dispatcher: workers=%d min=%d max=%d accepted=%d rejected=%d scale_ups=%d scale_downs=%d\n",
			report.Dispatcher.Workers,
			report.Dispatcher.MinWorkers,
			report.Dispatcher.MaxWorkers,
			report.Dispatcher.Accepted,
			report.Dispatcher.Rejected,
			report.Dispatcher.ScaleUps,
			report.Dispatcher.ScaleDowns,
		)
	}
	return nil
}

func printBenchSeries(cmd *cobra.Command, name string, series benchSeries) {
	fmt.Fprintf(cmd.OutOrStdout(), "%-9s count=%d errors=%d avg=%.3fms p50=%.3fms p95=%.3fms p99=%.3fms min=%.3fms max=%.3fms throughput=%.1f/s\n",
		name,
		series.Count,
		series.Errors,
		series.AvgMS,
		series.P50MS,
		series.P95MS,
		series.P99MS,
		series.MinMS,
		series.MaxMS,
		series.ThroughputPS,
	)
}
