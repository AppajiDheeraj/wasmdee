package deploy

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	wasmrt "github.com/dheeraj/wasmdee/internal/runtime"
	"github.com/dheeraj/wasmdee/internal/state"
)

// Options configures a local Wasm function deployment.
type Options struct {
	SourcePath     string
	Name           string
	ModulesDir     string
	CacheDir       string
	Route          string
	Domain         string
	AppName        string
	DeploymentName string
	Controls       FunctionControls
	GenerateURL    bool
}

// Result describes a deployed function and its stored module.
type Result struct {
	Function   state.Function `json:"function"`
	Hash       string         `json:"hash"`
	StoredPath string         `json:"stored_path"`
}

// Function validates, stores, and registers a Wasm function.
func Function(ctx context.Context, opts Options) (Result, error) {
	sourcePath, err := filepath.Abs(opts.SourcePath)
	if err != nil {
		return Result{}, fmt.Errorf("resolve wasm path: %w", err)
	}
	if filepath.Ext(sourcePath) != ".wasm" {
		return Result{}, fmt.Errorf("expected a .wasm file, got %s", sourcePath)
	}
	if opts.ModulesDir == "" {
		return Result{}, fmt.Errorf("modules directory is required")
	}
	if opts.CacheDir == "" {
		return Result{}, fmt.Errorf("cache directory is required")
	}

	file, err := os.Open(sourcePath)
	if err != nil {
		return Result{}, fmt.Errorf("open wasm file: %w", err)
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return Result{}, fmt.Errorf("hash wasm file: %w", err)
	}
	sum := hex.EncodeToString(hash.Sum(nil))

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return Result{}, fmt.Errorf("rewind wasm file: %w", err)
	}

	if err := os.MkdirAll(opts.ModulesDir, 0o755); err != nil {
		return Result{}, fmt.Errorf("create module store: %w", err)
	}
	storedPath := filepath.Join(opts.ModulesDir, sum+".wasm")
	out, err := os.OpenFile(storedPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		return Result{}, fmt.Errorf("create stored module: %w", err)
	}
	if _, err := io.Copy(out, file); err != nil {
		out.Close()
		return Result{}, fmt.Errorf("copy wasm module: %w", err)
	}
	if err := out.Close(); err != nil {
		return Result{}, fmt.Errorf("close stored module: %w", err)
	}

	if err := wasmrt.ValidateModule(ctx, storedPath, opts.CacheDir); err != nil {
		_ = os.Remove(storedPath)
		return Result{}, err
	}

	name := opts.Name
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(sourcePath), filepath.Ext(sourcePath))
	}
	if err := ValidateName("function name", name); err != nil {
		return Result{}, err
	}
	appName := opts.AppName
	if appName == "" {
		appName = "local"
	}
	if err := ValidateName("app name", appName); err != nil {
		return Result{}, err
	}
	route := opts.Route
	if route == "" {
		route = "/" + name
	}
	if err := ValidateRoute(route); err != nil {
		return Result{}, err
	}
	if err := ValidateDomain(opts.Domain); err != nil {
		return Result{}, err
	}
	capabilities, err := encodeCapabilities(opts.Controls)
	if err != nil {
		return Result{}, fmt.Errorf("encode deployment controls: %w", err)
	}
	publicURL := ""
	if opts.GenerateURL || opts.Domain != "" {
		publicURL, err = generatedURL(appName, name, route, opts.Domain)
		if err != nil {
			return Result{}, err
		}
	}

	fn := state.Function{
		Name:           name,
		WasmPath:       storedPath,
		Capabilities:   capabilities,
		Route:          route,
		PublicURL:      publicURL,
		Domain:         opts.Domain,
		AppName:        appName,
		DeploymentName: opts.DeploymentName,
		CreatedAt:      time.Now().Unix(),
	}
	if err := state.SaveFunction(fn); err != nil {
		return Result{}, err
	}

	return Result{Function: fn, Hash: sum, StoredPath: storedPath}, nil
}
