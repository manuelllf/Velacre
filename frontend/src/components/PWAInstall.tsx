'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

type InstallPromptEvent = Event & { prompt?: () => Promise<void> }

// Rutas donde el banner puede aparecer. En cualquier otra ruta no existe ni en DOM.
const ALLOWED_PATHS = new Set(['/', '/inicio'])

// Duración máxima del banner visible en ms. Usuario lo considera intrusivo si está más.
const BANNER_TTL_MS = 10_000

// Clave persistente en localStorage. Si está seteada, el banner no vuelve a aparecer JAMÁS.
// Si el usuario quisiera resetearlo, puede borrar localStorage manualmente.
const DISMISSED_KEY = 'velacre-pwa-banner-dismissed'

export default function PWAInstall() {
  const pathname = usePathname()
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIos, setShowIos] = useState(false)

  // Ref para trackear el timer de auto-hide. No está en state para evitar
  // re-renders que reinicien el timer.
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Service Worker — siempre activo, independientemente de la ruta.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  // Listener global de beforeinstallprompt — el evento se dispara una sola vez
  // por sesión y necesitamos capturarlo aunque el banner solo se vea en algunas rutas.
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Lógica de visualización: solo en rutas permitidas, solo si no ha sido
  // descartado antes, y con auto-hide a los 10s.
  useEffect(() => {
    // Limpiar timer pendiente de un efecto anterior
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }

    // Fuera de rutas permitidas: ocultar todo y salir.
    if (!ALLOWED_PATHS.has(pathname)) {
      const t = setTimeout(() => {
        setShowAndroid(false)
        setShowIos(false)
      }, 0)
      return () => clearTimeout(t)
    }

    // En rutas permitidas: comprobar si ya fue descartado alguna vez.
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === '1'
    } catch {
      // localStorage no disponible (modo incognito estricto, SSR...): no mostramos.
      dismissed = true
    }

    if (dismissed) {
      // Nunca más. Silencioso.
      return
    }

    // Decidir qué variante mostrar en el siguiente tick
    const showDelay = setTimeout(() => {
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const isStandalone =
        ('standalone' in navigator) &&
        (navigator as { standalone?: boolean }).standalone === true

      let willShow = false

      if (prompt) {
        setShowAndroid(true)
        willShow = true
      } else if (isIos && !isStandalone) {
        setShowIos(true)
        willShow = true
      }

      if (willShow) {
        // Marcamos como descartado INMEDIATAMENTE al mostrarlo —
        // el usuario solo lo verá una vez en toda su vida en este navegador.
        try { localStorage.setItem(DISMISSED_KEY, '1') } catch { /* noop */ }

        // Auto-hide a los 10s
        hideTimerRef.current = setTimeout(() => {
          setShowAndroid(false)
          setShowIos(false)
          hideTimerRef.current = null
        }, BANNER_TTL_MS)
      }
    }, 100)

    return () => {
      clearTimeout(showDelay)
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }
  }, [pathname, prompt])

  const installAndroid = async () => {
    if (!prompt?.prompt) return
    await prompt.prompt()
    setShowAndroid(false)
    setPrompt(null)
  }

  const dismiss = () => {
    setShowAndroid(false)
    setShowIos(false)
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch { /* noop */ }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  // Hard gate final: fuera de rutas permitidas no renderizamos NADA.
  if (!ALLOWED_PATHS.has(pathname)) return null

  if (showAndroid) return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-bold text-white">Instalar Velacre</p>
        <p className="text-xs text-slate-400 mt-0.5">Accede más rápido desde tu pantalla de inicio.</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={dismiss} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer">
          Ahora no
        </button>
        <button onClick={installAndroid} className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors cursor-pointer">
          Instalar
        </button>
      </div>
    </div>
  )

  if (showIos) return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">Instalar Velacre</p>
          <p className="text-xs text-slate-400 mt-1">
            Toca <span className="text-white font-semibold">Compartir</span>{' '}
            <span className="text-base">&#x2394;</span> y luego{' '}
            <span className="text-white font-semibold">&ldquo;Añadir a pantalla de inicio&rdquo;</span>.
          </p>
        </div>
        <button onClick={dismiss} className="text-slate-500 hover:text-white text-lg leading-none shrink-0 cursor-pointer">✕</button>
      </div>
    </div>
  )

  return null
}
