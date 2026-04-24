import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'

// Mock the API modules
vi.mock('@/lib/api/reviews', () => ({
  getAllReviews: vi.fn(),
  generateForReview: vi.fn(),
  setReviewEstado: vi.fn(),
}))

vi.mock('@/lib/api/negocio', () => ({
  syncReviews: vi.fn(),
}))

import { useReviews, useGenerateForReview, useSetReviewEstado, useSyncReviews } from '@/hooks/useReviews'
import { getAllReviews, generateForReview, setReviewEstado } from '@/lib/api/reviews'
import { syncReviews } from '@/lib/api/negocio'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useReviews', () => {
  it('fetches reviews on mount', async () => {
    const mockReviews = [{ id: '1', clientereview: 'Genial' }]
    vi.mocked(getAllReviews).mockResolvedValue(mockReviews as never)

    const { result } = renderHook(() => useReviews(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockReviews)
    expect(getAllReviews).toHaveBeenCalledOnce()
  })

  it('handles error state', async () => {
    vi.mocked(getAllReviews).mockRejectedValue(new Error('fail'))

    const { result } = renderHook(() => useReviews(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })
})

describe('useGenerateForReview', () => {
  it('calls generateForReview with review id', async () => {
    vi.mocked(generateForReview).mockResolvedValue({ response: 'Gracias' } as never)

    const { result } = renderHook(() => useGenerateForReview(), { wrapper: createWrapper() })

    result.current.mutate('review-123')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(generateForReview).toHaveBeenCalledWith('review-123')
  })
})

describe('useSetReviewEstado', () => {
  it('calls setReviewEstado with id and estado', async () => {
    vi.mocked(setReviewEstado).mockResolvedValue(undefined)

    const { result } = renderHook(() => useSetReviewEstado(), { wrapper: createWrapper() })

    result.current.mutate({ id: 'rev-1', estado: 'respondida' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(setReviewEstado).toHaveBeenCalledWith('rev-1', 'respondida')
  })
})

describe('useSyncReviews', () => {
  it('calls syncReviews', async () => {
    vi.mocked(syncReviews).mockResolvedValue({ newReviews: 3 })

    const { result } = renderHook(() => useSyncReviews(), { wrapper: createWrapper() })

    result.current.mutate(undefined)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(syncReviews).toHaveBeenCalledOnce()
  })
})
