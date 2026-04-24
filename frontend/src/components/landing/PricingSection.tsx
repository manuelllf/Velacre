'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import { CheckIcon } from './shared'
import { SectionHelp } from './SectionHelp'

function priceNumber(raw: string): string {
  const m = raw.match(/(\d+[.,]?\d*)/)
  return m ? m[1].replace(',', '.') : raw
}

export default function PricingSection() {
  const { t: l } = useLanguage()
  const e = l.landingEditorial
  const [yearly, setYearly] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(e.founding.code)
      setCopied(true)
    } catch {
      setCopied(true)
    }
  }
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  const coreM = priceNumber(l.pricing.plans.core.priceMonthly)
  const coreYMonthly = priceNumber(l.pricing.plans.core.priceYearlyMonthly)
  const proM = priceNumber(l.pricing.plans.pro.priceMonthly)
  const proYMonthly = priceNumber(l.pricing.plans.pro.priceYearlyMonthly)

  return (
    <section className="sec wrap sec-price" id="precios">
      <div className="sec-head">
        <div className="sec-idx">
          <span className="num">05</span>
          {e.sections.pricing}
          <SectionHelp text={e.sectionsHelp.pricing} />
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

      {/* Founding price banner — va arriba: lo importante (descuento)
          antes del switch de periodicidad. */}
      <div className="founding">
        <span className="founding-lbl">{e.founding.label}</span>
        <div className="founding-head">{e.founding.headline}</div>
        <p className="founding-meta" style={{ margin: 0 }}>{e.founding.meta}</p>
        <div className="founding-code">
          <span className="code-label">{e.founding.codeLabel}</span>
          <span className="code-value">{e.founding.code}</span>
          <button
            type="button"
            className={`code-copy ${copied ? 'copied' : ''}`}
            onClick={copyCode}
          >
            {copied ? e.founding.copied : e.founding.copy}
          </button>
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

      {/* Compare table — sin nombrar competencia */}
      <div className="compare">
        <div className="compare-head">
          <span className="lbl">{e.compare.label}</span>
          <p>{e.compare.lede}</p>
        </div>
        {/* Móvil: cards apiladas por competidor */}
        <div className="compare-cards">
          {[2, 0, 1].map(idx => (
            <div key={idx} className={`compare-card ${idx === 2 ? 'us' : ''}`}>
              <div className="compare-card-head">
                <span className="compare-card-name">{e.compare.headers[idx]}</span>
                <span className={`compare-card-price ${idx === 2 ? 'us' : ''}`}>
                  {e.compare.priceRow.values[idx]}
                  <span className="per">/{e.compare.priceRow.lbl.toLowerCase().includes('mensual') || e.compare.priceRow.lbl.toLowerCase().includes('month') ? 'mes' : ''}</span>
                </span>
              </div>
              <ul className="compare-card-list">
                {e.compare.rows.map((row, i) => {
                  const v = row.values[idx]
                  return (
                    <li key={i}>
                      {v === 'soon' ? (
                        <span className="soon" aria-label={e.compare.soonLabel}>•</span>
                      ) : (
                        <span className={v ? 'yes' : 'no'}>{v ? '✓' : '✗'}</span>
                      )}
                      <span className="lbl">
                        {row.lbl}
                        {v === 'soon' && <span className="soon-badge">{e.compare.soonLabel}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Desktop: tabla */}
        <div className="compare-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th></th>
                <th className="center">{e.compare.headers[0]}</th>
                <th className="center">{e.compare.headers[1]}</th>
                <th className="us center">{e.compare.headers[2]}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{e.compare.priceRow.lbl}</td>
                <td className="center"><span className="price">{e.compare.priceRow.values[0]}</span></td>
                <td className="center"><span className="price">{e.compare.priceRow.values[1]}</span></td>
                <td className="us center"><span className="price us">{e.compare.priceRow.values[2]}</span></td>
              </tr>
              {e.compare.rows.map((row, i) => {
                const cell = (v: boolean | 'soon', us = false) =>
                  v === 'soon' ? (
                    <span className="soon-badge">{e.compare.soonLabel}</span>
                  ) : (
                    <span className={v ? (us ? 'yes us' : 'yes') : 'no'}>{v ? '✓' : '✗'}</span>
                  )
                return (
                  <tr key={i}>
                    <td>{row.lbl}</td>
                    <td className="center">{cell(row.values[0])}</td>
                    <td className="center">{cell(row.values[1])}</td>
                    <td className="us center">{cell(row.values[2], true)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="compare-foot">{e.compare.foot}</p>
      </div>
    </section>
  )
}
