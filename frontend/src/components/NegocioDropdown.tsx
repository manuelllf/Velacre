'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useNegocioActivo } from '@/lib/negocio-activo'

/**
 * Selector de local activo — dropdown compacto para el AppHeader.
 * Si el usuario solo tiene 1 local, renderiza el nombre sin dropdown (no hay nada que elegir).
 * Si tiene 2+, muestra un caret clicable con la lista de locales + "+ Añadir local".
 */
export function NegocioDropdown() {
  const { negocios, activo, setActivo } = useNegocioActivo()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  if (!activo) return null

  // Caso 1 solo local: no hay selector, solo el nombre.
  if (negocios.length < 2) {
    return (
      <span
        className="hidden sm:inline text-sm text-slate-500 truncate max-w-[200px]"
        style={{ display: 'inline-flex', alignItems: 'center', height: 36, lineHeight: 1 }}
      >
        · {activo.nombre}
      </span>
    )
  }

  return (
    <div ref={wrapRef} className="relative hidden sm:inline-flex items-center" style={{ height: 36 }}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen(v => !v) }}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer px-2 py-1 rounded-md border border-transparent hover:border-slate-700"
        style={{ lineHeight: 1 }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate max-w-[180px]">· {activo.nombre}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 mt-1 z-40 min-w-[240px] rounded-lg border border-slate-700 bg-slate-900/95 backdrop-blur py-1 shadow-xl"
        >
          {negocios.map(n => (
            <button
              key={n.id}
              type="button"
              role="option"
              aria-selected={n.id === activo.id}
              onClick={(e) => { e.preventDefault(); setActivo(n.id); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                n.id === activo.id
                  ? 'text-slate-100 bg-slate-800/60'
                  : 'text-slate-300 hover:bg-slate-800/40'
              }`}
            >
              {n.nombre}
            </button>
          ))}
          <div className="border-t border-slate-700 mt-1 pt-1">
            <Link
              href="/settings?tab=locales"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-blue-400 hover:bg-slate-800/40 transition-colors"
            >
              + Añadir local
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
