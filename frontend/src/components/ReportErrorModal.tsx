'use client'

import { useState } from 'react'
import { reportError } from '@/lib/api'
import { buildErrorPayload, type ErrorInfoLike, type UserContextLike } from '@/lib/errorReporter'

export interface ReportErrorModalProps {
  open: boolean
  onClose: () => void
  errorInfo: ErrorInfoLike
  userContext?: UserContextLike
}

/**
 * Modal que se abre cuando el usuario pulsa "Reportar problema" tras ver un
 * error real en la app. Muestra el contexto que se va a enviar, deja al usuario
 * añadir observaciones, y dispara POST /api/report-error.
 */
export default function ReportErrorModal({
  open,
  onClose,
  errorInfo,
  userContext,
}: ReportErrorModalProps) {
  const [observaciones, setObservaciones] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ reportId: string } | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  if (!open) return null

  async function handleSend() {
    if (sending) return
    setSending(true)
    setSendError(null)
    try {
      const payload = buildErrorPayload(errorInfo, userContext ?? {}, observaciones)
      const result = await reportError(payload)
      setSent({ reportId: result.reportId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo enviar el reporte'
      setSendError(msg)
    } finally {
      setSending(false)
    }
  }

  function handleClose() {
    if (sending) return
    setObservaciones('')
    setSent(null)
    setSendError(null)
    setShowDetails(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-error-title"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
          <h2 id="report-error-title" className="text-lg font-semibold text-slate-100">
            Reportar problema
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Se va a enviar un reporte a <span className="text-slate-200">info@velacre.com</span> con los detalles del error para que podamos solucionarlo.
          </p>
        </div>

        {sent ? (
          <div className="px-6 py-8 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-slate-100 font-medium">Reporte enviado. Gracias.</p>
              <p className="text-xs text-slate-500">Referencia: <span className="font-mono text-slate-400">{sent.reportId}</span></p>
            </div>
            <button
              onClick={handleClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label htmlFor="report-observaciones" className="block text-sm font-medium text-slate-300 mb-2">
                Observaciones <span className="text-slate-500 font-normal">(opcional)</span>
              </label>
              <textarea
                id="report-observaciones"
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="¿Qué estabas haciendo cuando ocurrió? ¿Algo más que nos ayude a reproducirlo?"
                rows={4}
                maxLength={3500}
                disabled={sending}
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none disabled:opacity-50"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowDetails(v => !v)}
              className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
            >
              {showDetails ? '▾ Ocultar detalles técnicos' : '▸ Ver detalles técnicos que se enviarán'}
            </button>

            {showDetails && (
              <div className="text-xs text-slate-400 space-y-1 bg-slate-950/60 border border-slate-800 rounded-lg p-3 font-mono">
                <div><span className="text-slate-500">Fuente:</span> {errorInfo.source}</div>
                <div><span className="text-slate-500">Mensaje:</span> <span className="break-all">{errorInfo.message}</span></div>
                {errorInfo.statusCode !== undefined && (
                  <div><span className="text-slate-500">Status:</span> {errorInfo.statusCode}</div>
                )}
                {errorInfo.endpoint && (
                  <div><span className="text-slate-500">Endpoint:</span> <span className="break-all">{errorInfo.endpoint}</span></div>
                )}
                {errorInfo.errorId && (
                  <div><span className="text-slate-500">Error ID:</span> {errorInfo.errorId}</div>
                )}
                <div className="pt-1 text-slate-500">
                  Se adjuntan también: URL, hora, email/plan del usuario, navegador y última acción. No se envía stack trace.
                </div>
              </div>
            )}

            {sendError && (
              <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg px-3 py-2">
                {sendError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={handleClose}
                disabled={sending}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending && (
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {sending ? 'Enviando…' : 'Enviar reporte'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
