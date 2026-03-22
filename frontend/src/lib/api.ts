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
  const res = await fetch(`${API_URL}/api/review/generate`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ reviewText, plataforma }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getMyNegocio(): Promise<Negocio | null> {
  const res = await fetch(`${API_URL}/api/negocio/me`, {
    headers: await authHeaders(),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createNegocio(data: {
  cif: string
  nombre: string
  email?: string
  telefono?: string
  descripcion?: string
  tonoPredefinido?: string
}): Promise<Negocio> {
  const res = await fetch(`${API_URL}/api/negocio`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function updateNegocio(data: {
  nombre?: string
  email?: string
  telefono?: string
  descripcion?: string
  tonoPredefinido?: string
}): Promise<Negocio> {
  const res = await fetch(`${API_URL}/api/negocio/me`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createUsuario(data: {
  nombre?: string
  telefono?: string
}): Promise<void> {
  const res = await fetch(`${API_URL}/api/usuario`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}
