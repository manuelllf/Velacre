# Proxy (antes Middleware) y Autenticacion en Next.js 16

> BREAKING CHANGE en v16: `middleware.ts` se renombra a `proxy.ts`.
> La funcion exportada se llama `proxy()` en vez de `middleware()`.
> Migrar con: `npx @next/codemod@canary middleware-to-proxy .`

## Proxy (antes Middleware)

### Que es

Codigo que se ejecuta ANTES de que se renderice la ruta. Util para:
- Redirigir usuarios no autenticados
- Reescribir URLs
- Setear headers/cookies
- CORS
- Logging

### Archivo y ubicacion

```
proyecto/
  app/
  proxy.ts    <-- Al mismo nivel que app/ (o dentro de src/)
```

### Sintaxis basica

```tsx
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // Logica aqui
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
```

### Tipo abreviado NextProxy

```tsx
import type { NextProxy } from 'next/server'

export const proxy: NextProxy = (request, event) => {
  event.waitUntil(Promise.resolve())  // Trabajo en background
  return Response.json({ pathname: request.nextUrl.pathname })
}
```

### Matcher patterns

```tsx
export const config = {
  // Una ruta
  matcher: '/about/:path*',

  // Multiples rutas
  matcher: ['/about/:path*', '/dashboard/:path*'],

  // Con condiciones
  matcher: [
    {
      source: '/api/:path*',
      has: [{ type: 'header', key: 'Authorization', value: 'Bearer Token' }],
      missing: [{ type: 'cookie', key: 'session', value: 'active' }],
    },
  ],
}
```

### Runtime

Proxy usa **Node.js runtime** por defecto (desde v15.5). No se puede cambiar con `runtime` config.

### Ejecucion: Proxy se invoca en TODAS las rutas

Usar `matcher` para filtrar. Orden de ejecucion:
1. `headers` de next.config.js
2. `redirects` de next.config.js
3. **Proxy**
4. Filesystem routes
5. Dynamic routes

### Importante sobre Server Actions

> Un matcher que excluye un path tambien excluye Server Actions en ese path.
> SIEMPRE verificar auth dentro de cada Server Action, no depender solo de Proxy.

---

## Autenticacion

### Conceptos clave

1. **Authentication**: Verificar identidad (login)
2. **Session Management**: Mantener estado auth entre requests
3. **Authorization**: Controlar acceso a rutas y datos

### Patron recomendado: Server Actions + Zod

```tsx
// app/actions/auth.ts
'use server'

import { SignupFormSchema, FormState } from '@/app/lib/definitions'

export async function signup(state: FormState, formData: FormData) {
  // 1. Validar con Zod
  const validatedFields = SignupFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors }
  }

  // 2. Crear usuario
  const { name, email, password } = validatedFields.data
  const hashedPassword = await bcrypt.hash(password, 10)
  const user = await db.insert(users).values({ name, email, password: hashedPassword })

  // 3. Crear sesion
  await createSession(user.id)

  // 4. Redirigir
  redirect('/profile')
}
```

### Formulario con useActionState

```tsx
'use client'

import { useActionState } from 'react'
import { signup } from '@/app/actions/auth'

export default function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined)

  return (
    <form action={action}>
      <input name="name" />
      {state?.errors?.name && <p>{state.errors.name}</p>}
      <input name="email" type="email" />
      {state?.errors?.email && <p>{state.errors.email}</p>}
      <input name="password" type="password" />
      {state?.errors?.password && (
        <ul>{state.errors.password.map(e => <li key={e}>{e}</li>)}</ul>
      )}
      <button disabled={pending}>Sign Up</button>
    </form>
  )
}
```

### Session Management: JWT en Cookies

```tsx
// app/lib/session.ts
import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secretKey = process.env.SESSION_SECRET
const encodedKey = new TextEncoder().encode(secretKey)

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, { algorithms: ['HS256'] })
    return payload
  } catch { console.log('Failed to verify session') }
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const session = await encrypt({ userId, expiresAt })
  const cookieStore = await cookies()
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}
```

### Cookie options recomendadas

| Opcion | Valor | Por que |
|--------|-------|---------|
| `httpOnly` | `true` | Prevenir acceso desde JS del cliente |
| `secure` | `true` | Solo HTTPS |
| `sameSite` | `'lax'` | Proteccion CSRF basica |
| `path` | `'/'` | Disponible en toda la app |

### Authorization con Proxy (checks optimistas)

```tsx
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/app/lib/session'
import { cookies } from 'next/headers'

const protectedRoutes = ['/dashboard']
const publicRoutes = ['/login', '/signup', '/']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.includes(path)
  const isPublicRoute = publicRoutes.includes(path)

  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)

  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (isPublicRoute && session?.userId && !path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
```

### Data Access Layer (DAL) -- checks seguros

```tsx
// app/lib/dal.ts
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { decrypt } from '@/app/lib/session'
import { redirect } from 'next/navigation'

export const verifySession = cache(async () => {
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)

  if (!session?.userId) {
    redirect('/login')
  }

  return { isAuth: true, userId: session.userId }
})

export const getUser = cache(async () => {
  const session = await verifySession()
  if (!session) return null

  const data = await db.query.users.findMany({
    where: eq(users.id, session.userId),
    columns: { id: true, name: true, email: true },  // Solo lo necesario
  })
  return data[0]
})
```

### authInterrupts (experimental)

```tsx
// next.config.ts
const nextConfig: NextConfig = {
  experimental: { authInterrupts: true },
}

// Permite usar forbidden() y unauthorized() como alternativas a redirect
```

## Patron de seguridad en capas

1. **Proxy**: Check optimista (cookie) -- redirige rapido
2. **DAL**: Check seguro (DB) -- en cada data request
3. **Server Actions**: Verificar auth SIEMPRE dentro de cada action
4. **DTO**: Solo devolver campos necesarios (nunca password, etc.)

> Proxy NO es suficiente solo. Es una primera linea de defensa, no la unica.
