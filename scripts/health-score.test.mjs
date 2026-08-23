import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { scoreRepository } from "./health-score.mjs";

const rules = JSON.parse(await readFile(new URL("../config/health-rules.json", import.meta.url), "utf8"));
const recent = new Date().toISOString();

const repo = { pushed_at: recent, archived: false, size: 100 };
const fullEvidence = {
  coverage: "full",
  hasReadme: true,
  workflowCount: 1,
  hasTests: true,
  hasManifest: true,
  hasDocker: false,
  hasVercelConfig: false,
  trackedEnvFile: false,
};

test("healthy repository can reach 100", () => {
  const result = scoreRepository(repo, fullEvidence, rules);
  assert.equal(result.score, 100);
  assert.equal(result.health, "healthy");
});

test("missing tests and CI is visible in score and reasons", () => {
  const result = scoreRepository(repo, { ...fullEvidence, hasTests: false, workflowCount: 0 }, rules);
  assert.equal(result.score, 60);
  assert.equal(result.health, "watch");
  assert.ok(result.attention.includes("Add automated tests"));
  assert.ok(result.attention.includes("Add CI workflow"));
});

test("unknown evidence never becomes fake risk", () => {
  const result = scoreRepository(repo, { coverage: "unavailable" }, rules);
  assert.equal(result.score, null);
  assert.equal(result.health, "unknown");
});
