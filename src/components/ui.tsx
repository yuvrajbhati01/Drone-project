import type { ReactNode } from 'react'
import { ArrowUpRight, Check, Circle } from 'lucide-react'

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'ready' | 'warning' | 'critical' | 'neutral' | 'info' }) {
  return <span className={`status-badge ${tone}`}><span className="badge-dot" />{children}</span>
}

export function MetricCard({ label, value, detail, trend, accent = 'cyan', icon }: { label: string; value: string; detail: string; trend?: string; accent?: string; icon: ReactNode }) {
  return <div className={`metric-card accent-${accent}`}><div className="metric-card-top"><span className="metric-label">{label}</span><span className="metric-icon">{icon}</span></div><div className="metric-value">{value}</div><div className="metric-foot"><span>{detail}</span>{trend && <span className="metric-trend"><ArrowUpRight size={13} /> {trend}</span>}</div></div>
}

export function SectionHeader({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="section-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>
}

export function ProgressBar({ value, tone = 'cyan' }: { value: number; tone?: string }) {
  return <div className={`progress-track ${tone}`}><span style={{ width: `${value}%` }} /></div>
}

export function EmptyState({ title, detail, icon }: { title: string; detail: string; icon: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><span>{detail}</span></div>
}

export function PipelineState({ state }: { state: 'Complete' | 'Processing' | 'Queued' }) {
  if (state === 'Complete') return <span className="pipeline-state complete"><Check size={12} /> Complete</span>
  if (state === 'Processing') return <span className="pipeline-state processing"><Circle size={10} /> Processing</span>
  return <span className="pipeline-state queued">Queued</span>
}
