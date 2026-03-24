'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createNegocio, updateNegocio, searchPlaces, syncReviews, type PlaceResult } from '@/lib/api'

const TONOS = [
  { value: 'Profesional', label: 'Profesional', desc: 'Formal y cercano a la excelencia' },
  { value: 'Cercano', label: 'Cercano', desc: 'Cálido y humano, como un amigo' },
  { value: 'Directo', label: 'Directo', desc: 'Claro, breve y sin rodeos' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [tono, setTono] = useState('Profesional')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')

  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([])
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [searchingPlaces, setSearchingPlaces] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipSearchRef = useRef(false)

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!placeQuery.trim() || placeQuery.trim().length < 3) {
      setPlaceResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearchingPlaces(true)
      try {
        const results = await searchPlaces(placeQuery.trim())
        setPlaceResults(results)
      } catch {
        setPlaceResults([])
      } finally {
        setSearchingPlaces(false)
      }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [placeQuery])

  function handleSelectPlace(place: PlaceResult) {
    skipSearchRef.current = true
    setSelectedPlace(place)
    setPlaceQuery(place.name)
    setPlaceResults([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlace) return
    setError('')
    setLoading(true)

    try {
      setLoadingStep('Creando tu negocio...')
      await createNegocio({ nombre: selectedPlace.name, tonoPredefinido: tono, descripcion: descripcion || undefined })

      setLoadingStep('Conectando con Google...')
      await updateNegocio({ placeId: selectedPlace.placeId, nombre: selectedPlace.name })

      setLoadingStep('Importando tus reseñas...')
      await syncReviews()

      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los datos. Inténtalo de nuevo.')
      setLoading(false)
      setLoadingStep('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Velacre</h1>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-2">Un último paso: conecta tu negocio de Google.</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Buscador de negocio — obligatorio */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                Busca tu negocio en Google <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Importaremos tu nombre, dirección y reseñas automáticamente.
              </p>

              <div className="relative">
                <input
                  type="text"
                  value={placeQuery}
                  onChange={e => {
                    setPlaceQuery(e.target.value)
                    if (selectedPlace && e.target.value !== selectedPlace.name) setSelectedPlace(null)
                  }}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Bar El Rincón, Hotel Costa, Peluquería Marta..."
                />
                {searchingPlaces && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {placeResults.length > 0 && (
                <ul className="mt-2 border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                  {placeResults.map(place => (
                    <li key={place.placeId}>
                      <button
                        type="button"
                        onClick={() => handleSelectPlace(place)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className="text-base font-medium text-slate-900 dark:text-white">{place.name}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{place.address}</div>
                        {place.rating != null && (
                          <div className="text-sm text-amber-500 mt-0.5">★ {place.rating.toFixed(1)}</div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {selectedPlace && (
                <div className="mt-2 flex items-start gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                  <span className="text-green-600 dark:text-green-400 text-lg mt-0.5">✓</span>
                  <div>
                    <div className="text-base font-medium text-green-800 dark:text-green-200">{selectedPlace.name}</div>
                    <div className="text-sm text-green-700 dark:text-green-300">{selectedPlace.address}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Tono */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">
                ¿Cómo quieres que suenen tus respuestas?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TONOS.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTono(t.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                      tono === t.value
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{t.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Descripción — opcional, mejora las respuestas de Claude */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                Describe tu negocio <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <textarea
                rows={2}
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                placeholder="Restaurante familiar con cocina gallega tradicional, taller mecánico con 20 años de experiencia..."
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">La IA usará esto para personalizar mejor las respuestas</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !selectedPlace}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (loadingStep || 'Guardando...') : 'Empezar a usar Velacre →'}
            </button>

            {!selectedPlace && !loading && (
              <p className="text-center text-sm text-slate-400 dark:text-slate-500">
                Busca y selecciona tu negocio para continuar
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
