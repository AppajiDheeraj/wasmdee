package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/dheeraj/wasmdee/internal/config"
	"github.com/dheeraj/wasmdee/internal/deploy"
	"github.com/dheeraj/wasmdee/internal/state"
)

func TestAppRuntimeSnapshotAndHandlerInvocation(t *testing.T) {
	t.Setenv("WASMDEE_HOME", t.TempDir())
	ctx := context.Background()
	app := NewApp()
	app.startup(ctx)
	if app.startErr != nil {
		t.Fatalf("startup() error = %v", app.startErr)
	}
	defer func() {
		app.shutdown(ctx)
		state.CloseDB()
	}()

	fixture := filepath.Join("..", "examples", "handler", "echo.wasm")
	if _, err := os.Stat(fixture); err != nil {
		t.Fatalf("handler fixture: %v", err)
	}
	deployed, err := deploy.Function(ctx, deploy.Options{
		SourcePath: fixture,
		Name:       "gui-echo",
		ModulesDir: config.GetModulesDir(),
		CacheDir:   config.GetCacheDir(),
		Route:      "/gui-echo",
	})
	if err != nil {
		t.Fatalf("deploy.Function() error = %v", err)
	}
	app.preload = app.engine.Preload(ctx, []state.Function{deployed.Function})

	response, err := app.InvokeFunction("gui-echo", "from gui bridge", nil)
	if err != nil {
		t.Fatalf("InvokeFunction() error = %v", err)
	}
	if response.Stdout != "from gui bridge" || response.ExitCode != 0 {
		t.Fatalf("InvokeFunction() = %+v", response)
	}

	snapshot, err := app.RuntimeSnapshot()
	if err != nil {
		t.Fatalf("RuntimeSnapshot() error = %v", err)
	}
	if snapshot.Status != "ok" || snapshot.Engine.HandlerInvocations != 1 {
		t.Fatalf("RuntimeSnapshot() = %+v", snapshot)
	}
	if len(snapshot.ProtoFaaslets) != 1 || snapshot.ProtoFaaslets[0].ABI != "wasmdee-handler" {
		t.Fatalf("ProtoFaaslets = %+v", snapshot.ProtoFaaslets)
	}
}
