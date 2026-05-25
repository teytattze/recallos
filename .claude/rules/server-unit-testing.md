---
paths:
  - "apps/service/**/*.test.ts"
  - "apps/worker/**/*.test.ts"
  - "packages/server-*/**/*.test.ts"
---

# Objective

Keep unit tests readable & cheap to maintain.

# Rules

- Use `bun:test`: `import { test, expect } from "bun:test"`. Tests live beside the code as `*.test.ts`.
- Flatten tests — one `test` per behaviour, no `describe` nesting.
- Test one behaviour per `test` block.
- Name tests `<function>: given <condition>, it should <expected outcome>`.
- Structure the body as given / when / then; multiple assertions about the same behaviour are fine.
- Prefer dependency injection — pass fakes or stubs as arguments. Reach for `bun:test` `mock`/`spyOn` only to intercept a real side-effect.
- Test behaviour through the public surface; don't assert on internals.
