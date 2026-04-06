'use client'

import { useState } from 'react'

const STEPS = [
  {
    icon: '📥',
    title: 'Sincroniza tus reseñas de Google',
    body: 'Pulsa "Sincronizar" para importar tus reseñas de Google. Velacre las trae automáticamente y las organiza por estado: pendientes, respondidas e ignoradas.',
  },
  {
    icon: '⚡',
    title: 'Genera una respuesta con IA',
    body: 'Selecciona una reseña y pulsa "Generar respuesta IA". La IA analiza el contenido y crea una respuesta personalizada en el tono de tu negocio. Tienes un límite mensual según tu plan.',
  },
  {
    icon: '✍️',
    title: 'Elige el tono y copia',
    body: 'Verás la respuesta generada. Cópiala con un clic y pégala directamente en Google Business o en la plataforma que uses.',
  },
  {
    icon: '📋',
    title: 'Reseñas de otras plataformas',
    body: 'Pulsa "Otra plataforma" para responder reseñas de Booking, TripAdvisor, Yelp u otras. Pega el texto, genera las respuestas, elige un tono y guárdala en tu historial.',
  },
  {
    icon: '⚠️',
    title: 'Reseñas retenidas por seguridad',
    body: 'Si una reseña menciona intoxicaciones, denuncias o agresiones, Velacre la marca como "Revisión" y no genera respuesta automática. Necesita atención personal tuya.',
  },
  {
    icon: '📊',
    title: 'Panel Salud',
    body: 'En "Salud" verás métricas de tu reputación: nota media, palabras clave mencionadas, tiempo ahorrado y evolución mensual. Disponible en plan Core y Pro.',
  },
  {
    icon: '🎯',
    title: 'Radar de competencia',
    body: 'Con el plan Pro puedes añadir hasta 3 competidores y obtener un análisis comparativo de reputación cada mes. Ve a "Salud" y baja hasta la sección Radar.',
  },
  {
    icon: '⚙️',
    title: 'Ajusta tu negocio',
    body: 'En "Configuración" puedes cambiar el tono de respuesta, añadir palabras clave SEO que quieres que aparezcan en tus respuestas, y gestionar tu plan.',
  },
]

interface HelpModalProps {
  onClose: () => void
}

export default function HelpModal({ onClose }: HelpModalProps) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{current.icon}</span>
              <h2 className="text-base font-bold text-white leading-tight">{current.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">{current.body}</p>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              ← Anterior
            </button>

            {/* Dots */}
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === step ? 'bg-blue-500' : 'bg-slate-600 hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors"
              >
                Siguiente →
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
              >
                ¡Entendido!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Floating help button ──────────────────────────────────────────────────────

export function HelpButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Ayuda — ¿cómo funciona Velacre?"
        aria-label="Abrir ayuda"
        className="fixed bottom-5 right-5 z-50 w-10 h-10 rounded-full bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white shadow-lg flex items-center justify-center transition-colors text-sm font-bold"
      >
        ?
      </button>
      {open && <HelpModal onClose={() => setOpen(false)} />}
    </>
  )
}
