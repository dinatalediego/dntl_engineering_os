import rawInventory from "../data/inventory.json";

export type Health = "healthy" | "watch" | "risk" | "unknown";
export type ActionState = "green" | "red" | "yellow" | "running" | "unknown" | "idle" | "not-configured";
export type Severity = "critical" | "high" | "medium" | "low" | "clear";
export type View = "command" | "executions" | "systems" | "dependencies" | "governance";

export type RunSummary = {
  id: number;
  name: string;
  status: string | null;
  conclusion: string | null;
  event: string | null;
  branch: string | null;
  createdAt: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  durationSeconds: number | null;
  url: string | null;
  runNumber: number | null;
};

export type ActionTelemetry = {
  state: ActionState;
  color: "green" | "red" | "yellow" | "gray";
  label: string;
  workflowCount: number | null;
  recentRuns: number | null;
  successRateLast10: number | null;
  failedRecentCount: number | null;
  reason?: string;
  latest: RunSummary | null;
  runs?: RunSummary[] | null;
};

export type Priority = {
  score: number;
  severity: Severity;
  primaryReason: string;
  signals: Array<{ points: number; reason: string; code: string }>;
};

export type Repo = {
  name: string;
  fullName: string;
  url: string;
  visibility: string;
  score: number | null;
  health: Health;
  type: string;
  criticality?: string;
  deployment: string;
  database: string;
  tests: string;
  lastActivity: string | null;
  attention?: string[];
  tags?: string[];
  components?: Record<string, number>;
  evidence?: {
    coverage?: string;
    hasReadme?: boolean;
    workflowCount?: number;
    hasTests?: boolean;
    hasManifest?: boolean;
    hasDocker?: boolean;
    hasVercelConfig?: boolean;
    trackedEnvFile?: boolean;
    fileCount?: number;
    recursiveTree?: boolean;
  };
  actions?: ActionTelemetry;
  priority?: Priority;
};

export type Inventory = {
  schemaVersion?: number;
  generatedAt: string;
  source: string;
  fullPrivateCoverage: boolean;
  portfolioScore?: number | null;
  coverage: { discovered: number; scored: number; unknown: number };
  actionsSummary?: {
    configured: number;
    green: number;
    red: number;
    yellow: number;
    unknown: number;
    idle: number;
    notConfigured: number;
  };
  attentionSummary?: Record<Severity, number>;
  repositories: Repo[];
};

export type GovernanceControl = { key: string; label: string; pass: boolean; evidence: string };

export const inventory = rawInventory as unknown as Inventory;
export const repos = inventory.repositories;

const EMPTY_ACTIONS: ActionTelemetry = {
  state: "unknown",
  color: "gray",
  label: "Not scanned yet",
  workflowCount: null,
  recentRuns: null,
  successRateLast10: null,
  failedRecentCount: null,
  latest: null,
  runs: null,
};

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  clear: "Clear",
};

export const healthLabel: Record<Health, string> = {
  healthy: "Healthy",
  watch: "Watch",
  risk: "At risk",
  unknown: "Not scanned",
};

export function unique(values: string[]) {
  return ["All", ...Array.from(new Set(values.filter(Boolean))).sort()];
}

export function actionsOf(repo: Repo) {
  return repo.actions || EMPTY_ACTIONS;
}

export function fallbackPriority(repo: Repo): Priority {
  const ci = actionsOf(repo);
  let score = ci.state === "red" ? 70 : ci.state === "unknown" && (ci.workflowCount || repo.evidence?.workflowCount) ? 28 : ci.state === "yellow" ? 22 : ci.state === "running" ? 10 : 0;
  score += repo.health === "risk" ? 35 : repo.health === "unknown" ? 30 : repo.health === "watch" ? 18 : 0;
  if (repo.tests === "Missing") score += 10;
  if (repo.evidence?.trackedEnvFile) score += 30;
  score = Math.min(100, score);
  const severity: Severity = score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : score > 0 ? "low" : "clear";
  return {
    score,
    severity,
    primaryReason: repo.attention?.[0] || (ci.state === "red" ? "Latest GitHub Actions run is failing" : score ? "Repository needs intervention" : "No active intervention signal"),
    signals: (repo.attention || []).map((reason) => ({ points: 0, reason, code: "legacy:attention" })),
  };
}

export function priorityOf(repo: Repo) {
  return repo.priority || fallbackPriority(repo);
}

export function actionTone(state: ActionState) {
  if (state === "green") return "good";
  if (state === "red") return "risk";
  if (["yellow", "running"].includes(state)) return "watch";
  return "neutral";
}

export function runTone(run: RunSummary): "good" | "risk" | "watch" | "neutral" {
  if (run.status && run.status !== "completed") return "watch";
  if (run.conclusion === "success") return "good";
  if (["failure", "timed_out", "action_required", "startup_failure", "stale"].includes(run.conclusion || "")) return "risk";
  if (["cancelled", "neutral", "skipped"].includes(run.conclusion || "")) return "watch";
  return "neutral";
}

export function runLabel(run: RunSummary) {
  if (run.status && run.status !== "completed") return run.status;
  return run.conclusion || run.status || "unknown";
}

export function ageLabel(value: string | null) {
  if (!value) return "—";
  const base = new Date(inventory.generatedAt).getTime();
  const ms = Math.max(0, base - new Date(value).getTime());
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function durationLabel(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

export function yesNo(value: boolean | undefined) {
  return value ? "Present" : "Missing";
}

export function executionRuns(repo: Repo) {
  const ci = actionsOf(repo);
  if (Array.isArray(ci.runs)) return ci.runs;
  return ci.latest ? [ci.latest] : [];
}

export function observedDependencies(repo: Repo) {
  const dependencies: string[] = [];
  if ((repo.evidence?.workflowCount || 0) > 0) dependencies.push("GitHub Actions");
  if (repo.database && !["Not detected", "Unknown"].includes(repo.database)) dependencies.push(repo.database);
  if (repo.deployment === "Vercel-ready") dependencies.push("Vercel-ready");
  if (repo.deployment === "Container-ready") dependencies.push("Container-ready");
  return Array.from(new Set(dependencies));
}

export function governanceControls(repo: Repo): GovernanceControl[] {
  const evidence = repo.evidence || {};
  return [
    { key: "readme", label: "README", pass: Boolean(evidence.hasReadme), evidence: evidence.hasReadme ? "Root README present" : "Root README missing" },
    { key: "tests", label: "Tests", pass: Boolean(evidence.hasTests), evidence: evidence.hasTests ? "Automated tests detected" : "Automated tests missing" },
    { key: "ci", label: "CI", pass: (evidence.workflowCount || 0) > 0, evidence: `${evidence.workflowCount || 0} workflow(s) detected` },
    { key: "manifest", label: "Manifest", pass: Boolean(evidence.hasManifest), evidence: evidence.hasManifest ? "Runtime manifest present" : "Runtime manifest missing" },
    { key: "secrets", label: ".env hygiene", pass: !evidence.trackedEnvFile, evidence: evidence.trackedEnvFile ? "Tracked .env-like file detected" : "No tracked .env-like file detected" },
    { key: "tree", label: "Full tree", pass: Boolean(evidence.recursiveTree), evidence: evidence.recursiveTree ? "Recursive tree inspected" : "Repository tree only partially inspected" },
  ];
}
