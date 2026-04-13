import { fetchApi, ApiError } from './client'
import type { GbpStatus, GbpLocation } from './types'

export async function getGbpAuthUrl(negocioId: string, returnTo: 'onboarding' | 'settings' = 'onboarding'): Promise<string> {
  const params = new URLSearchParams({ negocioId, returnTo })
  const data = await fetchApi<{ url: string }>('GET', `/api/google/auth-url?${params}`)
  return data.url
}

export async function getGbpStatus(): Promise<GbpStatus> {
  return fetchApi<GbpStatus>('GET', '/api/google/status')
}

export async function getGbpLocations(): Promise<GbpLocation[]> {
  return fetchApi<GbpLocation[]>('GET', '/api/google/locations')
}

export async function finalizeGbpConnection(locationName: string, displayName: string): Promise<void> {
  await fetchApi<void>('POST', '/api/google/finalize', { locationName, displayName })
}

export async function disconnectGbp(): Promise<void> {
  await fetchApi<void>('DELETE', '/api/google/disconnect')
}
