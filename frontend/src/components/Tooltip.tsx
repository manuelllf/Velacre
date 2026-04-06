'use client'

import { useState, useRef } from 'react'

interface TooltipProps {
  text: string
  className?: string
}

export default function Tooltip({ text, className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function show() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setVisible(true)
  }

  function hide() {
    timeoutRef.current = setTimeout(() => setVisible(false), 120)
  }

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <button
        type="button"
        aria-label="Más información"
        className="w-3.5 h-3.5 rounded-full border border-current opacity-40 hover:opacity-70 text-[9px] font-bold leading-none flex items-center justify-center transition-opacity shrink-0"
        style={{ fontVariant: 'normal', letterSpacing: 'normal', textTransform: 'none' }}
      >
        ?
      </button>
      {visible && (
        <span
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 px-2.5 py-2 bg-slate-800 text-slate-200 rounded-lg shadow-xl pointer-events-none"
          style={{
            fontSize: '11px',
            fontWeight: 400,
            lineHeight: '1.4',
            textTransform: 'none',
            letterSpacing: 'normal',
            fontVariant: 'normal',
          }}
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  )
}
