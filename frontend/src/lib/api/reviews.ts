import { fetchApi, API_URL, ApiError, authHeaders } from './client'
import type { ReviewResponses, PendingReview, GenerateForReviewResult, VelacreMetrics, AnalysisData } from './types'

export async function generateResponses(reviewText: string, tono?: string): Promise<ReviewResponses> {
  const res = await fetch(`${API_URL}/api/review/generate`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ reviewText, tono }),
  })
  if (!res.ok) {
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError(429, 'limit_reached', data as Record<string, unknown>)
    }
    const body = await res.text()
    throw new Error(body)
  }
  return res.json()
}

export async function saveManualReview(data: {
  reviewText: string
  tonoSeleccionado: string
  respuesta: string
  estado: 'pendiente' | 'respondida'
  contextoCliente?: string
  contextoRespuesta?: string
}): Promise<PendingReview> {
  const res = await fetch(`${API_URL}/api/review/save-manual`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}))
      throw new ApiError(429, 'limit_reached', body as Record<string, unknown>)
    }
    throw new Error(await res.text())
  }
  return res.json()
}

export async function getAllReviews(): Promise<PendingReview[]> {
  return fetchApi<PendingReview[]>('GET', '/api/review/all')
}

export async function getPendingReviews(): Promise<PendingReview[]> {
  return fetchApi<PendingReview[]>('GET', '/api/review/pending')
}

export async function setReviewEstado(id: string, estado: 'pendiente' | 'respondida' | 'ignorada'): Promise<void> {
  await fetchApi<void>('PUT', `/api/review/${id}/estado`, { estado })
}

export async function generateForReview(reviewId: string): Promise<GenerateForReviewResult> {
  const res = await fetch(`${API_URL}/api/review/${reviewId}/generate`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError(429, 'limit_reached', data as Record<string, unknown>)
    }
    throw new Error(await res.text())
  }
  return res.json()
}

export async function getMetrics(): Promise<VelacreMetrics> {
  return fetchApi<VelacreMetrics>('GET', '/api/review/metrics')
}

export async function getAnalysis(): Promise<AnalysisData> {
  return fetchApi<AnalysisData>('GET', '/api/review/analysis')
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
  return fetchApi<{ brillante: string; preocupa: string; accion: string }>('POST', '/api/health/analysis')
}

export async function publishToGoogle(reviewId: string, respuestaEditada: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/review/${reviewId}/publish-google`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ respuestaEditada }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, (data as Record<string, unknown>).error as string ?? await res.text(), data as Record<string, unknown>)
  }
}
