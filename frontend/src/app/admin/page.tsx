'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  getMyUsuario,
  getAdminUsuarios,
  getAdminStats,
  cambiarEstado,
  setProOverride,
  actualizarNotasAdmin,
  upsertCosto,
  setAdminPlaceId,
  cambiarPlan,
  type AdminUsuario,
  type AdminStats,
  type EstadoUsuario,
} from '@/lib/api'

// ─── Inline cost editor ───────────────────────────────────────────────────────

function CostEditor({ stats, onSaved }: { stats: AdminStats; onSaved: () => void }) {
  const now = new Date()
  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [claude, setClaude] = useState(stats.costoMesActual.claude.toFixed(2))
  const [outscraper, setOutscraper] = useState(stats.costoMesActual.outscraper.toFixed(2))
  const [notas, setNotas] = useState(stats.costoMesActual.notas ?? '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    setLoading(true); setErr(''); setSaved(false)
    try {
      await upsertCosto(anio, mes, parseFloat(claude) || 0, parseFloat(outscraper) || 0, notas || undefined)
      setSaved(true)
      onSaved()
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const total = (parseFloat(claude) || 0) + (parseFloat(outscraper) || 0)

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">Registrar costes a mes vencido</p>
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Año</label>
          <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))}
            className="w-20 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Mes</label>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            className="border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {MES_NAMES.map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Claude (€)</label>
          <input type="number" step="0.01" min="0" value={claude} onChange={e => setClaude(e.target.value)}
            className="w-24 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Outscraper (€)</label>
          <input type="number" step="0.01" min="0" value={outscraper} onChange={e => setOutscraper(e.target.value)}
            className="w-24 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="flex-1 min-w-32">
          <label className="text-xs text-slate-400 block mb-1">Notas</label>
          <input type="text" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Opcional..."
            className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtEur(total)}</span>
          <button onClick={handleSave} disabled={loading}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50 ${
              saved ? 'bg-emerald-500 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
            }`}
          >{loading ? '...' : saved ? 'Guardado ✓' : 'Guardar'}</button>
        </div>
      </div>
      {err && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{err}</p>}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return d }
}

function fmtEur(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
}

const MES_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// ─── Badges ───────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoUsuario }) {
  const map: Record<EstadoUsuario, { label: string; cls: string; dot: string }> = {
    activo:          { label: 'Activo',          cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
    prueba:          { label: 'Prueba',           cls: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',                dot: 'bg-sky-500' },
    prueba_expirada: { label: 'Prueba exp.',      cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',    dot: 'bg-orange-500' },
    baneado:         { label: 'Suspendido',       cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',               dot: 'bg-red-500' },
  }
  const { label, cls, dot } = map[estado] ?? map.baneado
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

function PlanBadge({ plan, proEfectivo, proOverride }: { plan?: string; proEfectivo: boolean; proOverride: boolean }) {
  if (proEfectivo && proOverride && plan !== 'pro') {
    return (
      <span className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
        Pro*
        <span className="text-[10px] opacity-70">override</span>
      </span>
    )
  }
  if (plan === 'pro') {
    return <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">Pro</span>
  }
  return <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">Core</span>
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white text-base">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Modal: Estado ────────────────────────────────────────────────────────────

function EstadoModal({ usuario, onClose, onDone }: { usuario: AdminUsuario; onClose: () => void; onDone: () => void }) {
  const [estado, setEstado] = useState<EstadoUsuario>(
    (usuario.estado === 'prueba_expirada' ? 'prueba' : usuario.estado) as EstadoUsuario
  )
  const [dias, setDias] = useState(14)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    setLoading(true); setErr('')
    try {
      await cambiarEstado(usuario.id, estado, estado === 'prueba' ? dias : undefined)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`Cambiar estado · ${usuario.nombre ?? usuario.email}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(['activo', 'prueba', 'baneado'] as EstadoUsuario[]).map(e => (
            <button
              key={e}
              onClick={() => setEstado(e)}
              className={`py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                estado === e
                  ? e === 'activo' ? 'bg-emerald-500 border-emerald-500 text-white'
                    : e === 'prueba' ? 'bg-sky-500 border-sky-500 text-white'
                    : 'bg-red-500 border-red-500 text-white'
                  : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-400'
              }`}
            >
              {e === 'activo' ? 'Activo' : e === 'prueba' ? 'Prueba' : 'Suspendido'}
            </button>
          ))}
        </div>

        {estado === 'prueba' && (
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1.5">Días de prueba</label>
            <div className="flex gap-2">
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setDias(d)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
                    dias === d ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-sky-400'
                  }`}
                >{d}d</button>
              ))}
              <input type="number" min={1} max={365} value={dias} onChange={e => setDias(Number(e.target.value))}
                className="w-16 border border-slate-200 dark:border-slate-600 rounded-lg px-2 text-sm text-center dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Expira: {new Date(Date.now() + dias * 86400000).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        )}

        {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

        <button onClick={handleSave} disabled={loading}
          className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Confirmar cambio'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Modal: Pro Override ──────────────────────────────────────────────────────

function ProOverrideModal({ usuario, onClose, onDone }: { usuario: AdminUsuario; onClose: () => void; onDone: () => void }) {
  const [activo, setActivo] = useState(usuario.proOverride)
  const [conCaducidad, setConCaducidad] = useState(!!usuario.proOverrideHasta)
  const [dias, setDias] = useState(30)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    setLoading(true); setErr('')
    try {
      await setProOverride(usuario.id, activo, activo && conCaducidad ? dias : undefined)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`Override Pro · ${usuario.nombre ?? usuario.email}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Activar funciones Pro</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sin cambiar el plan ni facturar</p>
          </div>
          <button onClick={() => setActivo(!activo)} className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${activo ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        {activo && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={conCaducidad} onChange={e => setConCaducidad(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-violet-500 focus:ring-violet-400"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Poner fecha de caducidad</span>
            </label>

            {conCaducidad && (
              <div>
                <div className="flex gap-2">
                  {[7, 30, 90].map(d => (
                    <button key={d} onClick={() => setDias(d)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border cursor-pointer transition-all ${
                        dias === d ? 'bg-violet-500 border-violet-500 text-white' : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-violet-400'
                      }`}
                    >{d}d</button>
                  ))}
                  <input type="number" min={1} value={dias} onChange={e => setDias(Number(e.target.value))}
                    className="w-16 border border-slate-200 dark:border-slate-600 rounded-lg px-2 text-sm text-center dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Expira: {new Date(Date.now() + dias * 86400000).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            )}
          </div>
        )}

        {usuario.proOverrideHasta && (
          <p className="text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 rounded-lg px-3 py-2">
            Override activo hasta: {fmtDate(usuario.proOverrideHasta)}
          </p>
        )}

        {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

        <button onClick={handleSave} disabled={loading}
          className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Confirmar override'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Modal: Notas admin ───────────────────────────────────────────────────────

function NotasModal({ usuario, onClose, onDone }: { usuario: AdminUsuario; onClose: () => void; onDone: () => void }) {
  const [notas, setNotas] = useState(usuario.notasAdmin ?? '')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    setLoading(true); setErr('')
    try {
      await actualizarNotasAdmin(usuario.id, notas)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`Notas internas · ${usuario.nombre ?? usuario.email}`} onClose={onClose}>
      <div className="space-y-4">
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={5}
          placeholder="Incidencias, contexto comercial, acuerdos especiales..."
          className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
        <p className="text-xs text-slate-400">Solo visible para admins. El usuario no puede ver estas notas.</p>
        {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
        <button onClick={handleSave} disabled={loading}
          className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar notas'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Modal: Place ID ──────────────────────────────────────────────────────────

function PlaceIdModal({ usuario, onClose, onDone }: { usuario: AdminUsuario; onClose: () => void; onDone: () => void }) {
  const [placeId, setPlaceId] = useState(usuario.negocio?.placeId ?? '')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    if (!usuario.negocio?.id) { setErr('Sin negocio asociado'); return }
    setLoading(true); setErr('')
    try {
      await setAdminPlaceId(usuario.negocio.id, placeId)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`Place ID · ${usuario.negocio?.nombre ?? 'Sin negocio'}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Google Place ID</label>
          <input type="text" value={placeId} onChange={e => setPlaceId(e.target.value)}
            placeholder="ChIJ..."
            className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-mono dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          Override de admin — el usuario no puede modificar el place_id desde su cuenta.
        </p>
        {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
        <button onClick={handleSave} disabled={loading}
          className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Actualizar Place ID'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Fila de usuario ──────────────────────────────────────────────────────────

type ModalType = 'estado' | 'override' | 'notas' | 'place'

function UsuarioRow({
  usuario,
  isAdmin,
  onAction,
}: {
  usuario: AdminUsuario
  isAdmin: boolean
  onAction: (u: AdminUsuario, modal: ModalType) => void
}) {
  const [planLoading, setPlanLoading] = useState(false)

  async function togglePlan() {
    setPlanLoading(true)
    try {
      await cambiarPlan(usuario.id, usuario.plan === 'pro' ? 'basic' : 'pro')
      window.location.reload()
    } finally {
      setPlanLoading(false)
    }
  }

  return (
    <div className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <EstadoBadge estado={usuario.estado} />
            <PlanBadge plan={usuario.plan} proEfectivo={usuario.proEfectivo} proOverride={usuario.proOverride} />
            <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">
              {usuario.nombre ?? <span className="text-slate-400 font-normal italic">Sin nombre</span>}
            </span>
            {isAdmin && (
              <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">Admin</span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            {usuario.email && <span>{usuario.email}</span>}
            <span>
              {usuario.negocio
                ? <span className="text-slate-700 dark:text-slate-300 font-medium">{usuario.negocio.nombre}</span>
                : <span className="italic text-slate-400">Sin negocio</span>
              }
            </span>
            <span>Registro: {fmtDate(usuario.creadoFecha)}</span>
            {usuario.pruebaHasta && usuario.estado === 'prueba' && (
              <span className="text-sky-600 dark:text-sky-400">Prueba hasta: {fmtDate(usuario.pruebaHasta)}</span>
            )}
            {usuario.proOverride && usuario.proOverrideHasta && (
              <span className="text-violet-600 dark:text-violet-400">Override hasta: {fmtDate(usuario.proOverrideHasta)}</span>
            )}
            {usuario.notasAdmin && (
              <span className="text-amber-600 dark:text-amber-400 truncate max-w-xs">📝 {usuario.notasAdmin}</span>
            )}
          </div>
        </div>

      </div>

      {/* Acciones */}
      {!isAdmin && (
        <div className="flex gap-1.5 mt-3 flex-wrap">
          <button onClick={() => onAction(usuario, 'estado')}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer font-medium"
          >Estado</button>
          <button onClick={() => onAction(usuario, 'override')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer font-medium ${
              usuario.proOverride
                ? 'border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30'
                : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >Pro Override</button>
          <button onClick={togglePlan} disabled={planLoading}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer font-medium disabled:opacity-50"
          >{planLoading ? '...' : usuario.plan === 'pro' ? '→ Core' : '→ Pro'}</button>
          <button onClick={() => onAction(usuario, 'notas')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer font-medium ${
              usuario.notasAdmin
                ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20'
                : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >Notas</button>
          {usuario.negocio && (
            <button onClick={() => onAction(usuario, 'place')}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer font-medium"
            >Place ID</button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [error, setError] = useState('')
  const [adminId, setAdminId] = useState<string>('')
  const [filterEstado, setFilterEstado] = useState<EstadoUsuario | 'todos'>('todos')
  const [search, setSearch] = useState('')

  // Modal state
  const [modal, setModal] = useState<{ usuario: AdminUsuario; tipo: ModalType } | null>(null)

  const load = useCallback(async () => {
    const [data, s] = await Promise.all([getAdminUsuarios(), getAdminStats()])
    setUsuarios(data)
    setStats(s)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/login'); return }
      try {
        const u = await getMyUsuario()
        if (!u.isAdmin) { router.replace('/dashboard'); return }
        setAdminId(u.id)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar')
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  }, [router, load])

  function handleAction(u: AdminUsuario, tipo: ModalType) {
    setModal({ usuario: u, tipo })
  }

  async function handleModalDone() {
    setModal(null)
    await load()
  }

  if (loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const filtered = usuarios.filter(u => {
    if (filterEstado !== 'todos' && u.estado !== filterEstado) return false
    if (search) {
      const q = search.toLowerCase()
      return (u.nombre ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.negocio?.nombre ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const now = new Date()
  const mesLabel = `${MES_NAMES[now.getMonth()]} ${now.getFullYear()}`

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-slate-900 dark:text-white">⚡ God Mode</span>
            <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">ADMIN</span>
            <Link href="/dashboard" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1 ml-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Actualizar
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => router.replace('/'))}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >Salir</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* KPI Strip */}
        {stats && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Activos',    val: stats.activos,       cls: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Prueba',     val: stats.prueba,        cls: 'text-sky-600 dark:text-sky-400' },
              { label: 'Suspendidos',val: stats.baneados,      cls: 'text-red-600 dark:text-red-400' },
              { label: 'Pro',        val: stats.proUsers,      cls: 'text-indigo-600 dark:text-indigo-400' },
              { label: 'Total',      val: stats.totalUsuarios, cls: 'text-slate-700 dark:text-slate-300' },
              { label: 'Reseñas BD', val: stats.totalReviews,  cls: 'text-slate-700 dark:text-slate-300' },
            ].map(({ label, val, cls }) => (
              <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                <div className={`text-2xl font-bold ${cls}`}>{val}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Costes mes actual */}
        {stats && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Costes API · {mesLabel}</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Claude AI</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtEur(stats.costoMesActual.claude)}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Outscraper</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtEur(stats.costoMesActual.outscraper)}</div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800">
                <div className="text-xs text-indigo-500 dark:text-indigo-400 mb-1 font-medium">Total</div>
                <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{fmtEur(stats.costoMesActual.total)}</div>
              </div>
            </div>
            {stats.costoMesActual.notas && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 italic">{stats.costoMesActual.notas}</p>
            )}
            <CostEditor stats={stats} onSaved={load} />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
        )}

        {/* Tabla usuarios */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white shrink-0">
              Usuarios {filtered.length !== usuarios.length ? `(${filtered.length}/${usuarios.length})` : `(${usuarios.length})`}
            </h2>

            {/* Search */}
            <div className="relative flex-1 min-w-40 max-w-xs">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {/* Filtro estado */}
            <div className="flex gap-1.5 flex-wrap">
              {(['todos', 'activo', 'prueba', 'baneado'] as const).map(f => (
                <button key={f} onClick={() => setFilterEstado(f)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer font-medium ${
                    filterEstado === f
                      ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900'
                      : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400'
                  }`}
                >
                  {f === 'todos' ? 'Todos' : f === 'activo' ? 'Activos' : f === 'prueba' ? 'Prueba' : 'Suspendidos'}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              {search || filterEstado !== 'todos' ? 'Sin resultados' : 'No hay usuarios registrados'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map(u => (
                <UsuarioRow
                  key={u.id}
                  usuario={u}
                  isAdmin={u.id === adminId}
                  onAction={handleAction}
                />
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Modals */}
      {modal?.tipo === 'estado'   && <EstadoModal      usuario={modal.usuario} onClose={() => setModal(null)} onDone={handleModalDone} />}
      {modal?.tipo === 'override' && <ProOverrideModal  usuario={modal.usuario} onClose={() => setModal(null)} onDone={handleModalDone} />}
      {modal?.tipo === 'notas'    && <NotasModal        usuario={modal.usuario} onClose={() => setModal(null)} onDone={handleModalDone} />}
      {modal?.tipo === 'place'    && <PlaceIdModal      usuario={modal.usuario} onClose={() => setModal(null)} onDone={handleModalDone} />}
    </div>
  )
}
