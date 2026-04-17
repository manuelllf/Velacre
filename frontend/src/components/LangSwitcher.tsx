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
    <div ref={ref} className="vel-lang">
      {open && (
        <div className="vel-lang-menu">
          {LANGS.map(lang => (
            <button
              key={lang.code}
              type="button"
              onClick={() => { setLocale(lang.code); setOpen(false) }}
              className={`vel-lang-opt${locale === lang.code ? ' active' : ''}`}
            >
              <span className="vel-lang-code">{lang.label}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={tooltip}
        aria-label={tooltip}
        className="vel-lang-btn"
      >
        {current.label}
      </button>
    </div>
  )
}
