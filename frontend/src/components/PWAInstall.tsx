'use client'

import { useEffect, useState } from 'react'

export default function PWAInstall() {
  const [prompt, setPrompt] = useState<Event & { prompt?: () => Promise<void> } | null>(null)
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIos, setShowIos] = useState(false)

  useEffect(() => {
    // Registrar SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Android/Chrome: capturar el evento de instalación
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as Event & { prompt?: () => Promise<void> })
      setShowAndroid(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS: detectar si no está instalado como PWA
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = ('standalone' in navigator) && (navigator as { standalone?: boolean }).standalone === true
    if (isIos && !isStandalone) {
      const dismissed = sessionStorage.getItem('pwa-ios-dismissed')
      if (!dismissed) setShowIos(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

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
            <span className="text-base">⎋</span> y luego{' '}
            <span className="text-white font-semibold">"Añadir a pantalla de inicio"</span>.
          </p>
        </div>
        <button onClick={dismissIos} className="text-slate-500 hover:text-white text-lg leading-none shrink-0 cursor-pointer">✕</button>
      </div>
    </div>
  )

  return null
}
