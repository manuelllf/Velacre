import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAllReviews, generateForReview, setReviewEstado } from '@/lib/api/reviews'
import { syncReviews } from '@/lib/api/negocio'

export function useReviews() {
  return useQuery({
    queryKey: ['reviews'],
    queryFn: getAllReviews,
  })
}

export function useGenerateForReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reviewId: string) => generateForReview(reviewId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews'] }),
  })
}

export function useSetReviewEstado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: 'pendiente' | 'respondida' | 'ignorada' }) =>
      setReviewEstado(id, estado),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews'] }),
  })
}

export function useSyncReviews() {
  const queryClient = useQueryClient()
  return useMutation<{ newReviews: number }, Error, string | undefined>({
    mutationFn: (negocioId) => syncReviews(negocioId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews'] }),
  })
}
