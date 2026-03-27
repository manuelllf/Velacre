'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMyNegocio, updateNegocio, getMyUsuario, updateUsuario, getLemonCheckoutUrl, eliminarCuenta, type Negocio } from '@/lib/api'
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
  const [lsPortal, setLsPortal] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<'core' | 'pro' | null>(null)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [nombre, setNombre] = useState('')
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [form, setForm] = useState({
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
        setLsPortal(u.lsCustomerPortal ?? null)
        if (n) {
          setNegocio(n)
          setForm({
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
          descripcion: form.descripcion,
          tonoPredefinido: form.tonopredefinido,
        }),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleting) return
    setDeleting(true)
    try {
      await eliminarCuenta()
      await supabase.auth.signOut()
      router.replace('/')
    } catch {
      setError(s.dangerZone.deletingMsg)
      setDeleting(false)
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
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/inicio" className="font-bold text-base text-slate-900 dark:text-white">Velacre</Link>
            {negocio && <span className="hidden sm:inline text-sm text-slate-400 dark:text-slate-500">· {negocio.nombre}</span>}
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.replace('/') }}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            {t.app.common.logout}
          </button>
        </div>
      </header>
      <SectionNav />

      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-4">

        {/* Plan — full width */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">{s.planSection}</h2>
          </div>
          <div className="p-5">
          {plan === 'basic' ? (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{s.planChoose}</p>

              {/* Billing toggle */}
              <div className="flex items-center gap-2 mb-4">
                <button type="button" onClick={() => setBilling('monthly')}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${billing === 'monthly' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400'}`}
                >{s.monthly}</button>
                <button type="button" onClick={() => setBilling('yearly')}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${billing === 'yearly' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400'}`}
                >{s.yearly} <span className="text-emerald-500 dark:text-emerald-400">−17%</span></button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Core */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Core</p>
                      <ul className="mt-1.5 space-y-1">
                        {s.planCore.map(f => (
                          <li key={f} className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-right shrink-0">
                      {billing === 'yearly' ? (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">190 €<span className="text-xs font-normal text-slate-400">/año</span></p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">≈ 15,83 €/mes</p>
                        </>
                      ) : (
                        <p className="text-lg font-bold text-slate-900 dark:text-white">19 €<span className="text-xs font-normal text-slate-400">/mes</span></p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleUpgrade('core')} disabled={checkoutLoading !== null}
                    className="w-full py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {checkoutLoading === 'core' && <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />}
                    {checkoutLoading === 'core' ? s.planRedirecting : s.planChooseCore}
                  </button>
                </div>

                {/* Pro */}
                <div className="border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Pro</p>
                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded">{s.planRecommended}</span>
                      </div>
                      <ul className="space-y-1">
                        {s.planPro.map(f => (
                          <li key={f} className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-indigo-400 shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-right shrink-0">
                      {billing === 'yearly' ? (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">290 €<span className="text-xs font-normal text-slate-400">/año</span></p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">≈ 24,17 €/mes</p>
                        </>
                      ) : (
                        <p className="text-lg font-bold text-slate-900 dark:text-white">29 €<span className="text-xs font-normal text-slate-400">/mes</span></p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleUpgrade('pro')} disabled={checkoutLoading !== null}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {checkoutLoading === 'pro' && <span className="w-3 h-3 border border-white/60 border-t-transparent rounded-full animate-spin" />}
                    {checkoutLoading === 'pro' ? s.planRedirecting : s.planChoosePro}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
              <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">{s.planCurrent.replace('{plan}', plan)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.planThanks}</p>
              </div>
            </div>
          )}
          </div>
        </section>

        {/* Two-column on desktop: left info | right editable */}
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* LEFT: Google + Perfil */}
            <div className="lg:col-span-2 space-y-4">

              {/* Google Business */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">{s.googleSection}</h2>
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{s.googleDesc}</p>
                  {negocio?.placeId ? (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                      <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <div>
                        <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">{negocio.nombre}</p>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">{s.googleConnected}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                      <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-amber-700 dark:text-amber-300">{s.googleNotConnected}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Perfil */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">{s.profileSection}</h2>
                </div>
                <div className="p-5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{s.nameLabel}</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="María, Carlos, Ana..."
                  />
                </div>
              </section>
            </div>

            {/* RIGHT: Negocio editable + tono + save */}
            <div className="lg:col-span-3">
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 h-full flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">{s.businessSection}</h2>
                </div>
                <div className="p-5 space-y-5 flex-1">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{s.businessNameLabel}</label>
                    <div className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                      {negocio?.nombre ?? '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{s.descLabel}</label>
                    <textarea
                      rows={4}
                      value={form.descripcion}
                      onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      placeholder={s.descPlaceholder}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{s.toneSection}</label>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{s.toneSubtitle}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {TONOS.map(tono => (
                        <button
                          key={tono.value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, tonopredefinido: tono.value }))}
                          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                            form.tonopredefinido === tono.value
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">{tono.label}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tono.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </section>
            </div>
          </div>

          {/* Save button — full width, independent */}
          <div className="mt-4 space-y-3">
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800">{error}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t.app.common.saving}</>
              ) : saved ? (
                <>{s.savedMsg}</>
              ) : (
                s.saveBtn
              )}
            </button>
          </div>
        </form>

        {/* Danger Zone */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/60">
          <div className="px-5 py-4 border-b border-red-100 dark:border-red-900/40">
            <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">{s.dangerZone.title}</h2>
          </div>
          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{s.dangerZone.deleteAccount}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.dangerZone.deleteAccountDesc}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="shrink-0 px-4 py-2 text-xs font-semibold border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                {s.dangerZone.deleteAccount}
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* Delete account modal */}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { if (!deleting) setShowDeleteModal(false) }} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{s.dangerZone.deleteConfirmTitle}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{s.dangerZone.deleteConfirmWarning}</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {s.dangerZone.deleteConfirmLabel}
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={s.dangerZone.deleteConfirmPlaceholder}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono tracking-widest placeholder-slate-300 dark:placeholder-slate-600"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {s.dangerZone.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== s.dangerZone.deleteConfirmKeyword || deleting}
                className="flex-1 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleting ? s.dangerZone.deletingMsg : s.dangerZone.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-8 border-t border-slate-100 dark:border-slate-800 py-5">
        <div className="max-w-screen-xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-600">
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
