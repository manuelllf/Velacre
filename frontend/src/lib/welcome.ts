/**
 * Coordina las transiciones marketing↔producto:
 *
 *   welcome (entrada):  crema→navy, "Bienvenido a velacre".
 *   goodbye (salida):   navy→crema, "Hasta luego".
 *
 * Welcome ATRAVIESA un redirect externo (google.com en OAuth) o un router
 * redirect (email/pwd), así que persiste en sessionStorage. Goodbye se
 * dispara en la página actual antes del signOut, así que no necesita
 * persistencia — se envía por custom event directo, y el logout espera la
 * animación antes de navegar.
 */

const WELCOME_KEY = 'vel_welcome'
export const WELCOME_EVENT = 'vel-welcome-trigger'
export const GOODBYE_DURATION_MS = 3000

export function armWelcome() {
  setFlag(WELCOME_KEY)
}

export function consumeWelcome(): boolean {
  return consumeFlag(WELCOME_KEY)
}

/**
 * Dispara el overlay goodbye en la página actual. El caller (handleLogout)
 * debe esperar GOODBYE_DURATION_MS antes de hacer signOut + redirect, para
 * que la animación no se corte y no haya flash de la landing.
 */
export function armGoodbye() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(WELCOME_EVENT, { detail: 'goodbye' }))
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
