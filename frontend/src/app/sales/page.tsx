'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getMyUsuario,
  getSalesPortfolio,
  getSalesComision,
  getSalesLiquidaciones,
  type SalesPortfolioItem,
  type SalesComision,
  type Liquidacion,
} from '@/lib/api'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function fmt(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function BadgePlan({ plan }: { plan: string }) {
  return plan === 'pro'
    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">Pro</span>
    : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">Basic</span>
}

function BadgeEstado({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    activo: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    baneado: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    prueba: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    prueba_expirada: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  }
  const labels: Record<string, string> = {
    activo: 'Activo', baneado: 'Baneado', prueba: 'Prueba', prueba_expirada: 'Prueba expirada',
  }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[estado] ?? map.activo}`}>{labels[estado] ?? estado}</span>
}

export default function SalesDashboard() {
  const router = useRouter()
  const [nombre, setNombre] = useState<string>('')
  const [portfolio, setPortfolio] = useState<SalesPortfolioItem[]>([])
  const [comision, setComision] = useState<SalesComision | null>(null)
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/login'); return }
      try {
        const u = await getMyUsuario()
        if (u.rol !== 'sales') { router.replace(u.isAdmin ? '/admin' : '/dashboard'); return }
        setNombre(u.nombre ?? u.id)
        const [p, c, l] = await Promise.all([
          getSalesPortfolio(),
          getSalesComision(),
          getSalesLiquidaciones(),
        ])
        setPortfolio(p.negocios)
        setComision(c)
        setLiquidaciones(l)
      } catch {
        setError('Error al cargar los datos. Recarga la página.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  const ingresosHistorico = liquidaciones.reduce((s, l) => s + l.ingresosBrutos, 0)
  const comisionHistorica = liquidaciones.reduce((s, l) => s + l.comision, 0)
  const pendienteCobro   = liquidaciones.filter(l => !l.pagado).reduce((s, l) => s + l.comision, 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Velacre Sales</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Hola, {nombre}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          Cerrar sesión
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">{error}</p>}

        {/* KPIs resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Clientes asignados', value: portfolio.length.toString() },
            { label: 'Clientes Pro', value: portfolio.filter(n => n.plan === 'pro').length.toString() },
            { label: 'Ingresos generados', value: fmt(ingresosHistorico) },
            { label: 'Pendiente de cobro', value: fmt(pendienteCobro), highlight: pendienteCobro > 0 },
          ].map(k => (
            <div key={k.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{k.label}</p>
              <p className={`text-xl font-bold ${k.highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Comisión mes en curso (preview) */}
        {comision && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Comisión estimada — mes en curso
            </h2>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Ingresos brutos estimados', value: fmt(comision.ingresosEstimados) },
                { label: 'Costes API prorrateados', value: `– ${fmt(comision.costosApiProrrateados)}`, muted: true },
                { label: 'Fees pasarela', value: '– (pendiente)', muted: true },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className={r.muted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}>{r.label}</span>
                  <span className={r.muted ? 'text-slate-400 dark:text-slate-500 font-mono text-xs' : 'font-mono text-xs text-slate-700 dark:text-slate-200'}>{r.value}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 dark:border-slate-700 pt-2 flex justify-between items-center">
                <span className="font-medium text-slate-700 dark:text-slate-200">Neto estimado</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">{fmt(comision.neto)}</span>
              </div>
              <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-4 py-3 mt-2">
                <span className="font-semibold text-indigo-700 dark:text-indigo-300">Tu comisión (30%)</span>
                <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 text-lg">{fmt(comision.comision)}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
              * Estimación. La liquidación definitiva la confirma el administrador a mes vencido.
            </p>
          </div>
        )}

        {/* Portfolio de negocios */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Cartera de clientes
              <span className="ml-2 text-sm font-normal text-slate-400">({portfolio.length})</span>
            </h2>
          </div>
          {portfolio.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
              Aún no tienes clientes asignados. Contacta con el administrador.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {portfolio.map(n => (
                <div key={n.negocioId} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{n.nombre}</p>
                    {n.activoDesde && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Cliente desde {new Date(n.activoDesde).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <BadgePlan plan={n.plan} />
                    <BadgeEstado estado={n.estadoUsuario} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Histórico de liquidaciones */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Histórico de liquidaciones</h2>
            <div className="text-right">
              <p className="text-xs text-slate-400 dark:text-slate-500">Total generado</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{fmt(ingresosHistorico)}</p>
            </div>
          </div>
          {liquidaciones.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
              Sin liquidaciones registradas todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700">
                    <th className="px-6 py-3 text-left font-medium">Período</th>
                    <th className="px-4 py-3 text-right font-medium">Ingresos</th>
                    <th className="px-4 py-3 text-right font-medium">Costes</th>
                    <th className="px-4 py-3 text-right font-medium">Neto</th>
                    <th className="px-4 py-3 text-right font-medium">Comisión</th>
                    <th className="px-4 py-3 text-center font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {liquidaciones.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                        {MESES[l.mes - 1]} {l.anio}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300 font-mono text-xs">{fmt(l.ingresosBrutos)}</td>
                      <td className="px-4 py-3 text-right text-slate-400 dark:text-slate-500 font-mono text-xs">– {fmt(l.costosApi + l.feesPasarela)}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200 font-mono text-xs">{fmt(l.neto)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">{fmt(l.comision)}</td>
                      <td className="px-4 py-3 text-center">
                        {l.pagado
                          ? <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Pagado</span>
                          : <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Pendiente</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-600 font-semibold text-slate-900 dark:text-white">
                    <td className="px-6 py-3 text-sm">Total</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{fmt(ingresosHistorico)}</td>
                    <td />
                    <td />
                    <td className="px-4 py-3 text-right font-mono text-xs text-indigo-600 dark:text-indigo-400">{fmt(comisionHistorica)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
