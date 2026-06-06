---
name: comments-clean-up
description: >-
  Review and tighten comments/docstrings touched by the current branch only.
  Use this when the user asks to clean up, trim, audit, review, or tidy comments,
  especially when they say comments are verbose, stale, redundant, or restate the
  code. Keep the pass branch-diff scoped, remove or compress low-value comments,
  fix stale comment text, and edit only comments/blank lines.
---

# Comments Clean-Up

Clean up only comments/docstrings that are part of the current branch changes.
Do not scan or rewrite untouched repo comments just because they look weak.

## Workflow

1. Find the branch scope before editing.
   - Use the user's base ref when provided.
   - Otherwise use `@{upstream}` if it exists.
   - Otherwise use the current local staged/unstaged diff.
2. Inspect only changed comment/docstring lines in that scope.
3. Edit only comment and blank lines. Never change runtime code, imports, types,
   tests, snapshots, or formatting outside comments.
4. Keep a comment only when it explains non-obvious rationale: an invariant,
   boundary, trade-off, gotcha, compatibility constraint, or stale-but-needed
   context.
5. Preserve test structure markers such as `// GIVEN`, `// WHEN`, `// THEN`, when
   the surrounding test file uses that style. These markers make test phases
   scan-friendly and are not low-value comments.
6. Cut or compress comments that restate names/signatures, explain obvious code,
   duplicate nearby context, include generic usage examples, or define concepts
   the type/API already makes clear.
7. Fix stale comment text when the branch changed the behavior it describes.

## Defaults

- Prefer no comment over a decorative or restating comment.
- Keep usage examples only when they document non-obvious behavior or prevent misuse.
- Keep conceptual prose only as a concise contract or rationale.
- Keep established given/when/then test phase markers.
- Match the surrounding comment style when a keeper remains.

## Verify

Confirm the final diff changes only comments/blank lines in the branch scope:

```bash
git diff -U0 -- <scope> | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' \
  | grep -vE '^[+-][[:space:]]*(//|/\*\*?|\*|\*/|$)'
```

The command should print nothing. If non-comment changes appear, undo your own
non-comment edits. Report what was removed, what was kept, and any stale comments
you corrected.
