'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/lib/i18n'
import { FadeInUp, GlowCard } from './shared'

export default function DemoSection() {
  const { t: l } = useLanguage()

  const [selectedTone, setSelectedTone] = useState<'profesional' | 'empatico' | 'cercano' | 'directo' | 'agradecido' | 'humoristico' | null>(null)
  const [typedText, setTypedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [reviewIdx, setReviewIdx] = useState(0)

  const toneKeys: Array<'profesional' | 'empatico' | 'cercano' | 'directo' | 'agradecido' | 'humoristico'> = ['profesional', 'empatico', 'cercano', 'directo', 'agradecido', 'humoristico']
  const currentReview = l.demo.reviews[reviewIdx]
  const currentToneText = selectedTone ? currentReview.tones[selectedTone] : ''

  useEffect(() => {
    if (!selectedTone) return
    let i = 0
    setTypedText('')
    setIsTyping(true)
    const interval = setInterval(() => {
      i++
      setTypedText(currentToneText.slice(0, i))
      if (i >= currentToneText.length) {
        clearInterval(interval)
        setIsTyping(false)
      }
    }, 14)
    return () => clearInterval(interval)
  }, [selectedTone, reviewIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="max-w-5xl mx-auto px-6 py-24">
      <FadeInUp className="text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{l.demo.h2}</h2>
        <p className="text-slate-300 max-w-xl mx-auto">{l.demo.p}</p>
      </FadeInUp>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* Review card */}
        <FadeInUp delay={0.05}>
          {/* Navigation arrows */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { setReviewIdx(i => i - 1); setSelectedTone(null); setIsTyping(false); setTypedText('') }} disabled={reviewIdx === 0} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex gap-1.5">
              {l.demo.reviews.map((_, i) => (
                <button key={i} onClick={() => { setReviewIdx(i); setSelectedTone(null); setIsTyping(false); setTypedText('') }} className={`w-2 h-2 rounded-full transition-colors ${i === reviewIdx ? 'bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'}`} />
              ))}
            </div>
            <button onClick={() => { setReviewIdx(i => i + 1); setSelectedTone(null); setIsTyping(false); setTypedText('') }} disabled={reviewIdx === l.demo.reviews.length - 1} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <GlowCard className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold text-slate-300">{currentReview.author.charAt(0)}</div>
                <div>
                  <div className="text-sm font-semibold text-white">{currentReview.author}</div>
                  <div className="text-xs text-slate-500">{currentReview.date}</div>
                </div>
              </div>
              <div className="flex text-amber-400 text-sm">
                {Array.from({ length: 5 }, (_, i) => i < currentReview.stars ? '\u2605' : '\u2606').join('')}
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{currentReview.text}</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs bg-slate-800 text-slate-500 px-2 py-1 rounded-full">Google Maps</span>
              <span className={`text-xs px-2 py-1 rounded-full border ${
                currentReview.badgeType === 'negative' ? 'bg-red-950 text-red-400 border-red-900' :
                currentReview.badgeType === 'positive' ? 'bg-green-950 text-green-400 border-green-900' :
                'bg-amber-950 text-amber-400 border-amber-900'
              }`}>{currentReview.badge}</span>
            </div>
          </GlowCard>
        </FadeInUp>

        {/* Response card */}
        <FadeInUp delay={0.12}>
          <GlowCard className="bg-slate-900 border border-blue-600/50 rounded-2xl p-6 flex flex-col gap-4 shadow-xl shadow-blue-950/60 ring-1 ring-blue-700/30">
            <div className="flex items-center gap-2">
              <motion.div
                animate={isTyping ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ repeat: isTyping ? Infinity : 0, duration: 0.8 }}
                className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shrink-0"
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </motion.div>
              <span className="text-sm font-semibold text-blue-300">{l.demo.response.title}</span>
              {isTyping && (
                <span className="ml-auto text-xs text-blue-500 animate-pulse">{l.app.dashboard.generating}</span>
              )}
            </div>

            {/* Tone selector */}
            <div className="grid grid-cols-3 gap-2">
              {toneKeys.map(key => (
                <motion.button
                  key={key}
                  onClick={() => setSelectedTone(key)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`px-2 py-2 rounded-xl text-xs font-semibold transition-all border ${
                    selectedTone === key
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/50'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {l.demo.response.toneLabels[key]}
                </motion.button>
              ))}
            </div>

            {/* Response body with AnimatePresence */}
            <div className="min-h-[190px] flex items-start">
              <AnimatePresence mode="wait">
                {!selectedTone ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full flex flex-col items-center justify-center py-6 gap-2 text-center"
                  >
                    <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                    </svg>
                    <p className="text-xs text-slate-600">{l.demo.response.hint}</p>
                  </motion.div>
                ) : (
                  <motion.p
                    key={`${reviewIdx}-${selectedTone}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm text-slate-300 leading-relaxed"
                  >
                    {typedText}
                    {isTyping && (
                      <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-middle" />
                    )}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* CTA once done */}
            <AnimatePresence>
              {selectedTone && !isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-end pt-2 border-t border-slate-800"
                >
                  <Link href="/auth/register"
                    className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                    {l.nav.start} →
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </GlowCard>
        </FadeInUp>
      </div>
    </section>
  )
}
