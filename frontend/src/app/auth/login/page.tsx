'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('El correo o la contraseña no son correctos. Compruébalo e inténtalo de nuevo.')
      setLoading(false)
      return
    }

    router.replace('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Bienvenido de nuevo</h1>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-2">Gestiona las reseñas de tu negocio</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-200 mb-2">
                Correo electrónico
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
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
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
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-base text-slate-500 dark:text-slate-400 mt-6">
          ¿Aún no tienes cuenta?{' '}
          <Link href="/auth/register" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
            Regístrate gratis
          </Link>
        </p>
      </div>
    </div>
  )
}
