import { useQuery } from '@tanstack/react-query'
import { getMyNegocio } from '@/lib/api/negocio'

export function useNegocio() {
  return useQuery({
    queryKey: ['negocio'],
    queryFn: getMyNegocio,
  })
}
