package deploy

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

// Manifest describes a multi-function wasmdee deployment.
type Manifest struct {
	Version   int                `yaml:"version"`
	Name      string             `yaml:"name"`
	Domain    string             `yaml:"domain"`
	Functions []ManifestFunction `yaml:"functions"`
}

// ManifestFunction describes one deployable Wasm function.
type ManifestFunction struct {
	Name     string           `yaml:"name"`
	Source   string           `yaml:"source"`
	Route    string           `yaml:"route"`
	Domain   string           `yaml:"domain"`
	Deploy   *bool            `yaml:"deploy"`
	Controls FunctionControls `yaml:"controls"`
}

// FunctionControls captures deployment policy knobs kept with the function.
type FunctionControls struct {
	Preload          *bool  `json:"preload,omitempty" yaml:"preload"`
	ZeroCopy         *bool  `json:"zero_copy,omitempty" yaml:"zero_copy"`
	MaxConcurrency   int    `json:"max_concurrency,omitempty" yaml:"max_concurrency"`
	ScaleToZeroAfter string `json:"scale_to_zero_after,omitempty" yaml:"scale_to_zero_after"`
}

// ManifestOptions configures manifest deployment.
type ManifestOptions struct {
	Path       string
	ModulesDir string
	CacheDir   string
}

// ManifestResult summarizes deployment of a manifest.
type ManifestResult struct {
	AppName   string   `json:"app_name"`
	Domain    string   `json:"domain,omitempty"`
	Functions []Result `json:"functions"`
}

// Application deploys every enabled function in a wasmdee YAML manifest.
func Application(ctx context.Context, opts ManifestOptions) (ManifestResult, error) {
	manifest, manifestDir, err := LoadManifest(opts.Path)
	if err != nil {
		return ManifestResult{}, err
	}

	result := ManifestResult{AppName: manifest.Name, Domain: manifest.Domain}
	for _, fn := range manifest.Functions {
		if fn.Deploy != nil && !*fn.Deploy {
			continue
		}
		sourcePath := fn.Source
		if !filepath.IsAbs(sourcePath) {
			sourcePath = filepath.Join(manifestDir, sourcePath)
		}
		deployed, err := Function(ctx, Options{
			SourcePath:     sourcePath,
			Name:           fn.Name,
			ModulesDir:     opts.ModulesDir,
			CacheDir:       opts.CacheDir,
			Route:          fn.Route,
			Domain:         firstNonEmpty(fn.Domain, manifest.Domain),
			AppName:        manifest.Name,
			DeploymentName: manifest.Name,
			Controls:       fn.Controls,
			GenerateURL:    true,
		})
		if err != nil {
			return ManifestResult{}, fmt.Errorf("deploy function %q: %w", fn.Name, err)
		}
		result.Functions = append(result.Functions, deployed)
	}
	return result, nil
}

// LoadManifest parses and validates a wasmdee deployment manifest.
func LoadManifest(path string) (Manifest, string, error) {
	if path == "" {
		return Manifest{}, "", fmt.Errorf("manifest path is required")
	}
	absolutePath, err := filepath.Abs(path)
	if err != nil {
		return Manifest{}, "", fmt.Errorf("resolve manifest path: %w", err)
	}
	data, err := os.ReadFile(absolutePath)
	if err != nil {
		return Manifest{}, "", fmt.Errorf("read manifest: %w", err)
	}

	var manifest Manifest
	if err := yaml.Unmarshal(data, &manifest); err != nil {
		return Manifest{}, "", fmt.Errorf("parse manifest YAML: %w", err)
	}
	if manifest.Version == 0 {
		manifest.Version = 1
	}
	if manifest.Version != 1 {
		return Manifest{}, "", fmt.Errorf("unsupported manifest version %d", manifest.Version)
	}
	if err := ValidateName("app name", manifest.Name); err != nil {
		return Manifest{}, "", err
	}
	if err := ValidateDomain(manifest.Domain); err != nil {
		return Manifest{}, "", err
	}
	if len(manifest.Functions) == 0 {
		return Manifest{}, "", fmt.Errorf("manifest must declare at least one function")
	}

	names := make(map[string]bool)
	routes := make(map[string]bool)
	for index, fn := range manifest.Functions {
		if err := ValidateName("function name", fn.Name); err != nil {
			return Manifest{}, "", fmt.Errorf("functions[%d]: %w", index, err)
		}
		if names[fn.Name] {
			return Manifest{}, "", fmt.Errorf("duplicate function name %q", fn.Name)
		}
		names[fn.Name] = true
		if fn.Source == "" {
			return Manifest{}, "", fmt.Errorf("functions[%d] %q source is required", index, fn.Name)
		}
		if filepath.Ext(fn.Source) != ".wasm" {
			return Manifest{}, "", fmt.Errorf("functions[%d] %q source must be a .wasm file", index, fn.Name)
		}
		route := fn.Route
		if route == "" {
			route = "/" + fn.Name
			manifest.Functions[index].Route = route
		}
		if err := ValidateRoute(route); err != nil {
			return Manifest{}, "", fmt.Errorf("functions[%d] %q: %w", index, fn.Name, err)
		}
		if routes[route] {
			return Manifest{}, "", fmt.Errorf("duplicate route %q", route)
		}
		routes[route] = true
		if err := ValidateDomain(fn.Domain); err != nil {
			return Manifest{}, "", fmt.Errorf("functions[%d] %q: %w", index, fn.Name, err)
		}
		if fn.Controls.ScaleToZeroAfter != "" {
			if _, err := time.ParseDuration(fn.Controls.ScaleToZeroAfter); err != nil {
				return Manifest{}, "", fmt.Errorf("functions[%d] %q scale_to_zero_after: %w", index, fn.Name, err)
			}
		}
	}

	return manifest, filepath.Dir(absolutePath), nil
}

func encodeCapabilities(controls FunctionControls) (string, error) {
	data, err := json.Marshal(struct {
		Controls FunctionControls `json:"controls"`
	}{Controls: controls})
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
