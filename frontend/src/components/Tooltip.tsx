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
    timeoutRef.current = setTimeout(() => setVisible(false), 100)
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
        className="w-4 h-4 rounded-full border border-slate-400 dark:border-slate-500 text-slate-400 dark:text-slate-500 text-[10px] font-bold leading-none flex items-center justify-center hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors shrink-0"
      >
        ?
      </button>
      {visible && (
        <span
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-xl shadow-lg pointer-events-none leading-relaxed"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700" />
        </span>
      )}
    </span>
  )
}
