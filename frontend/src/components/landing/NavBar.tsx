'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import { VelacreMark } from './VelacreMark'

export function NavBar({ variant = 'default' }: { variant?: 'default' | 'landing' }) {
  const { t: l } = useLanguage()
  const e = l.landingEditorial

  const brand =
    variant === 'landing' ? (
      <button
        type="button"
        className="nav-brand"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
      >
        <VelacreMark size={44} className="wm" />
        <span className="nav-brand-name">Velacre</span>
      </button>
    ) : (
      <Link href="/" className="nav-brand" style={{ cursor: 'pointer' }}>
        <VelacreMark size={44} className="wm" />
        <span className="nav-brand-name">Velacre</span>
      </Link>
    )

  const productHref = variant === 'landing' ? '#producto' : '/#producto'
  const radarHref = variant === 'landing' ? '#radar' : '/#radar'
  const pricingHref = variant === 'landing' ? '#precios' : '/#precios'

  return (
    <header className="nav">
      <div className="wrap nav-row">
        {brand}
        <nav className="nav-links">
          <Link href={productHref} className="link link-nav">{e.nav.product}</Link>
          <Link href={radarHref} className="link link-nav">{e.nav.radar}</Link>
          <Link href={pricingHref} className="link link-nav">{e.nav.pricing}</Link>
          <div className="nav-ctas">
            <Link href="/auth/login" className="btn btn-sm" style={{ color: 'var(--paper-dim)' }}>
              {l.nav.login}
            </Link>
            <Link href="/auth/register" className="btn btn-primary btn-sm">
              {l.nav.start}
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
