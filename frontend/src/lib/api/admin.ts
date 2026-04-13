import { fetchApi, API_URL, ApiError, authHeaders } from './client'
import type { AdminUsuario, EstadoUsuario, MiniRadarResult } from './types'

export async function getAdminUsuarios(): Promise<AdminUsuario[]> {
  return fetchApi<AdminUsuario[]>('GET', '/api/admin/usuarios')
}

export async function cambiarEstado(id: string, estado: EstadoUsuario, diasPrueba?: number): Promise<void> {
  await fetchApi<void>('POST', `/api/admin/usuarios/${id}/estado`, { estado, diasPrueba })
}

export async function setProOverride(id: string, activo: boolean, diasExpira?: number): Promise<void> {
  await fetchApi<void>('POST', `/api/admin/usuarios/${id}/pro-override`, { activo, diasExpira: diasExpira ?? null })
}

export async function actualizarNotasAdmin(id: string, notas: string): Promise<void> {
  await fetchApi<void>('PUT', `/api/admin/usuarios/${id}/notas`, { notas })
}

export async function cambiarPlan(id: string, plan: 'basic' | 'core' | 'pro'): Promise<void> {
  await fetchApi<void>('POST', `/api/admin/usuarios/${id}/plan`, { plan })
}

export async function setAdminPlaceId(negocioId: string, placeId: string): Promise<void> {
  await fetchApi<void>('PUT', `/api/admin/negocios/${negocioId}/place`, { placeId })
}

export async function activarUsuario(id: string): Promise<void> {
  return cambiarEstado(id, 'activo')
}

export async function desactivarUsuario(id: string): Promise<void> {
  return cambiarEstado(id, 'baneado')
}

export async function asignarRol(id: string, rol: 'cliente' | 'admin'): Promise<void> {
  await fetchApi<void>('PUT', `/api/admin/usuarios/${id}/rol`, { rol })
}

export async function runMiniRadar(placeId: string, nombre?: string): Promise<MiniRadarResult> {
  const res = await fetch(`${API_URL}/api/admin/mini-radar`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ placeId, nombre }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, (data as { error?: string; mensaje?: string }).mensaje ?? (data as { error?: string }).error ?? `HTTP ${res.status}`, data as Record<string, unknown>)
  }
  return res.json()
}
