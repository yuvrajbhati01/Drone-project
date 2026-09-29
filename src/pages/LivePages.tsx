import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Gauge,
  Layers3,
  MapPinned,
  Play,
  Plus,
  RefreshCcw,
  Ruler,
  ScanSearch,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { api, ApiError } from '../api/client'
import type { ApiDefect, ApiJob, ApiMeasurement, ApiMission, ApiReconstruction } from '../api/types'
import { RealModelCanvas } from '../components/RealModelCanvas'
import { EmptyState, ProgressBar, SectionHeader, StatusBadge } from '../components/ui'
import { useMissionWorkspace } from '../context/MissionWorkspace'

const pipeline = [
  { key: 'VALIDATING', label: 'Input validation', detail: 'Checking video readability and input contract' },
  { key: 'EXTRACTING_FRAMES', label: 'Frame extraction', detail: 'Sampling source video for reconstruction' },
  { key: 'SELECTING_FRAMES', label: 'Quality selection', detail: 'Rejecting blurry, overexposed, and duplicate views' },
  { key: 'CALIBRATING', label: 'Camera calibration', detail: 'Estimating intrinsics when calibration is absent' },
  { key: 'RECONSTRUCTING', label: 'Sparse reconstruction', detail: 'Feature matching, pose estimation, and triangulation' },
  { key: 'MESHING', label: 'Mesh publishing', detail: 'Writing the point cloud and web-compatible mesh asset' },
  { key: 'COMPLETED', label: 'Model ready', detail: 'Generated assets are available in the Digital Twin' },
] as const

function useLiveJob() {
  const { currentJobId, selectJob } = useMissionWorkspace()
  const [job, setJob] = useState<ApiJob | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentJobId) {
      setJob(null)
      return
    }
    let mounted = true
    const load = async () => {
      try {
        const next = await api.getJob(currentJobId)
        if (!mounted) return
        setJob(next)
        setError(null)
        if (next.status === 'COMPLETED' || next.status === 'FAILED') selectJob(next)
      } catch (cause) {
        if (mounted) setError(messageFor(cause))
      }
    }
    void load()
    const timer = window.setInterval(load, 1400)
    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [currentJobId, selectJob])

  return { job, error, refresh: async () => currentJobId && setJob(await api.getJob(currentJobId)) }
}

