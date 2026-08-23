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

type Health = "healthy" | "watch" | "risk";
type SystemType = "Data" | "App" | "ML" | "Analytics" | "Automation";
type Deployment = "Vercel" | "Local" | "GitHub" | "Not deployed";
type Criticality = "High" | "Medium" | "Low";

type Repo = {
  name: string;
  type: SystemType;
  health: Health;
  score: number;
  criticality: Criticality;
  deployment: Deployment;
  database: string;
  tests: "Good" | "Partial" | "Missing";
  lastRun: string;
  attention: string;
  tags: string[];
};

const repos: Repo[] = [
  { name: "bd_replica_crm", type: "Data", health: "watch", score: 82, criticality: "High", deployment: "Local", database: "PostgreSQL", tests: "Partial", lastRun: "38 min", attention: "Validate replica freshness", tags: ["ETL", "CRM", "Redshift"] },
  { name: "dntl_chatbot", type: "App", health: "watch", score: 79, criticality: "High", deployment: "Vercel", database: "PostgreSQL", tests: "Good", lastRun: "2 h", attention: "Webhook integration pending", tags: ["API", "WhatsApp", "AI"] },
  { name: "dntl_datos", type: "Data", health: "healthy", score: 93, criticality: "Medium", deployment: "Vercel", database: "None", tests: "Good", lastRun: "today", attention: "No blockers", tags: ["PWA", "Public Data", "Explorer"] },
  { name: "dntl_economia", type: "Analytics", health: "healthy", score: 91, criticality: "Medium", deployment: "Vercel", database: "None", tests: "Good", lastRun: "today", attention: "No blockers", tags: ["Economics", "Museum", "Research"] },
  { name: "expertos_en_lavados", type: "App", health: "watch", score: 76, criticality: "Medium", deployment: "Vercel", database: "Supabase", tests: "Partial", lastRun: "today", attention: "Meta integration incomplete", tags: ["Growth", "Leads", "Supabase"] },
  { name: "limpia-fast", type: "App", health: "healthy", score: 88, criticality: "Medium", deployment: "Vercel", database: "None", tests: "Partial", lastRun: "today", attention: "Add conversion telemetry", tags: ["Landing", "Leads", "Marketing"] },
  { name: "pricing-regression-lab", type: "ML", health: "risk", score: 63, criticality: "High", deployment: "Not deployed", database: "PostgreSQL", tests: "Missing", lastRun: "12 d", attention: "No production contract", tags: ["Pricing", "ML", "Experiment"] },
  { name: "ml_redshift", type: "ML", health: "watch", score: 71, criticality: "High", deployment: "Local", database: "Redshift", tests: "Partial", lastRun: "5 d", attention: "Model monitoring missing", tags: ["ML", "Redshift", "Scoring"] },
  { name: "precios-nexo-sperant-etl", type: "Automation", health: "healthy", score: 90, criticality: "High", deployment: "GitHub", database: "None", tests: "Good", lastRun: "1 d", attention: "No blockers", tags: ["ETL", "Pricing", "Sperant"] },
  { name: "cygnusbi-reportes-comerciales", type: "Analytics", health: "watch", score: 74, criticality: "High", deployment: "Not deployed", database: "Redshift", tests: "Missing", lastRun: "8 d", attention: "Manual reporting dependency", tags: ["Power BI", "CRM", "Reporting"] },
  { name: "MetricHouse", type: "Analytics", health: "healthy", score: 86, criticality: "Medium", deployment: "GitHub", database: "None", tests: "Partial", lastRun: "4 d", attention: "No blockers", tags: ["Metrics", "BI", "Real Estate"] },
  { name: "real-estate-recommender", type: "ML", health: "risk", score: 58, criticality: "Medium", deployment: "Not deployed", database: "None", tests: "Missing", lastRun: "21 d", attention: "Large repo; no operating path", tags: ["ML", "Real Estate", "Recommender"] },
];

