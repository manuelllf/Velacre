'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { useLanguage } from '@/lib/i18n'
import { FadeInUp, GlowCard, CheckIcon } from './shared'

export default function PricingSection() {
  const { t: l } = useLanguage()
  const [billingYearly, setBillingYearly] = useState(false)

  return (
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

      {/* Features transversales incluidas en todos los planes */}
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
  )
}
