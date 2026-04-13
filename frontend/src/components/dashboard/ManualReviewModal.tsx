'use client'

import { useLanguage } from '@/lib/i18n'
import type { ReviewResponses, Negocio } from '@/lib/api'

export interface ManualReviewModalProps {
  open: boolean
  reviewText: string
  manualResponses: ReviewResponses | null
  manualLoading: boolean
  manualError: string
  manualSaving: boolean
  manualCopied: boolean
  manualContexto: { cliente: string; respuesta: string } | null
  negocio: Negocio | null
  onClose: () => void
  onChangeText: (text: string) => void
  onSubmit: (e: React.FormEvent) => void
  onSave: (estado: 'pendiente' | 'respondida') => void
  onReset: () => void
  onCopy: () => void
}

export default function ManualReviewModal({
  open, reviewText, manualResponses, manualLoading, manualError,
  manualSaving, manualCopied, manualContexto, negocio,
  onClose, onChangeText, onSubmit, onSave, onReset, onCopy,
}: ManualReviewModalProps) {
  const { t } = useLanguage()
  const d = t.app.dashboard

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!manualLoading && !manualSaving) onClose() }} />
      <div className="relative w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border-0 sm:border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{d.manual.title}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {d.manual.desc}
            </p>
          </div>
          <button
            type="button"
            disabled={manualLoading || manualSaving}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 1: Input */}
        {!manualResponses && (
          <form onSubmit={onSubmit} className="flex flex-col flex-1 p-5 gap-4">
            <textarea
              rows={6}
              value={reviewText}
              onChange={e => onChangeText(e.target.value)}
              autoFocus
              className="flex-1 w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none scroll-thin"
              placeholder={d.manual.placeholder}
            />
            {manualError && <p className="text-xs text-red-600 dark:text-red-400">{manualError}</p>}
            <button
              type="submit"
              disabled={manualLoading || !reviewText.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {manualLoading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {d.generating}</>
                : d.generateBtn}
            </button>
          </form>
        )}

        {/* Reseña retenida por seguridad */}
        {manualResponses?.retenida && (
          <div className="p-5 flex flex-col gap-4">
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">{d.states.retainedTitle}</p>
                  <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                    {manualResponses.motivoRetencion === 'intoxicacion' && d.retention.intoxicacion}
                    {manualResponses.motivoRetencion === 'maltrato' && d.retention.maltrato}
                    {manualResponses.motivoRetencion === 'amenaza_legal' && d.retention.amenaza_legal}
                    {manualResponses.motivoRetencion === 'datos_personales' && d.retention.datos_personales}
                    {manualResponses.motivoRetencion === 'acusacion_fraude' && d.retention.acusacion_fraude}
                    {manualResponses.motivoRetencion === 'discriminacion' && d.retention.discriminacion}
                    {!manualResponses.motivoRetencion && d.retention.unknown}
                  </p>
                  <p className="text-xs text-orange-600/80 dark:text-orange-500 mt-2">
                    {d.states.retainedDesc}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="w-full py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              {'\u2190'} {d.manual.tryAnother}
            </button>
          </div>
        )}

        {/* Step 2: Context + single response */}
        {manualResponses && !manualResponses.retenida && (
          <>
            {/* Context */}
            {manualContexto && (manualContexto.cliente || manualContexto.respuesta) && (
              <div className="px-5 pt-4 space-y-2 shrink-0">
                {manualContexto.cliente && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500">{d.context.clientSaid}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{manualContexto.cliente}</p>
                  </div>
                )}
                {manualContexto.respuesta && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500">{d.context.youRespond}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{manualContexto.respuesta}</p>
                  </div>
                )}
              </div>
            )}

            {/* Respuesta generada */}
            <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">{negocio?.tonopredefinido ?? 'Profesional'}</span>
                  <button
                    type="button"
                    onClick={onCopy}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      manualCopied
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {manualCopied ? t.app.common.copied : t.app.common.copy}
                  </button>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {manualResponses.respuesta}
                </p>
              </div>
            </div>

            {/* Save actions — sticky footer */}
            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 space-y-2 shrink-0 bg-white dark:bg-slate-900">
              {manualError && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{manualError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={manualSaving}
                  onClick={() => onSave('pendiente')}
                  className="flex-1 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {manualSaving ? <span className="flex items-center justify-center gap-1"><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> {d.manual.saving}</span> : d.manual.savePending}
                </button>
                <button
                  type="button"
                  disabled={manualSaving}
                  onClick={() => onSave('respondida')}
                  className="flex-1 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {manualSaving ? <span className="flex items-center justify-center gap-1"><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {d.manual.saving}</span> : `${d.manual.saveAnswered} \u2713`}
                </button>
              </div>
              <button
                type="button"
                onClick={onReset}
                className="w-full py-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {'\u2190'} {d.manual.tryAnother}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
