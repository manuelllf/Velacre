'use client'

import { NavBar } from './landing/NavBar'
import { FooterEditorial } from './landing/FooterEditorial'
import './landing/landing.css'

export function PublicShell({
  children,
  authed = false,
}: {
  children: React.ReactNode
  /** Si true, invierte la paleta (navy papel / crema tinta) para que encaje con la app dark. */
  authed?: boolean
}) {
  return (
    <div
      className={`vel-lp${authed ? ' vel-lp--authed' : ''}`}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <NavBar variant="default" authed={authed} />
      <main style={{ flex: 1 }}>{children}</main>
      <FooterEditorial />
    </div>
  )
}
