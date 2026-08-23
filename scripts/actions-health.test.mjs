import test from "node:test";
import assert from "node:assert/strict";
import { summarizeActions } from "./actions-health.mjs";

test("no workflows is gray and not configured", () => {
  const result = summarizeActions(0, { workflow_runs: [] });
  assert.equal(result.state, "not-configured");
  assert.equal(result.color, "gray");
  assert.deepEqual(result.runs, []);
});

test("latest successful run is green and retained in execution history", () => {
  const result = summarizeActions(2, { workflow_runs: [{ id: 1, name: "CI", status: "completed", conclusion: "success", event: "push", head_branch: "main", run_number: 7, html_url: "https://github.com/example/actions/runs/1", created_at: "2026-08-23T10:00:00Z", run_started_at: "2026-08-23T10:00:10Z", updated_at: "2026-08-23T10:02:10Z" }] });
  assert.equal(result.state, "green");
  assert.equal(result.successRateLast10, 100);
  assert.equal(result.latest.durationSeconds, 120);
  assert.equal(result.runs.length, 1);
  assert.equal(result.runs[0].branch, "main");
  assert.equal(result.runs[0].runNumber, 7);
});

test("latest failed run is red and counts failures across retained history", () => {
  const result = summarizeActions(1, { workflow_runs: [
    { id: 2, name: "CI", status: "completed", conclusion: "failure", created_at: "2026-08-23T10:00:00Z", updated_at: "2026-08-23T10:01:00Z" },
    { id: 1, name: "CI", status: "completed", conclusion: "success", created_at: "2026-08-22T10:00:00Z", updated_at: "2026-08-22T10:01:00Z" }
  ] });
  assert.equal(result.state, "red");
  assert.equal(result.failedRecentCount, 1);
  assert.equal(result.successRateLast10, 50);
  assert.equal(result.runs.length, 2);
});

test("only ten runs are retained", () => {
  const workflow_runs = Array.from({ length: 14 }, (_, index) => ({
    id: 100 - index,
    name: "CI",
    status: "completed",
    conclusion: "success",
    created_at: `2026-08-${String(23 - index).padStart(2, "0")}T10:00:00Z`,
    updated_at: `2026-08-${String(23 - index).padStart(2, "0")}T10:01:00Z`,
  }));
  const result = summarizeActions(1, { workflow_runs });
  assert.equal(result.runs.length, 10);
  assert.equal(result.recentRuns, 10);
});

test("in progress run is yellow", () => {
  const result = summarizeActions(1, { workflow_runs: [{ id: 3, name: "Deploy", status: "in_progress", conclusion: null, created_at: "2026-08-23T10:00:00Z", updated_at: "2026-08-23T10:00:10Z" }] });
  assert.equal(result.state, "running");
  assert.equal(result.color, "yellow");
});

test("missing Actions permission remains unknown instead of failing repo health", () => {
  const result = summarizeActions(1, null);
  assert.equal(result.state, "unknown");
  assert.equal(result.successRateLast10, null);
  assert.equal(result.runs, null);
});
