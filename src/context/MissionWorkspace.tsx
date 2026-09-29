import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ApiJob, ApiMission } from '../api/types'

const missionStorageKey = 'aerotwin.activeMission'
const jobStorageKey = 'aerotwin.activeJob'

interface MissionWorkspaceValue {
  currentMission: ApiMission | null
  currentJobId: string | null
  selectMission: (mission: ApiMission | null) => void
  selectJob: (job: ApiJob | null) => void
}

const MissionWorkspaceContext = createContext<MissionWorkspaceValue | null>(null)

function readStoredMission(): ApiMission | null {
  try {
    const raw = localStorage.getItem(missionStorageKey)
    return raw ? JSON.parse(raw) as ApiMission : null
  } catch {
    return null
  }
}

export function MissionWorkspaceProvider({ children }: { children: ReactNode }) {
  const [currentMission, setCurrentMission] = useState<ApiMission | null>(readStoredMission)
  const [currentJobId, setCurrentJobId] = useState<string | null>(() => localStorage.getItem(jobStorageKey))

  const selectMission = useCallback((mission: ApiMission | null) => {
    setCurrentMission(mission)
    if (mission) localStorage.setItem(missionStorageKey, JSON.stringify(mission))
    else localStorage.removeItem(missionStorageKey)
  }, [])

  const selectJob = useCallback((job: ApiJob | null) => {
    const jobId = job?.id ?? null
    setCurrentJobId(jobId)
    if (jobId) localStorage.setItem(jobStorageKey, jobId)
    else localStorage.removeItem(jobStorageKey)
  }, [])

  const value = useMemo(() => ({ currentMission, currentJobId, selectMission, selectJob }), [currentJobId, currentMission, selectJob, selectMission])
  return <MissionWorkspaceContext.Provider value={value}>{children}</MissionWorkspaceContext.Provider>
}

export function useMissionWorkspace(): MissionWorkspaceValue {
  const context = useContext(MissionWorkspaceContext)
  if (!context) throw new Error('useMissionWorkspace must be used inside MissionWorkspaceProvider')
  return context
}
