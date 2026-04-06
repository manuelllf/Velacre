'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMyUsuario, getMyNegocio, getAllReviews, getSummary, getAnalysis, getMetrics, getRadar, addCompetidor, removeCompetidor, runRadarAnalysis, searchPlaces, ApiError, type PendingReview, type Negocio, type VelacreMetrics, type AnalysisData, type RadarData, type RadarCategoria } from '@/lib/api'
import SectionNav from '@/components/SectionNav'
import WaitlistModal from '@/components/WaitlistModal'
import Tooltip from '@/components/Tooltip'
import { HelpButton } from '@/components/HelpModal'
import { getLast4Months, getAllMonths, getAllYears, drift, ratingDrift, generateMonthlyPDF, generateYearlyPDF, computeSpeedBenchmark, type MonthMetrics, type SpeedBenchmark } from '@/lib/report-pdf'
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


function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 7.5
    ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-900/50'
    : score >= 5
      ? 'text-amber-400 bg-amber-950/60 border border-amber-900/50'
      : 'text-red-400 bg-red-950/60 border border-red-900/50'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${cls}`}>
      {score}
    </span>
  )
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

  // ── Radar de Competencia ──────────────────────────────────────
  const [radarData, setRadarData] = useState<RadarData | null>(null)
  const [loadingRadar, setLoadingRadar] = useState(false)
  const [analyzingRadar, setAnalyzingRadar] = useState(false)
  const [radarError, setRadarError] = useState('')
  const [radarSearch, setRadarSearch] = useState('')
  const [radarSearchResults, setRadarSearchResults] = useState<{ placeId: string; name: string; address: string }[]>([])
  const [radarSearching, setRadarSearching] = useState(false)
  const [radarSteps, setRadarSteps] = useState<{ label: string; done: boolean }[]>([])

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
        const plan = u.plan ?? 'basic'
        setUserPlan(plan)
        if (!n) { router.replace('/onboarding'); return }
        setNegocio(n)
        setReviews(r)
        if (m) setMetrics(m)
        if (ad) {
          setAnalysisData(ad)
          if (ad.analysis) setSummary({ brilla: ad.analysis.brilla, quema: ad.analysis.quema, accion: ad.analysis.accion })
        }
        if (plan === 'pro') {
          getRadar().then(rd => setRadarData(rd)).catch(() => null)
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

  async function handleRadarSearch(query: string) {
    if (!query.trim()) { setRadarSearchResults([]); return }
    setRadarSearching(true)
    try {
      const results = await searchPlaces(query)
      setRadarSearchResults(results.map(p => ({ placeId: p.placeId, name: p.name, address: p.address })))
    } catch { setRadarSearchResults([]) }
    finally { setRadarSearching(false) }
  }

  async function handleAddCompetidor(placeId: string, nombre: string) {
    setRadarError('')
    try {
      await addCompetidor(placeId, nombre)
      const rd = await getRadar()
      setRadarData(rd)
      setRadarSearch('')
      setRadarSearchResults([])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error'
      if (msg.includes('max_competidores')) setRadarError('Máximo 3 competidores.')
      else if (msg.includes('ya_existe')) setRadarError('Este competidor ya está añadido.')
      else setRadarError(msg)
    }
  }

  async function handleRemoveCompetidor(id: string) {
    setRadarError('')
    try {
      await removeCompetidor(id)
      setRadarData(prev => prev ? { ...prev, competidores: prev.competidores.filter(c => c.id !== id) } : prev)
    } catch { setRadarError('Error al eliminar competidor.') }
  }

  async function handleRunRadar() {
    setAnalyzingRadar(true)
    setRadarError('')

    const nombres = radarData?.competidores.map(c => c.nombre) ?? []
    const stepDefs = [
      { label: 'Recuperando tus últimas reseñas…', delay: 0 },
      ...nombres.map((n, i) => ({ label: `Consultando reseñas de ${n}…`, delay: 1500 + i * 4500 })),
      { label: 'Analizando patrones con IA…', delay: 1500 + nombres.length * 4500 },
      { label: 'Generando informe comparativo…', delay: 1500 + nombres.length * 4500 + 5000 },
    ]

    setRadarSteps(stepDefs.map((s, i) => ({ label: s.label, done: false, active: i === 0 })) as { label: string; done: boolean }[])

    const timers: ReturnType<typeof setTimeout>[] = stepDefs.slice(1).map((step, i) =>
      setTimeout(() => {
        setRadarSteps(prev => prev.map((s, idx) => ({ ...s, done: idx < i + 1 })))
      }, step.delay)
    )

    try {
      const result = await runRadarAnalysis()
      setRadarData(prev => prev ? { ...prev, ultimoAnalisis: result } : { competidores: [], ultimoAnalisis: result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al analizar'
      if (msg.includes('sin_competidores')) setRadarError('Añade al menos un competidor antes de analizar.')
      else if (msg.includes('sin_resenas_propias')) setRadarError('Necesitas reseñas propias en el sistema para comparar.')
      else if (msg.includes('ya_analizado_este_mes')) setRadarError('Ya has usado el análisis este mes. Disponible el mes que viene.')
      else setRadarError(msg)
    } finally {
      timers.forEach(clearTimeout)
      setAnalyzingRadar(false)
      setRadarSteps([])
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
            className="px-5 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
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
  const speedBenchmark: SpeedBenchmark | null = computeSpeedBenchmark(reviews)

  // ── Radar: computed ──────────────────────────────────────────
  const radarResultado = radarData?.ultimoAnalisis?.resultado ?? null
  const radarAnalisisDate = radarData?.ultimoAnalisis
    ? new Date(radarData.ultimoAnalisis.createdAt) : null
  const canAnalizar = !radarAnalisisDate ||
    radarAnalisisDate.getMonth() !== now.getMonth() ||
    radarAnalisisDate.getFullYear() !== now.getFullYear()
  const proximoAnalisisLabel = radarAnalisisDate && !canAnalizar
    ? (() => {
        const next = new Date(radarAnalisisDate.getFullYear(), radarAnalisisDate.getMonth() + 1, 1)
        return next.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })
      })()
    : null

  async function handleDownloadPdf(type: 'month' | 'year') {
    if (!negocio) return
    setDownloadingPdf(type)
    try {
      const kwData = keywords.map(k => ({ word: k.word, sentiment: k.sentiment }))
      if (type === 'month') {
        // Distribución de estrellas del mes actual y anterior
        const buildStarCounts = (year: number, month: number): number[] => {
          const sc = [0, 0, 0, 0, 0, 0]
          reviews
            .filter(r => { const d = new Date(r.reviewDate); return d.getFullYear() === year && d.getMonth() === month })
            .forEach(r => { if (r.starRating && r.starRating >= 1 && r.starRating <= 5) sc[r.starRating]++ })
          return sc
        }
        const scCur = buildStarCounts(currentM.year, currentM.month)
        const pmValid = previousM.count > 0 || previousM.avgRating != null
        const scPrev = pmValid ? buildStarCounts(previousM.year, previousM.month) : undefined
        const pendingCount = reviews.filter(r => !r.tonoGenerado && r.estado !== 'ignorada').length
        await generateMonthlyPDF({
          negocioNombre: negocio.nombre,
          negocioTelefono: negocio.telefono,
          negocioEmail: negocio.email,
          negocioPalabrasClave: negocio.palabrasClave,
          currentMonth: currentM,
          previousMonth: pmValid ? previousM : null,
          yearMonths: currentYearMonths,
          keywords: kwData,
          summary,
          starCountsCurrent: scCur,
          starCountsPrevious: scPrev,
          pendingCount,
          speedBenchmark,
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

      {/* ── BASIC teaser: nota media real + 2 KPIs dummy blurred ── */}
      {userPlan === 'basic' && (
        <div className="relative">
          {/* Nota media real */}
          <div className="max-w-screen-xl mx-auto px-4 pt-6 pb-4 relative z-[1]">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 inline-flex items-center gap-6 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Tu nota media</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white tabular-nums">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
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

          {/* Dummy blurred — mínimo: 2 KPIs */}
          <div className="max-w-screen-xl mx-auto px-4 pb-6 space-y-4" style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
            <div className="grid grid-cols-2 gap-3">
              {[['87%', 'Tasa de respuesta'], ['+0,3', 'Tendencia mensual']].map(([val, label]) => (
                <div key={label} className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
                  <p className="text-2xl font-bold text-white">{val}</p>
                  <p className="text-xs text-slate-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 h-24" />
          </div>

          {/* Upsell overlay */}
          <div className="absolute inset-x-0 bottom-0 top-28 flex items-center justify-center pointer-events-auto">
            <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-sm mx-4 overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600" />
              <div className="p-7 text-center space-y-4">
                {(() => {
                  const pending = reviews.filter(r => !r.tonoGenerado && r.estado !== 'ignorada').length
                  return pending > 0 ? (
                    <div className="bg-amber-950/50 border border-amber-800/50 rounded-xl px-4 py-3 text-left">
                      <p className="text-sm font-bold text-amber-300">{pending} reseña{pending !== 1 ? 's' : ''} sin responder</p>
                      <p className="text-xs text-amber-600 mt-0.5">18 respuestas IA al mes con Core.</p>
                    </div>
                  ) : null
                })()}
                <div>
                  <h2 className="text-lg font-bold text-white mb-2">Empieza a responder en serio</h2>
                  <p className="text-sm text-slate-400">18 respuestas IA al mes, tono personalizado y palabras clave SEO. Por 19 €/mes.</p>
                </div>
                <button type="button" onClick={() => setBasicUpsellPlan('core')}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer">
                  Pasarme a Core →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CORE teaser: cards reales + cards Pro bloqueadas ── */}
      {userPlan === 'core' && (
        <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-5">

          {/* Cabecera */}
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Panel de Salud</h1>
            {negocio && <p className="text-sm text-slate-400 mt-0.5">{negocio.nombre} <span className="text-slate-600">·</span> <span className="capitalize">{monthName}</span></p>}
          </div>

          {/* ── CARDS REALES (datos sin blur) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Nota media */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Nota media</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-white tabular-nums">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
                {avgRating > 0 && <span className="text-slate-500 text-base">/5</span>}
              </div>
              {avgRating > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className={`text-sm ${s <= Math.round(avgRating) ? 'text-amber-400' : 'text-slate-700'}`}>★</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500 mt-1">{reviews.length} reseñas</p>
            </div>

            {/* Tasa de respuesta */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Respondidas</p>
              <p className="text-3xl font-black text-white tabular-nums">{responseRate}%</p>
              <p className="text-xs text-slate-500 mt-1">{responded} de {reviews.length}</p>
            </div>

            {/* Reseñas este mes */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Este mes</p>
              <p className="text-3xl font-black text-white tabular-nums">{thisMonthReviews.length}</p>
              <p className="text-xs text-slate-500 mt-1">reseñas nuevas</p>
            </div>

            {/* Tendencia */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Tendencia</p>
              {ratingDiff !== 0 ? (
                <>
                  <p className={`text-3xl font-black tabular-nums ${ratingDiff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {ratingDiff > 0 ? '+' : ''}{ratingDiff.toFixed(1)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">vs mes anterior</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-black text-slate-600">—</p>
                  <p className="text-xs text-slate-500 mt-1">sin datos previos</p>
                </>
              )}
            </div>
          </div>

          {/* Sentimiento real */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Distribución de sentimiento</p>
            <div className="flex rounded-full overflow-hidden h-3">
              <div className="bg-emerald-500 transition-all" style={{ width: `${(positive / sentimentTotal) * 100}%` }} />
              <div className="bg-amber-400 transition-all" style={{ width: `${(neutral / sentimentTotal) * 100}%` }} />
              <div className="bg-red-500 transition-all" style={{ width: `${(negative / sentimentTotal) * 100}%` }} />
            </div>
            <div className="flex gap-4 mt-3 text-xs text-slate-400">
              <span><span className="text-emerald-400 font-bold">{positive}</span> positivas</span>
              <span><span className="text-amber-400 font-bold">{neutral}</span> neutras</span>
              <span><span className="text-red-400 font-bold">{negative}</span> negativas</span>
            </div>
          </div>

          {/* ── CARDS PRO BLOQUEADAS ── */}
          <div className="grid sm:grid-cols-2 gap-4">

            {/* Análisis IA — bloqueado */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Análisis IA</p>
                <span className="text-xs font-bold text-blue-400 bg-blue-950/60 border border-blue-900/50 px-2 py-0.5 rounded-full">Pro</span>
              </div>
              <div className="space-y-3" style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
                <div className="space-y-1">
                  <p className="text-xs text-emerald-400 font-semibold">Lo que brilla</p>
                  <div className="h-3 bg-slate-700 rounded w-4/5" />
                  <div className="h-3 bg-slate-700 rounded w-3/5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-red-400 font-semibold">Lo que quema</p>
                  <div className="h-3 bg-slate-700 rounded w-4/5" />
                  <div className="h-3 bg-slate-700 rounded w-2/5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-blue-400 font-semibold">Acción esta semana</p>
                  <div className="h-3 bg-slate-700 rounded w-full" />
                  <div className="h-3 bg-slate-700 rounded w-3/4" />
                </div>
              </div>
              <button type="button" onClick={() => setBasicUpsellPlan('pro')}
                className="mt-4 w-full py-2 text-xs font-semibold text-blue-400 border border-blue-900/60 rounded-xl hover:bg-blue-950/40 transition-colors cursor-pointer">
                Desbloquear con Pro →
              </button>
            </div>

            {/* Radar de competidores — bloqueado */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Radar de competidores</p>
                <span className="text-xs font-bold text-blue-400 bg-blue-950/60 border border-blue-900/50 px-2 py-0.5 rounded-full">Pro</span>
              </div>
              <div className="space-y-2" style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
                {[60, 75, 45].map((w, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-3 bg-slate-700 rounded w-16 shrink-0" />
                    <div className="flex-1 h-2 bg-slate-800 rounded-full">
                      <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${w}%` }} />
                    </div>
                    <div className="h-3 bg-slate-700 rounded w-8 shrink-0" />
                  </div>
                ))}
                <div className="h-3 bg-slate-700 rounded w-2/3 mt-2" />
              </div>
              <button type="button" onClick={() => setBasicUpsellPlan('pro')}
                className="mt-4 w-full py-2 text-xs font-semibold text-blue-400 border border-blue-900/60 rounded-xl hover:bg-blue-950/40 transition-colors cursor-pointer">
                Desbloquear con Pro →
              </button>
            </div>

            {/* Categorías sentimiento — bloqueado */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sentimiento por categoría</p>
                <span className="text-xs font-bold text-blue-400 bg-blue-950/60 border border-blue-900/50 px-2 py-0.5 rounded-full">Pro</span>
              </div>
              <div className="space-y-2" style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
                {[['', 40], ['', 65], ['', 50], ['', 80]].map(([, w], i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-3 bg-slate-700 rounded w-14 shrink-0" />
                    <div className="flex-1 h-2 bg-slate-800 rounded-full">
                      <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${w}%` }} />
                    </div>
                    <div className="h-3 bg-slate-700 rounded w-6 shrink-0" />
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setBasicUpsellPlan('pro')}
                className="mt-4 w-full py-2 text-xs font-semibold text-blue-400 border border-blue-900/60 rounded-xl hover:bg-blue-950/40 transition-colors cursor-pointer">
                Desbloquear con Pro →
              </button>
            </div>

            {/* Informes PDF — bloqueado */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Informes PDF</p>
                <span className="text-xs font-bold text-blue-400 bg-blue-950/60 border border-blue-900/50 px-2 py-0.5 rounded-full">Pro</span>
              </div>
              <div className="space-y-2" style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
                <div className="flex items-center gap-3 bg-slate-800 rounded-xl p-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 bg-slate-700 rounded w-3/5" />
                    <div className="h-2 bg-slate-700 rounded w-2/5" />
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-800 rounded-xl p-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 bg-slate-700 rounded w-2/5" />
                    <div className="h-2 bg-slate-700 rounded w-1/3" />
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setBasicUpsellPlan('pro')}
                className="mt-4 w-full py-2 text-xs font-semibold text-blue-400 border border-blue-900/60 rounded-xl hover:bg-blue-950/40 transition-colors cursor-pointer">
                Desbloquear con Pro →
              </button>
            </div>
          </div>

          {/* Banner upsell final */}
          <div className="bg-blue-950/30 border border-blue-900/40 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white">Panel de Salud completo — solo Pro</p>
              <p className="text-xs text-slate-400 mt-1">Análisis IA, radar de competidores, sentimiento por categoría e informes PDF descargables.</p>
            </div>
            <button type="button" onClick={() => setBasicUpsellPlan('pro')}
              className="shrink-0 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer whitespace-nowrap">
              Pasarme a Pro →
            </button>
          </div>

        </main>
      )}

      {userPlan === 'pro' && <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-5">

        {/* ── CABECERA DE PÁGINA ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Panel de Salud</h1>
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
            <Link href="/dashboard" className="inline-block px-5 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-sm">
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
                    <Link href="/dashboard" className="text-xs text-blue-400 hover:text-blue-300 mt-0.5 block transition-colors">Ver pendientes →</Link>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SENTIMIENTO + COMPARATIVA MES ── */}
            <div className="grid md:grid-cols-2 gap-5">
              {/* Distribución global */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
                  {sl.sentiment}
                  <Tooltip text="Clasifica tus reseñas según la puntuación: positivas (4-5★), neutras (3★) o negativas (1-2★)." />
                </p>
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
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
                    Impacto Velacre
                    <Tooltip text="Estadísticas de lo que Velacre ha hecho por ti este mes." />
                  </p>
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
                      <p className="text-3xl font-black text-blue-400 tabular-nums">
                        {metrics.timeSavedMinutes >= 60
                          ? `${Math.floor(metrics.timeSavedMinutes / 60)}h ${metrics.timeSavedMinutes % 60}m`
                          : `${metrics.timeSavedMinutes}m`}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">vs gestión manual</p>
                    </div>
                    {/* Dimensión 3: SEO — keywords usadas */}
                    <div>
                      <p className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                        Optimización SEO
                        <Tooltip text="SEO = posicionamiento en buscadores. Cuántas veces la IA ha incluido tus palabras clave en las respuestas, lo que ayuda a que Google te encuentre." />
                      </p>
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

              {/* ── VELOCIDAD DE RESPUESTA ── */}
              {speedBenchmark && (
                <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
                    Velocidad de respuesta
                    <Tooltip text="Cuánto tardas en responder desde que llega una reseña. Google valora los negocios que responden rápido." />
                  </p>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Media de respuesta</p>
                      <p className={`text-3xl font-black tabular-nums ${speedBenchmark.avgDays < 2 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {speedBenchmark.avgDays < 1
                          ? `${Math.round(speedBenchmark.avgDays * 24)}h`
                          : `${speedBenchmark.avgDays.toFixed(1)}d`}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">entre reseña y respuesta</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Respondidas en &lt;48h</p>
                      <p className={`text-3xl font-black tabular-nums ${speedBenchmark.pct48h >= 80 ? 'text-emerald-400' : speedBenchmark.pct48h >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        {speedBenchmark.pct48h.toFixed(0)}%
                      </p>
                      <p className="text-xs text-slate-600 mt-1">umbral Google Maps</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Respondidas en &lt;24h</p>
                      <p className={`text-3xl font-black tabular-nums ${speedBenchmark.pct24h >= 60 ? 'text-emerald-400' : speedBenchmark.pct24h >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                        {speedBenchmark.pct24h.toFixed(0)}%
                      </p>
                      <p className="text-xs text-slate-600 mt-1">de {speedBenchmark.totalResponded} respondidas</p>
                    </div>
                  </div>
                  {/* Barra de distribución */}
                  <div className="flex h-3 rounded-full overflow-hidden gap-px">
                    {speedBenchmark.pct24h > 0 && (
                      <div className="bg-emerald-500" style={{ width: `${speedBenchmark.pct24h}%` }} title={`< 24h: ${speedBenchmark.pct24h.toFixed(0)}%`} />
                    )}
                    {(speedBenchmark.pct48h - speedBenchmark.pct24h) > 0 && (
                      <div className="bg-amber-400" style={{ width: `${speedBenchmark.pct48h - speedBenchmark.pct24h}%` }} title={`24–48h: ${(speedBenchmark.pct48h - speedBenchmark.pct24h).toFixed(0)}%`} />
                    )}
                    {speedBenchmark.pctOver48h > 0 && (
                      <div className="bg-red-500" style={{ width: `${speedBenchmark.pctOver48h}%` }} title={`> 48h: ${speedBenchmark.pctOver48h.toFixed(0)}%`} />
                    )}
                  </div>
                  <div className="flex gap-4 mt-2">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />&lt;24h</span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />24–48h</span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />&gt;48h</span>
                  </div>
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
                        <tr key={`${m.year}-${m.month}`} className={`border-b border-slate-800/50 last:border-0 ${isCurrent ? 'bg-blue-950/30' : ''}`}>
                          <td className={`py-2.5 capitalize text-xs ${isCurrent ? 'font-semibold text-blue-300' : 'text-slate-300'}`}>
                            {m.label}
                            {isCurrent && <span className="ml-2 text-[10px] bg-blue-900/60 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">actual</span>}
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
                          <td className="py-2.5 text-right text-xs font-medium text-blue-400">
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
                      ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-200'
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
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
                      <div className="bg-blue-950/40 border border-blue-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" /><p className="text-xs font-bold text-blue-400 uppercase tracking-wider">{sl.analysisAccion}</p></div>
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
                    <div className="bg-blue-950/40 border border-blue-900/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">{sl.analysisAccion}</p>
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
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    {sl.generateAnalysis}
                  </button>
                </div>
              )}
            </div>

            {/* ── RADAR DE COMPETENCIA ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Radar de competencia
                    <Tooltip text="Compara tu reputación con la de hasta 3 competidores. La IA analiza sus reseñas y las tuyas. Hasta 2 análisis al mes." />
                  </p>
                  <p className="text-sm text-slate-400 mt-0.5">Compara tu reputación con la competencia usando IA</p>
                </div>
                {radarData?.ultimoAnalisis && (
                  <span className="text-[11px] text-slate-600">
                    {(() => {
                      const d = new Date(radarData.ultimoAnalisis.createdAt)
                      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    })()}
                  </span>
                )}
              </div>

              {/* Competidores añadidos */}
              <div className="mb-4">
                {radarData && radarData.competidores.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {radarData.competidores.map(c => (
                      <div key={c.id} className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5">
                        <span className="text-sm text-slate-200">{c.nombre}</span>
                        <button
                          onClick={() => handleRemoveCompetidor(c.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                          title="Eliminar"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 mb-3">Sin competidores añadidos.</p>
                )}

                {/* Buscar competidor */}
                {(!radarData || radarData.competidores.length < 3) && (
                  <div className="relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={radarSearch}
                        onChange={e => {
                          setRadarSearch(e.target.value)
                          if (e.target.value.length >= 3) handleRadarSearch(e.target.value)
                          else setRadarSearchResults([])
                        }}
                        placeholder="Busca un negocio por nombre o dirección…"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      {radarSearching && (
                        <div className="flex items-center px-2">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    {radarSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden z-10 shadow-xl">
                        {radarSearchResults.slice(0, 5).map(r => (
                          <button
                            key={r.placeId}
                            onClick={() => handleAddCompetidor(r.placeId, r.name)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                          >
                            <p className="text-sm font-medium text-slate-200">{r.name}</p>
                            <p className="text-xs text-slate-500 truncate">{r.address}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {radarError && (
                <p className="text-sm text-red-400 mb-3">{radarError}</p>
              )}

              {/* Botón analizar / pasos en progreso */}
              {radarData && radarData.competidores.length > 0 && (
                <div className="mb-4">
                  {analyzingRadar ? (
                    <div className="space-y-2 py-1">
                      {radarSteps.map((step, i) => {
                        const isActive = !step.done && radarSteps.slice(0, i).every(s => s.done)
                        return (
                          <div key={i} className="flex items-center gap-2.5">
                            {step.done ? (
                              <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : isActive ? (
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                            )}
                            <span className={`text-sm transition-colors ${step.done ? 'text-slate-500 line-through' : isActive ? 'text-slate-200' : 'text-slate-600'}`}>
                              {step.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleRunRadar}
                        disabled={!canAnalizar}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        {radarData.ultimoAnalisis ? 'Re-analizar' : 'Analizar ahora'}
                      </button>
                      {proximoAnalisisLabel && (
                        <span className="text-xs text-slate-500">Próximo análisis disponible el {proximoAnalisisLabel}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Resultado del análisis */}
              {radarResultado && (
                  <div className="space-y-4">
                    {/* Tu negocio */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="bg-emerald-950/40 border border-emerald-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Tu fortaleza</p>
                        </div>
                        <p className="text-sm text-slate-200 leading-relaxed">{radarResultado.tuFortaleza}</p>
                      </div>
                      <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Tu debilidad</p>
                        </div>
                        <p className="text-sm text-slate-200 leading-relaxed">{radarResultado.tuDebilidad}</p>
                      </div>
                    </div>

                    {/* Competidores */}
                    {radarResultado.competidores && radarResultado.competidores.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-700">
                              <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Competidor</th>
                              <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fortaleza</th>
                              <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Debilidad</th>
                              <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amenaza</th>
                            </tr>
                          </thead>
                          <tbody>
                            {radarResultado.competidores.map((c, i) => (
                              <tr key={i} className="border-b border-slate-800 last:border-0">
                                <td className="py-2.5 pr-4 font-medium text-slate-200">{c.nombre}</td>
                                <td className="py-2.5 pr-4 text-slate-400">{c.fortaleza}</td>
                                <td className="py-2.5 pr-4 text-slate-400">{c.debilidad}</td>
                                <td className="py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    c.amenaza === 'alta' ? 'bg-red-900/50 text-red-300' :
                                    c.amenaza === 'media' ? 'bg-yellow-900/50 text-yellow-300' :
                                    'bg-slate-700 text-slate-400'
                                  }`}>
                                    {c.amenaza}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Oportunidades + Acción */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      {radarResultado.oportunidades && radarResultado.oportunidades.length > 0 && (
                        <div className="bg-blue-950/40 border border-blue-900/50 rounded-xl p-4">
                          <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Oportunidades</p>
                          <ul className="space-y-1">
                            {radarResultado.oportunidades.map((op, i) => (
                              <li key={i} className="text-sm text-slate-200 flex gap-2">
                                <span className="text-blue-500 shrink-0">→</span>
                                {op}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {radarResultado.accion && (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Acción esta semana</p>
                          <p className="text-sm text-slate-200 leading-relaxed">{radarResultado.accion}</p>
                        </div>
                      )}
                    </div>

                    {/* Matriz de sentimiento por categorías */}
                    {radarResultado.categorias && radarResultado.categorias.length > 0 && (
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Sentimiento por categoría</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-700">
                                <th className="text-left pb-2.5 pr-4 text-xs font-semibold text-slate-500">Categoría</th>
                                <th className="text-center pb-2.5 pr-3 text-xs font-semibold text-emerald-500">Tú</th>
                                {radarData?.competidores.map(c => (
                                  <th key={c.id} className="text-center pb-2.5 pr-3 text-xs font-semibold text-slate-500 max-w-[80px] truncate">{c.nombre.split(' ')[0]}</th>
                                ))}
                                <th className="text-left pb-2.5 text-xs font-semibold text-slate-500">Insight</th>
                              </tr>
                            </thead>
                            <tbody>
                              {radarResultado.categorias.map((cat: RadarCategoria, i: number) => (
                                <tr key={i} className="border-b border-slate-800/60 last:border-0">
                                  <td className="py-2.5 pr-4 font-semibold text-slate-200 capitalize">{cat.nombre}</td>
                                  <td className="py-2.5 pr-3 text-center"><ScoreBadge score={cat.yo} /></td>
                                  {cat.rivales.map((r, ri) => (
                                    <td key={ri} className="py-2.5 pr-3 text-center"><ScoreBadge score={r.score} /></td>
                                  ))}
                                  <td className="py-2.5 text-xs text-slate-400 italic leading-snug">{cat.insight}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Acción estratégica Pro */}
                    {radarResultado.accionPro && (
                      <div className="bg-blue-950/50 border border-blue-800/50 rounded-xl p-4 flex items-start gap-3">
                        <div className="shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mt-0.5">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Acción estratégica</p>
                          <p className="text-sm text-slate-200 leading-relaxed">{radarResultado.accionPro}</p>
                        </div>
                      </div>
                    )}
                  </div>
              )}
            </div>
          </>
        )}
      </main>}

      {basicUpsellPlan && (
        <WaitlistModal plan={basicUpsellPlan} onClose={() => setBasicUpsellPlan(null)} />
      )}

      <HelpButton />

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
