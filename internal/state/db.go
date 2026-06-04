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

	return nil
}

// Function is the local registry record for a deployed Wasm function.
type Function struct {
	Name         string `json:"name"`
	WasmPath     string `json:"wasm_path"`
	Capabilities string `json:"capabilities"`
	CreatedAt    int64  `json:"created_at"`
}

// SaveFunction inserts or replaces a function registry entry.
func SaveFunction(fn Function) error {
	if fn.CreatedAt == 0 {
		fn.CreatedAt = time.Now().Unix()
	}

	return withTx(func(tx *sql.Tx) error {
		_, err := tx.Exec(`
			INSERT INTO functions (name, wasm_path, capabilities, created_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(name) DO UPDATE SET
				wasm_path = excluded.wasm_path,
				capabilities = excluded.capabilities,
				created_at = excluded.created_at
		`, fn.Name, fn.WasmPath, fn.Capabilities, fn.CreatedAt)
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
		SELECT name, wasm_path, capabilities, created_at
		FROM functions
		WHERE name = ?
	`, name).Scan(&fn.Name, &fn.WasmPath, &fn.Capabilities, &fn.CreatedAt)
	if err == sql.ErrNoRows {
		return Function{}, fmt.Errorf("function %q is not deployed", name)
	}
	if err != nil {
		return Function{}, fmt.Errorf("failed to read function %q: %w", name, err)
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
		SELECT name, wasm_path, capabilities, created_at
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
		if err := rows.Scan(&fn.Name, &fn.WasmPath, &fn.Capabilities, &fn.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan function: %w", err)
		}
		functions = append(functions, fn)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate functions: %w", err)
	}
	return functions, nil
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
