package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	goruntime "runtime"
	"strings"
	"time"

	"github.com/dheeraj/wasmdee/internal/config"
	wasmrt "github.com/dheeraj/wasmdee/internal/runtime"
	"github.com/dheeraj/wasmdee/internal/state"
	"github.com/spf13/cobra"
)

var (
	serveAddr          string
	serveWorkers       int
	serveMinWorkers    int
	serveMaxWorkers    int
	serveQueueSize     int
	serveInvokeTimeout time.Duration
	servePreload       bool
	serveScaleDown     time.Duration
	serveScaleToZero   time.Duration
)

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the HTTP gateway",
	RunE: func(cmd *cobra.Command, args []string) error {
		engine, err := wasmrt.NewEngine(cmd.Context(), wasmrt.EngineConfig{
			CacheDir:         config.GetCacheDir(),
			ScaleToZeroAfter: serveScaleToZero,
		})
		if err != nil {
			return err
		}
		defer engine.Close(cmd.Context())

		preload := wasmrt.PreloadResult{}
		if servePreload {
			functions, err := state.ListFunctions()
			if err != nil {
				return err
			}
			preload = engine.Preload(cmd.Context(), functions)
			fmt.Fprintf(cmd.OutOrStdout(), "preloaded %d/%d function modules\n", preload.Compiled, preload.Requested)
			for _, failure := range preload.Failed {
				fmt.Fprintf(cmd.ErrOrStderr(), "preload failed for %s: %s\n", failure.Name, failure.Err)
			}
		}

		dispatcher, err := wasmrt.NewDispatcher(engine, wasmrt.DispatcherConfig{
			Workers:        serveWorkers,
			MinWorkers:     serveMinWorkers,
			MaxWorkers:     serveMaxWorkers,
			QueueSize:      serveQueueSize,
			DefaultTimeout: serveInvokeTimeout,
			ScaleDownAfter: serveScaleDown,
		})
		if err != nil {
			return err
		}
		defer dispatcher.Close()

		mux := http.NewServeMux()
		mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
			writeJSON(w, http.StatusOK, map[string]any{
				"status":     "ok",
				"engine":     engine.Stats(),
				"dispatcher": dispatcher.Stats(),
			})
		})
		mux.HandleFunc("GET /runtime", runtimeHandler(engine, dispatcher, func() wasmrt.PreloadResult {
			return preload
		}))
		mux.HandleFunc("GET /functions", listFunctionsHandler)
		mux.HandleFunc("POST /invoke/", invokeHandler(dispatcher))

		server := &http.Server{
			Addr:              serveAddr,
			Handler:           requestLogger(mux),
			ReadHeaderTimeout: 5 * time.Second,
		}

		fmt.Fprintf(cmd.OutOrStdout(), "wasmdee gateway listening on http://%s\n", serveAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			return err
		}
		return nil
	},
}

func init() {
	serveCmd.Flags().StringVar(&serveAddr, "addr", "127.0.0.1:8080", "HTTP gateway listen address")
	serveCmd.Flags().IntVar(&serveWorkers, "workers", max(1, goruntime.NumCPU()*4), "fixed invocation worker count when min/max workers are not set")
	serveCmd.Flags().IntVar(&serveMinWorkers, "min-workers", 0, "minimum invocation workers kept warm")
	serveCmd.Flags().IntVar(&serveMaxWorkers, "max-workers", 0, "maximum invocation workers for local autoscaling")
	serveCmd.Flags().IntVar(&serveQueueSize, "queue-size", 1024, "maximum pending invocations before returning 429")
	serveCmd.Flags().DurationVar(&serveInvokeTimeout, "invoke-timeout", 10*time.Second, "maximum runtime duration per HTTP invocation")
	serveCmd.Flags().BoolVar(&servePreload, "preload", true, "compile deployed functions at gateway startup")
	serveCmd.Flags().DurationVar(&serveScaleDown, "scale-down-after", 30*time.Second, "idle time before extra workers retire")
	serveCmd.Flags().DurationVar(&serveScaleToZero, "scale-to-zero-after", 0, "idle time before compiled modules are evicted from the warm pool; 0 disables eviction")
}

func listFunctionsHandler(w http.ResponseWriter, r *http.Request) {
	functions, err := state.ListFunctions()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, functions)
}

func runtimeHandler(engine *wasmrt.Engine, dispatcher *wasmrt.Dispatcher, preload func() wasmrt.PreloadResult) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"engine":         engine.Stats(),
			"dispatcher":     dispatcher.Stats(),
			"function_stats": dispatcher.FunctionStats(),
			"preload":        preload(),
		})
	}
}

func invokeHandler(dispatcher *wasmrt.Dispatcher) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/invoke/")
		name = strings.Trim(name, "/")
		if name == "" {
			writeError(w, http.StatusBadRequest, fmt.Errorf("missing function name"))
			return
		}

		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 8<<20))
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Errorf("read request body: %w", err))
			return
		}
		defer r.Body.Close()

		fn, err := state.GetFunction(name)
		if err != nil {
			writeError(w, http.StatusNotFound, err)
			return
		}

		result, err := dispatcher.Submit(r.Context(), wasmrt.Invocation{
			Function: fn,
			Stdin:    body,
			Args:     r.URL.Query()["arg"],
		})
		if err != nil {
			switch {
			case errors.Is(err, wasmrt.ErrQueueFull):
				writeError(w, http.StatusTooManyRequests, err)
			case errors.Is(err, wasmrt.ErrDispatcherClosed):
				writeError(w, http.StatusServiceUnavailable, err)
			default:
				writeError(w, http.StatusInternalServerError, err)
			}
			return
		}

		status := http.StatusOK
		if result.ExitCode != 0 {
			status = http.StatusBadGateway
		}
		writeJSON(w, status, map[string]any{
			"name":       fn.Name,
			"stdout":     result.Stdout,
			"stderr":     result.Stderr,
			"exit_code":  result.ExitCode,
			"latency_ms": float64(result.Latency.Microseconds()) / 1000.0,
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if verbose {
			fmt.Printf("%s %s %s\n", r.Method, r.URL.Path, time.Since(start))
		}
	})
}
