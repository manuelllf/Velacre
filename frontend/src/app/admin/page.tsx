'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  getMyUsuario,
  getAdminUsuarios,
  getAdminStats,
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

function PlanBadge({ plan }: { plan?: string }) {
  if (plan === 'pro') {
    return (
      <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
        Pro
      </span>
    )
  }
  return (
    <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
      Basic
    </span>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [error, setError] = useState('')
  const [adminId, setAdminId] = useState<string>('')
  const [totalReviews, setTotalReviews] = useState<number>(0)
  const [proUsers, setProUsers] = useState<number>(0)

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
        const [data, stats] = await Promise.all([getAdminUsuarios(), getAdminStats()])
        setUsuarios(data)
        setTotalReviews(stats.totalReviews)
        setProUsers(stats.proUsers)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar usuarios')
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const activos = usuarios.filter(u => u.activo).length
  const pendientes = usuarios.filter(u => !u.activo && !u.activoDesde).length
  const suspendidos = usuarios.filter(u => !u.activo && u.activoDesde).length
  // Claude: $0.01 por llamada API ≈ 1 llamada por respuesta generada
  const estimatedAiCost = (totalReviews * 0.01).toFixed(2)

  // Outscraper tiered: 0-500 gratis, 500-10k a $0.003, >10k a $0.001
  const totalFetched = proUsers * 20 * 10 // ~10 syncs/mes por usuario pro
  function outscraperTiered(n: number): number {
    if (n <= 500) return 0
    if (n <= 10000) return (n - 500) * 0.003
    return (10000 - 500) * 0.003 + (n - 10000) * 0.001
  }
  const estimatedOutscraperCost = outscraperTiered(totalFetched).toFixed(2)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-bold text-lg text-slate-900 dark:text-white">Velacre Admin</span>
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
            className="text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="hidden sm:inline">Cerrar sesión</span>
            <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* MRR placeholder */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">MRR</h2>
          <div className="flex items-center gap-3 px-4 py-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-500 dark:text-slate-400">
            <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
            </svg>
            Conecta LemonSqueezy API para ver MRR en tiempo real
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 text-center">
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{usuarios.length}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total usuarios</div>
          </div>
        </div>

        {/* Consumo estimado */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Costes estimados</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Claude AI</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">€{estimatedAiCost}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {totalReviews} respuestas × $0.01/llamada
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Outscraper</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">${estimatedOutscraperCost}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {totalFetched} reseñas est. · 0-500 gratis, 500-10k $0.003, +10k $0.001
              </div>
            </div>
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
                  className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <StatusBadge activo={usuario.activo} activoDesde={usuario.activoDesde} />
                    <PlanBadge plan={usuario.plan} />
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">
                      {usuario.nombre ?? <span className="text-slate-400 font-normal italic">Sin nombre</span>}
                    </span>
                    {usuario.id === adminId && (
                      <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap mt-1">
                    {usuario.email && <span>{usuario.email}</span>}
                    <span>
                      Negocio:{' '}
                      {usuario.negocio ? (
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{usuario.negocio.nombre}</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic">Sin negocio</span>
                      )}
                    </span>
                    <span>Registro: {formatDateEs(usuario.creadoFecha)}</span>
                    <span>Último acceso: —</span>
                    {usuario.activoDesde && (
                      <span>Activo desde: {formatDateEs(usuario.activoDesde)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
