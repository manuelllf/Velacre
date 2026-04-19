'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/lib/i18n'

const MY_SCORES = [7.8, 8.1, 8.4, 7.2]
const COMP_DATA = [
  { scores: [8.2, 7.5, 9.1, 6.8], threat: 'hi' as const },
  { scores: [6.1, 8.8, 7.3, 7.9], threat: 'md' as const },
  { scores: [5.4, 6.2, 6.7, 8.5], threat: 'lo' as const },
]

function Bar({ score, highlight }: { score: number; highlight: 'mine' | 'better' | 'dim' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ents => {
        ents.forEach(ent => {
          if (ent.isIntersecting) {
            setW(score * 10)
            obs.unobserve(ent.target)
          }
        })
      },
      { threshold: 0.2 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [score])

  const barClass =
    highlight === 'mine' ? 'bg-blue-500' :
    highlight === 'better' ? 'bg-red-500/70' :
    'bg-slate-600'

  return (
    <div ref={ref} className="flex-1 h-[4px] bg-slate-800 rounded-full relative overflow-hidden">
      <div
        className={`absolute inset-0 ${barClass} rounded-full`}
        style={{ width: `${w}%`, transition: 'width 1.1s cubic-bezier(0.2,0.7,0.2,1)' }}
      />
    </div>
  )
}

export default function RadarPreviewSection() {
  const { t: l } = useLanguage()
  const e = l.landingEditorial

  const threatBadge = {
    hi: { cls: 'bg-red-950 text-red-400 border-red-900', label: l.radarPreview.threatHigh },
    md: { cls: 'bg-amber-950 text-amber-400 border-amber-900', label: l.radarPreview.threatMedium },
    lo: { cls: 'bg-emerald-950 text-emerald-400 border-emerald-900', label: l.radarPreview.threatLow },
  }
  const cats = [e.radar.catCocina, e.radar.catServicio, e.radar.catAmbiente, e.radar.catPrecio]

  return (
    <section className="sec wrap sec-radar" id="radar">
      <div className="sec-head">
        <div className="sec-idx">
          <span className="num">02</span>
          {e.sections.intel}
        </div>
        <div>
          <h2>
            {e.radar.h2l1}
            <br />
            {e.radar.h2l2}
          </h2>
          <p className="sec-lede">{e.radar.lede}</p>
        </div>
      </div>

      <div className="dark">
        <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg overflow-hidden">

          {/* Mi negocio — card destacada */}
          <div className="bg-blue-950 border border-blue-900 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="font-medium text-white text-[14px]">{e.radar.tuNegocio}</span>
              </div>
              <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-blue-400">{l.radarPreview.threatLabel}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
              {MY_SCORES.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="font-mono text-[9.5px] tracking-[0.06em] uppercase text-slate-400 w-[82px] shrink-0">{cats[i]}</span>
                  <Bar score={s} highlight="mine" />
                  <span className="font-mono text-[11px] text-white tabular-nums w-[28px] text-right shrink-0">{s.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Competidores */}
          <div className="space-y-3">
            {COMP_DATA.map((c, idx) => {
              const t = threatBadge[c.threat]
              return (
                <div key={idx} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-slate-200 text-[14px]">{e.radar.competitors[idx]}</span>
                    <span className={`font-mono text-[9px] tracking-[0.1em] uppercase border rounded px-2 py-[3px] ${t.cls}`}>{t.label}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
                    {c.scores.map((s, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="font-mono text-[9.5px] tracking-[0.06em] uppercase text-slate-500 w-[82px] shrink-0">{cats[i]}</span>
                        <Bar score={s} highlight={s > MY_SCORES[i] ? 'better' : 'dim'} />
                        <span className={`font-mono text-[11px] tabular-nums w-[28px] text-right shrink-0 ${s > MY_SCORES[i] ? 'text-red-400' : 'text-slate-400'}`}>{s.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Overlay "Solo Pro" */}
          <div className="absolute inset-x-0 bottom-0 pt-10 pb-4 px-4 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent text-center pointer-events-none">
            <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] uppercase text-blue-400 bg-slate-800/80 border border-slate-700 rounded px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {e.radar.proBadge}
            </span>
          </div>
        </div>

      </div>

      {/* Insights — móvil: 1 card con 3 zonas. Desktop: 3 cards de altura igual. */}
      <div className="insights-mod">
        <div className="insight-zone kind-action">
          <div className="lbl">{e.radar.actionLbl}</div>
          <p>{e.radar.actionTxt}</p>
        </div>
        <div className="insight-zone kind-strength">
          <div className="lbl">{e.radar.strengthLbl}</div>
          <p>{e.radar.strengthTxt}</p>
        </div>
        <div className="insight-zone kind-opportunity">
          <div className="lbl">{e.radar.opportunityLbl}</div>
          <p>{e.radar.opportunityTxt}</p>
        </div>
      </div>
    </section>
  )
}
