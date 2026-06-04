# Requirements Document

## Introduction

Phase 1 of the wasmdee Wasm serverless runtime CLI ("wrun") delivers the core deploy-and-invoke loop. Users compile a `.wasm` binary, deploy it to the local wasmdee registry, and invoke it by name — all from the existing `wasmdee` CLI binary. The runtime uses wazero (pure Go, zero CGo) for compilation and instantiation, the existing SQLite registry for function metadata, and an OS-aware artifact store for compiled modules. WASI capabilities follow a deny-all-by-default model with explicit opt-in flags.

## Glossary

- **CLI**: The `wasmdee` command-line binary built from `cmd/wasmdee`
- **Runtime_Engine**: The wazero-based WebAssembly compilation and instantiation engine in `internal/runtime/`
- **Artifact_Store**: The on-disk cache of compiled Wasm modules located at `{WasmdeeDir}/store/{sha256-hash}`, managed by `internal/store/`
- **Function_Registry**: The SQLite database (managed by `internal/state/`) that stores function name-to-artifact mappings and metadata
- **Wasm_Module**: A valid WebAssembly binary file with a `.wasm` extension
- **Compiled_Module**: The platform-specific compiled representation of a Wasm_Module produced by wazero
- **Function_Name**: The unique identifier derived from the Wasm_Module filename (without extension) used to register and invoke a function
- **WASI**: WebAssembly System Interface — the standard set of system call bindings for Wasm modules
- **WasmdeeDir**: The OS-aware application data directory returned by `config.GetWasmdeeDir()`

## Requirements

### Requirement 1: Package Structure

**User Story:** As a developer, I want the runtime and store packages to exist in the repository, so that the codebase has clear separation of concerns for Wasm execution and artifact management.

#### Acceptance Criteria

1. THE CLI project SHALL contain an `internal/runtime/` package that exports a public API for Wasm compilation and instantiation.
2. THE CLI project SHALL contain an `internal/store/` package that exports a public API for writing and reading compiled artifacts.
3. THE CLI project SHALL declare `github.com/tetratelabs/wazero` as a dependency in `go.mod`.
4. THE CLI project SHALL compile without CGo (pure Go only) when built via `make build`.

### Requirement 2: Wazero Engine Integration

**User Story:** As the runtime, I want to compile Wasm binaries into reusable compiled modules, so that repeated invocations avoid redundant compilation overhead.

#### Acceptance Criteria

1. WHEN the Runtime_Engine receives a valid Wasm_Module binary, THE Runtime_Engine SHALL compile the Wasm_Module into a Compiled_Module using wazero's ahead-of-time compilation.
2. WHEN a Compiled_Module for a given SHA-256 hash already exists in the Artifact_Store, THE Runtime_Engine SHALL reuse the existing Compiled_Module instead of recompiling.
3. THE Runtime_Engine SHALL support instantiating multiple concurrent instances from a single Compiled_Module.
4. IF the Wasm_Module binary is invalid or malformed, THEN THE Runtime_Engine SHALL return a descriptive error indicating the validation failure.
5. THE Runtime_Engine SHALL operate without CGo dependencies — the build SHALL succeed with `CGO_ENABLED=0`.

### Requirement 3: Artifact Storage

**User Story:** As the system, I want compiled modules persisted to disk keyed by content hash, so that deployments are idempotent and compilations survive process restarts.

#### Acceptance Criteria

1. WHEN a Compiled_Module is produced, THE Artifact_Store SHALL write the compiled bytes to the path `{WasmdeeDir}/store/{sha256-hash}`.
2. THE Artifact_Store SHALL compute the SHA-256 hash from the original raw Wasm_Module bytes (not the compiled output).
3. WHEN a compiled artifact file already exists at the target path, THE Artifact_Store SHALL skip the write and return success.
4. WHEN the Artifact_Store directory does not exist, THE Artifact_Store SHALL create the directory with permissions `0755` before writing.
5. IF a write operation fails due to disk error, THEN THE Artifact_Store SHALL return an error that includes the target path and the underlying OS error.

### Requirement 4: Deploy Command

**User Story:** As a user, I want to deploy a `.wasm` file so that it is compiled, stored, and registered for later invocation.

#### Acceptance Criteria

