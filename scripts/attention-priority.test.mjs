import test from "node:test";
import assert from "node:assert/strict";
import { prioritizeRepository } from "./attention-priority.mjs";

test("failing CI outranks structural debt", () => {
  const failing = prioritizeRepository({
    health: "healthy",
    tests: "Detected",
    evidence: { workflowCount: 1 },
    actions: { state: "red", workflowCount: 1, failedRecentCount: 1, latest: { name: "CI" } },
  });
  const structural = prioritizeRepository({
    health: "risk",
    tests: "Missing",
    evidence: { workflowCount: 0 },
    actions: { state: "not-configured", workflowCount: 0, failedRecentCount: 0 },
  });

  assert.equal(failing.severity, "high");
  assert.ok(failing.score > structural.score);
  assert.match(failing.primaryReason, /failing/i);
});

test("repeated failures increase urgency", () => {
  const oneFailure = prioritizeRepository({
    health: "healthy",
    tests: "Detected",
    evidence: { workflowCount: 1 },
    actions: { state: "red", workflowCount: 1, failedRecentCount: 1 },
  });
  const repeated = prioritizeRepository({
    health: "healthy",
    tests: "Detected",
    evidence: { workflowCount: 1 },
    actions: { state: "red", workflowCount: 1, failedRecentCount: 4 },
  });

  assert.ok(repeated.score > oneFailure.score);
  assert.ok(repeated.signals.some((signal) => signal.code === "actions:repeated-failures"));
});

test("healthy passing repository has no active intervention signal", () => {
  const result = prioritizeRepository({
    health: "healthy",
    tests: "Detected",
    evidence: { workflowCount: 1, trackedEnvFile: false },
    actions: { state: "green", workflowCount: 1, failedRecentCount: 0 },
  });

  assert.equal(result.score, 0);
  assert.equal(result.severity, "clear");
  assert.equal(result.primaryReason, "No active intervention signal");
});

test("tracked environment file becomes a security intervention", () => {
  const result = prioritizeRepository({
    health: "healthy",
    tests: "Detected",
    evidence: { trackedEnvFile: true },
    actions: { state: "green", failedRecentCount: 0 },
  });

  assert.equal(result.severity, "medium");
  assert.ok(result.signals.some((signal) => signal.code === "security:tracked-env"));
});
