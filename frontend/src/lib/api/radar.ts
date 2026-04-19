import { fetchApi, API_URL, ApiError, authHeaders } from './client'
import type { RadarData, Competidor, RadarAnalisisResult } from './types'

export async function getRadar(): Promise<RadarData> {
  return fetchApi<RadarData>('GET', '/api/radar')
}

export async function addCompetidor(placeId: string, nombre: string): Promise<Competidor> {
  const res = await fetch(`${API_URL}/api/radar/competidores`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ placeId, nombre }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'Error', data as Record<string, unknown>)
  }
  return res.json()
}

export async function removeCompetidor(id: string): Promise<void> {
  await fetchApi<void>('DELETE', `/api/radar/competidores/${id}`)
}

export async function runRadarAnalysis(): Promise<RadarAnalisisResult & { analisisEstaSemana: number }> {
  const res = await fetch(`${API_URL}/api/radar/analizar`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'Error', data as Record<string, unknown>)
  }
  return res.json()
}
