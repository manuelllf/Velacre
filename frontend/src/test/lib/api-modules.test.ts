import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'fake-jwt-token' } },
      }),
    },
  },
}))

import { getMyNegocio, createNegocio, updateNegocio, syncReviews } from '@/lib/api/negocio'
import { getMyUsuario, createUsuario } from '@/lib/api/usuario'
import { getRadar, addCompetidor, removeCompetidor } from '@/lib/api/radar'
import { getAllReviews, setReviewEstado, getMetrics } from '@/lib/api/reviews'
import { ApiError } from '@/lib/api'

beforeEach(() => {
  vi.restoreAllMocks()
})

// ── Negocio module ──

describe('negocio API', () => {
  it('getMyNegocio returns null on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
    const result = await getMyNegocio()
    expect(result).toBeNull()
  })

  it('getMyNegocio returns negocio on success', async () => {
    const negocio = { id: '1', nombre: 'Bar Test', tonopredefinido: 'Cercano' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(negocio),
    })
    const result = await getMyNegocio()
    expect(result).toEqual(negocio)
  })

  it('getMyNegocio throws ApiError on 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500, text: () => Promise.resolve('server error'),
    })
    await expect(getMyNegocio()).rejects.toThrow(ApiError)
  })

  it('createNegocio sends POST', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 201, text: () => Promise.resolve('{"id":"1","nombre":"Nuevo"}'),
    })
    const result = await createNegocio({ nombre: 'Nuevo' })
    expect(result.nombre).toBe('Nuevo')
  })

  it('syncReviews returns count', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve('{"newReviews":5}'),
    })
    const result = await syncReviews()
    expect(result.newReviews).toBe(5)
  })
})

// ── Usuario module ──

describe('usuario API', () => {
  it('getMyUsuario returns user data', async () => {
    const user = { id: '1', nombre: 'Manuel', plan: 'core', isAdmin: false, rol: 'cliente', activo: true }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(user)),
    })
    const result = await getMyUsuario()
    expect(result.nombre).toBe('Manuel')
    expect(result.plan).toBe('core')
  })

  it('createUsuario sends POST with custom token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 201, text: () => Promise.resolve(''),
    })
    await createUsuario({ nombre: 'Test' }, 'custom-token')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/usuario'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer custom-token',
        }),
      }),
    )
  })

  it('createUsuario throws on error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 400, text: () => Promise.resolve('bad request'),
    })
    await expect(createUsuario({ nombre: '' })).rejects.toThrow('bad request')
  })
})

// ── Radar module ──

describe('radar API', () => {
  it('getRadar returns radar data', async () => {
    const data = { competidores: [], analisis: [] }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(data)),
    })
    const result = await getRadar()
    expect(result.competidores).toEqual([])
  })

  it('addCompetidor sends POST and returns competidor', async () => {
    const comp = { id: '1', nombre: 'Rival', placeId: 'place123' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 201, json: () => Promise.resolve(comp),
    })
    const result = await addCompetidor('place123', 'Rival')
    expect(result.nombre).toBe('Rival')
  })

  it('addCompetidor throws ApiError on failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 400, json: () => Promise.resolve({ error: 'duplicado' }),
    })
    await expect(addCompetidor('p1', 'Rival')).rejects.toThrow(ApiError)
  })
})

// ── Reviews module ──

describe('reviews API', () => {
  it('getAllReviews returns list', async () => {
    const reviews = [{ id: '1', clientereview: 'Genial' }]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(reviews)),
    })
    const result = await getAllReviews()
    expect(result).toHaveLength(1)
    expect(result[0].clientereview).toBe('Genial')
  })

  it('setReviewEstado sends PUT', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve('{}'),
    })
    await setReviewEstado('rev1', 'respondida')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/review/rev1/estado'),
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('getMetrics returns metrics', async () => {
    const metrics = { total: 50, pendiente: 10, respondida: 35, ignorada: 5 }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(metrics)),
    })
    const result = await getMetrics()
    expect(result.total).toBe(50)
  })
})
