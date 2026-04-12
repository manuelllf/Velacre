'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n'

interface HelpModalProps {
  onClose: () => void
}

export default function HelpModal({ onClose }: HelpModalProps) {
  const { t } = useLanguage()
  const h = t.app.help
  const STEPS = h.steps
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
              <span className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">{step + 1}</span>
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
              &larr; {h.prev}
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
                {h.next} &rarr;
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
              >
                {h.done}
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
  const { t } = useLanguage()
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t.app.help.tooltip}
        aria-label={t.app.help.title}
        className="fixed bottom-5 right-5 z-50 w-10 h-10 rounded-full bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white shadow-lg flex items-center justify-center transition-colors text-sm font-bold"
      >
        ?
      </button>
      {open && <HelpModal onClose={() => setOpen(false)} />}
    </>
  )
}
