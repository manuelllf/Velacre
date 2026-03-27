'use client'

import { useLanguage } from '@/lib/i18n'

const LANGS = ['es', 'gal', 'en'] as const

export default function LangSwitcher() {
  const { locale, setLocale } = useLanguage()

  return (
    <div className="flex items-center gap-0.5">
      {LANGS.map((lang, i) => (
        <span key={lang} className="flex items-center">
          <button
            onClick={() => setLocale(lang)}
            className={`px-1.5 py-0.5 text-xs font-medium rounded transition-colors cursor-pointer ${
              locale === lang
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400'
            }`}
          >
            {lang.toUpperCase()}
          </button>
          {i < LANGS.length - 1 && (
            <span className="text-slate-200 dark:text-slate-700 text-xs select-none">·</span>
          )}
        </span>
      ))}
    </div>
  )
}