export function LiveProcessingPage() {
  const navigate = useNavigate()
  const { currentMission, currentJobId, selectJob } = useMissionWorkspace()
  const { job, error, refresh } = useLiveJob()
  const currentIndex = job ? pipeline.findIndex((item) => item.key === job.stage) : -1
  const videoMetrics = record(job?.metrics?.video)
  const selectedFrames = numeric(job?.metrics?.selected_frame_count)
  const inliers = numeric(job?.metrics?.geometric_inliers)
  const pointCount = numeric(job?.metrics?.triangulated_points)

  if (!currentMission || !currentJobId) {
    return <LiveEmpty title="No live reconstruction selected" detail="Create a mission and upload a drone video to begin a real reconstruction run." actionLabel="Create mission" action={() => navigate('/missions/new')} />
  }

  const failed = job?.status === 'FAILED'
  const completed = job?.status === 'COMPLETED'
  const cancel = async () => {
    if (!job) return
    try {
      selectJob(await api.cancelJob(job.id))
      await refresh()
    } catch (cause) {
      window.alert(messageFor(cause))
    }
  }

  return <div className="page-content live-page">
    <PageTitle eyebrow={`LIVE RECONSTRUCTION / ${currentMission.id.slice(0, 8)}`} title="Reconstruction pipeline" detail="This job is processing uploaded footage and persists every stage and metric." action={<StatusBadge tone={failed ? 'critical' : completed ? 'ready' : 'warning'}>{job?.status ?? 'Loading'}</StatusBadge>} />
    {error && <Notice tone="error" title="Unable to load job status" detail={error} />}
    {failed && <Notice tone="error" title={job.error_code ?? 'Reconstruction failed'} detail={job.error_message ?? job.message} />}
    {job && !failed && <div className={`processing-banner ${completed ? 'complete-banner' : ''}`}><div className="processing-pulse"><span /><span /><span /></div><div><strong>{job.message}</strong><p>{completed ? 'Generated assets are ready for inspection.' : `Current stage: ${titleCase(job.stage)}`}</p></div><div className="processing-score"><span>Job progress</span><strong>{job.progress}%</strong></div></div>}
    <div className="processing-layout">
      <section className="panel processing-stages">
        <SectionHeader eyebrow="PERSISTED JOB STATE" title="Processing stages" detail="The API updates this state as each worker step completes." action={<button className="text-button" onClick={() => void refresh()}><RefreshCcw size={13} /> Refresh</button>} />
        {pipeline.map((stage, index) => {
          const state = stageState(job, index, currentIndex)
          return <div className="stage-card" key={stage.key}><div className={`stage-number ${state.toLowerCase()}`}>{state === 'Complete' ? <CheckCircle2 size={16} /> : `0${index + 1}`}</div><div className="stage-content"><div className="stage-title"><div><strong>{stage.label}</strong><span>{stage.key === job?.stage ? job.message : stage.detail}</span></div><span className={`stage-state ${state.toLowerCase()}`}>{state}</span></div><ProgressBar value={state === 'Complete' ? 100 : state === 'Processing' ? job?.progress ?? 0 : 0} tone={state === 'Processing' ? 'amber' : 'cyan'} /><div className="stage-meta"><span>{stage.key === job?.stage ? 'Live API status' : state === 'Complete' ? 'Completed' : 'Waiting for previous stage'}</span><span>{stage.key === job?.stage ? `${job?.progress ?? 0}%` : state === 'Complete' ? '100%' : '--'}</span></div></div></div>
        })}
      </section>
      <aside className="processing-side">
        <section className="panel"><SectionHeader eyebrow="ACTUAL RUN METRICS" title="Processing telemetry" /><div className="counter-list"><Counter label="Source video" value={videoMetrics ? `${videoMetrics.width ?? '--'} x ${videoMetrics.height ?? '--'} / ${videoMetrics.fps ?? '--'} FPS` : '--'} /><Counter label="Selected frames" value={selectedFrames ? String(selectedFrames) : '--'} percent={job?.status === 'COMPLETED' ? 100 : job?.progress} /><Counter label="Geometric inliers" value={inliers ? String(inliers) : '--'} /><Counter label="Triangulated points" value={pointCount ? String(pointCount) : '--'} /></div></section>
        <section className="panel processing-actions"><SectionHeader eyebrow="MODEL HANDOFF" title="Next action" detail={completed ? 'The generated OBJ and PLY are ready to inspect.' : 'The Digital Twin unlocks once the worker publishes its model assets.'} />{completed ? <button className="button primary full" onClick={() => navigate('/digital-twin')}><Layers3 size={16} /> Open Digital Twin</button> : <button className="button secondary full" onClick={cancel} disabled={!job || job.status === 'CANCELLING'}><XCircle size={15} /> {job?.status === 'CANCELLING' ? 'Cancelling' : 'Cancel job'}</button>}<button className="button secondary full" onClick={() => void refresh()}><RefreshCcw size={15} /> Refresh telemetry</button></section>
      </aside>
    </div>
    <LiveNote>{completed ? 'This result is generated from the uploaded video. Scale remains local-relative unless a time-synchronized GPS track is supplied.' : 'The API is processing this mission locally. This page polls persisted job state rather than simulating progress.'}</LiveNote>
  </div>
}

