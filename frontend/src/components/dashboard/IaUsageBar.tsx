'use client'

import { useLanguage } from '@/lib/i18n'
import Tooltip from '@/components/Tooltip'

export interface IaUsageBarProps {
  userPlan: string
  iaUsed: number
}

export default function IaUsageBar({ userPlan, iaUsed }: IaUsageBarProps) {
  const { t } = useLanguage()
  const d = t.app.dashboard

  if (userPlan !== 'basic' && userPlan !== 'core') return null

  const limit = userPlan === 'core' ? 25 : 10
  const used = Math.min(iaUsed, limit)
  const pct = Math.round((used / limit) * 100)
  const atLimit = used >= limit
  const nearLimit = used >= limit - 1 && !atLimit
  // Cuando aún queda margen, rendemos una versión pill compacta (mini badge con número y
  // progreso) en vez del bloque completo — evita robar espacio vertical en el dashboard.
  // Al acercarse al límite (≥70% consumido) pasamos al bloque grande para llamar la atención.
  const isCritical = pct >= 70 || nearLimit || atLimit

  const tooltipText = userPlan === 'core' ? d.iaBar.tooltipCore : d.iaBar.tooltipBasic

  if (!isCritical) {
    return (
      <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-3 py-1.5 text-xs">
        <span className="flex items-center gap-1 text-slate-400 font-medium">
          IA
          <Tooltip text={tooltipText} />
        </span>
        <span className="flex items-center gap-1.5 tabular-nums text-slate-300 font-semibold">
          {used}<span className="text-slate-600">/</span>{limit}
        </span>
        <span className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
          <span className="block h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </span>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${
      atLimit
        ? 'bg-red-950/40 border-red-800/60'
        : nearLimit
          ? 'bg-amber-950/30 border-amber-800/50'
          : 'bg-slate-900 border-slate-800'
    }`}>
      <div className="flex items-center justify-between mb-1.5 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${atLimit ? 'text-red-400' : nearLimit ? 'text-amber-400' : 'text-slate-400'}`}>
            {d.iaBar.title}
            <Tooltip text={tooltipText} />
          </span>
          {atLimit && (
            <span className="text-xs font-bold text-red-400 bg-red-900/40 border border-red-800/50 px-2 py-0.5 rounded-full shrink-0">
              {d.iaBar.limitReached}
            </span>
          )}
        </div>
        <span className={`text-xs font-bold tabular-nums shrink-0 ${atLimit ? 'text-red-400' : nearLimit ? 'text-amber-400' : 'text-slate-300'}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${atLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-400' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {atLimit && (
        <p className="text-xs text-red-400/80 mt-2">
          {userPlan === 'core'
            ? d.iaBar.limitCore
            : d.iaBar.limitBasic}
          {' '}
          <a href="/settings" className="underline font-semibold hover:text-red-300">{d.iaBar.viewPlans}</a>
        </p>
      )}
    </div>
  )
}
