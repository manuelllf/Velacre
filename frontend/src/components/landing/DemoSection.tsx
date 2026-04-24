'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import { renderStars } from './shared'
import { SectionHelp } from './SectionHelp'

type ToneKey = 'profesional' | 'empatico' | 'cercano' | 'directo' | 'agradecido' | 'humoristico'
const TONES: ToneKey[] = ['profesional', 'empatico', 'cercano', 'directo', 'agradecido', 'humoristico']

function TypedBody({ text, onDone }: { text: string; onDone: () => void }) {
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone }, [onDone])
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
      {!done && <span className="inline-block w-[2px] h-[15px] bg-blue-400 ml-[1px] align-[-2px] animate-[vel-blink_1s_steps(2)_infinite]" />}
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
  const pickTone = (k: ToneKey) => { setTone(k); reset() }

  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const onTouchStart = (ev: React.TouchEvent) => setTouchStartX(ev.touches[0].clientX)
  const onTouchEnd = (ev: React.TouchEvent) => {
    if (touchStartX === null) return
    const dx = ev.changedTouches[0].clientX - touchStartX
    if (Math.abs(dx) > 48) {
      if (dx < 0) next()
      else prev()
    }
    setTouchStartX(null)
  }

  const badgeColor =
    current.badgeType === 'positive' ? 'bg-emerald-950 text-emerald-400 border-emerald-900' :
    current.badgeType === 'negative' ? 'bg-red-950 text-red-400 border-red-900' :
    'bg-amber-950 text-amber-400 border-amber-900'

  return (
    <section className="sec wrap sec-demo" id="producto">
      <div className="sec-head">
        <div className="sec-idx">
          <span className="num">02</span>
          {e.sections.product}
          <SectionHelp text={e.sectionsHelp.product} />
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

      <div className="dark">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-lg">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-3 sm:gap-4">

            {/* ========= REVIEW CARD ========= */}
            <div
              className="bg-slate-800 border border-slate-800 rounded-xl p-4 flex flex-col"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              style={{ touchAction: 'pan-y' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-slate-500">{e.demo.reviewLabel}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={prev}
                    disabled={reviewIdx === 0}
                    aria-label="prev"
                    className="w-7 h-7 inline-flex items-center justify-center border border-slate-700 rounded text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >‹</button>
                  <div className="flex items-center gap-1">
                    {l.demo.reviews.map((_, i) => (
                      <span
                        key={i}
                        className={`h-[5px] rounded-full transition-all ${i === reviewIdx ? 'w-4 bg-white' : 'w-[5px] bg-slate-700'}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={next}
                    disabled={reviewIdx === l.demo.reviews.length - 1}
                    aria-label="next"
                    className="w-7 h-7 inline-flex items-center justify-center border border-slate-700 rounded text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >›</button>
                </div>
              </div>

              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center font-mono text-sm text-slate-400 shrink-0">
                  {current.author.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{current.author}</div>
                  <div className="text-xs text-slate-500">{current.date}</div>
                </div>
                <span className="text-amber-400 text-sm tracking-wide shrink-0">{renderStars(current.stars)}</span>
              </div>

              <p className="text-[14px] leading-relaxed text-slate-200 mb-4 flex-1">{current.text}</p>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.08em] text-slate-400 border border-slate-700 rounded px-2 py-[3px]">
                  Google Maps
                </span>
                <span className={`inline-flex items-center text-[10px] font-mono uppercase tracking-[0.08em] border rounded px-2 py-[3px] ${badgeColor}`}>
                  {current.badge}
                </span>
              </div>
            </div>

            {/* ========= RESPONSE CARD ========= */}
            <div className="bg-slate-800 border border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-slate-500">{e.demo.responseLabel}</span>
                <span className={`font-mono text-[10px] tracking-[0.1em] uppercase ${status === 'ready' ? 'text-blue-400' : 'text-slate-400'}`}>
                  {status === 'ready' ? e.demo.statusReady : e.demo.statusGenerating}
                </span>
              </div>

              {/* Tone selector — grid 2x3 móvil, 3x2 desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-4">
                {TONES.map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pickTone(k)}
                    className={`min-h-[36px] px-2 rounded font-mono text-[10px] tracking-[0.06em] uppercase border transition-colors ${
                      tone === k
                        ? 'bg-white text-slate-950 border-white'
                        : 'bg-transparent text-slate-400 border-slate-700 hover:text-white hover:border-slate-500'
                    }`}
                  >
                    {l.demo.response.toneLabels[k]}
                  </button>
                ))}
              </div>

              {/* Generated response body */}
              <div className="bg-blue-950 border border-blue-900 rounded-lg px-4 py-3 min-h-[140px] text-[14px] leading-relaxed text-slate-100 mb-3 flex-1">
                <TypedBody key={bodyKey} text={fullText} onDone={handleDone} />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-slate-500">
                  {e.demo.languageLabel}: <span className="text-slate-300">{(l.lang || 'es').toUpperCase()}</span>
                </span>
                <Link
                  href="/auth/register"
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  {e.demo.respondInGoogle}
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
