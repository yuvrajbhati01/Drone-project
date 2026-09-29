import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Box, Building2, Camera, CheckCircle2, Clock3, Cloud, Gauge, MapPinned, RadioTower, Route, Satellite, ScanLine, Trees, Waypoints } from 'lucide-react'
import { activeMission, defects, processingStages, missions } from '../data/mockData'
import { MetricCard, PipelineState, ProgressBar, SectionHeader, StatusBadge } from '../components/ui'
import { ScenePreview } from '../components/ScenePreview'

export function DashboardPage() {
  const navigate = useNavigate()
  return <div className="page-content dashboard-page">
    <div className="page-heading"><div><div className="eyebrow">OPERATIONAL VIEW / {activeMission.id}</div><h1>Mission overview</h1><p>Single-pass aerial reconstruction and digital twin monitoring.</p></div><div className="heading-actions"><button className="button secondary" onClick={() => navigate('/reports')}><Cloud size={16} /> Export report</button><button className="button primary" onClick={() => navigate('/missions/new')}><span>+</span> New mission</button></div></div>
    <div className="metric-grid">
      <MetricCard label="Flight distance" value={activeMission.distance} detail="Single pass / 08:42 duration" trend="12.4%" accent="cyan" icon={<Route size={17} />} />
      <MetricCard label="Frames captured" value={activeMission.frames} detail="4K RGB / 30 FPS" trend="2,486 indexed" accent="blue" icon={<Camera size={17} />} />
      <MetricCard label="Model confidence" value={activeMission.confidence} detail="Metric accuracy estimate" trend="+2.1%" accent="green" icon={<Gauge size={17} />} />
      <MetricCard label="AI findings" value="23" detail="6 high / 10 medium / 7 low" trend="3 new" accent="amber" icon={<AlertTriangle size={17} />} />
    </div>

    <div className="dashboard-grid-main">
      <section className="panel scene-panel"><SectionHeader eyebrow="DIGITAL TWIN / LIVE PREVIEW" title="Reconstructed scene" detail="Jodhpur infrastructure survey" action={<button className="text-button" onClick={() => navigate('/digital-twin')}>Open full view <ArrowRight size={14} /></button>} /><ScenePreview /></section>
      <section className="panel pipeline-panel"><SectionHeader eyebrow="RECONSTRUCTION PIPELINE" title="Model readiness" detail="6-stage processing workflow" action={<StatusBadge tone="ready">94.7% covered</StatusBadge>} /><div className="pipeline-list">{processingStages.map((stage, index) => <div className={`pipeline-row ${stage.state.toLowerCase()}`} key={stage.name}><div className="pipeline-index">{stage.state === 'Complete' ? <CheckCircle2 size={15} /> : <span>0{index + 1}</span>}</div><div className="pipeline-copy"><div><strong>{stage.name}</strong><PipelineState state={stage.state} /></div><span>{stage.detail}</span>{stage.state !== 'Queued' && <ProgressBar value={stage.progress} tone={stage.state === 'Processing' ? 'amber' : 'cyan'} />}</div><time>{stage.duration}</time></div>)}</div><button className="panel-link" onClick={() => navigate('/processing')}>View processing details <ArrowRight size={14} /></button></section>
    </div>

    <div className="dashboard-grid-bottom">
      <section className="panel findings-panel"><SectionHeader eyebrow="SCENE UNDERSTANDING" title="Recent findings" detail="AI-detected anomalies from the model" action={<button className="text-button" onClick={() => navigate('/analysis')}>View analysis <ArrowRight size={14} /></button>} /><div className="finding-list">{defects.map((defect) => <button className="finding-row" key={defect.id} onClick={() => navigate('/analysis')}><span className={`finding-icon ${defect.severity.toLowerCase()}`}><AlertTriangle size={15} /></span><span className="finding-copy"><strong>{defect.type}</strong><small>{defect.id} / {defect.location}</small></span><span className="finding-confidence"><b>{defect.confidence}%</b><small>confidence</small></span><span className={`severity ${defect.severity.toLowerCase()}`}>{defect.severity}</span></button>)}</div></section>
      <section className="panel signal-panel"><SectionHeader eyebrow="FLIGHT TELEMETRY" title="Signal snapshot" detail="Captured from onboard metadata" /><div className="signal-grid"><div><span><Satellite size={14} /> GPS accuracy</span><strong>+/- 0.8 m</strong><small><span className="status-dot green" /> RTK fixed</small></div><div><span><Waypoints size={14} /> Camera poses</span><strong>1,921</strong><small>97.4% aligned</small></div><div><span><ScanLine size={14} /> Point density</span><strong>42 pts/m2</strong><small>Within target</small></div><div><span><RadioTower size={14} /> Uplink health</span><strong>98.2%</strong><small>Stable connection</small></div></div></section>
    </div>
    <section className="panel recent-panel"><SectionHeader eyebrow="MISSION ARCHIVE" title="Recent missions" detail="Latest single-pass capture sessions" action={<button className="text-button" onClick={() => navigate('/missions')}>View all missions <ArrowRight size={14} /></button>} /><div className="table-wrap"><table><thead><tr><th>Mission</th><th>Location</th><th>Status</th><th>Coverage</th><th>Quality</th><th>Updated</th></tr></thead><tbody>{missions.slice(0, 3).map((mission) => <tr key={mission.id} onClick={() => navigate('/missions')}><td><span className="table-primary">{mission.name}</span><span className="table-secondary">{mission.id}</span></td><td>{mission.location}</td><td><StatusBadge tone={mission.status === 'Ready' ? 'ready' : mission.status === 'Processing' ? 'warning' : 'neutral'}>{mission.status}</StatusBadge></td><td>{mission.coverage}</td><td>{mission.quality}</td><td>{mission.updated}</td></tr>)}</tbody></table></div></section>
    <div className="demo-note"><span><Clock3 size={14} /> Demo environment</span><p>All values shown are simulated frontend data and will be replaced by live reconstruction outputs in the next phase.</p></div>
  </div>
}
