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

  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  const [generatedResponses, setGeneratedResponses] = useState<Record<string, string>>({})
  const [contextos, setContextos] = useState<Record<string, { cliente: string; respuesta: string }>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [updatingEstado, setUpdatingEstado] = useState<Set<string>>(new Set())

  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncProgress, setSyncProgress] = useState(0)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Manual section
  const [manualOpen, setManualOpen] = useState(false)
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
        setUserPlan(u.plan ?? 'basic')
        if (!n) { router.replace('/onboarding'); return }
        setNegocio(n)
        loadReviews()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace('/auth/login')
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function loadReviews() {
    setLoadingReviews(true)
    try { setReviews(await getAllReviews()) }
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
      // No auto-mark — let the user decide when to mark as responded
    } catch (err) {
      setGeneratedResponses(prev => ({
        ...prev,
        [reviewId + '_error']: err instanceof Error ? err.message : t.app.common.error,
      }))
    } finally {
      setGeneratingIds(prev => { const s = new Set(prev); s.delete(reviewId); return s })
    }
  }

  async function handleSetEstado(reviewId: string, estado: 'pendiente' | 'respondida' | 'ignorada') {
    setUpdatingEstado(prev => new Set(prev).add(reviewId))
    try {
      await setReviewEstado(reviewId, estado)
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, estado } : r))
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
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
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

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ── Sync bar ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              {syncLoading ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Sincronizando con Google...</span>
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{syncProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-200"
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
                onClick={loadReviews}
                disabled={loadingReviews || syncLoading}
                title="Actualizar"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                <svg className={`w-4 h-4 ${loadingReviews ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
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

        {/* ── Filter tabs ── */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {FILTER_ORDER.map(f => (
            <button
              key={f}
              onClick={() => setEstadoFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                estadoFilter === f
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {FILTER_LABELS[f]}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                estadoFilter === f
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        {/* ── Review list ── */}
        {loadingReviews ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 animate-pulse">
                <div className="flex gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-600 rounded w-1/5" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-600 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-12 px-6 text-center">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {estadoFilter === 'pendiente' ? 'Todo al día — no hay reseñas pendientes' : `No hay reseñas en "${FILTER_LABELS[estadoFilter]}"`}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {estadoFilter === 'pendiente' ? 'Cuando lleguen nuevas, aparecerán aquí.' : 'Cambia el filtro para ver otras reseñas.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(review => {
              const estado = review.estado ?? 'pendiente'
              const isNegative = (review.starRating ?? 5) <= 2
              const hasGenerated = !!generatedResponses[review.id]
              const hasError = !!generatedResponses[review.id + '_error']
              const isGenerating = generatingIds.has(review.id)
              const isUpdating = updatingEstado.has(review.id)

              return (
                <div
                  key={review.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border transition-colors ${
                    isNegative
                      ? 'border-l-4 border-red-200 dark:border-red-900/50 border-l-red-400'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Review header */}
                  <div className="px-5 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {(review.authorName ?? '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {review.authorName ?? 'Cliente anónimo'}
                            </span>
                            {isNegative && (
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                                Urgente
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(review.reviewDate)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StarRating rating={review.starRating} />
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

                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {review.clientereview || <span className="italic text-slate-400">Sin comentario escrito</span>}
                    </p>
                  </div>

                  {/* Context summary (when response generated) */}
                  {hasGenerated && contextos[review.id] && (
                    <div className="mx-5 mb-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-2.5 space-y-1">
                      <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="shrink-0 w-20 font-medium text-slate-400 dark:text-slate-500">Cliente dijo</span>
                        <span>{contextos[review.id].cliente}</span>
                      </div>
                      <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="shrink-0 w-20 font-medium text-slate-400 dark:text-slate-500">Tú respondes</span>
                        <span>{contextos[review.id].respuesta}</span>
                      </div>
                    </div>
                  )}

                  {/* Generated response */}
                  {hasGenerated && (
                    <div className="mx-5 mb-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4">
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed mb-3">
                        {generatedResponses[review.id]}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedResponses[review.id])
                            setCopiedId(review.id)
                            setTimeout(() => setCopiedId(null), 2000)
                          }}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                        >
                          {copiedId === review.id ? (
                            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> Copiado</>
                          ) : (
                            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copiar respuesta</>
                          )}
                        </button>
                        <a
                          href="https://business.google.com/reviews"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          Abrir Google
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {hasError && (
                    <p className="mx-5 mb-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                      {generatedResponses[review.id + '_error']}
                    </p>
                  )}

                  {/* Actions footer */}
                  <div className="px-5 pb-4 flex items-center justify-between gap-2 flex-wrap">
                    {/* Generate button */}
                    {!hasGenerated && !hasError && (
                      <button
                        onClick={() => handleGenerate(review.id)}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando...</>
                        ) : (
                          <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Generar respuesta IA</>
                        )}
                      </button>
                    )}
                    {hasError && (
                      <button
                        onClick={() => {
                          setGeneratedResponses(prev => { const s = { ...prev }; delete s[review.id + '_error']; return s })
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Reintentar
                      </button>
                    )}
                    {hasGenerated && <div />}

                    {/* Estado buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {estado !== 'respondida' && (
                        <button
                          onClick={() => handleSetEstado(review.id, 'respondida')}
                          disabled={isUpdating}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50 font-medium"
                        >
                          ✓ Respondida
                        </button>
                      )}
                      {estado !== 'ignorada' && (
                        <button
                          onClick={() => handleSetEstado(review.id, 'ignorada')}
                          disabled={isUpdating}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 font-medium"
                        >
                          Ignorar
                        </button>
                      )}
                      {estado !== 'pendiente' && (
                        <button
                          onClick={() => handleSetEstado(review.id, 'pendiente')}
                          disabled={isUpdating}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 font-medium"
                        >
                          Reabrir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Manual section ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setManualOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Responder manualmente</span>
              <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">otra plataforma o reseña puntual</span>
            </div>
            <svg className={`w-4 h-4 text-slate-400 transition-transform ${manualOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {manualOpen && (
            <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-5">
              <form onSubmit={handleGenerateManual} className="space-y-4">
                <textarea
                  rows={5}
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Pega aquí el texto de la reseña..."
                />
                <button
                  type="submit"
                  disabled={manualLoading || !reviewText.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {manualLoading ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Generar 3 respuestas</>
                  )}
                </button>
              </form>
              {manualError && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{manualError}</p>
              )}
            </div>
          )}
        </div>

        {/* Manual responses */}
        {manualResponses && (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Elige la que más te guste</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ResponseCard tone="Profesional" text={manualResponses.profesional} color="indigo" />
              <ResponseCard tone="Cercano" text={manualResponses.cercano} color="emerald" />
              <ResponseCard tone="Directo" text={manualResponses.directo} color="amber" />
            </div>
          </div>
        )}
      </main>

      <footer className="mt-8 border-t border-slate-100 dark:border-slate-800 py-4">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-600">
          <span>© {new Date().getFullYear()} Velacre</span>
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
