# App-owned runtime configuration

- **Status:** Accepted
- **Date:** 20260619
- **Deciders:** RecallOS maintainers
- **Scope:** Server application runtimes and their adapters

---

## Context

- Runtime configuration was split across platform, inbound-adapter, and
  outbound-adapter packages.
- Those packages read environment variables directly, hiding each deployable's
  complete runtime contract from its composition root.
- Each deployable needs environment-specific defaults without committing
  credentials or relying on configuration files absent from its build artifact.

## Decision

> Each server app owns and validates its complete runtime configuration with
> Convict before wiring adapters.

- Schemas use `app` and bounded-context namespaces.
- Apps statically import committed `local`, `staging`, and `production` profile
  overlays so Bun includes them in the build artifact.
- Precedence is schema defaults, selected profile, then environment variables.
- Validation is strict and occurs once during startup.
- Composition roots pass typed configuration values to adapters; packages do
  not read runtime environment variables.
- Schemas may duplicate fields across apps because every deployable owns an
  independently validated contract.

## Consequences

- **Positive:** A deployable's schema describes its complete configuration and
  invalid configuration fails before the service starts.
- **Positive:** Core, adapter, and platform packages remain independent of
  deployment configuration sources.
- **Trade-offs:** Shared settings are repeated between app schemas and profiles.
- **Trade-offs:** Adding a setting used by multiple deployables requires updating
  each deployable's contract.

## Alternatives considered

- **Platform-owned schema** — reduces duplication but couples platform to every
  deployable and obscures app-specific requirements.
- **Adapter-owned schema fragments** — colocates settings with technology but
  lets adapters control configuration sources and validation timing.
- **Runtime profile files** — supports external overlays but requires additional
  artifact and deployment file management.
