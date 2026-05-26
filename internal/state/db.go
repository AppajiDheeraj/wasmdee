package state

import (
	"database/sql"
	"fmt"
	"log"
	"sync"

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
		if !configured || dbPath == "" {
			return fmt.Errorf("state database not configured: call state.Configure() first")
		}

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
