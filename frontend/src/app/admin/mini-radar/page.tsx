'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getMyUsuario,
  runMiniRadar,
  ApiError,
  type MiniRadarResult,
} from '@/lib/api'
import { downloadMiniRadarPdf } from '@/lib/mini-radar-pdf'

type Step = 'idle' | 'fetching' | 'analyzing' | 'rendering' | 'done' | 'error'

const STEP_LABELS: Record<Step, string> = {
  idle: '',
  fetching: 'Descargando reseñas de Google...',
  analyzing: 'Analizando con IA...',
  rendering: 'Generando PDF...',
  done: 'Informe listo',
  error: 'Error',
}

export default function MiniRadarPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [placeId, setPlaceId] = useState('')
  const [nombre, setNombre] = useState('')
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

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!placeId.trim()) {
      setError('Introduce un place_id válido de Google')
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

      const res = await runMiniRadar(placeId.trim(), nombre.trim() || undefined)
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
        setError('Error desconocido')
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
    setPlaceId('')
    setNombre('')
    setStep('idle')
    setError(null)
    setResult(null)
    setEmailCopied(false)
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500 dark:text-slate-400 text-sm">Cargando...</div>
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
              Velacre · Admin · Mini Radar
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Genera informes gratis de cualquier negocio de Google para prospección
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            ← Admin
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Formulario */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            Generar informe
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            El informe descargará un PDF con análisis de las últimas 30 reseñas + pitch de email
            personalizado. Coste aproximado: ~€0,03 (Outscraper + Claude).
          </p>

          <form onSubmit={onGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Place ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={placeId}
                onChange={e => setPlaceId(e.target.value)}
                placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
                disabled={busy}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 font-mono text-sm"
              />
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                Cómo obtenerlo: busca el negocio en{' '}
                <a
                  href="https://www.google.com/maps"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline"
                >
                  Google Maps
                </a>
                , copia la URL, y extrae el parámetro <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">0x...:0x...</code> o usa una herramienta como{' '}
                <a
                  href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline"
                >
                  Place ID Finder
                </a>
                .
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Nombre del negocio <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="A Taberna do Bispo"
                disabled={busy}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 text-sm"
              />
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                Se usa en el PDF y en el pitch de Claude. Si lo omites, pondrá &ldquo;el negocio&rdquo;.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={busy || !placeId.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-medium text-sm transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                {busy && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                  </svg>
                )}
                {busy ? 'Generando...' : 'Generar informe'}
              </button>
              {(result || error) && !busy && (
                <button
                  type="button"
                  onClick={reset}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm transition-colors"
                >
                  Nuevo informe
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
              <p className="text-sm text-red-900 dark:text-red-300 font-medium">Error</p>
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
                {result.nombre ?? 'Negocio analizado'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-mono">
                {result.placeId}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <KpiBox label="Rating" value={`${result.stats.ratingAvg.toFixed(2)}`} suffix="/5" />
                <KpiBox label="Reseñas analizadas" value={`${result.stats.total}`} />
                <KpiBox label="Últimos 30 días" value={`${result.stats.ult30d}`} />
                <KpiBox
                  label="% Respondidas"
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
                      Email pitch listo para enviar
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Copiado al portapapeles → pegar en Gmail → enviar. Personalizado por Claude
                      con hallazgos de las reseñas.
                    </p>
                  </div>
                  <button
                    onClick={copyEmail}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    {emailCopied ? '✓ Copiado' : 'Copiar'}
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
                    <span className="text-base">+</span> Lo que más destacan
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
                    <span className="text-base">−</span> Lo que más se quejan
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
                  Quejas críticas sin responder
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

            {/* PDF confirmation */}
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-xl p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-green-900 dark:text-green-300">
                PDF descargado a tu carpeta <code className="bg-green-100 dark:bg-green-900/40 px-1 rounded">Descargas</code>. Si no ha empezado la descarga, revisa los permisos del navegador.
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
  tone = 'default',
}: {
  label: string
  value: string
  suffix?: string
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
    </div>
  )
}
