import type { ApiAsset, ApiDefect, ApiFile, ApiJob, ApiMeasurement, ApiMission, ApiReconstruction } from './types'

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')

interface ApiEnvelope<T> {
  data: T
  meta?: Record<string, unknown>
}

export class ApiError extends Error {
  code: string

  constructor(message: string, code = 'API_ERROR') {
    super(message)
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = payload?.error ?? payload?.detail?.error
    throw new ApiError(error?.message ?? `Request failed with status ${response.status}.`, error?.code)
  }
  return (payload as ApiEnvelope<T>).data
}

export const api = {
  baseUrl: apiBase,
  assetUrl: (path: string) => `${apiBase}${path}`,
  listMissions: () => request<ApiMission[]>('/api/v1/missions'),
  getMission: (missionId: string) => request<ApiMission>(`/api/v1/missions/${missionId}`),
  createMission: (payload: Pick<ApiMission, 'name' | 'location_name' | 'description' | 'mission_type'>) => request<ApiMission>('/api/v1/missions', { method: 'POST', body: JSON.stringify(payload) }),
  uploadMissionFile: (missionId: string, kind: 'video' | 'gps', file: File) => {
    const form = new FormData()
    form.append('upload', file)
    return request<ApiFile>(`/api/v1/missions/${missionId}/files?kind=${kind}`, { method: 'POST', body: form })
  },
  startProcessing: (missionId: string, preset: ApiJob['preset']) => request<ApiJob>(`/api/v1/missions/${missionId}/process`, { method: 'POST', body: JSON.stringify({ preset, engine: 'auto' }) }),
  getJob: (jobId: string) => request<ApiJob>(`/api/v1/jobs/${jobId}`),
  listJobs: (missionId: string) => request<ApiJob[]>(`/api/v1/missions/${missionId}/jobs`),
  cancelJob: (jobId: string) => request<ApiJob>(`/api/v1/jobs/${jobId}/cancel`, { method: 'POST', body: '{}' }),
  getReconstruction: (missionId: string) => request<ApiReconstruction>(`/api/v1/missions/${missionId}/reconstruction`),
  listAssets: (missionId: string) => request<ApiAsset[]>(`/api/v1/missions/${missionId}/assets`),
  listDefects: (missionId: string) => request<ApiDefect[]>(`/api/v1/missions/${missionId}/defects`),
  createDefect: (missionId: string, payload: Omit<ApiDefect, 'id' | 'mission_id' | 'created_at'>) => request<ApiDefect>(`/api/v1/missions/${missionId}/defects`, { method: 'POST', body: JSON.stringify(payload) }),
  listMeasurements: (missionId: string) => request<ApiMeasurement[]>(`/api/v1/missions/${missionId}/measurements`),
  createMeasurement: (missionId: string, payload: Omit<ApiMeasurement, 'id' | 'mission_id' | 'created_at'>) => request<ApiMeasurement>(`/api/v1/missions/${missionId}/measurements`, { method: 'POST', body: JSON.stringify(payload) }),
}
