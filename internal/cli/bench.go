package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html/template"
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
	benchReportPath  string
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
	GeneratedAt string                  `json:"generated_at"`
	Iterations  int                     `json:"iterations"`
	Warmup      int                     `json:"warmup"`
	Concurrency int                     `json:"concurrency"`
	System      benchSystem             `json:"system"`
	Memory      *benchMemory            `json:"memory,omitempty"`
	Cold        *benchSeries            `json:"cold,omitempty"`
	Rehydrate   *benchSeries            `json:"rehydrate,omitempty"`
	Warm        benchSeries             `json:"warm"`
	Engine      *wasmrt.EngineStats     `json:"engine,omitempty"`
	Dispatcher  *wasmrt.DispatcherStats `json:"dispatcher,omitempty"`
	Notes       []string                `json:"notes,omitempty"`
}

type benchSystem struct {
	OS        string `json:"os"`
	Arch      string `json:"arch"`
	CPUs      int    `json:"cpus"`
	GoVersion string `json:"go_version"`
}

type benchMemory struct {
	AllocBeforeBytes uint64 `json:"alloc_before_bytes"`
	AllocAfterBytes  uint64 `json:"alloc_after_bytes"`
	AllocDeltaBytes  int64  `json:"alloc_delta_bytes"`
	SysBytes         uint64 `json:"sys_bytes"`
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
	benchCmd.Flags().StringVar(&benchReportPath, "report", "", "write benchmark report to .json or .html")
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
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Iterations:  benchIterations,
		Warmup:      benchWarmup,
		Concurrency: benchConcurrency,
		System:      currentBenchSystem(),
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

	var before goruntime.MemStats
	goruntime.ReadMemStats(&before)
	report.Warm = runMeasured(benchIterations, benchConcurrency, func() error {
		_, err := dispatcher.Submit(ctx, benchmarkInvocation(fn))
		return err
	})
	var after goruntime.MemStats
	goruntime.ReadMemStats(&after)
	report.Memory = &benchMemory{
		AllocBeforeBytes: before.Alloc,
		AllocAfterBytes:  after.Alloc,
		AllocDeltaBytes:  int64(after.Alloc) - int64(before.Alloc),
		SysBytes:         after.Sys,
	}
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
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Iterations:  benchIterations,
		Warmup:      benchWarmup,
		Concurrency: benchConcurrency,
		System:      currentBenchSystem(),
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
	if benchReportPath != "" {
		if err := writeBenchReportFile(benchReportPath, report); err != nil {
			return err
		}
		fmt.Fprintf(cmd.OutOrStdout(), "report %s\n", benchReportPath)
	}
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

func currentBenchSystem() benchSystem {
	return benchSystem{
		OS:        goruntime.GOOS,
		Arch:      goruntime.GOARCH,
		CPUs:      goruntime.NumCPU(),
		GoVersion: goruntime.Version(),
	}
}

func writeBenchReportFile(path string, report benchReport) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil && filepath.Dir(path) != "." {
		return fmt.Errorf("create report directory: %w", err)
	}
	if strings.HasSuffix(strings.ToLower(path), ".html") {
		file, err := os.Create(path)
		if err != nil {
			return fmt.Errorf("create HTML report: %w", err)
		}
		defer file.Close()
		if err := benchHTMLTemplate.Execute(file, report); err != nil {
			return fmt.Errorf("write HTML report: %w", err)
		}
		return nil
	}
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("encode report JSON: %w", err)
	}
	if err := os.WriteFile(path, append(data, '\n'), 0o644); err != nil {
		return fmt.Errorf("write report JSON: %w", err)
	}
	return nil
}

