import { mkdir, readFile, writeFile } from "node:fs/promises";
import { scoreRepository } from "./health-score.mjs";

const owner = process.env.DNTL_GITHUB_OWNER || "dinatalediego";
const privateToken = process.env.DNTL_GITHUB_TOKEN || "";
const apiToken = privateToken || process.env.GITHUB_TOKEN || "";
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "dntl-engineering-os",
  ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
};

const rules = JSON.parse(await readFile(new URL("../config/health-rules.json", import.meta.url), "utf8"));

async function github(path, { optional = false } = {}) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (optional && (res.status === 404 || res.status === 403)) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${path}`);
  return res.json();
}

async function paginate(path) {
  const rows = [];
  for (let page = 1; page <= 20; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = await github(`${path}${sep}per_page=100&page=${page}`);
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  return rows;
}

async function discoverRepos() {
  const publicRepos = await paginate(`/users/${owner}/repos?type=owner&sort=updated`);
  if (!privateToken) return { repos: publicRepos, fullPrivateCoverage: false };
  const authenticated = await paginate(`/user/repos?affiliation=owner&sort=updated`);
  const mine = authenticated.filter((r) => r.owner?.login?.toLowerCase() === owner.toLowerCase());
  const byName = new Map([...publicRepos, ...mine].map((r) => [r.full_name, r]));
  return { repos: [...byName.values()], fullPrivateCoverage: true };
}

function classify(repo, names) {
  const text = `${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")} ${names.join(" ")}`.toLowerCase();
  if (/ml|model|predict|recommender|forecast|regression|scoring/.test(text)) return "ML";
  if (/etl|pipeline|warehouse|redshift|postgres|database|data|datos/.test(text)) return "Data";
  if (/bi|dashboard|report|analytics|insight|metric/.test(text)) return "Analytics";
  if (/cron|automation|bot|worker|job/.test(text)) return "Automation";
  return "App";
}

function detectDelivery(names, workflowCount) {
  if (names.includes("vercel.json") || names.some((n) => /^next\.config\./.test(n))) return "Vercel-ready";
  if (names.includes("Dockerfile") || names.includes("docker-compose.yml")) return "Container-ready";
  if (workflowCount > 0) return "GitHub Actions";
  return "Not detected";
}

function inferDatabase(text) {
  const v = text.toLowerCase();
  if (v.includes("supabase")) return "Supabase";
  if (v.includes("redshift")) return "Redshift";
  if (v.includes("postgres")) return "PostgreSQL";
  if (v.includes("sqlite")) return "SQLite";
  return "Not detected";
}

async function inspectRepo(repo) {
  const encoded = repo.full_name.split("/").map(encodeURIComponent).join("/");
  const root = await github(`/repos/${encoded}/contents`, { optional: true });
  if (!Array.isArray(root)) {
    return {
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      visibility: repo.visibility || (repo.private ? "private" : "public"),
      score: null,
      health: "unknown",
      type: "Unknown",
      criticality: "Unclassified",
      deployment: "Unknown",
      database: "Unknown",
      tests: "Unknown",
      lastActivity: repo.pushed_at || repo.updated_at || null,
      attention: ["Repository could not be inspected with current token"],
      components: {},
      evidence: { coverage: "unavailable" },
    };
  }

  const names = root.map((x) => x.name);
  const lower = names.map((n) => n.toLowerCase());
  const workflows = await github(`/repos/${encoded}/actions/workflows?per_page=100`, { optional: true });
  const workflowCount = workflows?.total_count || 0;
  const hasTests = lower.some((n) => /^(tests?|__tests__|spec|pytest\.ini|tox\.ini)$/.test(n)) || lower.some((n) => n.includes("test"));
  const hasManifest = lower.some((n) => ["package.json", "pyproject.toml", "requirements.txt", "poetry.lock", "pom.xml", "go.mod", "cargo.toml"].includes(n));
  const evidence = {
    coverage: "full",
    hasReadme: lower.some((n) => n.startsWith("readme")),
    workflowCount,
    hasTests,
    hasManifest,
    hasDocker: names.includes("Dockerfile") || lower.includes("docker-compose.yml"),
    hasVercelConfig: lower.includes("vercel.json") || lower.some((n) => n.startsWith("next.config.")),
    trackedEnvFile: lower.some((n) => n === ".env" || n.startsWith(".env.")) && !lower.includes(".env.example"),
  };

  const scoring = scoreRepository(repo, evidence, rules);
  const text = `${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")} ${names.join(" ")}`;
  return {
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    visibility: repo.visibility || (repo.private ? "private" : "public"),
    score: scoring.score,
    health: scoring.health,
    type: classify(repo, names),
    criticality: "Unclassified",
    deployment: detectDelivery(names, workflowCount),
    database: inferDatabase(text),
    tests: hasTests ? "Detected" : "Missing",
    lastActivity: repo.pushed_at || repo.updated_at || null,
    attention: scoring.attention,
    components: scoring.components,
    evidence,
    tags: [...new Set([...(repo.topics || []), repo.language].filter(Boolean))].slice(0, 6),
  };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      try { out[i] = await fn(items[i]); }
      catch (error) {
        out[i] = {
          name: items[i].name,
          fullName: items[i].full_name,
          url: items[i].html_url,
          visibility: items[i].visibility || (items[i].private ? "private" : "public"),
          score: null,
          health: "unknown",
          type: "Unknown",
          criticality: "Unclassified",
          deployment: "Unknown",
          database: "Unknown",
          tests: "Unknown",
          lastActivity: items[i].pushed_at || null,
          attention: [`Scan error: ${error.message}`],
          components: {},
          evidence: { coverage: "error" },
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const { repos, fullPrivateCoverage } = await discoverRepos();
const inspected = await mapLimit(repos, 6, inspectRepo);
inspected.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

const scored = inspected.filter((r) => typeof r.score === "number");
const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  owner,
  source: "github-api",
  fullPrivateCoverage,
  coverage: {
    discovered: inspected.length,
    scored: scored.length,
    unknown: inspected.length - scored.length,
  },
  portfolioScore: scored.length ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : null,
  repositories: inspected,
};

await mkdir(new URL("../data", import.meta.url), { recursive: true });
await writeFile(new URL("../data/inventory.json", import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Scanned ${snapshot.coverage.scored}/${snapshot.coverage.discovered} repositories. Private coverage: ${fullPrivateCoverage ? "full" : "public-only"}.`);
