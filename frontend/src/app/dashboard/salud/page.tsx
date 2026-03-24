'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMyUsuario, getMyNegocio, getPendingReviews, getSummary, ApiError, type PendingReview, type Negocio } from '@/lib/api'
import { getLast4Months, drift, ratingDrift, generateReputationPDF, type MonthMetrics } from '@/lib/report-pdf'

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'en', 'y', 'a', 'que',
  'se', 'con', 'por', 'para', 'es', 'son', 'fue', 'ha', 'han', 'muy', 'pero', 'más', 'si', 'no',
  'lo', 'su', 'sus', 'mi', 'me', 'te', 'le', 'nos', 'les', 'como', 'todo', 'todos', 'una', 'yo',
  'era', 'ser', 'este', 'esta', 'esto', 'bien', 'tan', 'también', 'o', 'ni', 'hay', 'ya', 'cuando',
  'porque', 'donde', 'aunque', 'así', 'hasta', 'desde', 'entre', 'sobre', 'sin', 'he', 'he',
])

interface KeywordInfo {
  word: string
  count: number
  sentiment: 'positive' | 'neutral' | 'negative'
}

interface SummaryData {
  brilla: string
  quema: string
  accion: string
}

function computeKeywords(reviews: PendingReview[]): KeywordInfo[] {
  const freq: Record<string, { count: number; pos: number; neg: number }> = {}
  for (const r of reviews) {
    const words = (r.clientereview ?? '').toLowerCase().replace(/[^a-záéíóúüñ\s]/gi, '').split(/\s+/)
    const sentiment = (r.starRating ?? 3) >= 4 ? 'positive' : (r.starRating ?? 3) <= 2 ? 'negative' : 'neutral'
    for (const w of words) {
      if (w.length < 4 || STOPWORDS.has(w)) continue
      if (!freq[w]) freq[w] = { count: 0, pos: 0, neg: 0 }
      freq[w].count++
      if (sentiment === 'positive') freq[w].pos++
      if (sentiment === 'negative') freq[w].neg++
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([word, data]) => ({
      word,
      count: data.count,
      sentiment: data.pos > data.neg ? 'positive' : data.neg > data.pos ? 'negative' : 'neutral',
    }))
}

export default function SaludPage() {
  const router = useRouter()
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [reviews, setReviews] = useState<PendingReview[]>([])
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState('')
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/login'); return }
      try {
        // Paralelizar las 3 llamadas para reducir tiempo de carga inicial
        const [u, n, r] = await Promise.all([getMyUsuario(), getMyNegocio(), getPendingReviews()])
        setIsAdmin(u.isAdmin)
        if (!n) { router.replace('/onboarding'); return }
        setNegocio(n)
        setReviews(r)
      } catch (err) {
        // Solo redirigir al login en errores de sesión (401), no en errores de red
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/auth/login')
        } else {
          setInitError('Error al conectar con el servidor. Recarga la página.')
        }
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  useEffect(() => {
    if (!loading && reviews.length > 0) {
      setLoadingSummary(true)
      getSummary()
        .then(s => setSummary(s))
        .catch(() => setSummary({ brilla: 'No se pudo obtener el análisis.', quema: '—', accion: '—' }))
        .finally(() => setLoadingSummary(false))
    }
  }, [loading, reviews.length])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center space-y-4">
          <p className="text-slate-600 dark:text-slate-400">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Recargar
          </button>
        </div>
      </div>
    )
  }

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const lastMonthDate = new Date(thisYear, thisMonth - 1, 1)

  const withRating = reviews.filter(r => r.starRating != null)
  const avgRating = withRating.length > 0
    ? withRating.reduce((s, r) => s + (r.starRating ?? 0), 0) / withRating.length
    : 0

  const thisMonthReviews = reviews.filter(r => {
    const d = new Date(r.reviewDate)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })
  const lastMonthReviews = reviews.filter(r => {
    const d = new Date(r.reviewDate)
    return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear()
  })

  const avgThisMonth = thisMonthReviews.filter(r => r.starRating != null).length > 0
    ? thisMonthReviews.reduce((s, r) => s + (r.starRating ?? 0), 0) / thisMonthReviews.filter(r => r.starRating != null).length
    : 0
  const avgLastMonth = lastMonthReviews.filter(r => r.starRating != null).length > 0
    ? lastMonthReviews.reduce((s, r) => s + (r.starRating ?? 0), 0) / lastMonthReviews.filter(r => r.starRating != null).length
    : 0

  const responded = reviews.filter(r => r.tonoGenerado != null).length
  const responseRate = reviews.length > 0 ? Math.round((responded / reviews.length) * 100) : 0

  const positive = reviews.filter(r => (r.starRating ?? 0) >= 4).length
  const neutral = reviews.filter(r => (r.starRating ?? 0) === 3).length
  const negative = reviews.filter(r => (r.starRating ?? 0) <= 2 && r.starRating != null).length
  const sentimentTotal = positive + neutral + negative || 1

  const keywords = computeKeywords(reviews)
  const maxKeywordCount = keywords[0]?.count || 1

  const monthName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const ratingDiff = avgThisMonth - avgLastMonth
  const ratingUp = ratingDiff > 0
  const ratingDown = ratingDiff < 0

  // Sentiment drift: last 4 months metrics
  const last4: MonthMetrics[] = getLast4Months(reviews)
  const currentM = last4[3]
  const previousM = last4[2]
  const rDrift = ratingDrift(currentM.avgRating, previousM.avgRating)
  const posDrift = drift(currentM.positiveRatio, previousM.positiveRatio)
  const negDrift = drift(currentM.negativeRatio, previousM.negativeRatio)
  const respDrift = drift(currentM.responseRate, previousM.responseRate)

  async function handleDownloadPdf() {
    if (!negocio) return
    setDownloadingPdf(true)
    try {
      await generateReputationPDF({
        negocioNombre: negocio.nombre,
        months: last4,
        allTimeAvg: avgRating,
        allTimeCount: reviews.length,
        responseRate,
        positive,
        neutral,
        negative,
        keywords: keywords.map(k => ({ word: k.word, sentiment: k.sentiment })),
        summary,
      })
    } catch (e) {
      console.error('PDF error', e)
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <Link href="/dashboard" className="font-bold text-lg text-slate-900 dark:text-white">Velacre</Link>
              {negocio && (
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400 font-normal">{negocio.nombre}</span>
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
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.replace('/auth/login') }}
            className="text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Page title */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Salud de tu reputación
              {negocio && <span className="text-slate-400 dark:text-slate-500 font-normal"> — {negocio.nombre}</span>}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 capitalize">{monthName}</p>
          </div>
          {reviews.length > 0 && (
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {downloadingPdf ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generando...</>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar informe PDF
                </>
              )}
            </button>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center">
            <p className="text-slate-500 dark:text-slate-400">Aún no tienes reseñas. Sincroniza desde el panel principal.</p>
            <Link href="/dashboard" className="inline-block mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">
              Ir al panel
            </Link>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Avg rating */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Nota media</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-900 dark:text-white">{avgRating.toFixed(1)}</span>
                  <span className="text-amber-500 text-xl mb-1">★</span>
                  {avgLastMonth > 0 && (
                    <span className={`text-sm font-semibold mb-1 ${ratingUp ? 'text-emerald-600 dark:text-emerald-400' : ratingDown ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                      {ratingUp ? '▲' : ratingDown ? '▼' : '='} {Math.abs(ratingDiff).toFixed(1)}
                    </span>
                  )}
                </div>
                {avgLastMonth > 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Mes anterior: {avgLastMonth.toFixed(1)}★
                  </p>
                )}
              </div>

              {/* Response rate */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Índice de respuesta</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-900 dark:text-white">{responseRate}%</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Has respondido a {responded} de {reviews.length} reseñas
                </p>
              </div>

              {/* Reviews this month */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Reseñas este mes</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-900 dark:text-white">{thisMonthReviews.length}</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {thisMonthReviews.length} reseñas nuevas
                </p>
              </div>
            </div>

            {/* Sentiment Drift */}
            {(rDrift || posDrift || negDrift || respDrift || last4.some(m => m.count > 0)) && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Evolución mensual</h2>
                  <span className="text-xs text-slate-400 dark:text-slate-500">vs. mes anterior</span>
                </div>

                {/* Drift KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Nota media', d: rDrift, value: currentM.avgRating != null ? `${currentM.avgRating.toFixed(1)}★` : '—', positiveIsUp: true },
                    { label: 'Reseñas positivas', d: posDrift, value: currentM.positiveRatio != null ? `${currentM.positiveRatio.toFixed(0)}%` : '—', positiveIsUp: true },
                    { label: 'Reseñas negativas', d: negDrift, value: currentM.negativeRatio != null ? `${currentM.negativeRatio.toFixed(0)}%` : '—', positiveIsUp: false },
                    { label: 'Índice respuesta', d: respDrift, value: currentM.responseRate != null ? `${currentM.responseRate.toFixed(0)}%` : '—', positiveIsUp: true },
                  ].map(({ label, d, value, positiveIsUp }) => {
                    const isGood = d ? (positiveIsUp ? d.dir === 'up' : d.dir === 'down') : null
                    return (
                      <div key={label} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
                        {d ? (
                          <p className={`text-xs font-semibold mt-0.5 ${isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {d.dir === 'up' ? '▲' : '▼'} {d.label}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Sin cambios</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 4-month mini table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 pb-2 capitalize">Mes</th>
                        <th className="text-right text-xs font-medium text-slate-500 dark:text-slate-400 pb-2">Reseñas</th>
                        <th className="text-right text-xs font-medium text-slate-500 dark:text-slate-400 pb-2">Nota</th>
                        <th className="text-right text-xs font-medium text-slate-500 dark:text-slate-400 pb-2">Positivas</th>
                        <th className="text-right text-xs font-medium text-slate-500 dark:text-slate-400 pb-2">Respondidas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {last4.map((m, i) => {
                        const isCurrent = i === 3
                        return (
                          <tr key={m.label} className={`border-b border-slate-50 dark:border-slate-700/50 last:border-0 ${isCurrent ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                            <td className={`py-2 capitalize text-xs ${isCurrent ? 'font-semibold text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                              {m.label}
                              {isCurrent && <span className="ml-1.5 text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">actual</span>}
                            </td>
                            <td className="py-2 text-right text-xs text-slate-600 dark:text-slate-400">{m.count === 0 ? '—' : m.count}</td>
                            <td className="py-2 text-right text-xs text-amber-600 dark:text-amber-400 font-medium">
                              {m.avgRating != null ? `${m.avgRating.toFixed(1)}★` : '—'}
                            </td>
                            <td className="py-2 text-right text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              {m.positiveRatio != null ? `${m.positiveRatio.toFixed(0)}%` : '—'}
                            </td>
                            <td className="py-2 text-right text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                              {m.responseRate != null ? `${m.responseRate.toFixed(0)}%` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sentiment bar */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Sentimiento general</h2>
              <div className="flex rounded-full overflow-hidden h-6 mb-3">
                {positive > 0 && (
                  <div
                    className="bg-emerald-500 flex items-center justify-center text-white text-xs font-semibold"
                    style={{ width: `${(positive / sentimentTotal) * 100}%` }}
                  >
                    {Math.round((positive / sentimentTotal) * 100)}%
                  </div>
                )}
                {neutral > 0 && (
                  <div
                    className="bg-amber-400 flex items-center justify-center text-white text-xs font-semibold"
                    style={{ width: `${(neutral / sentimentTotal) * 100}%` }}
                  >
                    {Math.round((neutral / sentimentTotal) * 100)}%
                  </div>
                )}
                {negative > 0 && (
                  <div
                    className="bg-red-500 flex items-center justify-center text-white text-xs font-semibold"
                    style={{ width: `${(negative / sentimentTotal) * 100}%` }}
                  >
                    {Math.round((negative / sentimentTotal) * 100)}%
                  </div>
                )}
              </div>
              <div className="flex gap-4 text-sm text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Positivas ({positive})</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Neutras ({neutral})</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Negativas ({negative})</span>
              </div>
            </div>

            {/* Keywords */}
            {keywords.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Palabras clave más mencionadas</h2>
                <div className="flex flex-wrap gap-2">
                  {keywords.map(kw => {
                    const size = 12 + Math.round((kw.count / maxKeywordCount) * 8)
                    const color = kw.sentiment === 'positive'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                      : kw.sentiment === 'negative'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    return (
                      <span
                        key={kw.word}
                        className={`px-3 py-1.5 rounded-full font-medium ${color}`}
                        style={{ fontSize: `${size}px` }}
                      >
                        {kw.word} <span className="opacity-60 text-xs">({kw.count})</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* AI Insights */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Análisis IA</h2>
              {loadingSummary ? (
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Analizando tus reseñas con IA...</span>
                </div>
              ) : summary ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2">Lo que brilla</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{summary.brilla}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">Lo que quema</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{summary.quema}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">La acción</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{summary.accion}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">No hay suficientes reseñas para analizar.</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
