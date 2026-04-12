'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import ReportErrorModal from './ReportErrorModal'
import type { ErrorInfoLike } from '@/lib/errorReporter'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  errorMessage: string
  modalOpen: boolean
}

/**
 * Error boundary global de React para crashes de render en cualquier
 * componente hijo. Evita la pantalla en blanco: muestra un fallback amable
 * con botón "Reportar problema" que abre ReportErrorModal.
 *
 * Los errores lanzados durante event handlers o async no los captura React
 * por diseño — esos se manejan con try/catch en cada página y muestran su
 * propio bloque de error con el mismo modal de reporte.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorMessage: '', modalOpen: false }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, errorMessage: error?.message ?? 'Unknown error' }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Sólo log cliente — no enviamos auto al backend, el usuario decide.
    if (typeof console !== 'undefined') {
      console.error('[ErrorBoundary] render crash:', error, info)
    }
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload()
  }

  private handleOpenModal = () => {
    this.setState({ modalOpen: true })
  }

  private handleCloseModal = () => {
    this.setState({ modalOpen: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const errorInfo: ErrorInfoLike = {
      source: 'boundary',
      message: this.state.errorMessage,
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
            <h1 className="text-xl font-semibold text-slate-100">Algo ha fallado</h1>
            <p className="text-sm text-slate-400">
              Ha ocurrido un error inesperado. Puedes recargar la página o reportarnos el problema para que lo arreglemos.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={this.handleReload}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Recargar página
            </button>
            <button
              onClick={this.handleOpenModal}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors border border-slate-700"
            >
              Reportar problema
            </button>
          </div>
        </div>

        <ReportErrorModal
          open={this.state.modalOpen}
          onClose={this.handleCloseModal}
          errorInfo={errorInfo}
        />
      </div>
    )
  }
}
