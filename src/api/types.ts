export interface ApiMission {
  id: string
  name: string
  location_name: string | null
  description: string | null
  mission_type: string
  status: string
  coordinate_reference_system: string
  created_at: string
  updated_at: string
}

export interface ApiFile {
  id: string
  kind: 'video' | 'gps'
  original_filename: string
  mime_type: string | null
  size_bytes: number
  checksum: string
  created_at: string
}

export interface ApiJob {
  id: string
  mission_id: string
  job_type: string
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLING' | 'CANCELLED'
  stage: string
  progress: number
  message: string
  engine: string
  preset: 'FAST' | 'BALANCED' | 'HIGH_QUALITY'
  error_code: string | null
  error_message: string | null
  metrics: Record<string, unknown>
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ApiAsset {
  id: string
  asset_type: 'POINT_CLOUD' | 'MESH' | string
  format: string
  mime_type: string
  size_bytes: number
  url: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface ApiReconstruction {
  id: string
  mission_id: string
  job_id: string
  status: string
  engine: string
  coordinate_reference_system: string
  scale_status: string
  point_count: number
  mesh_faces: number
  metrics: Record<string, unknown>
  warnings: string[]
  assets: ApiAsset[]
}

export interface ApiDefect {
  id: string
  mission_id: string
  label: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  confidence: number
  description: string | null
  recommendation: string | null
  frame_reference: string | null
  geometry: Record<string, unknown>
  created_at: string
}

export interface ApiMeasurement {
  id: string
  mission_id: string
  measurement_type: 'DISTANCE' | 'AREA' | 'HEIGHT' | 'COORDINATE'
  value: number
  unit: string
  label: string | null
  geometry: Record<string, unknown>
  source_asset_id: string | null
  created_at: string
}
