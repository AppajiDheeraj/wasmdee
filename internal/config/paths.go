package config

import (
	"os"
	"path/filepath"
	"runtime"
)

// GetGoWasmdeeDir returns the per-user config root based on OS conventions.
func GetWasmdeeDir() string {
	switch runtime.GOOS {
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData == "" {
			appData = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Roaming")
		}
		return filepath.Join(appData, "Wasmdee")
	case "darwin": //MacOS
		home, _ := os.UserHomeDir()
		return filepath.Join(home, "Library", "Application Support", "Wasmdee")
	default: //Linux
		configHome := os.Getenv("XDG_CONFIG_HOME")
		if configHome == "" {
			home, _ := os.UserHomeDir()
			configHome = filepath.Join(home, ".config")
		}
		return filepath.Join(configHome, "Wasmdee")
	}
}

// GetRuntimeDir returns the directory for runtime files (pid, port, lock).
// Linux: $XDG_RUNTIME_DIR/Wasmdee or fallback to GetStateDir() if unset
// macOS: $TMPDIR/Wasmdee-runtime
// Windows: %TEMP%/Wasmdee
func GetRuntimeDir() string {
	switch runtime.GOOS {
	case "windows":
		return filepath.Join(os.TempDir(), "Wasmdee")
	case "darwin":
		return filepath.Join(os.TempDir(), "Wasmdee-runtime")
	default: // Linux
		runtimeDir := os.Getenv("XDG_RUNTIME_DIR")
		if runtimeDir != "" {
			return filepath.Join(runtimeDir, "Wasmdee")
		}
		// Fallback to state dir if XDG_RUNTIME_DIR is not set (e.g. docker, headless)
		return GetStateDir()
	}
}

// EnsureAbsPath normalizes a path for consistent state lookups.
func EnsureAbsPath(path string) string {
	if path == "" {
		path = "."
	}
	if abs, err := filepath.Abs(path); err == nil {
		return abs
	}
	return path
}

// GetStateDir returns the directory for persistent state (DB, tokens).
func GetStateDir() string {
	return filepath.Join(GetWasmdeeDir(), "state")
}

// GetLogsDir returns the directory for logs.
func GetLogsDir() string {
	return filepath.Join(GetWasmdeeDir(), "logs")
}

// EnsureDirs creates all required directories.
func EnsureDirs() error {
	dirs := []string{GetWasmdeeDir(), GetStateDir(), GetLogsDir(), GetRuntimeDir()}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}
