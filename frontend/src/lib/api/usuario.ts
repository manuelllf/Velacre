import { fetchApi, API_URL, ApiError, authHeaders } from './client'
import type { UserRol } from './types'
import { supabase } from '../supabase'

export async function getMyUsuario(): Promise<{
  id: string; nombre?: string; telefono?: string; activo: boolean; activoDesde?: string
  isAdmin: boolean; rol: UserRol; plan: string
  lsCustomerPortal?: string; lsSubscriptionId?: string; lsStatus?: string
  lsRenewsAt?: string; lsEndsAt?: string
  respuestasIaMes?: number
}> {
  return fetchApi('GET', '/api/usuario/me')
}

export async function createUsuario(data: {
  nombre?: string
  telefono?: string
}, accessToken?: string): Promise<void> {
  const headers = accessToken
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }
    : await authHeaders()
  const res = await fetch(`${API_URL}/api/usuario`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function updateUsuario(data: { nombre?: string; telefono?: string }): Promise<void> {
  await fetchApi<void>('PUT', '/api/usuario/me', data)
}

export async function eliminarCuenta(): Promise<void> {
  await fetchApi<void>('DELETE', '/api/usuario/me')
}

export async function cancelarSuscripcion(): Promise<{ endsAt?: string }> {
  return fetchApi<{ endsAt?: string }>('POST', '/api/lemonsqueezy/cancelar')
}

export async function getLemonCheckoutUrl(
  plan: 'core' | 'pro',
  billing: 'monthly' | 'yearly' = 'monthly'
): Promise<string> {
  const params = new URLSearchParams({ plan, billing })
  const data = await fetchApi<{ url: string }>('GET', `/api/lemonsqueezy/checkout?${params}`)
  return data.url
}

export async function notifyWaitlist(plan: 'core' | 'pro', notas?: string): Promise<void> {
  await fetchApi<void>('POST', '/api/notify/waitlist', { plan, notas: notas ?? '' })
}

export async function reportError(payload: import('../errorReporter').ReportErrorPayload): Promise<{ reportId: string }> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      (headers as Record<string, string>).Authorization = `Bearer ${session.access_token}`
    }
  } catch { /* sin sesión → se envía anónimo */ }

  const res = await fetch(`${API_URL}/api/report-error`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new ApiError(res.status, `report_error_failed_${res.status}`)
  return res.json()
}
