'use client'

import { useEffect, useState } from 'react'
import ReportErrorModal from '@/components/ReportErrorModal'
import type { ErrorInfoLike } from '@/lib/errorReporter'

/**
 * Error boundary por ruta (Next.js App Router). Se monta cuando algo lanza
 * en cualquier page.tsx / layout.tsx bajo app/. Permite recuperar sin perder
 * la sesión mediante reset(), y reportar el problema al mismo tiempo.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (typeof console !== 'undefined') {
      console.error('[app/error.tsx]', error)
    }
  }, [error])

  const errorInfo: ErrorInfoLike = {
    source: 'render',
    message: error?.message ?? 'Unknown error',
    errorId: error?.digest,
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/20 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-100">Esta página ha fallado</h1>
          <p className="text-sm text-slate-400">
            Ha ocurrido un error al cargar esta sección. Puedes reintentar o reportarnos el problema.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Reintentar
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors border border-slate-700"
          >
            Reportar problema
          </button>
        </div>
      </div>

      <ReportErrorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        errorInfo={errorInfo}
      />
    </div>
  )
}
