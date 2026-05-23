# RecallOS — Securing the Public HTTP API (Solutions + Auth-Provider Trade-offs)

The `Service` (`apps/service/src/index.ts`) is about to face the public internet. Today it is a bare Hono-on-Bun app with **one** route — `GET /api/v1/health` — and **no** auth, CORS, rate limiting, input validation, or security headers. Deployment is **AWS-bound** (CI builds and pushes to ECR; the container listens on `:8000`). Bias, mirroring `database-tradeoffs.md`: **start lean, AWS-managed first, low lock-in, graduate by evidence.** Captures the state of vendor offerings as of **2026-05**; see *Verify-before-build*, because auth pricing and feature scope shift constantly.

---

## 1. What we're securing

Per `docs/diagrams/architecture.excalidraw`, the Service has **three entry-point shapes**, each with a different threat model — so "secure the API" is not one decision:

| Entry point | Flow | Caller | Right credential | What breaks if unsecured |
|---|---|---|---|---|
| **Client API** | `Client <-> Service` (read recall) | **Humans** (future console) + **AI agents** | Session/JWT for humans; **API key / M2M token** for agents | Anyone reads the entire org memory |
| **Webhook ingest** | `External --webhook--> Service --write-->` | External systems | **HMAC signature** + replay protection | Anyone forges/poisons memory; injection into RAG |
| **Internal** | `Service <-> Worker / DBs` | Own services | M2M token / network policy | Lateral movement |

**Decision drivers** (consistent with the database doc):

- **AWS-bound deployment** → prefer AWS-managed edge controls; keep app data in-account.
- **Greenfield, small team, no auth layer yet** → operational simplicity matters most *now*.
- **B2B "organizational memory"** → enterprise buyers *will* demand SSO/SCIM and audit logs.
- **Agents dominate traffic** — the product axiom is "AI agents always start with fresh context," so the hot path is non-interactive machine calls, **not** human logins. *Per-MAU pricing is therefore a poor fit.*
- **No frontend exists yet** → prebuilt login-UI components (a major vendor selling point) have little value today.

---

## 2. Defense in depth — the layered solutions

An auth vendor only covers **L2/L3** below. L0, L1, L4, and webhook signing are RecallOS's responsibility **regardless of which provider is chosen** — so evaluate them first.

### L0 — AWS edge (network perimeter)
- Terminate TLS at an **ALB** or **API Gateway** in front of the ECS task; never expose `:8000` directly.
- **AWS WAF** with managed rule groups + **rate-based rules** (cheap, provider-agnostic L7 rate limiting / DDoS absorption); **AWS Shield** for volumetric DDoS.
- Tight **security groups** (only the load balancer reaches the task); optional **CloudFront** in front for caching + edge ACLs.
- **Webhook source-IP allowlisting** where the sending provider publishes IP ranges (defense in depth on top of HMAC).

### L1 — Hono middleware hardening (built-ins; no new dependencies)
All shipped with Hono, so this is the cheapest, fastest win:
- `hono/secure-headers` — HSTS, `X-Content-Type-Options`, frame/`CSP` defaults.
- `hono/cors` — **strict origin allowlist** (not `*`), only for browser callers.
- `hono/body-limit` — cap request size to blunt resource-exhaustion.
- `hono/request-id` + `hono/logger` → **`pino`** (already in the catalog) for correlatable, structured audit logs.
- **`zod`** (already in the catalog) — validate/parse every body, query, and header at the boundary; reject unknown content types.
- Per-principal **app-level rate limiting** (per API key / org), complementing WAF's per-IP limits.

### L2 — Authentication, by caller type
The single most important framing: **don't pick one mechanism for all callers.**
- **Humans (interactive):** session or short-lived JWT; **SSO (OIDC/SAML)** for B2B tenants.
- **AI agents / services (non-interactive, the hot path):** **API keys** (hashed at rest, org-scoped, scoped to read vs ingest, rotatable) **or** **M2M OAuth client-credentials** issuing short-lived JWTs. Verify with `hono/bearer-auth` / `hono/jwt`.
- **Webhook ingest:** **HMAC signature verification** over the raw body + a **timestamp/nonce** to prevent replay. ⚠️ **None of WorkOS, Clerk, or Better Auth solve inbound-webhook signing** — this is hand-rolled (or per-sender) no matter what you pick in §3.

