'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'

export function AppFooter() {
  const { t } = useLanguage()
  const e = t.landingEditorial

  return (
    <footer className="mt-8 border-t border-slate-800 py-5">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <span
          className="text-slate-500 uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
        >
          {e.footer.bottomLeft}
        </span>
        <div className="flex gap-5 text-slate-400">
          <Link href="/privacidad" className="hover:text-slate-200 transition-colors">{t.footer.privacy}</Link>
          <Link href="/terminos" className="hover:text-slate-200 transition-colors">{t.footer.terms}</Link>
          <Link href="/contacto" className="hover:text-slate-200 transition-colors">{t.footer.contact}</Link>
        </div>
      </div>
    </footer>
  )
}
