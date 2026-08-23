const RED_CONCLUSIONS = new Set(["failure", "timed_out", "action_required", "startup_failure", "stale"]);
const YELLOW_CONCLUSIONS = new Set(["cancelled", "neutral", "skipped"]);

function durationSeconds(run) {
  if (!run) return null;
  const start = run.run_started_at || run.created_at;
  const end = run.updated_at || run.created_at;
  if (!start || !end) return null;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
}

function serializeRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    name: run.name || run.display_title || "Workflow run",
    status: run.status || null,
    conclusion: run.conclusion || null,
    event: run.event || null,
    branch: run.head_branch || null,
    createdAt: run.created_at || null,
    startedAt: run.run_started_at || run.created_at || null,
    updatedAt: run.updated_at || null,
    durationSeconds: durationSeconds(run),
    url: run.html_url || null,
    runNumber: run.run_number || null,
  };
}

export function summarizeActions(workflowCount, payload) {
  if (!workflowCount) {
    return {
      state: "not-configured",
      color: "gray",
      label: "No workflows",
      workflowCount: 0,
      latest: null,
      runs: [],
      recentRuns: 0,
      successRateLast10: null,
      failedRecentCount: 0,
    };
  }

  if (!payload) {
    return {
      state: "unknown",
      color: "gray",
      label: "Actions not observable",
      workflowCount,
      latest: null,
      runs: null,
      recentRuns: null,
      successRateLast10: null,
      failedRecentCount: null,
    };
  }

  const sourceRuns = Array.isArray(payload.workflow_runs) ? payload.workflow_runs.slice(0, 10) : [];
  if (!sourceRuns.length) {
    return {
      state: "idle",
      color: "gray",
      label: "Configured · no runs",
      workflowCount,
      latest: null,
      runs: [],
      recentRuns: 0,
      successRateLast10: null,
      failedRecentCount: 0,
    };
  }

  const latestRun = sourceRuns[0];
  const completed = sourceRuns.filter((run) => run.status === "completed");
  const successes = completed.filter((run) => run.conclusion === "success").length;
  const failedRecentCount = completed.filter((run) => RED_CONCLUSIONS.has(run.conclusion)).length;
  const successRateLast10 = completed.length ? Math.round((successes / completed.length) * 100) : null;

  let state = "running";
  let color = "yellow";
  let label = latestRun.status || "in progress";

  if (latestRun.status === "completed") {
    if (latestRun.conclusion === "success") {
      state = "green";
      color = "green";
      label = "Passing";
    } else if (RED_CONCLUSIONS.has(latestRun.conclusion)) {
      state = "red";
      color = "red";
      label = "Failing";
    } else if (YELLOW_CONCLUSIONS.has(latestRun.conclusion)) {
      state = "yellow";
      color = "yellow";
      label = latestRun.conclusion || "Attention";
    } else {
      state = "unknown";
      color = "gray";
      label = latestRun.conclusion || "Unknown";
    }
  }

  const runs = sourceRuns.map(serializeRun);
  return {
    state,
    color,
    label,
    workflowCount,
    recentRuns: sourceRuns.length,
    successRateLast10,
    failedRecentCount,
    latest: runs[0],
    runs,
  };
}
