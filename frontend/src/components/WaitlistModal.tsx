'use client'

import { useState } from 'react'
import { notifyWaitlist } from '@/lib/api'

interface Props {
  plan: 'core' | 'pro'
  onClose: () => void
}

const PLAN_LABELS: Record<'core' | 'pro', { name: string; price: string; desc: string }> = {
  core: {
    name: 'Core',
    price: '19,90 €/mes',
    desc: '10 respuestas IA al mes, panel de salud completo y análisis de tendencias.',
  },
  pro: {
    name: 'Pro',
    price: '29,90 €/mes',
    desc: 'Respuestas IA ilimitadas, acceso completo a todas las funciones sin restricciones.',
  },
}

export default function WaitlistModal({ plan, onClose }: Props) {
  const [notas, setNotas] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const info = PLAN_LABELS[plan]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      await notifyWaitlist(plan, notas)
      setSent(true)
    } catch {
      setError('No se pudo enviar. Inténtalo de nuevo o escríbenos a info@velacre.com')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  plan === 'pro'
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}>{info.name}</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{info.price}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Únete a la lista de espera</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{info.desc}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mt-0.5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {sent ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">¡Anotado!</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Te avisaremos en cuanto el plan {info.name} esté disponible.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  Los planes de pago están en desarrollo. Cuando tengamos suficientes usuarios interesados, los activaremos y te avisaremos por email.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Notas <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="¿Qué funcionalidad te interesa más? ¿Tienes alguna pregunta?"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex-1 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sending && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {sending ? 'Enviando...' : 'Apuntarme'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
