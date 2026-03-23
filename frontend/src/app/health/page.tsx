'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  getMyUsuario,
  getMyNegocio,
  getPendingReviews,
  getSummaryAnalysis,
  type PendingReview,
} from '@/lib/api'

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'con',
  'por', 'para', 'que', 'se', 'su', 'al', 'lo', 'le', 'les', 'yo', 'me', 'mi', 'es',
  'muy', 'más', 'pero', 'ya', 'si', 'no', 'y', 'a', 'o', 'e', 'ni', 'he', 'ha',
  'fue', 'han', 'hay', 'todo', 'este', 'esta', 'son', 'como', 'también', 'bien',
  'nos', 'te', 'tu', 'tus', 'su', 'sus', 'nos', 'nuestro', 'nuestra', 'ser', 'estar',
])

function getTopWords(reviews: PendingReview[]): { word: string; count: number; avgRating: number }[] {
  const wordData: Record<string, { count: number; totalRating: number }> = {}

  for (const review of reviews) {
    const words = (review.clientereview ?? '')
      .toLowerCase()
      .replace(/[^a-záéíóúñü\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOPWORDS.has(w))

    for (const word of words) {
      if (!wordData[word]) wordData[word] = { count: 0, totalRating: 0 }
      wordData[word].count++
      wordData[word].totalRating += review.starRating ?? 3
    }
  }

  return Object.entries(wordData)
    .map(([word, { count, totalRating }]) => ({
      word,
      count,
      avgRating: count > 0 ? totalRating / count : 3,
    }))
    .filter(w => w.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

export default function HealthPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userPlan, setUserPlan] = useState<string>('basic')
  const [reviews, setReviews] = useState<PendingReview[]>([])
  const [negocioNombre, setNegocioNombre] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysis, setAnalysis] = useState<{ brillante: string; preocupa: string; accion: string } | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [analysisOpen, setAnalysisOpen] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/auth/login')
        return
      }
      try {
        const u = await getMyUsuario()
        setUserPlan(u.plan ?? 'basic')
        if (!u.activo) {
          router.replace('/dashboard')
          return
        }
        if (u.plan !== 'pro') {
          setLoading(false)
          return
        }
        const [n, r] = await Promise.all([getMyNegocio(), getPendingReviews()])
        if (!n) {
          router.replace('/onboarding')
          return
        }
        setNegocioNombre(n.nombre)
        setReviews(r)
      } catch {
        router.replace('/auth/login')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/auth/login')
  }

  async function handleAnalysis() {
    setAnalysisLoading(true)
    setAnalysisError('')
    try {
      const result = await getSummaryAnalysis()
      setAnalysis(result)
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Error al generar análisis')
    } finally {
      setAnalysisLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (userPlan !== 'pro') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="font-bold text-lg text-slate-900 dark:text-white">Velacre</span>
              <nav className="flex gap-1">
                <Link href="/dashboard" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Reseñas</Link>
                <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">Salud</span>
                <Link href="/settings" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Configuración</Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-20 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Panel de Salud</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-2 max-w-md">
            Visualiza el sentimiento de tus reseñas, las palabras clave que repiten tus clientes y obtén un análisis IA de tu reputación.
          </p>
          <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-8">Disponible en el Plan Pro · 29€/mes</p>
          <Link
            href="/settings"
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Actualizar a Pro
          </Link>
        </main>
      </div>
    )
  }

  // Computed stats
  const now = new Date()
  const thisMonth = reviews.filter(r => {
    const d = new Date(r.reviewDate)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const lastMonth = reviews.filter(r => {
    const d = new Date(r.reviewDate)
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth()
  })

  const avgThisMonth = thisMonth.length > 0
    ? thisMonth.reduce((acc, r) => acc + (r.starRating ?? 0), 0) / thisMonth.length
    : 0
  const avgLastMonth = lastMonth.length > 0
    ? lastMonth.reduce((acc, r) => acc + (r.starRating ?? 0), 0) / lastMonth.length
    : 0

  const withResponse = reviews.filter(r =>
    r.respuestaProfesional || r.respuestaColegueo || r.respuestaOrgullosa
  ).length
  const responseRate = reviews.length > 0 ? Math.round((withResponse / reviews.length) * 100) : 0

  const positivas = reviews.filter(r => (r.starRating ?? 0) >= 4).length
  const neutras = reviews.filter(r => (r.starRating ?? 0) === 3).length
  const criticas = reviews.filter(r => (r.starRating ?? 0) <= 2 && (r.starRating ?? 0) > 0).length
  const totalSentimiento = positivas + neutras + criticas

  const topWords = getTopWords(reviews)
  const maxWordCount = topWords.length > 0 ? topWords[0].count : 1

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <span className="font-bold text-lg text-slate-900 dark:text-white">Velacre</span>
              {negocioNombre && (
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400 font-normal">
                  {negocioNombre}
                </span>
              )}
            </div>
            <nav className="flex gap-1">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Reseñas
              </Link>
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">
                Salud
              </span>
              <Link
                href="/settings"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Configuración
              </Link>
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

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* KPIs row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Nota media */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Nota media (este mes)</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {avgThisMonth > 0 ? avgThisMonth.toFixed(1) : '—'}
              </span>
              {avgLastMonth > 0 && avgThisMonth > 0 && (
                <span className={`text-sm font-medium pb-1 ${avgThisMonth >= avgLastMonth ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {avgThisMonth >= avgLastMonth ? '↑' : '↓'} vs mes anterior
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {thisMonth.length} reseña{thisMonth.length !== 1 ? 's' : ''} este mes
            </p>
          </div>

          {/* Índice de respuesta */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Índice de respuesta</p>
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{responseRate}%</span>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {withResponse} de {reviews.length} reseñas respondidas
            </p>
          </div>

          {/* Total reseñas este mes */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total reseñas este mes</p>
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{thisMonth.length}</span>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {reviews.length} reseñas en total
            </p>
          </div>
        </div>

        {/* Sentimiento */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Sentimiento</h2>
          {totalSentimiento === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Sin datos suficientes para mostrar el sentimiento.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">Positivas (4-5★)</span>
                  <span className="text-slate-500 dark:text-slate-400">{positivas} ({Math.round((positivas / totalSentimiento) * 100)}%)</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.round((positivas / totalSentimiento) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-amber-700 dark:text-amber-400">Neutras (3★)</span>
                  <span className="text-slate-500 dark:text-slate-400">{neutras} ({Math.round((neutras / totalSentimiento) * 100)}%)</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${Math.round((neutras / totalSentimiento) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-red-700 dark:text-red-400">Críticas (1-2★)</span>
                  <span className="text-slate-500 dark:text-slate-400">{criticas} ({Math.round((criticas / totalSentimiento) * 100)}%)</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all"
                    style={{ width: `${Math.round((criticas / totalSentimiento) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top palabras */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Top palabras</h2>
          {topWords.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Sin suficientes reseñas para analizar palabras frecuentes.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topWords.map(({ word, count, avgRating }) => {
                const sizeRem = 0.75 + (count / maxWordCount) * 0.75
                const isPositive = avgRating >= 4
                const isNegative = avgRating <= 2
                const colorClass = isPositive
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : isNegative
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                return (
                  <span
                    key={word}
                    className={`px-3 py-1 rounded-full border font-medium transition-colors ${colorClass}`}
                    style={{ fontSize: `${sizeRem}rem` }}
                    title={`${count} veces · nota media ${avgRating.toFixed(1)}★`}
                  >
                    {word}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Resumen IA */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setAnalysisOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Resumen IA</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Análisis automático de tus reseñas
              </p>
            </div>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform ${analysisOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {analysisOpen && (
            <div className="px-6 pb-6 border-t border-slate-100 dark:border-slate-700 pt-5">
              {!analysis ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Genera un análisis de tus reseñas con IA. Obtendrás 3 puntos clave sobre tu negocio.
                  </p>
                  <button
                    onClick={handleAnalysis}
                    disabled={analysisLoading || reviews.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {analysisLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Analizando...
                      </>
                    ) : (
                      'Generar análisis con IA'
                    )}
                  </button>
                  {analysisError && (
                    <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
                      {analysisError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                    <span className="text-emerald-600 dark:text-emerald-400 text-lg shrink-0">✓</span>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-0.5">Lo que brilla</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{analysis.brillante}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <span className="text-amber-600 dark:text-amber-400 text-lg shrink-0">!</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-0.5">Lo que preocupa</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{analysis.preocupa}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
                    <span className="text-indigo-600 dark:text-indigo-400 text-lg shrink-0">→</span>
                    <div>
                      <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 mb-0.5">Acción recomendada</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{analysis.accion}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setAnalysis(null); handleAnalysis() }}
                    disabled={analysisLoading}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    Regenerar análisis
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
