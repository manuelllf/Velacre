/**
 * Coordina las transiciones marketing↔producto:
 *
 *   welcome (entrada):  crema→navy, "Bienvenido a velacre".
 *   goodbye (salida):   navy→crema, "Hasta luego".
 *
 * Ambos usan sessionStorage + hard reload. Un script inline en layout.tsx
 * lee estos flags ANTES del paint y pinta el html en el color de arranque
 * del overlay (navy para goodbye, crema para welcome si hiciera falta), para
 * que no haya flash entre reload y montaje del overlay.
 */

const WELCOME_KEY = 'vel_welcome'
const GOODBYE_KEY = 'vel_goodbye'

export function armWelcome() {
  setFlag(WELCOME_KEY)
}

export function consumeWelcome(): boolean {
  return consumeFlag(WELCOME_KEY)
}

export function armGoodbye() {
  setFlag(GOODBYE_KEY)
}

export function consumeGoodbye(): boolean {
  return consumeFlag(GOODBYE_KEY)
}

// Ventana máxima de validez del flag. Si algo impide consumirlo (recarga en
// medio, dev tools, error del overlay) no queremos que dispare horas después
// al abrir la landing de nuevo.
const MAX_AGE_MS = 10_000

function setFlag(key: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    // sessionStorage puede fallar en modo privado; no bloqueamos el flujo.
  }
}

function consumeFlag(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = sessionStorage.getItem(key)
    if (v === null) return false
    sessionStorage.removeItem(key)
    const ts = Number(v)
    if (!Number.isFinite(ts) || ts <= 0) return false
    return Date.now() - ts <= MAX_AGE_MS
  } catch {
    return false
  }
}
