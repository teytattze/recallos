# Decision Record Pattern

## Intent

- Keep durable, objective records of committed engineering decisions.
- Separate decided outcomes from exploratory write-ups in `docs/`.

## Pattern

- Record why the decision follows, not only what was chosen.
- Capture the committed decision only.
- Exclude future, speculative, or conditional decisions.
- State trade-offs and rejected alternatives objectively.

## Conventions

- Follow [`decision-records/template.md`](../../decision-records/template.md).
- Name files `<YYYYMMDD>-<title>.md` (e.g. `20260523-result-vs-throw.md`); `template.md` is exempt.
- Use concise point-form.
- Do not reference `@docs/`.
