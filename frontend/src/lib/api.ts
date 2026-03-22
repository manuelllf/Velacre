import { supabase } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5146'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
  }
}

export interface ReviewResponses {
  profesional: string
  colegueo: string
  orgullosa: string
  reviewId: string
  codigo: string
}

export interface Negocio {
  id: string
  codigo: string
  cif: string
  nombre: string
  email?: string
  telefono?: string
  descripcion?: string
  tonopredefinido: string
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
    throw new Error(body)
  }
  const data = await res.json()
  console.log('[api] getMyNegocio ← OK', data.id)
  return data
}

export async function createNegocio(data: {
  cif: string
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
