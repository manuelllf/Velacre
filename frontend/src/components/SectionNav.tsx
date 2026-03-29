'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'

const TABS = [
  { href: '/dashboard',       labelKey: 'reviews' as const },
  { href: '/dashboard/salud', labelKey: 'health'  as const },
  { href: '/settings',        labelKey: 'config'  as const },
]

const TAB_LABELS: Record<string, { es: string; en: string; gal: string }> = {
  reviews: { es: 'Reseñas',        en: 'Reviews',   gal: 'Recensións'    },
  health:  { es: 'Salud',          en: 'Health',    gal: 'Saúde'         },
  config:  { es: 'Configuración',  en: 'Settings',  gal: 'Configuración' },
}

export default function SectionNav() {
  const pathname = usePathname()
  const { locale } = useLanguage()

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/inicio" className="text-sm font-bold text-slate-900 dark:text-white tracking-tight shrink-0">
          Velacre
        </Link>
        {/* Tabs */}
        <div className="flex items-center gap-0.5">
          {TABS.map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 h-8 flex items-center rounded-lg text-sm font-medium transition-colors ${
                pathname === tab.href
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              {TAB_LABELS[tab.labelKey][locale]}
            </Link>
          ))}
        </div>
        {/* Right spacer — same width as logo for centering */}
        <div className="shrink-0 w-14" />
      </div>
    </div>
  )
}
