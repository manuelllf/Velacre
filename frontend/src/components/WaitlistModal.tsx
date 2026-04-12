'use client'

import { useState } from 'react'
import { getLemonCheckoutUrl } from '@/lib/api'

interface Props {
  plan: 'core' | 'pro'
  onClose: () => void
}

const PLAN_INFO: Record<'core' | 'pro', { name: string; price: string; desc: string }> = {
  core: {
    name: 'Core',
    price: '19 €/mes',
    desc: '20 respuestas IA al mes, panel de salud completo y gestión de reseñas.',
  },
  pro: {
    name: 'Pro',
    price: '49 €/mes',
    desc: 'Respuestas IA ilimitadas, Radar de Competencia y acceso completo sin restricciones.',
  },
}

export default function WaitlistModal({ plan, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const info = PLAN_INFO[plan]

  async function handleCheckout() {
    setLoading(true)
    setError('')
    try {
      const url = await getLemonCheckoutUrl(plan, 'monthly')
      window.location.href = url
    } catch {
      setError('No se pudo iniciar el pago. Inténtalo de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  plan === 'pro'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}>{info.name}</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{info.price}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pásate a {info.name}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{info.desc}</p>
            </div>
            <button type="button" onClick={onClose}
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Ahora no
            </button>
            <button type="button" onClick={handleCheckout} disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Redirigiendo...' : `Activar ${info.name} →`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
