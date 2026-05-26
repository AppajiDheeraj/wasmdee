# Architecture

`wasmdee` is a single Go binary with a Cobra CLI at `cmd/wasmdee`.

The day-one scaffold keeps the repository intentionally small:

- `cmd/wasmdee` for the CLI entrypoint and subcommands
- `go.mod` for the single-module layout
- `Makefile` and `.github/workflows/ci.yml` for local and CI builds
- `docs/` and `examples/hello/` for the first user-facing material
