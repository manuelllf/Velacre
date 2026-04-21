import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Detecta si hay usuario autenticado leyendo las cookies de Supabase server-side.
 * Uso: server components / layouts / route handlers. No llamar desde client components.
 * No refresca la sesión — solo comprueba; para flows que requieren refresh usar proxy.ts.
 */
export async function isAuthenticatedSSR(): Promise<boolean> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // setAll no-op: en un server component no podemos mutar cookies de la respuesta.
        // El refresh de sesión lo hace proxy.ts en rutas protegidas.
        setAll: () => {},
      },
    },
  )

  try {
    const { data } = await supabase.auth.getUser()
    return data.user != null
  } catch {
    return false
  }
}
