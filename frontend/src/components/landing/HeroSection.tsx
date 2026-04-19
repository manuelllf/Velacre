'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import { GoogleIcon, renderStars } from './shared'

export interface HeroSectionProps {
  googleLoading: boolean
  onGoogleSignup: () => void
}

export default function HeroSection({ googleLoading, onGoogleSignup }: HeroSectionProps) {
  const { t: l } = useLanguage()
  const e = l.landingEditorial
  const tagClass: Record<'positive' | 'complaint' | 'retained', string> = {
    positive: 'tag-ok',
    complaint: 'tag-warn',
    retained: 'tag-bad',
  }
  const tagLabel: Record<'positive' | 'complaint' | 'retained', string> = {
    positive: e.hero.ticker.tagPositive,
    complaint: e.hero.ticker.tagComplaint,
    retained: e.hero.ticker.tagRetained,
  }

  return (
    <section className="hero wrap sec-hero">
      <div className="hero-meta">
        <span className="mono">{e.hero.metaLangs}</span>
        <span className="sep" />
        <span className="mono">{e.hero.metaVersion}</span>
      </div>

      <div className="hero-grid">
        <div>
          <span className="pill">
            <span className="dot" />
            {l.hero.badge}
          </span>
          <h1 style={{ marginTop: 14 }}>
            {e.hero.h1l1}
            <br />
            {e.hero.h1l2pre} <em>{e.hero.h1accent}</em>
            {e.hero.h1l2post.length <= 2 ? (
              e.hero.h1l2post
            ) : (
              <>
                <br />
                {e.hero.h1l2post}
              </>
            )}
          </h1>
          <p className="hero-sub">{e.hero.sub}</p>
          <div className="hero-cta">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onGoogleSignup}
              disabled={googleLoading}
            >
              <GoogleIcon />
              {googleLoading ? l.hero.ctaGoogleLoading : l.hero.ctaGoogle}
            </button>
            <Link href="/auth/register" className="btn btn-ghost">
              {l.hero.ctaEmail} →
            </Link>
          </div>
          <div className="hero-foot">
            {e.hero.foot.map(f => (
              <span key={f}>{f}</span>
            ))}
          </div>
        </div>

        <div className="ticker" aria-hidden="true">
          <div className="ticker-head">
            <span className="mono">
              <span className="dot-live" />
              {e.hero.ticker.title}
            </span>
            <span className="mono">{e.hero.ticker.count}</span>
          </div>
          {e.hero.ticker.items.map(item => (
            <div className="ticker-row" key={item.av + item.name}>
              <div className="ticker-av">{item.av}</div>
              <div className="ticker-txt">
                <div className="ticker-name">{item.name}</div>
                <div className="ticker-prev">{item.preview}</div>
              </div>
              <div className="ticker-st">
                <span className="ticker-stars">{renderStars(item.stars)}</span>
                <span className={`ticker-tag ${tagClass[item.tag]}`}>{tagLabel[item.tag]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
