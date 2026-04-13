import { useQuery } from '@tanstack/react-query'
import { getMetrics } from '@/lib/api/reviews'

export function useMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: getMetrics,
    staleTime: 60_000,
  })
}
