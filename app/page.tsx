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
  Filter,
  Gauge,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Network,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import RepositoryDrawer from "./repository-drawer";
import {
  actionTone,
  actionsOf,
  ageLabel,
  durationLabel,
  executionRuns,
  governanceControls,
  healthLabel,
  inventory,
  observedDependencies,
  priorityOf,
  repos,
  runLabel,
  runTone,
  severityLabel,
  unique,
  type Repo,
  type Severity,
  type View,
} from "./control-model";

const viewMeta: Record<View, { eyebrow: string; title: string; subhead: string }> = {
  command: {
    eyebrow: "PORTFOLIO CONTROL · LIVE EVIDENCE",
    title: "Engineering Command Center",
    subhead: `Intervention-first control across ${inventory.coverage.discovered} repositories. Runtime failure, structural risk, observability, testing and security evidence determine what deserves attention first.`,
  },
  executions: {
    eyebrow: "EXECUTION EVIDENCE · LAST 10 RUNS PER REPOSITORY",
    title: "Execution Timeline",
    subhead: "Observe recent GitHub Actions outcomes, decide which failure to inspect, and jump directly to the run that produced the result.",
  },
  systems: {
    eyebrow: "SYSTEM INVENTORY · SAME SNAPSHOT",
    title: "Systems",
    subhead: "Inspect the full portfolio without hiding low-priority or currently clear repositories.",
  },
  dependencies: {
    eyebrow: "OBSERVED COUPLING · NO INFERRED CALL GRAPH",
    title: "Dependency Map",
    subhead: "See shared platform dependencies that are directly supported by repository evidence and their observable blast radius across the portfolio.",
  },
  governance: {
    eyebrow: "CONTROL EVIDENCE · REPOSITORY LEVEL",
    title: "Governance Matrix",
    subhead: "Compare the controls the scanner can actually prove: README, tests, CI, runtime manifest, secret hygiene and full-tree inspection.",
  },
};

