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

const LANGS = ['es', 'en', 'gal'] as const

export default function SectionNav() {
  const pathname = usePathname()
  const { locale, setLocale } = useLanguage()

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Link
            href="/inicio"
            className="mr-2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Inicio"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          {TABS.map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                pathname === tab.href
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {TAB_LABELS[tab.labelKey][locale]}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          {LANGS.map(lang => (
            <button
              key={lang}
              onClick={() => setLocale(lang)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                locale === lang
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
