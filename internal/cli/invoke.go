package cli

import (
	"fmt"

	"github.com/spf13/cobra"
)

var invokeCmd = &cobra.Command{
	Use:   "invoke <name>",
	Short: "Invoke a deployed function",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Fprintf(cmd.OutOrStdout(), "invoking %s\n", args[0])
		return nil
	},
}
