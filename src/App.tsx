import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { MissionWorkspaceProvider } from './context/MissionWorkspace'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/FeaturePages'
import { LiveAnalysisPage, LiveDigitalTwinPage, LiveMeasurementsPage, LiveMissionsPage, LiveNewMissionPage, LiveProcessingPage, LiveReportsPage } from './pages/LivePages'
import './styles.css'

export default function App() {
  return <MissionWorkspaceProvider><BrowserRouter><Routes><Route element={<AppShell />}><Route path="/" element={<DashboardPage />} /><Route path="/missions" element={<LiveMissionsPage />} /><Route path="/missions/new" element={<LiveNewMissionPage />} /><Route path="/processing" element={<LiveProcessingPage />} /><Route path="/digital-twin" element={<LiveDigitalTwinPage />} /><Route path="/analysis" element={<LiveAnalysisPage />} /><Route path="/measurements" element={<LiveMeasurementsPage />} /><Route path="/reports" element={<LiveReportsPage />} /><Route path="/settings" element={<SettingsPage />} /></Route></Routes></BrowserRouter></MissionWorkspaceProvider>
}
