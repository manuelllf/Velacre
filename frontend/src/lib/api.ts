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


export type UserRol = 'admin' | 'sales' | 'cliente'

export async function getMyUsuario(): Promise<{ id: string; nombre?: string; telefono?: string; activo: boolean; activoDesde?: string; isAdmin: boolean; rol: UserRol; plan: string }> {
  const res = await fetch(`${API_URL}/api/usuario/me`, { headers: await authHeaders() })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export type EstadoUsuario = 'activo' | 'baneado' | 'prueba' | 'prueba_expirada'

export interface AdminUsuario {
  id: string
  nombre?: string
  email?: string
  activo: boolean
  activoDesde?: string
  creadoFecha: string
  negocio?: { id: string; nombre: string; placeId?: string; salesId?: string } | null
  plan?: string
  rol: UserRol
  // God Mode fields
  estado: EstadoUsuario
  pruebaHasta?: string
  proOverride: boolean
  proOverrideHasta?: string
  proEfectivo: boolean
  notasAdmin?: string
}

export interface SalesTeamMember {
  id: string
  nombre?: string
  email?: string
  rol: string
  clientes: number
  negocios: Array<{ id: string; nombre: string; placeId?: string }>
}

export interface Liquidacion {
  id: string
  salesId: string
  salesNombre?: string
  anio: number
  mes: number
  ingresosBrutos: number
  costosApi: number
  feesPasarela: number
  neto: number
  comisionPct: number
  comision: number
  pagado: boolean
  pagadoFecha?: string
  notas?: string
}

export interface SalesPortfolioItem {
  negocioId: string
  nombre: string
  placeId?: string
  plan: string
  estadoUsuario: string
  activoDesde?: string
  userId?: string
}

export interface SalesComision {
  ingresosEstimados: number
  costosApiProrrateados: number
  neto: number
  comision: number
  totalClientes: number
  proClientes: number
}

export interface AdminStats {
  totalReviews: number
  totalUsuarios: number
  activos: number
  prueba: number
  baneados: number
  proUsers: number
  costoMesActual: { claude: number; outscraper: number; total: number; notas?: string }
}

export async function getAdminUsuarios(): Promise<AdminUsuario[]> {
  const res = await fetch(`${API_URL}/api/admin/usuarios`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await fetch(`${API_URL}/api/admin/stats`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function cambiarEstado(
  id: string,
  estado: EstadoUsuario,
  diasPrueba?: number
): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/usuarios/${id}/estado`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ estado, diasPrueba }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function setProOverride(
  id: string,
  activo: boolean,
  diasExpira?: number
): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/usuarios/${id}/pro-override`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ activo, diasExpira: diasExpira ?? null }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function actualizarNotasAdmin(id: string, notas: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/usuarios/${id}/notas`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ notas }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function upsertCosto(
  anio: number,
  mes: number,
  costoClaudeEur: number,
  costoOutscraperEur: number,
  notas?: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/costos/${anio}/${mes}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ costoClaudeEur, costoOutscraperEur, notas }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function setAdminPlaceId(negocioId: string, placeId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/negocios/${negocioId}/place`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ placeId }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function asignarRol(id: string, rol: 'cliente' | 'sales'): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/usuarios/${id}/rol`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ rol }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function asignarSales(negocioId: string, salesId: string | null): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/negocios/${negocioId}/sales`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ salesId }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function getSalesTeam(): Promise<SalesTeamMember[]> {
  const res = await fetch(`${API_URL}/api/admin/sales-team`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getLiquidaciones(): Promise<Liquidacion[]> {
  const res = await fetch(`${API_URL}/api/admin/liquidaciones`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function upsertLiquidacion(
  salesId: string, anio: number, mes: number,
  data: { ingresosBrutos: number; costosApi: number; feesPasarela: number; comisionPct: number; notas?: string }
): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/liquidaciones/${salesId}/${anio}/${mes}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function marcarLiquidacionPagada(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/liquidaciones/${id}/pagar`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error(await res.text())
}

// ─── Sales API ────────────────────────────────────────────────────────────────

export async function getSalesPortfolio(): Promise<{ negocios: SalesPortfolioItem[] }> {
  const res = await fetch(`${API_URL}/api/sales/portfolio`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getSalesComision(): Promise<SalesComision> {
  const res = await fetch(`${API_URL}/api/sales/comision`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getSalesLiquidaciones(): Promise<Liquidacion[]> {
  const res = await fetch(`${API_URL}/api/sales/liquidaciones`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function activarUsuario(id: string): Promise<void> {
  return cambiarEstado(id, 'activo')
}

export async function desactivarUsuario(id: string): Promise<void> {
  return cambiarEstado(id, 'baneado')
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

export interface GenerateForReviewResult {
  response: string
  tono: string
  /** Resumen en español de lo que dijo el cliente (solo para reseñas en idioma extranjero) */
  contextoCliente?: string
  /** Resumen en español de lo que responde la IA (solo para reseñas en idioma extranjero) */
  contextoRespuesta?: string
}

export async function generateForReview(reviewId: string): Promise<GenerateForReviewResult> {
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


// ─── Lemon Squeezy ────────────────────────────────────────────────────────────

/** Crea una sesión de checkout en Lemon Squeezy y devuelve la URL de pago. */
export async function getLemonCheckoutUrl(
  plan: 'core' | 'pro',
  billing: 'monthly' | 'yearly' = 'monthly'
): Promise<string> {
  const params = new URLSearchParams({ plan, billing })
  const res = await fetch(`${API_URL}/api/lemonsqueezy/checkout?${params}`, {
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data.url as string
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
