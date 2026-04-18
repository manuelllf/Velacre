'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { VelacreMark } from './landing/VelacreMark'

export type PlanKey = 'basic' | 'core' | 'pro'

export interface AppHeaderProps {
  /** Nombre del negocio, si hay — aparece al lado del wordmark */
  negocioNombre?: string | null
  /** Plan actual — pinta el badge */
  plan?: PlanKey | null
  /** Extra content slot (badges, acciones) a la derecha antes del logout */
  rightExtra?: React.ReactNode
  /** Dónde apunta el brand link (por defecto /inicio) */
  brandHref?: string
  /** Ocultar botón de logout (para admin o flujos sin sesión) */
  hideLogout?: boolean
}

const PLAN_STYLES: Record<PlanKey, string> = {
  basic: 'border border-slate-700 text-slate-400 bg-slate-800/40',
  core:  'border border-slate-600 text-slate-200 bg-slate-800/60',
  pro:   'border border-blue-600 text-blue-400 bg-blue-950/40',
}

const HEADER_STYLE: React.CSSProperties = {
  background: 'rgba(10, 14, 26, 0.96)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  borderBottom: '1px solid rgba(232, 226, 212, 0.12)',
}

export function AppHeader({ negocioNombre, plan, rightExtra, brandHref = '/inicio', hideLogout = false }: AppHeaderProps) {
  const router = useRouter()
  const { t } = useLanguage()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  const planLabel = plan === 'pro' ? t.app.inicioPage.planPro : plan === 'core' ? t.app.inicioPage.planCore : plan === 'basic' ? t.app.inicioPage.planBasic : null

  return (
    <header className="sticky top-0 z-30" style={HEADER_STYLE}>
      <div className="max-w-screen-xl mx-auto px-5 sm:px-6 h-[68px] flex items-center justify-between gap-3">
        <Link href={brandHref} className="flex items-center gap-3 min-w-0 cursor-pointer group">
          <VelacreMark size={36} className="shrink-0" />
          <span
            className="font-bold text-xl tracking-tight text-slate-200 group-hover:text-white transition-colors"
            style={{ fontFamily: 'CalSansUI, ui-sans-serif', lineHeight: '36px' }}
          >
            velacre
          </span>
          {negocioNombre && (
            <span className="hidden sm:inline text-sm text-slate-500 truncate" style={{ lineHeight: '36px' }}>
              · {negocioNombre}
            </span>
          )}
          {plan && planLabel && (
            <span className={`hidden sm:inline text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full ${PLAN_STYLES[plan]}`}>
              {planLabel}
            </span>
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
