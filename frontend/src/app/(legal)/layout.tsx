import type { ReactNode } from 'react'
import { isAuthenticatedSSR } from '@/lib/auth-ssr'
import { PublicShell } from '@/components/PublicShell'

/**
 * Layout para páginas legales (privacidad, términos, contacto).
 * Si el usuario está autenticado invertimos la paleta del PublicShell (navy papel / crema tinta)
 * para que no haya un cambio cromático violento al venir de la app (siempre dark).
 * La detección es server-side vía cookies de Supabase → sin flash en PC / móvil / PWA.
 */
export default async function LegalLayout({ children }: { children: ReactNode }) {
  const authed = await isAuthenticatedSSR()

  return <PublicShell authed={authed}>{children}</PublicShell>
}
