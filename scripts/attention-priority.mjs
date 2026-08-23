const HEALTH_POINTS = {
  risk: 35,
  watch: 18,
  unknown: 30,
  healthy: 0,
};

const ACTION_POINTS = {
  red: 70,
  running: 10,
  yellow: 22,
  unknown: 28,
  idle: 8,
  green: 0,
  "not-configured": 0,
};

function addSignal(signals, points, reason, code) {
  if (!points) return;
  signals.push({ points, reason, code });
}

export function prioritizeRepository(repo) {
  const signals = [];
  const actions = repo.actions || {};
  const evidence = repo.evidence || {};

  addSignal(signals, ACTION_POINTS[actions.state] || 0,
    actions.state === "red" ? `Latest GitHub Actions run is failing${actions.latest?.name ? `: ${actions.latest.name}` : ""}` :
    actions.state === "running" ? "GitHub Actions run is currently in progress" :
    actions.state === "yellow" ? `Latest GitHub Actions run needs attention${actions.latest?.conclusion ? `: ${actions.latest.conclusion}` : ""}` :
    actions.state === "unknown" && (actions.workflowCount || evidence.workflowCount) ? "GitHub Actions telemetry is unavailable" :
    actions.state === "idle" ? "GitHub Actions is configured but has no recorded runs" : "",
    `actions:${actions.state || "unknown"}`
  );

  addSignal(signals, HEALTH_POINTS[repo.health] || 0,
    repo.health === "risk" ? "Repository structural health is at risk" :
    repo.health === "watch" ? "Repository structural health needs attention" :
    repo.health === "unknown" ? "Repository structural health is not observable" : "",
    `repository:${repo.health || "unknown"}`
  );

  if (repo.tests === "Missing") addSignal(signals, 10, "Automated tests are missing", "tests:missing");
  if (evidence.trackedEnvFile) addSignal(signals, 30, "Tracked .env-like file requires security review", "security:tracked-env");

  const recentFailures = Number(actions.failedRecentCount || 0);
  if (recentFailures > 1) {
    addSignal(signals, Math.min(15, (recentFailures - 1) * 4), `${recentFailures} failures detected in recent workflow history`, "actions:repeated-failures");
  }

  const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.points, 0));
  const severity = score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : score > 0 ? "low" : "clear";
  const ordered = [...signals].sort((a, b) => b.points - a.points || a.reason.localeCompare(b.reason));

  return {
    score,
    severity,
    primaryReason: ordered[0]?.reason || "No active intervention signal",
    signals: ordered,
  };
}
