package state

import (
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/dheeraj/wasmdee/internal/utils"
	_ "modernc.org/sqlite" // SQLite driver
)

var (
	db         *sql.DB
	dbMu       sync.Mutex
	dbPath     string
	configured bool
)

// Configure sets the path for the SQLite database.
// Callers must do this before any state operations so the DB is process-wide.
func Configure(path string) {
	dbMu.Lock()
	defer dbMu.Unlock()
	dbPath = path
	configured = true
}

// initDB opens the SQLite database and ensures schema exists.
// It is safe to call multiple times.
func initDB() error {
	dbMu.Lock()
	defer dbMu.Unlock()

	if db != nil {
		return nil // Already initialized
	}

	if !configured || dbPath == "" {
		return fmt.Errorf("state database not configured: call state.Configure() first")
	}

	var err error
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	query := `
	CREATE TABLE IF NOT EXISTS functions (
		name TEXT PRIMARY KEY,
		wasm_path TEXT NOT NULL,
		capabilities TEXT NOT NULL,
		created_at INTEGER NOT NULL
	);
	`

	if _, err := db.Exec(query); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	if err := ensureFunctionColumns(); err != nil {
		return err
	}

	return nil
}

// Function is the local registry record for a deployed Wasm function.
type Function struct {
	Name           string `json:"name"`
	WasmPath       string `json:"wasm_path"`
	Capabilities   string `json:"capabilities"`
	Route          string `json:"route,omitempty"`
	PublicURL      string `json:"public_url,omitempty"`
	Domain         string `json:"domain,omitempty"`
	AppName        string `json:"app_name,omitempty"`
	DeploymentName string `json:"deployment_name,omitempty"`
	CreatedAt      int64  `json:"created_at"`
}

// SaveFunction inserts or replaces a function registry entry.
func SaveFunction(fn Function) error {
	if fn.CreatedAt == 0 {
		fn.CreatedAt = time.Now().Unix()
	}

	return withTx(func(tx *sql.Tx) error {
		_, err := tx.Exec(`
			INSERT INTO functions (
				name, wasm_path, capabilities, route, public_url, domain, app_name, deployment_name, created_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(name) DO UPDATE SET
				wasm_path = excluded.wasm_path,
				capabilities = excluded.capabilities,
				route = excluded.route,
				public_url = excluded.public_url,
				domain = excluded.domain,
				app_name = excluded.app_name,
				deployment_name = excluded.deployment_name,
				created_at = excluded.created_at
		`, fn.Name, fn.WasmPath, fn.Capabilities, fn.Route, fn.PublicURL, fn.Domain, fn.AppName, fn.DeploymentName, fn.CreatedAt)
		if err != nil {
			return fmt.Errorf("failed to save function %q: %w", fn.Name, err)
		}
		return nil
	})
}

// GetFunction returns a function by name.
func GetFunction(name string) (Function, error) {
	d, err := GetDB()
	if err != nil {
		return Function{}, err
	}

	var fn Function
	err = d.QueryRow(`
		SELECT name, wasm_path, capabilities, route, public_url, domain, app_name, deployment_name, created_at
		FROM functions
		WHERE name = ?
	`, name).Scan(&fn.Name, &fn.WasmPath, &fn.Capabilities, &fn.Route, &fn.PublicURL, &fn.Domain, &fn.AppName, &fn.DeploymentName, &fn.CreatedAt)
	if err == sql.ErrNoRows {
		return Function{}, fmt.Errorf("function %q is not deployed", name)
	}
	if err != nil {
		return Function{}, fmt.Errorf("failed to read function %q: %w", name, err)
	}
	return fn, nil
}

