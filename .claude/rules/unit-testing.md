---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
---

## Do

- Use `bun:test` (`test`, `expect`, `mock`, `beforeAll`, `afterAll`)
- Co-locate tests: `foo.test.ts` next to `foo.ts`
- Name tests: `functionName: given X, when Y, then Z`
- Use flat `test()` calls — no grouping
- Always mock imported functions via `mock.module()`, import the module **after** the mock
- Define small helper functions at top of file when needed

## Don't

- Don't use Jest, Vitest, or any test runner other than `bun:test`
- Don't use `describe` blocks or nested structure — keep tests flat
- Don't use a real database — mock DB dependencies
- Don't call imported functions without mocking them first
- Don't use snapshot testing
- Don't use `.each()` parameterized tests
- Don't use global test setup files — all setup is inline
- Don't put test fixtures in separate files — create data in helpers or `beforeAll`
- Don't use custom matchers — stick to standard `expect` matchers
