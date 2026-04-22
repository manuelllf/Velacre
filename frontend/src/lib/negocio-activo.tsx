'use client'

/**
 * NegocioActivoProvider — gestiona el "local activo" del usuario multi-local.
 *
 * Fuente de verdad en cascada:
 *   1. Query param `?negocio=<id>` en la URL (bookmarkable, compartible)
 *   2. `localStorage.vel_negocio_activo` (persistencia entre sesiones)
 *   3. El negocio con `es_principal=TRUE` (elegido por el usuario)
 *   4. Primer negocio por creación ASC (fallback)
 *
 * Diseño single-source-of-truth: el ÚNICO que escribe `activoId` en estado es el
 * resolver (useEffect). `setActivo` solo actualiza la URL; el resolver observa
 * el cambio de searchParams y ajusta el estado. Así no hay doble escritura ni
 * condiciones de carrera entre el setter y el resolver.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getMyNegocios } from './api/negocio'
import { setActiveNegocioId } from './api/client'
import type { Negocio } from './api/types'

const STORAGE_KEY = 'vel_negocio_activo'
const QUERY_PARAM = 'negocio'

interface NegocioActivoCtx {
  negocios: Negocio[]
  activo: Negocio | null
  /** Cambia el local activo. Solo actualiza la URL; el resolver lee el nuevo estado. */
  setActivo: (id: string) => void
  isLoading: boolean
  refetch: () => Promise<unknown>
}

const Ctx = createContext<NegocioActivoCtx | null>(null)

export function NegocioActivoProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { data: negocios = [], isLoading, refetch } = useQuery({
    queryKey: ['negocios', 'all'],
    queryFn: getMyNegocios,
    staleTime: 60_000,
  })

  const [activoId, setActivoIdState] = useState<string | null>(null)
  const prevActivoRef = useRef<string | null>(null)

  // ── Resolver: decide activoId a partir de URL / storage / principal / fallback ───
  // Importante: si isLoading=true, no toca activoId. De lo contrario, en el primer
  // render la data todavía es [] (default) y el resolver lo pondría a null, borrando
  // el local activo durante un tick. Eso se manifestaba como "pierde los negocios al
  // recargar" porque cualquier request entre medio salía sin header X-Negocio-Id.
  useEffect(() => {
    if (isLoading) return

    if (negocios.length === 0) {
      if (activoId !== null) setActivoIdState(null)
      return
    }

    const fromQuery = searchParams?.get(QUERY_PARAM)
    const fromStorage = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    // Principal explícito > primer negocio por creación (para casos pre-migración sin es_principal)
    const principal = negocios.find(n => n.esPrincipal)?.id ?? negocios[0].id

    const candidates = [fromQuery, fromStorage, principal].filter(Boolean) as string[]
    const resolved = candidates.find(id => negocios.some(n => n.id === id)) ?? principal

    if (resolved !== activoId) setActivoIdState(resolved)
  }, [isLoading, negocios, searchParams, activoId])

  // ── Efectos al cambiar activoId: header API + localStorage + invalidación scoped ─
  useEffect(() => {
    setActiveNegocioId(activoId)

    if (typeof window !== 'undefined' && activoId) {
      window.localStorage.setItem(STORAGE_KEY, activoId)
    }

    // Solo invalidar si cambió (no en la transición null→primer id del primer render).
    // Y NUNCA invalidar la propia lista del provider ni `usuario` (son user-level, no
    // dependen del scope del negocio activo). Invalidar esas dispara un bucle de
    // refetch → resolver → re-render que causa la sensación de "loco" en UI.
    if (prevActivoRef.current !== null && prevActivoRef.current !== activoId) {
      queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey
          if (!Array.isArray(key) || typeof key[0] !== 'string') return true
          const prefix = key[0]
          // Excluir queries user-level (no dependen del negocio activo)
          if (prefix === 'negocios' || prefix === 'usuario') return false
          return true
        },
      })
    }
    prevActivoRef.current = activoId
  }, [activoId, queryClient])

  // ── setActivo: único cambio es la URL. El resolver se encarga del state. ─────────
  const setActivo = useCallback((id: string) => {
    if (!negocios.some(n => n.id === id)) return
    if (!pathname) return
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set(QUERY_PARAM, id)
    router.replace(`${pathname}?${params.toString()}`)
  }, [negocios, pathname, router, searchParams])

  const activo = useMemo(
    () => negocios.find(n => n.id === activoId) ?? null,
    [negocios, activoId],
  )

  const value = useMemo(
    () => ({ negocios, activo, setActivo, isLoading, refetch }),
    [negocios, activo, setActivo, isLoading, refetch],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * Hook para consumir el contexto. Devuelve null-safe defaults si no hay provider
 * (ej. páginas públicas landing) para que importar el hook no rompa renders SSR.
 */
export function useNegocioActivo(): NegocioActivoCtx {
  const ctx = useContext(Ctx)
  if (ctx) return ctx
  return {
    negocios: [],
    activo: null,
    setActivo: () => {},
    isLoading: false,
    refetch: async () => {},
  }
}
