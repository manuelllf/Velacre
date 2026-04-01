'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createNegocio, updateNegocio, searchPlaces, syncReviews, getMyNegocio, type PlaceResult } from '@/lib/api'
import { useLanguage } from '@/lib/i18n'

export default function OnboardingPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const ob = t.app.onboarding

  const TONOS = [
    { value: 'Profesional', label: t.app.settings.tonos.Profesional.label, desc: t.app.settings.tonos.Profesional.desc },
    { value: 'Cercano', label: t.app.settings.tonos.Cercano.label, desc: t.app.settings.tonos.Cercano.desc },
    { value: 'Directo', label: t.app.settings.tonos.Directo.label, desc: t.app.settings.tonos.Directo.desc },
  ]

  useEffect(() => {
    getMyNegocio().then(n => { if (n) router.replace('/inicio') }).catch(() => {})
  }, [router])

  const [tono, setTono] = useState('Profesional')
  const [descripcion, setDescripcion] = useState('')
  const [palabrasClave, setPalabrasClave] = useState<string[]>([])
  const [kwInput, setKwInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [doneSteps, setDoneSteps] = useState<number[]>([])

  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([])
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [searchingPlaces, setSearchingPlaces] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const [progress, setProgress] = useState(0)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleQueryChange(value: string) {
    setPlaceQuery(value)

    if (selectedPlace && value !== selectedPlace.name) {
      setSelectedPlace(null)
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim() || value.trim().length < 2) {
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

  function startLoadingUI() {
    let pct = 0
    progressIntervalRef.current = setInterval(() => {
      pct = Math.min(98, pct + (pct < 15 ? 3 : 0.4))
      setProgress(Math.round(pct))
    }, 200)
  }

  function stopLoadingUI() {
    clearInterval(progressIntervalRef.current!)
    setProgress(100)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlace) return
    setError('')
    setLoading(true)
    setDoneSteps([])
    startLoadingUI()

    try {
      setCurrentStep(0)
      await createNegocio({ nombre: selectedPlace.name, tonoPredefinido: tono, descripcion: descripcion || undefined, palabrasClave: palabrasClave.length > 0 ? palabrasClave : undefined })
      setDoneSteps([0])

      setCurrentStep(1)
      await updateNegocio({ placeId: selectedPlace.placeId, nombre: selectedPlace.name })
      setDoneSteps([0, 1])

      setCurrentStep(2)
      await syncReviews()
      setDoneSteps([0, 1, 2])

      stopLoadingUI()
      router.replace('/onboarding/plan')
    } catch (err) {
      stopLoadingUI()
      setError(err instanceof Error ? err.message : t.app.common.error)
      setLoading(false)
      setCurrentStep(-1)
      setDoneSteps([])
    }
  }

  // ── Loading screen ──
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link href="/" className="inline-block text-base font-bold text-slate-900 dark:text-white mb-1">Velacre</Link>
            <p className="text-sm text-slate-500 dark:text-slate-400">{ob.setupLabel}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 mb-4">
            {ob.steps.map((stepLabel, i) => {
              const done = doneSteps.includes(i)
              const active = currentStep === i
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                    done
                      ? 'bg-emerald-100 dark:bg-emerald-900/40'
                      : active
                      ? 'bg-blue-100 dark:bg-blue-900/40'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}>
                    {done ? (
                      <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : active ? (
                      <span className="w-3 h-3 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin block" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 block" />
                    )}
                  </div>
                  <span className={`text-sm font-medium transition-colors duration-300 ${
                    done ? 'text-emerald-700 dark:text-emerald-400' : active ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {stepLabel}
                  </span>
                </div>
              )
            })}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-slate-400 dark:text-slate-500">{ob.progress}</span>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ease-linear ${
                  progress >= 98 ? 'bg-blue-500 animate-pulse' : 'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Link href="/" className="inline-block text-base font-bold text-slate-900 dark:text-white mb-3">Velacre</Link>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{ob.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{ob.subtitle}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Place search */}
            <div ref={searchContainerRef}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {ob.placeLabel} <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                {ob.placeSubtitle}
              </p>

              <div className="relative">
                <input
                  type="text"
                  value={placeQuery}
                  onChange={e => handleQueryChange(e.target.value)}
                  onFocus={() => { if (placeResults.length > 0 && !selectedPlace) setDropdownOpen(true) }}
                  autoComplete="off"
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    selectedPlace
                      ? 'border-emerald-400 dark:border-emerald-700'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                  placeholder={ob.placePlaceholder}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {searchingPlaces ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : selectedPlace ? (
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </div>

                {/* Dropdown */}
                {dropdownOpen && placeResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
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
                        <p className="text-xs text-slate-400">Mostrando 5 de {placeResults.length} — refina la búsqueda</p>
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
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedPlace(null); setPlaceQuery(''); setPlaceResults([]); setDropdownOpen(false) }}
                    className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-200 shrink-0 text-base leading-none"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Tone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5">
                {ob.toneLabel}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TONOS.map(tItem => (
                  <button
                    key={tItem.value}
                    type="button"
                    onClick={() => setTono(tItem.value)}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      tono === tItem.value
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{tItem.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tItem.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {ob.descLabel} <span className="text-slate-400 dark:text-slate-500 font-normal">{ob.descOptional}</span>
              </label>
              <textarea
                rows={2}
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder={ob.descPlaceholder}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{ob.descHint}</p>
            </div>

            {/* Palabras clave SEO */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Palabras clave SEO <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
              </label>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Hasta 5. La IA las incluirá con naturalidad en las respuestas para mejorar tu posicionamiento.</p>
              {palabrasClave.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {palabrasClave.map(kw => (
                    <span key={kw} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full border border-blue-200 dark:border-blue-700">
                      {kw}
                      <button type="button" onClick={() => setPalabrasClave(p => p.filter(k => k !== kw))} className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-100 leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}
              {palabrasClave.length < 5 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={kwInput}
                    onChange={e => setKwInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',') && kwInput.trim()) {
                        e.preventDefault()
                        const kw = kwInput.trim().replace(/,$/, '')
                        if (kw && !palabrasClave.includes(kw)) setPalabrasClave(p => [...p, kw])
                        setKwInput('')
                      }
                    }}
                    placeholder="cocina gallega, marisquería..."
                    className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const kw = kwInput.trim()
                      if (kw && !palabrasClave.includes(kw)) setPalabrasClave(p => [...p, kw])
                      setKwInput('')
                    }}
                    disabled={!kwInput.trim()}
                    className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-xl border border-red-200 dark:border-red-800">{error}</p>
            )}

            <button
              type="submit"
              disabled={!selectedPlace}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ob.submitBtn}
            </button>

            {!selectedPlace && (
              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                {ob.placeSkip}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
