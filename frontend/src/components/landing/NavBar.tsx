'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import { VelacreMark } from './VelacreMark'
import { handleAnchorClick } from './shared'

function IconProducto() {
  // Message / demo
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none">
      <path d="M3 4h14v9H7l-4 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function IconRadar() {
  // Concentric rings
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
    </svg>
  )
}

function IconPrecios() {
  // Euro tag
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none">
      <path d="M13 5a5 5 0 1 0 0 10M5 9h6M5 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  )
}

export function NavBar({
  variant = 'default',
  authed = false,
}: {
  variant?: 'default' | 'landing'
  /**
   * Si true: usuario ya autenticado. Ocultamos anchors de landing + login/register CTA
   * (no tiene sentido mostrarle "Empezar gratis" a alguien ya logueado) y mostramos un
   * único "Volver a la app" como salida natural.
   */
  authed?: boolean
}) {
  const { t: l } = useLanguage()
  const e = l.landingEditorial

  const Brand = (
    variant === 'landing' ? (
      <button
        type="button"
        className="nav-brand"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <VelacreMark size={30} className="wm" />
        <span className="nav-brand-name">velacre</span>
      </button>
    ) : (
      <Link href={authed ? '/inicio' : '/'} className="nav-brand" style={{ textDecoration: 'none' }}>
        <VelacreMark size={30} className="wm" />
        <span className="nav-brand-name">velacre</span>
      </Link>
    )
  )

  const productHref = variant === 'landing' ? '#producto' : '/#producto'
  const radarHref   = variant === 'landing' ? '#radar'    : '/#radar'
  const pricingHref = variant === 'landing' ? '#precios'  : '/#precios'

  return (
    <header className="nav">
      <div className="wrap nav-row">
        {Brand}

        {/* Anchors de landing solo cuando NO estás dentro de la app */}
        {!authed && (
          <nav className="nav-anchors">
            <Link
              href={productHref}
              className="nav-anchor"
              title={e.nav.product}
              aria-label={e.nav.product}
              onClick={ev => handleAnchorClick(ev, productHref)}
            >
              <IconProducto />
              <span className="lbl">{e.nav.product}</span>
            </Link>
            <Link
              href={radarHref}
              className="nav-anchor"
              title={e.nav.radar}
              aria-label={e.nav.radar}
              onClick={ev => handleAnchorClick(ev, radarHref)}
            >
              <IconRadar />
              <span className="lbl">{e.nav.radar}</span>
            </Link>
            <Link
              href={pricingHref}
              className="nav-anchor"
              title={e.nav.pricing}
              aria-label={e.nav.pricing}
              onClick={ev => handleAnchorClick(ev, pricingHref)}
            >
              <IconPrecios />
              <span className="lbl">{e.nav.pricing}</span>
            </Link>
          </nav>
        )}

        {/* Derecha: Login + Start cuando público, "Volver a la app" cuando authed */}
        <div className="nav-auth">
          {authed ? (
            <Link href="/inicio" className="nav-cta">
              <span className="nav-cta-label">{e.nav.backToApp}</span>
              <span className="nav-cta-icon-only"><ArrowRightIcon /></span>
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="nav-login">{l.nav.login}</Link>
              <Link href="/auth/register" className="nav-cta">
                <span className="nav-cta-label">{l.nav.start}</span>
                <span className="nav-cta-icon-only"><ArrowRightIcon /></span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
