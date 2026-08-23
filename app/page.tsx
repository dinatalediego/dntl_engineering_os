"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Database,
  Filter,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import inventory from "../data/inventory.json";

type Health = "healthy" | "watch" | "risk" | "unknown";
type Repo = (typeof inventory.repositories)[number];

const repos = inventory.repositories as Repo[];

const statusMeta: Record<Health, { label: string; icon: typeof CheckCircle2; css: string }> = {
  healthy: { label: "Healthy", icon: CheckCircle2, css: "healthy" },
  watch: { label: "Watch", icon: AlertTriangle, css: "watch" },
  risk: { label: "At risk", icon: TriangleAlert, css: "risk" },
  unknown: { label: "Not scanned", icon: CircleDot, css: "watch" },
};

function unique(values: string[]) {
  return ["All", ...Array.from(new Set(values.filter(Boolean))).sort()];
}

function ageLabel(value: string | null) {
  if (!value) return "unknown";
  const ms = Date.now() - new Date(value).getTime();
  const days = Math.max(0, Math.floor(ms / 86400000));
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  return `${months} mo`;
}

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState("All");
  const [type, setType] = useState("All");
  const [visibility, setVisibility] = useState("All");
  const [observability, setObservability] = useState("All");
  const [deployment, setDeployment] = useState("All");
  const [focus, setFocus] = useState(false);

  const healthOptions = unique(repos.map((r) => r.health));
  const typeOptions = unique(repos.map((r) => r.type));
  const visibilityOptions = unique(repos.map((r) => r.visibility));
  const deploymentOptions = unique(repos.map((r) => r.deployment));

  const filtered = useMemo(() => repos.filter((repo) => {
    const haystack = `${repo.name} ${repo.fullName} ${(repo.tags || []).join(" ")} ${repo.type} ${repo.database}`.toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase());
    const matchesHealth = health === "All" || repo.health === health;
    const matchesType = type === "All" || repo.type === type;
    const matchesVisibility = visibility === "All" || repo.visibility === visibility;
    const coverage = repo.evidence?.coverage || "unknown";
    const matchesObservability = observability === "All" || coverage === observability;
    const matchesDeployment = deployment === "All" || repo.deployment === deployment;
    const matchesFocus = !focus || repo.health === "risk" || repo.health === "watch" || repo.health === "unknown" || repo.tests === "Missing";
    return matchesQuery && matchesHealth && matchesType && matchesVisibility && matchesObservability && matchesDeployment && matchesFocus;
  }), [query, health, type, visibility, observability, deployment, focus]);

  const activeFilters = [health, type, visibility, observability, deployment].filter(v => v !== "All").length + (focus ? 1 : 0);
  const scoredVisible = filtered.filter((r) => typeof r.score === "number");
  const avgScore = scoredVisible.length ? Math.round(scoredVisible.reduce((sum, r) => sum + (r.score || 0), 0) / scoredVisible.length) : null;
  const riskCount = filtered.filter(r => r.health === "risk").length;
  const watchCount = filtered.filter(r => r.health === "watch").length;
  const unknownCount = filtered.filter(r => r.health === "unknown").length;
  const testGaps = filtered.filter(r => r.tests === "Missing").length;

  const clearFilters = () => {
    setHealth("All"); setType("All"); setVisibility("All"); setObservability("All"); setDeployment("All"); setFocus(false); setQuery("");
  };

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>DNTL</strong><span>Engineering OS</span></div></div>
        <nav>
          <button className="nav-item active"><LayoutDashboard size={17}/>Overview</button>
          <button className="nav-item"><Boxes size={17}/>Repositories</button>
          <button className="nav-item"><Activity size={17}/>Executions</button>
          <button className="nav-item"><GitBranch size={17}/>Dependencies</button>
          <button className="nav-item"><ShieldCheck size={17}/>Governance</button>
        </nav>
        <div className="sidebar-foot">
          <span className="tiny-label">CONTROL PLANE</span>
          <div className="sync"><CircleDot size={14}/><div><strong>{inventory.source === "github-api" ? "Inventory generated" : "Bootstrap mode"}</strong><span>{inventory.coverage.scored}/{inventory.coverage.discovered} repos scored</span></div></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">PORTFOLIO CONTROL</p><h1>Engineering Command Center</h1><p className="subhead">GitHub evidence → reproducible health score → intervention queue. Last snapshot: {new Date(inventory.generatedAt).toLocaleString()}.</p></div>
          <button className="focus-btn" onClick={() => setFocus(!focus)}><Gauge size={17}/>{focus ? "Showing attention only" : "Focus mode"}</button>
        </header>

        {!inventory.fullPrivateCoverage && (
          <section className="filter-panel" style={{ marginBottom: 18 }}>
            <div className="filter-heading"><div><ShieldCheck size={17}/><strong>Coverage guardrail</strong><span>Public repositories are scannable now. Private repositories require DNTL_GITHUB_TOKEN for full evidence; they must remain “Not scanned” rather than receiving a fabricated score.</span></div></div>
          </section>
        )}

        <section className="metrics-grid">
          <Metric label="Discovered repositories" value={inventory.coverage.discovered} detail={`${inventory.coverage.scored} scored · ${inventory.coverage.unknown} unknown`} icon={<Boxes size={19}/>} />
          <Metric label="Portfolio health" value={avgScore === null ? "—" : `${avgScore}%`} detail="Evidence-backed scored repos" icon={<Activity size={19}/>} />
          <Metric label="Need attention" value={riskCount + watchCount} detail={`${riskCount} risk · ${watchCount} watch`} icon={<AlertTriangle size={19}/>} warn />
          <Metric label="Observability gaps" value={unknownCount} detail={`${testGaps} visible test gaps`} icon={<ShieldCheck size={19}/>} />
        </section>

        <section className="filter-panel">
          <div className="filter-heading"><div><Filter size={17}/><strong>Portfolio filters</strong><span>{activeFilters ? `${activeFilters} active` : "All observable systems"}</span></div>{activeFilters > 0 || query ? <button onClick={clearFilters}><X size={14}/>Clear</button> : null}</div>
          <div className="filter-grid">
            <label className="search-box"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search repo, tag, database or capability…" /></label>
            <Select label="Health" value={health} onChange={setHealth} options={healthOptions} />
            <Select label="System type" value={type} onChange={setType} options={typeOptions} />
            <Select label="Visibility" value={visibility} onChange={setVisibility} options={visibilityOptions} />
            <Select label="Evidence" value={observability} onChange={setObservability} options={unique(repos.map(r => r.evidence?.coverage || "unknown"))} />
            <Select label="Delivery" value={deployment} onChange={setDeployment} options={deploymentOptions} />
          </div>
        </section>

        <section className="workspace-grid">
          <div className="table-card">
            <div className="card-head"><div><p className="eyebrow">REPOSITORY HEALTH</p><h2>Where should I intervene?</h2></div><span>{filtered.length} results</span></div>
            <div className="repo-list">
              {filtered.map(repo => {
                const meta = statusMeta[(repo.health as Health) || "unknown"] || statusMeta.unknown;
                const StatusIcon = meta.icon;
                return (
                  <article className="repo-row" key={repo.fullName}>
                    <div className={`status-dot ${meta.css}`} title={meta.label}><StatusIcon size={15}/></div>
                    <div className="repo-main"><div className="repo-title"><a href={repo.url} target="_blank" rel="noreferrer"><strong>{repo.name}</strong></a><span className="type-badge">{repo.type}</span><span className={`criticality ${repo.visibility === "private" ? "high" : "medium"}`}>{repo.visibility}</span></div><div className="tags">{(repo.tags || []).slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}<span>{repo.evidence?.coverage || "unknown"} evidence</span></div></div>
                    <div className="repo-meta"><span>Delivery<strong>{repo.deployment}</strong></span><span>Data<strong>{repo.database}</strong></span><span>Tests<strong>{repo.tests}</strong></span><span>Activity<strong>{ageLabel(repo.lastActivity)}</strong></span></div>
                    <div className="score"><strong>{typeof repo.score === "number" ? repo.score : "—"}</strong><span>{typeof repo.score === "number" ? "/100" : ""}</span></div>
                    <div className="attention"><span>{repo.attention?.[0] || "No signal"}</span><ChevronRight size={16}/></div>
                  </article>
                );
              })}
              {!filtered.length && <div className="empty"><Search size={24}/><strong>No repositories match these filters</strong><span>Clear one or more filters to widen the operating view.</span></div>}
            </div>
          </div>

          <aside className="right-rail">
            <div className="rail-card priority-card"><p className="eyebrow">TODAY&apos;S PRIORITY</p><h3>Fix evidence gaps before treating unknowns as risk.</h3><p>Focus mode surfaces risk/watch repositories plus anything the control plane cannot inspect confidently.</p><button onClick={() => setFocus(true)}>Show intervention queue<ChevronRight size={16}/></button></div>
            <div className="rail-card"><p className="eyebrow">HEALTH SCORE v1</p><div className="control-flow"><Flow icon={<Activity size={16}/>} title="Freshness · 25" detail="Recent repository activity"/><Flow icon={<Database size={16}/>} title="Docs + Ops · 25" detail="README · runtime manifest"/><Flow icon={<ServerCog size={16}/>} title="Automation · 20" detail="GitHub Actions workflows"/><Flow icon={<ShieldCheck size={16}/>} title="Tests + Hygiene · 30" detail="Tests · archive · env files"/></div></div>
            <div className="rail-card"><p className="eyebrow">SCAN COVERAGE</p><ul className="signal-list"><li><span className="signal good"></span>{inventory.coverage.scored} evidence-backed scores</li><li><span className="signal watch"></span>{inventory.coverage.unknown} repositories not fully observable</li><li><span className="signal risk"></span>{testGaps} visible repositories missing tests</li></ul></div>
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
