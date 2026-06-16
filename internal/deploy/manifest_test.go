package deploy

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadManifestValidatesAndDefaultsRoutes(t *testing.T) {
	dir := t.TempDir()
	manifestPath := filepath.Join(dir, "wasmdee.yaml")
	if err := os.WriteFile(manifestPath, []byte(`
version: 1
name: demo-api
domain: api.example.com
functions:
  - name: hello
    source: hello.wasm
    controls:
      preload: true
      max_concurrency: 64
      scale_to_zero_after: 5m
  - name: goodbye
    source: goodbye.wasm
    route: /bye
`), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	manifest, manifestDir, err := LoadManifest(manifestPath)
	if err != nil {
		t.Fatalf("LoadManifest() error = %v", err)
	}
	if manifestDir != dir {
		t.Fatalf("manifestDir = %q, want %q", manifestDir, dir)
	}
	if manifest.Functions[0].Route != "/hello" {
		t.Fatalf("default route = %q, want /hello", manifest.Functions[0].Route)
	}
	if manifest.Functions[1].Route != "/bye" {
		t.Fatalf("explicit route = %q, want /bye", manifest.Functions[1].Route)
	}
}

func TestLoadManifestRejectsBadNamesAndRoutes(t *testing.T) {
	dir := t.TempDir()
	manifestPath := filepath.Join(dir, "wasmdee.yaml")
	if err := os.WriteFile(manifestPath, []byte(`
version: 1
name: Demo_API
functions:
  - name: hello
    source: hello.wasm
    route: hello
`), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	if _, _, err := LoadManifest(manifestPath); err == nil {
		t.Fatal("LoadManifest() error = nil, want validation error")
	}
}

func TestLoadManifestRejectsNegativeConcurrency(t *testing.T) {
	dir := t.TempDir()
	manifestPath := filepath.Join(dir, "wasmdee.yaml")
	if err := os.WriteFile(manifestPath, []byte(`
version: 1
name: demo-api
functions:
  - name: hello
    source: hello.wasm
    controls:
      max_concurrency: -1
`), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	if _, _, err := LoadManifest(manifestPath); err == nil {
		t.Fatal("LoadManifest() error = nil, want max_concurrency validation error")
	}
}

func TestLoadManifestRejectsUnknownControls(t *testing.T) {
	dir := t.TempDir()
	manifestPath := filepath.Join(dir, "wasmdee.yaml")
	if err := os.WriteFile(manifestPath, []byte(`
version: 1
name: demo-api
functions:
  - name: hello
    source: hello.wasm
    controls:
      zero_copy: true
`), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	if _, _, err := LoadManifest(manifestPath); err == nil {
		t.Fatal("LoadManifest() error = nil, want unknown control error")
	}
}
