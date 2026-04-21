'use client'

import { useLanguage } from '@/lib/i18n'

export interface SyncBarProps {
  syncLoading: boolean
  syncProgress: number
  syncMessage: string
  loadingReviews: boolean
  onRefresh: () => void
  onManual: () => void
  onSync: () => void
}

export default function SyncBar({
  syncLoading, syncProgress, syncMessage,
  loadingReviews, onRefresh, onManual, onSync,
}: SyncBarProps) {
  const { t } = useLanguage()
  const d = t.app.dashboard

  // Nota: eliminamos el card (bg + border + padding) y el contador 'N pendientes · M respondidas'
  // que ya vive en los filter tabs de la lista. La tira queda solo como las 3 acciones
  // (refrescar / otra plataforma / sincronizar) icon-first, con espacio para la barra de
  // progreso cuando se está sincronizando.
  return (
    <div className="flex items-center gap-3 min-h-[32px]">
      <div className="flex-1 min-w-0">
        {syncLoading ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{d.syncLoading}</span>
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{syncProgress}%</span>
            </div>
            <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-200"
                style={{ width: `${syncProgress}%` }}
              />
            </div>
          </div>
        ) : syncMessage ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{syncMessage}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onRefresh}
          disabled={loadingReviews || syncLoading}
          title={d.syncBtn}
          aria-label={d.syncBtn}
          className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
        >
          <svg className={`w-4 h-4 ${loadingReviews ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button
          onClick={onManual}
          title={d.actions.otherPlatform}
          aria-label={d.actions.otherPlatform}
          className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={onSync}
          disabled={syncLoading}
          title={d.syncBtn}
          className="inline-flex items-center gap-1.5 px-3 h-9 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">{syncLoading ? d.syncLoading : d.syncBtn}</span>
        </button>
      </div>
    </div>
  )
}
