---
name: loop-enhance-comments
description: >-
  Orchestrate sub-agents to clean up comments and docstrings. Use for comment
  audits or when comments are verbose, stale, redundant, or restate code.
---

# Enhance Comments loop

[RecallOS comment guidelines](../../../docs/engineering/comments.md) are the
source of truth. Every sub-agent must read them. The main agent only orchestrates.

## Overview

```mermaid
flowchart TD
    start(["Start"])
    scope["Partition scope; default to the whole codebase"]
    explore["Spawn agents to find comment issues"]
    actionable{"Any issues?"}
    edit["Spawn agents for non-overlapping comment-only edits"]
    review["Spawn different agents to review policy and diffs"]
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
