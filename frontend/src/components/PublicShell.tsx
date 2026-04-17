'use client'

import { NavBar } from './landing/NavBar'
import { FooterEditorial } from './landing/FooterEditorial'
import './landing/landing.css'

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="vel-lp" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavBar variant="default" />
      <main style={{ flex: 1 }}>{children}</main>
      <FooterEditorial />
    </div>
  )
}
