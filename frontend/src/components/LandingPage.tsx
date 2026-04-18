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

      {/* ===== HERO ===== */}
      <HeroSection googleLoading={googleLoading} onGoogleSignup={handleGoogleSignup} />

      {/* ===== STATS ===== */}
      <section className="stats">
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

      <div className="wrap">
        <hr className="rule-strong" />
      </div>

      {/* ===== RADAR ===== */}
      <RadarPreviewSection />

      <div className="wrap">
        <hr className="rule-strong" />
      </div>

      {/* ===== HEALTH ===== */}
      <section className="sec wrap" id="salud">
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

        <div className="health-card">
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-lbl">{l.health.kpi1}</div>
              <div className="kpi-val">
                <CountUp value={4.3} decimals={1} /> <span className="star">★</span>
                <span className="delta">+0.2</span>
              </div>
              <div className="kpi-sub">{l.health.prevMonth}</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">{l.health.kpi2}</div>
              <div className="kpi-val">
                <CountUp value={68} /><span className="unit">%</span>
              </div>
              <div className="kpi-sub">{l.health.reviewsOf}</div>
              <div className="kpi-sent" title={`${l.health.positive} 62% · ${l.health.neutral} 18% · ${l.health.negative} 20%`}>
                <div className="sent-good" style={{ flex: 62 }} />
                <div className="sent-mid" style={{ flex: 18 }} />
                <div className="sent-bad" style={{ flex: 20 }} />
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">{l.health.kpi3}</div>
              <div className="kpi-val"><CountUp value={12} /></div>
              <div className="kpi-sub">{l.health.newReviews}</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">{e.health.kpi4lbl}</div>
              <div className="kpi-val">
                <CountUp value={14} /><span className="unit">h</span>
              </div>
              <div className="kpi-sub">{e.health.kpi4sub}</div>
            </div>
          </div>

          <div className="ai-grid">
            <div className="ai-card ai-brilla">
              <div className="ai-lbl">+ {l.health.brillaLabel}</div>
              <p>{l.health.brillaText}</p>
            </div>
            <div className="ai-card ai-quema">
              <div className="ai-lbl">− {l.health.quemaLabel}</div>
              <p>{l.health.quemaText}</p>
            </div>
            <div className="ai-card ai-accion">
              <div className="ai-lbl">→ {l.health.accionLabel}</div>
              <p>{l.health.accionText}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap">
        <hr className="rule-strong" />
      </div>

      {/* ===== HOW IT WORKS ===== */}
      <section className="sec wrap">
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
                    {l.howto.stepLabel} {num}
                  </div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                  </div>
                  <div className="step-asset" aria-hidden="true">
                    <svg viewBox="0 0 160 80" fill="none" style={{ width: '100%' }}>
                      <rect x="1" y="1" width="158" height="78" stroke="currentColor" strokeWidth="1" opacity="0.3" />
                      {i === 0 && (
                        <>
                          <circle cx="22" cy="40" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.6" fill="none" />
                          <rect x="42" y="32" width="100" height="5" fill="currentColor" opacity="0.3" />
                          <rect x="42" y="43" width="70" height="4" fill="currentColor" opacity="0.18" />
                        </>
                      )}
                      {i === 1 && (
                        <>
                          <rect x="14" y="14" width="54" height="12" fill="currentColor" opacity="0.5" />
                          <rect x="14" y="32" width="130" height="4" fill="currentColor" opacity="0.2" />
                          <rect x="14" y="42" width="110" height="4" fill="currentColor" opacity="0.2" />
                          <rect x="14" y="52" width="80" height="4" fill="currentColor" opacity="0.2" />
                          <rect x="116" y="60" width="30" height="10" fill="#4A6FE5" />
                        </>
                      )}
                      {i === 2 && (
                        <>
                          <rect x="14" y="50" width="14" height="18" fill="currentColor" opacity="0.35" />
                          <rect x="34" y="40" width="14" height="28" fill="currentColor" opacity="0.55" />
                          <rect x="54" y="28" width="14" height="40" fill="#4A6FE5" />
                          <rect x="74" y="44" width="14" height="24" fill="currentColor" opacity="0.45" />
                          <rect x="94" y="36" width="14" height="32" fill="currentColor" opacity="0.55" />
                          <rect x="114" y="20" width="14" height="48" fill="#4A6FE5" />
                          <rect x="134" y="32" width="14" height="36" fill="currentColor" opacity="0.5" />
                        </>
                      )}
                    </svg>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <div className="wrap">
        <hr className="rule-strong" />
      </div>

      {/* ===== FOR WHO ===== */}
      <section className="sec wrap">
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

      <div className="wrap">
        <hr className="rule-strong" />
      </div>

      {/* ===== PRICING ===== */}
      <PricingSection />

      {/* ===== FINAL CTA ===== */}
      <section className="final">
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
          <p className="hero-sub" style={{ margin: '0 auto', textAlign: 'center' }}>
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

      <FooterEditorial />
    </div>
  )
}
