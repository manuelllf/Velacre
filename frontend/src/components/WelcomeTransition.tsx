'use client'

/**
 * Overlay que cubre la pantalla con crema al entrar post-auth y hace
 * transición a navy antes de desaparecer — rito de paso marketing → producto.
 *
 * Se dispara cuando la URL tiene ?welcome=1. Limpia el query al montar
 * para que un reload no repita la animación.
 */

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Phase = 'paper' | 'ink' | 'gone'

export default function WelcomeTransition() {
  const sp = useSearchParams()
  const firedRef = useRef(false)
  const [active, setActive] = useState(false)
  const [phase, setPhase] = useState<Phase>('paper')

  useEffect(() => {
    if (firedRef.current) return
    if (sp.get('welcome') !== '1') return
    firedRef.current = true

    setActive(true)
    setPhase('paper')

    // Limpiamos el query de la URL sin navegar (evita repetir en reload/back).
    const url = new URL(window.location.href)
    url.searchParams.delete('welcome')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)

    window.setTimeout(() => setPhase('ink'), 180)
    window.setTimeout(() => setPhase('gone'), 820)
    window.setTimeout(() => setActive(false), 1100)
  }, [sp])

  if (!active) return null

  const bg =
    phase === 'paper'
      ? '#E8E2D4'
      : phase === 'ink'
      ? '#0A0E1A'
      : '#0A0E1A'

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: bg,
        opacity: phase === 'gone' ? 0 : 1,
        transition:
          'background-color 600ms cubic-bezier(0.2, 0.7, 0.2, 1), opacity 280ms ease-out',
        pointerEvents: phase === 'gone' ? 'none' : 'auto',
      }}
    />
  )
}
