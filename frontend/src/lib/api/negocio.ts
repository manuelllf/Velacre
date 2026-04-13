import { fetchApi, API_URL, ApiError, authHeaders } from './client'
import type { Negocio, PlaceResult } from './types'

export async function getMyNegocio(): Promise<Negocio | null> {
  const res = await fetch(`${API_URL}/api/negocio/me`, { headers: await authHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export async function createNegocio(data: {
  cif?: string
  nombre: string
  email?: string
  telefono?: string
  descripcion?: string
  tonoPredefinido?: string
  palabrasClave?: string[]
}): Promise<Negocio> {
  return fetchApi<Negocio>('POST', '/api/negocio', data)
}

export async function updateNegocio(data: {
  nombre?: string
  email?: string
  telefono?: string
  descripcion?: string
  tonoPredefinido?: string
  placeId?: string
  palabrasClave?: string[]
}): Promise<Negocio> {
  return fetchApi<Negocio>('PUT', '/api/negocio/me', data)
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  return fetchApi<PlaceResult[]>('GET', `/api/places/search?q=${encodeURIComponent(query)}`)
}

export async function syncReviews(): Promise<{ newReviews: number }> {
  return fetchApi<{ newReviews: number }>('POST', '/api/places/sync')
}
