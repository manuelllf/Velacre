'use client'

/**
 * Rito de paso marketing → producto post-auth.
 *
 * Se activa con:
 *  - Query param ?welcome=1 (login/register email pwd → redirect directo).
 *  - sessionStorage vel_welcome=1 (OAuth Google: armado antes del redirect
 *    externo, persiste a través de google.com → /auth/callback → /inicio).
 *
 * Coordinación con el pathname: cuando el flujo viene de Google el overlay
 * monta en /auth/callback y *espera* a que el router navegue a la ruta destino
 * (/inicio, /onboarding, /admin, /dashboard) antes de arrancar el fade-out.
 * Así no hay hueco entre "overlay gone" y "callback redirige" donde se vería
 * el fondo crema del callback sin cubrir.
 *
 * Fases:
 *  - enter  (0→500)     bg crema, sello+copy fade-in + translateY.
 *  - hold   (500→1200)  sostén sobre crema (700ms).
 *  - morph  (1200→2200) bg crema → navy + color ink → paper, texto visible.
 *  - rest   (2200→…)    sostén sobre navy, espera navegación (o fallback 5s).
 *  - fade   (+300)      sello+copy fade-out.
 *  - gone   (+300)      overlay fade-out revelando app.
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import { VelacreMark } from './landing/VelacreMark'
import { consumeWelcome } from '@/lib/welcome'

type Phase = 'enter' | 'hold' | 'morph' | 'rest' | 'fade' | 'gone'

const COPY: Record<string, { lead: string; brand: string }> = {
  es:  { lead: 'Bienvenido a', brand: 'velacre' },
  en:  { lead: 'Welcome to',   brand: 'velacre' },
  gal: { lead: 'Benvido a',    brand: 'velacre' },
}

const REST_FALLBACK_MS = 5000  // no dejar colgado el overlay si algo falla
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
  const [phase, setPhase] = useState<Phase>('enter')

  // Limpieza independiente del query ?welcome=1: siempre que aparezca, lo
  // quitamos de la URL para que no quede visible en la barra ni se repita en
  // reload (incluso si el overlay ya se disparó via sessionStorage).
  useEffect(() => {
    if (sp.get('welcome') !== '1') return
    const url = new URL(window.location.href)
    url.searchParams.delete('welcome')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [sp])

  // Disparo principal del overlay.
  useEffect(() => {
    if (firedRef.current) return

    const hasQuery = sp.get('welcome') === '1'
    const hasSession = consumeWelcome()
    if (!hasQuery && !hasSession) return

    firedRef.current = true
    initialPathRef.current = pathname
    setActive(true)
    setPhase('enter')

    window.setTimeout(() => setPhase('hold'), 500)
    window.setTimeout(() => setPhase('morph'), 1200)
    window.setTimeout(() => {
      setPhase('rest')
      restAtRef.current = Date.now()
    }, 2200)

    // Fallback: si la navegación nunca ocurre (email/pwd ya está en destino,
    // o algo atasca el router), arrancamos fade automático.
    window.setTimeout(() => {
      if (!fadedRef.current) triggerFade()
    }, REST_FALLBACK_MS)
  }, [sp, pathname])

  // Cuando la ruta cambia respecto a la inicial y ya estamos en rest,
  // arrancamos el fade (asegurando un mínimo de sostén sobre navy).
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

  const { lead, brand } = COPY[locale] ?? COPY.es
  const isInk = phase === 'morph' || phase === 'rest' || phase === 'fade' || phase === 'gone'
  const contentVisible = phase === 'hold' || phase === 'morph' || phase === 'rest'
  const textColor = isInk ? '#E8E2D4' : '#0A0E1A'

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: isInk ? '#0A0E1A' : '#E8E2D4',
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
