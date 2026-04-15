'use client'

import { motion } from 'framer-motion'
import { FadeInUp, GlowCard } from './shared'
import { useLanguage } from '@/lib/i18n'

const DUMMY_DATA = [
  { scores: [8.2, 7.5, 9.1, 6.8], threat: 'high' as const },
  { scores: [6.1, 8.8, 7.3, 7.9], threat: 'medium' as const },
  { scores: [5.4, 6.2, 6.7, 8.5], threat: 'low' as const },
]
const MY_SCORES = [7.8, 8.1, 8.4, 7.2]

function ScoreBar({ score, max = 10, color }: { score: number; max?: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${(score / max) * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-bold text-slate-400 tabular-nums w-8 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

export default function RadarPreviewSection() {
  const { t } = useLanguage()
  const l = t.radarPreview

  return (
    <FadeInUp className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">{l.h2}</h2>
        <p className="text-slate-400 max-w-xl mx-auto">{l.p}</p>
      </div>

      <GlowCard className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_repeat(4,minmax(0,1fr))] gap-3 mb-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div />
          {l.categories.map(cat => (
            <div key={cat} className="text-center">{cat}</div>
          ))}
        </div>

        {/* My business row */}
        <div className="grid grid-cols-[1fr_repeat(4,minmax(0,1fr))] gap-3 items-center mb-2 py-2 px-3 bg-blue-950/40 border border-blue-800/30 rounded-xl">
          <div className="text-sm font-bold text-blue-400 truncate">{l.tuNegocio}</div>
          {MY_SCORES.map((score, i) => (
            <ScoreBar key={i} score={score} color="bg-blue-500" />
          ))}
        </div>

        {/* Competitor rows */}
        {DUMMY_DATA.map((comp, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_repeat(4,minmax(0,1fr))] gap-3 items-center py-2 px-3 border-b border-slate-800/50 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300 truncate">{l.competitor} {idx + 1}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                comp.threat === 'high' ? 'bg-red-900/50 text-red-400' :
                comp.threat === 'medium' ? 'bg-amber-900/50 text-amber-400' :
                'bg-emerald-900/50 text-emerald-400'
              }`}>
                {comp.threat === 'high' ? l.threatHigh : comp.threat === 'medium' ? l.threatMedium : l.threatLow}
              </span>
            </div>
            {comp.scores.map((score, i) => (
              <ScoreBar key={i} score={score} color={
                score > MY_SCORES[i] ? 'bg-red-500' : 'bg-slate-600'
              } />
            ))}
          </div>
        ))}

        {/* Pro overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent flex items-end justify-center pb-8 pointer-events-none">
          <span className="text-sm font-bold text-blue-400 bg-blue-950 border border-blue-800 px-4 py-2 rounded-full">
            {l.proBadge}
          </span>
        </div>
      </GlowCard>
    </FadeInUp>
  )
}