### L3 — Authorization & multi-tenancy
- Every authenticated request resolves to an **`org_id`**; this is the tenancy boundary for RecallOS's "organizational memory."
- Enforce org scoping **in Aurora Postgres** — row scoping or **RLS** — so a bug in app code can't cross tenants.
- **RBAC + per-key scopes** (e.g. an ingest webhook key can write but not read recall).

### L4 — Secrets & key management
- Store DB creds, signing secrets, and provider keys in **AWS Secrets Manager / SSM Parameter Store**; inject at runtime, never bake into the image.
- **Rotate** keys; **hash API keys** (argon2 or HMAC) at rest — store only the hash; never log secrets or full tokens.

> Layers L0, L1, L4, and webhook HMAC are **table stakes** and largely free. The remaining choice is *who runs L2/L3* — the subject of §3.

---

## 3. The decision: WorkOS vs Clerk vs Better Auth

Scored against what actually matters for RecallOS (headless, AWS-bound, agent-dominated, B2B).

| Dimension | **WorkOS** | **Clerk** | **Better Auth** |
|---|---|---|---|
| Model | SaaS (API + AuthKit) | SaaS (frontend-first) | **OSS library, self-hosted** |
| Stack fit (TS/Bun/Hono/PG) | Backend-agnostic Node SDK/API | React/Next-centric; usable headless but value lost | **Native** — TS-first, official Hono integration, your Postgres |
| Human auth | AuthKit hosted login, SSO | Best-in-class prebuilt UI, MFA, passkeys | Email/social/passkey/MFA via plugins (you wire UI) |
| **M2M / agent auth** | **API Keys + OAuth client-credentials M2M Apps** | M2M tokens (GA Oct 2025), opaque or JWT | **API key plugin** (incl. org-owned keys) + JWT/bearer |
| Orgs / multi-tenancy | First-class Organizations | Organizations (priced per MAO) | Organization plugin (+ org-scoped API keys) |
| Enterprise SSO + SCIM | **Strongest** — core product, Admin Portal, Directory Sync | SAML/OIDC from Pro; add-ons for more | SSO (OIDC/OAuth2/SAML 2.0) + SCIM plugins (younger) |
| Audit logs / compliance | Managed audit logs; vendor carries certs | Audit logs via add-on; vendor carries certs | **You build & certify** (your SOC2, your logs) |
| Data residency | In WorkOS | In Clerk | **In your Aurora — nothing leaves AWS** |
| Pricing model | AuthKit free to **1M MAU**, then ~$2,500/1M; SSO **$125/connection/mo**; SCIM $125/dir/mo | Free to **50k MAU**; Pro $25 + **$0.02/MAU**; **$1/MAO**; $100/mo add-ons | **Free (MIT)** — pay only your infra + ops |
| Fit for *agent-dominated* traffic | MAU-priced human auth is free to 1M; M2M separate | **MAU/MAO pricing misaligned** with machine calls | **No per-call/per-seat cost** |
| Lock-in | Medium (SaaS) | Medium–High (SaaS + UI coupling) | **Low** (your code, your DB) |
| Ops burden | Low | Low | **High** (you run, patch, secure it) |
| Maturity | Mature, enterprise-proven | Mature, large ecosystem | ~27k★, ~2yr, YC-backed; newer |

**Why / when each fits**

- **WorkOS** — buy this to *offload enterprise readiness*: SSO, SCIM/Directory Sync, Admin Portal, and audit logs are the core product, and AuthKit is free to 1M MAU. Best when a B2B contract demands SSO + compliance and you'd rather not build/certify it. Cost accrues per enterprise connection — which you can pass through to enterprise customers.
- **Clerk** — buy this for a *polished human frontend fast*. Its value is React/Next components and consumer-auth DX. For RecallOS that value is **largely wasted today** (no frontend), and **MAU/MAO pricing fights an agent-dominated workload**. Revisit only if a rich human console becomes central.
- **Better Auth** — adopt this for *native stack fit and control*: TypeScript, an official Hono integration, runs inside your Aurora (nothing leaves AWS), MIT-licensed/free, with organization + API-key plugins that map cleanly onto "org-scoped agent keys." The cost is **operational** — you run it, patch it, and own compliance; SSO/SCIM plugins are younger than WorkOS's managed equivalents.

---

## 4. Recommendation for RecallOS today

