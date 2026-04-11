# CLAUDE.md

## Overview

RecallOS is a semantic code memory system built with Bun and TypeScript. It indexes source code into vector embeddings (VoyageAI), stores them in PostgreSQL with pgvector for similarity search, and tracks indexing state via Drizzle ORM.

- CLI binary: `recallos` (entry: `src/cli.ts`)
- MCP API server: `src/api.ts` (Hono + MCP protocol, single endpoint at `/mcp`)

## Tools

- Prioritize RecallOS MCP server tools while reading/seraching/exploring the codebase

## Commands

```bash
bun install                    # Install dependencies
bun test                       # Run tests
bun test path/to/file.test.ts  # Run a single test file
bun run build:api              # Build API server to bin/
bun run build:cli              # Build CLI to bin/
bun run lint                   # Lint with oxlint
bun run lint:fix               # Lint and auto-fix
bun run fmt                    # Format with oxfmt
bun run fmt:check              # Check formatting
bun run db:generate            # Generate Drizzle migrations
bun run db:migrate             # Run migrations
bun run db:push                # Push schema to database
bun run db:studio              # Open Drizzle Studio
```

### CLI

```bash
bun run src/cli.ts recall <queries...> [-k codebase]   # Semantic search
bun run src/cli.ts index [-i "src/**/*.ts"] [-f]       # Index source files
```

## Architecture

- `src/codebase/query.ts` -- semantic search: embeds queries via VoyageAI, cosine similarity search on pgvector
- `src/codebase/indexing.ts` -- incremental indexing with two-phase writes (pending/complete) and content-hash change detection
- `src/codebase/embed.ts` -- VoyageAI embedding client (voyage-code-3.5, 1024 dimensions)
- `src/codebase/chunker/` -- tree-sitter-based code chunking (TypeScript, Markdown, JSON) with extension-based router
- `src/db/` -- Drizzle ORM schema (codebaseFile, codebaseChunk with pgvector), connection, utilities
- `src/lib/` -- env validation (zod), file loading, gitignore parsing, hashing

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict mode, ESM)
- **Database:** PostgreSQL 18 with pgvector (via `docker-compose.yml`)
- **ORM:** Drizzle ORM
- **HTTP:** Hono
- **Protocol:** MCP (Model Context Protocol)
- **Embeddings:** VoyageAI (voyage-code-3.5)
- **Parsing:** web-tree-sitter (WASM)
- **Linting:** oxlint
- **Formatting:** oxfmt

## Rules

- **Bun only.** Use `bun` for runtime, packages, builds, and scripts. Do not use Node.js, ts-node, npm, webpack, esbuild, vite, or dotenv. Bun auto-loads `.env`.
- **TypeScript strict.** `noUncheckedIndexedAccess: true` — indexed access returns `T | undefined`. Path alias `@/*` maps to `./src/*`.
- **ESM modules.** `"type": "module"` in package.json.

## Reference

- Bun API docs: `node_modules/bun-types/docs/**/*.mdx`
- Drizzle config: `drizzle.config.ts` (schema at `src/db/schema.ts`, migrations at `drizzle/`)
- Environment variables: `VOYAGEAI_API_KEY`, `DATABASE_URL` (validated in `src/lib/env.ts`)
