---
name: loop-fix-unit-tests
description: >-
  Explicitly invoked multi-agent workflow for diagnosing and fixing failing unit
  tests with independent review. Use only when the user names this skill or
  explicitly requests sub-agents, delegation, or parallel agents for test fixes.
  Do not auto-trigger from a test-fixing request alone.
---

# Fix Unit Tests loop

[RecallOS server unit testing pattern](../../../docs/engineering/server-unit-testing.md)
is the source of truth. Every sub-agent must read it.

## Authorization and agent roles

- Explicit invocation of this skill authorizes its documented sub-agent workflow.
- Do not run it merely because a request matches the subject matter.
- The main agent runs top-level tests, partitions failures, delegates fixes,
  coordinates independent review, verifies the full suite, and reports. It does
  not perform delegated fixes itself.
- If sub-agents cannot be spawned, report the workflow as blocked instead of
  silently completing it as a single agent.

## Overview

```mermaid
flowchart TD
    start(["Start"])
    run["Run `bun run test`; group failures into non-overlapping scopes"]
    failures{"Any failures?"}
    fix["Spawn sub-agents to diagnose and fix each scope"]
    review["Spawn different sub-agents to review changes and run scoped tests"]
    approved{"All reviews pass?"}
    revise["Return findings to fixers"]
    report["Report root causes, changes, and verification"]
    done(["Done"])

    start --> run
    run --> failures
    failures -- No --> report
    failures -- Yes --> fix
    fix --> review
    review --> approved
    approved -- No --> revise
    revise --> review
    approved -- Yes --> run
    report --> done
```

## Guardrails

- Give each fixer a non-overlapping failure scope; fixers diagnose root cause and
  make only the minimal related changes.
- Do not skip tests, weaken assertions, or change unrelated production code.
- Reviewers must be independent from fixers. Repeat fixing and review until every
  scope passes.

## Verify

- Fixers run the smallest command that reproduces their assigned failures.
- Reviewers inspect the scoped diff and run the affected workspace's test task.
- The main agent runs `bun run test` after all reviews pass; repeat the loop until
  the full suite passes.
