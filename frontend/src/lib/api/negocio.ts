import { fetchApi, API_URL, ApiError, authHeaders } from './client'
import type { Negocio, PlaceResult } from './types'

export async function getMyNegocio(): Promise<Negocio | null> {
  const res = await fetch(`${API_URL}/api/negocio/me`, { headers: await authHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

/** Devuelve todos los negocios ACTIVOS del usuario (multi-local), ordenados por creación ASC. */
export async function getMyNegocios(): Promise<Negocio[]> {
  return fetchApi<Negocio[]>('GET', '/api/negocio')
}

/** Como getMyNegocios pero incluye también los ocultos y deshabilitados (para Settings > Locales ocultos). */
export async function getMyNegociosIncludingHidden(): Promise<Negocio[]> {
  return fetchApi<Negocio[]>('GET', '/api/negocio?includeHidden=true')
}

/** Restaura un negocio previamente oculto. Puede fallar con slot_limit_reached si no hay slot libre. */
export async function restoreNegocio(id: string): Promise<Negocio> {
  return fetchApi<Negocio>('POST', `/api/negocio/${id}/restaurar`)
}

/** Marca un negocio como principal (el resto pierde el flag automáticamente). */
export async function markNegocioPrincipal(id: string): Promise<void> {
  await fetchApi<void>('POST', `/api/negocio/${id}/principal`)
}

/** Devuelve un negocio concreto del usuario. */
export async function getNegocioById(id: string): Promise<Negocio> {
  return fetchApi<Negocio>('GET', `/api/negocio/${id}`)
}

/** Actualiza un negocio concreto por ID (multi-local). */
export async function updateNegocioById(id: string, data: {
  nombre?: string
  email?: string
  telefono?: string
  descripcion?: string
  tonoPredefinido?: string
  placeId?: string
  palabrasClave?: string[]
}): Promise<Negocio> {
  return fetchApi<Negocio>('PUT', `/api/negocio/${id}`, data)
}

/** Elimina un negocio. Las reseñas y análisis asociados se borran en cascada. */
export async function deleteNegocio(id: string): Promise<void> {
  await fetchApi<void>('DELETE', `/api/negocio/${id}`)
}

/**
 * Crea un negocio. Si el usuario ya tuvo este place_id y lo ocultó, el backend devuelve
 * 409 con payload `{ error: 'existe_oculto', id, nombre }` — el caller debe preguntar al usuario
 * si quiere restaurar ese histórico o crear uno nuevo (tras desambiguar, re-enviar sin placeId o llamar a restoreNegocio).
 */
export async function createNegocio(data: {
  cif?: string
  nombre: string
  email?: string
  telefono?: string
  descripcion?: string
  tonoPredefinido?: string
  palabrasClave?: string[]
  placeId?: string
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

export async function syncReviews(negocioId?: string): Promise<{ newReviews: number }> {
  // negocioId explícito: override del header X-Negocio-Id (útil durante el onboarding
  // de un local adicional — el activo aún puede ser el primario).
  const qs = negocioId ? `?negocio_id=${encodeURIComponent(negocioId)}` : ''
  return fetchApi<{ newReviews: number }>('POST', `/api/places/sync${qs}`)
}
