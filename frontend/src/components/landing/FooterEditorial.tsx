'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import { VelacreMark } from './VelacreMark'

export function FooterEditorial() {
  const { t: l } = useLanguage()
  const e = l.landingEditorial

  function resolveHref(href: string) {
    return href.startsWith('#') ? `/${href}` : href
  }

  return (
    <footer className="foot wrap">
      <div className="foot-row foot-row-3">
        <div>
          <div className="foot-brand">
            <VelacreMark size={40} />
            <span className="nav-brand-name">velacre</span>
          </div>
          <p className="foot-tag">{e.footer.tagline}</p>
        </div>
        <div className="foot-col">
          <h4>{e.footer.productCol}</h4>
          {e.footer.productLinks.map(link => (
            <Link key={link.label} href={resolveHref(link.href)}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="foot-col">
          <h4>{e.footer.legalCol}</h4>
          {e.footer.legalLinks.map(link => (
            <Link key={link.label} href={link.href}>{link.label}</Link>
          ))}
        </div>
      </div>
      <div className="foot-bot">
        <span className="mono">{e.footer.bottomLeft}</span>
        <span className="mono">{e.footer.bottomRight}</span>
      </div>
    </footer>
  )
}
