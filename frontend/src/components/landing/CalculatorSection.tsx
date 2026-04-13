'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { FadeInUp } from './shared'

export default function CalculatorSection() {
  const [calcResenas, setCalcResenas] = useState(25)
  const [calcPrecioHora, setCalcPrecioHora] = useState(20)

  const minSin = calcResenas * 6
  const minCon = Math.max(1, Math.ceil((calcResenas * 5) / 60))
  const ahorroMin = minSin - minCon
  const ahorroH = Math.floor(ahorroMin / 60)
  const ahorroM = Math.round(ahorroMin % 60)
  const ahorroEuros = Math.round((ahorroMin / 60) * calcPrecioHora)

  return (
    <FadeInUp className="max-w-4xl mx-auto px-6 py-16">
      <div className="bg-gradient-to-br from-blue-950/50 to-slate-900 border border-blue-900/30 rounded-3xl p-8 md:p-10">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2">¿Cuánto vale tu tiempo?</h2>
          <p className="text-slate-400 text-sm">Calcula lo que te cuesta responder reseñas cada mes.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 md:gap-12">
          <div className="space-y-7">
            <div>
              <div className="flex justify-between items-baseline mb-3">
                <label className="text-sm font-semibold text-slate-300">Reseñas al mes</label>
                <span className="text-2xl font-black text-white tabular-nums">{calcResenas}</span>
              </div>
              <input
                type="range" min={1} max={150} value={calcResenas}
                onChange={e => setCalcResenas(+e.target.value)}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1.5">
                <span>1</span><span>150</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-3">Precio de tu hora</label>
              <div className="inline-flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <button type="button" onClick={() => setCalcPrecioHora(p => Math.max(5, p - 5))}
                  className="px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-lg font-bold select-none">−</button>
                <span className="px-4 py-2.5 text-white font-black tabular-nums min-w-[80px] text-center text-sm">{calcPrecioHora}€/h</span>
                <button type="button" onClick={() => setCalcPrecioHora(p => Math.min(500, p + 5))}
                  className="px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-lg font-bold select-none">+</button>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/70 rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
            <div className="space-y-3 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Sin Velacre <span className="text-slate-600 text-xs">(6 min/reseña)</span></span>
                <span className="text-slate-300 font-semibold tabular-nums">{minSin} min</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Con Velacre <span className="text-slate-600 text-xs">(5 seg/reseña)</span></span>
                <span className="text-emerald-400 font-semibold tabular-nums">{minCon} min</span>
              </div>
              <div className="h-px bg-slate-800" />
              <div>
                <p className="text-xs text-slate-500 mb-1">Ahorras al mes</p>
                <motion.p
                  key={`${ahorroH}-${ahorroM}`}
                  initial={{ opacity: 0.6, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl font-black text-white tabular-nums leading-tight"
                >
                  {ahorroH > 0 ? `${ahorroH}h ` : ''}{ahorroM > 0 ? `${ahorroM}min` : ''}
                </motion.p>
                <motion.p
                  key={ahorroEuros}
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-blue-400 font-bold mt-0.5"
                >
                  {ahorroEuros}€ de tu tiempo
                </motion.p>
              </div>
            </div>
            <Link href="/auth/register"
              className="block text-center py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors">
              Empieza gratis →
            </Link>
          </div>
        </div>
      </div>
    </FadeInUp>
  )
}
