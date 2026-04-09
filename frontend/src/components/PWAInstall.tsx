'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

type InstallPromptEvent = Event & { prompt?: () => Promise<void> }

// Duración del banner en milisegundos. El usuario prefiere que no sea pesado.
const BANNER_TTL_MS = 10_000

export default function PWAInstall() {
  const pathname = usePathname()
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIos, setShowIos] = useState(false)

  // Service Worker — siempre activo, independientemente de la ruta.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  // Listener global de beforeinstallprompt — el evento se dispara una única vez
  // por sesión, así que lo capturamos siempre aunque el banner sólo se vea en /.
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Banner sólo en la landing y sólo durante 10 segundos.
  // Todos los setState se difieren a setTimeout para cumplir la regla
  // react-hooks/set-state-in-effect (no setState directo en el cuerpo del efecto).
  useEffect(() => {
    const showTimer = setTimeout(() => {
      if (pathname !== '/') {
        setShowAndroid(false)
        setShowIos(false)
        return
      }

      if (prompt) setShowAndroid(true)

      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const isStandalone =
        ('standalone' in navigator) &&
        (navigator as { standalone?: boolean }).standalone === true
      const dismissed = sessionStorage.getItem('pwa-ios-dismissed')
      if (isIos && !isStandalone && !dismissed) setShowIos(true)
    }, 0)

    const hideTimer = setTimeout(() => {
      setShowAndroid(false)
      setShowIos(false)
    }, BANNER_TTL_MS)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [pathname, prompt])

  const installAndroid = async () => {
    if (!prompt?.prompt) return
    await prompt.prompt()
    setShowAndroid(false)
    setPrompt(null)
  }

  const dismissIos = () => {
    sessionStorage.setItem('pwa-ios-dismissed', '1')
    setShowIos(false)
  }

  // Hard gate: fuera de la landing nunca renderizamos nada.
  if (pathname !== '/') return null

  if (showAndroid) return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-bold text-white">Instalar Velacre</p>
        <p className="text-xs text-slate-400 mt-0.5">Accede más rápido desde tu pantalla de inicio.</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => setShowAndroid(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer">
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
        <button onClick={dismissIos} className="text-slate-500 hover:text-white text-lg leading-none shrink-0 cursor-pointer">✕</button>
      </div>
    </div>
  )

  return null
}
