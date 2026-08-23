"use client";

import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Command,
  Gauge,
  GitBranch,
  Github,
  Network,
  PlayCircle,
  ShieldCheck,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import {
  actionTone,
  actionsOf,
  ageLabel,
  durationLabel,
  governanceControls,
  healthLabel,
  observedDependencies,
  priorityOf,
  severityLabel,
  yesNo,
  type Repo,
  type View,
} from "./control-model";

export default function RepositoryDrawer({ repo, onClose, onNavigate }: { repo: Repo; onClose: () => void; onNavigate: (view: View) => void }) {
  const priority = priorityOf(repo);
  const ci = actionsOf(repo);
  const evidence = repo.evidence || {};
  const signals = priority.signals.length ? priority.signals : (repo.attention || []).map((reason) => ({ points: 0, reason, code: "attention" }));
  const components = Object.entries(repo.components || {});
  const dependencies = observedDependencies(repo);
  const controls = governanceControls(repo);

  const navigate = (view: View) => {
    onClose();
    onNavigate(view);
  };

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
            <div className="detail-score"><span>Repository Health</span><strong>{repo.score ?? "—"}<small>{repo.score !== null ? "/100" : ""}</small></strong><em className={`health-text ${repo.health}`}>{healthLabel[repo.health]}</em></div>
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
            </> : <div className="empty-inline">{ci.reason || ci.label}. No execution result is claimed without a readable workflow run.</div>}
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

          <section className="drawer-section">
            <div className="section-title"><div><p className="eyebrow">CONNECTED CONTROL SURFACES</p><h3>Move from evidence to the next decision</h3></div><Network size={18}/></div>
            <div className="detail-grid">
              <Detail label="Runs retained" value={ci.runs === null ? "Not observable" : String(ci.runs?.length ?? (ci.latest ? 1 : 0))} />
              <Detail label="Dependencies observed" value={String(dependencies.length)} />
              <Detail label="Governance controls" value={`${controls.filter((item) => item.pass).length}/${controls.length} pass`} />
            </div>
            <div className="control-surface-buttons">
              <button onClick={() => navigate("executions")}><Clock3 size={15}/>Execution Timeline</button>
              <button onClick={() => navigate("dependencies")}><GitBranch size={15}/>Dependency Map</button>
              <button onClick={() => navigate("governance")}><ShieldCheck size={15}/>Governance Matrix</button>
              <button onClick={() => navigate("systems")}><Command size={15}/>All Systems</button>
            </div>
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

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="detail-item"><span>{label}</span><strong>{value}</strong></div>;
}

function Evidence({ label, value, good, neutral = false }: { label: string; value: string; good: boolean; neutral?: boolean }) {
  return <div className={`evidence-item ${neutral ? "neutral" : good ? "good" : "risk"}`}><span>{label}</span><strong>{value}</strong></div>;
}
