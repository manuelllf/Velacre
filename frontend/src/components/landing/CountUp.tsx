'use client'

import { useEffect, useRef, useState } from 'react'

export interface CountUpProps {
  value: number
  decimals?: number
  duration?: number
  /** Se añade detrás del número sin espacio (ej. '%', 'h', '★') */
  suffix?: string
  className?: string
}

/**
 * Cuenta de 0 al valor objetivo cuando el elemento entra en viewport.
 * Usa rAF con easing cubic-out para que frene al final, sin librerías.
 */
export function CountUp({ value, decimals = 0, duration = 1400, suffix, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(0)
  const startedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting && !startedRef.current) {
            startedRef.current = true
            const start = performance.now()
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / duration)
              // cubic-out: fast start, slow end
              const eased = 1 - Math.pow(1 - t, 3)
              setDisplay(value * eased)
              if (t < 1) requestAnimationFrame(tick)
              else setDisplay(value)
            }
            requestAnimationFrame(tick)
            obs.unobserve(e.target)
          }
        }
      },
      { threshold: 0.3, rootMargin: '-40px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [value, duration])

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString()

  return (
    <span ref={ref} className={className}>
      {formatted}
      {suffix}
    </span>
  )
}
