# Unit Testing Pattern

## Intent

- Keep unit tests readable and cheap to maintain.

## Pattern

- Use `bun:test`: `import { test, expect } from "bun:test"`.
- Keep tests beside the code as `*.test.ts`.
- Use one `test` per behavior; avoid `describe` nesting.
- Test behavior through the public surface.
- Prefer dependency injection with fakes or stubs.
- Use `bun:test` `mock`/`spyOn` only to intercept a real side-effect.

## Conventions

- Name tests `<function>: given <condition>, it should <expected outcome>`.
- Structure the body as given / when / then; multiple assertions about the same behaviour are fine.
- Consolidate similar-behaviour tests into a single `test` block (e.g. via `test.each`) rather than repeating near-identical blocks.