// GetFunctionByRoute returns the function whose deployment route matches path.
func GetFunctionByRoute(path string) (Function, error) {
	d, err := GetDB()
	if err != nil {
		return Function{}, err
	}

	var fn Function
	err = d.QueryRow(`
		SELECT name, wasm_path, capabilities, route, public_url, domain, app_name, deployment_name, created_at
		FROM functions
		WHERE route = ?
	`, path).Scan(&fn.Name, &fn.WasmPath, &fn.Capabilities, &fn.Route, &fn.PublicURL, &fn.Domain, &fn.AppName, &fn.DeploymentName, &fn.CreatedAt)
	if err == sql.ErrNoRows {
		return Function{}, fmt.Errorf("no function is deployed at route %q", path)
	}
	if err != nil {
		return Function{}, fmt.Errorf("failed to read route %q: %w", path, err)
	}
	return fn, nil
}

// ListFunctions returns all deployed functions ordered by name.
func ListFunctions() ([]Function, error) {
	d, err := GetDB()
	if err != nil {
		return nil, err
	}

	rows, err := d.Query(`
		SELECT name, wasm_path, capabilities, route, public_url, domain, app_name, deployment_name, created_at
		FROM functions
		ORDER BY name
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list functions: %w", err)
	}
	defer rows.Close()

	var functions []Function
	for rows.Next() {
		var fn Function
		if err := rows.Scan(&fn.Name, &fn.WasmPath, &fn.Capabilities, &fn.Route, &fn.PublicURL, &fn.Domain, &fn.AppName, &fn.DeploymentName, &fn.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan function: %w", err)
		}
		functions = append(functions, fn)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate functions: %w", err)
	}
	return functions, nil
}

func ensureFunctionColumns() error {
	d := db
	rows, err := d.Query(`PRAGMA table_info(functions)`)
	if err != nil {
		return fmt.Errorf("inspect functions schema: %w", err)
	}
	defer rows.Close()

	existing := make(map[string]bool)
	for rows.Next() {
		var cid int
		var name, columnType string
		var notNull, pk int
		var defaultValue any
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &pk); err != nil {
			return fmt.Errorf("scan functions schema: %w", err)
		}
		existing[name] = true
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate functions schema: %w", err)
	}

	columns := map[string]string{
		"route":           "TEXT NOT NULL DEFAULT ''",
		"public_url":      "TEXT NOT NULL DEFAULT ''",
		"domain":          "TEXT NOT NULL DEFAULT ''",
		"app_name":        "TEXT NOT NULL DEFAULT ''",
		"deployment_name": "TEXT NOT NULL DEFAULT ''",
	}
	for name, definition := range columns {
		if existing[name] {
			continue
		}
		if _, err := d.Exec(fmt.Sprintf("ALTER TABLE functions ADD COLUMN %s %s", name, definition)); err != nil {
			return fmt.Errorf("add functions.%s column: %w", name, err)
		}
	}
	return nil
}

// CloseDB closes the database to release file handles on shutdown.
func CloseDB() {
	dbMu.Lock()
	defer dbMu.Unlock()
	if db != nil {
		db.Close()
		db = nil
	}
}

// GetDB returns a lazily initialized DB handle.
func GetDB() (*sql.DB, error) {
	if db == nil {
		if err := initDB(); err != nil {
			return nil, err
		}
	}
	return db, nil
}

func getDBHelper() *sql.DB {
	d, err := GetDB()
	if err != nil {
		log.Printf("State DB Error: %v", err)
		return nil
	}
	return d
}

// withTx wraps a unit of work in a transaction and handles rollback/commit.
func withTx(fn func(*sql.Tx) error) error {
	d := getDBHelper()
	if d == nil {
		return fmt.Errorf("database not initialized")
	}

	tx, err := d.Begin()
	if err != nil {
		utils.Debug("Failed to begin transaction: %v", err)
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	if err := fn(tx); err != nil {
		utils.Debug("Transaction function error, rolling back: %v", err)
		if rbErr := tx.Rollback(); rbErr != nil {
			utils.Debug("Failed to rollback transaction: %v", rbErr)
			return fmt.Errorf("transaction error: %w (rollback failed: %v)", err, rbErr)
		}
		return err
	}

	if err := tx.Commit(); err != nil {
		utils.Debug("Failed to commit transaction: %v", err)
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
