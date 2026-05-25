---
paths:
  - "apps/service/src/inbound/**/*"
  - "apps/worker/src/inbound/**/*"
---

# Rules: Inbound adapters (driving)

- Contains: translation of HTTP/cron/queue into inbound-port calls; transport-input validation.
- May depend on: @repo/server-<context>, @repo/server-platform, hono.
- Must NOT contain: business rules.
- Apps stay thin (inbound adapters + composition root only) and never import each other.
