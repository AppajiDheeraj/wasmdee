package cli

import (
	"fmt"

	"github.com/spf13/cobra"
)

var deployCmd = &cobra.Command{
	Use:   "deploy <file.wasm>",
	Short: "Register a WebAssembly function",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Fprintf(cmd.OutOrStdout(), "deploying %s\n", args[0])
		return nil
	},
}
