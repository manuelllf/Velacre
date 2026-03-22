'use client'

import { useState } from 'react'

interface ResponseCardProps {
  tone: string
  text: string
  color: 'indigo' | 'emerald' | 'amber'
}

const colorMap = {
  indigo: {
    header: 'bg-indigo-600',
    badge: 'bg-indigo-100 text-indigo-700',
    button: 'bg-indigo-600 hover:bg-indigo-700',
    copied: 'bg-indigo-100 text-indigo-700',
  },
  emerald: {
    header: 'bg-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    copied: 'bg-emerald-100 text-emerald-700',
  },
  amber: {
    header: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    button: 'bg-amber-500 hover:bg-amber-600',
    copied: 'bg-amber-100 text-amber-700',
  },
}

export default function ResponseCard({ tone, text, color }: ResponseCardProps) {
  const [copied, setCopied] = useState(false)
  const c = colorMap[color]

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`${c.header} px-4 py-3`}>
        <span className="text-white font-semibold text-sm">{tone}</span>
      </div>
      <div className="flex-1 p-4">
        <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
      <div className="px-4 pb-4">
        <button
          onClick={handleCopy}
          className={`w-full py-2 rounded-lg text-sm font-medium text-white transition-colors ${
            copied ? c.copied + ' !text-current' : c.button
          }`}
        >
          {copied ? '¡Copiado!' : 'Copiar respuesta'}
        </button>
      </div>
    </div>
  )
}
