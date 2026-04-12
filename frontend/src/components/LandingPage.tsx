'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'

// ── Static icons ─────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

// ── Animation helpers ─────────────────────────────────────────────────────────

const EASE = [0.21, 0.47, 0.32, 0.98] as const

function FadeInUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 22 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

function GlowCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      whileHover={{
        boxShadow: '0 0 0 1px rgba(59,130,246,0.45), 0 0 28px rgba(59,130,246,0.12)',
      }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { t: l } = useLanguage()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [selectedTone, setSelectedTone] = useState<'profesional' | 'empatico' | 'cercano' | 'directo' | 'agradecido' | 'humoristico' | null>(null)
  const [typedText, setTypedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [billingYearly, setBillingYearly] = useState(false)
  const [calcResenas, setCalcResenas] = useState(25)
  const [calcPrecioHora, setCalcPrecioHora] = useState(20)

  const toneKeys: Array<'profesional' | 'empatico' | 'cercano' | 'directo' | 'agradecido' | 'humoristico'> = ['profesional', 'empatico', 'cercano', 'directo', 'agradecido', 'humoristico']
  const currentToneText = selectedTone ? l.demo.response.tones[selectedTone].text : ''

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
  }, [selectedTone]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGoogleSignup() {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-xl font-bold tracking-tight text-white">Velacre</button>
          <div className="flex items-center gap-3">
            <a href="#precios" className="hidden sm:block text-sm font-medium text-slate-400 hover:text-white transition-colors px-3 py-2">
              {l.pricing.h2}
            </a>
            <Link href="/auth/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-4 py-2">
              {l.nav.login}
            </Link>
            <Link href="/auth/register" className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors">
              {l.nav.start}
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[520px] bg-blue-600/25 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
            className="inline-flex items-center gap-2 bg-blue-950 border border-blue-800 text-blue-300 text-sm font-medium px-4 py-1.5 rounded-full mb-8"
          >
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            {l.hero.badge}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
            className="text-5xl md:text-6xl lg:text-7xl font-black leading-tight tracking-tight mb-6"
          >
            {l.hero.h1}<br />
            <span className="text-blue-400">{l.hero.h1highlight}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.35, ease: EASE }}
            className="text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            {l.hero.p}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5, ease: EASE }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleSignup}
              disabled={googleLoading}
              className="flex items-center justify-center gap-3 px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-xl text-base transition-colors disabled:opacity-70 shadow-lg"
            >
              <GoogleIcon />
              {googleLoading ? l.hero.ctaGoogleLoading : l.hero.ctaGoogle}
            </motion.button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/auth/register"
                className="flex items-center justify-center px-6 py-3.5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold rounded-xl text-base transition-colors"
              >
                {l.hero.ctaEmail}
              </Link>
            </motion.div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            className="text-sm text-slate-600 mt-4"
          >
            {l.hero.setup}
          </motion.p>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-slate-800 bg-slate-900/60">
        <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center sm:divide-x sm:divide-slate-800">
          {[
            { val: l.stats.s1val, label: l.stats.s1label },
            { val: l.stats.s2val, label: l.stats.s2label },
            { val: l.stats.s3val, label: l.stats.s3label },
          ].map((s, i) => (
            <FadeInUp key={i} delay={i * 0.08}>
              <div className="text-4xl md:text-5xl font-black text-white tabular-nums">{s.val}</div>
              <div className="text-sm text-slate-400 mt-1.5 font-medium">{s.label}</div>
            </FadeInUp>
          ))}
        </div>
      </section>

      {/* ── CALCULADORA DE PAZ MENTAL ── */}
      {(() => {
        const minSin = calcResenas * 6
        const minCon = Math.max(1, Math.ceil((calcResenas * 5) / 60))
        const ahorroMin = minSin - minCon
        const ahorroH = Math.floor(ahorroMin / 60)
        const ahorroM = Math.round(ahorroMin % 60)
        const ahorroEuros = Math.round((ahorroMin / 60) * calcPrecioHora)
        return (
          <FadeInUp className="max-w-4xl mx-auto px-6 py-16">
            <div className="bg-gradient-to-br from-blue-950/50 to-slate-900 border border-blue-900/30 rounded-3xl p-8 md:p-10">
              <div className="mb-8">
                <h2 className="text-2xl md:text-3xl font-black text-white mb-2">¿Cuánto vale tu tiempo?</h2>
                <p className="text-slate-400 text-sm">Calcula lo que te cuesta responder reseñas cada mes.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-8 md:gap-12">
                <div className="space-y-7">
                  <div>
                    <div className="flex justify-between items-baseline mb-3">
                      <label className="text-sm font-semibold text-slate-300">Reseñas al mes</label>
                      <span className="text-2xl font-black text-white tabular-nums">{calcResenas}</span>
                    </div>
                    <input
                      type="range" min={1} max={150} value={calcResenas}
                      onChange={e => setCalcResenas(+e.target.value)}
                      className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-1.5">
                      <span>1</span><span>150</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-300 block mb-3">Precio de tu hora</label>
                    <div className="inline-flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                      <button type="button" onClick={() => setCalcPrecioHora(p => Math.max(5, p - 5))}
                        className="px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-lg font-bold select-none">−</button>
                      <span className="px-4 py-2.5 text-white font-black tabular-nums min-w-[80px] text-center text-sm">{calcPrecioHora}€/h</span>
                      <button type="button" onClick={() => setCalcPrecioHora(p => Math.min(500, p + 5))}
                        className="px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-lg font-bold select-none">+</button>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900/70 rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Sin Velacre <span className="text-slate-600 text-xs">(6 min/reseña)</span></span>
                      <span className="text-slate-300 font-semibold tabular-nums">{minSin} min</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Con Velacre <span className="text-slate-600 text-xs">(5 seg/reseña)</span></span>
                      <span className="text-emerald-400 font-semibold tabular-nums">{minCon} min</span>
                    </div>
                    <div className="h-px bg-slate-800" />
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Ahorras al mes</p>
                      <motion.p
                        key={`${ahorroH}-${ahorroM}`}
                        initial={{ opacity: 0.6, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-3xl font-black text-white tabular-nums leading-tight"
                      >
                        {ahorroH > 0 ? `${ahorroH}h ` : ''}{ahorroM > 0 ? `${ahorroM}min` : ''}
                      </motion.p>
                      <motion.p
                        key={ahorroEuros}
                        initial={{ opacity: 0.6 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="text-blue-400 font-bold mt-0.5"
                      >
                        {ahorroEuros}€ de tu tiempo
                      </motion.p>
                    </div>
                  </div>
                  <Link href="/auth/register"
                    className="block text-center py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors">
                    Empieza gratis →
                  </Link>
                </div>
              </div>
            </div>
          </FadeInUp>
        )
      })()}

      {/* ── DEMO IA ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <FadeInUp className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{l.demo.h2}</h2>
          <p className="text-slate-300 max-w-xl mx-auto">{l.demo.p}</p>
        </FadeInUp>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Review card */}
          <FadeInUp delay={0.05}>
            <GlowCard className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold text-slate-300">C</div>
                  <div>
                    <div className="text-sm font-semibold text-white">Carlos M.</div>
                    <div className="text-xs text-slate-500">{l.demo.review.date}</div>
                  </div>
                </div>
                <div className="flex text-amber-400 text-sm">★★☆☆☆</div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{l.demo.review.text}</p>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs bg-slate-800 text-slate-500 px-2 py-1 rounded-full">Google Maps</span>
                <span className="text-xs bg-red-950 text-red-400 border border-red-900 px-2 py-1 rounded-full">{l.demo.review.negativeBadge}</span>
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
                  <span className="ml-auto text-xs text-blue-500 animate-pulse">Generando…</span>
                )}
              </div>

              {/* Tone selector */}
              <div className="flex gap-2">
                {toneKeys.map(key => (
                  <motion.button
                    key={key}
                    onClick={() => setSelectedTone(key)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                      selectedTone === key
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/50'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}
                  >
                    {l.demo.response.tones[key].label}
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
                      key={selectedTone}
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
                    className="flex items-center justify-between pt-2 border-t border-slate-800"
                  >
                    <span className="text-xs text-slate-400">{l.demo.response.cta}</span>
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

      {/* ── HEALTH PANEL ── */}
      <section className="bg-slate-900/50 border-y border-slate-800 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <FadeInUp className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">{l.health.h2}</h2>
            <p className="text-slate-400 max-w-xl mx-auto">{l.health.p}</p>
          </FadeInUp>

          <FadeInUp delay={0.1}>
            <GlowCard className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: l.health.kpi1, value: '4.3', sub: l.health.prevMonth, extra: <span className="text-emerald-400 text-sm mb-1 font-semibold">▲ 0.2</span> },
                  { label: l.health.kpi2, value: '68%', sub: l.health.reviewsOf, extra: null },
                  { label: l.health.kpi3, value: '12', sub: l.health.newReviews, extra: null },
                ].map((kpi, i) => (
                  <motion.div key={i} whileHover={{ scale: 1.03 }} transition={{ duration: 0.15 }}
                    className="bg-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-500 mb-1">{kpi.label}</div>
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold text-white">{kpi.value}</span>
                      {i === 0 && <span className="text-amber-400 text-lg mb-0.5">★</span>}
                      {kpi.extra}
                    </div>
                    <div className="text-xs text-slate-500">{kpi.sub}</div>
                  </motion.div>
                ))}
              </div>

              <div className="mb-6">
                <div className="text-xs text-slate-500 mb-2">{l.health.sentiment}</div>
                <div className="flex rounded-full overflow-hidden h-5">
                  <div className="bg-emerald-500 flex items-center justify-center text-white text-xs font-semibold" style={{ width: '62%' }}>62%</div>
                  <div className="bg-amber-400 flex items-center justify-center text-white text-xs font-semibold" style={{ width: '18%' }}>18%</div>
                  <div className="bg-red-500 flex items-center justify-center text-white text-xs font-semibold" style={{ width: '20%' }}>20%</div>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{l.health.positive} {l.health.positiveCount}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{l.health.neutral} {l.health.neutralCount}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{l.health.negative} {l.health.negativeCount}</span>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-2">{l.health.keywords}</div>
                <div className="flex flex-wrap gap-2">
                  {l.health.kwords.map((kw, i) => (
                    <motion.span key={kw.w} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.3 }}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        kw.s === 'positive' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800' :
                        kw.s === 'negative' ? 'bg-red-900/40 text-red-300 border border-red-800' :
                        'bg-slate-700 text-slate-300 border border-slate-600'
                      }`}>{kw.w}</motion.span>
                  ))}
                </div>
              </div>
            </GlowCard>
          </FadeInUp>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <FadeInUp className="mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{l.howto.h2}</h2>
          <p className="text-slate-400 max-w-xl">{l.howto.p}</p>
        </FadeInUp>
        <div>
          {l.howto.steps.map((step, index) => {
            const num = String(index + 1).padStart(2, '0')
            return (
              <FadeInUp key={num} delay={index * 0.1}>
                <div className="flex gap-8 md:gap-12 items-start py-10 border-b border-slate-800/60 last:border-0 group">
                  <div className="shrink-0 w-16 md:w-24 pt-1">
                    <span className="text-6xl md:text-7xl font-black text-slate-800 leading-none select-none group-hover:text-blue-900/60 transition-colors duration-300">
                      {num}
                    </span>
                  </div>
                  <div className="flex-1 pt-1.5">
                    <span className="text-xs font-bold text-blue-500 tracking-widest uppercase block mb-3">{l.howto.stepLabel} {num}</span>
                    <h3 className="text-xl md:text-2xl font-black text-white mb-3">{step.title}</h3>
                    <p className="text-slate-400 leading-relaxed max-w-lg">{step.desc}</p>
                  </div>
                </div>
              </FadeInUp>
            )
          })}
        </div>
      </section>

      {/* ── FOR WHO ── */}
      <section className="bg-slate-900/50 border-y border-slate-800 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <FadeInUp>
            <h2 className="text-3xl font-bold text-white mb-3">{l.forWho.h2}</h2>
            <p className="text-slate-400 mb-10 max-w-xl mx-auto">{l.forWho.p}</p>
          </FadeInUp>
          <div className="flex flex-wrap justify-center gap-3">
            {l.forWho.sectors.map((sector, i) => (
              <motion.span key={sector}
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
                whileHover={{ borderColor: 'rgba(59,130,246,0.5)', color: '#e2e8f0' }}
                className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium rounded-full cursor-default"
              >
                {sector}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="precios" className="max-w-5xl mx-auto px-6 py-24">
        <FadeInUp className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{l.pricing.h2}</h2>
          <p className="text-slate-300">{l.pricing.p}</p>
        </FadeInUp>

        <FadeInUp delay={0.05} className="flex flex-col items-center gap-2 mb-12">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium transition-colors ${!billingYearly ? 'text-white' : 'text-slate-500'}`}>{l.pricing.monthly}</span>
            <button type="button" onClick={() => setBillingYearly(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors ${billingYearly ? 'bg-blue-600' : 'bg-slate-700'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${billingYearly ? 'left-7' : 'left-1'}`} />
            </button>
            <span className={`text-sm font-medium transition-colors ${billingYearly ? 'text-white' : 'text-slate-500'}`}>{l.pricing.yearly}</span>
          </div>
          <div className="h-6 flex items-center">
            <AnimatePresence>
              {billingYearly && (
                <motion.span initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs font-semibold bg-emerald-900/60 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full">
                  {l.pricing.yearlySave}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </FadeInUp>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          <FadeInUp delay={0}>
            <GlowCard className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-full">
              <div className="mb-5">
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-2">{l.pricing.plans.basic.name}</p>
                <p className="text-4xl font-bold text-white mb-1">{l.pricing.plans.basic.price}</p>
                <p className="text-xs text-slate-500">&nbsp;</p>
              </div>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">{l.pricing.plans.basic.desc}</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {l.pricing.plans.basic.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300"><CheckIcon />{f}</li>
                ))}
              </ul>
              <Link href="/auth/register"
                className="block text-center py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors">
                {l.pricing.plans.basic.cta}
              </Link>
            </GlowCard>
          </FadeInUp>

          <FadeInUp delay={0.08}>
            <GlowCard className="bg-slate-900 border border-slate-600 rounded-2xl p-6 flex flex-col h-full relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold bg-slate-600 text-white px-3 py-1 rounded-full whitespace-nowrap">
                Más popular
              </span>
              <div className="mb-5">
                <p className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-2">{l.pricing.plans.core.name}</p>
                <div className="flex items-end gap-1.5">
                  <p className="text-4xl font-bold text-white">
                    {billingYearly ? l.pricing.plans.core.priceYearlyMonthly : l.pricing.plans.core.priceMonthly}
                  </p>
                  <p className="text-slate-500 text-sm mb-1.5">{l.pricing.perMonth}</p>
                </div>
                {billingYearly && <p className="text-xs text-slate-500">{l.pricing.plans.core.priceYearly}{l.pricing.perYear}</p>}
              </div>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">{l.pricing.plans.core.desc}</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {l.pricing.plans.core.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300"><CheckIcon />{f}</li>
                ))}
              </ul>
              <Link href="/auth/register"
                className="block text-center py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white text-sm font-semibold transition-colors">
                {l.pricing.plans.core.cta}
              </Link>
            </GlowCard>
          </FadeInUp>

          <FadeInUp delay={0.16}>
            <GlowCard className="bg-blue-950/60 border border-blue-800 rounded-2xl p-6 flex flex-col h-full relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold bg-blue-600 text-white px-3 py-1 rounded-full">
                {l.pricing.plans.pro.badge}
              </span>
              <div className="mb-5">
                <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-2">{l.pricing.plans.pro.name}</p>
                <div className="flex items-end gap-1.5">
                  <p className="text-4xl font-bold text-white">
                    {billingYearly ? l.pricing.plans.pro.priceYearlyMonthly : l.pricing.plans.pro.priceMonthly}
                  </p>
                  <p className="text-slate-400 text-sm mb-1.5">{l.pricing.perMonth}</p>
                </div>
                {billingYearly && <p className="text-xs text-slate-400">{l.pricing.plans.pro.priceYearly}{l.pricing.perYear}</p>}
              </div>
              <p className="text-sm text-slate-300 mb-6 leading-relaxed">{l.pricing.plans.pro.desc}</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {l.pricing.plans.pro.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-200"><CheckIcon />{f}</li>
                ))}
              </ul>
              <Link href="/auth/register"
                className="block text-center py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
                {l.pricing.plans.pro.cta}
              </Link>
            </GlowCard>
          </FadeInUp>
        </div>

        {/* ── Features transversales incluidas en todos los planes ── */}
        <FadeInUp>
          <div className="max-w-4xl mx-auto mt-10 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-7">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-4 text-center">
              {l.pricing.transversalTitle}
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {l.pricing.transversalItems.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </FadeInUp>

        <p className="text-center text-xs text-slate-600 mt-6">{l.pricing.vatNote}</p>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative overflow-hidden py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-700/30 rounded-full blur-3xl" />
        </div>
        <FadeInUp className="relative max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            {l.cta.h2line1}<br />{l.cta.h2line2}
          </h2>
          <p className="text-slate-300 text-lg mb-10">{l.cta.p}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleGoogleSignup}
              disabled={googleLoading}
              className="flex items-center justify-center gap-3 px-8 py-4 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-xl text-base transition-colors disabled:opacity-70 shadow-xl"
            >
              <GoogleIcon />
              {googleLoading ? l.cta.ctaGoogleLoading : l.cta.ctaGoogle}
            </motion.button>
          </div>
          <p className="text-sm text-slate-600 mt-4">{l.cta.setup}</p>
        </FadeInUp>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-slate-400 text-sm">{l.footer.rights}</span>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <Link href="/privacidad" className="hover:text-slate-300 transition-colors">{l.footer.privacy}</Link>
            <Link href="/terminos" className="hover:text-slate-300 transition-colors">{l.footer.terms}</Link>
            <Link href="/contacto" className="hover:text-slate-300 transition-colors">{l.footer.contact}</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
