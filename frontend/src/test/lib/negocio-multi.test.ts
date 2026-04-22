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

import {
  getMyNegocios,
  getMyNegociosIncludingHidden,
  getNegocioById,
  updateNegocioById,
  deleteNegocio,
  restoreNegocio,
  markNegocioPrincipal,
  createNegocio,
  syncReviews,
} from '@/lib/api/negocio'
import { setActiveNegocioId, getActiveNegocioId, ApiError } from '@/lib/api/client'

beforeEach(() => {
  vi.restoreAllMocks()
  setActiveNegocioId(null)
})

describe('multi-negocio API client', () => {
  it('getMyNegocios GETs /api/negocio and returns list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      text: () => Promise.resolve('[{"id":"1","nombre":"A","tonopredefinido":"Cercano","esPrincipal":true,"estado":"activo"}]'),
    })

    const list = await getMyNegocios()

    expect(list).toHaveLength(1)
    expect(list[0].esPrincipal).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5146/api/negocio',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('getMyNegociosIncludingHidden appends ?includeHidden=true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve('[]'),
    })

    await getMyNegociosIncludingHidden()

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5146/api/negocio?includeHidden=true',
      expect.any(Object),
    )
  })

  it('getNegocioById uses /api/negocio/:id', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve('{"id":"abc","nombre":"X","tonopredefinido":"Cercano"}'),
    })

    await getNegocioById('abc')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5146/api/negocio/abc',
      expect.any(Object),
    )
  })

  it('updateNegocioById PUTs to /api/negocio/:id with body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve('{"id":"abc","nombre":"N","tonopredefinido":"Cercano"}'),
    })

    await updateNegocioById('abc', { nombre: 'N' })

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('http://localhost:5146/api/negocio/abc')
    expect(call[1].method).toBe('PUT')
    expect(JSON.parse(call[1].body)).toEqual({ nombre: 'N' })
  })

  it('deleteNegocio DELETEs', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, text: () => Promise.resolve('') })
    await deleteNegocio('abc')
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5146/api/negocio/abc',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('deleteNegocio throws ApiError on 409 last_active', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 409,
      text: () => Promise.resolve('{"error":"last_active"}'),
    })
    await expect(deleteNegocio('abc')).rejects.toThrow(ApiError)
  })

  it('restoreNegocio POSTs to /:id/restaurar', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      text: () => Promise.resolve('{"id":"abc","nombre":"N","tonopredefinido":"Cercano","estado":"activo"}'),
    })
    const n = await restoreNegocio('abc')
    expect(n.estado).toBe('activo')
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5146/api/negocio/abc/restaurar',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('markNegocioPrincipal POSTs to /:id/principal', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, text: () => Promise.resolve('') })
    await markNegocioPrincipal('abc')
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5146/api/negocio/abc/principal',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('createNegocio propagates placeId in body (for existe_oculto detection)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 201, text: () => Promise.resolve('{"id":"1","nombre":"Bar","tonopredefinido":"Cercano"}'),
    })
    await createNegocio({ nombre: 'Bar', placeId: 'ChIJxyz' })
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(JSON.parse(call[1].body)).toMatchObject({ nombre: 'Bar', placeId: 'ChIJxyz' })
  })

  it('syncReviews with explicit negocioId appends query param (override del header)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve('{"newReviews":0}'),
    })
    await syncReviews('ID-123')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/places/sync?negocio_id=ID-123'),
      expect.any(Object),
    )
  })
})

describe('multi-negocio API — error paths', () => {
  it('getNegocioById 404 → throws ApiError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 404, text: () => Promise.resolve('Not found'),
    })
    await expect(getNegocioById('missing')).rejects.toThrow(ApiError)
  })

  it('restoreNegocio 403 slot_limit_reached → throws ApiError con payload', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 403,
      text: () => Promise.resolve('{"error":"slot_limit_reached","contratados":1,"requiredPlan":"pro"}'),
    })
    await expect(restoreNegocio('abc')).rejects.toThrow(ApiError)
  })

  it('markNegocioPrincipal 404 → throws ApiError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 404, text: () => Promise.resolve('Not found'),
    })
    await expect(markNegocioPrincipal('missing')).rejects.toThrow(ApiError)
  })

  it('updateNegocioById 403 Forbid (al cambiar placeId) → throws ApiError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 403, text: () => Promise.resolve(''),
    })
    await expect(updateNegocioById('abc', { placeId: 'ChIJxyz' })).rejects.toThrow(ApiError)
  })

  it('deleteNegocio 400 already_hidden → throws ApiError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 400, text: () => Promise.resolve('{"error":"already_hidden"}'),
    })
    await expect(deleteNegocio('abc')).rejects.toThrow(ApiError)
  })

  it('createNegocio 409 existe_oculto → ApiError con data parseable', async () => {
    // Simula 409 con payload → el caller (onboarding) lee err.data.error === 'existe_oculto'
    // y muestra el modal de restore. Verificamos que el ApiError conserva el status 409.
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 409,
      text: () => Promise.resolve('{"error":"existe_oculto","id":"HID-1","nombre":"Bar Antiguo"}'),
    })
    try {
      await createNegocio({ nombre: 'X', placeId: 'ChIJzzz' })
      expect.unreachable('createNegocio debería haber lanzado')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(409)
    }
  })

  it('syncReviews sin negocioId usa header (no override en URL)', async () => {
    setActiveNegocioId('ACTIVE-789')
    const spy = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve('{"newReviews":0}'),
    })
    global.fetch = spy

    await syncReviews() // sin id explícito

    const url = spy.mock.calls[0][0] as string
    expect(url).toBe('http://localhost:5146/api/places/sync')
    expect(url).not.toContain('negocio_id=')
    const headers = spy.mock.calls[0][1].headers as Record<string, string>
    expect(headers['X-Negocio-Id']).toBe('ACTIVE-789')
  })

  it('syncReviews con negocioId vacío string también omite el query', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve('{"newReviews":0}'),
    })
    global.fetch = spy
    await syncReviews('')
    const url = spy.mock.calls[0][0] as string
    expect(url).not.toContain('negocio_id=')
  })
})

describe('setActiveNegocioId injection into authHeaders', () => {
  it('no id set → header X-Negocio-Id ausente', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('[]') })
    global.fetch = spy

    await getMyNegocios()

    const headers = spy.mock.calls[0][1].headers as Record<string, string>
    expect(headers['X-Negocio-Id']).toBeUndefined()
  })

  it('setActiveNegocioId → header presente en todas las requests', async () => {
    setActiveNegocioId('ACTIVE-123')
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('[]') })
    global.fetch = spy

    await getMyNegocios()

    const headers = spy.mock.calls[0][1].headers as Record<string, string>
    expect(headers['X-Negocio-Id']).toBe('ACTIVE-123')
  })

  it('getActiveNegocioId devuelve exactamente lo que se set (round-trip)', () => {
    expect(getActiveNegocioId()).toBeNull()
    setActiveNegocioId('abc-123')
    expect(getActiveNegocioId()).toBe('abc-123')
    setActiveNegocioId('xyz-456')
    expect(getActiveNegocioId()).toBe('xyz-456')
  })

  it('setActiveNegocioId(null) limpia el header', async () => {
    setActiveNegocioId('ACTIVE-123')
    setActiveNegocioId(null)
    expect(getActiveNegocioId()).toBeNull()

    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('[]') })
    global.fetch = spy
    await getMyNegocios()
    const headers = spy.mock.calls[0][1].headers as Record<string, string>
    expect(headers['X-Negocio-Id']).toBeUndefined()
  })
})
