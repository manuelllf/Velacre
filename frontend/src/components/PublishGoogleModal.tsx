'use client'

import { useState } from 'react'
import { publishToGoogle } from '@/lib/api'

interface Props {
  reviewId: string
  respuestaGenerada: string
  onClose: () => void
  onPublished: () => void
}

export default function PublishGoogleModal({ reviewId, respuestaGenerada, onClose, onPublished }: Props) {
  const [texto, setTexto]   = useState(respuestaGenerada)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const chars = texto.trim().length

  async function handlePublish() {
    if (!texto.trim()) return
    setLoading(true)
    setError(null)
    try {
      await publishToGoogle(reviewId, texto.trim())
      onPublished()
    } catch (e: unknown) {
      const msg = (e instanceof Error) ? e.message : 'Error desconocido'
      if (msg === 'gbp_not_connected') {
        setError('Tu cuenta de Google no está conectada. Ve a Configuración para conectarla.')
      } else if (msg === 'token_refresh_failed') {
        setError('La conexión con Google ha expirado. Ve a Configuración para reconectar.')
      } else {
        setError('No se pudo publicar en Google. Inténtalo de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {/* Google icon */}
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Publicar en Google</p>
              <p className="text-slate-400 text-xs">La respuesta aparecerá en tu perfil de Google</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
            disabled={loading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Textarea */}
        <div className="p-5">
          <label className="block text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">
            Respuesta a publicar
          </label>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={7}
            disabled={loading}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 text-sm
                       focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                       disabled:opacity-50 resize-none leading-relaxed"
            placeholder="Escribe tu respuesta..."
          />
          <p className="text-xs text-slate-500 mt-1 text-right">{chars} caracteres</p>

          {error && (
            <div className="mt-3 p-3 bg-red-900/40 border border-red-700/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handlePublish}
            disabled={loading || !texto.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                       disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Publicando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Publicar en Google
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
