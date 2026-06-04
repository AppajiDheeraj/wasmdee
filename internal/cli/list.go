package cli

import (
	"fmt"
	"time"

	"github.com/dheeraj/wasmdee/internal/state"
	"github.com/spf13/cobra"
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "Show deployed functions",
	RunE: func(cmd *cobra.Command, args []string) error {
		functions, err := state.ListFunctions()
		if err != nil {
			return err
		}
		if len(functions) == 0 {
			fmt.Fprintln(cmd.OutOrStdout(), "no functions deployed yet")
			return nil
		}

		fmt.Fprintf(cmd.OutOrStdout(), "%-24s %-20s %s\n", "NAME", "CREATED", "MODULE")
		for _, fn := range functions {
			created := time.Unix(fn.CreatedAt, 0).Format("2006-01-02 15:04:05")
			fmt.Fprintf(cmd.OutOrStdout(), "%-24s %-20s %s\n", fn.Name, created, fn.WasmPath)
		}
		return nil
	},
}
