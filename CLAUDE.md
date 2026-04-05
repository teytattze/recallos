# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

recall-os is a Bun-based TypeScript project. Entry point: `index.ts`.

## Commands

```bash
bun install          # Install dependencies
bun run index.ts     # Run the app
bun --hot index.ts   # Run with hot reload (for development)
bun test             # Run tests
bun test path/to/file.test.ts  # Run a single test file
```

## Bun Runtime Rules

Default to Bun for everything. Do not use Node.js equivalents.

- **Runtime:** `bun <file>` not `node`/`ts-node`
- **Packages:** `bun install`, `bun run <script>`, `bunx <pkg>`
- **Build:** `bun build` not webpack/esbuild/vite
- **Env:** Bun auto-loads `.env` — do not use dotenv

### Preferred Bun APIs (do not use the alternatives)

| Use | Instead of |
|-----|-----------|
| `Bun.serve()` (supports routes, WebSockets, HTTPS) | express |
| `bun:sqlite` | better-sqlite3 |
| `Bun.redis` | ioredis |
| `Bun.sql` | pg, postgres.js |
| Built-in `WebSocket` | ws |
| `Bun.file` | node:fs readFile/writeFile |
| `Bun.$\`cmd\`` | execa |

### Testing

Use `bun:test` for imports:
```ts
import { test, expect } from "bun:test";
```

### Frontend

Use HTML imports with `Bun.serve()`, not Vite. HTML files can directly import `.tsx`/`.jsx`/`.js` and Bun bundles automatically. CSS imports work via `<link>` tags or direct JS imports.

### Bun API Reference

Detailed docs available at `node_modules/bun-types/docs/**/*.mdx`.

## TypeScript

- Strict mode enabled
- `noUncheckedIndexedAccess: true` — indexed access returns `T | undefined`
- JSX configured as `react-jsx`
- ESM modules (`"type": "module"` in package.json)
