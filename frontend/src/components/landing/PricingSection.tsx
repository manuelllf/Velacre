'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import { CheckIcon } from './shared'

function priceNumber(raw: string): string {
  const m = raw.match(/(\d+[.,]?\d*)/)
  return m ? m[1].replace(',', '.') : raw
}

export default function PricingSection() {
  const { t: l } = useLanguage()
  const e = l.landingEditorial
  const [yearly, setYearly] = useState(false)

  const coreM = priceNumber(l.pricing.plans.core.priceMonthly)
  const coreYMonthly = priceNumber(l.pricing.plans.core.priceYearlyMonthly)
  const proM = priceNumber(l.pricing.plans.pro.priceMonthly)
  const proYMonthly = priceNumber(l.pricing.plans.pro.priceYearlyMonthly)

  return (
    <section className="sec wrap sec-price" id="precios">
      <div className="sec-head">
        <div className="sec-idx">
          <span className="num">06</span>
          {e.sections.pricing}
        </div>
        <div>
          <h2>
            {e.pricing.h2l1}
            <br />
            {e.pricing.h2l2}
          </h2>
          <p className="sec-lede">{e.pricing.lede}</p>
        </div>
      </div>

      <div className="bill-wrap">
        <div className="bill-toggle">
          <span className={`lbl ${yearly ? '' : 'on'}`}>{l.pricing.monthly}</span>
          <button
            type="button"
            className={`tgl ${yearly ? 'on' : ''}`}
            onClick={() => setYearly(v => !v)}
            aria-label="toggle"
          />
          <span className={`lbl ${yearly ? 'on' : ''}`}>{l.pricing.yearly}</span>
        </div>
        <span className={`save-pill ${yearly ? 'show' : ''}`}>{l.pricing.yearlySave}</span>
      </div>

      <div className="pricing-grid">
        {/* Basic */}
        <div className="plan">
          <div className="plan-head">
            <span className="plan-name">{l.pricing.plans.basic.name}</span>
          </div>
          <div className="plan-price">
            <span className="amt">
              0<span className="cur">€</span>
            </span>
          </div>
          <div className="plan-annual">{e.pricing.basicForever}</div>
          <p className="plan-desc">{l.pricing.plans.basic.desc}</p>
          <ul>
            {l.pricing.plans.basic.features.map(f => (
              <li key={f}>
                <CheckIcon />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link href="/auth/register" className="btn btn-ghost plan-cta">
            {l.pricing.plans.basic.cta}
          </Link>
        </div>

        {/* Core */}
        <div className="plan">
          <div className="plan-head">
            <span className="plan-name">{l.pricing.plans.core.name}</span>
            <span className="plan-badge">{l.pricing.plans.core.badge}</span>
          </div>
          <div className="plan-price">
            <span className="amt">
              {yearly ? coreYMonthly : coreM}
              <span className="cur">€</span>
            </span>
            <span className="per">{e.pricing.perMonth}</span>
          </div>
          <div className="plan-annual">{yearly ? `${l.pricing.plans.core.priceYearly}${l.pricing.perYear}` : '\u00a0'}</div>
          <p className="plan-desc">{l.pricing.plans.core.desc}</p>
          <ul>
            {l.pricing.plans.core.features.map(f => (
              <li key={f}>
                <CheckIcon />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link href="/auth/register" className="btn btn-ghost plan-cta">
            {l.pricing.plans.core.cta} →
          </Link>
        </div>

        {/* Pro */}
        <div className="plan pro">
          <div className="plan-head">
            <span className="plan-name">{l.pricing.plans.pro.name}</span>
            <span className="plan-badge">{l.pricing.plans.pro.badge}</span>
          </div>
          <div className="plan-price">
            <span className="amt">
              {yearly ? proYMonthly : proM}
              <span className="cur">€</span>
            </span>
            <span className="per">{e.pricing.perMonth}</span>
          </div>
          <div className="plan-annual">{yearly ? `${l.pricing.plans.pro.priceYearly}${l.pricing.perYear}` : '\u00a0'}</div>
          <p className="plan-desc">{l.pricing.plans.pro.desc}</p>
          <ul>
            {l.pricing.plans.pro.features.map(f => (
              <li key={f}>
                <CheckIcon />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link href="/auth/register" className="btn btn-accent plan-cta">
            {l.pricing.plans.pro.cta} →
          </Link>
        </div>
      </div>

      <div className="transv">
        <div className="transv-lbl">{l.pricing.transversalTitle}</div>
        <div className="transv-grid">
          {l.pricing.transversalItems.map(item => (
            <div className="transv-item" key={item}>
              <CheckIcon size={16} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mono-sm" style={{ textAlign: 'center', marginTop: 24 }}>
        {l.pricing.vatNote}
      </p>
    </section>
  )
}
