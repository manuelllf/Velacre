import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing api module
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'fake-jwt-token' } },
      }),
    },
  },
}))

import { ApiError, generateResponses, saveManualReview } from '@/lib/api'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ApiError', () => {
  it('has correct status, message, and data properties', () => {
    const data = { limit: 10, used: 10 }
    const error = new ApiError(429, 'limit_reached', data)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ApiError')
    expect(error.status).toBe(429)
    expect(error.message).toBe('limit_reached')
    expect(error.data).toEqual(data)
  })

  it('works without optional data', () => {
    const error = new ApiError(500, 'server error')

    expect(error.status).toBe(500)
    expect(error.message).toBe('server error')
    expect(error.data).toBeUndefined()
  })
})

describe('generateResponses', () => {
  it('returns parsed response on success', async () => {
    const mockResponse = {
      retenida: false,
      motivoRetencion: null,
      respuesta: 'Gracias por su reseña.',
      contextoCliente: 'Cliente satisfecho.',
      contextoRespuesta: 'Se agradece.',
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    })

    const result = await generateResponses('Excelente comida', 'profesional')

    expect(result).toEqual(mockResponse)
    expect(result.retenida).toBe(false)
    expect(result.respuesta).toBe('Gracias por su reseña.')
  })

  it('throws ApiError with data on 429', async () => {
    const limitData = { limit: 10, used: 10 }

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve(limitData),
    })

    try {
      await generateResponses('Test', 'profesional')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as InstanceType<typeof ApiError>).status).toBe(429)
      expect((err as InstanceType<typeof ApiError>).data).toEqual(limitData)
    }
  })

  it('throws Error on other HTTP errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    })

    await expect(generateResponses('Test')).rejects.toThrow('Internal Server Error')
  })

  it('sends correct Authorization header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ retenida: false }),
    })

    await generateResponses('Test')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/review/generate'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-jwt-token',
        }),
      }),
    )
  })
})

describe('saveManualReview', () => {
  it('returns saved review on success', async () => {
    const mockReview = {
      id: '123',
      clientereview: 'Gran sitio',
      estado: 'respondida',
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockReview),
    })

    const result = await saveManualReview({
      reviewText: 'Gran sitio',
      tonoSeleccionado: 'profesional',
      respuesta: 'Gracias',
      estado: 'respondida',
    })

    expect(result).toEqual(mockReview)
  })

  it('throws ApiError on 429', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ limit: 5 }),
    })

    await expect(
      saveManualReview({
        reviewText: 'Test',
        tonoSeleccionado: 'cercano',
        respuesta: 'Gracias',
        estado: 'pendiente',
      }),
    ).rejects.toThrow(ApiError)
  })
})
