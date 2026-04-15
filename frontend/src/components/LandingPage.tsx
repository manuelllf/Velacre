'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { FadeInUp, GlowCard, GoogleIcon } from './landing/shared'

import HeroSection from './landing/HeroSection'
import RadarPreviewSection from './landing/RadarPreviewSection'
import DemoSection from './landing/DemoSection'
import PricingSection from './landing/PricingSection'

export default function LandingPage() {
  const { t: l } = useLanguage()
  const [googleLoading, setGoogleLoading] = useState(false)

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

      <HeroSection googleLoading={googleLoading} onGoogleSignup={handleGoogleSignup} />

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

      <RadarPreviewSection />

      <DemoSection />

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

              {/* AI Analysis cards */}
              <div className="grid md:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800">
                <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-xl p-4 relative">
                  <div className="text-xs font-semibold text-emerald-400 mb-2">+ {l.health.brillaLabel}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{l.health.brillaText}</p>
                </div>
                <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4 relative">
                  <div className="text-xs font-semibold text-red-400 mb-2">− {l.health.quemaLabel}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{l.health.quemaText}</p>
                </div>
                <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-4 relative">
                  <div className="text-xs font-semibold text-blue-400 mb-2">→ {l.health.accionLabel}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{l.health.accionText}</p>
                </div>
              </div>
              <div className="flex justify-center mt-4">
                <span className="text-xs font-bold text-slate-500 bg-slate-800 px-3 py-1 rounded-full">{l.health.proBadge}</span>
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

      <PricingSection />

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
