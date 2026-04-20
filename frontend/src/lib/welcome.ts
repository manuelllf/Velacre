/**
 * Coordina las transiciones de entrada (crema→navy, "Bienvenido") y salida
 * (navy→crema, "Hasta luego") entre auth y app. Para login/register con email
 * el query ?welcome=1 basta; para OAuth Google y para logout hace falta
 * persistir a través del redirect, por eso sessionStorage.
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
