package main

import (
	"context"
	"fmt"
	"path/filepath"
	goruntime "runtime"
	"time"

	"github.com/dheeraj/wasmdee/internal/config"
	"github.com/dheeraj/wasmdee/internal/deploy"
	wasmrt "github.com/dheeraj/wasmdee/internal/runtime"
	"github.com/dheeraj/wasmdee/internal/state"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx        context.Context
	engine     *wasmrt.Engine
	dispatcher *wasmrt.Dispatcher
	preload    wasmrt.PreloadResult
	startErr   error
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.startErr = a.initializeRuntime(ctx)
}

func (a *App) shutdown(ctx context.Context) {
	if a.dispatcher != nil {
		a.dispatcher.Close()
	}
	if a.engine != nil {
		_ = a.engine.Close(ctx)
	}
}

func (a *App) initializeRuntime(ctx context.Context) error {
	if err := config.EnsureDirs(); err != nil {
		return err
	}
	state.Configure(filepath.Join(config.GetStateDir(), "wasmdee.db"))

	engine, err := wasmrt.NewEngine(ctx, wasmrt.EngineConfig{CacheDir: config.GetCacheDir()})
	if err != nil {
		return err
	}
	functions, err := state.ListFunctions()
	if err != nil {
		_ = engine.Close(ctx)
		return err
	}

	dispatcher, err := wasmrt.NewDispatcher(engine, wasmrt.DispatcherConfig{
		Workers:        max(1, goruntime.NumCPU()*2),
		QueueSize:      256,
		DefaultTimeout: 10 * time.Second,
	})
	if err != nil {
		_ = engine.Close(ctx)
		return err
	}

	a.engine = engine
	a.dispatcher = dispatcher
	a.preload = engine.Preload(ctx, functions)
	return nil
}

// RuntimeSnapshot returns live local runtime data for the desktop console.
func (a *App) RuntimeSnapshot() (RuntimeSnapshot, error) {
	if err := a.requireRuntime(); err != nil {
		return RuntimeSnapshot{Status: "error", Error: err.Error()}, nil
	}

	functions, err := state.ListFunctions()
	if err != nil {
		return RuntimeSnapshot{}, err
	}

	return RuntimeSnapshot{
		Status:        "ok",
		StateDir:      config.GetStateDir(),
		Functions:     functions,
		Engine:        a.engine.Stats(),
		Dispatcher:    a.dispatcher.Stats(),
		FunctionStats: a.dispatcher.FunctionStats(),
		Preload:       a.preload,
		ProtoFaaslets: a.engine.ProtoFaaslets(),
	}, nil
}

// InvokeFunction invokes a deployed function through the GUI's shared runtime.
func (a *App) InvokeFunction(name string, body string, args []string) (InvokeResponse, error) {
	if err := a.requireRuntime(); err != nil {
		return InvokeResponse{}, err
	}

	fn, err := state.GetFunction(name)
	if err != nil {
		return InvokeResponse{}, err
	}

	result, err := a.dispatcher.Submit(a.ctx, wasmrt.Invocation{
		Function: fn,
		Stdin:    []byte(body),
		Args:     args,
	})
	if err != nil {
		return InvokeResponse{}, err
	}

	return InvokeResponse{
		Name:      name,
		Stdout:    result.Stdout,
		Stderr:    result.Stderr,
		ExitCode:  result.ExitCode,
		LatencyMS: float64(result.Latency.Microseconds()) / 1000.0,
	}, nil
}

// SelectAndDeployFunction opens a native file picker and deploys a selected Wasm module.
func (a *App) SelectAndDeployFunction(name string) (RuntimeSnapshot, error) {
	if err := a.requireRuntime(); err != nil {
		return RuntimeSnapshot{}, err
	}

	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Deploy WebAssembly Function",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "WebAssembly modules (*.wasm)", Pattern: "*.wasm"},
		},
	})
	if err != nil {
		return RuntimeSnapshot{}, err
	}
	if path == "" {
		return a.RuntimeSnapshot()
	}

	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()
	result, err := deploy.Function(ctx, deploy.Options{
		SourcePath: path,
		Name:       name,
		ModulesDir: config.GetModulesDir(),
		CacheDir:   config.GetCacheDir(),
	})
	if err != nil {
		return RuntimeSnapshot{}, err
	}

	a.preload = a.engine.Preload(ctx, []state.Function{result.Function})
	return a.RuntimeSnapshot()
}

func (a *App) requireRuntime() error {
	if a.startErr != nil {
		return a.startErr
	}
	if a.engine == nil || a.dispatcher == nil {
		return fmt.Errorf("runtime is not initialized")
	}
	return nil
}

type RuntimeSnapshot struct {
	Status        string                 `json:"status"`
	Error         string                 `json:"error,omitempty"`
	StateDir      string                 `json:"state_dir"`
	Functions     []state.Function       `json:"functions"`
	Engine        wasmrt.EngineStats     `json:"engine"`
	Dispatcher    wasmrt.DispatcherStats `json:"dispatcher"`
	FunctionStats []wasmrt.FunctionStats `json:"function_stats"`
	Preload       wasmrt.PreloadResult   `json:"preload"`
	ProtoFaaslets []wasmrt.ProtoFaaslet  `json:"proto_faaslets"`
}

type InvokeResponse struct {
	Name      string  `json:"name"`
	Stdout    string  `json:"stdout"`
	Stderr    string  `json:"stderr"`
	ExitCode  uint32  `json:"exit_code"`
	LatencyMS float64 `json:"latency_ms"`
}
