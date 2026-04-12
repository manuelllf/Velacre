'use client'

import { useLanguage } from '@/lib/i18n'

const LANGS = ['es', 'gal', 'en'] as const
const LABELS: Record<string, string> = { es: 'ES', gal: 'GL', en: 'EN' }

export default function LangSwitcher() {
  const { locale, setLocale } = useLanguage()

  function cycle() {
    const idx = LANGS.indexOf(locale)
    setLocale(LANGS[(idx + 1) % LANGS.length])
  }

  return (
    <button
      onClick={cycle}
      title={locale === 'es' ? 'Cambiar idioma' : locale === 'gal' ? 'Cambiar idioma' : 'Change language'}
      className="w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer select-none"
    >
      {LABELS[locale]}
    </button>
  )
}
