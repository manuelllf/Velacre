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

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    try {
      await createUsuario({ nombre }, signUpData.session?.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el perfil. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    router.replace('/onboarding')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">ReviewShield</h1>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-2">Crea tu cuenta — es gratis</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center font-bold">1</div>
              <span className="text-base font-medium text-slate-900 dark:text-white">Tu cuenta</span>
            </div>
            <div className="flex-1 flex items-center gap-2 opacity-40">
              <div className="w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-600 text-white text-sm flex items-center justify-center font-bold">2</div>
              <span className="text-base font-medium text-slate-500 dark:text-slate-400">Tu negocio</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                Tu nombre
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Manuel"
              />
            </div>

            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="tu@negocio.com"
              />
            </div>

            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            {error && (
              <p className="text-base text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando cuenta...' : 'Continuar'}
            </button>
          </form>
        </div>

        <p className="text-center text-base text-slate-500 dark:text-slate-400 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
            Entra aquí
          </Link>
        </p>
      </div>
    </div>
  )
}
