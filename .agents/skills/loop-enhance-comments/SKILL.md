---
name: loop-enhance-comments
description: >-
  Explicitly invoked multi-agent workflow for cleaning up comments and docstrings.
  Use only when the user names this skill or explicitly requests sub-agents,
  delegation, or parallel agents for a comment audit. Do not auto-trigger from a
  comment-cleanup request alone.
---

# Enhance Comments loop

[RecallOS comment guidelines](../../../docs/engineering/comments.md) are the
source of truth. Every sub-agent must read them.

## Authorization and agent roles

- Explicit invocation of this skill authorizes its documented sub-agent workflow.
- Do not run it merely because a request matches the subject matter.
- The main agent scopes work, delegates edits, coordinates independent review,
  verifies the result, and reports. It does not perform delegated edits itself.
- If sub-agents cannot be spawned, report the workflow as blocked instead of
  silently completing it as a single agent.

## Overview

```mermaid
flowchart TD
    start(["Start"])
    scope["Partition scope; default to the whole codebase"]
    explore["Spawn sub-agents to find comment issues"]
    actionable{"Any issues?"}
    edit["Spawn sub-agents for non-overlapping comment-only edits"]
    review["Spawn different sub-agents to review policy and diffs"]
    approved{"All reviews pass?"}
    revise["Return findings to editors"]
    report["Report changes and refactor opportunities"]
    done(["Done"])

    start --> scope
    scope --> explore
    explore --> actionable
    actionable -- No --> report
    actionable -- Yes --> edit
    edit --> review
    review --> approved
    approved -- No --> revise
    revise --> review
    approved -- Yes --> report
    report --> done
```

## Guardrails

- Explorers do not edit; they report each candidate's location, action, and
  rationale.
- Editors change only comments and blank lines. Preserve `GIVEN`, `WHEN`, and
  `THEN`; report required code refactors instead of making them.
- Reviewers must be independent from editors. Repeat editing and review until
  every scope passes.

## Verify

Each reviewer must confirm its diff changes only comments and blank lines:

```bash
git diff -U0 -- <edited-paths> | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' \
  | grep -vE '^[+-][[:space:]]*(//|/\*\*?|\*|\*/|$)'
```

The command must print nothing. Return failures to an editor.
