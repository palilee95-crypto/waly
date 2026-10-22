# Contributing & Release Workflow

This repo is a customer-facing SaaS (Risev). **Production is only updated by a reviewed,
CI-passing pull request.** Nothing reaches `www.risev.app` from a direct push or a local
command.

If you are an AI agent working in this repo: read this file first, follow the rules in
[Agent rules](#agent-rules) literally, and never bypass a protected branch.

---

## 1. Branches and environments

| Branch | Deploys to | API it talks to | Notes |
|---|---|---|---|
| `feat/*`, `fix/*`, `chore/*` | a **Vercel preview URL** per push | staging | what you test on |
| `dev` | `https://staging.risev.app` | `https://staging-api.risev.app` | integration branch |
| `main` | `https://www.risev.app` | `https://api.risev.app` | production, real customers |

Both `dev` and `main` are protected. There is no long-lived `staging` branch.

---

## 2. The everyday loop

```bash
git checkout dev
git pull origin dev
git checkout -b fix/give-page-crash

# …edit, then check before committing…
npx tsc --noEmit
for f in pb_hooks/*.js pb_migrations/*.js; do node --check "$f"; done   # if you touched them

git add -A
git commit -m "fix(give): handle empty phone before lookup"
git push -u origin fix/give-page-crash
```

Then on GitHub:

1. The yellow **"Compare & pull request"** bar appears — click it.
2. Base **`dev`** ← compare your branch. Create the PR.
3. Wait for **`checks / app`** to go green (it is required).
4. The other developer reviews and clicks **Approve**.
5. **Squash and merge** → **Delete branch** (automatic).

That publishes to **staging only**.

---

## 3. Release to production

When the change is verified on staging:

1. **Pull requests → New pull request**
2. Base **`main`** ← compare **`dev`**
3. Create → wait for `checks` → approve → **Squash and merge**

That merge is what triggers the Vercel production deploy. Optionally tag it:

```bash
git tag -a v1.x.0 -m "short description of the release"
git push origin v1.x.0
```

### Hotfix directly on production

```bash
git checkout main && git pull
git checkout -b fix/urgent
# commit, push, PR into main
```

Afterwards merge `main` back into `dev` (a `chore/sync-main-into-dev` branch with a merge
commit) so staging doesn't drift.

---

## 4. Branch protection (what will block you)

Ruleset **`protect-main-and-dev`** applies to `main` and `dev`:

- pull request required, **1 approving review**, stale approvals dismissed,
  conversations must be resolved
- required status check: **`app`** (the `checks` workflow)
- **squash merges only**, linear history, force pushes and branch deletion blocked
- repository admins may bypass in an emergency (it is logged — do not do it casually)

A direct `git push origin dev` / `git push origin main` fails with `protected branch`.
That is expected, not a bug.

---

## 5. What runs automatically

- **`.github/workflows/ci.yml`** on every PR and on pushes to `dev`/`main`:
  `npm ci`, `tsc --noEmit`, `node --check` over every PocketBase hook and migration,
  and a web/PWA export against the staging API.
- **Vercel preview** for every branch, from *two* projects (production and
  `risev-staging`). Both previews use the staging API; two builds per push is expected.

---

## 6. Backend (PocketBase) deploys are NOT part of the git push

`/opt/risev` on the VPS is **not** a git checkout. Hooks and migrations reach it by file
copy. A merged PR changes nothing until someone deploys.

```powershell
# 1. always staging first
./scripts/deploy-backend.ps1 -Env staging -Restart
# 2. verify on staging, then production
./scripts/deploy-backend.ps1 -Env prod -Restart
```

- The script copies `pb_hooks/` and `pb_migrations/` for the **current commit**, backs up
  the remote copies, stops the container, copies, starts it once, then health-checks.
- It refuses a dirty working tree (use `-AllowDirty` only when you know why).
- **Announce a production deploy** before running it — it restarts a shared server.
- After the restart, confirm the `[MIGRATION]` line in
  `docker logs --since 2m risev-pocketbase` and that `/api/health` returns 200.

### Migrations

- PocketBase migrations are **forward-only** and run on container start.
- A migration that throws **aborts startup** (the whole backend goes down). Always boot a
  local PocketBase through a new migration before deploying it.
- Never build a fresh database from `pb_migrations/`: timestamp collisions make that
  impossible. Seed locally from a snapshot (`scripts/serve-local.cmd`, `pb_data_local/`).
- Take a backup before a production migration (`vps_export_backup`, `db_only`).

---

## 7. Repo-specific traps

1. **`expo-env.d.ts` is committed on purpose.** It loads `expo/types`, which carries the
   react-native-web style augmentations. Remove it and `tsc` reports false errors on
   `position: 'sticky'`, `Image` styles, etc. It must stay in git.
2. **Never give two docker-compose projects the same service name on a shared network.**
   Production and staging share `risev_risev-network`; when both services were called
   `pocketbase`, Docker DNS load-balanced Caddy between them and about half of production
   traffic hit the staging database. Caddy proxies by **container name**
   (`risev-pocketbase` / `risev-pocketbase-staging`).
3. **Caddy reads environment variables at start.** After changing `DOMAIN_API*` in `.env`,
   `docker compose up -d caddy`; a `caddy reload` is enough only for Caddyfile edits:
   `docker exec risev-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.
4. **Staging holds a copy of production data** (real names/phones), is behind Cloudflare,
   and has **no SMTP, no ChipIn, no push** (`PUSH_DISABLED=1`). It must never message or
   charge a customer. Its login skips Turnstile (`TURNSTILE_DISABLED=1`) because a
   developer browser that blocks `challenges.cloudflare.com` can otherwise not sign in.
5. **A `+` in a PocketBase filter sent through a URL becomes a space.** Escape phone
   numbers (`%2B60…`) or the filter silently matches nothing.
6. **`pb_data/auxiliary.db` is request logs, not data.** The real database is
   `pb_data/data.db` (~5 MB). Never seed or back up `auxiliary.db`.
7. **JSVM hooks:** a handler cannot see file-level functions/variables — declare helpers
   inside the handler, or `require()` a module. Unknown fields are silently dropped by
   `record.set()`.

---

## 8. Agent rules

An AI agent working here must:

- **Never push to `dev` or `main`.** Commit on a `feat/…`, `fix/…` or `chore/…` branch and
  push **that** branch. Open a PR (or hand the push command to the human).
- **Never force-push**, never delete branches that are not their own, never rewrite
  history of `dev`/`main`.
- **Never run a production backend deploy or a production migration** without explicit
  human approval in the same conversation. Staging deploys are fine.
- **Never commit secrets.** `.env*` is gitignored; only `.env.example` is tracked.
- **Verify before handing off:** `npx tsc --noEmit` passes, and if hooks or migrations
  changed, `node --check` each one and say so in the handoff, including the exact deploy
  commands the human needs to run.
- **State which environment a change needs:** frontend-only (merge to `dev` then `main`),
  backend-only (deploy script), or both.
- Keep the PR title in `type(scope): summary` form and describe *why*, not just what.

---

## 9. Troubleshooting

| Symptom | Meaning / fix |
|---|---|
| `git push` → `protected branch` | expected; push your feature branch and open a PR |
| `Can't automatically merge` on `dev → main` | usually a file added independently on both branches; resolve keeping the `dev` version (web editor or a local merge commit) |
| GitHub says `dev` is N commits ahead of `main` after a release | cosmetic: squash merges create new hashes. Compare content with `git diff origin/main origin/dev` — empty means you are fine |
| CI red, local `tsc` green | check `expo-env.d.ts` is present and imports match filename casing (Linux is case-sensitive) |
| Login 403 `Security verification failed` on staging | `TURNSTILE_DISABLED` missing on the staging container |
| Login 403 on production with **no** entry in the PocketBase log | the request never reached the app — check `docker exec risev-caddy tail -50 /data/logs/access.log` (Cloudflare edge, or a mis-routed upstream) |
| Migration log line missing after a restart | the migration threw; the container may be down — `docker logs --since 5m risev-pocketbase` |

---

## 10. Quick reference

```bash
# start work
git checkout dev && git pull && git checkout -b fix/thing

# before commit
npx tsc --noEmit

# ship to staging
git push -u origin fix/thing        # then PR into dev on GitHub

# release
# GitHub → New pull request → base main ← compare dev → squash and merge

# backend
./scripts/deploy-backend.ps1 -Env staging -Restart
./scripts/deploy-backend.ps1 -Env prod -Restart      # announce first
```
