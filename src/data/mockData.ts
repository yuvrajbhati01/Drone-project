import type { Defect, Measurement, Mission, ProcessingStage } from '../types'

export const activeMission = {
  name: 'Jodhpur Infrastructure Survey',
  location: 'Jodhpur, Rajasthan, India',
  id: 'AT-JOD-2409',
  drone: 'Survey UAV X1',
  camera: '4K RGB Camera',
  video: 'survey_flight_01.mp4',
  duration: '08:42',
  distance: '2.84 km',
  frames: '2,486',
  coverage: '94.7%',
  quality: '91.8%',
  confidence: '92%',
}

export const missions: Mission[] = [
  { id: 'AT-JOD-2409', name: 'Jodhpur Infrastructure Survey', location: 'Jodhpur, Rajasthan', status: 'Ready', updated: 'Today, 09:42', coverage: '94.7%', quality: '91.8%' },
  { id: 'AT-JOD-2388', name: 'Airport Perimeter Pass', location: 'Jodhpur, Rajasthan', status: 'Processing', updated: 'Yesterday, 16:20', coverage: '67.2%', quality: '84.1%' },
  { id: 'AT-KOT-2271', name: 'Canal Network Inspection', location: 'Kota, Rajasthan', status: 'Ready', updated: '18 Sep 2026', coverage: '98.1%', quality: '94.3%' },
  { id: 'AT-BIK-2194', name: 'Heritage Precinct Survey', location: 'Bikaner, Rajasthan', status: 'Draft', updated: '12 Sep 2026', coverage: '--', quality: '--' },
]

export const defects: Defect[] = [
  { id: 'DEF-001', type: 'Building facade crack', severity: 'High', confidence: 94, location: '26.2389, 73.0243', frame: 'Frame 1842', description: 'Linear surface anomaly detected on the east facade of the primary structure.' },
  { id: 'DEF-002', type: 'Roof damage', severity: 'Medium', confidence: 87, location: '26.2398, 73.0261', frame: 'Frame 1920', description: 'Possible surface degradation near the rooftop service access.' },
  { id: 'DEF-003', type: 'Road surface damage', severity: 'Low', confidence: 79, location: '26.2377, 73.0228', frame: 'Frame 2114', description: 'Small depression identified on the northern service road.' },
]

export const processingStages: ProcessingStage[] = [
  { name: 'Video ingest', detail: '2,486 frames indexed', state: 'Complete', progress: 100, duration: '00:42' },
  { name: 'Feature tracking', detail: '1.8M keypoints tracked', state: 'Complete', progress: 100, duration: '01:18' },
  { name: 'Camera pose estimation', detail: '1,921 poses aligned', state: 'Complete', progress: 100, duration: '00:56' },
  { name: 'Depth estimation', detail: 'Scene depth map in progress', state: 'Processing', progress: 78, duration: '02:14' },
  { name: '3D reconstruction', detail: 'Waiting for depth maps', state: 'Queued', progress: 0, duration: '--' },
  { name: 'Georeferencing and textures', detail: 'Waiting for mesh', state: 'Queued', progress: 0, duration: '--' },
]

export const measurements: Measurement[] = [
  { id: 'M-001', type: 'Distance', value: '12.84 m', location: 'Admin block to road edge', timestamp: 'Today, 09:37' },
  { id: 'M-002', type: 'Area', value: '146.7 m2', location: 'Warehouse rooftop', timestamp: 'Today, 09:35' },
  { id: 'M-003', type: 'Height', value: '18.4 m', location: 'Primary structure', timestamp: 'Today, 09:31' },
  { id: 'M-004', type: 'Coordinate', value: '26.2389, 73.0243', location: 'DEF-001 marker', timestamp: 'Today, 09:28' },
]

export const navItems = [
  { label: 'Overview', path: '/', icon: 'dashboard' },
  { label: 'Missions', path: '/missions', icon: 'missions' },
  { label: 'Processing', path: '/processing', icon: 'processing' },
  { label: 'Digital Twin', path: '/digital-twin', icon: 'twin' },
  { label: 'AI Analysis', path: '/analysis', icon: 'analysis' },
  { label: 'Measurements', path: '/measurements', icon: 'measurements' },
  { label: 'Reports', path: '/reports', icon: 'reports' },
] as const
