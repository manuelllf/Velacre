'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  generateResponses,
  getMyNegocio,
  getMyUsuario,
  getAllReviews,
  generateForReview,
  syncReviews,
  setReviewEstado,
  ApiError,
  type ReviewResponses,
  type Negocio,
  type PendingReview,
} from '@/lib/api'
import ResponseCard from '@/components/ResponseCard'
import SectionNav from '@/components/SectionNav'
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

  // Manual section
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [manualResponses, setManualResponses] = useState<ReviewResponses | null>(null)
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/login'); return }
      try {
        const [u, n] = await Promise.all([getMyUsuario(), getMyNegocio()])
        if (u.isAdmin || u.rol === 'admin') { router.replace('/admin'); return }
        const plan = u.plan ?? 'basic'
        setUserPlan(plan)
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
      setGeneratedResponses(prev => ({ ...prev, [reviewId]: result.response }))
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

  async function handleGenerateManual(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewText.trim()) return
    setManualError('')
    setManualLoading(true)
    setManualResponses(null)
    try {
      setManualResponses(await generateResponses(reviewText))
      setReviewText('')
    } catch (err) {
      setManualError(err instanceof Error ? err.message : t.app.common.error)
    } finally {
      setManualLoading(false)
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
          <div className="absolute inset-0 bg-black/50" onClick={() => { if (!manualLoading) { setManualModalOpen(false); setManualResponses(null); setManualError(''); setReviewText('') } }} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Otra plataforma</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Tripadvisor, Booking, Yelp…</p>
              </div>
              <button
                type="button"
                disabled={manualLoading}
                onClick={() => { setManualModalOpen(false); setManualResponses(null); setManualError(''); setReviewText('') }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Input */}
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

            {/* Responses */}
            {manualResponses && (
              <div className="overflow-y-auto max-h-[70vh] scroll-thin">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    { tone: 'Profesional', text: manualResponses.profesional, accent: 'bg-blue-600' },
                    { tone: 'Cercano',     text: manualResponses.cercano,     accent: 'bg-emerald-600' },
                    { tone: 'Directo',     text: manualResponses.directo,     accent: 'bg-amber-500' },
                  ].map(({ tone, text, accent }) => (
                    <ManualResponseRow key={tone} tone={tone} text={text} accent={accent} />
                  ))}
                </div>
                <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setManualResponses(null); setManualError(''); setReviewText('') }}
                    className="w-full py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
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
      {showUpsell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowUpsell(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              {upsellInfo?.plan === 'core' ? (
                <>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Límite del mes alcanzado</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Has usado tus <span className="font-semibold text-slate-700 dark:text-slate-300">10 respuestas IA</span> de este mes.
                    Pásate a Pro y genera respuestas ilimitadas — sin contar, sin esperar.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Límite del plan Basic alcanzado</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Has usado tus <span className="font-semibold text-slate-700 dark:text-slate-300">3 respuestas IA</span> de este mes.
                    Pásate a Core (10/mes) o Pro (ilimitadas) y no pierdas ni una reseña sin responder.
                  </p>
                </>
              )}
            </div>
            <div className="space-y-2">
              <a
                href="/settings"
                className="block w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {upsellInfo?.plan === 'core' ? 'Quiero Pro →' : 'Ver planes →'}
              </a>
              <button
                onClick={() => setShowUpsell(false)}
                className="block w-full py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

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

// ── Manual response row (full-width) ────────────────────────────────────────

function ManualResponseRow({ tone, text, accent }: { tone: string; text: string; accent: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${accent}`} />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{tone}</span>
        </div>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            copied
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {copied ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3">{text}</p>
    </div>
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
  onGenerate: () => void
  onLoad: () => void
  onSetEstado: (e: 'pendiente' | 'respondida' | 'ignorada') => void
  onCopy: (text: string) => void
  onRetry: () => void
  commonError: string
}

function DetailPanel({
  review, generated, generatedError, contexto,
  isGenerating, isUpdating, copiedId,
  onGenerate, onLoad, onSetEstado, onCopy, onRetry,
}: DetailPanelProps) {
  const estado = review.estado ?? 'pendiente'
  const isNegative = (review.starRating ?? 5) <= 2
  const hasGenerated = !!generated
  const hasError = !!generatedError

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
            <a
              href="https://business.google.com/reviews"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Abrir Google
            </a>
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

      {/* Actions footer */}
      <div className="px-6 pb-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          {!hasGenerated && !hasError && estado === 'respondida' && (
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
          {!hasGenerated && !hasError && estado !== 'respondida' && (
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
          {hasError && (
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
