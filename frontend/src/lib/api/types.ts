export type { ReportErrorPayload } from '../errorReporter'

export interface ReviewResponses {
  retenida: boolean
  motivoRetencion?: string
  contextoCliente?: string
  contextoRespuesta?: string
  respuesta?: string
  profesional?: string
  cercano?: string
  directo?: string
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
  palabrasClave?: string[]
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
  respuesta?: string
  tonoGenerado?: string
  reviewLanguage?: string
  estado?: string
  keywordsUsadas?: string[]
  contextoCliente?: string
  contextoRespuesta?: string
  respondidaFecha?: string
  respuestaPublicada?: string
  publicadaEnGoogle?: boolean
  publicadaFecha?: string
  retenida?: boolean
  motivoRetencion?: string
  plataforma?: string
}

export interface GbpStatus {
  connected: boolean
  locationName?: string
  displayName?: string
  connectedAt?: string
}

export interface GbpLocation {
  locationName: string
  displayName: string
}

export interface GenerateForReviewResult {
  response: string | null
  tono: string
  contextoCliente?: string
  contextoRespuesta?: string
  retenida?: boolean
  motivoRetencion?: string
  softCapWarning?: boolean
}

export interface VelacreMetrics {
  total: number
  velacreCount: number
  timeSavedMinutes: number
  responseRate: number
  currentResponseRate: number
  historicResponseRate: number
  improvement: number
  topKeywordsUsadas: { word: string; count: number }[]
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

export type UserRol = 'admin' | 'cliente'
export type EstadoUsuario = 'activo' | 'baneado' | 'prueba' | 'prueba_expirada'

export interface AdminUsuario {
  id: string
  nombre?: string
  email?: string
  activo: boolean
  activoDesde?: string
  creadoFecha: string
  negocio?: { id: string; nombre: string; placeId?: string } | null
  plan: string
  rol: UserRol
  estado: EstadoUsuario
  pruebaHasta?: string
  proOverride: boolean
  proOverrideHasta?: string
  proEfectivo: boolean
  notasAdmin?: string
}

export interface Competidor {
  id: string
  placeId: string
  nombre: string
  createdAt: string
}

export interface RadarCompetidorResult {
  nombre: string
  fortaleza: string
  debilidad: string
  amenaza: 'alta' | 'media' | 'baja'
}

export interface RadarCategoria {
  nombre: string
  yo: number
  rivales: { nombre: string; score: number }[]
  insight: string
}

export interface RadarAnalisisResult {
  id: string
  createdAt: string
  resultado: {
    tuFortaleza: string
    tuDebilidad: string
    competidores: RadarCompetidorResult[]
    oportunidades: string[]
    accion: string
    categorias?: RadarCategoria[]
    accionPro?: string
  } | null
}

export interface RadarData {
  competidores: Competidor[]
  ultimoAnalisis: RadarAnalisisResult | null
  analisisEstaSemana: number
}

export interface MiniRadarStats {
  total: number  // Reseñas analizadas (últimos 30 días, cap 60)
  ratingAvg: number
  distribucion: { s5: number; s4: number; s3: number; s2: number; s1: number }
  pctRespondidas: number
  fechaDesde: string  // ISO — fecha de la reseña más antigua del sample
  fechaHasta: string  // ISO — fecha de la reseña más reciente del sample
}

export interface MiniRadarPeorResena {
  autor: string
  rating: number
  texto: string
  fecha: string
}

export interface MiniRadarOportunidad {
  titulo: string        // MAYÚSCULAS, max 50 chars
  descripcion: string   // 2-3 frases, max 400 chars
  ejemplos: string[]    // 2-3 extractos reales, max 140 chars cada uno (schema-garantizado)
}

export interface MiniRadarAnalisis {
  fortalezas: string[]
  debilidades: string[]
  accion: string
  resumen: string
  emailPitch: string
  oportunidad: MiniRadarOportunidad | null
}

export interface MiniRadarResult {
  placeId: string
  nombre?: string
  stats: MiniRadarStats
  peoresSinResponder: MiniRadarPeorResena[]
  analisis: MiniRadarAnalisis
  generadoEn: string
}
