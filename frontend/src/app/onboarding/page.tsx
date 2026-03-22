'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createNegocio, updateNegocio, searchPlaces, syncReviews, type PlaceResult } from '@/lib/api'

const TONOS = [
  { value: 'Profesional', label: 'Profesional', desc: 'Formal y cortés' },
  { value: 'Colegueo', label: 'Colegueo', desc: 'Cercano e informal' },
  { value: 'Orgullosa', label: 'Orgullosa', desc: 'Altivo y distinguido' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    nombre: '',
    cif: '',
    email: '',
    telefono: '',
    descripcion: '',
    tonoPredefinido: 'Profesional',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')

  // Google Places search state
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([])
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [searchingPlaces, setSearchingPlaces] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipSearchRef = useRef(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

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

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [placeQuery])

  function handleSelectPlace(place: PlaceResult) {
    skipSearchRef.current = true
    setSelectedPlace(place)
    setPlaceQuery(place.name)
    setPlaceResults([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      setLoadingStep('Guardando tu negocio...')
      const negocio = await createNegocio(form)
      void negocio
      if (selectedPlace) {
        setLoadingStep('Conectando con Google...')
        await updateNegocio({ placeId: selectedPlace.placeId })
        setLoadingStep('Importando tus reseñas...')
        await syncReviews()
      }
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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Velac</h1>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-2">Ya casi estás. Cuéntanos sobre tu negocio.</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 flex items-center gap-2 opacity-40">
              <div className="w-7 h-7 rounded-full bg-green-500 text-white text-sm flex items-center justify-center">✓</div>
              <span className="text-base font-medium text-slate-500 dark:text-slate-400">Tu cuenta</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center font-bold">2</div>
              <span className="text-base font-medium text-slate-900 dark:text-white">Tu negocio</span>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">Cuéntanos sobre tu negocio</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                Nombre de tu negocio <span className="text-red-500">*</span>
              </label>
              <input
                name="nombre"
                type="text"
                required
                value={form.nombre}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Bar El Rincón, Peluquería Marta, Hotel Costa..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                  CIF / NIF del negocio <span className="text-red-500">*</span>
                </label>
                <input
                  name="cif"
                  type="text"
                  required
                  value={form.cif}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="B12345678"
                />
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1.5">Lo usamos para identificar tu negocio de forma única</p>
              </div>
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                  Teléfono
                </label>
                <input
                  name="telefono"
                  type="tel"
                  value={form.telefono}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="981 000 000"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                Email del negocio
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="contacto@minegocio.com"
              />
            </div>

            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                Describe tu negocio
              </label>
              <textarea
                name="descripcion"
                rows={3}
                value={form.descripcion}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                placeholder="Restaurante familiar en el centro, peluquería especializada en coloración, taller mecánico con 20 años de experiencia..."
              />
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1.5">La IA usará esto para personalizar las respuestas a tus reseñas</p>
            </div>

            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                ¿Cómo quieres que suenen tus respuestas?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TONOS.map(tono => (
                  <button
                    key={tono.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tonoPredefinido: tono.value }))}
                    className={`p-3 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                      form.tonoPredefinido === tono.value
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="text-base font-medium text-slate-900 dark:text-white">{tono.label}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{tono.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Google Places search section */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-5">
              <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-1">
                Conecta tu negocio de Google
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Importaremos tus reseñas automáticamente. Puedes hacerlo ahora o más tarde desde Configuración.
              </p>

              <div className="relative">
                <input
                  type="text"
                  value={placeQuery}
                  onChange={e => {
                    setPlaceQuery(e.target.value)
                    if (selectedPlace && e.target.value !== selectedPlace.name) {
                      setSelectedPlace(null)
                    }
                  }}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Escribe el nombre de tu negocio para buscarlo..."
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

              {!selectedPlace && (
                <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
                  También puedes conectarlo más tarde desde Configuración
                </p>
              )}
            </div>

            {error && (
              <p className="text-base text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (loadingStep || 'Guardando...') : 'Empezar a usar Velac →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
