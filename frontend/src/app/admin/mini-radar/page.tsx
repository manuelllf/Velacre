'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getMyUsuario,
  runMiniRadar,
  searchPlaces,
  ApiError,
  type MiniRadarResult,
  type PlaceResult,
} from '@/lib/api'
import { downloadMiniRadarPdf } from '@/lib/mini-radar-pdf'
import { useLanguage } from '@/lib/i18n'

type Step = 'idle' | 'fetching' | 'analyzing' | 'rendering' | 'done' | 'error'

export default function MiniRadarPage() {
  const { t } = useLanguage()
  const mr = t.app.miniRadar

  const STEP_LABELS: Record<Step, string> = {
    idle: '',
    fetching: mr.stepFetching,
    analyzing: mr.stepAnalyzing,
    rendering: mr.stepRendering,
    done: mr.stepDone,
    error: mr.stepError,
  }
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)

  // Buscador de Google Places (mismo patrón que onboarding)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([])
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [searchingPlaces, setSearchingPlaces] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MiniRadarResult | null>(null)
  const [emailCopied, setEmailCopied] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const u = await getMyUsuario()
        if (!u.isAdmin) {
          router.replace('/dashboard')
          return
        }
        setAuthChecked(true)
      } catch {
        router.replace('/dashboard')
      }
    })()
  }, [router])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleQueryChange(value: string) {
    setPlaceQuery(value)
    if (selectedPlace && value !== selectedPlace.name) setSelectedPlace(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 3) {
      setPlaceResults([])
      setDropdownOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearchingPlaces(true)
      try {
        const results = await searchPlaces(value.trim())
        setPlaceResults(results)
        setDropdownOpen(results.length > 0)
      } catch {
        setPlaceResults([])
        setDropdownOpen(false)
      } finally {
        setSearchingPlaces(false)
      }
    }, 300)
  }

  function handleSelectPlace(place: PlaceResult) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearchingPlaces(false)
    setSelectedPlace(place)
    setPlaceQuery(place.name)
    setPlaceResults([])
    setDropdownOpen(false)
  }

  function clearSelection() {
    setSelectedPlace(null)
    setPlaceQuery('')
    setPlaceResults([])
    setDropdownOpen(false)
  }

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlace) {
      setError(mr.selectFirst)
      return
    }
    setError(null)
    setResult(null)
    setEmailCopied(false)
    setStep('fetching')

    try {
      // El backend hace las 2 llamadas (Outscraper + Claude) en una sola request.
      // Simulamos 2 pasos con un setTimeout para UX (el backend es 1 sola request real).
      setTimeout(() => setStep(prev => (prev === 'fetching' ? 'analyzing' : prev)), 2500)

      const res = await runMiniRadar(selectedPlace.placeId, selectedPlace.name)
      setResult(res)
      setStep('rendering')

      await downloadMiniRadarPdf(res)
      setStep('done')
    } catch (err) {
      setStep('error')
      if (err instanceof ApiError) {
        setError(`${err.message} (HTTP ${err.status})`)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(mr.unknownError)
      }
    }
  }

  async function copyEmail() {
    if (!result?.analisis?.emailPitch) return
    try {
      await navigator.clipboard.writeText(result.analisis.emailPitch)
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  function reset() {
    clearSelection()
    setStep('idle')
    setError(null)
    setResult(null)
    setEmailCopied(false)
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500 dark:text-slate-400 text-sm">{mr.loading}</div>
      </div>
    )
  }

  const busy = step === 'fetching' || step === 'analyzing' || step === 'rendering'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              {mr.headerTitle}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {mr.headerSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {mr.backAdmin}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Formulario */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            {mr.generateReport}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            {mr.reportDesc}
          </p>

          <form onSubmit={onGenerate} className="space-y-4">
            <div ref={searchContainerRef}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {mr.searchLabel} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={placeQuery}
                  onChange={e => handleQueryChange(e.target.value)}
                  onFocus={() => { if (placeResults.length > 0 && !selectedPlace) setDropdownOpen(true) }}
                  autoComplete="off"
                  disabled={busy}
                  placeholder={mr.searchPlaceholder}
                  className={`w-full px-3 py-2.5 pr-10 border rounded-lg text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 transition-colors ${
                    selectedPlace
                      ? 'border-emerald-400 dark:border-emerald-700'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {searchingPlaces ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : selectedPlace ? (
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
                    </svg>
                  )}
                </div>

                {dropdownOpen && placeResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xl">
                    <ul className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {placeResults.slice(0, 5).map(place => (
                        <li key={place.placeId}>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); handleSelectPlace(place) }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <div className="text-sm font-medium text-slate-900 dark:text-white">{place.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{place.address}</div>
                            {place.rating != null && (
                              <div className="text-xs text-amber-500 mt-0.5">★ {place.rating.toFixed(1)}</div>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {placeResults.length > 5 && (
                      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-xs text-slate-400">{mr.showingNofM.replace('{total}', String(placeResults.length))}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedPlace && (
                <div className="mt-2 flex items-start gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200 truncate">{selectedPlace.name}</div>
                    <div className="text-xs text-emerald-700/70 dark:text-emerald-300/70 truncate">{selectedPlace.address}</div>
                    <div className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60 font-mono mt-0.5 truncate">{selectedPlace.placeId}</div>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={busy}
                    className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-200 shrink-0 text-base leading-none disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              )}

              {!selectedPlace && (
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1.5">
                  {mr.searchHint}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={busy || !selectedPlace}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-medium text-sm transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                {busy && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                  </svg>
                )}
                {busy ? mr.generating : mr.generateBtn}
              </button>
              {(result || error) && !busy && (
                <button
                  type="button"
                  onClick={reset}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm transition-colors"
                >
                  {mr.newReport}
                </button>
              )}
            </div>
          </form>

          {/* Step progress */}
          {busy && (
            <div className="mt-5 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-300">{STEP_LABELS[step]}</p>
            </div>
          )}

          {error && (
            <div className="mt-5 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg">
              <p className="text-sm text-red-900 dark:text-red-300 font-medium">{mr.errorTitle}</p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
            </div>
          )}
        </section>

        {/* Resultado */}
        {result && step === 'done' && (
          <section className="mt-6 space-y-5">
            {/* Resumen + stats */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                {result.nombre ?? mr.analyzedBusiness}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-mono">
                {result.placeId}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                <KpiBox label={mr.ratingLabel} value={`${result.stats.ratingAvg.toFixed(2)}`} suffix="/5" />
                <KpiBox
                  label={mr.reviewsAnalyzed}
                  value={`${result.stats.total}`}
                  subtitle={`del ${new Date(result.stats.fechaDesde).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} al ${new Date(result.stats.fechaHasta).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                />
                <KpiBox
                  label={mr.pctResponded}
                  value={`${result.stats.pctRespondidas}%`}
                  tone={
                    result.stats.pctRespondidas < 40
                      ? 'red'
                      : result.stats.pctRespondidas < 70
                      ? 'amber'
                      : 'green'
                  }
                />
              </div>

              {result.analisis?.resumen && (
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {result.analisis.resumen}
                </p>
              )}
            </div>

            {/* Email pitch */}
            {result.analisis?.emailPitch && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {mr.emailPitchTitle}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {mr.emailPitchDesc}
                    </p>
                  </div>
                  <button
                    onClick={copyEmail}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    {emailCopied ? mr.copied : mr.copy}
                  </button>
                </div>
                <pre className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg whitespace-pre-wrap font-sans leading-relaxed border border-slate-200 dark:border-slate-700">
                  {result.analisis.emailPitch}
                </pre>
              </div>
            )}

            {/* Fortalezas y debilidades */}
            {result.analisis && (
              <div className="grid md:grid-cols-2 gap-5">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                    <span className="text-base">+</span> {mr.strengthsTitle}
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                    {(result.analisis.fortalezas ?? []).map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-green-600 dark:text-green-500">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                    <span className="text-base">−</span> {mr.weaknessesTitle}
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                    {(result.analisis.debilidades ?? []).map((d, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-red-600 dark:text-red-500">•</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Quejas sin responder */}
            {result.peoresSinResponder.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
                  {mr.complaintsTitle}
                </h3>
                <div className="space-y-3">
                  {result.peoresSinResponder.map((r, i) => (
                    <div
                      key={i}
                      className="border-l-4 border-red-500 bg-red-50/50 dark:bg-red-950/20 pl-4 py-2 pr-3 rounded-r"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {r.autor}{' '}
                          <span className="text-red-600 dark:text-red-400 ml-1">
                            {r.rating}★
                          </span>
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(r.fecha).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                        &ldquo;{r.texto}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Oportunidad detectada por IA */}
            {result.analisis?.oportunidad && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 p-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
                  Oportunidad detectada: {result.analisis.oportunidad.titulo}
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                  {result.analisis.oportunidad.descripcion}
                </p>
                {result.analisis.oportunidad.ejemplos && result.analisis.oportunidad.ejemplos.length > 0 && (
                  <>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                      Ejemplos de esta semana:
                    </h4>
                    <ul className="space-y-2">
                      {result.analisis.oportunidad.ejemplos.map((ej, i) => (
                        <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <span className="text-indigo-500 dark:text-indigo-400 shrink-0">*</span>
                          <span>{ej}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* PDF confirmation */}
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-xl p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-green-900 dark:text-green-300">
                {mr.pdfDownloaded} {mr.pdfDownloadHint}
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

// ─── Helpers UI ──────────────────────────────────────────────────────────────

function KpiBox({
  label,
  value,
  suffix,
  subtitle,
  tone = 'default',
}: {
  label: string
  value: string
  suffix?: string
  subtitle?: string
  tone?: 'default' | 'red' | 'amber' | 'green'
}) {
  const colorMap = {
    default: 'text-slate-900 dark:text-white',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    green: 'text-green-600 dark:text-green-400',
  }
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${colorMap[tone]}`}>
        {value}
        {suffix && <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-0.5">{suffix}</span>}
      </p>
      {subtitle && (
        <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}
