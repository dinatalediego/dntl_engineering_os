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
  if (optional && [403, 404, 409].includes(res.status)) return null;
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

function basename(path) {
  return path.split("/").pop() || path;
}

function classify(repo, paths) {
  const text = `${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")} ${paths.join(" ")}`.toLowerCase();
  if (/ml|model|predict|recommender|forecast|regression|scoring/.test(text)) return "ML";
  if (/etl|pipeline|warehouse|redshift|postgres|database|data|datos/.test(text)) return "Data";
  if (/bi|dashboard|report|analytics|insight|metric/.test(text)) return "Analytics";
  if (/cron|automation|bot|worker|job/.test(text)) return "Automation";
  return "App";
}

function detectDelivery(paths, workflowCount) {
  const files = paths.map(basename);
  const lower = files.map((n) => n.toLowerCase());
  if (lower.includes("vercel.json") || lower.some((n) => /^next\.config\./.test(n))) return "Vercel-ready";
  if (files.includes("Dockerfile") || lower.includes("docker-compose.yml")) return "Container-ready";
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

function tagsFor(repo) {
  return [...new Set([...(repo.topics || []), repo.language].filter(Boolean))].slice(0, 6);
}

function unknownRepo(repo, reason, coverage = "unavailable") {
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
    attention: [reason],
    components: {},
    evidence: { coverage },
    tags: tagsFor(repo),
  };
}

function observedRepo(repo, paths, evidence) {
  const scoring = scoreRepository(repo, evidence, rules);
  const text = `${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")} ${paths.join(" ")}`;
  return {
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    visibility: repo.visibility || (repo.private ? "private" : "public"),
    score: scoring.score,
    health: scoring.health,
    type: classify(repo, paths),
    criticality: "Unclassified",
    deployment: detectDelivery(paths, evidence.workflowCount),
    database: inferDatabase(text),
    tests: evidence.hasTests ? "Detected" : "Missing",
    lastActivity: repo.pushed_at || repo.updated_at || null,
    attention: scoring.attention,
    components: scoring.components,
    evidence,
    tags: tagsFor(repo),
  };
}

async function inspectRepo(repo) {
  if (repo.size === 0) {
    return observedRepo(repo, [], {
      coverage: "full",
      hasReadme: false,
      workflowCount: 0,
      hasTests: false,
      hasManifest: false,
      hasDocker: false,
      hasVercelConfig: false,
      trackedEnvFile: false,
      fileCount: 0,
      recursiveTree: true,
    });
  }

  const encoded = repo.full_name.split("/").map(encodeURIComponent).join("/");
  const root = await github(`/repos/${encoded}/contents`, { optional: true });
  if (!Array.isArray(root)) return unknownRepo(repo, "Repository could not be inspected with current token");

  const tree = await github(`/repos/${encoded}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`, { optional: true });
  const paths = Array.isArray(tree?.tree)
    ? tree.tree.filter((item) => item.type === "blob").map((item) => item.path)
    : root.filter((item) => item.type === "file").map((item) => item.name);
  const lowerPaths = paths.map((p) => p.toLowerCase());
  const files = paths.map(basename);
  const lowerFiles = files.map((n) => n.toLowerCase());

  const workflowCount = lowerPaths.filter((p) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p)).length;
  const hasTests = lowerPaths.some((p) =>
    /(^|\/)(tests?|__tests__|specs?)(\/|$)/.test(p) ||
    /(^|\/)[^/]+(?:\.test|\.spec|_test|_spec)\.[^/]+$/.test(p) ||
    /(^|\/)(pytest\.ini|tox\.ini)$/.test(p)
  );
  const manifestNames = ["package.json", "pyproject.toml", "requirements.txt", "poetry.lock", "pom.xml", "go.mod", "cargo.toml"];
  const hasManifest = lowerFiles.some((n) => manifestNames.includes(n));
  const hasReadme = lowerPaths.some((p) => !p.includes("/") && p.startsWith("readme"));
  const hasDocker = files.includes("Dockerfile") || lowerFiles.includes("docker-compose.yml");
  const hasVercelConfig = lowerFiles.includes("vercel.json") || lowerFiles.some((n) => n.startsWith("next.config."));
  const trackedEnvFile = lowerPaths.some((p) => {
    const file = basename(p).toLowerCase();
    return (file === ".env" || file.startsWith(".env.")) && ![".env.example", ".env.sample", ".env.template"].includes(file);
  });

  return observedRepo(repo, paths, {
    coverage: "full",
    hasReadme,
    workflowCount,
    hasTests,
    hasManifest,
    hasDocker,
    hasVercelConfig,
    trackedEnvFile,
    fileCount: paths.length,
    recursiveTree: Boolean(tree?.tree),
  });
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        out[i] = await fn(items[i]);
      } catch (error) {
        out[i] = unknownRepo(items[i], `Scan error: ${error.message}`, "error");
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
