'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createUsuario, getMyUsuario } from '@/lib/api'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    async function handleCallback() {
      try {
        // Intercambiar el code de OAuth (flujo PKCE) por una sesión
        const code = new URLSearchParams(window.location.search).get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.replace('/auth/login')
          return
        }

        // Intentar obtener perfil existente
        try {
          const u = await getMyUsuario()
          router.replace(u.isAdmin ? '/admin' : '/dashboard')
        } catch {
          // Usuario nuevo — crear perfil con nombre de Google si está disponible
          const fullName =
            session.user.user_metadata?.full_name ??
            session.user.user_metadata?.name ??
            ''
          try {
            await createUsuario({ nombre: fullName }, session.access_token)
          } catch {
            // Si ya existe (carrera) ignoramos el error
          }
          router.replace('/onboarding/plan')
        }
      } catch (err) {
        console.error('[auth/callback]', err)
        setError('Error al iniciar sesión. Por favor, inténtalo de nuevo.')
      }
    }

    handleCallback()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="text-center space-y-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <a href="/auth/login" className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm">
            Volver al inicio de sesión
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Iniciando sesión...</p>
      </div>
    </div>
  )
}
