'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { VelacreMark } from './landing/VelacreMark'

export interface AppHeaderProps {
  /** Nombre del negocio, si hay — aparece al lado del wordmark */
  negocioNombre?: string | null
  /** Extra content slot (e.g., info badges) a la derecha antes del logout */
  rightExtra?: React.ReactNode
  /** Dónde apunta el brand link (por defecto /inicio) */
  brandHref?: string
  /** Ocultar botón de logout (para admin o flujos sin sesión) */
  hideLogout?: boolean
}

export function AppHeader({ negocioNombre, rightExtra, brandHref = '/inicio', hideLogout = false }: AppHeaderProps) {
  const router = useRouter()
  const { t } = useLanguage()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <header className="sticky top-0 z-30 bg-slate-900/85 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-6 h-[68px] flex items-center justify-between gap-3">
        <Link href={brandHref} className="flex items-center gap-3 min-w-0 cursor-pointer group">
          <VelacreMark size={36} />
          <span
            className="font-bold text-xl tracking-tight text-slate-200 group-hover:text-white transition-colors"
            style={{ fontFamily: 'CalSansUI, ui-sans-serif' }}
          >
            velacre
          </span>
          {negocioNombre && (
            <span className="hidden sm:inline text-sm text-slate-500 truncate">· {negocioNombre}</span>
          )}
        </Link>
        <div className="flex items-center gap-4 shrink-0">
          {rightExtra}
          {!hideLogout && (
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {t.app.common.logout}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
