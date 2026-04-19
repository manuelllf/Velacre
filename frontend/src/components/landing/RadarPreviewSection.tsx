'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/lib/i18n'

const MY_SCORES = [7.8, 8.1, 8.4, 7.2]
const COMP_DATA = [
  { scores: [8.2, 7.5, 9.1, 6.8], threat: 'hi' as const },
  { scores: [6.1, 8.8, 7.3, 7.9], threat: 'md' as const },
  { scores: [5.4, 6.2, 6.7, 8.5], threat: 'lo' as const },
]

function Bar({ score, variant, label }: { score: number; variant: 'acc' | 'dim' | 'bad'; label: string }) {
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
  return (
    <div className="radar-cell" ref={ref}>
      <span className="radar-cell-label">{label}</span>
      <div className="bar-track">
        <div className={`bar-fill bf-${variant}`} style={{ width: `${w}%` }} />
      </div>
      <span className="bar-n">{score.toFixed(1)}</span>
    </div>
  )
}

export default function RadarPreviewSection() {
  const { t: l } = useLanguage()
  const e = l.landingEditorial

  const threatClass = { hi: 'threat-hi', md: 'threat-md', lo: 'threat-lo' } as const
  const threatLabel = { hi: l.radarPreview.threatHigh, md: l.radarPreview.threatMedium, lo: l.radarPreview.threatLow } as const
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

      <div className="radar-card">
        <div className="radar-head">
          <div className="lbl">{e.radar.headerBiz}</div>
          <div className="lbl">{e.radar.catCocina}</div>
          <div className="lbl">{e.radar.catServicio}</div>
          <div className="lbl">{e.radar.catAmbiente}</div>
          <div className="lbl">{e.radar.catPrecio}</div>
        </div>

        <div className="radar-row mine">
          <div className="radar-name">
            <b>{e.radar.tuNegocio}</b>
          </div>
          {MY_SCORES.map((s, i) => (
            <Bar key={i} score={s} variant="acc" label={cats[i]} />
          ))}
        </div>

        {COMP_DATA.map((c, idx) => (
          <div key={idx} className="radar-row">
            <div className="radar-name">
              <b>{e.radar.competitors[idx]}</b>
              <span className={`radar-threat ${threatClass[c.threat]}`}>{threatLabel[c.threat]}</span>
            </div>
            {c.scores.map((s, i) => (
              <Bar key={i} score={s} variant={s > MY_SCORES[i] ? 'bad' : 'dim'} label={cats[i]} />
            ))}
          </div>
        ))}

        <div className="radar-overlay">
          <span className="pill">
            <span className="dot" />
            {e.radar.proBadge}
          </span>
        </div>
      </div>

      <div className="radar-insights">
        <div className="insight-card insight-action">
          <div className="insight-lbl">{e.radar.actionLbl}</div>
          <p>{e.radar.actionTxt}</p>
        </div>
        <div className="insight-card insight-strength">
          <div className="insight-lbl">{e.radar.strengthLbl}</div>
          <p>{e.radar.strengthTxt}</p>
        </div>
        <div className="insight-card insight-opportunity">
          <div className="insight-lbl">{e.radar.opportunityLbl}</div>
          <p>{e.radar.opportunityTxt}</p>
        </div>
      </div>
    </section>
  )
}
