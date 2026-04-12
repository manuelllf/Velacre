'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import {
  getMyUsuario,
  getAdminUsuarios,
  cambiarEstado,
  setProOverride,
  actualizarNotasAdmin,
  setAdminPlaceId,
  cambiarPlan,
  searchPlaces,
  type AdminUsuario,
  type EstadoUsuario,
  type PlaceResult,
} from '@/lib/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return d }
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoUsuario }) {
  const { t } = useLanguage()
  const adm = t.app.admin
  const map: Record<EstadoUsuario, { label: string; cls: string; dot: string }> = {
    activo:          { label: adm.badgeActivo,      cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
    prueba:          { label: adm.badgePrueba,       cls: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',                dot: 'bg-sky-500' },
    prueba_expirada: { label: adm.badgePruebaExp,    cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',    dot: 'bg-orange-500' },
    baneado:         { label: adm.badgeSuspendido,   cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',               dot: 'bg-red-500' },
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
        Pro* <span className="text-[10px] opacity-70">override</span>
      </span>
    )
  }
  if (plan === 'pro') return <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">Pro</span>
  if (plan === 'core') return <span className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-medium">Core</span>
  return <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">Basic</span>
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
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

function NumericStepper({ value, onChange, min = 1, max = 365 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors font-medium text-base leading-none"
      >−</button>
      <span className="w-12 text-center text-sm font-semibold text-slate-900 dark:text-white select-none">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors font-medium text-base leading-none"
      >+</button>
    </div>
  )
}

// ─── Modal: Estado ────────────────────────────────────────────────────────────

function EstadoModal({ usuario, onClose, onDone }: { usuario: AdminUsuario; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage()
  const adm = t.app.admin
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
    <Modal title={`Estado · ${usuario.nombre ?? usuario.email}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(['activo', 'prueba', 'baneado'] as EstadoUsuario[]).map(e => (
            <button key={e} onClick={() => setEstado(e)}
              className={`py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                estado === e
                  ? e === 'activo' ? 'bg-emerald-500 border-emerald-500 text-white'
                    : e === 'prueba' ? 'bg-sky-500 border-sky-500 text-white'
                    : 'bg-red-500 border-red-500 text-white'
                  : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-400'
              }`}
            >
              {e === 'activo' ? adm.optActivo : e === 'prueba' ? adm.optPrueba : adm.optSuspendido}
            </button>
          ))}
        </div>

        {estado === 'prueba' && (
          <div className="space-y-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block">{adm.trialDays}</label>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {[7, 14, 30].map(d => (
                <button key={d} type="button" onClick={() => setDias(d)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    dias === d
                      ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >{d} {adm.days}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{adm.custom}</span>
              <NumericStepper value={dias} onChange={setDias} max={365} />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">{adm.expires} {new Date(Date.now() + dias * 86400000).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        )}

        {err && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
            {err}
            {(err.includes('401') || err.includes('403') || err.toLowerCase().includes('unauthorized') || err.toLowerCase().includes('forbidden')) && (
              <p className="text-xs mt-1 text-red-500 dark:text-red-500">{adm.error401}</p>
            )}
          </div>
        )}

        <button onClick={handleSave} disabled={loading}
          className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {loading ? adm.saving : adm.confirmChange}
        </button>
      </div>
    </Modal>
  )
}

// ─── Modal: Pro Override ──────────────────────────────────────────────────────

function ProOverrideModal({ usuario, onClose, onDone }: { usuario: AdminUsuario; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage()
  const adm = t.app.admin
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

        {/* Activar / desactivar */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActivo(true)}
            className={`py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activo
                ? 'bg-violet-500 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {adm.activate}
          </button>
          <button
            type="button"
            onClick={() => setActivo(false)}
            className={`py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              !activo
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {adm.deactivate}
          </button>
        </div>

        {/* Caducidad (solo si activo) */}
        {activo && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setConCaducidad(false)}
                className={`py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  !conCaducidad
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {adm.noLimit}
              </button>
              <button
                type="button"
                onClick={() => setConCaducidad(true)}
                className={`py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  conCaducidad
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {adm.withExpiry}
              </button>
            </div>

            {conCaducidad && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {[7, 30, 90].map(d => (
                    <button key={d} type="button" onClick={() => setDias(d)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        dias === d
                          ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-300 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >{d} {adm.days}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{adm.custom}</span>
                  <NumericStepper value={dias} onChange={setDias} />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {adm.expires} {new Date(Date.now() + dias * 86400000).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Estado actual */}
        {usuario.proOverrideHasta && (
          <p className="text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 rounded-lg px-3 py-2">
            {adm.overrideActiveUntil} {fmtDate(usuario.proOverrideHasta)}
          </p>
        )}

        {err && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
            {err}
            {(err.includes('401') || err.includes('403') || err.toLowerCase().includes('unauthorized') || err.toLowerCase().includes('forbidden')) && (
              <p className="text-xs mt-1 text-red-500 dark:text-red-500">{adm.error401}</p>
            )}
          </div>
        )}

        <button onClick={handleSave} disabled={loading}
          className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {loading ? adm.saving : adm.confirm}
        </button>
      </div>
    </Modal>
  )
}

// ─── Modal: Notas ─────────────────────────────────────────────────────────────

function NotasModal({ usuario, onClose, onDone }: { usuario: AdminUsuario; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage()
  const adm = t.app.admin
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
    <Modal title={`Notas · ${usuario.nombre ?? usuario.email}`} onClose={onClose}>
      <div className="space-y-4">
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={5}
          placeholder={adm.notesPlaceholder}
          className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
        <p className="text-xs text-slate-400">{adm.notesAdminOnly}</p>
        {err && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
            {err}
            {(err.includes('401') || err.includes('403') || err.toLowerCase().includes('unauthorized') || err.toLowerCase().includes('forbidden')) && (
              <p className="text-xs mt-1 text-red-500 dark:text-red-500">{adm.error401}</p>
            )}
          </div>
        )}
        <button onClick={handleSave} disabled={loading}
          className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {loading ? adm.saving : adm.saveNotes}
        </button>
      </div>
    </Modal>
  )
}

// ─── Modal: Plan ──────────────────────────────────────────────────────────────

function PlanModal({ usuario, onClose, onDone }: { usuario: AdminUsuario; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage()
  const adm = t.app.admin
  const [plan, setPlan] = useState<'basic' | 'core' | 'pro'>(
    (usuario.plan === 'basic' || usuario.plan === 'core' || usuario.plan === 'pro') ? usuario.plan : 'basic'
  )
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    setLoading(true); setErr('')
    try { await cambiarPlan(usuario.id, plan); onDone() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  return (
    <Modal title={`Plan · ${usuario.nombre ?? usuario.email}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(['basic', 'core', 'pro'] as const).map(p => (
            <button key={p} onClick={() => setPlan(p)}
              className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all cursor-pointer capitalize ${
                plan === p ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                           : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'
              }`}
            >{p}</button>
          ))}
        </div>
        {err && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
            {err}
            {(err.includes('401') || err.includes('403') || err.toLowerCase().includes('unauthorized') || err.toLowerCase().includes('forbidden')) && (
              <p className="text-xs mt-1 text-red-500 dark:text-red-500">{adm.error401}</p>
            )}
          </div>
        )}
        <button onClick={handleSave} disabled={loading}
          className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {loading ? adm.saving : adm.confirm}
        </button>
      </div>
    </Modal>
  )
}

// ─── Modal: Place ID ──────────────────────────────────────────────────────────

function PlaceIdModal({ usuario, onClose, onDone }: { usuario: AdminUsuario; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage()
  const adm = t.app.admin
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<PlaceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const negocioActual = usuario.negocio

  function handleQueryChange(value: string) {
    setQuery(value)
    setSelected(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim() || value.trim().length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try { setResults(await searchPlaces(value.trim())) }
      catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
  }

  function handleSelect(place: PlaceResult) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearching(false)
    setSelected(place)
    setQuery(place.name)
    setResults([])
  }

  async function handleSave() {
    if (!negocioActual?.id) { setErr(adm.noBusinessAssociated); return }
    if (!selected) { setErr(adm.selectFromList); return }
    setLoading(true); setErr('')
    try {
      await setAdminPlaceId(negocioActual.id, selected.placeId)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`Negocio Google · ${usuario.nombre ?? usuario.email}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">{adm.currentBusiness}</p>
          {negocioActual ? (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{negocioActual.nombre}</p>
                {negocioActual.placeId && <p className="text-xs text-slate-400 font-mono truncate">{negocioActual.placeId}</p>}
              </div>
            </div>
          ) : (
            <div className="px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
              {adm.noBusinessAssociated}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">{adm.searchGooglePlaces}</p>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              placeholder={adm.businessNamePlaceholder}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 pr-8"
            />
            {searching && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {results.length > 0 && (
            <div className="mt-1 border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden shadow-lg">
              <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                {results.slice(0, 5).map(r => (
                  <button key={r.placeId} onClick={() => handleSelect(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{r.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{r.address}</p>
                    {r.rating && <p className="text-xs text-amber-500 mt-0.5">★ {r.rating}</p>}
                  </button>
                ))}
              </div>
              {results.length > 5 && (
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-400">{adm.moreResults.replace('{n}', String(results.length - 5))}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {selected && (
          <div className="flex items-start gap-3 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
            <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">{selected.name}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 truncate">{selected.address}</p>
              {selected.rating && <p className="text-xs text-amber-500 mt-0.5">★ {selected.rating}</p>}
            </div>
          </div>
        )}

        {err && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
            {err}
            {(err.includes('401') || err.includes('403') || err.toLowerCase().includes('unauthorized') || err.toLowerCase().includes('forbidden')) && (
              <p className="text-xs mt-1 text-red-500 dark:text-red-500">{adm.error401}</p>
            )}
          </div>
        )}

        <button onClick={handleSave} disabled={loading || !selected}
          className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {loading ? adm.saving : adm.confirmBusinessChange}
        </button>
      </div>
    </Modal>
  )
}

// ─── Fila de usuario ──────────────────────────────────────────────────────────

type ModalType = 'estado' | 'override' | 'notas' | 'plan' | 'place'

function UsuarioRow({
  usuario,
  isAdmin,
  onAction,
}: {
  usuario: AdminUsuario
  isAdmin: boolean
  onAction: (u: AdminUsuario, modal: ModalType) => void
}) {
  const { t } = useLanguage()
  const adm = t.app.admin
  return (
    <div className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <EstadoBadge estado={usuario.estado} />
            <PlanBadge plan={usuario.plan} proEfectivo={usuario.proEfectivo} proOverride={usuario.proOverride} />
            <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">
              {usuario.nombre ?? <span className="text-slate-400 font-normal italic">Sin nombre</span>}
            </span>
            {isAdmin && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Admin</span>
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

      {!isAdmin && (
        <div className="flex gap-1.5 mt-3 flex-wrap">
          <button onClick={() => onAction(usuario, 'estado')}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer font-medium"
          >{adm.btnEstado}</button>
          <button onClick={() => onAction(usuario, 'override')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer font-medium ${
              usuario.proOverride
                ? 'border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >{adm.btnProOverride}</button>
          <button onClick={() => onAction(usuario, 'plan')}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer font-medium"
          >{adm.btnPlan}</button>
          <button onClick={() => onAction(usuario, 'notas')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer font-medium ${
              usuario.notasAdmin
                ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >Notas</button>
          {usuario.negocio && (
            <button onClick={() => onAction(usuario, 'place')}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer font-medium"
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
  const { t } = useLanguage()
  const adm = t.app.admin
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [adminId, setAdminId] = useState<string>('')
  const [filterEstado, setFilterEstado] = useState<EstadoUsuario | 'todos'>('todos')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ usuario: AdminUsuario; tipo: ModalType } | null>(null)

  const load = useCallback(async () => {
    const data = await getAdminUsuarios()
    setUsuarios(data)
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
        setError(err instanceof Error ? err.message : adm.loadError)
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  }, [router, load])

  async function handleModalDone() {
    setModal(null)
    await load()
  }

  const now = new Date()
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

  // KPIs computados en cliente
  const kpis = {
    activos:  usuarios.filter(u => u.estado === 'activo').length,
    prueba:   usuarios.filter(u => u.estado === 'prueba').length,
    baneados: usuarios.filter(u => u.estado === 'baneado' || u.estado === 'prueba_expirada').length,
    pro:      usuarios.filter(u => u.proEfectivo).length,
    core:     usuarios.filter(u => u.plan === 'core' && !u.proEfectivo).length,
    total:    usuarios.length,
  }

  if (loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-slate-900 dark:text-white">Velacre</span>
            <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/mini-radar"
              title="Mini Radar"
              aria-label="Mini Radar"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Mini Radar</span>
            </Link>
            <button
              onClick={async () => { setRefreshing(true); setError(''); try { await load() } catch (e) { setError(e instanceof Error ? e.message : adm.updateError) } finally { setRefreshing(false) } }}
              disabled={refreshing}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span className="hidden sm:inline">{refreshing ? adm.updating : adm.update}</span>
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => router.replace('/'))}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >{adm.exit}</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* KPI Strip */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: adm.kpiActivos,     val: kpis.activos,  cls: 'text-emerald-600 dark:text-emerald-400' },
            { label: adm.kpiPrueba,      val: kpis.prueba,   cls: 'text-sky-600 dark:text-sky-400' },
            { label: adm.kpiSuspendidos, val: kpis.baneados, cls: 'text-red-600 dark:text-red-400' },
            { label: adm.kpiPro,         val: kpis.pro,      cls: 'text-blue-600 dark:text-blue-400' },
            { label: adm.kpiCore,        val: kpis.core,     cls: 'text-violet-600 dark:text-violet-400' },
            { label: adm.kpiTotal,       val: kpis.total,    cls: 'text-slate-700 dark:text-slate-300' },
          ].map(({ label, val, cls }) => (
            <div key={label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center">
              <div className={`text-2xl font-bold ${cls}`}>{val}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
        )}

        {/* Tabla usuarios */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white shrink-0">
              Usuarios {filtered.length !== usuarios.length ? `(${filtered.length}/${usuarios.length})` : `(${usuarios.length})`}
            </h2>

            <div className="relative flex-1 min-w-40 max-w-xs">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {(['todos', 'activo', 'prueba', 'baneado'] as const).map(f => (
                <button key={f} onClick={() => setFilterEstado(f)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer font-medium ${
                    filterEstado === f
                      ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900'
                      : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400'
                  }`}
                >
                  {f === 'todos' ? adm.filterAll : f === 'activo' ? adm.filterActivos : f === 'prueba' ? adm.filterPrueba : adm.filterSuspendidos}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              {search || filterEstado !== 'todos' ? adm.noResults : adm.noUsers}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map(u => (
                <UsuarioRow
                  key={u.id}
                  usuario={u}
                  isAdmin={u.id === adminId}
                  onAction={(u, tipo) => setModal({ usuario: u, tipo })}
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
      {modal?.tipo === 'plan'     && <PlanModal         usuario={modal.usuario} onClose={() => setModal(null)} onDone={handleModalDone} />}
      {modal?.tipo === 'place'    && <PlaceIdModal      usuario={modal.usuario} onClose={() => setModal(null)} onDone={handleModalDone} />}
    </div>
  )
}
