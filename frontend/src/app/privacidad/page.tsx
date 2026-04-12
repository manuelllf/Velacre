'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import LangSwitcher from '@/components/LangSwitcher'

export default function PrivacidadPage() {
  const { t } = useLanguage()
  const p = t.app.legal.privacy
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
        <h1 className="text-3xl font-bold text-white mb-2">{p.title}</h1>
        <p className="text-sm text-slate-500 mb-10">{p.lastUpdated}</p>

        <div className="space-y-10 text-slate-300 text-base leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{p.s1Title}</h2>
            <p>{p.s1p1}</p>
            <p className="mt-2">{p.s1p2}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{p.s2Title}</h2>
            <p>{p.s2intro}</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              {p.s2items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
            <p className="mt-3">{p.s2note}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{p.s3Title}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse mt-2">
                <thead>
                  <tr className="bg-slate-800 text-left">
                    <th className="px-4 py-2 font-semibold text-white rounded-tl-lg">{p.s3headers[0]}</th>
                    <th className="px-4 py-2 font-semibold text-white rounded-tr-lg">{p.s3headers[1]}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {p.s3rows.map(([col1, col2], i) => (
                    <tr key={i}>
                      <td className="px-4 py-3">{col1}</td>
                      <td className="px-4 py-3">{col2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{p.s4Title}</h2>
            <p>{p.s4intro}</p>
            <ul className="mt-3 space-y-3 list-disc list-inside">
              {p.s4items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
            <p className="mt-3">{p.s4note}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{p.s5Title}</h2>
            <p>{p.s5intro}</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              {p.s5items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{p.s6Title}</h2>
            <p>{p.s6intro}</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              {p.s6rights.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
            <p className="mt-3">{p.s6exercise}</p>
            <p className="mt-3">{p.s6complaint}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{p.s7Title}</h2>
            <p>{p.s7text}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{p.s8Title}</h2>
            <p>{p.s8text}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{p.s9Title}</h2>
            <p>{p.s9text}</p>
          </section>

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