export function LiveDigitalTwinPage() {
  const navigate = useNavigate()
  const { currentMission } = useMissionWorkspace()
  const [reconstruction, setReconstruction] = useState<ApiReconstruction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentMission) return
    let mounted = true
    setLoading(true)
    void api.getReconstruction(currentMission.id).then((result) => {
      if (mounted) {
        setReconstruction(result)
        setError(null)
      }
    }).catch((cause) => {
      if (mounted) setError(messageFor(cause))
    }).finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [currentMission])

  if (!currentMission) return <LiveEmpty title="No model selected" detail="Open a completed mission or create a new mission to generate a real model." actionLabel="Open missions" action={() => navigate('/missions')} />
  if (loading) return <div className="page-content"><LiveEmpty title="Loading reconstruction" detail="Retrieving the latest published model assets." /></div>
  if (!reconstruction) return <LiveEmpty title="No generated model yet" detail={error ?? 'Finish a reconstruction job before opening the Digital Twin.'} actionLabel="View processing" action={() => navigate('/processing')} />

  const mesh = reconstruction.assets.find((asset) => asset.asset_type === 'MESH')
  return <div className="page-content twin-page live-page">
    <PageTitle eyebrow={`DIGITAL TWIN / ${currentMission.id.slice(0, 8)}`} title={currentMission.name} detail="Interactive view of the model asset produced by the reconstruction worker." action={<div className="heading-actions"><StatusBadge tone="ready">Generated model</StatusBadge>{mesh && <a className="button secondary" href={api.assetUrl(mesh.url)} download><Download size={15} /> Download OBJ</a>}</div>} />
    <div className="twin-layout">
      <section className="panel twin-panel real-twin-panel">{mesh ? <RealModelCanvas modelUrl={api.assetUrl(mesh.url)} /> : <LiveEmpty title="Mesh asset missing" detail="The reconstruction completed without a mesh asset." />}</section>
      <aside className="twin-inspector">
        <section className="panel inspector-panel"><div className="inspector-heading"><div><div className="eyebrow">RECONSTRUCTION INSPECTOR</div><h2>{reconstruction.engine}</h2></div><Box size={18} /></div><span className="severity large low">{reconstruction.scale_status.replaceAll('_', ' ')}</span><h3>{reconstruction.point_count.toLocaleString()} reconstructed points</h3><p className="inspector-description">This scene is loaded from a generated OBJ asset. Rotate, pan, and zoom directly in the viewer.</p><div className="inspector-stats"><div><span>Mesh faces</span><strong>{reconstruction.mesh_faces.toLocaleString()}</strong></div><div><span>Selected frames</span><strong>{String(numeric(reconstruction.metrics.selected_frame_count) ?? '--')}</strong></div><div><span>Inlier ratio</span><strong>{formatRatio(numeric(reconstruction.metrics.inlier_ratio))}</strong></div><div><span>CRS</span><strong>{reconstruction.coordinate_reference_system}</strong></div></div><div className="recommendation"><span>Accuracy status</span><p>{reconstruction.scale_status === 'GPS_ESTIMATED' ? 'Scale is GPS-estimated. Validate against RTK/PPK or checkpoints before using survey-grade measurements.' : 'No synchronized GPS scale is available. Use this model for relative inspection, not metric claims.'}</p></div></section>
        <section className="panel marker-list"><SectionHeader eyebrow="PUBLISHED ASSETS" title="Model outputs" detail={`${reconstruction.assets.length} stored assets`} />{reconstruction.assets.map((asset) => <a key={asset.id} className="marker-row" href={api.assetUrl(asset.url)} download><span className="marker-number low">{asset.format}</span><span><strong>{asset.asset_type.replaceAll('_', ' ')}</strong><small>{formatBytes(asset.size_bytes)} / {asset.format}</small></span><Download size={14} /></a>)}</section>
      </aside>
    </div>
    {reconstruction.warnings.length > 0 && <section className="warnings-panel"><div className="eyebrow">RECONSTRUCTION WARNINGS</div>{reconstruction.warnings.map((warning) => <div key={warning}><AlertTriangle size={14} /> {warning}</div>)}</section>}
    <LiveNote>This is a live reconstruction asset, not the earlier procedural demo scene.</LiveNote>
  </div>
}

