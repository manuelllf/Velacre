import { supabase } from '../supabase'

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5146'

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly data?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
  }
}

export async function fetchApi<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  options?: { handle429?: boolean }
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: await authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    if (options?.handle429 && res.status === 429) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError(429, 'limit_reached', data as Record<string, unknown>)
    }
    const text = await res.text()
    throw new ApiError(res.status, text)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : (undefined as T)
}
