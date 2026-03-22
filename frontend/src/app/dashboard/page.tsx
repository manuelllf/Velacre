'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateResponses, getMyNegocio, type ReviewResponses, type Negocio } from '@/lib/api'
import ResponseCard from '@/components/ResponseCard'

const PLATAFORMAS = ['Google', 'TripAdvisor', 'Booking', 'Otra']

export default function DashboardPage() {
  const router = useRouter()
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [reviewText, setReviewText] = useState('')
  const [plataforma, setPlataforma] = useState('Google')
  const [responses, setResponses] = useState<ReviewResponses | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingInit, setLoadingInit] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/auth/login')
        return
      }
      try {
        const n = await getMyNegocio()
        if (!n) {
          router.replace('/onboarding')
          return
        }
        setNegocio(n)
      } catch {
        router.replace('/auth/login')
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/auth/login')
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewText.trim()) return
    setError('')
    setLoading(true)
    setResponses(null)

    try {
      const result = await generateResponses(reviewText, plataforma)
      setResponses(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar las respuestas.')
    } finally {
      setLoading(false)
    }
  }

  if (loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900">ReviewShield</span>
            {negocio && (
              <>
                <span className="text-slate-300">|</span>
                <span className="text-sm text-slate-600">{negocio.nombre}</span>
              </>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Input de reseña */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Nueva respuesta
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            Pega la reseña de tu cliente y te generamos 3 respuestas para elegir.
          </p>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Reseña del cliente
              </label>
              <textarea
                rows={4}
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                placeholder="Pega aquí la reseña que quieres responder..."
              />
            </div>

            <div className="flex items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Plataforma
                </label>
                <select
                  value={plataforma}
                  onChange={e => setPlataforma(e.target.value)}
                  className="px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  {PLATAFORMAS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || !reviewText.trim()}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generando...
                  </>
                ) : (
                  'Generar respuestas'
                )}
              </button>
            </div>
          </form>

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Respuestas generadas */}
        {responses && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Respuestas generadas</h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                {responses.codigo}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ResponseCard tone="Profesional" text={responses.profesional} color="indigo" />
              <ResponseCard tone="Colegueo" text={responses.colegueo} color="emerald" />
              <ResponseCard tone="Orgullosa" text={responses.orgullosa} color="amber" />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
