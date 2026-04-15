'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createNegocio, updateNegocio, searchPlaces, syncReviews, getMyNegocio,
  getGbpAuthUrl, getGbpLocations, finalizeGbpConnection,
  type PlaceResult, type GbpLocation,
} from '@/lib/api'
import { useLanguage } from '@/lib/i18n'

type ConnectionMethod = 'none' | 'manual' | 'google'
type GbpCallbackState = 'none' | 'connected' | 'select' | 'error'

export default function OnboardingPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const ob = t.app.onboarding
  const op = t.app.onboardingPage

  const TONOS = [
    { value: 'Profesional',  label: t.app.settings.tonos.Profesional.label,  desc: t.app.settings.tonos.Profesional.desc  },
    { value: 'Empatico',     label: t.app.settings.tonos.Empatico.label,     desc: t.app.settings.tonos.Empatico.desc     },
    { value: 'Cercano',      label: t.app.settings.tonos.Cercano.label,      desc: t.app.settings.tonos.Cercano.desc      },
    { value: 'Directo',      label: t.app.settings.tonos.Directo.label,      desc: t.app.settings.tonos.Directo.desc      },
    { value: 'Agradecido',   label: t.app.settings.tonos.Agradecido.label,   desc: t.app.settings.tonos.Agradecido.desc   },
    { value: 'Humoristico',  label: t.app.settings.tonos.Humoristico.label,  desc: t.app.settings.tonos.Humoristico.desc  },
  ]

  // ── Business info ──
  const [tono,         setTono]         = useState('Profesional')
  const [descripcion,  setDescripcion]  = useState('')
  const [palabrasClave, setPalabrasClave] = useState<string[]>([])
  const [kwInput,      setKwInput]      = useState('')
  const [nombreGbp,    setNombreGbp]    = useState('')   // nombre para cuando el usuario elige GBP

  // ── Connection method ──
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>('none')

  // ── Manual place search ──
  const [placeQuery,      setPlaceQuery]      = useState('')
  const [placeResults,    setPlaceResults]    = useState<PlaceResult[]>([])
  const [selectedPlace,   setSelectedPlace]   = useState<PlaceResult | null>(null)
  const [searchingPlaces, setSearchingPlaces] = useState(false)
  const [dropdownOpen,    setDropdownOpen]    = useState(false)
  const debounceRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // ── GBP OAuth callback state ──
  const [gbpCallbackState, setGbpCallbackState] = useState<GbpCallbackState>('none')
  const [gbpLocations,     setGbpLocations]     = useState<GbpLocation[]>([])
  const [selectedLocation, setSelectedLocation] = useState<GbpLocation | null>(null)
  const [loadingGbp,       setLoadingGbp]       = useState(false)
  const [gbpErrMsg,        setGbpErrMsg]        = useState<string | null>(null)

  // ── General ──
  const [error,    setError]   = useState('')
  const [loading,  setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [doneSteps,   setDoneSteps]   = useState<number[]>([])
  const [progress,    setProgress]    = useState(0)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Read GBP callback params from URL ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gbp    = params.get('gbp')
    const msg    = params.get('msg')

    if (gbp === 'connected') {
      // Sync + connection ya hechos por el backend, navegar al plan
      setGbpCallbackState('connected')
      setTimeout(() => router.replace('/onboarding/plan'), 1800)
      return
    }

    if (gbp === 'select') {
      // Múltiples locales: cargar lista para que el usuario elija
      setGbpCallbackState('select')
      setConnectionMethod('google')
      setLoadingGbp(true)
      getGbpLocations()
        .then(locs => { setGbpLocations(locs); setLoadingGbp(false) })
        .catch(() => { setGbpErrMsg(op.loadLocalesError); setLoadingGbp(false) })
      return
    }

    if (gbp === 'error') {
      setGbpCallbackState('error')
      setGbpErrMsg(
        msg === 'access_denied'   ? op.oauthAccessDenied :
        msg === 'no_locations'    ? op.oauthNoLocations :
        msg === 'state_invalid'   ? op.oauthStateInvalid :
        op.oauthGenericError
      )
      return
    }

    // Flujo normal: si ya tiene negocio, redirigir al inicio
    getMyNegocio().then(n => { if (n) router.replace('/inicio') }).catch(() => {})
  }, [router])

  // ── Close dropdown on outside click ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Place search handlers ──
  function handleQueryChange(value: string) {
    setPlaceQuery(value)
    if (selectedPlace && value !== selectedPlace.name) setSelectedPlace(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim() || value.trim().length < 2) { setPlaceResults([]); setDropdownOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearchingPlaces(true)
      try {
        const results = await searchPlaces(value.trim())
        setPlaceResults(results)
        setDropdownOpen(results.length > 0)
      } catch { setPlaceResults([]); setDropdownOpen(false) }
      finally { setSearchingPlaces(false) }
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

  // ── Progress bar ──
  function startLoadingUI() {
    let pct = 0
    progressIntervalRef.current = setInterval(() => {
      pct = Math.min(98, pct + (pct < 15 ? 3 : 0.4))
      setProgress(Math.round(pct))
    }, 200)
  }
  function stopLoadingUI() { clearInterval(progressIntervalRef.current!); setProgress(100) }

  // ── Submit: manual path ──
  async function handleSubmitManual(e: React.FormEvent) {
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

  // ── Submit: Google Business path ──
  async function handleConnectGbp() {
    if (!nombreGbp.trim()) { setError(op.writeBusinessName); return }
    setError('')
    setLoading(true)
    try {
      // 1. Crear negocio primero (sin placeId)
      const negocio = await createNegocio({
        nombre: nombreGbp.trim(),
        tonoPredefinido: tono,
        descripcion: descripcion || undefined,
        palabrasClave: palabrasClave.length > 0 ? palabrasClave : undefined,
      })
      // 2. Obtener URL OAuth y redirigir
      const url = await getGbpAuthUrl(negocio.id, 'onboarding')
      window.location.href = url
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : t.app.common.error)
    }
  }

  // ── Finalizar selección de local GBP ──
  async function handleFinalizeLocation() {
    if (!selectedLocation) return
    setLoadingGbp(true)
    setGbpErrMsg(null)
    try {
      await finalizeGbpConnection(selectedLocation.locationName, selectedLocation.displayName)
      router.replace('/onboarding/plan')
    } catch {
      setGbpErrMsg(op.finalizeError)
      setLoadingGbp(false)
    }
  }

  // ── Loading screen (manual path) ──
  if (loading && connectionMethod !== 'google') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">{ob.setupLabel}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 mb-4">
            {ob.steps.map((stepLabel: string, i: number) => {
              const done   = doneSteps.includes(i)
              const active = currentStep === i
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${done ? 'bg-emerald-100 dark:bg-emerald-900/40' : active ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    {done ? (
                      <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    ) : active ? (
                      <span className="w-3 h-3 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin block" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 block" />
                    )}
                  </div>
                  <span className={`text-sm font-medium transition-colors duration-300 ${done ? 'text-emerald-700 dark:text-emerald-400' : active ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{stepLabel}</span>
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
              <div className={`h-full rounded-full transition-all duration-200 ease-linear ${progress >= 98 ? 'bg-blue-500 animate-pulse' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── GBP callback: conectado con éxito ──
  if (gbpCallbackState === 'connected') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">{op.googleConnected}</h2>
          <p className="text-slate-400 text-sm">{op.importingReviews}</p>
          <div className="mt-4 flex justify-center"><div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>
        </div>
      </div>
    )
  }

  // ── GBP callback: seleccionar local ──
  if (gbpCallbackState === 'select') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-white"><Link href="/" className="hover:opacity-80 transition-opacity">{op.selectYourLocal}</Link></h1>
            <p className="text-sm text-slate-400 mt-1">{op.multipleLocalsFound}</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            {loadingGbp ? (
              <div className="flex items-center justify-center py-8 gap-3 text-slate-400">
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                {op.loadingLocals}
              </div>
            ) : gbpErrMsg ? (
              <div className="text-center py-6">
                <p className="text-red-400 text-sm mb-4">{gbpErrMsg}</p>
                <button onClick={() => { setGbpCallbackState('none'); setConnectionMethod('none'); setGbpErrMsg(null) }} className="text-sm text-blue-400 hover:text-blue-300 underline">{op.backToOnboarding}</button>
              </div>
            ) : (
              <div className="space-y-3">
                {gbpLocations.map(loc => (
                  <button
                    key={loc.locationName}
                    onClick={() => setSelectedLocation(loc)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors ${
                      selectedLocation?.locationName === loc.locationName
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                        selectedLocation?.locationName === loc.locationName
                          ? 'border-blue-400 bg-blue-400'
                          : 'border-slate-500'
                      }`} />
                      <div>
                        <p className="text-white text-sm font-medium">{loc.displayName}</p>
                        <p className="text-slate-500 text-xs mt-0.5 truncate">{loc.locationName}</p>
                      </div>
                    </div>
                  </button>
                ))}
                <button
                  onClick={handleFinalizeLocation}
                  disabled={!selectedLocation || loadingGbp}
                  className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {loadingGbp ? op.connecting : op.connectThisLocal}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario principal ──
  const canSubmitManual  = connectionMethod === 'manual' && selectedPlace != null
  const canConnectGoogle = connectionMethod === 'google' && nombreGbp.trim().length > 0

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12 relative">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white"><Link href="/" className="hover:opacity-80 transition-opacity">{ob.title}</Link></h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{ob.subtitle}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="space-y-5">

            {/* Error de callback GBP */}
            {gbpCallbackState === 'error' && gbpErrMsg && (
              <div className="p-3 bg-amber-900/30 border border-amber-700/50 rounded-xl text-amber-300 text-sm">
                ⚠️ {gbpErrMsg}
              </div>
            )}

            {/* Tono */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5">{ob.toneLabel}</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TONOS.map(tItem => (
                  <button key={tItem.value} type="button" onClick={() => setTono(tItem.value)}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${tono === tItem.value ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{tItem.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tItem.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {ob.descLabel} <span className="text-slate-400 dark:text-slate-500 font-normal">{ob.descOptional}</span>
              </label>
              <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder={ob.descPlaceholder} />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{ob.descHint}</p>
            </div>

            {/* Palabras clave SEO */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {op.seoLabel} <span className="text-slate-400 dark:text-slate-500 font-normal">{op.seoOptional}</span>
              </label>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{op.seoHint}</p>
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
                  <input type="text" value={kwInput} onChange={e => setKwInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',') && kwInput.trim()) {
                        e.preventDefault()
                        const kw = kwInput.trim().replace(/,$/, '')
                        if (kw && !palabrasClave.includes(kw)) setPalabrasClave(p => [...p, kw])
                        setKwInput('')
                      }
                    }}
                    placeholder={op.seoPlaceholder}
                    className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button type="button" onClick={() => { const kw = kwInput.trim(); if (kw && !palabrasClave.includes(kw)) setPalabrasClave(p => [...p, kw]); setKwInput('') }}
                    disabled={!kwInput.trim()}
                    className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">+</button>
                </div>
              )}
            </div>

            {/* ── Conecta tu local ── */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {ob.placeLabel} <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{op.chooseConnection}</p>

              {/* Selector método — solo si no hay método elegido (o si fue error de GBP) */}
              {connectionMethod === 'none' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* GBP — Próximamente */}
                  <div className="flex flex-col items-start gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed select-none text-left">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg viewBox="0 0 24 24" className="w-4 h-4">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{op.googleBusiness}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{op.googleBusinessDesc}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">{op.comingSoon}</span>
                  </div>

                  {/* Manual */}
                  <button type="button" onClick={() => setConnectionMethod('manual')}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-colors text-left">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{op.manualSearch}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{op.manualSearchDesc}</p>
                  </button>
                </div>
              )}

              {/* Método elegido: cabecera con opción de cambiar */}
              {connectionMethod !== 'none' && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {connectionMethod === 'google' ? op.googleBusinessLabel : op.manualLabel}
                  </span>
                  <button type="button" onClick={() => { setConnectionMethod('none'); setSelectedPlace(null); setPlaceQuery(''); setNombreGbp('') }}
                    className="text-xs text-blue-500 hover:text-blue-400 underline">{op.change}</button>
                </div>
              )}

              {/* Ruta Google Business */}
              {connectionMethod === 'google' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">{op.businessNameLabel}</label>
                    <input type="text" value={nombreGbp} onChange={e => setNombreGbp(e.target.value)}
                      placeholder={op.businessNamePlaceholder}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="p-3 bg-amber-900/20 border border-amber-700/30 rounded-xl text-amber-300/80 text-xs">
                    <strong>{op.googlePermissionNote.split(':')[0]}:</strong> {op.googlePermissionNote.split(': ').slice(1).join(': ')}
                  </div>
                </div>
              )}

              {/* Ruta manual: buscador de lugares */}
              {connectionMethod === 'manual' && (
                <div ref={searchContainerRef}>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">{ob.placeSubtitle}</p>
                  <div className="relative">
                    <input type="text" value={placeQuery} onChange={e => handleQueryChange(e.target.value)}
                      onFocus={() => { if (placeResults.length > 0 && !selectedPlace) setDropdownOpen(true) }}
                      autoComplete="off"
                      className={`w-full px-3 py-2.5 border rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${selectedPlace ? 'border-emerald-400 dark:border-emerald-700' : 'border-slate-200 dark:border-slate-700'}`}
                      placeholder={ob.placePlaceholder}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {searchingPlaces ? (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      ) : selectedPlace ? (
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      ) : null}
                    </div>
                    {dropdownOpen && placeResults.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {placeResults.slice(0, 5).map(place => (
                            <li key={place.placeId}>
                              <button type="button" onMouseDown={e => { e.preventDefault(); handleSelectPlace(place) }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <div className="text-sm font-medium text-slate-900 dark:text-white">{place.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{place.address}</div>
                                {place.rating != null && <div className="text-xs text-amber-500 mt-0.5">★ {place.rating.toFixed(1)}</div>}
                              </button>
                            </li>
                          ))}
                        </ul>
                        {placeResults.length > 5 && (
                          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-xs text-slate-400">{op.showingNofM.replace('{total}', String(placeResults.length))}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {selectedPlace && (
                    <div className="mt-2 flex items-start gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200 truncate">{selectedPlace.name}</div>
                        <div className="text-xs text-emerald-700/70 dark:text-emerald-300/70 truncate">{selectedPlace.address}</div>
                      </div>
                      <button type="button" onClick={() => { setSelectedPlace(null); setPlaceQuery(''); setPlaceResults([]); setDropdownOpen(false) }}
                        className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-200 shrink-0 text-base leading-none">×</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-xl border border-red-200 dark:border-red-800">{error}</p>
            )}

            {/* Botón submit */}
            {connectionMethod === 'manual' && (
              <button type="button" onClick={e => handleSubmitManual(e as unknown as React.FormEvent)}
                disabled={!canSubmitManual}
                className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {ob.submitBtn}
              </button>
            )}

            {connectionMethod === 'google' && (
              <button type="button" onClick={handleConnectGbp}
                disabled={!canConnectGoogle || loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{op.connecting}</>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="w-4 h-4">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#ffffff"/>
                    </svg>
                    {op.connectGoogleBusiness}
                  </>
                )}
              </button>
            )}

            {connectionMethod === 'none' && (
              <p className="text-center text-xs text-slate-400 dark:text-slate-500">{ob.placeSkip}</p>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
