'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { useOAuthLoading } from '@/hooks/useOAuthLoading'
import './landing/landing.css'
import { GoogleIcon } from './landing/shared'
import { VelacreMark } from './landing/VelacreMark'
import { SectionHelp } from './landing/SectionHelp'
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
              <SectionHelp text={e.sectionsHelp.health} />
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

          <div className="salud-mod">
            {/* 4 KPIs — 1 módulo unificado con zonas en móvil, 4 cards desktop */}
            <div className="salud-kpis">
              <div className="salud-kpi">
                <div className="lbl">{l.health.kpi1}</div>
                <div className="val">
                  <CountUp value={4.3} decimals={1} />
                  <span className="star">★</span>
                </div>
                <div>
                  <span className="delta">+0.2</span>
                  <span className="sub" style={{ marginLeft: 6 }}>{l.health.prevMonth}</span>
                </div>
              </div>
              <div className="salud-kpi">
                <div className="lbl">{l.health.kpi2}</div>
                <div className="val">
                  <CountUp value={68} />
                  <span className="unit">%</span>
                </div>
                <div className="sub">{l.health.reviewsOf}</div>
                <div
                  className="salud-sent"
                  title={`${l.health.positive} 62% · ${l.health.neutral} 18% · ${l.health.negative} 20%`}
                >
                  <div style={{ flex: 62, background: 'var(--good)' }} />
                  <div style={{ flex: 18, background: 'var(--warn)' }} />
                  <div style={{ flex: 20, background: 'var(--danger)' }} />
                </div>
              </div>
              <div className="salud-kpi">
                <div className="lbl">{l.health.kpi3}</div>
                <div className="val"><CountUp value={12} /></div>
                <div className="sub">{l.health.newReviews}</div>
              </div>
              <div className="salud-kpi">
                <div className="lbl">{e.health.kpi4lbl}</div>
                <div className="val">
                  <CountUp value={14} />
                  <span className="unit">h</span>
                </div>
                <div className="sub">{e.health.kpi4sub}</div>
              </div>
            </div>

            {/* 3 AI rows — stacked con barra lateral en móvil, cards desktop */}
            <div className="salud-ai">
              <div className="salud-ai-row ai-brilla">
                <div className="lbl">{l.health.brillaLabel}</div>
                <p>{l.health.brillaText}</p>
              </div>
              <div className="salud-ai-row ai-quema">
                <div className="lbl">{l.health.quemaLabel}</div>
                <p>{l.health.quemaText}</p>
              </div>
              <div className="salud-ai-row ai-accion">
                <div className="lbl">{l.health.accionLabel}</div>
                <p>{l.health.accionText}</p>
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
