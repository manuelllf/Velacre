import { useQuery } from '@tanstack/react-query'
import { getMyUsuario } from '@/lib/api/usuario'

export function useUsuario() {
  return useQuery({
    queryKey: ['usuario'],
    queryFn: getMyUsuario,
  })
}
