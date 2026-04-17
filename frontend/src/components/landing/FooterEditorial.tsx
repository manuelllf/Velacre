'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'

export function FooterEditorial() {
  const { t: l } = useLanguage()
  const e = l.landingEditorial

  return (
    <footer className="foot-min">
      <div className="wrap foot-min-row">
        <span className="mono foot-min-left">
          {e.footer.bottomLeft}
        </span>
        <nav className="foot-min-links">
          {e.footer.legalLinks.map(link => (
            <Link key={link.label} href={link.href}>{link.label}</Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
