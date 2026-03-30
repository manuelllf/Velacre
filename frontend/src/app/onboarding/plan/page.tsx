'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getMyNegocio, getMyUsuario } from '@/lib/api'
import { useLanguage } from '@/lib/i18n'
import WaitlistModal from '@/components/WaitlistModal'

export default function OnboardingPlanPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const ob = t.app.onboarding

  const FEATURES_CORE = t.app.settings.planCore
  const FEATURES_PRO = t.app.settings.planPro

  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [waitlistPlan, setWaitlistPlan] = useState<'core' | 'pro' | null>(null)
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


  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
            {['3 respuestas IA/mes', 'Sync Google (últimas 10)', 'Otras plataformas'].map(f => (
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
                <p className="text-3xl font-extrabold text-white">199 €<span className="text-base font-normal text-slate-400">/año</span></p>
                <p className="text-sm text-emerald-400 font-medium mt-0.5">≈ 16,58 €/mes · 2 meses gratis</p>
              </div>
            ) : (
              <p className="text-3xl font-extrabold text-white mt-2">19,90 €<span className="text-base font-normal text-slate-400">/mes</span></p>
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
            onClick={() => setWaitlistPlan('core')}
            className="w-full py-3 rounded-xl border-2 border-indigo-500 text-indigo-400 font-semibold text-sm hover:bg-indigo-500/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            Reservar acceso anticipado
          </button>
        </div>

        {/* Pro */}
        <div className="bg-slate-800 border-2 border-indigo-500 rounded-2xl p-6 flex flex-col gap-4 relative">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-indigo-600 text-white">
            {ob.planRecommended}
          </span>
          <div>
            <p className="text-lg font-bold text-white">Pro</p>
            {billing === 'yearly' ? (
              <div className="mt-2">
                <p className="text-3xl font-extrabold text-white">299 €<span className="text-base font-normal text-slate-400">/año</span></p>
                <p className="text-sm text-emerald-400 font-medium mt-0.5">≈ 24,92 €/mes · 2 meses gratis</p>
              </div>
            ) : (
              <p className="text-3xl font-extrabold text-white mt-2">29,90 €<span className="text-base font-normal text-slate-400">/mes</span></p>
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
            onClick={() => setWaitlistPlan('pro')}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            Reservar acceso anticipado
          </button>
        </div>
      </div>

      {waitlistPlan && (
        <WaitlistModal plan={waitlistPlan} onClose={() => setWaitlistPlan(null)} />
      )}
    </div>
  )
}