const statusMeta = {
  healthy: { label: "Healthy", icon: CheckCircle2 },
  watch: { label: "Watch", icon: AlertTriangle },
  risk: { label: "At risk", icon: TriangleAlert },
};

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState("All");
  const [type, setType] = useState("All");
  const [criticality, setCriticality] = useState("All");
  const [deployment, setDeployment] = useState("All");
  const [focus, setFocus] = useState(false);

  const filtered = useMemo(() => repos.filter((repo) => {
    const matchesQuery = repo.name.toLowerCase().includes(query.toLowerCase()) || repo.tags.some(t => t.toLowerCase().includes(query.toLowerCase()));
    const matchesHealth = health === "All" || repo.health === health;
    const matchesType = type === "All" || repo.type === type;
    const matchesCriticality = criticality === "All" || repo.criticality === criticality;
    const matchesDeployment = deployment === "All" || repo.deployment === deployment;
    const matchesFocus = !focus || repo.health !== "healthy" || repo.tests !== "Good";
    return matchesQuery && matchesHealth && matchesType && matchesCriticality && matchesDeployment && matchesFocus;
  }), [query, health, type, criticality, deployment, focus]);

  const activeFilters = [health, type, criticality, deployment].filter(v => v !== "All").length + (focus ? 1 : 0);
  const avgScore = Math.round(filtered.reduce((sum, r) => sum + r.score, 0) / Math.max(filtered.length, 1));
  const riskCount = filtered.filter(r => r.health === "risk").length;
  const watchCount = filtered.filter(r => r.health === "watch").length;
  const testGaps = filtered.filter(r => r.tests !== "Good").length;

  const clearFilters = () => {
    setHealth("All"); setType("All"); setCriticality("All"); setDeployment("All"); setFocus(false); setQuery("");
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
          <div className="sync"><CircleDot size={14}/><div><strong>Portfolio synced</strong><span>GitHub inventory ready</span></div></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">PORTFOLIO CONTROL</p><h1>Engineering Command Center</h1><p className="subhead">Reduce a large repository portfolio into the few systems that need attention now.</p></div>
          <button className="focus-btn" onClick={() => setFocus(!focus)}><Gauge size={17}/>{focus ? "Showing attention only" : "Focus mode"}</button>
        </header>

        <section className="metrics-grid">
          <Metric label="Visible repositories" value={filtered.length} detail={`${repos.length} tracked in v0.1`} icon={<Boxes size={19}/>} />
          <Metric label="Portfolio health" value={`${avgScore}%`} detail="Weighted operating score" icon={<Activity size={19}/>} />
          <Metric label="Need attention" value={riskCount + watchCount} detail={`${riskCount} at risk · ${watchCount} watch`} icon={<AlertTriangle size={19}/>} warn />
          <Metric label="Control gaps" value={testGaps} detail="Missing or partial tests" icon={<ShieldCheck size={19}/>} />
        </section>

        <section className="filter-panel">
          <div className="filter-heading"><div><Filter size={17}/><strong>Portfolio filters</strong><span>{activeFilters ? `${activeFilters} active` : "All systems"}</span></div>{activeFilters > 0 || query ? <button onClick={clearFilters}><X size={14}/>Clear</button> : null}</div>
          <div className="filter-grid">
            <label className="search-box"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search repo, tag or capability…" /></label>
            <Select label="Health" value={health} onChange={setHealth} options={["All", "healthy", "watch", "risk"]} />
            <Select label="System type" value={type} onChange={setType} options={["All", "Data", "App", "ML", "Analytics", "Automation"]} />
            <Select label="Criticality" value={criticality} onChange={setCriticality} options={["All", "High", "Medium", "Low"]} />
            <Select label="Deployment" value={deployment} onChange={setDeployment} options={["All", "Vercel", "Local", "GitHub", "Not deployed"]} />
          </div>
        </section>

        <section className="workspace-grid">
          <div className="table-card">
            <div className="card-head"><div><p className="eyebrow">REPOSITORY HEALTH</p><h2>Where should I intervene?</h2></div><span>{filtered.length} results</span></div>
            <div className="repo-list">
              {filtered.map(repo => {
                const StatusIcon = statusMeta[repo.health].icon;
                return (
                  <article className="repo-row" key={repo.name}>
                    <div className={`status-dot ${repo.health}`}><StatusIcon size={15}/></div>
                    <div className="repo-main"><div className="repo-title"><strong>{repo.name}</strong><span className="type-badge">{repo.type}</span><span className={`criticality ${repo.criticality.toLowerCase()}`}>{repo.criticality}</span></div><div className="tags">{repo.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
                    <div className="repo-meta"><span>Deploy<strong>{repo.deployment}</strong></span><span>Data<strong>{repo.database}</strong></span><span>Tests<strong>{repo.tests}</strong></span><span>Last run<strong>{repo.lastRun}</strong></span></div>
                    <div className="score"><strong>{repo.score}</strong><span>/100</span></div>
                    <div className="attention"><span>{repo.attention}</span><ChevronRight size={16}/></div>
                  </article>
                );
              })}
              {!filtered.length && <div className="empty"><Search size={24}/><strong>No repositories match these filters</strong><span>Clear one or more filters to widen the operating view.</span></div>}
            </div>
          </div>

          <aside className="right-rail">
            <div className="rail-card priority-card"><p className="eyebrow">TODAY'S PRIORITY</p><h3>Control the highest-risk systems first.</h3><p>Focus mode combines health, test coverage and operating criticality into a short intervention queue.</p><button onClick={() => setFocus(true)}>Show intervention queue<ChevronRight size={16}/></button></div>
            <div className="rail-card"><p className="eyebrow">CONTROL MODEL</p><div className="control-flow"><Flow icon={<Database size={16}/>} title="Data" detail="Freshness · lineage"/><Flow icon={<ServerCog size={16}/>} title="Runtime" detail="Deploy · executions"/><Flow icon={<ShieldCheck size={16}/>} title="Safety" detail="Tests · rollback"/><Flow icon={<Gauge size={16}/>} title="Decision" detail="Health · priority"/></div></div>
            <div className="rail-card"><p className="eyebrow">NEXT SIGNALS</p><ul className="signal-list"><li><span className="signal risk"></span>Schema drift detected</li><li><span className="signal watch"></span>Manual dependency remains</li><li><span className="signal good"></span>No exposed secrets detected</li></ul></div>
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
