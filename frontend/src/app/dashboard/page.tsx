'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  generateResponses,
  saveManualReview,
  getMyNegocio,
  getMyUsuario,
  getAllReviews,
  generateForReview,
  syncReviews,
  setReviewEstado,
  getGbpStatus,
  ApiError,
  type ReviewResponses,
  type Negocio,
  type PendingReview,
} from '@/lib/api'
import ResponseCard from '@/components/ResponseCard'
import SectionNav from '@/components/SectionNav'
import PublishGoogleModal from '@/components/PublishGoogleModal'
import Tooltip from '@/components/Tooltip'
import { HelpButton } from '@/components/HelpModal'
import { useLanguage } from '@/lib/i18n'

type EstadoFilter = 'pendiente' | 'respondida' | 'ignorada' | 'todas'

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return null
  const color = rating >= 4 ? 'text-emerald-500' : rating <= 2 ? 'text-red-400' : 'text-amber-400'
  return <span className={`text-sm font-semibold ${color}`}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
}

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  try { return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return dateStr }
}

const FILTER_LABELS: Record<EstadoFilter, string> = {
  pendiente: 'Pendientes',
  respondida: 'Respondidas',
  ignorada: 'Ignoradas',
  todas: 'Todas',
}

const FILTER_ORDER: EstadoFilter[] = ['pendiente', 'respondida', 'ignorada', 'todas']

