# E2E Server Testing Pattern

## Intent

- Verify client-visible behavior across the running API, worker, database, and external-service boundaries.
- Keep scenarios declarative, isolated, and independent of infrastructure lifecycle.

## Structure

Place each behavior under `tests/e2e-server/src/features/<feature>/`:

- `scenario.spec.ts`: setup hooks, client actions, and observable assertions.
- `scenario-data.ts`: IDs, tenants, payloads, and persisted seed documents.
- Additional helpers only when behavior is reused or obscures the scenario.

Name scenarios `<subject>: <action>, <expectation>`. Describe what the client observes, not internal pipelines or adapters.

## Resource Ownership

- `fixtures/system.ts` initializes and cleans up shared test resources. It exposes resources but owns no scenario data.
- Feature tests seed their own data in `beforeEach` and remove all data they create in `afterEach`.
- `support/` contains stateful test-resource wrappers implementing `E2eResource`; it contains no feature-specific data.
- Testcontainers starts MongoDB and WireMock from the root Compose file and removes them after the worker-scoped fixture.
- API and worker processes remain externally managed; Playwright does not start application processes.

## Test Rules

- Exercise real application entrypoints, adapters, and persistence. Stub only third-party boundaries such as embeddings.
- Use `expect.poll` for eventually consistent worker outcomes; do not add fixed sleeps.
- Assert transport results and client-visible state, not implementation calls.
- Keep execution single-worker while scenarios share a database and reset collections.
- Fail fast when required external endpoints such as `E2E_API_BASE_URL` are absent.

## Verification

- Run `bun run --cwd tests/e2e-server test` with Docker, API, and worker services available.
- Run TypeScript, lint, and formatting checks for every structural change.