export default function Dashboard() {
  const [view, setView] = useState<View>("command");
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState("All");
  const [actions, setActions] = useState("All");
  const [severity, setSeverity] = useState("All");
  const [type, setType] = useState("All");
  const [visibility, setVisibility] = useState("All");
  const [focus, setFocus] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [executionTone, setExecutionTone] = useState("All");
  const [selectedDependency, setSelectedDependency] = useState<string | null>(null);
  const [governanceFailuresOnly, setGovernanceFailuresOnly] = useState(true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        else if (selectedRepo) setSelectedRepo(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, selectedRepo]);

  useEffect(() => {
    if (!selectedRepo) {
      document.body.classList.remove("drawer-open");
      return;
    }
    document.body.classList.add("drawer-open");
    return () => document.body.classList.remove("drawer-open");
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

  const criticalCount = repos.filter((repo) => priorityOf(repo).severity === "critical").length;
  const highCount = repos.filter((repo) => priorityOf(repo).severity === "high").length;
  const failingActions = repos.filter((repo) => actionsOf(repo).state === "red").length;
  const stableCount = repos.filter((repo) => priorityOf(repo).severity === "clear").length;
  const activeFilters = [health, actions, severity, type, visibility].filter((value) => value !== "All").length + (focus ? 1 : 0);

  const executions = useMemo(() => repos.flatMap((repo) => executionRuns(repo).map((run) => ({ repo, run, tone: runTone(run) })))
    .sort((a, b) => new Date(b.run.updatedAt || b.run.createdAt || 0).getTime() - new Date(a.run.updatedAt || a.run.createdAt || 0).getTime()), []);
  const visibleExecutions = executions.filter((item) => executionTone === "All" || item.tone === executionTone);
  const executionFailures = executions.filter((item) => item.tone === "risk").length;
  const executionSuccesses = executions.filter((item) => item.tone === "good").length;
  const executionActive = executions.filter((item) => item.tone === "watch" && item.run.status !== "completed").length;

  const dependencyGroups = useMemo(() => {
    const map = new Map<string, Repo[]>();
    for (const repo of repos) {
      for (const dependency of observedDependencies(repo)) {
        const current = map.get(dependency) || [];
        current.push(repo);
        map.set(dependency, current);
      }
    }
    return Array.from(map.entries())
      .map(([name, systems]) => ({ name, systems: systems.sort((a, b) => priorityOf(b).score - priorityOf(a).score) }))
      .sort((a, b) => b.systems.length - a.systems.length || a.name.localeCompare(b.name));
  }, []);
  const activeDependencyName = selectedDependency && dependencyGroups.some((item) => item.name === selectedDependency)
    ? selectedDependency
    : dependencyGroups[0]?.name || null;
  const activeDependency = dependencyGroups.find((item) => item.name === activeDependencyName) || null;

  const governanceRows = useMemo(() => repos.map((repo) => {
    const controls = governanceControls(repo);
    const passed = controls.filter((control) => control.pass).length;
    return { repo, controls, passed, failed: controls.length - passed };
  }).sort((a, b) => b.failed - a.failed || priorityOf(b.repo).score - priorityOf(a.repo).score), []);
  const visibleGovernance = governanceFailuresOnly ? governanceRows.filter((row) => row.failed > 0) : governanceRows;
  const governanceSummary = governanceRows[0]?.controls.map((control, index) => ({
    label: control.label,
    failures: governanceRows.filter((row) => !row.controls[index].pass).length,
  })) || [];
  const reposWithGovernanceGaps = governanceRows.filter((row) => row.failed > 0).length;

  const allSystems = useMemo(() => [...repos].sort((a, b) => priorityOf(b).score - priorityOf(a).score || a.name.localeCompare(b.name)), []);

  const navigate = (nextView: View) => {
    setView(nextView);
    setPaletteOpen(false);
    setPaletteQuery("");
  };

  const showCritical = () => {
    setView("command");
    setFocus(true);
    setSeverity("critical");
    setActions("All");
    setHealth("All");
    setType("All");
    setVisibility("All");
    setQuery("");
    setPaletteOpen(false);
  };

  const showFailingExecutions = () => {
    setExecutionTone("risk");
    navigate("executions");
  };

  const clearFilters = () => {
    setHealth("All");
    setActions("All");
    setSeverity("All");
    setType("All");
    setVisibility("All");
    setQuery("");
    setFocus(false);
  };

  const paletteCommands = [
    { label: "Critical interventions", detail: `${criticalCount} systems currently critical`, keywords: "critical priority attention queue", icon: <Zap size={15}/>, action: showCritical },
    { label: "Failing executions", detail: `${executionFailures} retained failed runs`, keywords: "fail failing red ci actions execution", icon: <TriangleAlert size={15}/>, action: showFailingExecutions },
    { label: "Execution Timeline", detail: `${executions.length} retained run records`, keywords: "executions timeline runs history", icon: <Clock3 size={15}/>, action: () => navigate("executions") },
    { label: "Dependency Map", detail: `${dependencyGroups.length} observable dependency groups`, keywords: "dependencies blast radius graph", icon: <Network size={15}/>, action: () => navigate("dependencies") },
    { label: "Governance Matrix", detail: `${reposWithGovernanceGaps} repositories with control gaps`, keywords: "governance controls tests readme secrets", icon: <ShieldCheck size={15}/>, action: () => navigate("governance") },
    { label: "All Systems", detail: `${repos.length} repositories`, keywords: "systems repos portfolio all", icon: <Boxes size={15}/>, action: () => navigate("systems") },
  ];
  const normalizedPaletteQuery = paletteQuery.trim().toLowerCase();
  const matchingCommands = paletteCommands.filter((item) => `${item.label} ${item.detail} ${item.keywords}`.toLowerCase().includes(normalizedPaletteQuery));
  const matchingRepos = repos.filter((repo) => `${repo.name} ${repo.fullName} ${repo.type} ${repo.database}`.toLowerCase().includes(normalizedPaletteQuery)).slice(0, 8);

  const meta = viewMeta[view];

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={18}/></div><div><strong>DNTL</strong><span>Engineering OS</span></div></div>
        <nav>
          <NavItem active={view === "command"} onClick={() => navigate("command")} icon={<LayoutDashboard size={17}/>} label="Command Center" />
          <NavItem active={view === "executions"} onClick={() => navigate("executions")} icon={<PlayCircle size={17}/>} label="Executions" live />
          <NavItem active={view === "systems"} onClick={() => navigate("systems")} icon={<Boxes size={17}/>} label="Systems" />
          <NavItem active={view === "dependencies"} onClick={() => navigate("dependencies")} icon={<Network size={17}/>} label="Dependencies" live />
          <NavItem active={view === "governance"} onClick={() => navigate("governance")} icon={<ShieldCheck size={17}/>} label="Governance" live />
        </nav>
        <div className="architecture-spine">
          <span className="tiny-label">OPERATING MODEL</span>
          <Spine index="1" label="Attention Queue" />
          <Spine index="2" label="Side Detail" />
          <Spine index="3" label="Execution Timeline" />
          <Spine index="4" label="Dependency Map" />
          <Spine index="5" label="Governance Matrix" />
        </div>
        <div className="sidebar-foot">
          <span className="tiny-label">CONTROL PLANE</span>
          <div className="sync"><CircleDot size={14}/><div><strong>GitHub telemetry</strong><span>schema v{inventory.schemaVersion || 1} · {inventory.coverage.scored}/{inventory.coverage.discovered} scored</span></div></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">{meta.eyebrow}</p><h1>{meta.title}</h1><p className="subhead">{meta.subhead}</p></div>
          <div className="top-actions">
            <button className="command-btn" onClick={() => setPaletteOpen(true)}><Command size={16}/><span>Command Palette</span><kbd>⌘ K</kbd></button>
            {view === "command" && <button className={`focus-btn ${focus ? "active" : ""}`} onClick={() => setFocus(!focus)}><Gauge size={17}/>{focus ? "Attention only" : "Show attention"}</button>}
          </div>
        </header>

        {view === "command" && <>
          <section className="metrics-grid">
            <Metric label="Critical interventions" value={criticalCount} detail="Highest combined urgency" icon={<Zap size={19}/>} warn={criticalCount > 0}/>
            <Metric label="High priority" value={highCount} detail="Act after critical queue" icon={<TriangleAlert size={19}/>} warn={highCount > 0}/>
            <Metric label="Actions failing" value={failingActions} detail={`${inventory.actionsSummary?.configured ?? 0} repos have workflows`} icon={<Activity size={19}/>} warn={failingActions > 0}/>
            <Metric label="Clear systems" value={stableCount} detail={`${inventory.coverage.discovered - stableCount} carry at least one signal`} icon={<CheckCircle2 size={19}/>} />
          </section>

          <section className="filter-panel">
            <div className="filter-heading"><div><Filter size={17}/><strong>Queue controls</strong><span>{activeFilters ? `${activeFilters} active` : "All systems"}</span></div>{(activeFilters > 0 || query) && <button onClick={clearFilters}><X size={14}/>Clear</button>}</div>
            <div className="filter-grid">
              <label className="search-box"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search repo, workflow, branch, database or intervention…"/></label>
              <Select label="Priority" value={severity} onChange={setSeverity} options={unique(repos.map((repo) => priorityOf(repo).severity))}/>
              <Select label="Actions" value={actions} onChange={setActions} options={unique(repos.map((repo) => actionsOf(repo).state))}/>
              <Select label="Repo health" value={health} onChange={setHealth} options={unique(repos.map((repo) => repo.health))}/>
              <Select label="System" value={type} onChange={setType} options={unique(repos.map((repo) => repo.type))}/>
              <Select label="Visibility" value={visibility} onChange={setVisibility} options={unique(repos.map((repo) => repo.visibility))}/>
            </div>
          </section>

          <section className="command-grid">
            <div className="attention-card">
              <div className="card-head"><div><p className="eyebrow">ATTENTION QUEUE</p><h2>What should I intervene on next?</h2></div><span>{filtered.length} systems · ranked automatically</span></div>
              <div className="queue-head"><span>Priority</span><span>System / signal</span><span>Runtime</span><span>Structural</span><span></span></div>
              <div className="queue-list">
                {filtered.map((repo, index) => {
                  const priority = priorityOf(repo);
                  const ci = actionsOf(repo);
                  return <button className={`queue-row ${selectedRepo?.fullName === repo.fullName ? "selected" : ""}`} key={repo.fullName} onClick={() => setSelectedRepo(repo)}>
                    <div className="priority-cell"><span className={`rank severity-${priority.severity}`}>{index + 1}</span><div><strong>{priority.score}</strong><small>{severityLabel[priority.severity]}</small></div></div>
                    <div className="queue-system"><div className="repo-title"><strong>{repo.name}</strong><span className="type-badge">{repo.type}</span><span className="visibility-badge">{repo.visibility}</span></div><p>{priority.primaryReason}</p><div className="tags">{(repo.tags || []).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}<span>{repo.database}</span></div></div>
                    <div className="runtime-cell"><span className={`state-pill ${actionTone(ci.state)}`}><i></i>{ci.label}</span><small>{ci.latest ? `${ci.latest.name} · ${ageLabel(ci.latest.updatedAt)}` : `${ci.workflowCount ?? 0} workflow(s)`}</small></div>
                    <div className="structural-cell"><strong>{repo.score ?? "—"}<small>{repo.score !== null ? "/100" : ""}</small></strong><span className={`health-text ${repo.health}`}>{healthLabel[repo.health]}</span></div>
                    <ChevronRight className="queue-chevron" size={18}/>
                  </button>;
                })}
                {!filtered.length && <div className="empty"><CheckCircle2 size={26}/><strong>No systems match this intervention view</strong><span>Clear filters or disable Attention only to inspect the full portfolio.</span></div>}
              </div>
            </div>

            <aside className="right-rail">
              <div className="rail-card priority-card"><p className="eyebrow">PRIORITY MODEL v1</p><h3>Runtime incidents outrank maturity debt.</h3><p>Failing CI contributes the strongest signal. Repository risk, missing observability, tests and tracked environment files add urgency. Every point is stored in the generated inventory.</p><div className="priority-legend"><span><i className="critical"></i>Critical ≥75</span><span><i className="high"></i>High ≥50</span><span><i className="medium"></i>Medium ≥25</span></div></div>
              <div className="rail-card"><p className="eyebrow">CONTROL SURFACES</p><div className="control-flow"><Flow icon={<ListChecks size={16}/>} title="Attention Queue" detail="Live · deterministic priority"/><Flow icon={<Clock3 size={16}/>} title="Execution Timeline" detail="Live · retained workflow runs"/><Flow icon={<GitBranch size={16}/>} title="Dependency Map" detail="Live · observable shared coupling"/><Flow icon={<ShieldCheck size={16}/>} title="Governance Matrix" detail="Live · evidence-backed controls"/></div></div>
              <div className="rail-card snapshot-card"><p className="eyebrow">SNAPSHOT</p><strong>{new Date(inventory.generatedAt).toLocaleString()}</strong><span>{inventory.fullPrivateCoverage ? "Full private coverage" : "Public-only coverage"}</span><span>{inventory.actionsSummary?.green ?? 0} green · {inventory.actionsSummary?.red ?? 0} red Actions</span></div>
            </aside>
          </section>
        </>}

        {view === "executions" && <>
          <section className="surface-summary">
            <SurfaceStat label="Run records" value={executions.length} detail="Retained evidence in current snapshot"/>
            <SurfaceStat label="Failed runs" value={executionFailures} detail="Inspect these first"/>
            <SurfaceStat label="Successful runs" value={executionSuccesses} detail="Observed completed successes"/>
            <SurfaceStat label="In progress" value={executionActive} detail="No result claimed until completion"/>
          </section>
          <section className="surface-card">
            <div className="surface-toolbar"><div><span className="view-kicker"><Clock3 size={14}/>Newest first</span><p>Click a system for context; open the run for the observed result.</p></div><Select label="Result" value={executionTone} onChange={setExecutionTone} options={["All", "risk", "watch", "good", "neutral"]}/></div>
            <div className="timeline-list">
              <div className="timeline-row timeline-head"><span>When</span><span>System</span><span>Workflow</span><span>Result</span><span>Branch</span><span>Duration</span><span></span></div>
              {visibleExecutions.map(({ repo, run, tone }) => <div className="timeline-row" key={`${repo.fullName}-${run.id}`}>
                <div className="timeline-time"><strong>{ageLabel(run.updatedAt || run.createdAt)}</strong><span>{run.runNumber ? `Run #${run.runNumber}` : "Run"}</span></div>
                <div className="timeline-system"><button onClick={() => setSelectedRepo(repo)}><strong>{repo.name}</strong><span>{repo.type}</span></button></div>
                <div className="timeline-workflow">{run.url ? <a href={run.url} target="_blank" rel="noreferrer"><strong>{run.name}</strong><span>{run.event || "unknown trigger"}</span></a> : <><strong>{run.name}</strong><span>{run.event || "unknown trigger"}</span></>}</div>
                <span className={`state-pill ${tone}`}><i></i>{runLabel(run)}</span>
                <span>{run.branch || "—"}</span>
                <strong>{durationLabel(run.durationSeconds)}</strong>
                <div className="timeline-action">{run.url && <a href={run.url} target="_blank" rel="noreferrer">Inspect <ArrowUpRight size={12}/></a>}</div>
              </div>)}
              {!visibleExecutions.length && <div className="empty"><Activity size={25}/><strong>No execution evidence matches this filter</strong><span>The view does not manufacture run history when Actions is not observable.</span></div>}
            </div>
          </section>
          <p className="surface-note">Decision path: run evidence → identify failure or unstable history → inspect the exact GitHub Actions run → observe its conclusion and logs. Only the ten runs requested by the scanner are retained per repository.</p>
        </>}

        {view === "systems" && <section className="surface-card">
          <div className="surface-toolbar"><div><span className="view-kicker"><Boxes size={14}/>Full inventory</span><p>{allSystems.length} repositories from the same generated snapshot.</p></div></div>
          <div className="systems-list">
            <div className="system-row head"><span>System</span><span>Priority</span><span>Repo health</span><span>Actions</span><span>Delivery</span><span>Data</span><span></span></div>
            {allSystems.map((repo) => {
              const priority = priorityOf(repo);
              const ci = actionsOf(repo);
              return <button className="system-row" key={repo.fullName} onClick={() => setSelectedRepo(repo)}><div><strong>{repo.name}</strong><span>{repo.type} · {repo.visibility}</span></div><div><strong>{priority.score}</strong><span>{severityLabel[priority.severity]}</span></div><div><strong>{repo.score ?? "—"}</strong><span>{healthLabel[repo.health]}</span></div><div><strong>{ci.label}</strong><span>{ci.recentRuns ?? 0} runs</span></div><div><strong>{repo.deployment}</strong><span>{ageLabel(repo.lastActivity)}</span></div><div><strong>{repo.database}</strong><span>{repo.tests}</span></div><ChevronRight size={15}/></button>;
            })}
          </div>
        </section>}

        {view === "dependencies" && <>
          <section className="surface-summary">
            <SurfaceStat label="Dependency groups" value={dependencyGroups.length} detail="Only observable shared platform signals"/>
            <SurfaceStat label="Largest blast radius" value={dependencyGroups[0]?.systems.length || 0} detail={dependencyGroups[0]?.name || "No evidence"}/>
            <SurfaceStat label="Systems mapped" value={repos.filter((repo) => observedDependencies(repo).length > 0).length} detail="At least one observed dependency"/>
            <SurfaceStat label="Unmapped systems" value={repos.filter((repo) => observedDependencies(repo).length === 0).length} detail="No dependency evidence claimed"/>
          </section>
          <section className="surface-card">
            <div className="surface-toolbar"><div><span className="view-kicker"><Network size={14}/>Observed dependency map</span><p>Vercel-ready means repository readiness evidence, not proof of a live Vercel deployment.</p></div></div>
            <div className="dependency-layout">
              <div className="dependency-list">{dependencyGroups.map((group) => <button key={group.name} className={`dependency-item ${group.name === activeDependencyName ? "active" : ""}`} onClick={() => setSelectedDependency(group.name)}><div><strong>{group.name}</strong><span>Observable shared dependency</span></div><em>{group.systems.length}</em></button>)}</div>
              <div className="dependency-canvas">
                {activeDependency ? <><div className="dependency-node"><span>Shared dependency</span><strong>{activeDependency.name}</strong></div><div className="blast-line"></div><div className="blast-label">Observable blast radius · {activeDependency.systems.length} repositories</div><div className="dependency-repos">{activeDependency.systems.map((repo) => <button className="dependency-repo" key={repo.fullName} onClick={() => setSelectedRepo(repo)}><strong>{repo.name}</strong><span>{repo.type} · priority {priorityOf(repo).score}</span></button>)}</div></> : <div className="empty"><Network size={25}/><strong>No dependency evidence available</strong><span>No cross-system relationship is invented.</span></div>}
              </div>
            </div>
          </section>
          <p className="surface-note">Decision path: observed shared dependency → quantify affected repositories → open the highest-priority affected system. This is a shared-platform map, not a runtime service call graph.</p>
        </>}

        {view === "governance" && <>
          <section className="surface-summary">
            <SurfaceStat label="Repositories with gaps" value={reposWithGovernanceGaps} detail="At least one observable control fails"/>
            {governanceSummary.slice().sort((a, b) => b.failures - a.failures).slice(0, 3).map((item) => <SurfaceStat key={item.label} label={`${item.label} gaps`} value={item.failures} detail="Evidence-backed missing control"/>)}
          </section>
          <section className="surface-card governance-wrap">
            <div className="surface-toolbar"><div><span className="view-kicker"><ShieldCheck size={14}/>Governance matrix</span><p>Every cell maps directly to scanner evidence.</p></div><button className={`focus-btn ${governanceFailuresOnly ? "active" : ""}`} onClick={() => setGovernanceFailuresOnly((value) => !value)}>{governanceFailuresOnly ? "Gaps only" : "Show gaps"}</button></div>
            <div className="governance-table">
              <div className="governance-row head"><span>System</span><span>Score</span><span>README</span><span>Tests</span><span>CI</span><span>Manifest</span><span>.env hygiene</span><span>Full tree</span><span>Gaps</span></div>
              {visibleGovernance.map(({ repo, controls, passed, failed }) => <div className="governance-row" key={repo.fullName}><button className="governance-system" onClick={() => setSelectedRepo(repo)}><strong>{repo.name}</strong><span>{repo.type} · priority {priorityOf(repo).score}</span></button><span className="gov-score">{passed}/{controls.length}</span>{controls.map((control) => <span key={control.key} title={control.evidence} className={`gov-cell ${control.pass ? "pass" : "fail"}`}>{control.pass ? "PASS" : "GAP"}</span>)}<span className="gov-failures">{failed}</span></div>)}
            </div>
          </section>
          <p className="surface-note">Decision path: failed control → identify affected repository → open Side Detail → inspect the exact evidence. A green cell means the scanner observed the control; it does not certify controls that are outside the current evidence model.</p>
        </>}
      </section>

      {selectedRepo && <RepositoryDrawer repo={selectedRepo} onClose={() => setSelectedRepo(null)} onNavigate={navigate}/>} 
      {paletteOpen && <div className="palette-layer" role="dialog" aria-modal="true" aria-label="Command Palette"><button className="palette-backdrop" onClick={() => setPaletteOpen(false)} aria-label="Close command palette"></button><div className="palette"><div className="palette-search"><Search size={18}/><input autoFocus value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="Navigate, filter, or find a repository…"/><kbd>Esc</kbd></div><div className="palette-results">{matchingCommands.map((item) => <button className="palette-item" key={item.label} onClick={item.action}><span className="palette-icon">{item.icon}</span><div><strong>{item.label}</strong><span>{item.detail}</span></div><em>command</em></button>)}{matchingRepos.map((repo) => <button className="palette-item" key={repo.fullName} onClick={() => { setSelectedRepo(repo); setPaletteOpen(false); setPaletteQuery(""); }}><span className="palette-icon"><Boxes size={15}/></span><div><strong>{repo.name}</strong><span>{repo.type} · {repo.database} · priority {priorityOf(repo).score}</span></div><em>system</em></button>)}{!matchingCommands.length && !matchingRepos.length && <div className="palette-empty">No command or repository matches this query.</div>}</div></div></div>}
    </main>
  );
}

function NavItem({ active, onClick, icon, label, live = false }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; live?: boolean }) {
  return <button className={`nav-item ${active ? "active" : ""} ${live ? "live-nav" : ""}`} onClick={onClick}>{icon}{label}{live && <em>live</em>}</button>;
}

function Spine({ index, label }: { index: string; label: string }) {
  return <div className="spine-item complete"><span>{index}</span><strong>{label}</strong></div>;
}

function Metric({ label, value, detail, icon, warn = false }: { label: string; value: string | number; detail: string; icon: React.ReactNode; warn?: boolean }) {
  return <div className={`metric-card ${warn ? "warn" : ""}`}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}

function SurfaceStat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="surface-stat"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="select-wrap"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option === "All" ? `All ${label.toLowerCase()}` : option}</option>)}</select></label>;
}

function Flow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="flow-item live"><div>{icon}</div><span><strong>{title}</strong><small>{detail}</small></span><em>live</em></div>;
}
