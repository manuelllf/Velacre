'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { createUsuario } from '@/lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    try {
      await createUsuario({ nombre })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el perfil. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    router.replace('/onboarding')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">ReviewShield</h1>
          <p className="text-slate-500 mt-2">Crea tu cuenta — es gratis</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</div>
              <span className="text-sm font-medium text-slate-900">Tu cuenta</span>
            </div>
            <div className="flex-1 flex items-center gap-2 opacity-40">
              <div className="w-6 h-6 rounded-full bg-slate-300 text-white text-xs flex items-center justify-center font-bold">2</div>
              <span className="text-sm font-medium text-slate-500">Tu negocio</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tu nombre
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Manuel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="tu@negocio.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando cuenta...' : 'Continuar'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" className="text-indigo-600 font-medium hover:underline">
            Entra aquí
          </Link>
        </p>
      </div>
    </div>
  )
}