var benchHTMLTemplate = template.Must(template.New("bench-report").Funcs(template.FuncMap{
	"bar": func(value float64) float64 {
		if value <= 0 {
			return 1
		}
		if value > 100 {
			return 100
		}
		return value
	},
}).Parse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>wasmdee benchmark report</title>
  <style>
    :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif; }
    body { margin: 0; background: #f7f8fa; color: #111827; }
    main { max-width: 980px; margin: 0 auto; padding: 48px 24px; }
    header { margin-bottom: 28px; }
    h1 { margin: 0; font-size: 34px; letter-spacing: -0.03em; }
    p { color: #667085; }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
    .card { background: white; border: 1px solid #dde2e7; border-radius: 12px; padding: 18px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06); }
    .label { color: #667085; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
    .value { margin-top: 8px; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; overflow: hidden; border-radius: 12px; background: white; border: 1px solid #dde2e7; }
    th, td { padding: 12px 14px; border-bottom: 1px solid #eef1f4; text-align: right; font-variant-numeric: tabular-nums; }
    th:first-child, td:first-child { text-align: left; }
    th { color: #667085; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; }
    .bar { height: 8px; border-radius: 999px; background: #eef1f4; overflow: hidden; }
    .bar > span { display: block; height: 100%; background: #111827; }
    .note { margin-top: 24px; font-size: 13px; }
    @media (prefers-color-scheme: dark) {
      body { background: #0f1419; color: #f7f8fa; }
      .card, table { background: #151b22; border-color: #29313b; }
      th, td { border-color: #29313b; }
      .bar { background: #202832; }
      .bar > span { background: #2dd4bf; }
    }
  </style>
</head>
<body>
<main>
  <header>
    <h1>wasmdee benchmark report</h1>
    <p>{{.Label}} {{.Mode}} · {{.GeneratedAt}} · {{.Target}}</p>
  </header>
  <section class="grid">
    <div class="card"><div class="label">Concurrency</div><div class="value">{{.Concurrency}}</div></div>
    <div class="card"><div class="label">Iterations</div><div class="value">{{.Iterations}}</div></div>
    <div class="card"><div class="label">System</div><div class="value">{{.System.OS}}/{{.System.Arch}}</div><p>{{.System.CPUs}} CPUs · {{.System.GoVersion}}</p></div>
    {{if .Memory}}<div class="card"><div class="label">Heap delta</div><div class="value">{{.Memory.AllocDeltaBytes}}</div><p>bytes during warm run</p></div>{{end}}
  </section>
  <table>
    <thead><tr><th>Path</th><th>Count</th><th>Errors</th><th>Avg ms</th><th>P50</th><th>P95</th><th>P99</th><th>Throughput/s</th></tr></thead>
    <tbody>
      {{if .Cold}}<tr><td>cold</td><td>{{.Cold.Count}}</td><td>{{.Cold.Errors}}</td><td>{{printf "%.3f" .Cold.AvgMS}}</td><td>{{printf "%.3f" .Cold.P50MS}}</td><td>{{printf "%.3f" .Cold.P95MS}}</td><td>{{printf "%.3f" .Cold.P99MS}}</td><td>{{printf "%.1f" .Cold.ThroughputPS}}</td></tr>{{end}}
      {{if .Rehydrate}}<tr><td>rehydrate</td><td>{{.Rehydrate.Count}}</td><td>{{.Rehydrate.Errors}}</td><td>{{printf "%.3f" .Rehydrate.AvgMS}}</td><td>{{printf "%.3f" .Rehydrate.P50MS}}</td><td>{{printf "%.3f" .Rehydrate.P95MS}}</td><td>{{printf "%.3f" .Rehydrate.P99MS}}</td><td>{{printf "%.1f" .Rehydrate.ThroughputPS}}</td></tr>{{end}}
      <tr><td>warm</td><td>{{.Warm.Count}}</td><td>{{.Warm.Errors}}</td><td>{{printf "%.3f" .Warm.AvgMS}}</td><td>{{printf "%.3f" .Warm.P50MS}}</td><td>{{printf "%.3f" .Warm.P95MS}}</td><td>{{printf "%.3f" .Warm.P99MS}}</td><td>{{printf "%.1f" .Warm.ThroughputPS}}</td></tr>
    </tbody>
  </table>
  <section class="card note">
    <div class="label">Notes</div>
    {{range .Notes}}<p>{{.}}</p>{{end}}
  </section>
</main>
</body>
</html>`))

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
