'use client'

/**
 * Rito de paso marketing → producto post-auth.
 *
 * Se activa con:
 *  - Query param ?welcome=1 (login/register email pwd → redirect directo).
 *  - sessionStorage vel_welcome=1 (OAuth Google: armado antes del redirect
 *    externo, persiste a través de google.com → /auth/callback → /inicio).
 *
 * Fases (total ~2400ms):
 *  - enter  (0→500)   bg crema, sello+copy fade-in + translateY.
 *  - hold   (500→1400) sostén.
 *  - fade   (1400→1800) sello+copy fade-out.
 *  - morph  (1800→2200) bg crema → navy.
 *  - gone   (2200→2500) overlay fade-out revelando app.
 */

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import { VelacreMark } from './landing/VelacreMark'
import { consumeWelcome } from '@/lib/welcome'

type Phase = 'enter' | 'hold' | 'fade' | 'morph' | 'gone'

const COPY: Record<string, { lead: string; brand: string }> = {
  es:  { lead: 'Bienvenido a', brand: 'velacre' },
  en:  { lead: 'Welcome to',   brand: 'velacre' },
  gal: { lead: 'Benvido a',    brand: 'velacre' },
}

export default function WelcomeTransition() {
  const sp = useSearchParams()
  const { locale } = useLanguage()
  const firedRef = useRef(false)
  const [active, setActive] = useState(false)
  const [phase, setPhase] = useState<Phase>('enter')

  useEffect(() => {
    if (firedRef.current) return

    const hasQuery = sp.get('welcome') === '1'
    const hasSession = consumeWelcome()
    if (!hasQuery && !hasSession) return

    firedRef.current = true
    setActive(true)
    setPhase('enter')

    // Limpiar query de la URL sin navegar, para que reload no repita.
    if (hasQuery) {
      const url = new URL(window.location.href)
      url.searchParams.delete('welcome')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    }

    window.setTimeout(() => setPhase('hold'), 500)
    window.setTimeout(() => setPhase('fade'), 1400)
    window.setTimeout(() => setPhase('morph'), 1800)
    window.setTimeout(() => setPhase('gone'), 2200)
    window.setTimeout(() => setActive(false), 2500)
  }, [sp])

  if (!active) return null

  const { lead, brand } = COPY[locale] ?? COPY.es
  const isInk = phase === 'morph' || phase === 'gone'
  const contentVisible = phase === 'hold' || phase === 'fade'

  // Durante morph y gone el bg ya es navy; el texto (si siguiese visible) iría
  // blanco. Pero fade ya ocultó el contenido antes, así que el texto no
  // necesita cambiar de color.
  const textColor = isInk ? '#E8E2D4' : '#0A0E1A'

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: isInk ? '#0A0E1A' : '#E8E2D4',
        opacity: phase === 'gone' ? 0 : 1,
        transition:
          'background-color 400ms cubic-bezier(0.2, 0.7, 0.2, 1), opacity 300ms ease-out',
        pointerEvents: phase === 'gone' ? 'none' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 28,
      }}
    >
      <div
        style={{
          opacity: contentVisible ? 1 : 0,
          transform: contentVisible ? 'translateY(0)' : 'translateY(12px)',
          transition:
            'opacity 500ms cubic-bezier(0.2, 0.7, 0.2, 1), transform 500ms cubic-bezier(0.2, 0.7, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
        }}
      >
        <VelacreMark size={88} />
        <div
          style={{
            fontFamily: 'CalSansUI, ui-sans-serif, system-ui, sans-serif',
            fontSize: 'clamp(26px, 5.2vw, 42px)',
            fontWeight: 700,
            color: textColor,
            textAlign: 'center',
            lineHeight: 1.1,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: '0.28em',
          }}
        >
          <span style={{ letterSpacing: '-0.01em', fontWeight: 600 }}>{lead}</span>
          <span
            style={{
              letterSpacing: '-0.02em',
              fontSize: '1.15em',
              fontWeight: 700,
            }}
          >
            {brand}
          </span>
        </div>
      </div>
    </div>
  )
}
