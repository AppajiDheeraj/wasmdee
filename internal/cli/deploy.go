package cli

import (
	"context"
	"fmt"
	"time"

	"github.com/dheeraj/wasmdee/internal/config"
	"github.com/dheeraj/wasmdee/internal/deploy"
	"github.com/spf13/cobra"
)

var deployName string

var deployCmd = &cobra.Command{
	Use:   "deploy <file.wasm>",
	Short: "Register a WebAssembly function",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 20*time.Second)
		defer cancel()
		result, err := deploy.Function(ctx, deploy.Options{
			SourcePath: args[0],
			Name:       deployName,
			ModulesDir: config.GetModulesDir(),
			CacheDir:   config.GetCacheDir(),
		})
		if err != nil {
			return err
		}

		fmt.Fprintf(cmd.OutOrStdout(), "deployed %s\n", result.Function.Name)
		fmt.Fprintf(cmd.OutOrStdout(), "module %s\n", result.StoredPath)
		return nil
	},
}

func init() {
	deployCmd.Flags().StringVarP(&deployName, "name", "n", "", "function name (defaults to wasm filename)")
}
