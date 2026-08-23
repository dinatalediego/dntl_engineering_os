# DNTL Engineering OS

Portfolio control plane for engineering repositories.

## v0.1 — Engineering Command Center

The home screen is an operating dashboard designed to answer one question quickly: **where should I intervene first?**

### Filters
- Search by repository, tag or capability
- Health: healthy / watch / risk
- System type: Data / App / ML / Analytics / Automation
- Criticality: High / Medium / Low
- Deployment: Vercel / Local / GitHub / Not deployed
- Focus mode: automatically keeps systems with health or testing gaps

### Operating signals
- Visible repositories
- Portfolio health score
- Systems needing attention
- Test/control gaps
- Per-repository deployment, database, tests, last run and attention note

## Data status

The v0.1 interface uses a representative operating dataset so the interaction model can be validated immediately. Repository inventory has already been reviewed against the GitHub portfolio; the next ingestion layer should replace representative health fields with live GitHub/Vercel/Supabase/ETL telemetry.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
