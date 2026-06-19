# Comments

## Intent

- Make code clear without relying on comments.
- Preserve context that the code cannot express on its own.

## Rules

- Prefer no comment.
- Treat the need for an explanatory comment as a sign that the code may be
  unclear. First refactor names, types, functions, or control flow to make the
  intent explicit.
- Add a comment only when important context cannot be expressed clearly in code.
- Do not describe what the code does or how it does it.
- Do not repeat information already expressed by names, types, signatures, or
  nearby code.
- Write a comment only when it explains non-obvious rationale, such as an
  assumption, invariant, trade-off, compatibility constraint, or gotcha.
- Keep comments concise and close to the code they explain.
- Update or remove a comment when the reason it describes is no longer true.

These rules apply to inline comments, block comments, and docstrings.

## Allowed comments

### Rationale

After attempting to make the code self-explanatory, explain why it must behave
in a way that the code itself cannot express.

```ts
// The provider can deliver an event more than once, so the write must be idempotent.
await eventRepository.saveIfAbsent(event);
```

Do not narrate the implementation.

```ts
// Check whether the event exists before saving it.
if (!(await eventRepository.exists(event.id))) {
  await eventRepository.save(event);
}
```

### TODOs

Use `TODO` for known, actionable follow-up work that cannot be completed in the
current change. State what remains and, when it is not obvious, why it is
deferred.

```ts
// TODO: Remove this fallback after all stored records include a source type.
```

Do not use a TODO as a vague reminder.

```ts
// TODO: Improve this.
```

### Test structure markers

`GIVEN`, `WHEN`, and `THEN` comments are allowed in tests. They separate test
phases and make behavior-focused tests easier to scan.

```ts
// GIVEN
const event = createEvent();

// WHEN
const result = await ingestEvent(event);

// THEN
expect(result.isOk()).toBe(true);
```

Use these markers consistently within a test file. Do not add prose that merely
restates the setup, action, or assertion.

## Review checklist

Before keeping a comment, ask:

- Can the code be refactored to make this comment unnecessary?
- Would a reader lose important context if this comment were removed?
- Does it explain why rather than what or how?
- Is the information absent from the code and its types?
- Is it still accurate and as concise as possible?
- If it is a TODO, is the follow-up concrete?
