'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  generateResponses,
  getMyNegocio,
  getMyUsuario,
  getPendingReviews,
  generateForReview,
  syncReviews,
  translateReview,
  ApiError,
  type ReviewResponses,
  type Negocio,
  type PendingReview,
} from '@/lib/api'
import ResponseCard from '@/components/ResponseCard'

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return null
  const color = rating >= 4 ? 'text-emerald-500' : rating <= 2 ? 'text-red-400' : 'text-amber-400'
  return (
    <span className={`font-semibold text-sm ${color}`}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function reviewBorderClass(rating?: number) {
  if (!rating) return 'border-slate-200 dark:border-slate-700'
  if (rating <= 2) return 'border-l-red-400 border-slate-200 dark:border-slate-700'
  if (rating === 3) return 'border-l-amber-400 border-slate-200 dark:border-slate-700'
  return 'border-l-emerald-400 border-slate-200 dark:border-slate-700'
}

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [reviewText, setReviewText] = useState('')
  const [responses, setResponses] = useState<ReviewResponses | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingInit, setLoadingInit] = useState(true)
  const [userStatus, setUserStatus] = useState<'activo' | 'pendiente' | 'suspendido'>('activo')
  const [userPlan, setUserPlan] = useState<string>('basic')
  const [userId, setUserId] = useState<string>('')
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [manualUsed, setManualUsed] = useState<number>(0)

  // Pending reviews state
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [generatedResponses, setGeneratedResponses] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncStep, setSyncStep] = useState(0)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const SYNC_STEPS = [
    'Conectando con Google Maps...',
    'Extrayendo resenas y metadatos...',
    'Analizando sentimientos con IA...',
    'Finalizando panel de salud...',
  ]

  const SYNC_TIPS = [
    'Responder resenas aumenta la confianza de nuevos clientes un 30%.',
    'Un tono cercano genera mas engagement que uno formal.',
    'Las resenas de 3 estrellas son las mas valiosas para mejorar.',
    'Responder en menos de 48h mejora tu posicionamiento en Maps.',
    'Los clientes leen las respuestas tanto como la resena original.',
    'Mencionar el nombre del negocio en la respuesta refuerza la marca.',
    'Una disculpa sincera convierte una mala resena en una oportunidad.',
    'El 88% de los usuarios confian en resenas tanto como en recomendaciones personales.',
  ]
  const [syncTip, setSyncTip] = useState(0)
  const tipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [translatingId, setTranslatingId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/auth/login')
        return
      }
      try {
        // Parallelizar usuario + negocio para reducir tiempo de carga
        const [u, n] = await Promise.all([getMyUsuario(), getMyNegocio()])
        setUserPlan(u.plan ?? 'basic')
        setUserId(u.id)
        setIsAdmin(u.isAdmin)
        if (!n) {
          router.replace('/onboarding')
          return
        }
        setNegocio(n)
        loadPendingReviews()
      } catch (err) {
        // Solo redirigir al login en errores de sesión (401), no en errores de red
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/auth/login')
        } else {
          setError('Error al conectar con el servidor. Recarga la página.')
        }
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  }, [router])

  async function loadPendingReviews() {
    setLoadingPending(true)
    try {
      const reviews = await getPendingReviews()
      setPendingReviews(reviews)
    } catch {
      // silently fail — no pending reviews to show
    } finally {
      setLoadingPending(false)
    }
  }

  async function handleSync() {
    setSyncLoading(true)
    setSyncMessage('')
    setSyncProgress(0)
    setSyncStep(0)

    // Tips rotativos cada 3.5s
    setSyncTip(Math.floor(Math.random() * SYNC_TIPS.length))
    tipIntervalRef.current = setInterval(() => {
      setSyncTip(t => (t + 1) % SYNC_TIPS.length)
    }, 3500)

    // Avanza el progreso en ~15s distribuido en 4 etapas
    const TOTAL_MS = 14000
    const TICK_MS = 200
    const ticks = TOTAL_MS / TICK_MS
    // Umbral de % donde cambia cada paso: 0→22, 22→55, 55→82, 82→98
    const stepBreaks = [0, 22, 55, 82, 98]
    let tick = 0
    syncIntervalRef.current = setInterval(() => {
      tick++
      const pct = Math.min(98, Math.round((tick / ticks) * 98))
      setSyncProgress(pct)
      const step = stepBreaks.findIndex((b, i) => pct < (stepBreaks[i + 1] ?? 99))
      setSyncStep(Math.min(step >= 0 ? step : 3, 3))
    }, TICK_MS)

    try {
      const result = await syncReviews()
      clearInterval(syncIntervalRef.current!)
      clearInterval(tipIntervalRef.current!)
      setSyncProgress(100)
      setSyncStep(3)
      await loadPendingReviews()
      if (result.newReviews > 0) {
        setSyncMessage(`Se importaron ${result.newReviews} reseña${result.newReviews !== 1 ? 's' : ''} nueva${result.newReviews !== 1 ? 's' : ''}`)
      } else {
        setSyncMessage('Todo al día, no hay reseñas nuevas')
      }
    } catch (err) {
      clearInterval(syncIntervalRef.current!)
      clearInterval(tipIntervalRef.current!)
      setSyncMessage(err instanceof Error ? err.message : 'Error al sincronizar')
    } finally {
      setSyncLoading(false)
      setTimeout(() => { setSyncProgress(0); setSyncMessage('') }, 4000)
    }
  }

  async function handleGenerate(reviewId: string) {
    setGeneratingId(reviewId)
    try {
      const result = await generateForReview(reviewId)
      setGeneratedResponses(prev => ({ ...prev, [reviewId]: result.response }))
    } catch (err) {
      setGeneratedResponses(prev => ({
        ...prev,
        [reviewId + '_error']: err instanceof Error ? err.message : 'Error al generar'
      }))
    } finally {
      setGeneratingId(null)
    }
  }

  async function handleTranslate(reviewId: string) {
    setTranslatingId(reviewId)
    try {
      const result = await translateReview(reviewId)
      setTranslations(prev => ({ ...prev, [reviewId]: result.translation }))
    } catch {
      setTranslations(prev => ({ ...prev, [reviewId]: 'Error al traducir.' }))
    } finally {
      setTranslatingId(null)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  async function handleGenerateManual(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewText.trim()) return
    setError('')
    setLoading(true)
    setResponses(null)

    try {
      const result = await generateResponses(reviewText)
      setResponses(result)
      setReviewText('') // vaciar textarea tras generar — evita regenerar lo mismo
      if (userPlan === 'basic') {
        setManualUsed(prev => prev + 1)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar las respuestas.')
    } finally {
      setLoading(false)
    }
  }

  if (loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2">
              <Link href="/" className="font-bold text-lg text-slate-900 dark:text-white">Velacre</Link>
              {negocio && <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400 font-normal">· {negocio.nombre}</span>}
            </div>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="hidden sm:inline">Cerrar sesión</span>
              <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-2">
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white whitespace-nowrap">Reseñas</span>
            <Link href="/dashboard/salud" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap">Salud</Link>
            <Link href="/settings" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap">Configuración</Link>
            {isAdmin && (
              <Link href="/admin" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 whitespace-nowrap">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Admin
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Pending reviews section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Reseñas pendientes
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={async () => { setRefreshing(true); await loadPendingReviews(); setRefreshing(false) }}
                disabled={refreshing || syncLoading}
                title="Actualizar panel"
                className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleSync}
                disabled={syncLoading}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {syncLoading ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            </div>
          </div>

          {/* Barra de progreso de sync */}
          {syncLoading && (
            <div className="mt-3 mb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">{SYNC_STEPS[syncStep]}</span>
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{syncProgress}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-indigo-500 rounded-full transition-all duration-200 ease-linear ${syncProgress >= 98 ? 'animate-pulse' : ''}`}
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
              <p key={syncTip} className="text-xs text-slate-400 dark:text-slate-500 italic mt-2 animate-pulse">
                {SYNC_TIPS[syncTip]}
              </p>
            </div>
          )}
          {!syncLoading && syncMessage && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{syncMessage}</p>
          )}

          <p className="text-base text-slate-500 dark:text-slate-400 mb-5 mt-3">
            Estas reseñas están esperando tu respuesta. Genera una con IA y cópiala en Google.
            {negocio && (
              <span className="ml-1 font-medium text-indigo-600 dark:text-indigo-400">
                ({negocio.tonopredefinido})
              </span>
            )}
          </p>

          {loadingPending ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl border border-slate-100 dark:border-slate-700 p-4 animate-pulse">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-600 rounded w-1/5" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                    <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-600 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : pendingReviews.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
              <p className="text-base font-medium text-slate-600 dark:text-slate-300">Todo al día 👍</p>
              <p className="text-sm mt-1">No tienes reseñas pendientes. Cuando lleguen nuevas, aparecerán aquí.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReviews.map(review => {
                const isNegative = (review.starRating ?? 5) <= 2
                return (
                  <div
                    key={review.id}
                    className={`border-l-4 border rounded-xl p-4 ${reviewBorderClass(review.starRating)}`}
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {review.authorName ?? 'Cliente anónimo'}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                          {formatDate(review.reviewDate)}
                        </span>
                        {isNegative && (
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                            Urgente
                          </span>
                        )}
                      </div>
                      <StarRating rating={review.starRating} />
                    </div>

                    <p className="text-sm text-slate-700 dark:text-slate-300 mb-1.5 leading-relaxed line-clamp-3">
                      {review.clientereview || <span className="italic text-slate-400">Sin texto</span>}
                    </p>
                    {/* Traducción */}
                    {translations[review.id] ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-2.5 border-l-2 border-slate-300 dark:border-slate-600 pl-2">
                        {translations[review.id]}
                      </p>
                    ) : review.reviewLanguage && review.reviewLanguage !== 'es' && review.clientereview ? (
                      <button
                        onClick={() => handleTranslate(review.id)}
                        disabled={translatingId === review.id}
                        className="text-xs text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors mb-2.5 flex items-center gap-1 disabled:opacity-50"
                      >
                        {translatingId === review.id ? (
                          <><span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />Traduciendo...</>
                        ) : (
                          <><span>🌐</span> Traducir al español</>
                        )}
                      </button>
                    ) : null}

                    {generatedResponses[review.id] ? (
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
                        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed mb-2">
                          {generatedResponses[review.id]}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(generatedResponses[review.id])
                              setCopiedId(review.id)
                              setTimeout(() => setCopiedId(null), 2000)
                            }}
                            className="text-xs font-medium px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                          >
                            {copiedId === review.id ? '✓ Copiado' : 'Copiar respuesta'}
                          </button>
                          <a
                            href="https://business.google.com/reviews"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            Pegar en Google
                          </a>
                        </div>
                      </div>
                    ) : generatedResponses[review.id + '_error'] ? (
                      <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                        {generatedResponses[review.id + '_error']}
                      </p>
                    ) : (
                      <button
                        onClick={() => handleGenerate(review.id)}
                        disabled={generatingId === review.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generatingId === review.id ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Generando...
                          </>
                        ) : (
                          'Generar respuesta con IA'
                        )}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Manual review section (collapsible) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <button
            type="button"
            onClick={() => setManualOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 text-left rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Responder una reseña manualmente
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                ¿Recibes reseñas en otras plataformas? Pégala aquí y te generamos 3 respuestas para elegir.
              </p>
            </div>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform ${manualOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {manualOpen && (
            <div className="px-6 pb-6 border-t border-slate-100 dark:border-slate-700">
              <form onSubmit={handleGenerateManual} className="space-y-4 pt-5">
                <div>
                  <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                    Reseña del cliente
                  </label>
                  <textarea
                    rows={6}
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                    disabled={userPlan === 'basic' && manualUsed >= 30}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Pega aquí el texto de la reseña..."
                  />
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  <button
                    type="submit"
                    disabled={loading || !reviewText.trim() || (userPlan === 'basic' && manualUsed >= 30)}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generando... (unos segundos)
                      </>
                    ) : (
                      'Generar respuestas con IA'
                    )}
                  </button>
                </div>
              </form>

              {error && (
                <p className="mt-4 text-base text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-4 py-3 rounded-xl">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Respuestas generadas manually */}
        {responses && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Respuestas generadas</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Elige la que más te guste y cópiala para pegarla en Google</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ResponseCard tone="Profesional" text={responses.profesional} color="indigo" />
              <ResponseCard tone="Cercano" text={responses.cercano} color="emerald" />
              <ResponseCard tone="Directo" text={responses.directo} color="amber" />
            </div>
          </div>
        )}
      </main>

      <footer className="mt-8 border-t border-slate-100 dark:border-slate-800 py-5">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-600">
          <span>© {new Date().getFullYear()} Velacre · Todos los derechos reservados</span>
          <div className="flex gap-4">
            <Link href="/privacidad" className="hover:text-slate-300 dark:hover:text-slate-400 transition-colors">Privacidad</Link>
            <Link href="/terminos" className="hover:text-slate-300 dark:hover:text-slate-400 transition-colors">Términos</Link>
            <Link href="/contacto" className="hover:text-slate-300 dark:hover:text-slate-400 transition-colors">Contacto</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
