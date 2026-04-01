'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMyUsuario, getMyNegocio, getAllReviews, getSummary, getAnalysis, getMetrics, ApiError, type PendingReview, type Negocio, type VelacreMetrics, type AnalysisData } from '@/lib/api'
import SectionNav from '@/components/SectionNav'
import WaitlistModal from '@/components/WaitlistModal'
import { getLast4Months, getAllMonths, getAllYears, drift, ratingDrift, generateMonthlyPDF, generateYearlyPDF, type MonthMetrics } from '@/lib/report-pdf'
import { useLanguage } from '@/lib/i18n'

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
  const { t } = useLanguage()
  const sl = t.app.salud
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [reviews, setReviews] = useState<PendingReview[]>([])
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState('')
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userPlan, setUserPlan] = useState<string>('basic')
  const [downloadingPdf, setDownloadingPdf] = useState<'month' | 'year' | null>(null)
  const [aiLimitReached, setAiLimitReached] = useState(false)
  const [metrics, setMetrics] = useState<VelacreMetrics | null>(null)
  const [basicUpsellPlan, setBasicUpsellPlan] = useState<'core' | 'pro' | null>(null)
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/login'); return }
      try {
        // Paralelizar las 3 llamadas para reducir tiempo de carga inicial
        const [u, n, r, m, ad] = await Promise.all([
          getMyUsuario(), getMyNegocio(), getAllReviews(),
          getMetrics().catch(() => null),
          getAnalysis().catch(() => null),
        ])
        setIsAdmin(u.isAdmin)
        setUserPlan(u.plan ?? 'basic')
        if (!n) { router.replace('/onboarding'); return }
        setNegocio(n)
        setReviews(r)
        if (m) setMetrics(m)
        if (ad) {
          setAnalysisData(ad)
          if (ad.analysis) setSummary({ brilla: ad.analysis.brilla, quema: ad.analysis.quema, accion: ad.analysis.accion })
        }
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

  function handleRunAnalysis() {
    if (loadingSummary) return
    setLoadingSummary(true)
    setAiLimitReached(false)
    getSummary()
      .then(s => {
        setSummary(s)
        getAnalysis().then(ad => setAnalysisData(ad)).catch(() => null)
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : 'Error al generar análisis'
        if (msg.includes('Límite diario')) {
          setAiLimitReached(true)
        } else {
          setSummary({ brilla: msg, quema: '—', accion: '—' })
        }
      })
      .finally(() => setLoadingSummary(false))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <p className="text-slate-600 dark:text-slate-400">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            {t.app.common.back}
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

  // Show this-month avg if available, else all-time avg
  const displayRating = avgThisMonth > 0 ? avgThisMonth : avgRating
  const displayRatingLabel = avgThisMonth > 0 ? 'Nota media (este mes)' : 'Nota media (global)'
  const ratingDiff = avgThisMonth > 0 && avgLastMonth > 0 ? avgThisMonth - avgLastMonth : 0
  const ratingUp = ratingDiff > 0
  const ratingDown = ratingDiff < 0

  // Drift KPIs siempre sobre últimos 4 meses (comparación mes a mes)
  const last4: MonthMetrics[] = getLast4Months(reviews)
  const currentM = last4[3]
  const previousM = last4[2]
  const rDrift = ratingDrift(currentM.avgRating, previousM.avgRating)
  const posDrift = drift(currentM.positiveRatio, previousM.positiveRatio)
  const negDrift = drift(currentM.negativeRatio, previousM.negativeRatio)
  const respDrift = drift(currentM.responseRate, previousM.responseRate)

  const allMonths: MonthMetrics[] = getAllMonths(reviews)
  const allYears: MonthMetrics[] = getAllYears(reviews)
  // Meses del año actual en orden ascendente (para PDF mensual y anual)
  const currentYearMonths = allMonths.filter(m => m.year === now.getFullYear()).reverse()

  async function handleDownloadPdf(type: 'month' | 'year') {
    if (!negocio) return
    setDownloadingPdf(type)
    try {
      const kwData = keywords.map(k => ({ word: k.word, sentiment: k.sentiment }))
      if (type === 'month') {
        await generateMonthlyPDF({
          negocioNombre: negocio.nombre,
          currentMonth: currentM,
          previousMonth: previousM.count > 0 || previousM.avgRating != null ? previousM : null,
          yearMonths: currentYearMonths,
          keywords: kwData,
          summary,
        })
      } else {
        await generateYearlyPDF({
          negocioNombre: negocio.nombre,
          currentYear: now.getFullYear(),
          allYears,
          currentYearMonths,
          keywords: kwData,
          summary,
        })
      }
    } catch (e) {
      console.error('PDF error', e)
    } finally {
      setDownloadingPdf(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2">
              <Link href="/inicio" className="font-bold text-lg text-slate-900 dark:text-white">Velacre</Link>
              {negocio && <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400 font-normal">· {negocio.nombre}</span>}
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.replace('/') }}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="hidden sm:inline">{t.app.common.logout}</span>
              <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </header>
      <SectionNav />

      {/* Non-pro teaser — nota media real + resto blurred con datos dummy */}
      {userPlan !== 'pro' && (
        <div className="relative">
          {/* Nota media real — visible y por encima del blur */}
          <div className="max-w-screen-xl mx-auto px-4 pt-6 pb-4 relative z-10">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 inline-flex items-center gap-6 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Tu nota media</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-slate-900 dark:text-white tabular-nums">
                    {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                  </span>
                  {avgRating > 0 && <span className="text-slate-400 text-xl font-light">/5</span>}
                </div>
                {avgRating > 0 && (
                  <div className="flex gap-1 mt-1">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={`text-base ${s <= Math.round(avgRating) ? 'text-amber-400' : 'text-slate-700'}`}>★</span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">Basado en {reviews.length} reseñas</p>
              </div>
            </div>
          </div>

          {/* Dummy blurred content */}
          <div className="max-w-screen-xl mx-auto px-4 pb-6 space-y-4" style={{ filter: 'blur(7px)', pointerEvents: 'none', userSelect: 'none' }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[['87%', 'Respondidas'], ['31', 'Reseñas este mes'], ['+0,3', 'Tendencia mensual'], ['4 min', 'Tiempo ahorrado']].map(([val, label]) => (
                <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{val}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-3 w-1/3" />
              <div className="flex rounded-full overflow-hidden h-4">
                <div className="bg-emerald-500" style={{ width: '64%' }} />
                <div className="bg-amber-400" style={{ width: '19%' }} />
                <div className="bg-red-500" style={{ width: '17%' }} />
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {['excelente', 'servicio', 'comida', 'precio', 'ubicación', 'trato', 'ambiente'].map(w => (
                  <span key={w} className="px-3 py-1 rounded-full text-xs bg-slate-200 dark:bg-slate-700 text-slate-500">{w}</span>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 h-32" />
          </div>

          {/* Upsell overlay */}
          <div className="absolute inset-x-0 bottom-0 top-32 flex items-center justify-center pointer-events-auto">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-8 text-center max-w-sm mx-4">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Panel de salud completo</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                {userPlan === 'core'
                  ? 'Análisis de sentimiento, tendencias, keywords y PDFs descargables. Disponible en el plan Pro.'
                  : 'Análisis de sentimiento, tendencias mensuales, keywords más mencionadas y reportes PDF. Solo disponible en Pro.'}
              </p>
              <button
                type="button"
                onClick={() => setBasicUpsellPlan('pro')}
                className="block w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors text-center cursor-pointer"
              >
                {userPlan === 'core' ? 'Pasarme a Pro →' : 'Quiero el panel completo →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {userPlan === 'pro' && <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-5">

        {/* ── CABECERA DE PÁGINA ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">{sl.title}</h1>
            {negocio && <p className="text-sm text-slate-400 mt-0.5">{negocio.nombre} <span className="text-slate-600">·</span> <span className="capitalize">{monthName}</span></p>}
          </div>
          {reviews.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {(['month', 'year'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => handleDownloadPdf(type)}
                  disabled={downloadingPdf !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors disabled:opacity-40"
                >
                  {downloadingPdf === type
                    ? <><span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />Generando...</>
                    : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>{type === 'month' ? 'PDF mes' : 'PDF ejercicio'}</>
                  }
                </button>
              ))}
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-slate-400 mb-4">{sl.noAnalysis}</p>
            <Link href="/dashboard" className="inline-block px-5 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors text-sm">
              {t.app.common.back}
            </Link>
          </div>
        ) : (
          <>
            {/* ── HERO DE PUNTUACIÓN ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-6">
                {/* Nota global */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Nota media global</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-black text-white tabular-nums">{avgRating.toFixed(1)}</span>
                    <span className="text-slate-500 text-2xl font-light">/5</span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={`text-lg ${s <= Math.round(avgRating) ? 'text-amber-400' : 'text-slate-700'}`}>★</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Basado en {reviews.length} {sl.totalReviews}</p>
                </div>

                {/* Divider vertical */}
                <div className="hidden md:block w-px h-20 bg-slate-800" />

                {/* KPIs rápidos */}
                <div className="flex flex-wrap gap-6">
                  {/* Nota este mes */}
                  <div>
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-widest">Este mes</p>
                    {avgThisMonth > 0 ? (
                      <>
                        <p className="text-3xl font-bold text-white tabular-nums">{avgThisMonth.toFixed(1)}<span className="text-slate-500 text-lg font-normal"> /5</span></p>
                        {ratingDiff !== 0 && (
                          <p className={`text-xs font-semibold mt-0.5 ${ratingDiff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {ratingDiff > 0 ? '▲' : '▼'} {Math.abs(ratingDiff).toFixed(2)} vs mes anterior
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-2xl font-bold text-slate-600">—</p>
                    )}
                  </div>
                  {/* Reseñas este mes */}
                  <div>
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-widest">Reseñas este mes</p>
                    <p className="text-3xl font-bold text-white tabular-nums">{thisMonthReviews.length}</p>
                    {lastMonthReviews.length > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {thisMonthReviews.length - lastMonthReviews.length >= 0 ? '+' : ''}{thisMonthReviews.length - lastMonthReviews.length} vs anterior
                      </p>
                    )}
                  </div>
                  {/* Índice respuesta */}
                  <div>
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-widest">Respondidas</p>
                    <p className="text-3xl font-bold text-white tabular-nums">{responseRate}<span className="text-slate-500 text-lg font-normal">%</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">{responded} de {reviews.length}</p>
                  </div>
                  {/* Pendientes */}
                  <div>
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-widest">Sin responder</p>
                    <p className={`text-3xl font-bold tabular-nums ${reviews.length - responded > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{reviews.length - responded}</p>
                    <Link href="/dashboard" className="text-xs text-indigo-400 hover:text-indigo-300 mt-0.5 block transition-colors">Ver pendientes →</Link>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SENTIMIENTO + COMPARATIVA MES ── */}
            <div className="grid md:grid-cols-2 gap-5">
              {/* Distribución global */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">{sl.sentiment}</p>
                <div className="space-y-3">
                  {[
                    { label: sl.positive, count: positive, total: sentimentTotal, color: 'bg-emerald-500', textColor: 'text-emerald-400', range: '4–5 ★' },
                    { label: sl.neutral,  count: neutral,  total: sentimentTotal, color: 'bg-amber-400',  textColor: 'text-amber-400',   range: '3 ★' },
                    { label: sl.negative, count: negative, total: sentimentTotal, color: 'bg-red-500',    textColor: 'text-red-400',     range: '1–2 ★' },
                  ].map(row => {
                    const pct = Math.round((row.count / row.total) * 100)
                    return (
                      <div key={row.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${row.color} inline-block`} />
                            {row.label} <span className="text-slate-600 text-xs">({row.range})</span>
                          </span>
                          <span className={`text-sm font-bold ${row.textColor}`}>{row.count} <span className="text-slate-500 font-normal text-xs">({pct}%)</span></span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-2 ${row.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── MÉTRICAS DE IMPACTO VELACRE ── */}
              {metrics && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Impacto Velacre</p>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {/* Dimensión 1: % respondidas */}
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Reseñas respondidas</p>
                      <p className="text-3xl font-black text-white tabular-nums">{metrics.responseRate}%</p>
                      <p className="text-xs text-slate-600 mt-1">{metrics.velacreCount} de {metrics.total} con IA</p>
                    </div>
                    {/* Dimensión 2: Horas ahorradas (4 min manual − 15 seg IA) */}
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Tiempo ahorrado</p>
                      <p className="text-3xl font-black text-indigo-400 tabular-nums">
                        {metrics.timeSavedMinutes >= 60
                          ? `${Math.floor(metrics.timeSavedMinutes / 60)}h ${metrics.timeSavedMinutes % 60}m`
                          : `${metrics.timeSavedMinutes}m`}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">vs gestión manual</p>
                    </div>
                    {/* Dimensión 3: SEO — keywords usadas */}
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Optimización SEO</p>
                      <p className="text-3xl font-black text-emerald-400 tabular-nums">
                        {metrics.topKeywordsUsadas.length > 0 ? metrics.topKeywordsUsadas.reduce((s, k) => s + k.count, 0) : 0}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">usos de keywords en respuestas</p>
                    </div>
                  </div>
                  {/* Keywords usadas — pills */}
                  {metrics.topKeywordsUsadas.length > 0 && (
                    <div className="pt-3 border-t border-slate-800">
                      <p className="text-xs text-slate-600 mb-2">Keywords más usadas en respuestas IA</p>
                      <div className="flex flex-wrap gap-1.5">
                        {metrics.topKeywordsUsadas.map(k => (
                          <span key={k.word} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-900/30 text-emerald-400 text-xs rounded-full border border-emerald-800/50">
                            {k.word}
                            <span className="text-emerald-600 text-[10px]">×{k.count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Este mes vs anterior — ancho completo */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Este mes vs anterior</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Nota media', d: rDrift, value: currentM.avgRating != null ? `${currentM.avgRating.toFixed(2)}` : '—', unit: '/5', positiveIsUp: true },
                    { label: '% Positivas', d: posDrift, value: currentM.positiveRatio != null ? `${currentM.positiveRatio.toFixed(0)}` : '—', unit: '%', positiveIsUp: true },
                    { label: '% Negativas', d: negDrift, value: currentM.negativeRatio != null ? `${currentM.negativeRatio.toFixed(0)}` : '—', unit: '%', positiveIsUp: false },
                    { label: 'Respondidas', d: respDrift, value: currentM.responseRate != null ? `${currentM.responseRate.toFixed(0)}` : '—', unit: '%', positiveIsUp: true },
                  ].map(({ label, d, value, unit, positiveIsUp }) => {
                    const isGood = d ? (positiveIsUp ? d.dir === 'up' : d.dir === 'down') : null
                    return (
                      <div key={label} className="bg-slate-800/60 rounded-xl p-3">
                        <p className="text-xs text-slate-500 mb-1">{label}</p>
                        <p className="text-xl font-bold text-white">{value}<span className="text-slate-500 text-sm font-normal">{unit}</span></p>
                        {d ? (
                          <p className={`text-xs font-semibold mt-0.5 ${isGood ? 'text-emerald-400' : 'text-red-400'}`}>
                            {d.dir === 'up' ? '▲' : '▼'} {d.label}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-600 mt-0.5">Sin variación</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

            {/* ── EVOLUCIÓN HISTÓRICA ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Evolución histórica mensual</p>
              <div className="overflow-x-auto max-h-72 overflow-y-auto scroll-thin">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="sticky top-0 bg-slate-900">
                    <tr className="border-b border-slate-800">
                      {['Mes', 'Reseñas', 'Nota', 'Positivas', 'Negativas', 'Respondidas'].map((h, i) => (
                        <th key={h} className={`pb-2 text-xs font-semibold text-slate-500 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allMonths.map((m, i) => {
                      const isCurrent = i === 0
                      const prev = allMonths[i + 1]
                      const notaDelta = prev && m.avgRating != null && prev.avgRating != null ? m.avgRating - prev.avgRating : null
                      return (
                        <tr key={`${m.year}-${m.month}`} className={`border-b border-slate-800/50 last:border-0 ${isCurrent ? 'bg-indigo-950/30' : ''}`}>
                          <td className={`py-2.5 capitalize text-xs ${isCurrent ? 'font-semibold text-indigo-300' : 'text-slate-300'}`}>
                            {m.label}
                            {isCurrent && <span className="ml-2 text-[10px] bg-indigo-900/60 text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">actual</span>}
                          </td>
                          <td className="py-2.5 text-right text-xs text-slate-400">{m.count === 0 ? <span className="text-slate-700">—</span> : m.count}</td>
                          <td className="py-2.5 text-right text-xs font-semibold">
                            {m.avgRating != null
                              ? <span className="text-amber-400">{m.avgRating.toFixed(2)}</span>
                              : <span className="text-slate-700">—</span>}
                            {notaDelta != null && Math.abs(notaDelta) >= 0.05 && (
                              <span className={`ml-1 text-[10px] ${notaDelta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {notaDelta > 0 ? '▲' : '▼'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right text-xs font-medium text-emerald-500">
                            {m.positiveRatio != null ? `${m.positiveRatio.toFixed(0)}%` : <span className="text-slate-700">—</span>}
                          </td>
                          <td className="py-2.5 text-right text-xs font-medium">
                            {m.negativeRatio != null
                              ? <span className={m.negativeRatio > 30 ? 'text-red-400' : 'text-slate-400'}>{m.negativeRatio.toFixed(0)}%</span>
                              : <span className="text-slate-700">—</span>}
                          </td>
                          <td className="py-2.5 text-right text-xs font-medium text-indigo-400">
                            {m.responseRate != null ? `${m.responseRate.toFixed(0)}%` : <span className="text-slate-700">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── PALABRAS CLAVE ── */}
            {keywords.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">{t.health.keywords}</p>
                <div className="flex flex-wrap gap-2">
                  {keywords.map(kw => {
                    const size = 11 + Math.round((kw.count / maxKeywordCount) * 7)
                    const cls = kw.sentiment === 'positive'
                      ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-300'
                      : kw.sentiment === 'negative'
                        ? 'bg-red-950/60 border-red-800/50 text-red-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    return (
                      <span key={kw.word} className={`px-3 py-1.5 rounded-full border font-medium ${cls}`} style={{ fontSize: `${size}px` }}>
                        {kw.word} <span className="opacity-50 text-[10px]">×{kw.count}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── ANÁLISIS IA ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{sl.analysisTitle}</p>
                {analysisData?.analysis?.createdAt && !loadingSummary && (
                  <span className="text-[11px] text-slate-600">
                    {(() => {
                      const d = new Date(analysisData.analysis.createdAt)
                      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    })()}
                  </span>
                )}
              </div>
              {loadingSummary ? (
                <div className="flex items-center gap-3 text-slate-400">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">{sl.generatingAnalysis}</span>
                </div>
              ) : aiLimitReached ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-slate-400">Límite diario alcanzado (3 análisis/día). Se restablece mañana.</p>
                  {summary && (
                    <div className="grid md:grid-cols-3 gap-3 opacity-60">
                      <div className="bg-emerald-950/40 border border-emerald-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /><p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{sl.analysisBrilla}</p></div>
                        <p className="text-sm text-slate-200 leading-relaxed">{summary.brilla}</p>
                      </div>
                      <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /><p className="text-xs font-bold text-red-400 uppercase tracking-wider">{sl.analysisQuema}</p></div>
                        <p className="text-sm text-slate-200 leading-relaxed">{summary.quema}</p>
                      </div>
                      <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" /><p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{sl.analysisAccion}</p></div>
                        <p className="text-sm text-slate-200 leading-relaxed">{summary.accion}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : summary ? (
                <>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="bg-emerald-950/40 border border-emerald-900/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{sl.analysisBrilla}</p>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed">{summary.brilla}</p>
                    </div>
                    <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        <p className="text-xs font-bold text-red-400 uppercase tracking-wider">{sl.analysisQuema}</p>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed">{summary.quema}</p>
                    </div>
                    <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{sl.analysisAccion}</p>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed">{summary.accion}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <button
                      onClick={handleRunAnalysis}
                      disabled={loadingSummary}
                      className="text-xs px-3 py-1.5 border border-slate-700 text-slate-400 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {sl.generateAnalysis}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm text-slate-400">
                    {sl.noAnalysis}
                  </p>
                  <button
                    onClick={handleRunAnalysis}
                    disabled={loadingSummary}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    {sl.generateAnalysis}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>}

      {basicUpsellPlan && (
        <WaitlistModal plan={basicUpsellPlan} onClose={() => setBasicUpsellPlan(null)} />
      )}

      <footer className="mt-8 border-t border-slate-800 py-5">
        <div className="max-w-screen-xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <span>© {new Date().getFullYear()} Velacre · {t.footer.rights.replace('© 2026 Velacre. ', '')}</span>
          <div className="flex gap-4">
            <Link href="/privacidad" className="hover:text-slate-400 transition-colors">{t.footer.privacy}</Link>
            <Link href="/terminos" className="hover:text-slate-400 transition-colors">{t.footer.terms}</Link>
            <Link href="/contacto" className="hover:text-slate-400 transition-colors">{t.footer.contact}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
