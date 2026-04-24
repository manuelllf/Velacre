'use client'

import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '@/lib/i18n'
import type { PendingReview } from '@/lib/api'

export interface DetailPanelProps {
  review: PendingReview
  generated?: string
  generatedError?: string
  contexto?: { cliente: string; respuesta: string }
  isGenerating: boolean
  isUpdating: boolean
  copiedId: string | null
  gbpConnected: boolean
  userPlan: string
  isOtraPlatforma: boolean
  onGenerate: () => void
  onRegenerateIA: () => void
  onLoad: () => void
  onSetEstado: (e: 'pendiente' | 'respondida' | 'ignorada') => void
  onCopy: (text: string) => void
  onPublish: (texto: string) => void
  onRetry: () => void
  /** Autosave de la edición manual del texto de respuesta. Si no se pasa, el textarea es read-only. */
  onSaveResponse?: (texto: string) => Promise<void>
  commonError: string
}

export default function DetailPanel({
  review, generated, generatedError, contexto,
  isGenerating, isUpdating, copiedId,
  gbpConnected, userPlan, isOtraPlatforma,
  onGenerate, onRegenerateIA, onLoad, onSetEstado, onCopy, onPublish, onRetry,
  onSaveResponse,
}: DetailPanelProps) {
  const { t } = useLanguage()
  const d = t.app.dashboard

  // ── Edición in-place de la respuesta con autosave ──
  // `generated` viene del padre. Mantenemos una copia local editable y nos resincronizamos
  // cuando cambia la reseña seleccionada o el texto de `generated` (p.ej. tras regenerar).
  // Dos disparadores de guardado: debounced 2s sin escribir, o inmediato al perder foco.
  const [editedText, setEditedText] = useState<string>(generated ?? '')
  // idle: sin cambios pendientes. dirty: editado sin guardar. saving: persistiendo.
  // saved: guardado recientemente (fade a idle tras 2s). error: fallo al guardar.
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  // Double-click inline confirm para regenerar (evita window.confirm nativo feo).
  const [confirmingRegen, setConfirmingRegen] = useState(false)
  // Timer del autosave debounced. Usamos ref para poder cancelarlo en cada tecla / blur / unmount.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setEditedText(generated ?? '')
    setSaveState('idle')
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
  }, [review.id, generated])

  useEffect(() => () => {
    // Cleanup del timer al desmontar para no guardar sobre una reseña que ya no está seleccionada.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  const isEditable = !!onSaveResponse && review.tonoGenerado !== 'google'

  async function persistEdit(candidate: string) {
    if (!onSaveResponse) return
    const trimmed = candidate.trim()
    if (trimmed.length === 0 || trimmed === (generated ?? '').trim()) {
      setSaveState('idle')
      return
    }
    setSaveState('saving')
    // Mostrar el estado 'saving' un mínimo de 450ms aunque el backend responda en 50ms.
    // Sin esto el "Guardando…" parpadea sin que el usuario lo perciba.
    const minVisible = new Promise(r => setTimeout(r, 450))
    try {
      await Promise.all([onSaveResponse(trimmed), minVisible])
      setSaveState('saved')
      setTimeout(() => setSaveState(prev => (prev === 'saved' ? 'idle' : prev)), 2000)
    } catch {
      setSaveState('error')
    }
  }

  function scheduleAutosave(candidate: string) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      persistEdit(candidate)
    }, 2000)
  }

  function handleBlurSave() {
    // Blur siempre lanza el guardado de forma inmediata — si había un timer debounced, lo cancelamos.
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    persistEdit(editedText)
  }

  function handleRegenerateClick() {
    if (!confirmingRegen) {
      setConfirmingRegen(true)
      // Auto-reset del confirm si el usuario no hace el 2º click en 4s.
      setTimeout(() => setConfirmingRegen(false), 4000)
      return
    }
    setConfirmingRegen(false)
    onRegenerateIA()
  }

  const MOTIVO_LABELS: Record<string, string> = {
    intoxicacion:     d.retention.intoxicacion,
    maltrato:         d.retention.maltrato,
    amenaza_legal:    d.retention.amenaza_legal,
    datos_personales: d.retention.datos_personales,
    acusacion_fraude: d.retention.acusacion_fraude,
    discriminacion:   d.retention.discriminacion,
  }
  const estado = review.estado ?? 'pendiente'
  const isNegative = (review.starRating ?? 5) <= 2
  const hasGenerated = !!generated
  const hasError = !!generatedError
  const isRetenida = !!review.retenida
  // Respondidas importadas desde Google (sync): son registro histórico, no acciona nada el usuario.
  const isGoogleHistorical = estado === 'respondida' && review.tonoGenerado === 'google'
  // Respondida con tono de Velacre (no Google): el usuario puede forzar regenerar (consume 1 IA).
  const isVelacreRespondida = estado === 'respondida' && !!review.tonoGenerado && review.tonoGenerado !== 'google'

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border ${
      isNegative
        ? 'border-l-4 border-red-200 dark:border-red-900/50 border-l-red-400'
        : 'border-slate-200 dark:border-slate-800'
    }`}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-base font-bold text-slate-600 dark:text-slate-300">
              {(review.authorName ?? '?')[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold text-slate-900 dark:text-white">
                  {review.authorName ?? d.anonymous}
                </span>
                {isNegative && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                    {d.urgent}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">{
                new Date(review.reviewDate ?? '').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
              }</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-lg font-semibold text-amber-500">{'★'.repeat(review.starRating ?? 0)}{'☆'.repeat(5 - (review.starRating ?? 0))}</span>
            {estado === 'respondida' && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                {d.actions.answered}
              </span>
            )}
            {estado === 'ignorada' && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                {d.filters.ignored}
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {review.clientereview || <span className="italic text-slate-400">{d.noText}</span>}
          </p>
        </div>
      </div>

      {/* Context summary */}
      {hasGenerated && contexto && (
        <div className="mx-6 mb-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3 space-y-1.5">
          <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="shrink-0 w-24 font-medium text-slate-400 dark:text-slate-500">{d.context.clientSaid}</span>
            <span>{contexto.cliente}</span>
          </div>
          <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="shrink-0 w-24 font-medium text-slate-400 dark:text-slate-500">{d.context.youRespond}</span>
            <span>{contexto.respuesta}</span>
          </div>
        </div>
      )}

      {/* Generated response — editable in-place con autosave on blur */}
      {hasGenerated && (
        <div className="mx-6 mb-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl p-5">
          {isEditable ? (
            <textarea
              value={editedText}
              onChange={e => {
                const v = e.target.value
                setEditedText(v)
                // Marcamos dirty solo si el texto difiere del "último guardado" (que coincide con
                // el valor de `generated` tras un save exitoso — ver persistEdit + useEffect).
                const changed = v.trim() !== (generated ?? '').trim()
                if (saveState === 'saving') return
                setSaveState(changed ? 'dirty' : 'idle')
                // Autosave debounced: 2s sin escribir y se guarda solo (sin tener que blur-ear).
                // Cada tecla resetea el timer. onBlur sigue disparando guardado inmediato.
                // El textarea solo se renderiza si isEditable=true, por lo que onSaveResponse
                // está garantizado definido aquí; persistEdit hace un check defensivo de todos
                // modos.
                if (changed) scheduleAutosave(v)
                else if (saveTimerRef.current) {
                  clearTimeout(saveTimerRef.current)
                  saveTimerRef.current = null
                }
              }}
              onBlur={handleBlurSave}
              rows={Math.max(3, Math.min(10, editedText.split('\n').length + Math.ceil(editedText.length / 90)))}
              className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-sm text-slate-800 dark:text-slate-200 leading-relaxed resize-y p-0 mb-3 whitespace-pre-wrap font-[inherit]"
              style={{ fontFamily: 'inherit' }}
              spellCheck
            />
          ) : (
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed mb-4 whitespace-pre-wrap">
              {generated}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onCopy(isEditable ? editedText : generated!)}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
            >
              {copiedId === review.id ? (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> {d.actions.copied}</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> {d.actions.copyResponse}</>
              )}
            </button>

            {/* Estado de autosave: dot + label según dirty / saving / saved / error.
                Idle no muestra nada (el textarea limpio es feedback suficiente). */}
            {isEditable && saveState !== 'idle' && (
              <span className={`flex items-center gap-1.5 text-xs font-medium ${
                saveState === 'dirty'  ? 'text-amber-600 dark:text-amber-400' :
                saveState === 'saving' ? 'text-slate-500 dark:text-slate-400' :
                saveState === 'saved'  ? 'text-emerald-600 dark:text-emerald-400' :
                                         'text-red-600 dark:text-red-400'
              }`}>
                {saveState === 'dirty' && (
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
                )}
                {saveState === 'saving' && (
                  <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                )}
                {saveState === 'saved' && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {saveState === 'error' && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {saveState === 'dirty'  ? d.states.editDirty  :
                 saveState === 'saving' ? d.states.editSaving :
                 saveState === 'saved'  ? d.states.editSaved  :
                                          d.states.editError}
              </span>
            )}

            {/* Publicar en Google — Próximamente / No aplica para otra plataforma */}
            <span
              title={isOtraPlatforma ? d.actions.publishGoogleDisabled : d.actions.comingSoon}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 rounded-xl opacity-50 cursor-not-allowed select-none"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {d.actions.publishGoogle}
              {!isOtraPlatforma && <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{d.actions.comingSoon}</span>}
            </span>

            {/* Abrir panel de reseñas para copiar y pegar manualmente */}
            {isOtraPlatforma ? (
              <span
                title={d.actions.publishGoogleDisabled}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 rounded-xl opacity-50 cursor-not-allowed select-none"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {d.actions.respondGoogle}
              </span>
            ) : (
              <a
                href="https://business.google.com/reviews"
                target="_blank"
                rel="noopener noreferrer"
                title={d.actions.respondGoogleTitle}
                /* Al clicar, copia la respuesta al clipboard antes de abrir el panel
                   de Google. Así el dueño solo tiene que pegar en Google — 1 tap menos
                   entre generar y publicar. Funciona también con Ctrl+click (new tab). */
                onClick={() => {
                  const textToCopy = isEditable ? editedText : generated
                  if (textToCopy?.trim()) onCopy(textToCopy)
                }}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {d.actions.respondGoogle}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div className="mx-6 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
            {generatedError}
          </p>
        </div>
      )}

      {/* Retained review warning */}
      {isRetenida && (
        <div className="mx-6 mb-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">{d.retention.title}</p>
              {review.motivoRetencion && (
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                  {MOTIVO_LABELS[review.motivoRetencion] ?? review.motivoRetencion}
                </p>
              )}
              <p className="text-xs text-orange-600/80 dark:text-orange-500 mt-2">
                {d.retention.desc}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions footer — sticky al fondo del scroll container en desktop.
          Sin border-top (corte duro); en su lugar una sombra sutil hacia arriba que se
          percibe solo cuando hay contenido scrollado debajo. */}
      <div className="px-6 py-3 flex items-center justify-between gap-3 flex-wrap lg:sticky lg:bottom-0 lg:bg-white/95 lg:dark:bg-slate-900/95 lg:backdrop-blur-sm lg:rounded-b-2xl lg:shadow-[0_-8px_14px_-6px_rgba(0,0,0,0.22)]">
        <div>
          {!isRetenida && !hasGenerated && !hasError && estado === 'respondida' && (
            review.tonoGenerado === 'google' ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {d.states.answeredGoogle}
              </p>
            ) : review.tonoGenerado ? (
              <button
                onClick={onLoad}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                {d.states.loadResponse}
              </button>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {d.states.noResponse}{' '}
                <button onClick={() => onSetEstado('pendiente')} className="underline hover:text-slate-600 dark:hover:text-slate-300">
                  {d.actions.reopen}
                </button>
              </p>
            )
          )}
          {!isRetenida && !hasGenerated && !hasError && estado !== 'respondida' && (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {d.actions.generating}</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> {d.actions.generateIA}</>
              )}
            </button>
          )}
          {!isRetenida && hasError && (
            <button onClick={onRetry} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              {t.app.errors.retry}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {estado !== 'respondida' && (
            <button
              onClick={() => onSetEstado('respondida')}
              disabled={isUpdating}
              className="text-sm px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50 font-medium"
            >
              {'\u2713'} {d.actions.answered}
            </button>
          )}
          {estado !== 'ignorada' && (
            <button
              onClick={() => onSetEstado('ignorada')}
              disabled={isUpdating || isGoogleHistorical}
              title={isGoogleHistorical ? d.states.historicalGoogle : undefined}
              className="text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent font-medium"
            >
              {d.ignore}
            </button>
          )}
          {estado !== 'pendiente' && (
            isVelacreRespondida ? (
              // Respondida con IA de Velacre: "Regenerar con IA" fuerza nueva llamada a Claude
              // (consume 1 IA, sobreescribe el texto en el textarea sin mover la reseña de estado).
              // Doble-click inline: 1er click muestra "Toca de nuevo para confirmar", 2º ejecuta.
              <button
                onClick={handleRegenerateClick}
                disabled={isUpdating || isGenerating}
                className={`text-sm px-3 py-2 rounded-xl border font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                  isGenerating
                    ? 'border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20'
                    : confirmingRegen
                    ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                    : 'border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                }`}
              >
                {isGenerating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {d.actions.regenerating}
                  </>
                ) : confirmingRegen ? (
                  d.actions.regenerateConfirmInline
                ) : (
                  d.actions.regenerateIA
                )}
              </button>
            ) : (
              <button
                onClick={() => onSetEstado('pendiente')}
                disabled={isUpdating || isGoogleHistorical}
                title={isGoogleHistorical ? d.states.historicalGoogle : undefined}
                className="text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent font-medium"
              >
                {d.actions.reopen}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
