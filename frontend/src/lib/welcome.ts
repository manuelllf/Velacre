/**
 * Coordina la transición de bienvenida entre el flujo OAuth (Google) y la
 * entrada a la app. Para login/register con email el query ?welcome=1 basta;
 * para OAuth hace falta persistir a través del redirect externo a Google,
 * por eso usamos sessionStorage.
 */

const KEY = 'vel_welcome'

export function armWelcome() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // sessionStorage puede fallar en modo privado — el flujo sigue funcionando
    // sin overlay, no bloqueamos.
  }
}

export function consumeWelcome(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = sessionStorage.getItem(KEY)
    if (v === '1') {
      sessionStorage.removeItem(KEY)
      return true
    }
  } catch {
    // ignore
  }
  return false
}
