import { useState } from 'react'
import { Crosshair, Eye, EyeOff, Maximize2, Minus, MousePointer2, Move3d, Plus, Rotate3d, Target } from 'lucide-react'
import { defects } from '../data/mockData'
import type { Defect } from '../types'

export function ScenePreview({ full = false, onDefectSelect }: { full?: boolean; onDefectSelect?: (defect: Defect) => void }) {
  const [layers, setLayers] = useState({ terrain: true, structures: true, path: true, defects: true })
  const [activeTool, setActiveTool] = useState('orbit')
  const [zoom, setZoom] = useState(1)
  const toggle = (key: keyof typeof layers) => setLayers((current) => ({ ...current, [key]: !current[key] }))

  return <div className={`scene-workspace ${full ? 'scene-full' : ''}`}>
    <div className="scene-toolbar">
      <div className="scene-tool-group">
        <button className={activeTool === 'select' ? 'selected' : ''} onClick={() => setActiveTool('select')} title="Select object"><MousePointer2 size={15} /></button>
        <button className={activeTool === 'orbit' ? 'selected' : ''} onClick={() => setActiveTool('orbit')} title="Orbit view"><Rotate3d size={15} /></button>
        <button className={activeTool === 'pan' ? 'selected' : ''} onClick={() => setActiveTool('pan')} title="Pan view"><Move3d size={15} /></button>
        <button className={activeTool === 'measure' ? 'selected' : ''} onClick={() => setActiveTool('measure')} title="Measure"><Crosshair size={15} /></button>
      </div>
      <div className="scene-tool-group"><button onClick={() => setZoom((value) => Math.min(1.3, value + 0.1))} title="Zoom in"><Plus size={15} /></button><button onClick={() => setZoom((value) => Math.max(.8, value - 0.1))} title="Zoom out"><Minus size={15} /></button><button title="Fit model"><Maximize2 size={15} /></button></div>
    </div>
    <div className="scene-label scene-label-top"><span className="live-dot" /> 3D MODEL READY <b>WGS84 / UTM 43R</b></div>
    <div className="scene-view" style={{ transform: `scale(${zoom})` }}>
      <div className="scene-sky" />
      {layers.terrain && <div className="terrain-plane"><div className="terrain-grid" /><div className="terrain-slope slope-one" /><div className="terrain-slope slope-two" /><div className="terrain-road" /><div className="terrain-road road-two" /></div>}
      {layers.structures && <div className="scene-buildings"><span className="building building-a" /><span className="building building-b" /><span className="building building-c" /><span className="building building-d" /><span className="building building-e" /><span className="building building-f" /></div>}
      {layers.path && <div className="flight-path"><span className="path-start">START</span><span className="path-end">END</span><span className="drone-marker"><Target size={16} /></span></div>}
      {layers.defects && defects.map((defect, index) => <button key={defect.id} className={`defect-marker ${defect.severity.toLowerCase()}`} style={{ left: `${32 + index * 15}%`, top: `${43 - index * 8}%` }} onClick={() => onDefectSelect?.(defect)} title={`Open ${defect.id}`}><span>{index + 1}</span></button>)}
      <div className="scene-compass">N</div>
      <div className="scene-scale"><span /><b>50 m</b></div>
    </div>
    <div className="scene-footer"><div><span>MODEL QUALITY</span><strong>92%</strong></div><div><span>POINT DENSITY</span><strong>42 pts/m2</strong></div><div><span>LAST UPDATED</span><strong>09:42:18</strong></div></div>
    {full && <div className="layer-panel"><div className="layer-panel-title"><span>Scene layers</span><span className="layer-count">4 active</span></div>{([['terrain', 'Terrain'], ['structures', 'Structures'], ['path', 'Flight path'], ['defects', 'AI findings']] as const).map(([key, label]) => <button key={key} className="layer-row" onClick={() => toggle(key)}><span>{layers[key] ? <Eye size={14} /> : <EyeOff size={14} />}</span><span>{label}</span><i className={layers[key] ? 'on' : ''} /></button>)}</div>}
  </div>
}
