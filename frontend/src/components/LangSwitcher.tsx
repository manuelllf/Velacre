'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/i18n'

const LANGS = [
  { code: 'es' as const, label: 'ES', name: 'Castellano' },
  { code: 'gal' as const, label: 'GL', name: 'Galego' },
  { code: 'en' as const, label: 'EN', name: 'English' },
]

export default function LangSwitcher() {
  const { locale, setLocale } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const current = LANGS.find(l => l.code === locale) ?? LANGS[0]
  const tooltip = locale === 'en' ? 'Change language' : 'Cambiar idioma'

  return (
    <div ref={ref} className="fixed bottom-5 left-5 z-50">
      {/* Dropdown (opens upward) */}
      {open && (
        <div className="absolute bottom-12 left-0 bg-slate-800 border border-slate-600 rounded-xl shadow-lg overflow-hidden min-w-[140px]">
          {LANGS.map(lang => (
            <button
              key={lang.code}
              onClick={() => { setLocale(lang.code); setOpen(false) }}
              className={`w-full px-3.5 py-2 text-left text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                locale === lang.code
                  ? 'bg-slate-700 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
              }`}
            >
              <span className="text-xs font-bold w-5 text-slate-500">{lang.label}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title={tooltip}
        aria-label={tooltip}
        className="w-10 h-10 rounded-full bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white shadow-lg flex items-center justify-center transition-colors cursor-pointer text-xs font-bold select-none"
      >
        {current.label}
      </button>
    </div>
  )
}
