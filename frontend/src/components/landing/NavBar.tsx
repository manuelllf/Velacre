'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import { VelacreMark } from './VelacreMark'

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" fill="none" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" fill="none" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" fill="none" />
    </svg>
  )
}

export function NavBar({ variant = 'default' }: { variant?: 'default' | 'landing' }) {
  const { t: l } = useLanguage()
  const e = l.landingEditorial
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) document.body.classList.add('vel-no-scroll')
    else document.body.classList.remove('vel-no-scroll')
    return () => { document.body.classList.remove('vel-no-scroll') }
  }, [open])

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const close = () => setOpen(false)

  const Brand = (
    variant === 'landing' ? (
      <button
        type="button"
        className="nav-brand"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <VelacreMark size={34} className="wm" />
        <span className="nav-brand-name">velacre</span>
      </button>
    ) : (
      <Link href="/" className="nav-brand" style={{ textDecoration: 'none' }}>
        <VelacreMark size={34} className="wm" />
        <span className="nav-brand-name">velacre</span>
      </Link>
    )
  )

  const productHref = variant === 'landing' ? '#producto' : '/#producto'
  const radarHref   = variant === 'landing' ? '#radar'    : '/#radar'
  const pricingHref = variant === 'landing' ? '#precios'  : '/#precios'

  return (
    <>
      <header className="nav">
        <div className="wrap nav-row">
          {Brand}

          {/* Desktop links — visible ≥960px */}
          <nav className="nav-links">
            <Link href={productHref} className="link link-nav">{e.nav.product}</Link>
            <Link href={radarHref}   className="link link-nav">{e.nav.radar}</Link>
            <Link href={pricingHref} className="link link-nav">{e.nav.pricing}</Link>
            <Link href="/auth/login" className="link">{l.nav.login}</Link>
          </nav>

          <div className="nav-ctas">
            <Link href="/auth/register" className="btn btn-accent btn-sm">
              {l.nav.start}
            </Link>
          </div>

          {/* Mobile — hamburguesa + CTA icono */}
          <div className="nav-mobile">
            <button
              type="button"
              className="nav-hamb"
              aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={open}
              onClick={() => setOpen(v => !v)}
            >
              <HamburgerIcon />
            </button>
            <Link
              href="/auth/register"
              className="nav-cta-icon"
              aria-label={l.nav.start}
              onClick={close}
            >
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </header>

      {/* Overlay móvil */}
      <div className={`nav-overlay ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open}>
        <div className="nav-overlay-head">
          <span className="nav-brand">
            <VelacreMark size={32} className="wm" />
            <span className="nav-brand-name">velacre</span>
          </span>
          <button
            type="button"
            className="nav-overlay-close"
            aria-label="Cerrar menú"
            onClick={close}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="nav-overlay-body">
          <Link href={productHref} className="nav-overlay-link" onClick={close}>{e.nav.product}</Link>
          <Link href={radarHref}   className="nav-overlay-link" onClick={close}>{e.nav.radar}</Link>
          <Link href={pricingHref} className="nav-overlay-link" onClick={close}>{e.nav.pricing}</Link>
          <Link href="/auth/login" className="nav-overlay-link" onClick={close}>{l.nav.login}</Link>
        </div>
        <div className="nav-overlay-foot">
          <Link href="/auth/register" className="btn btn-accent" onClick={close}>
            {l.nav.start}
          </Link>
        </div>
      </div>
    </>
  )
}
