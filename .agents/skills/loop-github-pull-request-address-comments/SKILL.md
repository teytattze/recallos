---
name: loop-github-pull-request-address-comments
description: >-
  Explicitly invoked multi-agent workflow for addressing every actionable comment
  on the GitHub pull request associated with the current branch, publishing the
  fixes as a follow-up pull request, and replying to addressed comments with the
  new PR link. Use only when the user names this skill or explicitly requests
  delegated agents plus the complete fetch, review, fix, branch, commit, push,
  follow-up-PR, and reply workflow. Do not auto-trigger for ordinary PR review or
  comment-summary requests.
compatibility: >-
  Requires git, an authenticated GitHub CLI or GitHub app, sub-agent tools, and
  the sibling pattern-git-commit skill.
---

# Address GitHub pull request comments loop

Use [pattern-git-commit](../pattern-git-commit/SKILL.md) for the commit stage.
Read that skill completely immediately before staging or committing so its safety
and message rules govern the actual diff.

## Authorization and responsibilities

- Explicit invocation authorizes this skill's sub-agent workflow and the listed
  GitHub writes: create and push a branch, open a follow-up PR, and reply to each
  addressed comment. It does not authorize merging either PR, resolving threads,
  approving reviews, force-pushing, or changing unrelated GitHub state.
- The main agent owns PR discovery, comment inventory, task decomposition, branch
  management, integration, final verification, commit, push, PR creation, and
  comment replies. Delegate implementation tasks; do not delegate git publication
  or GitHub replies.
- If sub-agents cannot be spawned, report the workflow as blocked rather than
  silently completing delegated work as a single agent.
- Preserve unrelated local changes. If the worktree is dirty and the existing
  changes cannot be safely separated from this workflow, stop and ask the user
  how to proceed.

## Workflow

### 1. Resolve the source PR and freeze its context

1. Record the repository, current branch, current HEAD, and worktree status.
2. Resolve the open pull request whose head is the current branch. Prefer the
   GitHub app for PR metadata when available; otherwise use `gh pr view`.
3. Record the PR number, URL, head branch, base branch, and head SHA. The recorded
   head branch is the **source branch** and will be the base of the follow-up PR.
4. Stop for clarification if there is no associated open PR, multiple PRs are
   plausible, the PR head differs from the checked-out branch, or the remote and
   repository cannot be identified reliably.

Run authenticated `gh` reads with network access. Confirm `gh auth status` before
relying on the CLI, and report authentication or permission failures directly.

### 2. Fetch and review the complete comment set

Fetch all pages of all PR discussion surfaces:

- top-level conversation comments;
- review submissions and their bodies;
- inline review threads, including every reply;
- each thread's resolved, outdated, path, line, and diff-side metadata.

Use thread-aware GitHub GraphQL data for inline feedback because flat comment
lists do not preserve thread resolution or reply structure. Connector comment
reads are useful for metadata and top-level discussion but are not a complete
thread inventory.

Create one normalized inventory with stable identifiers and URLs. Review every
entry and classify it as one of:

- unresolved and actionable;
- ambiguous or conflicting;
- informational, approval, or acknowledgement;
- duplicate of another task;
- already resolved, already implemented, or obsolete/outdated.

Do not infer a code change from a question or unclear preference. Stop and ask
for clarification when ambiguity or conflicting requests would materially change
the implementation. If no unresolved actionable work remains, report that result
and do not create a branch, PR, or replies.

### 3. Break comments into delegated tasks

Group related actionable comments by behavior and affected files. For each task,
record:

- the comment and thread identifiers it satisfies;
- the requested outcome and observable acceptance criteria;
- the allowed file scope;
- the smallest relevant verification command;
- dependencies or file overlap with other tasks.

Deduplicate comments that ask for the same outcome, but retain the mapping from
the task to every originating comment so each can receive a reply later. Combine
tasks that would edit the same files or require one coherent design. Run only
independent, non-overlapping tasks concurrently.

### 4. Create the follow-up branch

