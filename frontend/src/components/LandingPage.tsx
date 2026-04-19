'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { useOAuthLoading } from '@/hooks/useOAuthLoading'
import './landing/landing.css'
import { GoogleIcon } from './landing/shared'
import { VelacreMark } from './landing/VelacreMark'
import { NavBar } from './landing/NavBar'
import { FooterEditorial } from './landing/FooterEditorial'
import { CountUp } from './landing/CountUp'
import HeroSection from './landing/HeroSection'
import RadarPreviewSection from './landing/RadarPreviewSection'
import DemoSection from './landing/DemoSection'
import PricingSection from './landing/PricingSection'

export default function LandingPage() {
  const { t: l } = useLanguage()
  const e = l.landingEditorial
  const [googleLoading, setGoogleLoading] = useOAuthLoading()
  const rootRef = useRef<HTMLDivElement>(null)

  async function handleGoogleSignup() {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const targets = Array.from(
      root.querySelectorAll<HTMLElement>('.sec, .stats, .final, .radar-card, .health-card, .pricing-grid, .transv'),
    )
    targets.forEach(t => t.classList.add('fade'))
    const obs = new IntersectionObserver(
      ents => {
        ents.forEach(ent => {
          if (ent.isIntersecting) {
            ent.target.classList.add('in')
            obs.unobserve(ent.target)
          }
        })
      },
      { threshold: 0.06, rootMargin: '-40px' },
    )
    targets.forEach(t => obs.observe(t))
    return () => obs.disconnect()
  }, [])

  return (
    <div className="vel-lp" ref={rootRef}>
      <NavBar variant="landing" />

      <main className="lp-main">
        {/* ===== HERO ===== */}
        <HeroSection googleLoading={googleLoading} onGoogleSignup={handleGoogleSignup} />

        {/* ===== STATS ===== */}
        <section className="stats sec-stats">
          <div className="wrap">
            <div className="stats-grid">
              <div className="stats-cell">
                <div className="stats-num">{l.stats.s1val}</div>
                <div className="stats-lbl">{l.stats.s1label}</div>
              </div>
              <div className="stats-cell">
                <div className="stats-num">{l.stats.s2val}</div>
                <div className="stats-lbl">{l.stats.s2label}</div>
              </div>
              <div className="stats-cell">
                <div className="stats-num">
                  <span className="accent">{l.stats.s3val}</span>
                </div>
                <div className="stats-lbl">{l.stats.s3label}</div>
              </div>
              <div className="stats-cell">
                <div className="stats-num">
                  {e.stats.s4val}
                  <span className="dim" style={{ fontSize: '0.55em' }}>€</span>
                </div>
                <div className="stats-lbl">{e.stats.s4label}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== DEMO ===== */}
        <DemoSection />

        {/* ===== RADAR ===== */}
        <RadarPreviewSection />

        {/* ===== HEALTH ===== */}
        <section className="sec wrap sec-health" id="salud">
          <div className="sec-head">
            <div className="sec-idx">
              <span className="num">03</span>
              {e.sections.health}
            </div>
            <div>
              <h2>
                {e.health.h2l1}
                <br />
                {e.health.h2l2}
              </h2>
              <p className="sec-lede">{e.health.lede}</p>
            </div>
          </div>

          <div className="dark">
            {/* 4 KPI cards — grid 2×2 móvil, 4-col desktop. Estilo real dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Nota media */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-slate-500 font-semibold mb-2">{l.health.kpi1}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] md:text-[34px] font-bold text-white tabular-nums leading-none">
                    <CountUp value={4.3} decimals={1} />
                  </span>
                  <span className="text-amber-400 text-lg">★</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="font-mono text-[10px] text-emerald-400 tabular-nums">+0.2</span>
                  <span className="text-[11px] text-slate-500">{l.health.prevMonth}</span>
                </div>
              </div>

              {/* Índice de respuesta */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-slate-500 font-semibold mb-2">{l.health.kpi2}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] md:text-[34px] font-bold text-white tabular-nums leading-none">
                    <CountUp value={68} />
                  </span>
                  <span className="text-slate-400 text-lg">%</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5">{l.health.reviewsOf}</div>
                <div
                  className="flex h-[4px] rounded-full overflow-hidden mt-2"
                  title={`${l.health.positive} 62% · ${l.health.neutral} 18% · ${l.health.negative} 20%`}
                >
                  <div className="bg-emerald-500" style={{ flex: 62 }} />
                  <div className="bg-amber-500" style={{ flex: 18 }} />
                  <div className="bg-red-500" style={{ flex: 20 }} />
                </div>
              </div>

              {/* Reseñas este mes */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-slate-500 font-semibold mb-2">{l.health.kpi3}</p>
                <div className="text-[28px] md:text-[34px] font-bold text-white tabular-nums leading-none">
                  <CountUp value={12} />
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5">{l.health.newReviews}</div>
              </div>

              {/* Velocidad */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-slate-500 font-semibold mb-2">{e.health.kpi4lbl}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] md:text-[34px] font-bold text-white tabular-nums leading-none">
                    <CountUp value={14} />
                  </span>
                  <span className="text-slate-400 text-lg">h</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5">{e.health.kpi4sub}</div>
              </div>
            </div>

            {/* 3 AI cards — estilo real dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div className="bg-emerald-950 border border-emerald-900 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-emerald-400 font-semibold">{l.health.brillaLabel}</p>
                </div>
                <p className="text-[13px] leading-relaxed text-slate-200">{l.health.brillaText}</p>
              </div>
              <div className="bg-red-950 border border-red-900 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-red-400 font-semibold">{l.health.quemaLabel}</p>
                </div>
                <p className="text-[13px] leading-relaxed text-slate-200">{l.health.quemaText}</p>
              </div>
              <div className="bg-blue-950 border border-blue-900 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-blue-400 font-semibold">{l.health.accionLabel}</p>
                </div>
                <p className="text-[13px] leading-relaxed text-slate-200">{l.health.accionText}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section className="sec wrap sec-howto">
          <div>
            <div className="sec-head">
              <div className="sec-idx">
                <span className="num">04</span>
                {e.sections.flow}
              </div>
              <div>
                <h2>
                  {e.howto.h2l1}
                  <br />
                  {e.howto.h2l2}
                </h2>
                <p className="sec-lede">{e.howto.lede}</p>
              </div>
            </div>
            <div className="steps">
              {l.howto.steps.map((step, i) => {
                const num = String(i + 1).padStart(2, '0')
                return (
                  <div className="step" key={num}>
                    <div className="step-n">
                      <span className="big">{num}</span>
                      {l.howto.stepLabel}
                    </div>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ===== FOR WHO ===== */}
        <section className="sec wrap sec-who">
          <div className="sec-head">
            <div className="sec-idx">
              <span className="num">05</span>
              {e.sections.who}
            </div>
            <div>
              <h2>
                {e.forWho.h2l1}
                <br />
                {e.forWho.h2l2}
              </h2>
              <p className="sec-lede">{e.forWho.lede}</p>
            </div>
          </div>
          <div className="sectors">
            {e.forWho.sectors.map(s => (
              <span className="sector" key={s}>{s}</span>
            ))}
          </div>
        </section>

        {/* ===== PRICING ===== */}
        <PricingSection />

        {/* ===== FINAL CTA ===== */}
        <section className="final sec-final">
          <div className="mark-bg" aria-hidden="true">
            <VelacreMark size={420} />
          </div>
          <div className="final-inner">
            <div className="sec-idx final-idx">
              <span className="num">07</span>
              {e.sections.start}
            </div>
            <h2>
              {e.cta.h2l1}
              <br />
              {e.cta.h2l2}
            </h2>
            <p className="hero-sub">
              {e.cta.sub}
            </p>
            <div className="hero-cta">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGoogleSignup}
                disabled={googleLoading}
              >
                <GoogleIcon />
                {googleLoading ? l.cta.ctaGoogleLoading : l.cta.ctaGoogle}
              </button>
              <Link href="/auth/register" className="btn btn-ghost">
                {l.hero.ctaEmail} →
              </Link>
            </div>
            <p className="final-foot">{e.cta.foot}</p>
          </div>
        </section>
      </main>

      <FooterEditorial />
    </div>
  )
}
