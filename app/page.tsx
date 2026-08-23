"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Filter,
  Gauge,
  GitBranch,
  LayoutDashboard,
  PlayCircle,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import rawInventory from "../data/inventory.json";

type Health = "healthy" | "watch" | "risk" | "unknown";
type ActionState = "green" | "red" | "yellow" | "running" | "unknown" | "idle" | "not-configured";

type ActionTelemetry = {
  state: ActionState;
  color: "green" | "red" | "yellow" | "gray";
  label: string;
  workflowCount: number | null;
  recentRuns: number | null;
  successRateLast10: number | null;
  failedRecentCount: number | null;
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

type Repo = {
  name: string;
  fullName: string;
  url: string;
  visibility: string;
  score: number | null;
  health: Health;
  type: string;
  deployment: string;
  database: string;
  tests: string;
  lastActivity: string | null;
  attention?: string[];
  tags?: string[];
  evidence?: { coverage?: string };
  actions?: ActionTelemetry;
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
  repositories: Repo[];
};

const inventory = rawInventory as unknown as Inventory;
const repos = inventory.repositories;

const statusMeta: Record<Health, { label: string; icon: typeof CheckCircle2; css: string }> = {
  healthy: { label: "Healthy", icon: CheckCircle2, css: "healthy" },
  watch: { label: "Watch", icon: AlertTriangle, css: "watch" },
  risk: { label: "At risk", icon: TriangleAlert, css: "risk" },
  unknown: { label: "Not scanned", icon: CircleDot, css: "watch" },
};

function unique(values: string[]) {
  return ["All", ...Array.from(new Set(values.filter(Boolean))).sort()];
}

function actionsOf(repo: Repo): ActionTelemetry {
  return repo.actions || {
    state: "unknown",
    color: "gray",
    label: "Not scanned yet",
    workflowCount: null,
    recentRuns: null,
    successRateLast10: null,
    failedRecentCount: null,
    latest: null,
  };
}

function actionStyle(color: ActionTelemetry["color"]): React.CSSProperties {
  if (color === "green") return { background: "#edf8f0", color: "#15803d" };
  if (color === "red") return { background: "#fff0ed", color: "#b42318" };
  if (color === "yellow") return { background: "#fff7e6", color: "#986915" };
  return { background: "#eff2f5", color: "#65717d" };
}

function ageLabel(value: string | null) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function durationLabel(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState("All");
  const [actions, setActions] = useState("All");
  const [type, setType] = useState("All");
  const [visibility, setVisibility] = useState("All");
  const [observability, setObservability] = useState("All");
  const [deployment, setDeployment] = useState("All");
  const [focus, setFocus] = useState(false);

  const filtered = useMemo(() => repos.filter((repo) => {
    const ci = actionsOf(repo);
    const haystack = `${repo.name} ${repo.fullName} ${(repo.tags || []).join(" ")} ${repo.type} ${repo.database} ${ci.latest?.name || ""} ${ci.latest?.branch || ""}`.toLowerCase();
    const coverage = repo.evidence?.coverage || "unknown";
    const matchesFocus = !focus || repo.health !== "healthy" || repo.tests === "Missing" || ["red", "yellow", "running", "unknown"].includes(ci.state);
    return haystack.includes(query.toLowerCase()) &&
      (health === "All" || repo.health === health) &&
      (actions === "All" || ci.state === actions) &&
      (type === "All" || repo.type === type) &&
      (visibility === "All" || repo.visibility === visibility) &&
      (observability === "All" || coverage === observability) &&
      (deployment === "All" || repo.deployment === deployment) && matchesFocus;
  }), [query, health, actions, type, visibility, observability, deployment, focus]);

  const activeFilters = [health, actions, type, visibility, observability, deployment].filter(v => v !== "All").length + (focus ? 1 : 0);
  const scoredVisible = filtered.filter((r) => typeof r.score === "number");
  const avgScore = scoredVisible.length ? Math.round(scoredVisible.reduce((sum, r) => sum + (r.score || 0), 0) / scoredVisible.length) : null;
  const failingActions = filtered.filter(r => actionsOf(r).state === "red").length;
  const runningActions = filtered.filter(r => actionsOf(r).state === "running").length;
  const actionUnknowns = filtered.filter(r => actionsOf(r).state === "unknown").length;
  const repositoryAttention = filtered.filter(r => r.health === "risk" || r.health === "watch").length;

  const clearFilters = () => {
    setHealth("All"); setActions("All"); setType("All"); setVisibility("All"); setObservability("All"); setDeployment("All"); setFocus(false); setQuery("");
  };

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>DNTL</strong><span>Engineering OS</span></div></div>
        <nav>
          <button className="nav-item active"><LayoutDashboard size={17}/>Overview</button>
          <button className="nav-item"><Boxes size={17}/>Repositories</button>
          <button className="nav-item"><PlayCircle size={17}/>Actions Health</button>
          <button className="nav-item"><GitBranch size={17}/>Dependencies</button>
          <button className="nav-item"><ShieldCheck size={17}/>Governance</button>
        </nav>
        <div className="sidebar-foot">
          <span className="tiny-label">CONTROL PLANE</span>
          <div className="sync"><CircleDot size={14}/><div><strong>GitHub telemetry</strong><span>schema v{inventory.schemaVersion || 1} · {inventory.coverage.scored}/{inventory.coverage.discovered} scored</span></div></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">PORTFOLIO CONTROL</p><h1>Engineering Command Center</h1><p className="subhead">Repository Health tells you how well a repo is engineered. Actions Health tells you whether its automation is actually working now. Snapshot: {new Date(inventory.generatedAt).toLocaleString()}.</p></div>
          <button className="focus-btn" onClick={() => setFocus(!focus)}><Gauge size={17}/>{focus ? "Showing intervention queue" : "Focus mode"}</button>
        </header>

        <section className="metrics-grid">
          <Metric label="Repositories" value={inventory.coverage.discovered} detail={`${inventory.coverage.scored} structurally scored`} icon={<Boxes size={19}/>} />
          <Metric label="Repository health" value={avgScore === null ? "—" : `${avgScore}%`} detail="Structural, evidence-backed score" icon={<ShieldCheck size={19}/>} />
          <Metric label="Actions failing" value={failingActions} detail={`${runningActions} running · ${actionUnknowns} unknown`} icon={<TriangleAlert size={19}/>} warn={failingActions > 0} />
          <Metric label="Repo attention" value={repositoryAttention} detail="Risk + watch in current view" icon={<AlertTriangle size={19}/>} />
        </section>

        <section className="filter-panel">
          <div className="filter-heading"><div><Filter size={17}/><strong>Control filters</strong><span>{activeFilters ? `${activeFilters} active` : "All systems"}</span></div>{activeFilters > 0 || query ? <button onClick={clearFilters}><X size={14}/>Clear</button> : null}</div>
          <div className="filter-grid">
            <label className="search-box"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search repo, workflow, branch, tag or database…" /></label>
            <Select label="Repo health" value={health} onChange={setHealth} options={unique(repos.map(r => r.health))} />
            <Select label="Actions" value={actions} onChange={setActions} options={unique(repos.map(r => actionsOf(r).state))} />
            <Select label="System type" value={type} onChange={setType} options={unique(repos.map(r => r.type))} />
            <Select label="Visibility" value={visibility} onChange={setVisibility} options={unique(repos.map(r => r.visibility))} />
            <Select label="Evidence" value={observability} onChange={setObservability} options={unique(repos.map(r => r.evidence?.coverage || "unknown"))} />
            <Select label="Delivery" value={deployment} onChange={setDeployment} options={unique(repos.map(r => r.deployment))} />
          </div>
        </section>

        <section className="workspace-grid">
          <div className="table-card">
            <div className="card-head"><div><p className="eyebrow">REPO + ACTIONS HEALTH</p><h2>What needs intervention now?</h2></div><span>{filtered.length} results</span></div>
            <div className="repo-list">
              {filtered.map(repo => {
                const meta = statusMeta[repo.health] || statusMeta.unknown;
                const StatusIcon = meta.icon;
                const ci = actionsOf(repo);
                return (
                  <article className="repo-row" key={repo.fullName}>
                    <div className={`status-dot ${meta.css}`} title={`Repository: ${meta.label}`}><StatusIcon size={15}/></div>
                    <div className="repo-main">
                      <div className="repo-title"><a href={repo.url} target="_blank" rel="noreferrer"><strong>{repo.name}</strong></a><span className="type-badge">{repo.type}</span><span className="criticality" style={actionStyle(ci.color)}>CI · {ci.label}</span></div>
                      <div className="tags">{(repo.tags || []).slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}<span>{repo.visibility}</span>{ci.latest?.name && <span>{ci.latest.name}</span>}</div>
                    </div>
                    <div className="repo-meta">
                      <span>Last CI<strong>{ci.latest ? ageLabel(ci.latest.updatedAt) : "—"}</strong></span>
                      <span>Duration<strong>{ci.latest ? durationLabel(ci.latest.durationSeconds) : "—"}</strong></span>
                      <span>Last 10<strong>{ci.successRateLast10 === null ? "—" : `${ci.successRateLast10}% pass`}</strong></span>
                      <span>Branch<strong>{ci.latest?.branch || "—"}</strong></span>
                    </div>
                    <div className="score"><strong>{typeof repo.score === "number" ? repo.score : "—"}</strong><span>{typeof repo.score === "number" ? "/100 repo" : ""}</span></div>
                    <div className="attention">
                      {ci.latest?.url ? <a href={ci.latest.url} target="_blank" rel="noreferrer"><span>{repo.attention?.[0] || ci.label}</span><ChevronRight size={16}/></a> : <><span>{repo.attention?.[0] || ci.label}</span><ChevronRight size={16}/></>}
                    </div>
                  </article>
                );
              })}
              {!filtered.length && <div className="empty"><Search size={24}/><strong>No repositories match these filters</strong><span>Clear filters to widen the operating view.</span></div>}
            </div>
          </div>

          <aside className="right-rail">
            <div className="rail-card priority-card"><p className="eyebrow">INTERVENTION LOGIC</p><h3>Red CI outranks structural debt.</h3><p>Focus mode first surfaces failing/running/unknown Actions, then repository risk, watch status and test gaps. Runtime evidence gets priority over cosmetic maturity.</p><button onClick={() => setFocus(true)}>Show intervention queue<ChevronRight size={16}/></button></div>
            <div className="rail-card"><p className="eyebrow">ACTIONS HEALTH</p><div className="control-flow"><Flow icon={<CheckCircle2 size={16}/>} title={`${inventory.actionsSummary?.green ?? 0} green`} detail="Latest run succeeded"/><Flow icon={<TriangleAlert size={16}/>} title={`${inventory.actionsSummary?.red ?? 0} red`} detail="Latest run failed"/><Flow icon={<Activity size={16}/>} title={`${inventory.actionsSummary?.yellow ?? 0} active / attention`} detail="Running, cancelled or neutral"/><Flow icon={<CircleDot size={16}/>} title={`${inventory.actionsSummary?.unknown ?? 0} unknown`} detail="Permission or evidence gap"/></div></div>
            <div className="rail-card"><p className="eyebrow">WHAT IS MEASURED</p><ul className="signal-list"><li><span className="signal good"></span>Latest workflow conclusion</li><li><span className="signal watch"></span>Duration + branch + trigger</li><li><span className="signal risk"></span>Failures and pass rate across last 10 runs</li></ul></div>
          </aside>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, icon, warn = false }: { label: string; value: string | number; detail: string; icon: React.ReactNode; warn?: boolean }) {
  return <div className={`metric-card ${warn ? "warn" : ""}`}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="select-wrap"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o} value={o}>{o === "All" ? `All ${label.toLowerCase()}` : o}</option>)}</select></label>;
}

function Flow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="flow-item"><div>{icon}</div><span><strong>{title}</strong><small>{detail}</small></span></div>;
}
