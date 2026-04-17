'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import { renderStars } from './shared'

type ToneKey = 'profesional' | 'empatico' | 'cercano' | 'directo' | 'agradecido' | 'humoristico'
const TONES: ToneKey[] = ['profesional', 'empatico', 'cercano', 'directo', 'agradecido', 'humoristico']

function TypedBody({ text, onDone }: { text: string; onDone: () => void }) {
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])
  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      i += 2
      setTyped(text.slice(0, Math.min(i, text.length)))
      if (i >= text.length) {
        clearInterval(id)
        setDone(true)
        onDoneRef.current()
      }
    }, 14)
    return () => clearInterval(id)
  }, [text])
  return (
    <>
      {typed}
      {!done && <span className="caret" />}
    </>
  )
}

export default function DemoSection() {
  const { t: l } = useLanguage()
  const e = l.landingEditorial

  const [reviewIdx, setReviewIdx] = useState(0)
  const [tone, setTone] = useState<ToneKey>('profesional')
  const [status, setStatus] = useState<'generating' | 'ready'>('generating')

  const current = l.demo.reviews[reviewIdx]
  const fullText = current.tones[tone]
  const bodyKey = `${reviewIdx}-${tone}`

  const handleDone = useCallback(() => setStatus('ready'), [])
  const reset = () => setStatus('generating')

  const next = () => {
    setReviewIdx(i => Math.min(l.demo.reviews.length - 1, i + 1))
    reset()
  }
  const prev = () => {
    setReviewIdx(i => Math.max(0, i - 1))
    reset()
  }
  const pickTone = (k: ToneKey) => {
    setTone(k)
    reset()
  }

  return (
    <section className="sec wrap" id="producto">
      <div className="sec-head">
        <div className="sec-idx">
          <span className="num">01</span>
          {e.sections.product}
        </div>
        <div>
          <h2>
            {e.demo.h2l1}
            <br />
            {e.demo.h2l2}
          </h2>
          <p className="sec-lede">{e.demo.lede}</p>
        </div>
      </div>

      <div className="demo-grid">
        <div className="card demo-review">
          <div className="demo-label">
            <span className="mono">{e.demo.reviewLabel}</span>
            <div className="rev-nav">
              <button onClick={prev} disabled={reviewIdx === 0} aria-label="prev">‹</button>
              <div className="rev-dots">
                {l.demo.reviews.map((_, i) => (
                  <span key={i} className={i === reviewIdx ? 'on' : ''} />
                ))}
              </div>
              <button onClick={next} disabled={reviewIdx === l.demo.reviews.length - 1} aria-label="next">›</button>
            </div>
          </div>
          <div className="demo-review-head">
            <div className="demo-av">{current.author.charAt(0)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="demo-name">{current.author}</div>
              <div className="demo-date">{current.date}</div>
            </div>
            <span className="stars" style={{ marginLeft: 'auto' }}>
              {renderStars(current.stars)}
            </span>
          </div>
          <p className="demo-text">{current.text}</p>
          <div className="demo-foot">
            <span className="chip">Google Maps</span>
            <span className={`chip ${current.badgeType === 'negative' || current.badgeType === 'neutral' ? 'chip-warn' : ''}`}>
              {current.badge}
            </span>
          </div>
        </div>

        <div className="card card-ink demo-response">
          <div className="demo-label">
            <span className="mono">{e.demo.responseLabel}</span>
            <span className="mono" style={{ color: status === 'ready' ? 'var(--accent)' : 'var(--paper-dim)' }}>
              {status === 'ready' ? e.demo.statusReady : e.demo.statusGenerating}
            </span>
          </div>
          <div className="tone-grid">
            {TONES.map(k => (
              <button
                key={k}
                type="button"
                className={`tone-btn ${tone === k ? 'active' : ''}`}
                onClick={() => pickTone(k)}
              >
                {l.demo.response.toneLabels[k]}
              </button>
            ))}
          </div>
          <div className="tone-body">
            <TypedBody key={bodyKey} text={fullText} onDone={handleDone} />
          </div>
          <div className="rule" style={{ marginTop: 18 }} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 14,
              gap: 12,
            }}
          >
            <span className="mono-sm">
              {e.demo.languageLabel} ·{' '}
              <span style={{ color: 'var(--paper-dim)' }}>{(l.lang || 'es').toUpperCase()}</span>
            </span>
            <Link href="/auth/register" className="btn btn-accent btn-sm">
              {e.demo.respondInGoogle}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
