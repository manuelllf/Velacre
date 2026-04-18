'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMyNegocio, updateNegocio, getMyUsuario, updateUsuario, eliminarCuenta, getLemonCheckoutUrl, getGbpStatus, getGbpAuthUrl, getGbpLocations, finalizeGbpConnection, disconnectGbp, type Negocio, type GbpStatus, type GbpLocation } from '@/lib/api'
import SectionNav from '@/components/SectionNav'
import Tooltip from '@/components/Tooltip'
import { HelpButton } from '@/components/HelpModal'
import { useLanguage } from '@/lib/i18n'
import { AppHeader } from '@/components/AppHeader'
import { AppFooter } from '@/components/AppFooter'

export default function SettingsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const s = t.app.settings

  const TONOS = [
    { value: 'Profesional', label: s.tonos.Profesional.label, desc: s.tonos.Profesional.desc },
    { value: 'Empatico', label: s.tonos.Empatico.label, desc: s.tonos.Empatico.desc },
    { value: 'Cercano', label: s.tonos.Cercano.label, desc: s.tonos.Cercano.desc },
    { value: 'Directo', label: s.tonos.Directo.label, desc: s.tonos.Directo.desc },
    { value: 'Agradecido', label: s.tonos.Agradecido.label, desc: s.tonos.Agradecido.desc },
    { value: 'Humoristico', label: s.tonos.Humoristico.label, desc: s.tonos.Humoristico.desc },
  ]

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<string>('basic')
  const [lsStatus, setLsStatus] = useState<string | null>(null)
  const [lsRenewsAt, setLsRenewsAt] = useState<string | null>(null)
  const [lsEndsAt, setLsEndsAt] = useState<string | null>(null)
  const [lsCustomerPortal, setLsCustomerPortal] = useState<string | null>(null)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [checkoutLoading, setCheckoutLoading] = useState<'core' | 'pro' | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // GBP state
  const [gbpStatus,           setGbpStatus]           = useState<GbpStatus | null>(null)
  const [showDisconnectModal,  setShowDisconnectModal]  = useState(false)
  const [disconnecting,        setDisconnecting]        = useState(false)
  const [connectingGbp,        setConnectingGbp]        = useState(false)
  const [gbpMsg,               setGbpMsg]               = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  // GBP select-location flow (when coming back from OAuth with multiple locations)
  const [gbpSelectLocations,   setGbpSelectLocations]   = useState<GbpLocation[]>([])
  const [gbpSelectedLoc,       setGbpSelectedLoc]       = useState<GbpLocation | null>(null)
  const [showLocationModal,    setShowLocationModal]    = useState(false)
  const [finalizingLocation,   setFinalizingLocation]   = useState(false)

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
        const [u, n, gbp] = await Promise.all([getMyUsuario(), getMyNegocio(), getGbpStatus().catch(() => null)])
        setNombre(u.nombre ?? '')
        setPlan(u.plan ?? 'basic')
        setLsStatus(u.lsStatus ?? null)
        setLsRenewsAt(u.lsRenewsAt ?? null)
        setLsEndsAt(u.lsEndsAt ?? null)
        setLsCustomerPortal(u.lsCustomerPortal ?? null)
        if (n) {
          setNegocio(n)
          setForm({
            descripcion: n.descripcion ?? '',
            tonopredefinido: n.tonopredefinido ?? 'Profesional',
          })
          setPalabrasClave(n.palabrasClave ?? [])
        }
        if (gbp) setGbpStatus(gbp)

        // Handle GBP OAuth callback params
        const params = new URLSearchParams(window.location.search)
        const gbpParam = params.get('gbp')
        if (gbpParam === 'connected') {
          const fresh = await getGbpStatus().catch(() => null)
          if (fresh) setGbpStatus(fresh)
          setGbpMsg({ type: 'ok', text: s.gbpConnectedMsg })
          window.history.replaceState({}, '', '/settings')
        } else if (gbpParam === 'select') {
          const locs = await getGbpLocations().catch(() => [])
          if (locs.length > 0) { setGbpSelectLocations(locs); setShowLocationModal(true) }
          else setGbpMsg({ type: 'err', text: s.gbpLocationError })
          window.history.replaceState({}, '', '/settings')
        } else if (gbpParam === 'error') {
          setGbpMsg({ type: 'err', text: s.gbpOauthError })
          window.history.replaceState({}, '', '/settings')
        }
      } catch {
        setError(s.loadError)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])


  // ── GBP handlers ─────────────────────────────────────────────────────────
  async function handleConnectGbp() {
    if (!negocio) return
    setConnectingGbp(true)
    setGbpMsg(null)
    try {
      const url = await getGbpAuthUrl(negocio.id, 'settings')
      window.location.href = url
    } catch {
      setGbpMsg({ type: 'err', text: s.gbpConnectError })
      setConnectingGbp(false)
    }
  }

  async function handleDisconnectGbp() {
    setDisconnecting(true)
    try {
      await disconnectGbp()
      setGbpStatus({ connected: false })
      setShowDisconnectModal(false)
      setGbpMsg({ type: 'ok', text: s.gbpDisconnectedMsg })
    } catch {
      setGbpMsg({ type: 'err', text: s.gbpDisconnectError })
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleFinalizeLocation() {
    if (!gbpSelectedLoc) return
    setFinalizingLocation(true)
    try {
      await finalizeGbpConnection(gbpSelectedLoc.locationName, gbpSelectedLoc.displayName)
      const fresh = await getGbpStatus().catch(() => null)
      if (fresh) setGbpStatus(fresh)
      setShowLocationModal(false)
      setGbpMsg({ type: 'ok', text: `${s.gbpConnectedMsg} ${gbpSelectedLoc.displayName}` })
    } catch {
      setGbpMsg({ type: 'err', text: s.gbpFinalizeError })
    } finally {
      setFinalizingLocation(false)
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

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
      setError(s.saveError)
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

  async function handleCheckout(p: 'core' | 'pro') {
    setCheckoutLoading(p)
    setError('')
    try {
      const url = await getLemonCheckoutUrl(p, billing)
      window.location.href = url
    } catch {
      setError(s.checkoutError)
      setCheckoutLoading(null)
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
      <AppHeader negocioNombre={negocio?.nombre} />
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
                    onClick={() => handleCheckout('core')}
                    disabled={checkoutLoading !== null}
                    className="w-full py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkoutLoading === 'core' ? <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : null}
                    {s.planStartCore}
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
                          <p className="text-lg font-bold text-slate-900 dark:text-white">490 €<span className="text-xs font-normal text-slate-400">/año</span></p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">≈ 40,83 €/mes</p>
                        </>
                      ) : (
                        <p className="text-lg font-bold text-slate-900 dark:text-white">49 €<span className="text-xs font-normal text-slate-400">/mes</span></p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCheckout('pro')}
                    disabled={checkoutLoading !== null}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkoutLoading === 'pro' ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                    {s.planStartPro}
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
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{s.statusCancelled} {'\u00b7'} {fmtDate(lsEndsAt)}</p>
                    ) : lsStatus === 'past_due' ? (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{s.statusPastDue}</p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {lsRenewsAt ? s.nextRenewal.replace('{date}', fmtDate(lsRenewsAt)) : s.planThanks}
                      </p>
                    )}
                  </div>
                </div>
                {lsStatus === 'cancelled' ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    {s.statusCancelled}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    {s.statusActive}
                  </span>
                )}
              </div>

              {/* Upsell a Pro — solo si está en Core */}
              {plan === 'core' && lsStatus !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => handleCheckout('pro')}
                  disabled={checkoutLoading !== null}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/30 rounded-xl transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div>
                    <p className="text-sm font-semibold text-blue-400">{s.upgradeToProTitle}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.upgradeToProDesc}</p>
                  </div>
                  {checkoutLoading === 'pro'
                    ? <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
                    : <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  }
                </button>
              )}
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
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">{s.googleSection}</h2>
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">{s.gbpComingSoon}</span>
                </div>
                <div className="p-5 space-y-4 opacity-40 pointer-events-none select-none">
                  {gbpMsg && (
                    <div className={`px-3 py-2.5 rounded-xl text-sm border ${gbpMsg.type === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'}`}>
                      {gbpMsg.text}
                    </div>
                  )}
                  {gbpStatus?.connected ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2.5 px-3 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                        <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium truncate">{gbpStatus.displayName ?? s.gbpConnectedSub}</p>
                          <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">{s.gbpConnectedLabel}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDisconnectModal(true)}
                        className="w-full px-4 py-2 text-xs font-semibold border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        {s.gbpDisconnectTitle}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                        <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-amber-700 dark:text-amber-300">{s.gbpNotConnectedLabel}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleConnectGbp}
                        disabled={connectingGbp || !negocio}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {connectingGbp ? (
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                          </div>
                        )}
                        {connectingGbp ? s.gbpConnecting : s.gbpConnectBtn}
                      </button>
                      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">{s.gbpOutscraperNote}</p>
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
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {s.seoLabel}
                      <Tooltip text={s.seoLabel} />
                    </label>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{s.seoDesc}</p>
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
                          placeholder={s.seoPlaceholder}
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
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {s.toneSection}
                      <Tooltip text="Cómo sonarán tus respuestas. Puedes cambiarlo cuando quieras." />
                    </label>
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

            {/* Gestionar suscripción — portal LS */}
            {plan !== 'basic' && lsCustomerPortal && (
              <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{s.manageSub}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.manageSubDesc}</p>
                </div>
                <a
                  href={lsCustomerPortal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-4 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-center"
                >
                  {s.manageSub} {'\u2192'}
                </a>
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

      {/* GBP Disconnect modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { if (!disconnecting) setShowDisconnectModal(false) }} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{s.gbpDisconnectTitle}</h3>
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">{s.gbpDisconnectWarning}</p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-1">{s.gbpDisconnectWarningDesc}</p>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{s.gbpDisconnectConfirmMsg}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDisconnectModal(false)} disabled={disconnecting}
                className="flex-1 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
                {s.gbpDisconnectCancel}
              </button>
              <button type="button" onClick={handleDisconnectGbp} disabled={disconnecting}
                className="flex-1 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                {disconnecting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {disconnecting ? s.gbpDisconnecting : s.gbpDisconnectConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GBP Location selector modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{s.gbpLocationTitle}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{s.gbpLocationDesc}</p>
            <div className="space-y-2">
              {gbpSelectLocations.map(loc => (
                <button key={loc.locationName} type="button" onClick={() => setGbpSelectedLoc(loc)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${gbpSelectedLoc?.locationName === loc.locationName ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{loc.displayName}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{loc.locationName}</p>
                </button>
              ))}
            </div>
            <button type="button" onClick={handleFinalizeLocation} disabled={!gbpSelectedLoc || finalizingLocation}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {finalizingLocation && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {finalizingLocation ? s.gbpLocationConnecting : s.gbpLocationConfirm}
            </button>
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

      <HelpButton />

      <AppFooter />
    </div>
  )
}