export function LiveMissionsPage() {
  const navigate = useNavigate()
  const { currentMission, selectJob, selectMission } = useMissionWorkspace()
  const [missions, setMissions] = useState<ApiMission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = async () => {
    try {
      setMissions(await api.listMissions())
      setError(null)
    } catch (cause) { setError(messageFor(cause)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const openMission = (mission: ApiMission) => {
    selectMission(mission)
    selectJob(null)
    navigate(mission.status === 'COMPLETED' ? '/digital-twin' : '/processing')
  }
  return <div className="page-content live-page"><PageTitle eyebrow="PERSISTED MISSION ARCHIVE" title="Missions" detail="Missions below are stored by the AeroTwin API, not static dashboard rows." action={<button className="button primary" onClick={() => navigate('/missions/new')}><Plus size={16} /> New mission</button>} />{error && <Notice tone="error" title="Could not load missions" detail={error} />}<section className="panel table-panel"><SectionHeader eyebrow="LIVE API" title={loading ? 'Loading missions' : `${missions.length} stored missions`} detail={currentMission ? `Active mission: ${currentMission.name}` : 'Choose a mission to inspect its reconstruction.'} action={<button className="text-button" onClick={() => void load()}><RefreshCcw size={13} /> Refresh</button>} />{missions.length === 0 && !loading ? <EmptyState title="No live missions" detail="Create a mission and upload your first drone capture." icon={<FolderOpen size={21} />} /> : <div className="table-wrap"><table><thead><tr><th>Mission</th><th>Location</th><th>Status</th><th>Type</th><th>Updated</th><th /></tr></thead><tbody>{missions.map((mission) => <tr key={mission.id} className={currentMission?.id === mission.id ? 'table-row-active' : ''} onClick={() => openMission(mission)}><td><span className="table-primary">{mission.name}</span><span className="table-secondary">{mission.id.slice(0, 8)}</span></td><td>{mission.location_name ?? 'No location supplied'}</td><td><StatusBadge tone={mission.status === 'COMPLETED' ? 'ready' : mission.status === 'FAILED' ? 'critical' : mission.status === 'PROCESSING' || mission.status === 'QUEUED' ? 'warning' : 'neutral'}>{mission.status}</StatusBadge></td><td>{mission.mission_type}</td><td>{formatDate(mission.updated_at)}</td><td><button className="icon-button" aria-label={`Open ${mission.name}`}><ArrowRight size={15} /></button></td></tr>)}</tbody></table></div>}</section><LiveNote>Mission files and reconstruction results stay isolated per mission in backend storage.</LiveNote></div>
}

export function LiveNewMissionPage() {
  const navigate = useNavigate()
  const { selectJob, selectMission } = useMissionWorkspace()
  const videoInput = useRef<HTMLInputElement>(null)
  const gpsInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [missionType, setMissionType] = useState('Infrastructure Survey')
  const [preset, setPreset] = useState<ApiJob['preset']>('BALANCED')
  const [video, setVideo] = useState<File | null>(null)
  const [gps, setGps] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusCopy, setStatusCopy] = useState('')

  const start = async () => {
    if (!name.trim() || !video) {
      setError('Add a mission name and select a drone video before starting.')
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      setStatusCopy('Creating mission record')
      const mission = await api.createMission({ name: name.trim(), location_name: location.trim() || null, description: description.trim() || null, mission_type: missionType })
      selectMission(mission)
      setStatusCopy('Uploading drone video')
      await api.uploadMissionFile(mission.id, 'video', video)
      if (gps) {
        setStatusCopy('Uploading GPS or flight metadata')
        await api.uploadMissionFile(mission.id, 'gps', gps)
      }
      setStatusCopy('Queueing reconstruction worker')
      const job = await api.startProcessing(mission.id, preset)
      selectJob(job)
      navigate('/processing')
    } catch (cause) {
      setError(messageFor(cause))
      setSubmitting(false)
    }
  }

  return <div className="page-content live-page"><PageTitle eyebrow="LIVE MISSION CREATION" title="Create a reconstruction mission" detail="The selected files are uploaded to the API, validated, and processed by the reconstruction worker." action={<StatusBadge tone="info">Live backend</StatusBadge>} />{error && <Notice tone="error" title="Mission could not start" detail={error} />}<div className="stepper">{['Mission', 'Video', 'Flight data', 'Process'].map((item, index) => <div className={`step ${index === 0 || (index === 1 && video) || (index === 2 && gps) ? 'complete' : ''} ${index === 1 && !video ? 'active' : ''}`} key={item}><span>{index === 0 || (index === 1 && video) || (index === 2 && gps) ? <CheckCircle2 size={14} /> : `0${index + 1}`}</span><strong>{item}</strong></div>)}</div><div className="new-mission-layout"><section className="panel upload-panel"><SectionHeader eyebrow="INPUT CONTRACT" title="Drone footage and mission details" detail="MP4, MOV, AVI, or MKV video is required. A CSV GPS track is optional but enables scale estimation." /><div className="input-grid"><label>Mission name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Highway bridge inspection" /></label><label>Capture location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location name or operational area" /></label><label>Mission type<select value={missionType} onChange={(event) => setMissionType(event.target.value)}><option>Infrastructure Survey</option><option>Disaster Assessment</option><option>Urban Mapping</option><option>Terrain Mapping</option><option>Inspection</option></select></label><label>Reconstruction preset<select value={preset} onChange={(event) => setPreset(event.target.value as ApiJob['preset'])}><option value="FAST">Fast</option><option value="BALANCED">Balanced</option><option value="HIGH_QUALITY">High quality</option></select></label></div><label className="wide-input">Operator note<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional purpose, camera configuration, or context" /></label><div className="live-upload-grid"><button className={`upload-zone compact-upload ${video ? 'uploaded' : ''}`} onClick={() => videoInput.current?.click()} type="button">{video ? <><CheckCircle2 size={24} /><strong>{video.name}</strong><span>{formatBytes(video.size)} / ready to upload</span></> : <><UploadCloud size={24} /><strong>Select drone video</strong><span>MP4, MOV, AVI, MKV</span></>}</button><button className={`upload-zone compact-upload ${gps ? 'uploaded' : ''}`} onClick={() => gpsInput.current?.click()} type="button">{gps ? <><CheckCircle2 size={24} /><strong>{gps.name}</strong><span>{formatBytes(gps.size)} / time-synchronized track</span></> : <><MapPinned size={24} /><strong>Add GPS track</strong><span>Optional CSV with time, latitude, longitude</span></>}</button></div><input ref={videoInput} className="file-input" type="file" accept=".mp4,.mov,.avi,.mkv,video/*" onChange={(event) => setVideo(event.target.files?.[0] ?? null)} /><input ref={gpsInput} className="file-input" type="file" accept=".csv,.srt,.json,.txt" onChange={(event) => setGps(event.target.files?.[0] ?? null)} /><div className="form-actions"><button className="button secondary" type="button" onClick={() => navigate('/missions')}>View missions</button><button className="button primary" type="button" onClick={() => void start()} disabled={submitting}>{submitting ? <RefreshCcw className="spin" size={15} /> : <Play size={15} />}{submitting ? statusCopy || 'Working' : 'Upload and start reconstruction'}</button></div></section><aside className="panel input-summary"><SectionHeader eyebrow="QUALITY & ACCURACY" title="Before you start" detail="The quality gate protects the worker from unusable footage." /><Checklist label="Drone video" done={Boolean(video)} detail={video ? `${formatBytes(video.size)} selected` : 'Required before processing'} /><Checklist label="GPS/flight metadata" done={Boolean(gps)} detail={gps ? 'Scale-estimation input attached' : 'Optional: model remains local-relative'} /><Checklist label="Frame quality gate" done detail="Blur, exposure, contrast, and redundancy are checked" /><Checklist label="Output honesty" done detail="Scale and CRS are reported from actual available data" /><div className="privacy-note"><ScanSearch size={15} /><span>Files are stored locally by the development backend. The API never invents GPS coordinates or accuracy values.</span></div></aside></div><LiveNote>For survey-grade measurements, provide synchronized GPS/RTK/PPK data and validate the output against independent checkpoints.</LiveNote></div>
}

export function LiveMeasurementsPage() {
  const { currentMission } = useMissionWorkspace()
  const [measurements, setMeasurements] = useState<ApiMeasurement[]>([])
  const [type, setType] = useState<ApiMeasurement['measurement_type']>('DISTANCE')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('m')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const load = async () => { if (currentMission) setMeasurements(await api.listMeasurements(currentMission.id)) }
  useEffect(() => { void load().catch((cause) => setError(messageFor(cause))) }, [currentMission?.id])
  const save = async () => {
    if (!currentMission || !value) return
    try { await api.createMeasurement(currentMission.id, { measurement_type: type, value: Number(value), unit, label: label || null, geometry: {}, source_asset_id: null }); setValue(''); setLabel(''); await load() } catch (cause) { setError(messageFor(cause)) }
  }
  if (!currentMission) return <LiveEmpty title="No live mission selected" detail="Choose a completed mission before recording an inspection measurement." actionLabel="Open missions" action={() => window.location.assign('/missions')} />
  return <div className="page-content live-page"><PageTitle eyebrow="DATABASE-BACKED INSPECTION" title="Measurements" detail="Record reviewed measurements against the selected mission. Metric claims still require a scaled, validated model." /><div className="measurement-entry panel"><div className="entry-title"><Ruler size={17} /><div><strong>Add reviewed measurement</strong><span>Store a measurement with the current mission record.</span></div></div><select value={type} onChange={(event) => setType(event.target.value as ApiMeasurement['measurement_type'])}><option value="DISTANCE">Distance</option><option value="AREA">Area</option><option value="HEIGHT">Height</option><option value="COORDINATE">Coordinate</option></select><input value={value} onChange={(event) => setValue(event.target.value)} type="number" placeholder="Value" /><input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unit" /><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Label (optional)" /><button className="button primary" onClick={() => void save()}><Plus size={15} /> Save</button></div>{error && <Notice tone="error" title="Measurement error" detail={error} />}<section className="panel table-panel"><SectionHeader eyebrow="LIVE MEASUREMENT LOG" title={`${measurements.length} stored measurements`} detail="These values are persisted by the backend API." /><div className="table-wrap"><table><thead><tr><th>ID</th><th>Type</th><th>Value</th><th>Label</th><th>Created</th></tr></thead><tbody>{measurements.map((measurement) => <tr key={measurement.id}><td className="mono-cell">{measurement.id.slice(0, 8)}</td><td>{measurement.measurement_type}</td><td className="value-cell">{measurement.value} {measurement.unit}</td><td>{measurement.label ?? '--'}</td><td>{formatDate(measurement.created_at)}</td></tr>)}</tbody></table></div></section><LiveNote>Values entered here are manually reviewed records. Automated geometry picking is enabled only after a dense, scaled reconstruction engine is configured.</LiveNote></div>
}

export function LiveAnalysisPage() {
  const { currentMission } = useMissionWorkspace()
  const [reconstruction, setReconstruction] = useState<ApiReconstruction | null>(null)
  const [defects, setDefects] = useState<ApiDefect[]>([])
  useEffect(() => { if (!currentMission) return; void Promise.all([api.getReconstruction(currentMission.id), api.listDefects(currentMission.id)]).then(([model, storedDefects]) => { setReconstruction(model); setDefects(storedDefects) }).catch(() => { setReconstruction(null); setDefects([]) }) }, [currentMission?.id])
  if (!currentMission) return <LiveEmpty title="No live mission selected" detail="Choose a reconstruction to review its measured quality metrics." actionLabel="Open missions" action={() => window.location.assign('/missions')} />
  const metrics = reconstruction?.metrics ?? {}
  return <div className="page-content live-page"><PageTitle eyebrow="ACTUAL RECONSTRUCTION METRICS" title="Model analysis" detail="Metrics below are computed and persisted by the reconstruction worker, not generated dashboard values." action={<StatusBadge tone={reconstruction ? 'ready' : 'neutral'}>{reconstruction ? reconstruction.engine : 'No model'}</StatusBadge>} /><div className="analysis-metrics"><AnalysisMetric label="Selected frames" value={String(numeric(metrics.selected_frame_count) ?? '--')} detail="Passed the video quality gate" /><AnalysisMetric label="Feature matches" value={String(numeric(metrics.raw_matches) ?? '--')} detail="Descriptor matches before geometry" /><AnalysisMetric label="Geometric inliers" value={String(numeric(metrics.geometric_inliers) ?? '--')} detail="Pose-consistent matched features" /><AnalysisMetric label="Inlier ratio" value={formatRatio(numeric(metrics.inlier_ratio))} detail="Not a metric accuracy score" /></div><div className="analysis-grid"><section className="panel detail-panel"><SectionHeader eyebrow="QUALITY GATE" title="Frame selection results" />{[['Sampled frames', numeric(metrics.sampled_frame_count)], ['Selected frames', numeric(metrics.selected_frame_count)], ['Blur/contrast rejects', numeric(record(metrics.rejected)?.blurry_or_low_contrast)], ['Exposure rejects', numeric(record(metrics.rejected)?.exposure)], ['Duplicate rejects', numeric(record(metrics.rejected)?.duplicate)]].map(([label, result]) => <div className="quality-row" key={String(label)}><span>{String(label)}</span><strong>{result ?? '--'}</strong><div className="quality-bar"><i style={{ width: `${Math.min(100, Number(result ?? 0))}%` }} /></div></div>)}</section><section className="panel object-panel"><SectionHeader eyebrow="INSPECTION FINDINGS" title="Stored findings" detail="Manual or future model-inference records for this mission." />{defects.length === 0 ? <div className="analysis-callout"><AlertTriangle size={15} /><span>No detection model is configured yet. Create findings through the API when a review identifies an issue.</span></div> : defects.map((defect) => <div className="object-row" key={defect.id}><div><span>{defect.label}</span><strong>{Math.round(defect.confidence * 100)}%</strong></div><ProgressBar value={defect.confidence * 100} tone={defect.severity === 'HIGH' || defect.severity === 'CRITICAL' ? 'red' : 'amber'} /></div>)}</section></div><LiveNote>AI object and defect inference is intentionally not claimed until a trained, validated inference service is attached to the worker.</LiveNote></div>
}

export function LiveReportsPage() {
  const { currentMission } = useMissionWorkspace()
  const [reconstruction, setReconstruction] = useState<ApiReconstruction | null>(null)
  useEffect(() => { if (currentMission) void api.getReconstruction(currentMission.id).then(setReconstruction).catch(() => setReconstruction(null)) }, [currentMission?.id])
  if (!currentMission) return <LiveEmpty title="No live mission selected" detail="Choose a mission to generate a report from its stored reconstruction result." actionLabel="Open missions" action={() => window.location.assign('/missions')} />
  const printReport = () => window.print()
  return <div className="page-content live-page report-live"><PageTitle eyebrow="LIVE MISSION REPORT" title="Report preview" detail="This report uses the current mission and persisted reconstruction metrics." action={<button className="button primary" onClick={printReport}><FileText size={16} /> Print or save PDF</button>} /><section className="panel report-preview"><div className="report-sheet"><div className="report-topline"><span>AEROTWIN / RECONSTRUCTION REPORT</span><span>{currentMission.id.slice(0, 8)}</span></div><div className="report-hero"><span className="eyebrow">SINGLE-PASS VIDEO RECONSTRUCTION</span><h2>{currentMission.name}</h2><p>{currentMission.location_name ?? 'No location provided'}</p></div><div className="report-kpis"><div><span>ENGINE</span><strong>{reconstruction?.engine ?? '--'}</strong></div><div><span>POINTS</span><strong>{reconstruction?.point_count.toLocaleString() ?? '--'}</strong></div><div><span>FACES</span><strong>{reconstruction?.mesh_faces.toLocaleString() ?? '--'}</strong></div></div><div className="report-line" /><div className="report-details"><p><b>Processing status:</b> {reconstruction?.status ?? 'No completed reconstruction'}</p><p><b>Coordinate reference:</b> {reconstruction?.coordinate_reference_system ?? '--'}</p><p><b>Scale status:</b> {reconstruction?.scale_status ?? '--'}</p><p><b>Selected frames:</b> {String(numeric(reconstruction?.metrics.selected_frame_count) ?? '--')}</p><p><b>Geometric inliers:</b> {String(numeric(reconstruction?.metrics.geometric_inliers) ?? '--')}</p></div></div></section><LiveNote>Use the browser print dialog to save this actual mission summary as a PDF. A server-side signed PDF workflow can be added once deployment storage is configured.</LiveNote></div>
}

function Counter({ label, value, percent }: { label: string; value: string; percent?: number }) { return <div className="counter-row"><span>{label}</span><strong>{value}</strong>{percent !== undefined && <ProgressBar value={percent} />}</div> }
function AnalysisMetric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="analysis-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div> }
function Checklist({ label, detail, done = false }: { label: string; detail: string; done?: boolean }) { return <div className="checklist-row"><span className={done ? 'done' : ''}>{done ? <CheckCircle2 size={15} /> : <span />}</span><div><strong>{label}</strong><small>{detail}</small></div></div> }
function PageTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>{action && <div className="heading-actions">{action}</div>}</div> }
function Notice({ tone, title, detail }: { tone: 'error' | 'info'; title: string; detail: string }) { return <div className={`live-notice ${tone}`}><AlertTriangle size={16} /><div><strong>{title}</strong><span>{detail}</span></div></div> }
function LiveNote({ children }: { children: ReactNode }) { return <div className="demo-note live-note"><span><CheckCircle2 size={14} /> Live data</span><p>{children}</p></div> }
function LiveEmpty({ title, detail, action, actionLabel }: { title: string; detail: string; action?: () => void; actionLabel?: string }) { return <div className="page-content live-empty-page"><EmptyState title={title} detail={detail} icon={<Layers3 size={24} />} />{action && <button className="button primary" onClick={action}>{actionLabel ?? 'Continue'} <ArrowRight size={15} /></button>}</div> }

function stageState(job: ApiJob | null, index: number, currentIndex: number): 'Complete' | 'Processing' | 'Queued' {
  if (!job) return 'Queued'
  if (job.status === 'COMPLETED') return 'Complete'
  if (job.status === 'FAILED') return index < Math.max(0, currentIndex) ? 'Complete' : 'Queued'
  if (index < currentIndex) return 'Complete'
  if (index === currentIndex) return 'Processing'
  return 'Queued'
}
function messageFor(cause: unknown) { return cause instanceof ApiError ? cause.message : 'The API could not complete this request.' }
function titleCase(value: string) { return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function record(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null }
function numeric(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null }
function formatRatio(value: number | null) { return value === null ? '--' : `${(value * 100).toFixed(1)}%` }
function formatBytes(value: number) { if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB` }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
