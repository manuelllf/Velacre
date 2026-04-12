'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'

export default function TerminosPage() {
  const { t } = useLanguage()
  const terms = t.app.legal.terms
  const l = t.app.legal

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">Velacre</Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-4 py-2">
              {l.login}
            </Link>
            <Link href="/auth/register" className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors">
              {l.start}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">{terms.title}</h1>
        <p className="text-sm text-slate-500 mb-10">{terms.lastUpdated}</p>

        <div className="space-y-10 text-slate-300 text-base leading-relaxed">
          {terms.sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-xl font-semibold text-white mb-3">{section.title}</h2>
              {section.paragraphs[0] && <p>{section.paragraphs[0]}</p>}
              {section.items && (
                <ul className="mt-3 space-y-2 list-disc list-inside">
                  {section.items.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
              )}
              {section.paragraphs.slice(1).map((para, j) => (
                <p key={j} className="mt-3">{para}</p>
              ))}
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-800 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-slate-400 text-sm">{l.footerRights}</span>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <Link href="/privacidad" className="hover:text-slate-300 transition-colors">{l.footerPrivacy}</Link>
            <Link href="/terminos" className="hover:text-slate-300 transition-colors">{l.footerTerms}</Link>
            <Link href="/contacto" className="hover:text-slate-300 transition-colors">{l.footerContact}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
