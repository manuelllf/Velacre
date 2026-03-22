'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  getMyUsuario,
  getAdminUsuarios,
  activarUsuario,
  desactivarUsuario,
  type AdminUsuario,
} from '@/lib/api'

function formatDateEs(dateStr?: string) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function StatusBadge({ activo, activoDesde }: { activo: boolean; activoDesde?: string }) {
  if (activo) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Activo
      </span>
    )
  }
  if (activoDesde) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Suspendido
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Pendiente
    </span>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [adminId, setAdminId] = useState<string>('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/auth/login')
        return
      }
      try {
        const u = await getMyUsuario()
        if (!u.isAdmin) {
          router.replace('/dashboard')
          return
        }
        setAdminId(u.id)
        const data = await getAdminUsuarios()
        setUsuarios(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar usuarios')
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  }, [router])

  async function handleActivar(id: string) {
    setLoadingAction(id)
    setError('')
    // Optimistic update
    setUsuarios(prev =>
      prev.map(u =>
        u.id === id
          ? { ...u, activo: true, activoDesde: u.activoDesde ?? new Date().toISOString() }
          : u
      )
    )
    try {
      await activarUsuario(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al activar')
      // Revert
      setUsuarios(prev =>
        prev.map(u => (u.id === id ? { ...u, activo: false } : u))
      )
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleDesactivar(id: string) {
    setLoadingAction(id)
    setError('')
    // Optimistic update
    setUsuarios(prev =>
      prev.map(u => (u.id === id ? { ...u, activo: false } : u))
    )
    try {
      await desactivarUsuario(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desactivar')
      // Revert
      setUsuarios(prev =>
        prev.map(u => (u.id === id ? { ...u, activo: true } : u))
      )
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/auth/login')
  }

  if (loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const activos = usuarios.filter(u => u.activo).length
  const pendientes = usuarios.filter(u => !u.activo && !u.activoDesde).length
  const suspendidos = usuarios.filter(u => !u.activo && u.activoDesde).length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-bold text-lg text-slate-900 dark:text-white">Velac Admin</span>
            <Link
              href="/dashboard"
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver al dashboard
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 text-center">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{activos}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Activos</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 text-center">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{pendientes}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pendientes</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 text-center">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{suspendidos}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Suspendidos</div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Users table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Usuarios ({usuarios.length})
            </h2>
          </div>

          {usuarios.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              No hay usuarios registrados
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {usuarios.map(usuario => (
                <div
                  key={usuario.id}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  {/* Status + Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <StatusBadge activo={usuario.activo} activoDesde={usuario.activoDesde} />
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">
                        {usuario.nombre ?? <span className="text-slate-400 font-normal italic">Sin nombre</span>}
                      </span>
                      {usuario.id === adminId && (
                        <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      {usuario.email && (
                        <span>{usuario.email}</span>
                      )}
                      <span>
                        Negocio:{' '}
                        {usuario.negocio ? (
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{usuario.negocio.nombre}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">Sin negocio</span>
                        )}
                      </span>
                      <span>Registro: {formatDateEs(usuario.creadoFecha)}</span>
                      {usuario.activoDesde && (
                        <span>Activo desde: {formatDateEs(usuario.activoDesde)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {usuario.id !== adminId && (
                    <div className="flex-shrink-0">
                      {usuario.activo ? (
                        <button
                          onClick={() => handleDesactivar(usuario.id)}
                          disabled={loadingAction === usuario.id}
                          className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loadingAction === usuario.id ? (
                            <span className="flex items-center gap-2">
                              <span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                              Suspendiendo...
                            </span>
                          ) : (
                            'Suspender'
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivar(usuario.id)}
                          disabled={loadingAction === usuario.id}
                          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loadingAction === usuario.id ? (
                            <span className="flex items-center gap-2">
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Activando...
                            </span>
                          ) : (
                            'Activar'
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
