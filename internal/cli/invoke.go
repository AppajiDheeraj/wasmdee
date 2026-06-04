package cli

import (
	"context"
	"fmt"
	"time"

	"github.com/dheeraj/wasmdee/internal/config"
	wasmrt "github.com/dheeraj/wasmdee/internal/runtime"
	"github.com/dheeraj/wasmdee/internal/state"
	"github.com/spf13/cobra"
)

var (
	invokeData    string
	invokeArgs    []string
	invokeTimeout time.Duration
)

var invokeCmd = &cobra.Command{
	Use:   "invoke <name>",
	Short: "Invoke a deployed function",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		fn, err := state.GetFunction(args[0])
		if err != nil {
			return err
		}

		ctx := cmd.Context()
		if ctx == nil {
			ctx = context.Background()
		}
		result, err := wasmrt.Invoke(ctx, wasmrt.Invocation{
			Function: fn,
			Stdin:    []byte(invokeData),
			Args:     invokeArgs,
			CacheDir: config.GetCacheDir(),
			Timeout:  invokeTimeout,
		})
		if err != nil {
			return err
		}

		if result.Stdout != "" {
			fmt.Fprint(cmd.OutOrStdout(), result.Stdout)
		}
		if result.Stderr != "" {
			fmt.Fprint(cmd.ErrOrStderr(), result.Stderr)
		}
		if verbose {
			fmt.Fprintf(cmd.ErrOrStderr(), "\nexit_code=%d latency=%s\n", result.ExitCode, result.Latency)
		}
		if result.ExitCode != 0 {
			return fmt.Errorf("function exited with code %d", result.ExitCode)
		}
		return nil
	},
}

func init() {
	invokeCmd.Flags().StringVarP(&invokeData, "data", "d", "", "stdin payload for the function")
	invokeCmd.Flags().StringArrayVar(&invokeArgs, "arg", nil, "argument passed to the function; repeat for multiple args")
	invokeCmd.Flags().DurationVar(&invokeTimeout, "timeout", 5*time.Second, "maximum invocation duration")
}
