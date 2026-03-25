import { supabase } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5146'

/** Error de API con código HTTP. Distingue errores de sesión (401) de errores de red. */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
  }
}

export interface ReviewResponses {
  profesional: string
  cercano: string
  directo: string
  reviewId: string
  codigo: string
}

export interface Negocio {
  id: string
  codigo: string
  nombre: string
  email?: string
  telefono?: string
  descripcion?: string
  tonopredefinido: string
  placeId?: string
}

export interface PlaceResult {
  placeId: string
  name: string
  address: string
  rating?: number
}

export interface PendingReview {
  id: string
  googleReviewId?: string
  authorName?: string
  starRating?: number
  reviewDate: string
  clientereview: string
  respuestaProfesional?: string
  respuestaCercano?: string
  respuestaDirecto?: string
  tonoGenerado?: string
  reviewLanguage?: string
}

export async function generateResponses(
  reviewText: string,
  plataforma?: string
): Promise<ReviewResponses> {
  console.log('[api] generateResponses →', { plataforma, chars: reviewText.length })
  const res = await fetch(`${API_URL}/api/review/generate`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ reviewText, plataforma }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[api] generateResponses ERROR', res.status, body)
    throw new Error(body)
  }
  const data = await res.json()
  console.log('[api] generateResponses ← OK', data.codigo)
  return data
}

export async function getMyNegocio(): Promise<Negocio | null> {
  console.log('[api] getMyNegocio →')
  const res = await fetch(`${API_URL}/api/negocio/me`, {
    headers: await authHeaders(),
  })
  if (res.status === 404) {
    console.log('[api] getMyNegocio ← 404 (sin negocio)')
    return null
  }
  if (!res.ok) {
    const body = await res.text()
    console.error('[api] getMyNegocio ERROR', res.status, body)
    throw new ApiError(res.status, body)
  }
  const data = await res.json()
  console.log('[api] getMyNegocio ← OK', data.id)
  return data
}

export async function createNegocio(data: {
  cif?: string
  nombre: string
  email?: string
  telefono?: string
  descripcion?: string
  tonoPredefinido?: string
}): Promise<Negocio> {
  console.log('[api] createNegocio →', data.nombre)
  const res = await fetch(`${API_URL}/api/negocio`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[api] createNegocio ERROR', res.status, body)
    throw new Error(body)
  }
  const result = await res.json()
  console.log('[api] createNegocio ← OK', result.id)
  return result
}

export async function updateNegocio(data: {
  nombre?: string
  email?: string
  telefono?: string
  descripcion?: string
  tonoPredefinido?: string
  placeId?: string
}): Promise<Negocio> {
  console.log('[api] updateNegocio →', data)
  const res = await fetch(`${API_URL}/api/negocio/me`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[api] updateNegocio ERROR', res.status, body)
    throw new Error(body)
  }
  const result = await res.json()
  console.log('[api] updateNegocio ← OK')
  return result
}


