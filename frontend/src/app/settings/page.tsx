'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMyNegocio, updateNegocio, getMyUsuario, updateUsuario, searchPlaces, syncReviews, type Negocio, type PlaceResult } from '@/lib/api'

const TONOS = [
  { value: 'Profesional', label: 'Profesional', desc: 'Formal y cortés' },
  { value: 'Colegueo', label: 'Colegueo', desc: 'Cercano e informal' },
  { value: 'Orgullosa', label: 'Orgullosa', desc: 'Altivo y distinguido' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [nombre, setNombre] = useState('')
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    descripcion: '',
    tonopredefinido: 'Profesional',
  })

  // Google Places search
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([])
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [searchingPlaces, setSearchingPlaces] = useState(false)
  const [savingPlace, setSavingPlace] = useState(false)
  const [placeSaved, setPlaceSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/login'); return }
      try {
        const [u, n] = await Promise.all([getMyUsuario(), getMyNegocio()])
        setNombre(u.nombre ?? '')
        if (n) {
          setNegocio(n)
          setForm({
            nombre: n.nombre ?? '',
            email: n.email ?? '',
            telefono: n.telefono ?? '',
            descripcion: n.descripcion ?? '',
            tonopredefinido: n.tonopredefinido ?? 'Profesional',
          })
        }
      } catch {
        setError('No se pudieron cargar los datos.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  useEffect(() => {
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
    setSelectedPlace(place)
    setPlaceQuery(place.name)
    setPlaceResults([])
  }

  async function handleSavePlace() {
    if (!selectedPlace) return
    setSavingPlace(true)
    try {
      await updateNegocio({ placeId: selectedPlace.placeId })
      setNegocio(prev => prev ? { ...prev, placeId: selectedPlace.placeId } : prev)
      // Auto-sync reviews when connecting Google for the first time
      await syncReviews()
      setPlaceSaved(true)
      setSelectedPlace(null)
      setPlaceQuery('')
      setTimeout(() => setPlaceSaved(false), 3000)
    } catch {
      setError('No se pudo guardar la conexión con Google.')
    } finally {
      setSavingPlace(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await Promise.all([
        updateUsuario({ nombre }),
        updateNegocio({
          nombre: form.nombre,
          email: form.email,
          telefono: form.telefono,
          descripcion: form.descripcion,
          tonoPredefinido: form.tonopredefinido,
        }),
      ])
      setNegocio(prev => prev ? { ...prev, nombre: form.nombre } : prev)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <Link href="/dashboard" className="font-bold text-lg text-slate-900 dark:text-white">Velac</Link>
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
                Configuración
              </span>
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

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Google Business */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Negocio en Google</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            Conecta tu negocio de Google Maps para que importemos tus reseñas automáticamente cada día.
          </p>

          {negocio?.placeId && !selectedPlace && !placeSaved && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">Negocio conectado con Google</span>
            </div>
          )}

          {placeSaved && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">Conexión guardada correctamente</span>
            </div>
          )}

          <div className="relative">
            <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
              {negocio?.placeId ? 'Cambiar negocio conectado' : 'Busca tu negocio en Google'}
            </label>
            <input
              type="text"
              value={placeQuery}
              onChange={e => { setPlaceQuery(e.target.value); setSelectedPlace(null) }}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
              placeholder="Escribe el nombre de tu negocio para buscarlo..."
            />
            {searchingPlaces && (
              <div className="absolute right-4 top-11 w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            )}
            {placeResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
                {placeResults.map(place => (
                  <button
                    key={place.placeId}
                    type="button"
                    onClick={() => handleSelectPlace(place)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                  >
                    <div className="text-base font-medium text-slate-900 dark:text-white">{place.name}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{place.address}</span>
                      {place.rating && <span className="text-amber-500">★ {place.rating}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPlace && (
            <div className="mt-3 flex items-center justify-between px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
              <div>
                <p className="text-base font-medium text-slate-900 dark:text-white">{selectedPlace.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedPlace.address}</p>
              </div>
              <button
                type="button"
                onClick={handleSavePlace}
                disabled={savingPlace}
                className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-2"
              >
                {savingPlace ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...</>
                ) : 'Conectar'}
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Tu cuenta */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">Tus datos personales</h2>
            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">Tu nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="María, Carlos, Ana..."
              />
            </div>
          </div>

          {/* Tu negocio */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">Datos de tu negocio</h2>
            <div className="space-y-4">
              {negocio?.cif && (
                <div>
                  <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">CIF / NIF del negocio</label>
                  <p className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base text-slate-500 dark:text-slate-400">{negocio.cif}</p>
                </div>
              )}
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">Nombre del negocio</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="contacto@negocio.com"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">Teléfono</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="981 000 000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                  Descripción de tu negocio
                </label>
                <textarea
                  rows={3}
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Describe brevemente tu negocio: qué ofreces, dónde estás, qué te hace especial..."
                />
              </div>
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-1">Tono de las respuestas</label>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-3">El tono se usará para generar las respuestas automáticas. Puedes cambiarlo cuando quieras.</p>
                <div className="grid grid-cols-3 gap-2">
                  {TONOS.map(tono => (
                    <button
                      key={tono.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, tonopredefinido: tono.value }))}
                      className={`p-3 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                        form.tonopredefinido === tono.value
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
            </div>
          </div>

          {error && (
            <p className="text-base text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...</>
            ) : saved ? (
              <>✓ Cambios guardados</>
            ) : (
              'Guardar cambios'
            )}
          </button>
        </form>
      </main>
    </div>
  )
}
