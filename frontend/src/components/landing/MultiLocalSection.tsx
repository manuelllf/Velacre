'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import { CheckIcon, handleAnchorClick } from './shared'
import { SectionHelp } from './SectionHelp'

/**
 * Sección "Multi-local" — explica el soporte multi-negocio como feature Pro
 * con pricing concreto (+20 €/mes por local adicional, hasta 5). Ubicada entre
 * "Para quién" (§05) y el strip de datos / Pricing. SEO: cola larga
 * "gestión reseñas multi-local", "software varios locales", "cadena restaurantes".
 */
export default function MultiLocalSection() {
  const { t: l } = useLanguage()
  const e = l.landingEditorial
  const m = e.multilocal

  return (
    <section className="sec wrap sec-multi" id="multi-local">
      <div className="sec-head">
        <div className="sec-idx">
          <span className="num">·</span>
          {e.sections.multilocal}
          <SectionHelp text={e.sectionsHelp.multilocal} />
        </div>
        <div>
          <h2>
            {m.h2l1}
            <br />
            {m.h2l2}
          </h2>
          <p className="sec-lede">{m.lede}</p>
        </div>
      </div>

      <div className="multi-card">
        <div className="multi-card-head">
          <span className="multi-badge">{m.badge}</span>
          <span className="multi-price">{m.pricingLine}</span>
        </div>

        <ul className="multi-feats">
          {m.features.map(f => (
            <li key={f}>
              <CheckIcon size={18} />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="multi-cta">
          <Link
            href="#precios"
            className="btn btn-ghost"
            onClick={ev => handleAnchorClick(ev, '#precios')}
          >
            {m.cta} →
          </Link>
        </div>
      </div>
    </section>
  )
}
