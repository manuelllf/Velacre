'use client'

import { useLanguage } from '@/lib/i18n'
import type { Negocio } from '@/lib/api'

type EstadoFilter = 'pendiente' | 'respondida' | 'ignorada' | 'todas'

export interface SyncBarProps {
  negocio: Negocio | null
  syncLoading: boolean
  syncProgress: number
  syncMessage: string
  loadingReviews: boolean
  counts: Record<EstadoFilter, number>
  onRefresh: () => void
  onManual: () => void
  onSync: () => void
}

export default function SyncBar({
  negocio, syncLoading, syncProgress, syncMessage,
  loadingReviews, counts, onRefresh, onManual, onSync,
}: SyncBarProps) {
  const { t } = useLanguage()
  const d = t.app.dashboard

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {syncLoading ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">{d.syncLoading}</span>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{syncProgress}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-200"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
            </div>
          ) : syncMessage ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{syncMessage}</p>
          ) : (
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {negocio?.nombre ?? d.defaultBusinessName}
                {negocio?.tonopredefinido && (
                  <span className="ml-2 text-xs font-normal text-slate-400">· {negocio.tonopredefinido}</span>
                )}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {d.reviewCount.replace('{pending}', String(counts.pendiente)).replace('{answered}', String(counts.respondida))}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRefresh}
            disabled={loadingReviews || syncLoading}
            title={d.syncBtn}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <svg className={`w-4 h-4 ${loadingReviews ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={onManual}
            title={d.actions.otherPlatform}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="hidden sm:inline">{d.actions.otherPlatform}</span>
          </button>
          <button
            onClick={onSync}
            disabled={syncLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncLoading ? d.syncLoading : d.syncBtn}
          </button>
        </div>
      </div>
    </div>
  )
}
