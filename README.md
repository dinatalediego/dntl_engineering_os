# DNTL Engineering OS

A portfolio control plane for engineering repositories: **discover → inspect → score → observe → prioritize → refresh**.

## v0.3 — Repository Health + Actions Health

The dashboard consumes `data/inventory.json`, generated automatically from GitHub evidence. Two health layers stay deliberately separate:

- **Repository Health**: structural engineering maturity (0–100).
- **Actions Health**: current CI/runtime automation status derived from real GitHub Actions runs.

### Closed control loop

```text
GitHub repositories + Actions
      ↓
scripts/scan-github.mjs
      ↓
recursive repository evidence + last 10 workflow runs
      ↓
Repository Health + Actions Health
      ↓
data/inventory.json
      ↓
Next.js dashboard + filters
      ↓
intervention queue
```

`.github/workflows/refresh-inventory.yml` runs every day at **08:17 America/Lima** (13:17 UTC), can be run manually with `workflow_dispatch`, and also runs when scanner, score rules, dashboard or workflow code changes.

Before committing a refreshed snapshot it must pass:

1. `npm run test:health`
2. `npm run scan:github`
3. `npm run build`

The generated snapshot is committed only after those checks succeed.

## Repository Health v1

| Dimension | Weight | Observable evidence |
|---|---:|---|
| Freshness | 25 | age of last repository push |
| Documentation | 15 | root README |
| Automation | 20 | GitHub Actions workflow definitions |
| Testing | 20 | test directories/config/files anywhere in the tree |
| Operability | 10 | runtime manifest, Docker or Vercel/Next config |
| Hygiene | 10 | non-archived, non-empty, no tracked `.env`-like files |

Thresholds: **80–100 healthy**, **60–79 watch**, **0–59 risk**, and **Not scanned** only when repository evidence is unavailable.

## Actions Health v1

For repositories with workflows the scanner reads the **10 most recent GitHub Actions runs** and records:

- latest workflow name
- status and conclusion
- red / green / yellow / gray state
- branch and trigger event
- last execution timestamp
- duration
- pass rate across recent completed runs
- recent failure count
- direct URL to the latest workflow run

Semantics:

- **green**: latest run completed successfully
- **red**: latest run failed, timed out, requires action, failed at startup or became stale
- **yellow/running**: in progress, cancelled, neutral or skipped
- **idle**: workflow configured but no execution history
- **unknown**: workflow exists but its runtime telemetry cannot currently be read
- **not-configured**: no workflow definition detected

Actions Health never changes the Repository Health score. Runtime failure is shown as a higher-priority intervention signal instead.

## Dashboard filters

- repository health
- Actions health
- system type
- visibility
- evidence coverage
- delivery signal
- search by repository, workflow, branch, tag or database
- Focus Mode: CI failures/running/unknown first, then structural risk/watch/test gaps

## Control-plane credential

The repository secret is:

```text
DNTL_GITHUB_TOKEN
```

For complete portfolio + Actions telemetry, its fine-grained repository access should cover the governed repositories and keep only the read permissions needed by the control plane:

- **Contents: Read-only**
- **Actions: Read-only**
- **Metadata: Read-only** (GitHub-provided baseline)

Never commit the token itself.

## Current proven behavior

The control loop has successfully expanded from public-only inventory to full private portfolio discovery. Automated refresh commits prove that tests, scanner and Next.js build execute before publication of each snapshot.

## Local commands

```bash
npm install
npm run test:health
npm run scan:github
npm run build
npm run dev
```

For a full private scan locally:

```bash
DNTL_GITHUB_TOKEN=... npm run scan:github
```

## Next telemetry layers

- Vercel deployment/build/runtime health
- Supabase migrations, RLS and database health
- ETL execution history and rejected rows
- dependency/contract health between repositories
- secrets/security scanning
- rollback readiness

Each future layer should remain independently auditable before any composite Engineering Confidence Score is introduced.
