'use client'

/**
 * Rito de paso entre marketing y producto — funciona en dos sentidos:
 *
 *   Welcome (entrada post-auth):  crema → navy.  "Bienvenido a velacre"
 *   Goodbye (salida, logout):     navy → crema.  "Hasta luego"
 *
 * Se activa con:
 *  - Query param ?welcome=1 (login/register email pwd → redirect directo).
 *  - sessionStorage vel_welcome=1 (OAuth Google: armado antes del redirect
 *    externo, persiste a través de google.com → /auth/callback → /inicio).
 *  - sessionStorage vel_goodbye=1 (logout: armado antes de signOut + redirect
 *    a la landing, el overlay cubre el salto app → marketing).
 *
 * Welcome coordina con el pathname: si monta en /auth/callback *espera* al
 * cambio de ruta (/inicio, /onboarding, …) antes del fade-out. Así no queda
 * hueco entre "overlay gone" y "callback redirige" donde se vería el fondo
 * crema del callback sin cubrir.
 *
 * Fases (idénticas en ambos modos; lo que cambia son los colores y el copy):
 *  - enter  (0→500)     bg de inicio, sello+copy fade-in + translateY.
 *  - hold   (500→1200)  sostén en bg de inicio (700ms).
 *  - morph  (1200→2200) interpolación bg y color, texto visible.
 *  - rest   (2200→…)    sostén en bg final, espera navegación (o fallback 5s).
 *  - fade   (+300)      sello+copy fade-out.
 *  - gone   (+300)      overlay fade-out revelando la página nueva.
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import { VelacreMark } from './landing/VelacreMark'
import { consumeGoodbye, consumeWelcome } from '@/lib/welcome'

type Phase = 'enter' | 'hold' | 'morph' | 'rest' | 'fade' | 'gone'
type Mode = 'welcome' | 'goodbye'

const COPY: Record<Mode, Record<string, { lead: string; brand?: string }>> = {
  welcome: {
    es:  { lead: 'Bienvenido a', brand: 'velacre' },
    en:  { lead: 'Welcome to',   brand: 'velacre' },
    gal: { lead: 'Benvido a',    brand: 'velacre' },
  },
  goodbye: {
    es:  { lead: 'Hasta luego' },
    en:  { lead: 'See you soon' },
    gal: { lead: 'Ata logo' },
  },
}

// Welcome va de crema a navy; goodbye al revés. enter/hold usan el primero,
// morph/rest/fade/gone el segundo.
const PALETTE: Record<Mode, { start: string; end: string; startText: string; endText: string }> = {
  welcome: { start: '#E8E2D4', end: '#0A0E1A', startText: '#0A0E1A', endText: '#E8E2D4' },
  goodbye: { start: '#0A0E1A', end: '#E8E2D4', startText: '#E8E2D4', endText: '#0A0E1A' },
}

const REST_FALLBACK_MS = 5000
const REST_MIN_AFTER_NAV_MS = 300

export default function WelcomeTransition() {
  const sp = useSearchParams()
  const pathname = usePathname()
  const { locale } = useLanguage()

  const firedRef = useRef(false)
  const fadedRef = useRef(false)
  const initialPathRef = useRef<string | null>(null)
  const restAtRef = useRef<number | null>(null)

  const [active, setActive] = useState(false)
  const [mode, setMode] = useState<Mode>('welcome')
  const [phase, setPhase] = useState<Phase>('enter')

  // Limpieza independiente del query ?welcome=1: siempre que aparezca, lo
  // quitamos de la URL para que no quede visible ni se repita en reload.
  useEffect(() => {
    if (sp.get('welcome') !== '1') return
    const url = new URL(window.location.href)
    url.searchParams.delete('welcome')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [sp])

  // Disparo principal del overlay.
  useEffect(() => {
    if (active) return
    if (firedRef.current) return

    const hasQuery = sp.get('welcome') === '1'
    const hasWelcome = consumeWelcome()
    const hasGoodbye = consumeGoodbye()
    if (!hasQuery && !hasWelcome && !hasGoodbye) return

    const resolvedMode: Mode = hasGoodbye ? 'goodbye' : 'welcome'

    firedRef.current = true
    fadedRef.current = false
    restAtRef.current = null
    initialPathRef.current = pathname
    setMode(resolvedMode)
    setActive(true)
    setPhase('enter')

    // Quitamos la cortina pre-paint ahora que el overlay React ya toma el
    // relevo sobre la misma pantalla, con el mismo color de arranque.
    document.documentElement.classList.remove('vel-prepaint-goodbye', 'vel-prepaint-welcome')

    window.setTimeout(() => setPhase('hold'), 500)
    window.setTimeout(() => setPhase('morph'), 1200)
    window.setTimeout(() => {
      setPhase('rest')
      restAtRef.current = Date.now()
    }, 2200)
    window.setTimeout(() => {
      if (!fadedRef.current) triggerFade()
    }, REST_FALLBACK_MS)
  }, [sp, pathname, active])

  // Fade automático al detectar cambio de ruta durante rest.
  useEffect(() => {
    if (!active) return
    if (fadedRef.current) return
    if (phase !== 'rest') return
    if (initialPathRef.current === null) return
    if (pathname === initialPathRef.current) return
    const elapsed = Date.now() - (restAtRef.current ?? Date.now())
    const wait = Math.max(0, REST_MIN_AFTER_NAV_MS - elapsed)
    const id = window.setTimeout(triggerFade, wait)
    return () => window.clearTimeout(id)
  }, [pathname, phase, active])

  function triggerFade() {
    if (fadedRef.current) return
    fadedRef.current = true
    setPhase('fade')
    window.setTimeout(() => setPhase('gone'), 300)
    window.setTimeout(() => setActive(false), 600)
  }

  if (!active) return null

  const copy = COPY[mode][locale] ?? COPY[mode].es
  const palette = PALETTE[mode]
  const atEnd = phase === 'morph' || phase === 'rest' || phase === 'fade' || phase === 'gone'
  const contentVisible = phase === 'hold' || phase === 'morph' || phase === 'rest'
  const bg = atEnd ? palette.end : palette.start
  const textColor = atEnd ? palette.endText : palette.startText

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: bg,
        color: textColor,
        opacity: phase === 'gone' ? 0 : 1,
        transition:
          'background-color 1000ms cubic-bezier(0.45, 0.05, 0.35, 1), color 1000ms cubic-bezier(0.45, 0.05, 0.35, 1), opacity 260ms ease-out',
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
            color: 'inherit',
            textAlign: 'center',
            lineHeight: 1.1,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: '0.28em',
          }}
        >
          <span style={{ letterSpacing: '-0.01em', fontWeight: 600 }}>{copy.lead}</span>
          {copy.brand && (
            <span
              style={{
                letterSpacing: '-0.02em',
                fontSize: '1.15em',
                fontWeight: 700,
              }}
            >
              {copy.brand}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
