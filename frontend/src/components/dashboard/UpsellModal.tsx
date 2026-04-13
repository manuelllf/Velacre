'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n'
import { getLemonCheckoutUrl, type PendingReview } from '@/lib/api'

export interface UpsellModalProps {
  show: boolean
  upsellInfo: { plan: string; limit: number; used: number } | null
  reviews: PendingReview[]
  onClose: () => void
}

export default function UpsellModal({ show, upsellInfo, reviews, onClose }: UpsellModalProps) {
  const { t } = useLanguage()
  const d = t.app.dashboard
  const [checkoutLoading, setCheckoutLoading] = useState<'core' | 'pro' | null>(null)

  if (!show) return null

  const pendingCount = reviews.filter(r => !r.tonoGenerado && r.estado !== 'ignorada').length
  const isPro = upsellInfo?.plan === 'pro'
  const isCore = upsellInfo?.plan === 'core'

  async function handleCheckout(plan: 'core' | 'pro') {
    setCheckoutLoading(plan)
    try { window.location.href = await getLemonCheckoutUrl(plan) }
    finally { setCheckoutLoading(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Franja roja top */}
        <div className="h-1 w-full bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-900/50 border border-red-800/60 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isPro ? d.upsell.titlePro : isCore ? d.upsell.titleCore : d.upsell.titleBasic}
              </h3>
              <p className="text-sm text-slate-400 mt-0.5">
                {isPro
                  ? d.upsell.descPro
                  : isCore
                    ? d.upsell.descCore
                    : d.upsell.descBasic}
              </p>
            </div>
          </div>

          {pendingCount > 0 && (
            <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-300 font-medium">
                {d.upsell.pendingMsg.replace('{count}', String(pendingCount))}
              </p>
              <p className="text-xs text-amber-500 mt-0.5">
                {d.upsell.pendingDesc}
              </p>
            </div>
          )}

          <div className="space-y-2 pt-1">
            {isPro ? (
              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors">
                {d.upsell.btnClose}
              </button>
            ) : isCore ? (
              <button
                onClick={() => handleCheckout('pro')}
                disabled={checkoutLoading !== null}
                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors">
                {checkoutLoading === 'pro' ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{t.app.settings.planRedirecting}</> : `${d.upsell.btnPro} \u2192`}
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleCheckout('pro')}
                  disabled={checkoutLoading !== null}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors">
                  {checkoutLoading === 'pro' ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{t.app.settings.planRedirecting}</> : `${d.upsell.btnPro} \u2192`}
                </button>
                <button
                  onClick={() => handleCheckout('core')}
                  disabled={checkoutLoading !== null}
                  className="flex items-center justify-center gap-2 w-full py-2.5 border border-slate-700 hover:bg-slate-800 disabled:opacity-60 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                  {checkoutLoading === 'core' ? <><span className="w-4 h-4 border-2 border-slate-400/40 border-t-slate-300 rounded-full animate-spin" />{t.app.settings.planRedirecting}</> : d.upsell.btnCore}
                </button>
              </>
            )}
            {!isPro && (
              <button
                onClick={onClose}
                className="block w-full py-2 text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                {d.upsell.keepLimit}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
