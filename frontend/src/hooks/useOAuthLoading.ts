'use client'

import { useEffect, useState } from 'react'

/**
 * Estado de carga para flujos OAuth que redirigen fuera de la app.
 *
 * Cuando el usuario pulsa 'Entrar con Google':
 * 1. setLoading(true)
 * 2. supabase.auth.signInWithOAuth redirige a Google
 * 3. Si el usuario vuelve atrás (back browser), la página se restaura
 *    desde bfcache con el estado estancado en loading=true → botón
 *    parece colgado para siempre.
 *
 * Este hook reinicia el estado automáticamente cuando:
 * - El pageshow se dispara con event.persisted=true (bfcache restore)
 * - La pestaña vuelve a estar visible tras un cambio de visibilidad
 */
export function useOAuthLoading(): [boolean, (v: boolean) => void] {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLoading(false)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setLoading(false)
    }
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return [loading, setLoading]
}
