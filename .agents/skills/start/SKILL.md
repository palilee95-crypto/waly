---
name: start
description: Record repository changes in the team handoff Markdown file so developers can understand commits, behavior changes, migrations, validation, and known risks after pulling. Use when starting a work session with undocumented changes, when asked to run /start, or when asked to prepare a developer handoff.
argument-hint: "[optional focus or commit range]"
---

# Start: Update the developer handoff

Use this skill to maintain the repository's `DEV_HANDOFF.md` as a reliable, append-only engineering handoff for teammates.

## Workflow

1. Find the repository root with `git rev-parse --show-toplevel`. Work only in that repository.
2. Read `DEV_HANDOFF.md` and find its `Last documented commit` marker. If the file or marker does not exist, inspect the available history and establish an explicit baseline; do not assume earlier work is documented.
3. Inspect `git status --short`, `git log <marker>..HEAD`, and each relevant commit's full diff. If a focus or commit range was provided, use it while still checking for undocumented working-tree changes.
4. Summarize each change in plain language. Explain user-visible behavior, data/API/schema effects, notable safeguards, and operational impact. Include commit hash and subject, affected paths, migrations or deployment requirements, and validation results where applicable. Distinguish confirmed behavior from inference.
5. Inspect modified and untracked files when their diffs are needed to accurately explain the work. Never claim that tests, migrations, or deployment checks passed unless you ran them or verified an explicit result.
6. Append a dated section to `DEV_HANDOFF.md`; do not replace or silently rewrite earlier entries. Include a short overview, changes grouped by commit or feature, affected paths, validation, and known follow-ups/risks. If there are no changes to document, say so rather than creating an empty entry.
7. Record the latest commit hash covered by the appended entry in the `Last documented commit` marker. If there are uncommitted changes, label them clearly as uncommitted and list affected paths; do not imply they are present on the remote. Do not advance the marker past commits whose changes were not reviewed.
8. Review the final Markdown diff and ensure the handoff contains enough context for a developer who has only pulled the branch. Do not stage, commit, push, or modify application code unless explicitly requested.

## Handoff quality rules

- Be specific: describe what changed and why, not just repeat commit subjects.
- Keep useful file paths and commit hashes so teammates can navigate the code.
- Note PocketBase migrations, hooks, environment variables, deployment steps, or data-retention constraints when present.
- Separate verified facts, validation, and unresolved issues.
- Preserve prior handoff entries; fix factual errors only with a clearly marked correction.
