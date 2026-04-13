import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRadar, addCompetidor, removeCompetidor, runRadarAnalysis } from '@/lib/api/radar'

export function useRadar() {
  return useQuery({
    queryKey: ['radar'],
    queryFn: getRadar,
  })
}

export function useAddCompetidor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ placeId, nombre }: { placeId: string; nombre: string }) =>
      addCompetidor(placeId, nombre),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['radar'] }),
  })
}

export function useRemoveCompetidor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeCompetidor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['radar'] }),
  })
}

export function useRunRadarAnalysis() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: runRadarAnalysis,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['radar'] }),
  })
}