export async function getMyUsuario(): Promise<{ id: string; nombre?: string; telefono?: string; activo: boolean; activoDesde?: string; isAdmin: boolean; plan: string }> {
  const res = await fetch(`${API_URL}/api/usuario/me`, { headers: await authHeaders() })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export interface AdminUsuario {
  id: string
  nombre?: string
  email?: string
  activo: boolean
  activoDesde?: string
  creadoFecha: string
  negocio?: { id: string; nombre: string } | null
  plan?: string
}

export async function getAdminUsuarios(): Promise<AdminUsuario[]> {
  const res = await fetch(`${API_URL}/api/admin/usuarios`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getAdminStats(): Promise<{ totalReviews: number; proUsers: number }> {
  const res = await fetch(`${API_URL}/api/admin/stats`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function activarUsuario(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/usuarios/${id}/activar`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function desactivarUsuario(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/usuarios/${id}/desactivar`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function cambiarPlan(id: string, plan: 'basic' | 'pro'): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/usuarios/${id}/plan`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ plan }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function updateUsuario(data: { nombre?: string; telefono?: string }): Promise<void> {
  const res = await fetch(`${API_URL}/api/usuario/me`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  console.log('[api] searchPlaces →', query)
  const res = await fetch(`${API_URL}/api/places/search?q=${encodeURIComponent(query)}`, {
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[api] searchPlaces ERROR', res.status, body)
    throw new Error(body)
  }
  const data = await res.json()
  console.log('[api] searchPlaces ← OK', data.length, 'resultados')
  return data
}

export async function syncReviews(): Promise<{ newReviews: number }> {
  console.log('[api] syncReviews →')
  const res = await fetch(`${API_URL}/api/places/sync`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[api] syncReviews ERROR', res.status, body)
    throw new Error(body)
  }
  const data = await res.json()
  console.log('[api] syncReviews ← OK', data.newReviews, 'nuevas')
  return data
}

export async function getAllReviews(): Promise<PendingReview[]> {
  const res = await fetch(`${API_URL}/api/review/all`, {
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new ApiError(res.status, body)
  }
  return res.json()
}

export async function getPendingReviews(): Promise<PendingReview[]> {
  console.log('[api] getPendingReviews →')
  const res = await fetch(`${API_URL}/api/review/pending`, {
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[api] getPendingReviews ERROR', res.status, body)
    throw new ApiError(res.status, body)
  }
  const data = await res.json()
  console.log('[api] getPendingReviews ← OK', data.length, 'reseñas')
  return data
}

export async function generateForReview(reviewId: string): Promise<{ response: string; tono: string }> {
  console.log('[api] generateForReview →', reviewId)
  const res = await fetch(`${API_URL}/api/review/${reviewId}/generate`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[api] generateForReview ERROR', res.status, body)
    throw new Error(body)
  }
  const data = await res.json()
  console.log('[api] generateForReview ← OK tono=', data.tono)
  return data
}

export interface VelacreMetrics {
  total: number
  velacreCount: number
  timeSavedMinutes: number
  currentResponseRate: number
  historicResponseRate: number
  improvement: number
}

export async function getMetrics(): Promise<VelacreMetrics> {
  const res = await fetch(`${API_URL}/api/review/metrics`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export interface AnalysisResult {
  brilla: string
  quema: string
  accion: string
  createdAt?: string
}

export interface AnalysisData {
  analysis: AnalysisResult | null
  currentReviewCount: number
  analysisReviewCount: number
}

export async function getAnalysis(): Promise<AnalysisData> {
  const res = await fetch(`${API_URL}/api/review/analysis`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getSummary(): Promise<{ brilla: string; quema: string; accion: string }> {
  const res = await fetch(`${API_URL}/api/review/analysis`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.text()
    let msg = body
    try { msg = JSON.parse(body).message ?? body } catch { /* raw */ }
    throw new Error(msg)
  }
  return res.json()
}

export async function getSummaryAnalysis(): Promise<{ brillante: string; preocupa: string; accion: string }> {
  console.log('[api] getSummaryAnalysis →')
  const res = await fetch(`${API_URL}/api/health/analysis`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[api] getSummaryAnalysis ERROR', res.status, body)
    throw new Error(body)
  }
  const data = await res.json()
  console.log('[api] getSummaryAnalysis ← OK')
  return data
}

export async function translateReview(reviewId: string): Promise<{ translation: string }> {
  const res = await fetch(`${API_URL}/api/review/${reviewId}/translate`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createUsuario(data: {
  nombre?: string
  telefono?: string
}, accessToken?: string): Promise<void> {
  console.log('[api] createUsuario →', data.nombre)
  const headers = accessToken
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }
    : await authHeaders()
  const res = await fetch(`${API_URL}/api/usuario`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[api] createUsuario ERROR', res.status, body)
    throw new Error(body)
  }
  console.log('[api] createUsuario ← OK')
}
