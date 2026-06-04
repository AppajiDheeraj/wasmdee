# wasmdee Documentation

Public documentation for the wasmdee serverless Wasm runtime, powered by [Mintlify](https://mintlify.com).

## Local Development

Install the Mintlify CLI and run a local preview:

```bash
npm i -g mint
cd docs/documentation
mint dev
```

View at `http://localhost:3000`.

## Structure

```
docs/documentation/
├── index.mdx              # Landing page
├── quickstart.mdx         # Getting started guide
├── concepts.mdx           # Core concepts and runtime model
├── cli/                   # CLI command reference
│   ├── deploy.mdx
│   ├── invoke.mdx
│   ├── serve.mdx
│   ├── bench.mdx
│   └── list.mdx
├── architecture/          # Architecture deep dives
│   ├── overview.mdx
│   ├── runtime.mdx
│   ├── dispatcher.mdx
│   └── telemetry.mdx
├── guides/                # How-to guides
│   ├── writing-functions.mdx
│   ├── benchmarking.mdx
│   └── configuration.mdx
└── api-reference/         # HTTP gateway API
    ├── introduction.mdx
    ├── invoke.mdx
    ├── functions.mdx
    ├── runtime.mdx
    └── healthz.mdx
```

## Publishing

Push to the default branch. The Mintlify GitHub app auto-deploys changes.
