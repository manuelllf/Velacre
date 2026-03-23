'use client'

import { useState, useEffect } from 'react'
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
  ApiError,
  type ReviewResponses,
  type Negocio,
  type PendingReview,
} from '@/lib/api'
import { getLemonCheckoutUrl } from '@/lib/lemon'
import ResponseCard from '@/components/ResponseCard'

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return null
  return (
    <span className="text-amber-500 text-base">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
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
  const [manualOpen, setManualOpen] = useState(false)

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
        if (!u.activo) {
          setUserStatus(u.activoDesde ? 'suspendido' : 'pendiente')
          setLoadingInit(false)
          return
        }
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
    try {
      const result = await syncReviews()
      await loadPendingReviews()
      if (result.newReviews > 0) {
        setSyncMessage(`Se importaron ${result.newReviews} reseña${result.newReviews !== 1 ? 's' : ''} nueva${result.newReviews !== 1 ? 's' : ''}`)
      } else {
        setSyncMessage('Todo al día, no hay reseñas nuevas')
      }
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Error al sincronizar')
    } finally {
      setSyncLoading(false)
      setTimeout(() => setSyncMessage(''), 5000)
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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/auth/login')
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (userStatus === 'pendiente' || userStatus === 'suspendido') {
    const basicUrl = getLemonCheckoutUrl(userId, 'basic')
    const proUrl = getLemonCheckoutUrl(userId, 'pro')
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <span className="font-bold text-lg text-slate-900 dark:text-white">Velacre</span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Activa tu suscripción a Velacre
            </h1>
            <p className="text-base text-slate-500 dark:text-slate-400">
              Elige el plan que mejor se adapta a tu negocio
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Basic plan */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 flex flex-col">
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Basic</p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-bold text-slate-900 dark:text-white">19€</span>
                  <span className="text-slate-500 dark:text-slate-400">/mes</span>
                </div>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span>
                    Generador de respuestas
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span>
                    Respuestas manuales ilimitadas
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span>
                    Sincronización de reseñas de Google
                  </li>
                </ul>
              </div>
              <div className="mt-auto">
                <a
                  href={basicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-6 py-3 border-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 rounded-xl font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  Empezar con Basic →
                </a>
              </div>
            </div>

            {/* Pro plan */}
            <div className="bg-indigo-600 dark:bg-indigo-700 rounded-2xl shadow-lg p-8 flex flex-col relative">
              <div className="absolute -top-3 right-6">
                <span className="bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Recomendado</span>
              </div>
              <div className="mb-6">
                <p className="text-sm font-semibold text-indigo-200 uppercase tracking-wide mb-1">Pro</p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-bold text-white">29€</span>
                  <span className="text-indigo-200">/mes</span>
                </div>
                <ul className="space-y-2 text-sm text-indigo-100">
                  <li className="flex items-center gap-2">
                    <span className="text-white">✓</span>
                    Todo lo de Basic
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-white">✓</span>
                    Sync automático de Google
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-white">✓</span>
                    Panel de salud
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-white">✓</span>
                    Respuestas ilimitadas
                  </li>
                </ul>
              </div>
              <div className="mt-auto">
                <a
                  href={proUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-6 py-3 bg-white text-indigo-700 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
                >
                  Empezar con Pro →
                </a>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-8">
            Los pagos son gestionados de forma segura por LemonSqueezy
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <span className="font-bold text-lg text-slate-900 dark:text-white">Velacre</span>
              {negocio && (
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400 font-normal">
                  {negocio.nombre}
                </span>
              )}
            </div>
            <nav className="flex gap-1">
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">
                Reseñas
              </span>
              <Link
                href="/health"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                Salud
                {userPlan !== 'pro' && <span className="text-xs text-indigo-500 dark:text-indigo-400">Pro</span>}
              </Link>
              <Link
                href="/settings"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Configuración
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Pending reviews section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Reseñas pendientes
            </h2>
            <div className="flex items-center gap-3">
              {syncMessage && (
                <span className="text-sm text-slate-500 dark:text-slate-400">{syncMessage}</span>
              )}
              <button
                onClick={handleSync}
                disabled={syncLoading}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sincronizar
                  </>
                )}
              </button>
            </div>
          </div>
          <p className="text-base text-slate-500 dark:text-slate-400 mb-5">
            Estas reseñas están esperando tu respuesta. Genera una con IA y cópiala en Google.
            {negocio && (
              <span className="ml-1 font-medium text-indigo-600 dark:text-indigo-400">
                ({negocio.tonopredefinido})
              </span>
            )}
          </p>

          {loadingPending ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingReviews.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
              <p className="text-base font-medium text-slate-600 dark:text-slate-300">Todo al día 👍</p>
              <p className="text-sm mt-1">No tienes reseñas pendientes. Cuando lleguen nuevas, aparecerán aquí.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingReviews.map(review => (
                <div
                  key={review.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <span className="text-base font-semibold text-slate-900 dark:text-white">
                        {review.authorName ?? 'Cliente anónimo'}
                      </span>
                      <span className="ml-3 text-sm text-slate-400 dark:text-slate-500">
                        {formatDate(review.reviewDate)}
                      </span>
                    </div>
                    <StarRating rating={review.starRating} />
                  </div>

                  <p className="text-base text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
                    {review.clientereview}
                  </p>

                  {generatedResponses[review.id] ? (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                          Respuesta generada
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(generatedResponses[review.id])
                              setCopiedId(review.id)
                              setTimeout(() => setCopiedId(null), 2000)
                            }}
                            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-medium transition-colors"
                          >
                            {copiedId === review.id ? '✓ Copiado' : 'Copiar'}
                          </button>
                          <a
                            href="https://business.google.com/reviews"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                            </svg>
                            Ir a Google a pegarla
                          </a>
                        </div>
                      </div>
                      <p className="text-base text-slate-800 dark:text-slate-200 leading-relaxed">
                        {generatedResponses[review.id]}
                      </p>
                    </div>
                  ) : generatedResponses[review.id + '_error'] ? (
                    <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
                      {generatedResponses[review.id + '_error']}
                    </p>
                  ) : (
                    <button
                      onClick={() => handleGenerate(review.id)}
                      disabled={generatingId === review.id}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generatingId === review.id ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generando... (unos segundos)
                        </>
                      ) : (
                        'Generar respuesta con IA'
                      )}
                    </button>
                  )}
                </div>
              ))}
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
    </div>
  )
}
