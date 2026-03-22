'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createNegocio } from '@/lib/api'

const TONOS = [
  { value: 'Profesional', label: 'Profesional', desc: 'Formal y cortés' },
  { value: 'Colegueo', label: 'Colegueo', desc: 'Cercano e informal' },
  { value: 'Orgullosa', label: 'Orgullosa', desc: 'Con orgullo gallego' },
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await createNegocio(form)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el negocio.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">ReviewShield</h1>
          <p className="text-slate-500 mt-2">Cuéntanos sobre tu negocio</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 flex items-center gap-2 opacity-40">
              <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">✓</div>
              <span className="text-sm font-medium text-slate-500">Tu cuenta</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">2</div>
              <span className="text-sm font-medium text-slate-900">Tu negocio</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nombre del negocio <span className="text-red-500">*</span>
              </label>
              <input
                name="nombre"
                type="text"
                required
                value={form.nombre}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Restaurante O Pazo"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  CIF <span className="text-red-500">*</span>
                </label>
                <input
                  name="cif"
                  type="text"
                  required
                  value={form.cif}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="B12345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Teléfono
                </label>
                <input
                  name="telefono"
                  type="tel"
                  value={form.telefono}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="981 000 000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email del negocio
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="contacto@opazo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Descripción del negocio
                <span className="text-slate-400 font-normal ml-1">(la IA la usará para personalizar respuestas)</span>
              </label>
              <textarea
                name="descripcion"
                rows={3}
                value={form.descripcion}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                placeholder="Restaurante familiar en el centro de Ferrol, especializado en cocina gallega tradicional. Abierto desde 1987..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tono por defecto
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TONOS.map(tono => (
                  <button
                    key={tono.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tonoPredefinido: tono.value }))}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      form.tonoPredefinido === tono.value
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-900">{tono.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{tono.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : 'Empezar a usar ReviewShield'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
