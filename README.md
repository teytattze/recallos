# RecallOS

Semantic code memory system. Index source code into vector embeddings and search over them with natural language.

## Setup

### Prerequisites

- [Bun](https://bun.sh) v1.3.5+
- Docker (for PostgreSQL + pgvector)
- [VoyageAI](https://voyageai.com) API key

### Install

```bash
cp .env.example .env          # fill in VOYAGEAI_API_KEY and DATABASE_URL
docker compose up -d           # start PostgreSQL with pgvector
bun install                    # install dependencies
bun run db:push                # apply database schema
```

## Usage

### Index

```bash
bun run src/cli.ts index                    # index all files (incremental)
bun run src/cli.ts index -i "src/**/*.ts"   # index specific glob
bun run src/cli.ts index -f                 # force full re-index
```

### Search

```bash
bun run src/cli.ts recall "how does auth work"
bun run src/cli.ts recall "error handling" "retry logic"
```

### MCP Server

```bash
bun run src/api.ts   # starts HTTP server with /mcp endpoint
```
