import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  Bell,
  Box,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Map,
  Menu,
  Ruler,
  ScanSearch,
  Settings2,
  Upload,
  X,
} from 'lucide-react'
import { activeMission, navItems } from '../data/mockData'
import { useMissionWorkspace } from '../context/MissionWorkspace'

const icons = {
  dashboard: LayoutDashboard,
  missions: Map,
  processing: Activity,
  twin: Box,
  analysis: ScanSearch,
  measurements: Ruler,
  reports: FileText,
} as const

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { currentMission } = useMissionWorkspace()
  const location = useLocation()
  const navigate = useNavigate()
  const pageName = location.pathname === '/' ? 'Mission overview' : location.pathname.replace('/', '').replaceAll('-', ' ')
  const missionName = currentMission?.name ?? activeMission.name
  const missionLocation = currentMission?.location_name ?? activeMission.location
  const hasLiveMission = Boolean(currentMission)

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><span /></div>
          <div>
            <strong>AeroTwin</strong>
            <span>single-pass reconstruction</span>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-icon"><Map size={16} /></div>
          <div><span>ACTIVE MISSION</span><strong>{hasLiveMission ? missionName : 'Demo mission'}</strong></div>
          <ChevronDown size={15} className="muted-icon" />
        </div>

        <div className="nav-label">Workspace</div>
        <nav className="main-nav">
          {navItems.map((item) => {
            const Icon = icons[item.icon]
            return <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={17} /><span>{item.label}</span>{item.label === 'Processing' && <span className="nav-count">1</span>}</NavLink>
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="nav-label">System</div>
          <NavLink to="/settings" onClick={() => setSidebarOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Settings2 size={17} /><span>Settings</span></NavLink>
          <div className="system-status"><span className="status-dot green" /><div><strong>System operational</strong><span>All services responding</span></div></div>
          <div className="sidebar-version">AEROTWIN UI <span>{hasLiveMission ? 'live API' : 'demo mode'}</span></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-trigger" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{pageName}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className={`demo-chip ${hasLiveMission ? 'live-chip' : ''}`}><span className={`status-dot ${hasLiveMission ? 'green' : 'amber'}`} /> {hasLiveMission ? 'Live API data' : 'Simulation data'}</div>
            <div className="gps-status"><span className={`status-dot ${hasLiveMission ? 'amber' : 'green'}`} /><div><span>GPS</span><strong>{hasLiveMission ? 'Verify input' : 'RTK fixed'}</strong></div></div>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button>
            <button className="profile-button"><span className="avatar">SV</span><span className="profile-copy"><strong>Sujal Verma</strong><small>Operator</small></span><ChevronDown size={15} /></button>
          </div>
        </header>

        <div className="mission-strip">
          <div className="mission-strip-left"><span className="strip-kicker">CURRENT MISSION</span><strong>{missionName}</strong><span className={`status-badge ${hasLiveMission ? 'info' : 'ready'}`}>{hasLiveMission ? currentMission?.status : 'Model ready'}</span></div>
          <div className="mission-strip-right"><span><Upload size={13} /> {hasLiveMission ? 'Stored mission files' : activeMission.video}</span><span className="strip-divider" /><span>{missionLocation}</span><button className="strip-button" onClick={() => navigate('/missions/new')}>New mission <span>+</span></button></div>
        </div>
        <div className="page-scroll"><Outlet /></div>
      </main>
    </div>
  )
}
