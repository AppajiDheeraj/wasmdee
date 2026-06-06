package cli

import (
	"context"
	"fmt"
	"time"

	"github.com/dheeraj/wasmdee/internal/config"
	"github.com/dheeraj/wasmdee/internal/deploy"
	"github.com/spf13/cobra"
)

var (
	deployName   string
	deployRoute  string
	deployDomain string
	deployConfig string
)

var deployCmd = &cobra.Command{
	Use:   "deploy <file.wasm>",
	Short: "Register WebAssembly functions",
	Args: func(cmd *cobra.Command, args []string) error {
		if deployConfig != "" {
			if len(args) != 0 {
				return fmt.Errorf("--config cannot be combined with a positional .wasm file")
			}
			return nil
		}
		if len(args) != 1 {
			return fmt.Errorf("expected one .wasm file or --config <wasmdee.yaml>")
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 20*time.Second)
		defer cancel()
		if deployConfig != "" {
			result, err := deploy.Application(ctx, deploy.ManifestOptions{
				Path:       deployConfig,
				ModulesDir: config.GetModulesDir(),
				CacheDir:   config.GetCacheDir(),
			})
			if err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "deployed app %s (%d functions)\n", result.AppName, len(result.Functions))
			for _, function := range result.Functions {
				fmt.Fprintf(cmd.OutOrStdout(), "- %s route=%s url=%s\n", function.Function.Name, function.Function.Route, displayURL(function.Function.PublicURL))
			}
			return nil
		}

		result, err := deploy.Function(ctx, deploy.Options{
			SourcePath:  args[0],
			Name:        deployName,
			ModulesDir:  config.GetModulesDir(),
			CacheDir:    config.GetCacheDir(),
			Route:       deployRoute,
			Domain:      deployDomain,
			GenerateURL: deployDomain != "",
		})
		if err != nil {
			return err
		}

		fmt.Fprintf(cmd.OutOrStdout(), "deployed %s\n", result.Function.Name)
		fmt.Fprintf(cmd.OutOrStdout(), "module %s\n", result.StoredPath)
		fmt.Fprintf(cmd.OutOrStdout(), "route %s\n", result.Function.Route)
		if result.Function.PublicURL != "" {
			fmt.Fprintf(cmd.OutOrStdout(), "url %s\n", result.Function.PublicURL)
		}
		return nil
	},
}

func init() {
	deployCmd.Flags().StringVarP(&deployName, "name", "n", "", "function name (defaults to wasm filename)")
	deployCmd.Flags().StringVar(&deployRoute, "route", "", "HTTP route for the function, e.g. /api/hello")
	deployCmd.Flags().StringVar(&deployDomain, "domain", "", "custom deployment domain for generated URL metadata")
	deployCmd.Flags().StringVarP(&deployConfig, "config", "f", "", "deploy from a wasmdee YAML manifest")
}

func displayURL(value string) string {
	if value == "" {
		return "(local route only)"
	}
	return value
}
