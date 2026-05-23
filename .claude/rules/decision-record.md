---
paths:
  - "decision-records/**/*.md"
---

# Goal

Keep a durable, objective record of the decisions engineers make — the committed outcome and its reasoning — separate from the write-ups in `docs/`.

# Rules

- Reason from first principles; record _why_ the decision follows, not just what was chosen.
- Record only the decision committed to now — exclude future, speculative, or conditional decisions.
- Be objective — state trade-offs and rejected alternatives without bias.
- Follow [`decision-records/template.md`](../../decision-records/template.md).
- Name files `<YYYYMMDD>-<title>.md` (e.g. `20260523-result-vs-throw.md`); `template.md` is exempt.
- Use point-form to keep things _concise_.
- Do not reference `@docs/`
