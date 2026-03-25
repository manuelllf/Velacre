'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getLemonCheckoutUrl } from '@/lib/api'

const FEATURES_CORE = [
  'Respuestas ilimitadas a reseñas',
  'Panel de reputación',
  'Sincronización automática con Google',
  'Soporte por email',
]

const FEATURES_PRO = [
  'Todo lo de Core',
  'Análisis IA de reputación mensual',
  'Informes de tendencias',
  'Soporte prioritario',
]

export default function OnboardingPlanPage() {
  const router = useRouter()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState<'core' | 'pro' | null>(null)
  const [error, setError] = useState('')

  const redirectUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/onboarding`
    : '/onboarding'

  async function handlePlan(plan: 'core' | 'pro') {
    setLoading(plan)
    setError('')
    try {
      const url = await getLemonCheckoutUrl(plan, billing, redirectUrl)
      window.location.href = url
    } catch {
      setError('No se pudo iniciar el proceso de pago. Inténtalo de nuevo.')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white">Velacre</h1>
        <p className="text-slate-400 text-base mt-2">Elige tu plan para empezar</p>
      </div>

      {/* Toggle mensual / anual */}
      <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1 mb-8">
        <button
          type="button"
          onClick={() => setBilling('monthly')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            billing === 'monthly'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Mensual
        </button>
        <button
          type="button"
          onClick={() => setBilling('yearly')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
            billing === 'yearly'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Anual
          <span className="text-xs font-bold text-emerald-500">−17%</span>
        </button>
      </div>

      {/* Tarjetas */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">

        {/* Core */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-lg font-bold text-white">Core</p>
            {billing === 'yearly' ? (
              <div className="mt-2">
                <p className="text-3xl font-extrabold text-white">190 €<span className="text-base font-normal text-slate-400">/año</span></p>
                <p className="text-sm text-emerald-400 font-medium mt-0.5">≈ 15,83 €/mes · 2 meses gratis</p>
              </div>
            ) : (
              <p className="text-3xl font-extrabold text-white mt-2">19 €<span className="text-base font-normal text-slate-400">/mes</span></p>
            )}
          </div>
          <ul className="space-y-2 flex-1">
            {FEATURES_CORE.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handlePlan('core')}
            disabled={loading !== null}
            className="w-full py-3 rounded-xl border-2 border-indigo-500 text-indigo-400 font-semibold text-sm hover:bg-indigo-500/10 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {loading === 'core' && <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
            {loading === 'core' ? 'Redirigiendo...' : 'Elegir Core'}
          </button>
        </div>

        {/* Pro */}
        <div className="bg-slate-800 border-2 border-indigo-500 rounded-2xl p-6 flex flex-col gap-4 relative">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-indigo-600 text-white">
            Recomendado
          </span>
          <div>
            <p className="text-lg font-bold text-white">Pro</p>
            {billing === 'yearly' ? (
              <div className="mt-2">
                <p className="text-3xl font-extrabold text-white">290 €<span className="text-base font-normal text-slate-400">/año</span></p>
                <p className="text-sm text-emerald-400 font-medium mt-0.5">≈ 24,17 €/mes · 2 meses gratis</p>
              </div>
            ) : (
              <p className="text-3xl font-extrabold text-white mt-2">29 €<span className="text-base font-normal text-slate-400">/mes</span></p>
            )}
          </div>
          <ul className="space-y-2 flex-1">
            {FEATURES_PRO.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                <svg className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handlePlan('pro')}
            disabled={loading !== null}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {loading === 'pro' && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading === 'pro' ? 'Redirigiendo...' : 'Elegir Pro'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 px-4 py-3 rounded-xl mb-4 max-w-2xl w-full text-center">
          {error}
        </p>
      )}

      {/* Skip */}
      <button
        onClick={() => router.replace('/onboarding')}
        disabled={loading !== null}
        className="text-sm text-slate-500 hover:text-slate-400 transition-colors cursor-pointer disabled:opacity-50"
      >
        Continuar sin plan de pago →
      </button>
      <p className="text-xs text-slate-600 mt-2">Podrás suscribirte en cualquier momento desde Configuración</p>
    </div>
  )
}