1. WHEN the user runs `wasmdee deploy <file.wasm>`, THE CLI SHALL read the Wasm_Module from the specified file path.
2. WHEN the Wasm_Module is read successfully, THE CLI SHALL compile the Wasm_Module via the Runtime_Engine.
3. WHEN compilation succeeds, THE CLI SHALL persist the Compiled_Module via the Artifact_Store.
4. WHEN storage succeeds, THE CLI SHALL register the function in the Function_Registry with the Function_Name (filename stem without `.wasm` extension), the SHA-256 hash, and the current Unix timestamp.
5. WHEN registration succeeds, THE CLI SHALL print a confirmation message to stdout that includes the Function_Name and the SHA-256 hash.
6. IF the specified file does not exist or is not readable, THEN THE CLI SHALL print an error message to stderr and exit with a non-zero status code.
7. IF compilation fails, THEN THE CLI SHALL print the compilation error to stderr and exit with a non-zero status code.
8. WHEN a function with the same Function_Name already exists in the Function_Registry, THE CLI SHALL update the existing registry entry with the new SHA-256 hash and timestamp.

### Requirement 5: Invoke Command

**User Story:** As a user, I want to invoke a deployed function by name so that I can execute the Wasm binary and observe its output.

#### Acceptance Criteria

1. WHEN the user runs `wasmdee invoke <name>`, THE CLI SHALL look up the Function_Name in the Function_Registry.
2. WHEN the function is found, THE CLI SHALL load the Compiled_Module from the Artifact_Store using the registered SHA-256 hash.
3. WHEN the Compiled_Module is loaded, THE CLI SHALL instantiate the module with WASI bindings via the Runtime_Engine.
4. WHEN instantiation succeeds, THE CLI SHALL call the `_start` exported function on the module instance.
5. THE CLI SHALL capture the module's stdout output and print the output to the CLI's stdout.
6. THE CLI SHALL capture the module's stderr output and print the output to the CLI's stderr.
7. IF the Function_Name is not found in the Function_Registry, THEN THE CLI SHALL print an error message to stderr indicating the function is not deployed and exit with a non-zero status code.
8. IF the compiled artifact file is missing from the Artifact_Store, THEN THE CLI SHALL print an error message to stderr and exit with a non-zero status code.
9. IF the module execution returns a non-zero exit code, THEN THE CLI SHALL exit with that same exit code.

### Requirement 6: WASI Capability Control

**User Story:** As a user, I want the runtime to deny filesystem and network access by default and let me opt in selectively, so that I can run untrusted modules safely.

#### Acceptance Criteria

1. THE Runtime_Engine SHALL provide WASI bindings with stdin, stdout, and stderr connected to the host process streams by default.
2. THE Runtime_Engine SHALL deny all filesystem directory access to the Wasm module by default (no pre-opened directories).
3. THE Runtime_Engine SHALL deny all network access to the Wasm module by default.
4. WHEN the user passes `--allow-dir=<path>` to the invoke command, THE Runtime_Engine SHALL pre-open the specified host directory as a WASI filesystem mount accessible to the module.
5. WHEN the user passes multiple `--allow-dir` flags, THE Runtime_Engine SHALL pre-open each specified directory.
6. WHEN the user passes `--allow-env=<VAR>` to the invoke command, THE Runtime_Engine SHALL expose the specified host environment variable to the module.
7. WHEN the user passes multiple `--allow-env` flags, THE Runtime_Engine SHALL expose each specified environment variable to the module.
8. IF a path specified in `--allow-dir` does not exist on the host, THEN THE CLI SHALL print an error message to stderr and exit with a non-zero status code.

### Requirement 7: Function Registry Schema

**User Story:** As the system, I want the function registry to store sufficient metadata per deployment, so that invoke can locate the correct compiled artifact.

#### Acceptance Criteria

1. THE Function_Registry SHALL store the following fields for each deployed function: Function_Name (primary key), SHA-256 hash of the original Wasm bytes, and a created-at Unix timestamp.
2. THE Function_Registry SHALL enforce uniqueness on Function_Name as the primary key.
3. WHEN a deploy overwrites an existing Function_Name, THE Function_Registry SHALL update the SHA-256 hash and timestamp in a single atomic transaction.
4. THE Function_Registry SHALL use the existing SQLite database file at `{WasmdeeDir}/state/wasmdee.db`.

### Requirement 8: CLI UX Consistency

**User Story:** As a user, I want deploy and invoke commands to follow standard CLI conventions, so that I can integrate wasmdee into scripts and pipelines reliably.

#### Acceptance Criteria

1. THE CLI SHALL exit with status code 0 on successful deploy operations.
2. THE CLI SHALL exit with status code 0 on successful invoke operations where the module exits cleanly.
3. THE CLI SHALL write all diagnostic and error messages to stderr, keeping stdout reserved for command output.
4. THE CLI SHALL support the existing `--verbose` / `-v` global flag to enable detailed debug logging during deploy and invoke.
5. WHEN the `--verbose` flag is set, THE CLI SHALL log compilation timing, artifact paths, and registry operations to stderr.
