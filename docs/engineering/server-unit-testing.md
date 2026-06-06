# Unit Testing Pattern

## Intent

- Keep unit tests readable and cheap.

## Pattern

- Use `bun:test`: `import { test, expect } from "bun:test"`.
- Keep tests beside the code as `*.test.ts`.
- Use one `test` per behavior; avoid `describe` nesting.
- Test behavior through the public surface.
- Use dependency injection with fakes or stubs.
- Use `mock`/`spyOn` only to intercept real side effects.

## Conventions

- Name tests `<function>: given <condition>, it should <expected outcome>`.
- Structure the body as given / when / then; multiple assertions about one behavior are fine.
- Consolidate similar behavior with `test.each` instead of repeating blocks.
