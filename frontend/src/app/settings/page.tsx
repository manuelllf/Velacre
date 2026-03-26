'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMyNegocio, updateNegocio, getMyUsuario, updateUsuario, getLemonCheckoutUrl, type Negocio } from '@/lib/api'
import SectionNav from '@/components/SectionNav'
import { useLanguage } from '@/lib/i18n'

export default function SettingsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const s = t.app.settings

  const TONOS = [
    { value: 'Profesional', label: s.tonos.Profesional.label, desc: s.tonos.Profesional.desc },
    { value: 'Cercano', label: s.tonos.Cercano.label, desc: s.tonos.Cercano.desc },
    { value: 'Directo', label: s.tonos.Directo.label, desc: s.tonos.Directo.desc },
  ]

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<string>('basic')
  const [checkoutLoading, setCheckoutLoading] = useState<'core' | 'pro' | null>(null)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')

  const [nombre, setNombre] = useState('')
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    descripcion: '',
    tonopredefinido: 'Profesional',
  })

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/login'); return }
      try {
        const [u, n] = await Promise.all([getMyUsuario(), getMyNegocio()])
        setNombre(u.nombre ?? '')
        setPlan(u.plan ?? 'basic')
        if (n) {
          setNegocio(n)
          setForm({
            nombre: n.nombre ?? '',
            email: n.email ?? '',
            telefono: n.telefono ?? '',
            descripcion: n.descripcion ?? '',
            tonopredefinido: n.tonopredefinido ?? 'Profesional',
          })
        }
      } catch {
        setError('No se pudieron cargar los datos.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  async function handleUpgrade(selectedPlan: 'core' | 'pro') {
    setCheckoutLoading(selectedPlan)
    try {
      const url = await getLemonCheckoutUrl(selectedPlan, billing)
      window.location.href = url
    } catch {
      setError('No se pudo iniciar el proceso de pago. Inténtalo de nuevo.')
      setCheckoutLoading(null)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await Promise.all([
        updateUsuario({ nombre }),
        updateNegocio({
          nombre: form.nombre,
          email: form.email,
          telefono: form.telefono,
          descripcion: form.descripcion,
          tonoPredefinido: form.tonopredefinido,
        }),
      ])
      setNegocio(prev => prev ? { ...prev, nombre: form.nombre } : prev)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2">
              <Link href="/inicio" className="font-bold text-lg text-slate-900 dark:text-white">Velacre</Link>
              {negocio && <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400 font-normal">· {negocio.nombre}</span>}
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.replace('/') }}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="hidden sm:inline">{t.app.common.logout}</span>
              <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </header>
      <SectionNav />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Plan */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{s.planSection}</h2>

          {plan === 'basic' ? (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {s.planChoose}
              </p>

              {/* Toggle monthly / yearly */}
              <div className="flex items-center justify-center mb-5">
                <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setBilling('monthly')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${billing === 'monthly' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                  >
                    {s.monthly}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBilling('yearly')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${billing === 'yearly' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                  >
                    {s.yearly}
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">−17%</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Core */}
                <div className="rounded-xl border-2 border-slate-200 dark:border-slate-600 p-5 flex flex-col gap-3">
                  <div>
                    <p className="text-base font-bold text-slate-900 dark:text-white">Core</p>
                    {billing === 'yearly' ? (
                      <div className="mt-1">
                        <p className="text-2xl font-extrabold text-slate-900 dark:text-white">190 €<span className="text-sm font-normal text-slate-400">/año</span></p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">≈ 15,83 €/mes · 2 meses gratis</p>
                      </div>
                    ) : (
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">19 €<span className="text-sm font-normal text-slate-400">/mes</span></p>
                    )}
                  </div>
                  <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300 flex-1">
                    {s.planCore.map(f => (
                      <li key={f} className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleUpgrade('core')}
                    disabled={checkoutLoading !== null}
                    className="w-full py-2 rounded-xl border-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    {checkoutLoading === 'core' && <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />}
                    {checkoutLoading === 'core' ? s.planRedirecting : s.planChooseCore}
                  </button>
                </div>

                {/* Pro */}
                <div className="rounded-xl border-2 border-indigo-500 dark:border-indigo-400 p-5 flex flex-col gap-3 relative">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-0.5 rounded-full bg-indigo-600 text-white">{s.planRecommended}</span>
                  <div>
                    <p className="text-base font-bold text-slate-900 dark:text-white">Pro</p>
                    {billing === 'yearly' ? (
                      <div className="mt-1">
                        <p className="text-2xl font-extrabold text-slate-900 dark:text-white">290 €<span className="text-sm font-normal text-slate-400">/año</span></p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">≈ 24,17 €/mes · 2 meses gratis</p>
                      </div>
                    ) : (
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">29 €<span className="text-sm font-normal text-slate-400">/mes</span></p>
                    )}
                  </div>
                  <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300 flex-1">
                    {s.planPro.map(f => (
                      <li key={f} className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleUpgrade('pro')}
                    disabled={checkoutLoading !== null}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    {checkoutLoading === 'pro' && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {checkoutLoading === 'pro' ? s.planRedirecting : s.planChoosePro}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 capitalize">{s.planCurrent(plan)}</p>
                <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">{s.planThanks}</p>
              </div>
            </div>
          )}
        </div>

        {/* Google Business */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{s.googleSection}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            {s.googleDesc}
          </p>
          {negocio?.placeId ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">{negocio.nombre}</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">{s.googleConnected}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">{s.googleNotConnected}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Personal data */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">{s.profileSection}</h2>
            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">{s.nameLabel}</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="María, Carlos, Ana..."
              />
            </div>
          </div>

          {/* Business data */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">{s.businessSection}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">{s.businessNameLabel}</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">{s.emailLabel}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="contacto@negocio.com"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">{s.phoneLabel}</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="981 000 000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                  {s.descLabel}
                </label>
                <textarea
                  rows={3}
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder={s.descPlaceholder}
                />
              </div>
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-1">{s.toneSection}</label>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-3">{s.toneSubtitle}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {TONOS.map(tono => (
                    <button
                      key={tono.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, tonopredefinido: tono.value }))}
                      className={`p-3 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                        form.tonopredefinido === tono.value
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                          : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                      }`}
                    >
                      <div className="text-base font-medium text-slate-900 dark:text-white">{tono.label}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{tono.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-base text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t.app.common.saving}</>
            ) : saved ? (
              <>{s.savedMsg}</>
            ) : (
              s.saveBtn
            )}
          </button>
        </form>
      </main>

      <footer className="mt-8 border-t border-slate-100 dark:border-slate-800 py-5">
        <div className="max-w-2xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-600">
          <span>© {new Date().getFullYear()} Velacre · {t.footer.rights.replace('© 2026 Velacre. ', '')}</span>
          <div className="flex gap-4">
            <Link href="/privacidad" className="hover:text-slate-300 dark:hover:text-slate-400 transition-colors">{t.footer.privacy}</Link>
            <Link href="/terminos" className="hover:text-slate-300 dark:hover:text-slate-400 transition-colors">{t.footer.terms}</Link>
            <Link href="/contacto" className="hover:text-slate-300 dark:hover:text-slate-400 transition-colors">{t.footer.contact}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
