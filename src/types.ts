export type Severity = 'High' | 'Medium' | 'Low'

export interface Mission {
  id: string
  name: string
  location: string
  status: 'Ready' | 'Processing' | 'Draft'
  updated: string
  coverage: string
  quality: string
}

export interface Defect {
  id: string
  type: string
  severity: Severity
  confidence: number
  location: string
  frame: string
  description: string
}

export interface ProcessingStage {
  name: string
  detail: string
  state: 'Complete' | 'Processing' | 'Queued'
  progress: number
  duration: string
}

export interface Measurement {
  id: string
  type: 'Distance' | 'Area' | 'Height' | 'Coordinate'
  value: string
  location: string
  timestamp: string
}
