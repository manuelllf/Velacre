'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMyNegocio, updateNegocio, getMyUsuario, updateUsuario, eliminarCuenta, cancelarSuscripcion, type Negocio } from '@/lib/api'
import SectionNav from '@/components/SectionNav'
import WaitlistModal from '@/components/WaitlistModal'
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
  const [lsStatus, setLsStatus] = useState<string | null>(null)
  const [lsRenewsAt, setLsRenewsAt] = useState<string | null>(null)
  const [lsEndsAt, setLsEndsAt] = useState<string | null>(null)
  const [waitlistPlan, setWaitlistPlan] = useState<'core' | 'pro' | null>(null)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const [nombre, setNombre] = useState('')
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [form, setForm] = useState({
    descripcion: '',
    tonopredefinido: 'Profesional',
  })
  const [palabrasClave, setPalabrasClave] = useState<string[]>([])
  const [kwInput, setKwInput] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/login'); return }
      try {
        const [u, n] = await Promise.all([getMyUsuario(), getMyNegocio()])
        setNombre(u.nombre ?? '')
        setPlan(u.plan ?? 'basic')
        setLsStatus(u.lsStatus ?? null)
        setLsRenewsAt(u.lsRenewsAt ?? null)
        setLsEndsAt(u.lsEndsAt ?? null)
        if (n) {
          setNegocio(n)
          setForm({
            descripcion: n.descripcion ?? '',
            tonopredefinido: n.tonopredefinido ?? 'Profesional',
          })
          setPalabrasClave(n.palabrasClave ?? [])
        }
      } catch {
        setError('No se pudieron cargar los datos.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])


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
          palabrasClave,
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

  async function handleCancelSub() {
    if (cancelling) return
    setCancelling(true)
    try {
      const res = await cancelarSuscripcion()
      setLsStatus('cancelled')
      if (res.endsAt) setLsEndsAt(res.endsAt)
      setShowCancelModal(false)
    } catch {
      setError('No se pudo cancelar la suscripción. Inténtalo de nuevo.')
    } finally {
      setCancelling(false)
    }
  }

  function fmtDate(iso?: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
                  <button
                    type="button"
                    onClick={() => setWaitlistPlan('core')}
                    className="w-full py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    Reservar acceso anticipado
                  </button>
                </div>

                {/* Pro */}
                <div className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Pro</p>
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">{s.planRecommended}</span>
                      </div>
                      <ul className="space-y-1">
                        {s.planPro.map(f => (
                          <li key={f} className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />{f}
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
                  <button
                    type="button"
                    onClick={() => setWaitlistPlan('pro')}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    Reservar acceso anticipado
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {/* Plan activo — cabecera */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize">Plan {plan}</p>
                    {lsStatus === 'cancelled' ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Cancelado · acceso hasta {fmtDate(lsEndsAt)}</p>
                    ) : lsStatus === 'past_due' ? (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Pago pendiente</p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {lsRenewsAt ? `Próxima renovación: ${fmtDate(lsRenewsAt)}` : s.planThanks}
                      </p>
                    )}
                  </div>
                </div>
                {lsStatus === 'cancelled' ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    Cancelado
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    Activo
                  </span>
                )}
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
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder={s.descPlaceholder}
                    />
                  </div>
                  {/* Palabras clave SEO */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Palabras clave SEO</label>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Hasta 5. La IA las incluirá con naturalidad en las respuestas para mejorar tu posicionamiento.</p>
                    {palabrasClave.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {palabrasClave.map(kw => (
                          <span key={kw} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full border border-blue-200 dark:border-blue-700">
                            {kw}
                            <button type="button" onClick={() => setPalabrasClave(p => p.filter(k => k !== kw))} className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-100 leading-none">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    {palabrasClave.length < 5 && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={kwInput}
                          onChange={e => setKwInput(e.target.value)}
                          onKeyDown={e => {
                            if ((e.key === 'Enter' || e.key === ',') && kwInput.trim()) {
                              e.preventDefault()
                              const kw = kwInput.trim().replace(/,$/, '')
                              if (kw && !palabrasClave.includes(kw)) setPalabrasClave(p => [...p, kw])
                              setKwInput('')
                            }
                          }}
                          placeholder="cocina gallega, marisquería..."
                          className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const kw = kwInput.trim()
                            if (kw && !palabrasClave.includes(kw)) setPalabrasClave(p => [...p, kw])
                            setKwInput('')
                          }}
                          disabled={!kwInput.trim()}
                          className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          +
                        </button>
                      </div>
                    )}
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
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
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
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <div className="divide-y divide-slate-100 dark:divide-slate-800">

            {/* Cancelar suscripción — solo si está activa y no cancelada ya */}
            {plan !== 'basic' && lsStatus !== 'cancelled' && (
              <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{s.dangerZone.cancelSub}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.dangerZone.cancelSubDesc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="shrink-0 px-4 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {s.dangerZone.cancelSub}
                </button>
              </div>
            )}

            {/* Eliminar cuenta */}
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

      {/* Waitlist modal */}
      {waitlistPlan && (
        <WaitlistModal plan={waitlistPlan} onClose={() => setWaitlistPlan(null)} />
      )}

      {/* Cancel subscription modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { if (!cancelling) setShowCancelModal(false) }} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{s.dangerZone.cancelSub}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{s.dangerZone.cancelSubConfirm}</p>
            {lsRenewsAt && (
              <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Seguirás teniendo acceso hasta el <strong>{fmtDate(lsRenewsAt)}</strong>, cuando finaliza tu período actual.
                </p>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Mantener suscripción
              </button>
              <button
                type="button"
                onClick={handleCancelSub}
                disabled={cancelling}
                className="flex-1 py-2.5 text-sm font-semibold bg-slate-800 dark:bg-slate-700 text-white rounded-xl hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {cancelling ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}

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
