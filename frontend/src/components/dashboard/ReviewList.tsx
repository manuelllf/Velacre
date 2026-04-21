'use client'

import { useLanguage } from '@/lib/i18n'
import type { PendingReview } from '@/lib/api'

type EstadoFilter = 'pendiente' | 'respondida' | 'ignorada' | 'todas'

const FILTER_ORDER: EstadoFilter[] = ['pendiente', 'respondida', 'ignorada', 'todas']

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return null
  const color = rating >= 4 ? 'text-emerald-500' : rating <= 2 ? 'text-red-400' : 'text-amber-400'
  return <span className={`text-sm font-semibold ${color}`}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
}

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  try { return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return dateStr }
}

export interface ReviewListProps {
  reviews: PendingReview[]
  filtered: PendingReview[]
  estadoFilter: EstadoFilter
  selectedId: string | null
  generatedResponses: Record<string, string>
  counts: Record<EstadoFilter, number>
  loadingReviews: boolean
  onFilterChange: (f: EstadoFilter) => void
  onSelect: (id: string | null) => void
}

export default function ReviewList({
  reviews, filtered, estadoFilter, selectedId,
  generatedResponses, counts, loadingReviews,
  onFilterChange, onSelect,
}: ReviewListProps) {
  const { t } = useLanguage()
  const d = t.app.dashboard

  const filterLabels: Record<EstadoFilter, string> = {
    pendiente: d.filters.pending,
    respondida: d.filters.answered,
    ignorada: d.filters.ignored,
    todas: d.filters.all,
  }

  return (
    <div className={`w-full lg:w-80 xl:w-96 shrink-0 flex-col lg:h-full gap-3 ${selectedId ? 'hidden lg:flex' : 'flex'}`}>

      {/* Filter tabs — segmented control de 1 fila. Usamos flex con flex-1 para que los
          labels largos (Respondidas, Ignoradas) tengan espacio natural sin truncarse. */}
      <div className="flex gap-1 shrink-0 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg p-1">
        {FILTER_ORDER.map(f => (
          <button
            key={f}
            onClick={() => { onFilterChange(f); onSelect(null) }}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
              estadoFilter === f
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <span>{filterLabels[f]}</span>
            <span className={`tabular-nums text-[10px] font-bold ${
              estadoFilter === f ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
            }`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Review list — scrollable en desktop */}
      <div className="flex-1 min-h-0 lg:overflow-y-auto scroll-thin">
      {loadingReviews ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-600 rounded w-4/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 py-10 px-5 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {estadoFilter === 'pendiente' ? d.empty.allDone : d.empty.noMatch}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {estadoFilter === 'pendiente' ? d.empty.allDoneDesc : d.empty.noMatchDesc}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(review => {
            const estado = review.estado ?? 'pendiente'
            const isNegative = (review.starRating ?? 5) <= 2
            const isSelected = selectedId === review.id
            const hasGenerated = !!generatedResponses[review.id]

            return (
              <button
                key={review.id}
                onClick={() => onSelect(isSelected ? null : review.id)}
                className={`w-full text-left rounded-xl border transition-all p-4 ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-1 ring-blue-300 dark:ring-blue-700'
                    : isNegative
                    ? 'bg-white dark:bg-slate-900 border-l-4 border-red-200 dark:border-red-900/50 border-l-red-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {(review.authorName ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {review.authorName ?? d.anonymous}
                      </span>
                      <StarRating rating={review.starRating} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {review.clientereview || <span className="italic">{d.noText}</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatDate(review.reviewDate)}</span>
                      {isNegative && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                          {d.urgent}
                        </span>
                      )}
                      {estado === 'respondida' && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                          {d.actions.answered}
                        </span>
                      )}
                      {estado === 'ignorada' && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                          {d.filters.ignored}
                        </span>
                      )}
                      {hasGenerated && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                          {d.states.answeredIA}
                        </span>
                      )}
                      {review.retenida && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                          {'\u26a0'} {d.states.retainedBadge}
                        </span>
                      )}
                      {review.plataforma === 'Otra' && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded-full">
                          {d.states.otherPlatformBadge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      </div>{/* end scrollable list */}

    </div>
  )
}