After the task breakdown is stable and before any implementation edit:

1. Ensure HEAD still matches the recorded source PR head SHA.
2. Create a new branch from the source branch using the repository's required
   prefix (default `codex/`) and a concise purpose, such as
   `codex/address-pr-<number>-comments`.
3. Do not reuse or overwrite an existing local or remote branch without user
   direction.

### 5. Delegate implementation and review

Spawn one implementation sub-agent per independent task, within concurrency
limits. Give each agent the task-to-comment mapping, acceptance criteria, allowed
files, repository instructions, and verification command. Agents must:

- inspect the relevant comment context and code before editing;
- make only the minimal changes needed for their assigned task;
- preserve unrelated user changes;
- run the scoped verification and report changed files, results, and blockers;
- never commit, push, create a PR, reply on GitHub, or resolve a thread.

When tasks overlap or depend on one another, delegate them sequentially or to one
agent. After implementation, spawn an independent reviewer that did not implement
the task. The reviewer checks each comment against the diff and acceptance
criteria and runs the relevant scoped checks. Return concrete findings to the
implementer and repeat review until all actionable tasks pass.

### 6. Integrate and verify

The main agent inspects the combined diff and confirms that:

- every changed line maps to at least one actionable comment;
- every actionable comment maps to an implemented and reviewed change;
- no comment was silently skipped;
- no unrelated or secret-bearing files are included;
- the worktree contains only the intended follow-up changes.

Run the smallest checks that cover all affected workspaces. Escalate to broader
lint, test, or build commands when changes cross workspace or architectural
boundaries. Do not weaken tests, bypass hooks, or claim verification that did not
run.

### 7. Commit with `pattern-git-commit`

Read [pattern-git-commit](../pattern-git-commit/SKILL.md) completely, then follow
its workflow against the actual final diff:

1. Inspect status and staged/unstaged diffs.
2. Stage only files belonging to the reviewed task set.
3. Reject secrets and unrelated changes.
4. Generate a Conventional Commit message from the diff and commit without
   skipping hooks or amending a failed commit.

If the commit or its hooks fail, fix the in-scope cause, rerun verification, and
create a new commit attempt. Never force or destructively rewrite history.

### 8. Push and open the follow-up PR

1. Push the new branch to the appropriate remote without force.
2. Open a GitHub PR whose head is the new branch and whose base is the recorded
   source branch, not the source PR's base branch.
3. In the PR body, link the source PR and summarize the addressed comment/task
   mapping plus verification results.
4. Confirm the returned PR URL, number, head, and base before replying anywhere.

If push or PR creation fails, stop without posting completion replies. Report the
failure and leave the local branch and commit intact for recovery.

### 9. Reply to addressed comments

Only after the follow-up PR exists, reply once to every original unresolved
actionable comment represented by the completed task set:

```text
done [PR #<number>](<new PR URL>)
```

- Reply in the existing inline review thread for inline comments.
- Reply to the applicable top-level conversation comment when GitHub supports it;
  otherwise post one top-level comment that quotes or links the original comment
  and uses the same completion text.
- Do not reply to informational, duplicate-only, resolved, obsolete, ambiguous,
  conflicting, or unaddressed comments.
- Do not mark threads resolved unless the user separately requests it.
- Make retries idempotent: inspect existing replies first and do not post the same
  completion reply twice.

If some replies fail, continue safe idempotent attempts for the remaining
comments, then report the exact successes and failures. Do not claim all comments
were notified unless every intended reply succeeded.

## Completion report

Report:

- the source PR and source branch;
- actionable, non-actionable, ambiguous, and skipped comment counts;
- delegated tasks and the comments each addressed;
- verification commands and results;
- commit SHA, pushed branch, and follow-up PR URL;
- comment reply successes and any failures or intentionally unreplied comments.

The workflow is complete only when all selected actionable tasks are reviewed and
verified, the branch is pushed, the follow-up PR targets the recorded source
branch, and every addressed comment has the completion reply.