export default function DashboardPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const d = t.app.dashboard

  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [userPlan, setUserPlan] = useState<string>('basic')
  const [loadingInit, setLoadingInit] = useState(true)

  const [reviews, setReviews] = useState<PendingReview[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('pendiente')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  const [generatedResponses, setGeneratedResponses] = useState<Record<string, string>>({})
  const [contextos, setContextos] = useState<Record<string, { cliente: string; respuesta: string }>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [updatingEstado, setUpdatingEstado] = useState<Set<string>>(new Set())

  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncProgress, setSyncProgress] = useState(0)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showUpsell, setShowUpsell] = useState(false)
  const [upsellInfo, setUpsellInfo] = useState<{ plan: string; limit: number; used: number } | null>(null)
  const [iaUsed, setIaUsed] = useState<number>(0)

  // GBP
  const [gbpConnected, setGbpConnected] = useState(false)
  const [publishModal, setPublishModal] = useState<{ id: string; texto: string } | null>(null)

  // Manual section
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [manualResponses, setManualResponses] = useState<ReviewResponses | null>(null)
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState('')
  const [manualSelectedTone, setManualSelectedTone] = useState<'profesional' | 'cercano' | 'directo' | null>(null)
  const [manualSaving, setManualSaving] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/login'); return }
      try {
        const [u, n, gbp] = await Promise.all([getMyUsuario(), getMyNegocio(), getGbpStatus().catch(() => null)])
        if (u.isAdmin || u.rol === 'admin') { router.replace('/admin'); return }
        const plan = u.plan ?? 'basic'
        setUserPlan(plan)
        setIaUsed(u.respuestasIaMes ?? 0)
        setGbpConnected(gbp?.connected ?? false)
        if (!n) { router.replace('/onboarding'); return }
        setNegocio(n)
        loadReviews(plan)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace('/auth/login')
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function loadReviews(plan?: string) {
    setLoadingReviews(true)
    try {
      const data = await getAllReviews()
      const effectivePlan = plan ?? userPlan
      const visible = effectivePlan === 'basic' ? data.slice(0, 10) : data
      setReviews(visible)

      // Pre-popular contextos y respuestas desde BD para reseñas ya generadas
      const newContextos: Record<string, { cliente: string; respuesta: string }> = {}
      const newGenerated: Record<string, string> = {}
      for (const r of visible) {
        if (r.contextoCliente && r.contextoRespuesta) {
          newContextos[r.id] = { cliente: r.contextoCliente, respuesta: r.contextoRespuesta }
        }
        if (r.tonoGenerado && r.tonoGenerado !== 'google') {
          const toneLower = r.tonoGenerado.toLowerCase()
          const text = toneLower === 'cercano' ? r.respuestaCercano
            : toneLower === 'directo' ? r.respuestaDirecto
            : r.respuestaProfesional
          if (text) newGenerated[r.id] = text
        }
      }
      setContextos(newContextos)
      setGeneratedResponses(prev => ({ ...prev, ...newGenerated }))
    }
    catch { /* silent */ }
    finally { setLoadingReviews(false) }
  }

  async function handleSync() {
    setSyncLoading(true)
    setSyncMessage('')
    setSyncProgress(5)

    const TOTAL_MS = 14000
    const TICK_MS = 200
    const ticks = TOTAL_MS / TICK_MS
    let tick = 0
    syncIntervalRef.current = setInterval(() => {
      tick++
      setSyncProgress(Math.min(92, Math.round(5 + (tick / ticks) * 87)))
    }, TICK_MS)

    try {
      const result = await syncReviews()
      clearInterval(syncIntervalRef.current!)
      setSyncProgress(100)
      await loadReviews()
      setSyncMessage(result.newReviews > 0
        ? d.syncDone.replace('{n}', String(result.newReviews))
        : d.syncNone)
    } catch (err) {
      clearInterval(syncIntervalRef.current!)
      setSyncMessage(err instanceof Error ? err.message : t.app.common.error)
    } finally {
      setSyncLoading(false)
      setTimeout(() => { setSyncProgress(0); setSyncMessage('') }, 5000)
    }
  }

  async function handleGenerate(reviewId: string) {
    setGeneratingIds(prev => new Set(prev).add(reviewId))
    try {
      const result = await generateForReview(reviewId)

      if (result.retenida) {
        setReviews(prev => prev.map(r => r.id === reviewId
          ? { ...r, retenida: true, motivoRetencion: result.motivoRetencion ?? undefined }
          : r))
        return
      }

      setGeneratedResponses(prev => ({ ...prev, [reviewId]: result.response ?? '' }))
      if (userPlan === 'basic' || userPlan === 'core') setIaUsed(prev => prev + 1)
      if (result.contextoCliente && result.contextoRespuesta) {
        setContextos(prev => ({ ...prev, [reviewId]: { cliente: result.contextoCliente!, respuesta: result.contextoRespuesta! } }))
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const d = err.data as { plan?: string; limit?: number; used?: number } | undefined
        setUpsellInfo(d?.plan ? { plan: d.plan, limit: d.limit ?? 3, used: d.used ?? 0 } : null)
        setShowUpsell(true)
      } else {
        setGeneratedResponses(prev => ({
          ...prev,
          [reviewId + '_error']: err instanceof Error ? err.message : t.app.common.error,
        }))
      }
    } finally {
      setGeneratingIds(prev => { const s = new Set(prev); s.delete(reviewId); return s })
    }
  }

  async function handleSetEstado(reviewId: string, estado: 'pendiente' | 'respondida' | 'ignorada') {
    setUpdatingEstado(prev => new Set(prev).add(reviewId))
    try {
      await setReviewEstado(reviewId, estado)
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, estado } : r))
      // Si la reseña desaparece del filtro activo, deseleccionar para evitar pantalla vacía en móvil
      if (estadoFilter !== 'todas' && estadoFilter !== estado) setSelectedId(null)
    } catch { /* silent */ }
    finally { setUpdatingEstado(prev => { const s = new Set(prev); s.delete(reviewId); return s }) }
  }

  function closeManualModal() {
    setManualModalOpen(false)
    setManualResponses(null)
    setManualError('')
    setReviewText('')
    setManualSelectedTone(null)
  }

  async function handleGenerateManual(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewText.trim()) return
    setManualError('')
    setManualLoading(true)
    setManualResponses(null)
    setManualSelectedTone(null)
    try {
      const result = await generateResponses(reviewText)
      setManualResponses(result)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const d = err.data as { plan?: string; limit?: number; used?: number } | undefined
        setUpsellInfo(d?.plan ? { plan: d.plan, limit: d.limit ?? 3, used: d.used ?? 0 } : null)
        closeManualModal()
        setShowUpsell(true)
      } else {
        setManualError(err instanceof Error ? err.message : t.app.common.error)
      }
    } finally {
      setManualLoading(false)
    }
  }

  async function handleSaveManual(estado: 'pendiente' | 'respondida') {
    if (!manualSelectedTone || !manualResponses) return
    setManualSaving(true)
    try {
      const saved = await saveManualReview({
        reviewText,
        tonoSeleccionado: manualSelectedTone,
        respuestaProfesional: manualResponses.profesional ?? '',
        respuestaCercano: manualResponses.cercano ?? '',
        respuestaDirecto: manualResponses.directo ?? '',
        estado,
      })
      // Prepend to reviews list (auto-appear without reload)
      setReviews(prev => {
        const effectivePlan = userPlan
        const newList = [saved, ...prev]
        return effectivePlan === 'basic' ? newList.slice(0, 10) : newList
      })
      // Pre-load the generated response for the new review
      const tono = manualSelectedTone
      const resp = tono === 'cercano' ? saved.respuestaCercano
                 : tono === 'directo' ? saved.respuestaDirecto
                 : saved.respuestaProfesional
      if (resp && saved.id) {
        setGeneratedResponses(prev => ({ ...prev, [saved.id]: resp }))
      }
      closeManualModal()
      setSelectedId(saved.id)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const d = err.data as { plan?: string; limit?: number; used?: number } | undefined
        setUpsellInfo(d?.plan ? { plan: d.plan, limit: d.limit ?? 3, used: d.used ?? 0 } : null)
        closeManualModal()
        setShowUpsell(true)
      } else {
        setManualError(err instanceof Error ? err.message : t.app.common.error)
      }
    } finally {
      setManualSaving(false)
    }
  }

  if (loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const filtered = estadoFilter === 'todas'
    ? reviews
    : reviews.filter(r => (r.estado ?? 'pendiente') === estadoFilter)

  const counts: Record<EstadoFilter, number> = {
    pendiente:  reviews.filter(r => (r.estado ?? 'pendiente') === 'pendiente').length,
    respondida: reviews.filter(r => r.estado === 'respondida').length,
    ignorada:   reviews.filter(r => r.estado === 'ignorada').length,
    todas:      reviews.length,
  }

  const selectedReview = selectedId ? filtered.find(r => r.id === selectedId) ?? null : null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
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

        {/* ── Sync bar ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              {syncLoading ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Sincronizando con Google...</span>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{syncProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-200"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>
                </div>
              ) : syncMessage ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">{syncMessage}</p>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {negocio?.nombre ?? 'Tu negocio'}
                    {negocio?.tonopredefinido && (
                      <span className="ml-2 text-xs font-normal text-slate-400">· {negocio.tonopredefinido}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {counts.pendiente} pendiente{counts.pendiente !== 1 ? 's' : ''} · {counts.respondida} respondida{counts.respondida !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => loadReviews()}
                disabled={loadingReviews || syncLoading}
                title="Actualizar"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                <svg className={`w-4 h-4 ${loadingReviews ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => setManualModalOpen(true)}
                title="Generar respuesta para reseña de otra plataforma"
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="hidden sm:inline">Otra plataforma</span>
              </button>
              <button
                onClick={handleSync}
                disabled={syncLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <svg className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {syncLoading ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Barra de uso IA — solo Basic y Core ── */}
        {(userPlan === 'basic' || userPlan === 'core') && (() => {
          const limit = userPlan === 'core' ? 10 : 3
          const used = Math.min(iaUsed, limit)
          const pct = Math.round((used / limit) * 100)
          const atLimit = used >= limit
          const nearLimit = used >= limit - 1 && !atLimit
          return (
            <div className={`rounded-2xl border px-5 py-3.5 ${
              atLimit
                ? 'bg-red-950/40 border-red-800/60'
                : nearLimit
                  ? 'bg-amber-950/30 border-amber-800/50'
                  : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${atLimit ? 'text-red-400' : nearLimit ? 'text-amber-400' : 'text-slate-400'}`}>
                    Respuestas IA este mes
                    <Tooltip text="La IA genera una respuesta personalizada por cada reseña de Google. Tienes un límite mensual según tu plan. Se renueva el 1 de cada mes." />
                  </span>
                  {atLimit && (
                    <span className="text-xs font-bold text-red-400 bg-red-900/40 border border-red-800/50 px-2 py-0.5 rounded-full shrink-0">
                      Límite alcanzado
                    </span>
                  )}
                </div>
                <span className={`text-xs font-bold tabular-nums shrink-0 ${atLimit ? 'text-red-400' : nearLimit ? 'text-amber-400' : 'text-slate-300'}`}>
                  {used} / {limit}
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${atLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-400' : 'bg-blue-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {atLimit && (
                <p className="text-xs text-red-400/80 mt-2">
                  {userPlan === 'core'
                    ? 'Sin respuestas IA hasta el próximo mes. Pásate a Pro y genera sin límite.'
                    : 'Sin respuestas IA hasta el próximo mes. Pásate a Core o Pro para seguir respondiendo.'}
                  {' '}
                  <a href="/settings" className="underline font-semibold hover:text-red-300">Ver planes →</a>
                </p>
              )}
            </div>
          )
        })()}

        {/* ── Two-column layout: list + detail ── */}
        <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-16rem)]">

          {/* ── LEFT: filter tabs + scrollable list + manual ── */}
          <div className={`w-full lg:w-80 xl:w-96 shrink-0 flex-col lg:h-full gap-3 ${selectedId ? 'hidden lg:flex' : 'flex'}`}>

            {/* Filter tabs — 4 columnas iguales, sin scroll */}
            <div className="grid grid-cols-4 gap-1 shrink-0">
              {FILTER_ORDER.map(f => (
                <button
                  key={f}
                  onClick={() => { setEstadoFilter(f); setSelectedId(null) }}
                  className={`flex flex-col items-center justify-center px-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                    estadoFilter === f
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <span className={`text-sm font-bold mb-0.5 ${
                    estadoFilter === f ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'
                  }`}>{counts[f]}</span>
                  <span className="leading-none truncate w-full text-center">{FILTER_LABELS[f]}</span>
                </button>
              ))}
            </div>

            {/* Review list — scrollable en desktop */}
            <div className="flex-1 min-h-0 lg:overflow-y-auto scroll-thin">
            {loadingReviews ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                        <div className="h-2.5 bg-slate-100 dark:bg-slate-600 rounded w-4/5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 py-10 px-5 text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {estadoFilter === 'pendiente' ? 'Todo al día' : `Nada en "${FILTER_LABELS[estadoFilter]}"`}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {estadoFilter === 'pendiente' ? 'Cuando lleguen nuevas, aparecerán aquí.' : 'Cambia el filtro.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(review => {
                  const estado = review.estado ?? 'pendiente'
                  const isNegative = (review.starRating ?? 5) <= 2
                  const isSelected = selectedId === review.id
                  const hasGenerated = !!generatedResponses[review.id]

                  return (
                    <button
                      key={review.id}
                      onClick={() => setSelectedId(isSelected ? null : review.id)}
                      className={`w-full text-left rounded-xl border transition-all p-4 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-1 ring-blue-300 dark:ring-blue-700'
                          : isNegative
                          ? 'bg-white dark:bg-slate-900 border-l-4 border-red-200 dark:border-red-900/50 border-l-red-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {(review.authorName ?? '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {review.authorName ?? 'Cliente anónimo'}
                            </span>
                            <StarRating rating={review.starRating} />
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {review.clientereview || <span className="italic">Sin comentario</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatDate(review.reviewDate)}</span>
                            {isNegative && (
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                                Urgente
                              </span>
                            )}
                            {estado === 'respondida' && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                                Respondida
                              </span>
                            )}
                            {estado === 'ignorada' && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                                Ignorada
                              </span>
                            )}
                            {hasGenerated && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                                IA lista
                              </span>
                            )}
                            {review.retenida && (
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                                ⚠ Revisión
                              </span>
                            )}
                            {review.plataforma === 'Otra' && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded-full">
                                Otra plataforma
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            </div>{/* end scrollable list */}

          </div>

          {/* ── RIGHT: detail panel — scrollable en desktop ── */}
          <div className={`min-w-0 lg:overflow-y-auto lg:h-full scroll-thin flex-1 ${selectedId ? 'block' : 'hidden lg:block'}`}>
            {selectedReview ? (
              <>
                {/* Botón volver — solo mobile, sticky bajo el header */}
                <button
                  onClick={() => setSelectedId(null)}
                  className="lg:hidden sticky top-14 z-30 flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white bg-slate-950/95 backdrop-blur-md -mx-4 px-4 py-2.5 mb-4 border-b border-slate-800/60 w-[calc(100%+2rem)]"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Volver a reseñas
                </button>
              <DetailPanel
                review={selectedReview}
                generated={generatedResponses[selectedReview.id]}
                generatedError={generatedResponses[selectedReview.id + '_error']}
                contexto={contextos[selectedReview.id]}
                isGenerating={generatingIds.has(selectedReview.id)}
                isUpdating={updatingEstado.has(selectedReview.id)}
                copiedId={copiedId}
                gbpConnected={gbpConnected}
                userPlan={userPlan}
                isOtraPlatforma={selectedReview.plataforma === 'Otra'}
                onGenerate={() => handleGenerate(selectedReview.id)}
                onLoad={() => {
                  const tono = selectedReview.tonoGenerado?.toLowerCase()
                  const resp = tono === 'cercano' ? selectedReview.respuestaCercano
                             : tono === 'directo' ? selectedReview.respuestaDirecto
                             : selectedReview.respuestaProfesional
                  if (resp) setGeneratedResponses(prev => ({ ...prev, [selectedReview.id]: resp }))
                }}
                onSetEstado={(e) => handleSetEstado(selectedReview.id, e)}
                onCopy={(text) => {
                  navigator.clipboard.writeText(text)
                  setCopiedId(selectedReview.id)
                  setTimeout(() => setCopiedId(null), 2000)
                }}
                onPublish={(texto) => setPublishModal({ id: selectedReview.id, texto })}
                onRetry={() => setGeneratedResponses(prev => { const s = { ...prev }; delete s[selectedReview.id + '_error']; return s })}
                commonError={t.app.common.error}
              />
              </>
            ) : (
              <div className="hidden lg:flex bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 h-80 items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Selecciona una reseña</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">para ver el detalle y generar respuesta</p>
                </div>
              </div>
            )}

          </div>
        </div>

      </main>

      {/* ── Modal: otra plataforma ── */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { if (!manualLoading && !manualSaving) closeManualModal() }} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Otra plataforma</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Tripadvisor, Booking, Yelp… pega la reseña y genera una respuesta</p>
              </div>
              <button
                type="button"
                disabled={manualLoading || manualSaving}
                onClick={closeManualModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step 1: Input */}
            {!manualResponses && (
              <form onSubmit={handleGenerateManual} className="p-5 space-y-3">
                <textarea
                  rows={5}
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none scroll-thin"
                  placeholder="Pega aquí el texto de la reseña…"
                />
                {manualError && <p className="text-xs text-red-600 dark:text-red-400">{manualError}</p>}
                <button
                  type="submit"
                  disabled={manualLoading || !reviewText.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {manualLoading
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando…</>
                    : 'Generar respuesta'}
                </button>
              </form>
            )}

            {/* Reseña retenida por seguridad */}
            {manualResponses?.retenida && (
              <div className="p-5">
                <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0">⚠️</span>
                    <div>
                      <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Reseña retenida por seguridad</p>
                      <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                        {manualResponses.motivoRetencion === 'intoxicacion' && 'Posible intoxicación alimentaria o enfermedad grave'}
                        {manualResponses.motivoRetencion === 'maltrato' && 'Acusaciones de malos tratos o agresión'}
                        {manualResponses.motivoRetencion === 'amenaza_legal' && 'Amenaza de denuncia o demanda judicial'}
                        {manualResponses.motivoRetencion === 'datos_personales' && 'Datos personales sensibles del cliente'}
                        {!manualResponses.motivoRetencion && 'Contenido que requiere revisión manual'}
                      </p>
                      <p className="text-xs text-orange-600/80 dark:text-orange-500 mt-2">
                        Esta reseña requiere atención personal antes de responder. No se ha generado respuesta automática.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setManualResponses(null); setManualError('') }}
                  className="w-full mt-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  ← Probar con otra reseña
                </button>
              </div>
            )}

            {/* Step 2: Responses + tone selection */}
            {manualResponses && !manualResponses.retenida && (
              <div className="overflow-y-auto max-h-[70vh] scroll-thin">
                <p className="px-5 pt-4 text-xs text-slate-500 dark:text-slate-400">Selecciona el tono que quieras guardar:</p>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                  {([
                    { key: 'profesional' as const, label: 'Profesional', text: manualResponses.profesional ?? '', accent: 'blue' },
                    { key: 'cercano'     as const, label: 'Cercano',     text: manualResponses.cercano     ?? '', accent: 'emerald' },
                    { key: 'directo'     as const, label: 'Directo',     text: manualResponses.directo     ?? '', accent: 'amber' },
                  ]).map(({ key, label, text, accent }) => (
                    <ManualResponseRow
                      key={key}
                      toneKey={key}
                      tone={label}
                      text={text}
                      accent={accent}
                      selected={manualSelectedTone === key}
                      onSelect={() => setManualSelectedTone(key)}
                    />
                  ))}
                </div>

                {/* Save actions */}
                <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  {manualError && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{manualError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!manualSelectedTone || manualSaving}
                      onClick={() => handleSaveManual('pendiente')}
                      className="flex-1 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {manualSaving ? <span className="flex items-center justify-center gap-1"><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Guardando…</span> : 'Guardar como pendiente'}
                    </button>
                    <button
                      type="button"
                      disabled={!manualSelectedTone || manualSaving}
                      onClick={() => handleSaveManual('respondida')}
                      className="flex-1 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {manualSaving ? <span className="flex items-center justify-center gap-1"><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando…</span> : 'Ya la he publicado ✓'}
                    </button>
                  </div>
                  {!manualSelectedTone && (
                    <p className="text-xs text-center text-slate-400 dark:text-slate-500">Selecciona un tono para activar el botón guardar</p>
                  )}
                  <button
                    type="button"
                    onClick={() => { setManualResponses(null); setManualError(''); setManualSelectedTone(null) }}
                    className="w-full py-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    ← Probar con otra reseña
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upsell modal — límite IA alcanzado */}
      {showUpsell && (() => {
        const pendingCount = reviews.filter(r => !r.tonoGenerado && r.estado !== 'ignorada').length
        const isCore = upsellInfo?.plan === 'core'
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowUpsell(false)} />
            <div className="relative w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
              {/* Franja roja top */}
              <div className="h-1 w-full bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-900/50 border border-red-800/60 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {isCore ? 'Tus 18 respuestas IA se acabaron' : 'Tus 3 respuestas IA se acabaron'}
                    </h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {isCore
                        ? 'El plan Core incluye 18 al mes. Pásate a Pro para tenerlas ilimitadas.'
                        : 'El plan Basic incluye 3 al mes. Core amplía el límite a 18, Pro es ilimitado.'}
                    </p>
                  </div>
                </div>

                {pendingCount > 0 && (
                  <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl px-4 py-3">
                    <p className="text-sm text-amber-300 font-medium">
                      Tienes <span className="font-bold">{pendingCount} reseña{pendingCount !== 1 ? 's' : ''} sin responder</span> ahora mismo.
                    </p>
                    <p className="text-xs text-amber-500 mt-0.5">
                      Cada día sin respuesta es un cliente que duda.
                    </p>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <a
                    href="/settings"
                    className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors"
                  >
                    {isCore ? 'Pasarme a Pro — respuestas ilimitadas →' : 'Ver planes Core y Pro →'}
                  </a>
                  <button
                    onClick={() => setShowUpsell(false)}
                    className="block w-full py-2 text-xs text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    Seguir con el límite
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Modal: publicar en Google ── */}
      {publishModal && (
        <PublishGoogleModal
          reviewId={publishModal.id}
          respuestaGenerada={publishModal.texto}
          onClose={() => setPublishModal(null)}
          onPublished={() => {
            setPublishModal(null)
            setReviews(prev => prev.map(r =>
              r.id === publishModal.id
                ? { ...r, estado: 'respondida', publicadaEnGoogle: true }
                : r
            ))
          }}
        />
      )}

      <HelpButton />

      <footer className="mt-8 border-t border-slate-100 dark:border-slate-800 py-4">
        <div className="max-w-screen-xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-600">
          <span>© {new Date().getFullYear()} Velacre </span>
          <div className="flex gap-4">
            <Link href="/privacidad" className="hover:text-slate-600 dark:hover:text-slate-400 transition-colors">Privacidad</Link>
            <Link href="/terminos" className="hover:text-slate-600 dark:hover:text-slate-400 transition-colors">Términos</Link>
            <Link href="/contacto" className="hover:text-slate-600 dark:hover:text-slate-400 transition-colors">Contacto</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Manual response row (full-width, selectable) ────────────────────────────

function ManualResponseRow({
  toneKey, tone, text, accent, selected, onSelect,
}: {
  toneKey: string
  tone: string
  text: string
  accent: string
  selected: boolean
  onSelect: () => void
}) {
  const [copied, setCopied] = useState(false)

  const accentRing = accent === 'blue' ? 'ring-blue-500 border-blue-500' : accent === 'emerald' ? 'ring-emerald-500 border-emerald-500' : 'ring-amber-500 border-amber-500'
  const accentDot  = accent === 'blue' ? 'bg-blue-600' : accent === 'emerald' ? 'bg-emerald-600' : 'bg-amber-500'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-5 py-4 space-y-3 transition-colors ${
        selected
          ? 'bg-blue-50 dark:bg-blue-950/30'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? accentRing : 'border-slate-300 dark:border-slate-600'}`}>
            {selected && <span className={`w-2 h-2 rounded-full ${accentDot}`} />}
          </span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{tone}</span>
        </div>
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation()
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            copied
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          {copied ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3">{text}</p>
    </button>
  )
}

// ── Detail panel component ──────────────────────────────────────────────────

interface DetailPanelProps {
  review: PendingReview
  generated?: string
  generatedError?: string
  contexto?: { cliente: string; respuesta: string }
  isGenerating: boolean
  isUpdating: boolean
  copiedId: string | null
  gbpConnected: boolean
  userPlan: string
  isOtraPlatforma: boolean
  onGenerate: () => void
  onLoad: () => void
  onSetEstado: (e: 'pendiente' | 'respondida' | 'ignorada') => void
  onCopy: (text: string) => void
  onPublish: (texto: string) => void
  onRetry: () => void
  commonError: string
}

const MOTIVO_LABELS: Record<string, string> = {
  intoxicacion:     'Posible intoxicación alimentaria o enfermedad grave',
  maltrato:         'Acusaciones de malos tratos o agresión',
  amenaza_legal:    'Amenaza de denuncia o demanda judicial',
  datos_personales: 'Datos personales sensibles del cliente',
}

function DetailPanel({
  review, generated, generatedError, contexto,
  isGenerating, isUpdating, copiedId,
  gbpConnected, userPlan, isOtraPlatforma,
  onGenerate, onLoad, onSetEstado, onCopy, onPublish, onRetry,
}: DetailPanelProps) {
  const estado = review.estado ?? 'pendiente'
  const isNegative = (review.starRating ?? 5) <= 2
  const hasGenerated = !!generated
  const hasError = !!generatedError
  const isRetenida = !!review.retenida

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border ${
      isNegative
        ? 'border-l-4 border-red-200 dark:border-red-900/50 border-l-red-400'
        : 'border-slate-200 dark:border-slate-800'
    }`}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-base font-bold text-slate-600 dark:text-slate-300">
              {(review.authorName ?? '?')[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold text-slate-900 dark:text-white">
                  {review.authorName ?? 'Cliente anónimo'}
                </span>
                {isNegative && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                    Urgente
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">{
                new Date(review.reviewDate ?? '').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
              }</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-lg font-semibold text-amber-500">{'★'.repeat(review.starRating ?? 0)}{'☆'.repeat(5 - (review.starRating ?? 0))}</span>
            {estado === 'respondida' && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                Respondida
              </span>
            )}
            {estado === 'ignorada' && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                Ignorada
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {review.clientereview || <span className="italic text-slate-400">Sin comentario escrito</span>}
          </p>
        </div>
      </div>

      {/* Context summary */}
      {hasGenerated && contexto && (
        <div className="mx-6 mb-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3 space-y-1.5">
          <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="shrink-0 w-24 font-medium text-slate-400 dark:text-slate-500">Cliente dijo</span>
            <span>{contexto.cliente}</span>
          </div>
          <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="shrink-0 w-24 font-medium text-slate-400 dark:text-slate-500">Tú respondes</span>
            <span>{contexto.respuesta}</span>
          </div>
        </div>
      )}

      {/* Generated response */}
      {hasGenerated && (
        <div className="mx-6 mb-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl p-5">
          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed mb-4 whitespace-pre-wrap">
            {generated}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onCopy(generated!)}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
            >
              {copiedId === review.id ? (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> Copiado</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copiar respuesta</>
              )}
            </button>

            {/* Publicar en Google — Próximamente / No aplica para otra plataforma */}
            <span
              title={isOtraPlatforma ? 'No disponible para reseñas de otras plataformas' : 'Próximamente'}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 rounded-xl opacity-50 cursor-not-allowed select-none"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Publicar en Google
              {!isOtraPlatforma && <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Próximamente</span>}
            </span>

            {/* Abrir panel de reseñas para copiar y pegar manualmente */}
            {isOtraPlatforma ? (
              <span
                title="No disponible para reseñas de otras plataformas"
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 rounded-xl opacity-50 cursor-not-allowed select-none"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Responder en Google
              </span>
            ) : (
              <a
                href="https://business.google.com/reviews"
                target="_blank"
                rel="noopener noreferrer"
                title="Abre tu panel de reseñas de Google Business para responder manualmente"
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Responder en Google
              </a>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div className="mx-6 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
            {generatedError}
          </p>
        </div>
      )}

      {/* Retained review warning */}
      {isRetenida && (
        <div className="mx-6 mb-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Retenida por seguridad — Requiere revisión manual</p>
              {review.motivoRetencion && (
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                  {MOTIVO_LABELS[review.motivoRetencion] ?? review.motivoRetencion}
                </p>
              )}
              <p className="text-xs text-orange-600/80 dark:text-orange-500 mt-2">
                Velacre no ha generado respuesta automática. Responde manualmente desde Google Business.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions footer */}
      <div className="px-6 pb-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          {!isRetenida && !hasGenerated && !hasError && estado === 'respondida' && (
            review.tonoGenerado === 'google' ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Respondida directamente en Google.{' '}
                <button onClick={() => onSetEstado('pendiente')} className="underline hover:text-slate-600 dark:hover:text-slate-300">
                  Reabre
                </button>{' '}
                para generar una con Velacre.
              </p>
            ) : review.tonoGenerado ? (
              <button
                onClick={onLoad}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Cargar respuesta
              </button>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Sin respuesta generada.{' '}
                <button onClick={() => onSetEstado('pendiente')} className="underline hover:text-slate-600 dark:hover:text-slate-300">
                  Reabre
                </button>{' '}
                para generarla.
              </p>
            )
          )}
          {!isRetenida && !hasGenerated && !hasError && estado !== 'respondida' && (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Generar respuesta IA</>
              )}
            </button>
          )}
          {!isRetenida && hasError && (
            <button onClick={onRetry} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Reintentar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {estado !== 'respondida' && (
            <button
              onClick={() => onSetEstado('respondida')}
              disabled={isUpdating}
              className="text-sm px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50 font-medium"
            >
              ✓ Respondida
            </button>
          )}
          {estado !== 'ignorada' && (
            <button
              onClick={() => onSetEstado('ignorada')}
              disabled={isUpdating}
              className="text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 font-medium"
            >
              Ignorar
            </button>
          )}
          {estado !== 'pendiente' && (
            <button
              onClick={() => onSetEstado('pendiente')}
              disabled={isUpdating}
              className="text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 font-medium"
            >
              Reabrir
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
