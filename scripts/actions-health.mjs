const RED_CONCLUSIONS = new Set(["failure", "timed_out", "action_required", "startup_failure", "stale"]);
const YELLOW_CONCLUSIONS = new Set(["cancelled", "neutral", "skipped"]);

function durationSeconds(run) {
  if (!run) return null;
  const start = run.run_started_at || run.created_at;
  const end = run.updated_at || run.created_at;
  if (!start || !end) return null;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
}

export function summarizeActions(workflowCount, payload) {
  if (!workflowCount) {
    return {
      state: "not-configured",
      color: "gray",
      label: "No workflows",
      workflowCount: 0,
      latest: null,
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
      recentRuns: null,
      successRateLast10: null,
      failedRecentCount: null,
    };
  }

  const runs = Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [];
  if (!runs.length) {
    return {
      state: "idle",
      color: "gray",
      label: "Configured · no runs",
      workflowCount,
      latest: null,
      recentRuns: 0,
      successRateLast10: null,
      failedRecentCount: 0,
    };
  }

  const latestRun = runs[0];
  const completed = runs.filter((run) => run.status === "completed");
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

  return {
    state,
    color,
    label,
    workflowCount,
    recentRuns: runs.length,
    successRateLast10,
    failedRecentCount,
    latest: {
      id: latestRun.id,
      name: latestRun.name || latestRun.display_title || "Workflow run",
      status: latestRun.status || null,
      conclusion: latestRun.conclusion || null,
      event: latestRun.event || null,
      branch: latestRun.head_branch || null,
      createdAt: latestRun.created_at || null,
      startedAt: latestRun.run_started_at || latestRun.created_at || null,
      updatedAt: latestRun.updated_at || null,
      durationSeconds: durationSeconds(latestRun),
      url: latestRun.html_url || null,
      runNumber: latestRun.run_number || null,
    },
  };
}
