/**
 * Helper de error reporting — trackea la "última acción del usuario" y
 * construye el payload que se envía al endpoint /api/report-error.
 *
 * No usa hooks ni contexto para poder invocarse desde cualquier sitio
 * (incluido un ErrorBoundary de clase o el global-error.tsx de Next).
 */

let _lastAction: string | null = null
let _lastActionAt: string | null = null

export function trackLastAction(action: string): void {
  _lastAction = action
  _lastActionAt = new Date().toISOString()
}

export function getLastAction(): { action: string; at: string } | null {
  if (!_lastAction || !_lastActionAt) return null
  return { action: _lastAction, at: _lastActionAt }
}

export type ErrorSource = 'render' | 'api' | 'network' | 'manual' | 'boundary'

export interface ErrorInfoLike {
  source: ErrorSource
  message: string
  statusCode?: number
  endpoint?: string
  errorId?: string
}

export interface ReportErrorPayload {
  occurredAt: string
  url: string
  errorMessage: string
  errorSource: ErrorSource
  statusCode?: number
  endpoint?: string
  lastAction?: string
  userEmail?: string
  userPlan?: string
  userAgent: string
  platform: string
  language: string
  observaciones: string
  errorId?: string
}

export interface UserContextLike {
  email?: string
  plan?: string
}

/**
 * Construye el payload completo del reporte a partir de la info del error,
 * el contexto de usuario conocido en ese momento y las observaciones que el
 * usuario escriba en el modal. Nunca incluye stack trace.
 */
export function buildErrorPayload(
  info: ErrorInfoLike,
  user: UserContextLike,
  observaciones: string,
): ReportErrorPayload {
  const last = getLastAction()
  const nav = typeof navigator !== 'undefined' ? navigator : null
  return {
    occurredAt: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    errorMessage: truncate(normalizeMessage(info.message), 1500),
    errorSource: info.source,
    statusCode: info.statusCode,
    endpoint: info.endpoint,
    lastAction: last ? `${last.action} @ ${last.at}` : undefined,
    userEmail: user.email,
    userPlan: user.plan,
    userAgent: nav?.userAgent ?? '',
    platform: nav?.platform ?? '',
    language: nav?.language ?? '',
    observaciones: truncate(observaciones ?? '', 3500),
    errorId: info.errorId,
  }
}

/**
 * Elimina stack traces obvios del mensaje (líneas con "at " o rutas webpack),
 * para no filtrarlas al email aunque alguien las incluya accidentalmente.
 */
function normalizeMessage(message: string): string {
  if (!message) return ''
  return message
    .split('\n')
    .filter(line => !/^\s*at\s/.test(line) && !line.includes('webpack-internal://'))
    .join('\n')
    .trim()
}

function truncate(value: string, max: number): string {
  if (!value) return ''
  return value.length > max ? value.slice(0, max) + '…' : value
}
