# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RecallOS is a semantic code memory system built with Bun and TypeScript. It indexes source code into vector embeddings (VoyageAI), stores them in ChromaDB for similarity search, and tracks indexing state in MongoDB.

- CLI binary: `recallos` (entry: `src/cli.ts`)
- MCP API server: `src/api.ts` (Hono + MCP protocol, single endpoint at `/mcp`)

## Commands

```bash
bun install                    # Install dependencies
bun test                       # Run tests
bun test path/to/file.test.ts  # Run a single test file
bun run build:api              # Build API server to dist/
bun run lint                   # Lint with oxlint
bun run lint:fix               # Lint and auto-fix
bun run fmt                    # Format with oxfmt
bun run fmt:check              # Check formatting
```

### CLI

```bash
bun run src/cli.ts recall <queries...> [-k codebase]     # Semantic search over indexed memory
bun run src/cli.ts index [-i "src/**/*.ts"] [-f]     # Index source files (incremental by default)
```

## Architecture

- `src/memory/` -- memory adapters implementing `MemoryAdapter` interface. Code memory is implemented; docs, conversation, and knowledge are stubs.
- `src/memory/chunker/` -- tree-sitter-based code chunking (TypeScript implemented, Markdown is a stub)
- `src/indexing/` -- incremental indexing with two-phase writes (pending/complete) and MongoDB state tracking
- `src/lib/` -- shared clients (ChromaDB, VoyageAI, MongoDB), env validation, utilities

## External Services

Configured via `.env`:

- **ChromaDB** -- vector database for code embeddings
- **VoyageAI** -- embedding model (`voyage-code-3.5`)
- **MongoDB** -- index state tracking (collection: `index_state`)

## Bun Runtime Rules

Default to Bun for everything. Do not use Node.js equivalents.

- **Runtime:** `bun <file>` not `node`/`ts-node`
- **Packages:** `bun install`, `bun run <script>`, `bunx <pkg>`
- **Build:** `bun build` not webpack/esbuild/vite
- **Env:** Bun auto-loads `.env` — do not use dotenv

### Bun API Reference

Detailed docs available at `node_modules/bun-types/docs/**/*.mdx`.

## TypeScript

- Strict mode enabled
- `noUncheckedIndexedAccess: true` -- indexed access returns `T | undefined`
- JSX configured as `react-jsx`
- ESM modules (`"type": "module"` in package.json)
- Path alias: `@/*` maps to `./src/*`
