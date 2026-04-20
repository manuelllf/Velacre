'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createUsuario, getMyUsuario } from '@/lib/api'
import { useLanguage } from '@/lib/i18n'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState('')
  const { t } = useLanguage()
  const cb = t.app.callback

  useEffect(() => {
    async function handleCallback() {
      try {
        // Con @supabase/ssr (createBrowserClient), el PKCE code se intercambia
        // automáticamente al detectar ?code= en la URL (detectSessionInUrl: true).
        // Solo necesitamos esperar a que la sesión esté lista.
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          // Si no hay sesión, puede que el auto-exchange aún no terminó.
          // Intentamos exchangeCodeForSession como fallback.
          const code = new URLSearchParams(window.location.search).get('code')
          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
            if (exchangeError) throw exchangeError
          }
          const { data: { session: retrySession } } = await supabase.auth.getSession()
          if (!retrySession) {
            router.replace('/auth/login')
            return
          }
        }

        // Intentar obtener perfil existente
        try {
          const u = await getMyUsuario()
          if (u.isAdmin) router.replace('/admin?welcome=1')
          else router.replace('/inicio?welcome=1')
        } catch {
          // Usuario nuevo — crear perfil con nombre de Google si está disponible
          const { data: { session: s } } = await supabase.auth.getSession()
          const fullName =
            s?.user.user_metadata?.full_name ??
            s?.user.user_metadata?.name ??
            ''
          try {
            await createUsuario({ nombre: fullName }, s?.access_token)
          } catch {
            // Si ya existe (carrera) ignoramos el error
          }
          router.replace('/onboarding?welcome=1')
        }
      } catch (err) {
        console.error('[auth/callback]', err)
        setError(cb.error)
      }
    }

    handleCallback()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="text-center space-y-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <a href="/auth/login" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
            {cb.backToLogin}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#E8E2D4' }}>
      {/*
        El spinner + texto "Iniciando sesión" se ocultan a propósito: cuando el
        flujo viene de Google OAuth, armWelcome() arma sessionStorage antes del
        redirect y el WelcomeTransition (global en Providers) cubre esta página
        con el overlay crema. Mostrar un spinner debajo competía visualmente.
        Mantenemos el nodo comentado para recuperarlo si hiciera falta feedback
        de carga en el callback.
      */}
      <div style={{ display: 'none' }}>
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 dark:text-slate-400">{cb.loggingIn}</p>
      </div>
    </div>
  )
}
