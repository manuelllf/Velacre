'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getMyNegocio, getMyUsuario, getLemonCheckoutUrl } from '@/lib/api'
import { useLanguage } from '@/lib/i18n'

export default function OnboardingPlanPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const ob = t.app.onboarding

  const FEATURES_CORE = t.app.settings.planCore
  const FEATURES_PRO = t.app.settings.planPro

  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [checkoutLoading, setCheckoutLoading] = useState<'core' | 'pro' | null>(null)
  const [checkoutError, setCheckoutError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function guard() {
      try {
        const [n, u] = await Promise.all([getMyNegocio(), getMyUsuario()])
        if (!n) { router.replace('/onboarding'); return }
        if (u.plan && u.plan !== 'basic') { router.replace('/inicio'); return }
      } catch {
        router.replace('/onboarding')
        return
      }
      setReady(true)
    }
    guard()
  }, [router])


  async function handleCheckout(p: 'core' | 'pro') {
    setCheckoutLoading(p)
    setCheckoutError('')
    try {
      const url = await getLemonCheckoutUrl(p, billing)
      window.location.href = url
    } catch {
      setCheckoutError('No se pudo iniciar el pago. Inténtalo de nuevo.')
      setCheckoutLoading(null)
    }
  }

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white">{ob.planTitle}</h1>
        <p className="text-slate-400 text-base mt-2">{ob.planSubtitle}</p>
      </div>

      {/* Toggle monthly / yearly */}
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
          {ob.planMonthly}
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
          {ob.planYearly}
          <span className="text-xs font-bold text-emerald-500">−17%</span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

        {/* Basic */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-lg font-bold text-white">Basic</p>
            <p className="text-3xl font-extrabold text-white mt-2">Gratis</p>
            <p className="text-xs text-slate-500 mt-1">Sin tarjeta</p>
          </div>
          <ul className="space-y-2 flex-1">
            {['3 respuestas IA/mes', 'Sincronización Google', 'Otras plataformas'].map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                <svg className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => router.replace('/inicio')}
            className="w-full py-3 rounded-xl border border-slate-600 text-slate-400 font-semibold text-sm hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Continuar gratis
          </button>
        </div>

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
            onClick={() => handleCheckout('core')}
            disabled={checkoutLoading !== null}
            className="w-full py-3 rounded-xl border-2 border-blue-500 text-blue-400 font-semibold text-sm hover:bg-blue-500/10 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkoutLoading === 'core' ? <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : null}
            Empezar con Core →
          </button>
        </div>

        {/* Pro */}
        <div className="bg-slate-800 border-2 border-blue-500 rounded-2xl p-6 flex flex-col gap-4 relative">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-blue-600 text-white">
            {ob.planRecommended}
          </span>
          <div>
            <p className="text-lg font-bold text-white">Pro</p>
            {billing === 'yearly' ? (
              <div className="mt-2">
                <p className="text-3xl font-extrabold text-white">490 €<span className="text-base font-normal text-slate-400">/año</span></p>
                <p className="text-sm text-emerald-400 font-medium mt-0.5">≈ 40,83 €/mes · 2 meses gratis</p>
              </div>
            ) : (
              <p className="text-3xl font-extrabold text-white mt-2">49 €<span className="text-base font-normal text-slate-400">/mes</span></p>
            )}
          </div>
          <ul className="space-y-2 flex-1">
            {FEATURES_PRO.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleCheckout('pro')}
            disabled={checkoutLoading !== null}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkoutLoading === 'pro' ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            Empezar con Pro →
          </button>
        </div>
      </div>

      {checkoutError && (
        <p className="text-sm text-red-400 mt-4">{checkoutError}</p>
      )}
    </div>
  )
}
