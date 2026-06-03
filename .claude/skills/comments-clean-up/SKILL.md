---
name: comments-clean-up
description: >-
  Review and refine code comments and docstrings so they explain *why*, not
  *what*, and stay concise. Use this whenever the user asks to clean up, review,
  refine, trim, audit, or tidy comments or docstrings — or says comments are
  verbose, redundant, outdated, or just restate the code — even if they don't say
  "skill". Removes redundant/restating comments and usage examples, cuts
  conceptual prose down to non-obvious rationale, and fixes stale comments,
  touching only comment lines.
---

# Comments Clean-Up

Refine comments so each one earns its place: it explains _why_ the code is the way
it is — a non-obvious invariant, a boundary, a trade-off, a gotcha — not _what_ the
code plainly already says. Redundant and stale comments rot; a reader trusts a
sparse, accurate comment more than a verbose one that restates the signature.

## 1. Set the bar before editing

Find the project's comment convention first (`AGENTS.md`/`AGENTS.md`,
`CONTRIBUTING.md`, lint rules) and follow it. Absent one, default to: _comments
explain why, not what; add one only when the reasoning isn't obvious from the code._

Two judgment calls decide how aggressive the pass is — confirm them with the user
before touching files, because reasonable codebases differ:

- **Usage examples** in docstrings (` ```ts ` blocks etc.) — keep, trim, or remove?
- **Conceptual prose** defining what a type _is_ — keep a one-line contract, or cut
  to design rationale only?

## 2. Classify each comment

| Keep (trim to essentials)                                      | Cut                                              |
| -------------------------------------------------------------- | ------------------------------------------------ |
| Non-obvious invariant or precondition                          | Restates the name/signature ("Gets the user")    |
| Why a boundary/port exists, a trade-off, a road not taken      | Conceptual definition obvious from the type      |
| Surprising behavior (drain-once, short-circuits, never throws) | Redundant overview blocks already covered nearby |
| A warning/gotcha that prevents a bug                           | Usage examples — per the user's call in step 1   |

When trimming a keeper: one tight sentence per idea, drop filler, keep the
load-bearing word. Match the surrounding style (voice, `{@link}`/`@param`, density).

## 3. Edit surgically

Change only comment and blank lines — never logic. Then verify nothing else moved:
a diff of non-comment, non-blank changed lines should be empty, e.g.

    git diff -U0 -- <scope> | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' \
      | grep -vE '^[+-][[:space:]]*(\*|/\*\*|\*/|//)' | grep -vE '^[+-][[:space:]]*$'

Stay inside the requested scope. If unrelated changes appear in the diff (e.g. from a
repo-wide formatter), surface them — don't silently fold them into your work.

## 4. Fix stale comments you find

A comment that contradicts the code is worse than none. If you hit one while trimming
(a wrong method name, an outdated claim), correct it as part of the pass and call it
out — don't preserve the inaccuracy.

## 5. Verify

Run the project's own checks (detect them — commonly `fmt`/`lint`/`test` scripts in
`package.json`, a `Makefile`, etc.) so reflowed comments are well-formatted and
`{@link}`/doc references still resolve. Tests should stay green; your edits are
comment-only, so any failure is unexpected and worth investigating. Report what you
removed, what you kept and why, and any stale comment you corrected.
