'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dashboard',       label: 'Reseñas' },
  { href: '/dashboard/salud', label: 'Salud'   },
  { href: '/settings',        label: 'Configuración' },
]

export default function SectionNav() {
  const pathname = usePathname()

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-5xl mx-auto px-4 flex items-center gap-1">
        <Link
          href="/inicio"
          className="mr-2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          title="Volver a Inicio"
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
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
