'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import LangSwitcher from '@/components/LangSwitcher'

export default function ContactoPage() {
  const { t } = useLanguage()
  const c = t.app.legal.contact
  const l = t.app.legal

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">Velacre</Link>
          <div className="flex items-center gap-3">
            <LangSwitcher />
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
        <h1 className="text-3xl font-bold text-white mb-2">{c.title}</h1>
        <p className="text-slate-400 mb-12 text-base">{c.subtitle}</p>

        <div className="grid md:grid-cols-2 gap-8">

          <div className="space-y-4">

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-white">{c.generalEmail}</h2>
              </div>
              <a href="mailto:info@velacre.com" className="text-blue-400 hover:underline font-medium">
                info@velacre.com
              </a>
              <p className="text-sm text-slate-400 mt-1">{c.generalEmailDesc}</p>
              <p className="text-xs text-slate-500 mt-2">{c.generalEmailNote}</p>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-white">{c.privacyEmail}</h2>
              </div>
              <a href="mailto:privacidad@velacre.com" className="text-blue-400 hover:underline font-medium">
                privacidad@velacre.com
              </a>
              <p className="text-sm text-slate-400 mt-1">{c.privacyEmailDesc}</p>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-white">{c.locationTitle}</h2>
              </div>
              <address className="not-italic text-sm text-slate-300 leading-relaxed">
                <strong className="text-white">Manuel Llao Freire</strong><br />
                {c.locationAddress}
              </address>
            </div>

          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">{c.faqTitle}</h2>
            <div className="space-y-3">
              {c.faqs.map((item, i) => (
                <div key={i} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                  <p className="text-sm font-semibold text-white mb-1">{item.q}</p>
                  <p className="text-sm text-slate-400">{item.a}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <footer className="border-t border-slate-800 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-slate-500 text-sm">{l.footerRights}</span>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/privacidad" className="hover:text-slate-300 transition-colors">{l.footerPrivacy}</Link>
            <Link href="/terminos" className="hover:text-slate-300 transition-colors">{l.footerTerms}</Link>
            <Link href="/contacto" className="hover:text-slate-300 transition-colors">{l.footerContact}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
