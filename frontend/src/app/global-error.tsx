'use client'

import { useEffect, useState } from 'react'
import ReportErrorModal from '@/components/ReportErrorModal'
import type { ErrorInfoLike } from '@/lib/errorReporter'

/**
 * Último bastión: boundary que envuelve al root layout de Next.js. Si todo lo
 * demás falla (incluido el propio layout), Next renderiza esta página. Tiene
 * que traer su propio <html>/<body> porque el layout raíz puede no haber
 * montado. Usamos estilos inline para no depender de globals.css.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (typeof console !== 'undefined') {
      console.error('[app/global-error.tsx]', error)
    }
  }, [error])

  const errorInfo: ErrorInfoLike = {
    source: 'render',
    message: error?.message ?? 'Unknown error',
    errorId: error?.digest,
  }

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 20px',
              borderRadius: '50%',
              background: 'rgba(244,63,94,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fb7185', fontSize: 28, lineHeight: 1 }}>!</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#f1f5f9' }}>
            La aplicación ha fallado
          </h1>
          <p style={{ margin: '10px 0 24px', fontSize: 14, color: '#94a3b8', lineHeight: 1.6 }}>
            Ha ocurrido un error crítico. Puedes recargar la aplicación o reportarnos el problema.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={() => reset()}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Recargar
            </button>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                padding: '10px 20px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
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
      </body>
    </html>
  )
}
