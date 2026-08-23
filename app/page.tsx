"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Command,
  Database,
  Filter,
  Gauge,
  GitBranch,
  Github,
  LayoutDashboard,
  ListChecks,
  Network,
  PlayCircle,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import rawInventory from "../data/inventory.json";

type Health = "healthy" | "watch" | "risk" | "unknown";
type ActionState = "green" | "red" | "yellow" | "running" | "unknown" | "idle" | "not-configured";
type Severity = "critical" | "high" | "medium" | "low" | "clear";

type ActionTelemetry = {
  state: ActionState;
  color: "green" | "red" | "yellow" | "gray";
  label: string;
  workflowCount: number | null;
  recentRuns: number | null;
  successRateLast10: number | null;
  failedRecentCount: number | null;
  reason?: string;
  latest: null | {
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
};

type Priority = {
  score: number;
  severity: Severity;
  primaryReason: string;
  signals: Array<{ points: number; reason: string; code: string }>;
};

type Repo = {
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

type Inventory = {
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

const inventory = rawInventory as unknown as Inventory;
const repos = inventory.repositories;
const EMPTY_ACTIONS: ActionTelemetry = {
  state: "unknown",
  color: "gray",
  label: "Not scanned yet",
  workflowCount: null,
  recentRuns: null,
  successRateLast10: null,
  failedRecentCount: null,
  latest: null,
};

const statusMeta: Record<Health, { label: string; icon: typeof CheckCircle2; css: string }> = {
  healthy: { label: "Healthy", icon: CheckCircle2, css: "healthy" },
  watch: { label: "Watch", icon: AlertTriangle, css: "watch" },
  risk: { label: "At risk", icon: TriangleAlert, css: "risk" },
  unknown: { label: "Not scanned", icon: CircleDot, css: "unknown" },
};

const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  clear: "Clear",
};

function unique(values: string[]) {
  return ["All", ...Array.from(new Set(values.filter(Boolean))).sort()];
}

function actionsOf(repo: Repo) {
  return repo.actions || EMPTY_ACTIONS;
}

function fallbackPriority(repo: Repo): Priority {
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

function priorityOf(repo: Repo) {
  return repo.priority || fallbackPriority(repo);
}

function actionTone(state: ActionState) {
  if (state === "green") return "good";
  if (state === "red") return "risk";
  if (["yellow", "running"].includes(state)) return "watch";
  return "neutral";
}

function ageLabel(value: string | null) {
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

function durationLabel(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

function yesNo(value: boolean | undefined) {
  return value ? "Present" : "Missing";
}

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState("All");
  const [actions, setActions] = useState("All");
  const [severity, setSeverity] = useState("All");
  const [type, setType] = useState("All");
  const [visibility, setVisibility] = useState("All");
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [focus, setFocus] = useState(true);

  useEffect(() => {
    if (!selectedRepo) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedRepo(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("drawer-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("drawer-open");
    };
  }, [selectedRepo]);

  const filtered = useMemo(() => repos
    .filter((repo) => {
      const ci = actionsOf(repo);
      const priority = priorityOf(repo);
      const haystack = `${repo.name} ${repo.fullName} ${(repo.tags || []).join(" ")} ${repo.type} ${repo.database} ${ci.latest?.name || ""} ${ci.latest?.branch || ""} ${priority.primaryReason}`.toLowerCase();
      return haystack.includes(query.toLowerCase()) &&
        (health === "All" || repo.health === health) &&
        (actions === "All" || ci.state === actions) &&
        (severity === "All" || priority.severity === severity) &&
        (type === "All" || repo.type === type) &&
        (visibility === "All" || repo.visibility === visibility) &&
        (!focus || priority.score > 0);
    })
    .sort((a, b) => priorityOf(b).score - priorityOf(a).score || (b.score ?? -1) - (a.score ?? -1)),
  [query, health, actions, severity, type, visibility, focus]);

  const activeFilters = [health, actions, severity, type, visibility].filter((value) => value !== "All").length + (focus ? 1 : 0);
  const criticalCount = repos.filter((repo) => priorityOf(repo).severity === "critical").length;
  const highCount = repos.filter((repo) => priorityOf(repo).severity === "high").length;
  const failingActions = repos.filter((repo) => actionsOf(repo).state === "red").length;
  const stableCount = repos.filter((repo) => priorityOf(repo).severity === "clear").length;

  const clearFilters = () => {
    setHealth("All");
    setActions("All");
    setSeverity("All");
    setType("All");
    setVisibility("All");
    setQuery("");
    setFocus(false);
  };

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={18} /></div>
          <div><strong>DNTL</strong><span>Engineering OS</span></div>
        </div>
        <nav>
          <button className="nav-item active"><LayoutDashboard size={17}/>Command Center</button>
          <button className="nav-item"><PlayCircle size={17}/>Executions <em>next</em></button>
          <button className="nav-item"><Boxes size={17}/>Systems</button>
          <button className="nav-item"><Network size={17}/>Dependencies <em>next</em></button>
          <button className="nav-item"><ShieldCheck size={17}/>Governance <em>next</em></button>
        </nav>
        <div className="architecture-spine">
          <span className="tiny-label">OPERATING MODEL</span>
          <div className="spine-item live"><span>1</span><strong>Attention Queue</strong></div>
          <div className="spine-item live"><span>2</span><strong>Side Detail</strong></div>
          <div className="spine-item"><span>3</span><strong>Execution Timeline</strong></div>
          <div className="spine-item"><span>4</span><strong>Dependency Graph</strong></div>
          <div className="spine-item"><span>5</span><strong>Governance Matrix</strong></div>
        </div>
        <div className="sidebar-foot">
          <span className="tiny-label">CONTROL PLANE</span>
          <div className="sync"><CircleDot size={14}/><div><strong>GitHub telemetry</strong><span>schema v{inventory.schemaVersion || 1} · {inventory.coverage.scored}/{inventory.coverage.discovered} scored</span></div></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">PORTFOLIO CONTROL · LIVE EVIDENCE</p>
            <h1>Engineering Command Center</h1>
            <p className="subhead">Intervention-first control across {inventory.coverage.discovered} repositories. The queue is ranked by runtime failure, structural risk, observability gaps, testing debt and security evidence.</p>
          </div>
          <div className="top-actions">
            <button className="command-btn" title="Command Palette is the next interaction layer"><Command size={16}/><span>Command Palette</span><kbd>⌘ K</kbd></button>
            <button className={`focus-btn ${focus ? "active" : ""}`} onClick={() => setFocus(!focus)}><Gauge size={17}/>{focus ? "Attention only" : "Show attention"}</button>
          </div>
        </header>

        <section className="metrics-grid">
          <Metric label="Critical interventions" value={criticalCount} detail="Highest combined urgency" icon={<Zap size={19}/>} warn={criticalCount > 0} />
          <Metric label="High priority" value={highCount} detail="Act after critical queue" icon={<TriangleAlert size={19}/>} warn={highCount > 0} />
          <Metric label="Actions failing" value={failingActions} detail={`${inventory.actionsSummary?.configured ?? 0} repos have workflows`} icon={<Activity size={19}/>} warn={failingActions > 0} />
          <Metric label="Clear systems" value={stableCount} detail={`${inventory.coverage.discovered - stableCount} carry at least one signal`} icon={<CheckCircle2 size={19}/>} />
        </section>

        <section className="filter-panel">
          <div className="filter-heading">
            <div><Filter size={17}/><strong>Queue controls</strong><span>{activeFilters ? `${activeFilters} active` : "All systems"}</span></div>
            {(activeFilters > 0 || query) && <button onClick={clearFilters}><X size={14}/>Clear</button>}
          </div>
          <div className="filter-grid">
            <label className="search-box"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search repo, workflow, branch, database or intervention…" /></label>
            <Select label="Priority" value={severity} onChange={setSeverity} options={unique(repos.map((repo) => priorityOf(repo).severity))} />
            <Select label="Actions" value={actions} onChange={setActions} options={unique(repos.map((repo) => actionsOf(repo).state))} />
            <Select label="Repo health" value={health} onChange={setHealth} options={unique(repos.map((repo) => repo.health))} />
            <Select label="System" value={type} onChange={setType} options={unique(repos.map((repo) => repo.type))} />
            <Select label="Visibility" value={visibility} onChange={setVisibility} options={unique(repos.map((repo) => repo.visibility))} />
          </div>
        </section>

        <section className="command-grid">
          <div className="attention-card">
            <div className="card-head">
              <div><p className="eyebrow">ATTENTION QUEUE</p><h2>What should I intervene on next?</h2></div>
              <span>{filtered.length} systems · ranked automatically</span>
            </div>
            <div className="queue-head"><span>Priority</span><span>System / signal</span><span>Runtime</span><span>Structural</span><span></span></div>
            <div className="queue-list">
              {filtered.map((repo, index) => {
                const priority = priorityOf(repo);
                const ci = actionsOf(repo);
                return (
                  <button className={`queue-row ${selectedRepo?.fullName === repo.fullName ? "selected" : ""}`} key={repo.fullName} onClick={() => setSelectedRepo(repo)}>
                    <div className="priority-cell">
                      <span className={`rank severity-${priority.severity}`}>{index + 1}</span>
                      <div><strong>{priority.score}</strong><small>{severityLabel[priority.severity]}</small></div>
                    </div>
                    <div className="queue-system">
                      <div className="repo-title"><strong>{repo.name}</strong><span className="type-badge">{repo.type}</span><span className="visibility-badge">{repo.visibility}</span></div>
                      <p>{priority.primaryReason}</p>
                      <div className="tags">{(repo.tags || []).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}<span>{repo.database}</span></div>
                    </div>
                    <div className="runtime-cell">
                      <span className={`state-pill ${actionTone(ci.state)}`}><i></i>{ci.label}</span>
                      <small>{ci.latest ? `${ci.latest.name} · ${ageLabel(ci.latest.updatedAt)}` : `${ci.workflowCount ?? 0} workflow(s)`}</small>
                    </div>
                    <div className="structural-cell">
                      <strong>{repo.score ?? "—"}<small>{repo.score !== null ? "/100" : ""}</small></strong>
                      <span className={`health-text ${repo.health}`}>{statusMeta[repo.health]?.label || repo.health}</span>
                    </div>
                    <ChevronRight className="queue-chevron" size={18}/>
                  </button>
                );
              })}
              {!filtered.length && <div className="empty"><CheckCircle2 size={26}/><strong>No systems match this intervention view</strong><span>Clear filters or disable Attention only to inspect the full portfolio.</span></div>}
            </div>
          </div>

          <aside className="right-rail">
            <div className="rail-card priority-card">
              <p className="eyebrow">PRIORITY MODEL v1</p>
              <h3>Runtime incidents outrank maturity debt.</h3>
              <p>Failing CI contributes the strongest signal. Repository risk, missing observability, tests and tracked environment files add urgency. Every point is stored in the generated inventory.</p>
              <div className="priority-legend"><span><i className="critical"></i>Critical ≥75</span><span><i className="high"></i>High ≥50</span><span><i className="medium"></i>Medium ≥25</span></div>
            </div>
            <div className="rail-card">
              <p className="eyebrow">ARCHITECTURE SPINE</p>
              <div className="control-flow">
                <Flow icon={<ListChecks size={16}/>} title="Attention Queue" detail="Implemented · deterministic priority" live />
                <Flow icon={<ServerCog size={16}/>} title="Side Detail" detail="Implemented · evidence without context switching" live />
                <Flow icon={<Clock3 size={16}/>} title="Execution Timeline" detail="Next · multi-run operating history" />
                <Flow icon={<GitBranch size={16}/>} title="Dependency Graph" detail="Next · blast radius" />
                <Flow icon={<ShieldCheck size={16}/>} title="Governance Matrix" detail="Next · controls with evidence" />
              </div>
            </div>
            <div className="rail-card snapshot-card">
              <p className="eyebrow">SNAPSHOT</p>
              <strong>{new Date(inventory.generatedAt).toLocaleString()}</strong>
              <span>{inventory.fullPrivateCoverage ? "Full private coverage" : "Public-only coverage"}</span>
              <span>{inventory.actionsSummary?.green ?? 0} green · {inventory.actionsSummary?.red ?? 0} red Actions</span>
            </div>
          </aside>
        </section>
      </section>

      {selectedRepo && <RepositoryDrawer repo={selectedRepo} onClose={() => setSelectedRepo(null)} />}
    </main>
  );
}

function RepositoryDrawer({ repo, onClose }: { repo: Repo; onClose: () => void }) {
  const priority = priorityOf(repo);
  const ci = actionsOf(repo);
  const meta = statusMeta[repo.health] || statusMeta.unknown;
  const StatusIcon = meta.icon;
  const evidence = repo.evidence || {};
  const signals = priority.signals.length ? priority.signals : (repo.attention || []).map((reason) => ({ points: 0, reason, code: "attention" }));
  const components = Object.entries(repo.components || {});

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`${repo.name} repository detail`}>
      <button className="drawer-backdrop" aria-label="Close repository detail" onClick={onClose}></button>
      <aside className="detail-drawer">
        <header className="drawer-header">
          <div>
            <div className="drawer-kicker"><span className={`severity-chip severity-${priority.severity}`}>{severityLabel[priority.severity]} · {priority.score}</span><span>{repo.type} · {repo.visibility}</span></div>
            <h2>{repo.name}</h2>
            <p>{repo.fullName}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={19}/></button>
        </header>

        <div className="drawer-body">
          <section className="detail-score-grid">
            <div className="detail-score"><span>Repository Health</span><strong>{repo.score ?? "—"}<small>{repo.score !== null ? "/100" : ""}</small></strong><em className={`health-text ${repo.health}`}><StatusIcon size={13}/>{meta.label}</em></div>
            <div className="detail-score"><span>Actions Health</span><strong className={`runtime-score ${actionTone(ci.state)}`}>{ci.state === "green" ? "PASS" : ci.state === "red" ? "FAIL" : ci.state.toUpperCase()}</strong><em>{ci.successRateLast10 === null ? "No pass-rate evidence" : `${ci.successRateLast10}% pass · last ${ci.recentRuns ?? 0}`}</em></div>
            <div className="detail-score"><span>Priority</span><strong>{priority.score}<small>/100</small></strong><em className={`severity-text severity-${priority.severity}`}>{severityLabel[priority.severity]}</em></div>
          </section>

          <section className="drawer-section">
            <div className="section-title"><div><p className="eyebrow">WHY IT IS HERE</p><h3>{priority.primaryReason}</h3></div><Zap size={18}/></div>
            <div className="signal-stack">
              {signals.map((signal, index) => <div className="signal-row" key={`${signal.code}-${index}`}><span>{signal.reason}</span>{signal.points > 0 && <strong>+{signal.points}</strong>}</div>)}
              {!signals.length && <div className="signal-row clear"><span>No active intervention signal.</span><CheckCircle2 size={16}/></div>}
            </div>
          </section>

          <section className="drawer-section">
            <div className="section-title"><div><p className="eyebrow">LATEST EXECUTION</p><h3>{ci.latest?.name || "No workflow run available"}</h3></div><Activity size={18}/></div>
            {ci.latest ? <>
              <div className="execution-banner"><span className={`state-pill ${actionTone(ci.state)}`}><i></i>{ci.latest.conclusion || ci.latest.status || ci.label}</span><strong>{durationLabel(ci.latest.durationSeconds)}</strong></div>
              <div className="detail-grid">
                <Detail label="Branch" value={ci.latest.branch || "—"} />
                <Detail label="Trigger" value={ci.latest.event || "—"} />
                <Detail label="Run" value={ci.latest.runNumber ? `#${ci.latest.runNumber}` : "—"} />
                <Detail label="Last update" value={ageLabel(ci.latest.updatedAt)} />
                <Detail label="Recent failures" value={ci.failedRecentCount === null ? "—" : String(ci.failedRecentCount)} />
                <Detail label="Pass rate" value={ci.successRateLast10 === null ? "—" : `${ci.successRateLast10}%`} />
              </div>
              {ci.latest.url && <a className="primary-link" href={ci.latest.url} target="_blank" rel="noreferrer">Open GitHub Actions run <ArrowUpRight size={15}/></a>}
            </> : <div className="empty-inline">{ci.reason || ci.label}. The future Execution Timeline will retain multiple runs instead of only the latest summary.</div>}
          </section>

          <section className="drawer-section">
            <div className="section-title"><div><p className="eyebrow">OBSERVABLE EVIDENCE</p><h3>What the control plane can prove</h3></div><ShieldCheck size={18}/></div>
            <div className="evidence-grid">
              <Evidence label="Root README" value={yesNo(evidence.hasReadme)} good={Boolean(evidence.hasReadme)} />
              <Evidence label="Automated tests" value={yesNo(evidence.hasTests)} good={Boolean(evidence.hasTests)} />
              <Evidence label="GitHub workflows" value={`${evidence.workflowCount ?? 0} detected`} good={Boolean(evidence.workflowCount)} />
              <Evidence label="Runtime manifest" value={yesNo(evidence.hasManifest)} good={Boolean(evidence.hasManifest)} />
              <Evidence label="Vercel config" value={yesNo(evidence.hasVercelConfig)} good={Boolean(evidence.hasVercelConfig)} neutral={!evidence.hasVercelConfig} />
              <Evidence label="Tracked .env" value={evidence.trackedEnvFile ? "Detected" : "Clear"} good={!evidence.trackedEnvFile} />
              <Evidence label="Recursive tree" value={evidence.recursiveTree ? "Inspected" : "Partial"} good={Boolean(evidence.recursiveTree)} />
              <Evidence label="Files inspected" value={String(evidence.fileCount ?? "—")} good neutral />
            </div>
          </section>

          {components.length > 0 && <section className="drawer-section">
            <div className="section-title"><div><p className="eyebrow">STRUCTURAL SCORE</p><h3>Repository Health components</h3></div><Gauge size={18}/></div>
            <div className="component-list">
              {components.map(([name, value]) => <div className="component-row" key={name}><span>{name}</span><div><i style={{ width: `${Math.min(100, value * 4)}%` }}></i></div><strong>{value}</strong></div>)}
            </div>
          </section>}

          <section className="drawer-section future-section">
            <div className="section-title"><div><p className="eyebrow">NEXT CONTROL SURFACES</p><h3>This detail panel becomes the navigation anchor</h3></div><Network size={18}/></div>
            <div className="future-grid"><span><Clock3 size={15}/>Execution Timeline</span><span><GitBranch size={15}/>Dependency Graph</span><span><ShieldCheck size={15}/>Governance Matrix</span><span><Command size={15}/>Command Palette</span></div>
          </section>
        </div>

        <footer className="drawer-footer">
          <a className="secondary-link" href={repo.url} target="_blank" rel="noreferrer"><Github size={15}/>Open repository</a>
          {ci.latest?.url && <a className="primary-link compact" href={ci.latest.url} target="_blank" rel="noreferrer"><PlayCircle size={15}/>Inspect run</a>}
        </footer>
      </aside>
    </div>
  );
}

function Metric({ label, value, detail, icon, warn = false }: { label: string; value: string | number; detail: string; icon: React.ReactNode; warn?: boolean }) {
  return <div className={`metric-card ${warn ? "warn" : ""}`}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="select-wrap"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option === "All" ? `All ${label.toLowerCase()}` : option}</option>)}</select></label>;
}

function Flow({ icon, title, detail, live = false }: { icon: React.ReactNode; title: string; detail: string; live?: boolean }) {
  return <div className={`flow-item ${live ? "live" : ""}`}><div>{icon}</div><span><strong>{title}</strong><small>{detail}</small></span>{live && <em>live</em>}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="detail-item"><span>{label}</span><strong>{value}</strong></div>;
}

function Evidence({ label, value, good, neutral = false }: { label: string; value: string; good: boolean; neutral?: boolean }) {
  return <div className={`evidence-item ${neutral ? "neutral" : good ? "good" : "risk"}`}><span>{label}</span><strong>{value}</strong></div>;
}
