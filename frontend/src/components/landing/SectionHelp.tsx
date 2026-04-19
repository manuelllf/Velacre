'use client'

import { useEffect, useRef, useState } from 'react'

export function SectionHelp({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="sec-help" ref={ref}>
      <button
        type="button"
        className="sec-help-btn"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={label ?? '¿En qué te ayuda?'}
      >
        ?
      </button>
      {open && (
        <div className="sec-help-popover" role="tooltip">
          {text}
        </div>
      )}
    </div>
  )
}
