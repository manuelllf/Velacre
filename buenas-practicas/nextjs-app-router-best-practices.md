# Next.js App Router Best Practices (v16)

> Basado en la documentacion local de Next.js 16.2.1 (node_modules/next/dist/docs/).
> ATENCION: Next.js 16 tiene breaking changes respecto a v15. Consultar siempre los docs locales.

## Cambios clave en Next.js 16

- **Turbopack por defecto**: Ya no hace falta `--turbopack`. Se usa automaticamente en `next dev` y `next build`.
- **`middleware.ts` renombrado a `proxy.ts`**: Ver `nextjs-middleware-auth.md`.
- **Cache Components**: Nuevo modelo de caching con `cacheComponents: true` y directiva `'use cache'`.
- **`params` y `searchParams` son Promises**: Hay que hacer `await params` en pages y layouts.
- **Node.js 20.9+ minimo**, TypeScript 5.1+.
- **`PageProps` y `LayoutProps`**: Helpers globales de tipo (no necesitan import).

## Estructura de archivos

```
app/
  layout.tsx          # Root layout (obligatorio, debe tener <html> y <body>)
  page.tsx            # Pagina raiz (/)
  loading.tsx         # Loading UI (envuelve page en <Suspense>)
  error.tsx           # Error boundary ('use client' obligatorio)
  not-found.tsx       # UI para 404
  global-error.tsx    # Error boundary global (debe incluir <html><body>)
  blog/
    page.tsx
    [slug]/
      page.tsx        # Ruta dinamica
    layout.tsx         # Layout anidado para /blog/*
proxy.ts              # Antes middleware.ts - al mismo nivel que app/
```

## Rutas y navegacion

```tsx
// Pagina con params dinamicos - PARAMS ES UNA PROMISE en v16
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // ...
}

// searchParams tambien es Promise
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const filters = (await searchParams).filters
}
```

**Helpers de tipo globales** (sin import):

```tsx
// Se generan con next dev, next build o next typegen
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
}

export default function Layout(props: LayoutProps<'/dashboard'>) {
  return <section>{props.children}</section>
}
```

## Navegacion con Link

```tsx
import Link from 'next/link'

// Link es la forma principal de navegar. Prefetch automatico.
<Link href={`/blog/${post.slug}`}>{post.title}</Link>

// Para navegacion programatica: useRouter (solo Client Components)
```

## Data Fetching

### En Server Components (preferido)

```tsx
// Fetch directo - sin cache por defecto, bloquea hasta completar
export default async function Page() {
  const data = await fetch('https://api.example.com/data')
  const posts = await data.json()
  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>
}

// ORM/DB directo - seguro porque no llega al bundle del cliente
import { db, posts } from '@/lib/db'

export default async function Page() {
  const allPosts = await db.select().from(posts)
  return <ul>{allPosts.map(p => <li key={p.id}>{p.title}</li>)}</ul>
}
```

### Fetching paralelo con Promise.all

```tsx
export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params

  // Iniciar ambas a la vez
  const artistData = getArtist(username)
  const albumsData = getAlbums(username)

  const [artist, albums] = await Promise.all([artistData, albumsData])
  // ...
}
```

### Streaming con Suspense (preferido sobre loading.tsx)

```tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <div>
      <header><h1>Blog</h1></header>
      <Suspense fallback={<BlogListSkeleton />}>
        <BlogList />   {/* Se streama cuando este listo */}
      </Suspense>
    </div>
  )
}
```

**Regla**: `loading.tsx` funciona para segmentos enteros, pero `<Suspense>` da control granular.

## Caching (modelo Cache Components - v16)

Activar en `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  cacheComponents: true,
}
```

### Cache a nivel de datos

```tsx
import { cacheLife } from 'next/cache'

export async function getUsers() {
  'use cache'
  cacheLife('hours')
  return db.query('SELECT * FROM users')
}
```

### Cache a nivel de UI (componente/pagina)

```tsx
import { cacheLife, cacheTag } from 'next/cache'

async function BlogPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')
  const posts = await fetchPosts()
  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>
}
```

### Datos frescos sin cache -> Suspense

```tsx
// NO usar 'use cache'. Envolver en <Suspense>
async function LatestPosts() {
  const data = await fetch('https://api.example.com/posts')
  const posts = await data.json()
  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <LatestPosts />
    </Suspense>
  )
}
```

### APIs de runtime (cookies, headers) -> Suspense obligatorio

```tsx
import { cookies } from 'next/headers'
import { Suspense } from 'react'

async function UserGreeting() {
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')?.value || 'light'
  return <p>Your theme: {theme}</p>
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <UserGreeting />
    </Suspense>
  )
}
```

## Mutaciones (Server Actions)

```tsx
// app/actions.ts
'use server'

import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  // SIEMPRE verificar auth dentro de cada Server Action
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const title = formData.get('title')
  // ... mutate data ...

  revalidatePath('/posts')  // Revalidar cache
  redirect('/posts')        // redirect() lanza excepcion, nada despues se ejecuta
}
```

**Refresh sin revalidar tags** (nuevo en v16):

```tsx
import { refresh } from 'next/cache'

export async function updatePost(formData: FormData) {
  'use server'
  // ... mutate ...
  refresh()  // Refresca el router del cliente
}
```

## Error Handling

**Errores esperados**: devolver como valores, no lanzar.

```tsx
// Server Action
export async function createPost(prevState: any, formData: FormData) {
  const res = await fetch(...)
  if (!res.ok) return { message: 'Failed to create post' }  // NO throw
}
```

**Errores inesperados**: `error.tsx` como boundary.

```tsx
// app/dashboard/error.tsx
'use client'

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => unstable_retry()}>Try again</button>
    </div>
  )
}
```

**Error boundary a nivel de componente** (nuevo):

```tsx
import { unstable_catchError as catchError } from 'next/error'

function ErrorFallback(props, { error, unstable_retry: retry }) {
  return <div><p>{error.message}</p><button onClick={() => retry()}>Retry</button></div>
}

export default catchError(ErrorFallback)
```

## Reglas rapidas

1. **`params` y `searchParams` son Promises** -- siempre `await`.
2. **Server Components por defecto** -- solo marcar `'use client'` donde haga falta.
3. **`'use client'` lo mas abajo posible** -- reducir bundle JS.
4. **Verificar auth en cada Server Action** -- no depender solo de proxy.
5. **`<Suspense>` para datos dinamicos** -- obligatorio con Cache Components.
6. **Props a Client Components deben ser serializables**.
7. **No usar `try/catch` para errores esperados** -- modelar como return values.
8. **`proxy.ts` sustituye a `middleware.ts`** en Next.js 16.
