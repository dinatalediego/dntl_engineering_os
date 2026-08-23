import test from "node:test";
import assert from "node:assert/strict";
import { summarizeActions } from "./actions-health.mjs";

test("no workflows is gray and not configured", () => {
  const result = summarizeActions(0, { workflow_runs: [] });
  assert.equal(result.state, "not-configured");
  assert.equal(result.color, "gray");
});

test("latest successful run is green", () => {
  const result = summarizeActions(2, { workflow_runs: [{ id: 1, name: "CI", status: "completed", conclusion: "success", created_at: "2026-08-23T10:00:00Z", run_started_at: "2026-08-23T10:00:10Z", updated_at: "2026-08-23T10:02:10Z" }] });
  assert.equal(result.state, "green");
  assert.equal(result.successRateLast10, 100);
  assert.equal(result.latest.durationSeconds, 120);
});

test("latest failed run is red and counts failures", () => {
  const result = summarizeActions(1, { workflow_runs: [
    { id: 2, name: "CI", status: "completed", conclusion: "failure", created_at: "2026-08-23T10:00:00Z", updated_at: "2026-08-23T10:01:00Z" },
    { id: 1, name: "CI", status: "completed", conclusion: "success", created_at: "2026-08-22T10:00:00Z", updated_at: "2026-08-22T10:01:00Z" }
  ] });
  assert.equal(result.state, "red");
  assert.equal(result.failedRecentCount, 1);
  assert.equal(result.successRateLast10, 50);
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
});
