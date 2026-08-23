export function scoreRepository(repo, evidence, rules) {
  if (!evidence || evidence.coverage !== "full") {
    return {
      score: null,
      health: "unknown",
      components: {},
      attention: ["Repository requires full evidence scan"],
    };
  }

  const max = rules.dimensions;
  const daysSincePush = Math.max(0, (Date.now() - new Date(repo.pushed_at).getTime()) / 86400000);

  let freshness = max.freshness;
  if (daysSincePush > rules.freshnessDays.stale) freshness = 0;
  else if (daysSincePush > rules.freshnessDays.partial) freshness = Math.round(max.freshness * 0.35);
  else if (daysSincePush > rules.freshnessDays.full) freshness = Math.round(max.freshness * 0.7);

  const documentation = evidence.hasReadme ? max.documentation : 0;
  const automation = evidence.workflowCount > 0 ? max.automation : 0;
  const testing = evidence.hasTests ? max.testing : 0;
  const operability = evidence.hasManifest || evidence.hasDocker || evidence.hasVercelConfig ? max.operability : 0;

  let hygiene = max.hygiene;
  if (repo.archived) hygiene = 0;
  else {
    if (repo.size === 0) hygiene -= Math.round(max.hygiene * 0.6);
    if (evidence.trackedEnvFile) hygiene -= Math.round(max.hygiene * 0.4);
  }
  hygiene = Math.max(0, hygiene);

  const components = { freshness, documentation, automation, testing, operability, hygiene };
  const score = Object.values(components).reduce((a, b) => a + b, 0);
  const health = score >= rules.thresholds.healthy ? "healthy" : score >= rules.thresholds.watch ? "watch" : "risk";

  const attention = [];
  if (!evidence.hasTests) attention.push("Add automated tests");
  if (evidence.workflowCount === 0) attention.push("Add CI workflow");
  if (!evidence.hasReadme) attention.push("Add operational README");
  if (daysSincePush > rules.freshnessDays.stale) attention.push("Repository is stale");
  if (!evidence.hasManifest && !evidence.hasDocker && !evidence.hasVercelConfig) attention.push("No operability manifest detected");
  if (evidence.trackedEnvFile) attention.push("Tracked .env-like file detected");
  if (repo.archived) attention.push("Repository is archived");
  if (!attention.length) attention.push("No repository-level blockers detected");

  return { score, health, components, attention };
}
