'use client'

/**
 * NegocioActivoProvider — gestiona el "local activo" del usuario multi-local.
 *
 * Fuente de verdad en cascada (del más fuerte al más débil):
 *   1. Query param `?negocio=<id>` en la URL (bookmarkable, compartible)
 *   2. `localStorage.vel_negocio_activo` (persistencia entre sesiones)
 *   3. Primer negocio del usuario ordenado por creación ASC (primario)
 *
 * El provider:
 *   - Mantiene la lista completa de negocios via React Query.
 *   - Expone `activo`, `setActivo`, `negocios`, `isLoading`.
 *   - Escribe el id activo al store del api client (`setActiveNegocioId`) → todas las
 *     requests incluyen el header X-Negocio-Id automáticamente.
 *   - Invalida las queries en memoria al cambiar de activo → el dashboard/salud/radar
 *     re-fetchean con el nuevo scope sin necesidad de incluir negocioId en cada key.
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
  /** Cambia el local activo. Actualiza URL, localStorage, header y refresca queries. */
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

  // Resolver el id activo al cargar negocios o cambiar query param
  useEffect(() => {
    if (negocios.length === 0) {
      setActivoIdState(null)
      setActiveNegocioId(null)
      return
    }

    const fromQuery = searchParams?.get(QUERY_PARAM)
    const fromStorage = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    const primary = negocios[0].id

    const candidateIds = [fromQuery, fromStorage, primary].filter(Boolean) as string[]
    const resolved = candidateIds.find(id => negocios.some(n => n.id === id)) ?? primary

    if (resolved !== activoId) {
      setActivoIdState(resolved)
    }
  }, [negocios, searchParams, activoId])

  // Propagar el activoId al api client + invalidar queries al cambiar
  useEffect(() => {
    setActiveNegocioId(activoId)

    if (typeof window !== 'undefined' && activoId) {
      window.localStorage.setItem(STORAGE_KEY, activoId)
    }

    // Solo invalidar si de verdad cambió (no en el primer render)
    if (prevActivoRef.current !== null && prevActivoRef.current !== activoId) {
      queryClient.invalidateQueries()
    }
    prevActivoRef.current = activoId
  }, [activoId, queryClient])

  const setActivo = useCallback((id: string) => {
    if (!negocios.some(n => n.id === id)) return
    setActivoIdState(id)

    // Sincronizar URL (sin navegar, solo query param)
    if (pathname) {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set(QUERY_PARAM, id)
      router.replace(`${pathname}?${params.toString()}`)
    }
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
 * (ej. en páginas públicas como la landing), de modo que importar este hook desde
 * cualquier sitio no rompe.
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