**Start lean, graduate by evidence** — the same posture as the database doc, and for the same reasons (AWS-bound, low lock-in, small team).

**Phase 0 (now): Better Auth + the layered hardening.**
- **Better Auth** in Aurora Postgres — `organization` plugin for tenancy, `apiKey` plugin (org-scoped) for the dominant **agent** traffic, `jwt`/`bearer` for verification.
- Plus **L0** (ALB + WAF rate rules), **L1** (Hono `secure-headers`/`cors`/`body-limit`/`zod`/`pino`), **webhook HMAC** (§L2), **L3** org scoping in Postgres, **L4** Secrets Manager.
- *Why:* native stack fit; **free**; data stays in AWS (consistent with the DB doc's bias); first-class API keys for the agent-dominated path with **no per-MAU/per-connection cost**; and Clerk's UI advantage is moot with no frontend.

**Phase 1 — graduate to WorkOS when (and only when) enterprise sales require it.**
- *Trigger:* a signed contract demands **SAML SSO + SCIM provisioning + audit-log/compliance** guarantees you don't want to build or certify yourself.
- WorkOS can sit **alongside** Better Auth — federate enterprise SSO connections through it while Better Auth keeps owning sessions, orgs, and agent API keys — rather than a rip-and-replace. AuthKit's 1M-MAU free tier means the cost is essentially per enterprise connection (passed through to enterprise customers).

**Deprioritize Clerk** for RecallOS specifically: headless API + agent-dominated + MAU/MAO pricing is the wrong shape. Reconsider only if a consumer-grade human console becomes a first-order product surface.

Keep auth behind a thin interface (a Hono middleware that resolves `request → {org_id, scopes}`), so the L2/L3 provider can be swapped per the triggers above without touching business logic — the same "repository interface" discipline the DB doc recommends.

---

## Verify-before-build

- **WorkOS:** AuthKit free to **1M MAU**, then ~**$2,500/mo per additional 1M**; **Enterprise SSO $125/connection/mo** (volume discounts to ~$65); **Directory Sync/SCIM $125/directory/mo**; custom domains $99/mo. Two distinct machine models — long-lived org-scoped **API Keys** *and* OAuth-client-credentials **M2M Applications**. Confirm current numbers and which M2M model you need.
- **Clerk:** free to **50k MAU**; Pro **$25/mo** then **$0.02/MAU**; **$1/MAO** after 100; MFA/enterprise-SSO and audit-logs/impersonation are **$100/mo add-ons**. **M2M tokens went GA 2025-10**. Re-check tier inclusions — they changed in 2026.
- **Better Auth:** MIT, **free**, self-hosted (~27k★, ~2yr old, YC-backed). SSO (SAML 2.0)/SCIM exist as plugins but are **younger** than WorkOS's managed equivalents — validate them before betting an enterprise deal on them. A managed **"Better Auth Infrastructure"** (hosted dashboard, audit logs, self-service SSO UI) is **new/evolving** — confirm scope/pricing if you'd offload ops.
- **Webhook signing is on you** regardless of vendor — none of the three verify *inbound* webhook signatures.
- Pricing/feature scope for all three drifts quarterly — confirm against the live pages below before committing.

## Sources

- [WorkOS Pricing](https://workos.com/pricing)
- [WorkOS — API Keys vs M2M Applications](https://workos.com/blog/api-keys-vs-m2m-applications)
- [WorkOS Docs — M2M Applications (AuthKit)](https://workos.com/docs/authkit/connect/m2m)
- [WorkOS Docs — API Keys](https://workos.com/docs/reference/authkit/api-keys)
- [Clerk Pricing](https://clerk.com/pricing)
- [Clerk — M2M Tokens General Availability (2025-10-14)](https://clerk.com/changelog/2025-10-14-m2m-ga)
- [Clerk Docs — Using M2M tokens](https://clerk.com/docs/guides/development/machine-auth/m2m-tokens)
- [Better Auth](https://better-auth.com/)
- [Better Auth — Single Sign-On (SSO) plugin](https://better-auth.com/docs/plugins/sso)
- [Better Auth 1.5 release notes](https://better-auth.com/blog/1-5)
- [Better Auth — Hono integration example](https://hono.dev/examples/better-auth)
- [Better Auth on GitHub](https://github.com/better-auth/better-auth)
