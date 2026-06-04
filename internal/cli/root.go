package cli

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/dheeraj/wasmdee/internal/config"
	"github.com/dheeraj/wasmdee/internal/state"
	"github.com/dheeraj/wasmdee/internal/utils"
	"github.com/spf13/cobra"
)

var (
	Version   = "dev"
	BuildTime = "unknown"
)

var verbose bool

var rootCmd = &cobra.Command{
	Use:     "wasmdee",
	Short:   "A Wasm-native serverless runtime",
	Long:    `wasmdee is a Wasm-native serverless runtime running functions at microsecond scale.`,
	Version: Version,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		return initializeGlobalState()
	},
}

func init() {
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "enable verbose logging")

	rootCmd.AddCommand(deployCmd)
	rootCmd.AddCommand(invokeCmd)
	rootCmd.AddCommand(listCmd)
	rootCmd.AddCommand(serveCmd)
	rootCmd.AddCommand(benchCmd)
}

// Execute runs the root command and exits on error.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

// initializeGlobalState prepares directories, DB, and logging for CLI usage.
func initializeGlobalState() error {
	if err := config.EnsureDirs(); err != nil {
		return err
	}

	// Config engine state
	state.Configure(filepath.Join(config.GetStateDir(), "wasmdee.db"))

	// Config logging
	utils.ConfigureDebug(config.GetLogsDir())

	// Clean up old logs (retain last 5 log files)
	utils.CleanupLogs(5)
	return nil
}
