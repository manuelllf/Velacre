# TanStack Query (React Query) con Next.js App Router

> Basado en docs oficiales de TanStack Query y Next.js 16.2.1.
> Este proyecto NO usa @tanstack/react-query actualmente. Esta guia es para cuando se integre.

## Cuando usar React Query vs Server Components

| Escenario | Solucion |
|-----------|----------|
| Datos iniciales de pagina | Server Components (fetch directo) |
| Datos que cambian frecuentemente (polling) | React Query |
| Mutaciones con optimistic updates | React Query |
| Cache client-side compartido entre componentes | React Query |
| Datos que solo se leen una vez | Server Components |
| DevTools para debugging | React Query |

**Regla de TanStack**: Si empiezas un proyecto nuevo con Server Components, usa primero el data fetching del framework (fetch en Server Components). Introduce React Query solo cuando lo necesites.

## Setup: QueryClient singleton

```tsx
// app/get-query-client.ts
import { isServer, QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Datos frescos durante 60s -- evita refetch innecesario en navegacion
        staleTime: 60 * 1000,
      },
      dehydrate: {
        // Tambien deshidratar queries pendientes para streaming
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (isServer) {
    // Server: siempre crear nuevo (evitar compartir entre requests)
    return makeQueryClient()
  }
  // Browser: reusar singleton
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
```

## Provider (Client Component, una sola vez)

```tsx
// app/providers.tsx
'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { getQueryClient } from './get-query-client'

export default function Providers({ children }: { children: React.ReactNode }) {
  // NO usar useState para crear el QueryClient -- causa problemas con Suspense
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

```tsx
// app/layout.tsx
import Providers from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html><body>
      <Providers>{children}</Providers>
    </body></html>
  )
}
```

## Patron principal: Prefetch en Server + Hydration en Client

### 1. Server Component prefetcha datos

```tsx
// app/posts/page.tsx -- Server Component
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { getPosts } from '@/lib/api'
import Posts from './posts'

export default async function PostsPage() {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: ['posts'],
    queryFn: getPosts,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Posts />
    </HydrationBoundary>
  )
}
```

### 2. Client Component usa los datos prefetchados

```tsx
// app/posts/posts.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { getPosts } from '@/lib/api'

export default function Posts() {
  // Datos ya disponibles desde el prefetch -- sin loading flash
  const { data } = useQuery({
    queryKey: ['posts'],
    queryFn: getPosts,
  })

  return (
    <ul>
      {data?.map(post => <li key={post.id}>{post.title}</li>)}
    </ul>
  )
}
```

## Streaming sin bloquear (non-blocking prefetch)

Para no bloquear la pagina mientras se cargan los datos:

```tsx
// app/posts/page.tsx
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { getQueryClient } from '@/app/get-query-client'
import { Suspense } from 'react'
import Posts from './posts'

export default function PostsPage() {
  const queryClient = getQueryClient()

  // NO await -- la query se resuelve en streaming
  queryClient.prefetchQuery({
    queryKey: ['posts'],
    queryFn: getPosts,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<PostsSkeleton />}>
        <Posts />
      </Suspense>
    </HydrationBoundary>
  )
}
```

**Requisito**: Configurar `shouldDehydrateQuery` para incluir queries pendientes (ver setup arriba).

## Prefetch anidado (colocated data fetching)

Prefetchar en el Server Component mas cercano al dato, no en la raiz:

```tsx
// app/dashboard/page.tsx
export default async function DashboardPage() {
  const queryClient = new QueryClient()

  // Prefetch paralelo
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: ['stats'], queryFn: getStats }),
    queryClient.prefetchQuery({ queryKey: ['recent'], queryFn: getRecent }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Stats />
      <RecentActivity />
    </HydrationBoundary>
  )
}
```

## Mutaciones

```tsx
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

export function CreatePostForm() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (newPost: { title: string }) => {
      const res = await fetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(newPost),
      })
      return res.json()
    },
    onSuccess: () => {
      // Invalidar cache para refrescar la lista
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      const formData = new FormData(e.currentTarget)
      mutation.mutate({ title: formData.get('title') as string })
    }}>
      <input name="title" />
      <button disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create Post'}
      </button>
      {mutation.isError && <p>Error: {mutation.error.message}</p>}
    </form>
  )
}
```

## Optimistic Updates

```tsx
const mutation = useMutation({
  mutationFn: updatePost,
  onMutate: async (newData) => {
    // Cancelar queries en curso
    await queryClient.cancelQueries({ queryKey: ['posts'] })

    // Snapshot del valor anterior
    const previousPosts = queryClient.getQueryData(['posts'])

    // Optimistic update
    queryClient.setQueryData(['posts'], (old: Post[]) =>
      old.map(p => p.id === newData.id ? { ...p, ...newData } : p)
    )

    return { previousPosts }
  },
  onError: (_err, _newData, context) => {
    // Rollback en caso de error
    queryClient.setQueryData(['posts'], context?.previousPosts)
  },
  onSettled: () => {
    // Refetch para sincronizar con servidor
    queryClient.invalidateQueries({ queryKey: ['posts'] })
  },
})
```

## Polling (refetch periodico)

```tsx
const { data } = useQuery({
  queryKey: ['analysis', analysisId],
  queryFn: () => fetchAnalysisStatus(analysisId),
  refetchInterval: (query) => {
    // Parar polling cuando el analisis termine
    if (query.state.data?.status === 'completed') return false
    return 5000  // Cada 5 segundos
  },
})
```

## Query Keys: estructura recomendada

```tsx
// Jerarquicos y predecibles
const queryKeys = {
  all:      ['posts'] as const,
  lists:    () => [...queryKeys.all, 'list'] as const,
  list:     (filters: Filters) => [...queryKeys.lists(), filters] as const,
  details:  () => [...queryKeys.all, 'detail'] as const,
  detail:   (id: string) => [...queryKeys.details(), id] as const,
}

// Uso
useQuery({ queryKey: queryKeys.detail(postId), queryFn: () => getPost(postId) })

// Invalidar todas las listas
queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
```

## Configuracion recomendada de staleTime

| Tipo de dato | staleTime | Por que |
|-------------|-----------|---------|
| Datos estaticos (categorias, config) | `Infinity` o `24h` | Raramente cambian |
| Listas de contenido | `1-5 min` | Balance frescura/performance |
| Datos en tiempo real (analisis en curso) | `0` + `refetchInterval` | Siempre frescos |
| Datos de usuario/sesion | `5-10 min` | Relativamente estables |

## Errores comunes

1. **Crear QueryClient con useState en el provider** -- Causa problemas con Suspense. Usar el patron singleton de arriba.
2. **No poner staleTime > 0** -- Sin staleTime, React Query refetchea en cada render. Minimo 60s recomendado.
3. **Prefetchar en layout.tsx** -- Prefetchar lo mas cerca posible del componente que consume los datos.
4. **Mezclar ownership de datos** -- Si prefetchas en Server Y renderizas en Server, la revalidacion client-side no actualizara el Server Component. Mantener ownership clara.
5. **Olvidar HydrationBoundary** -- Sin ella, el prefetch del server no llega al client.

## Cuando NO usar React Query

- Datos que solo se leen una vez en la pagina (usar Server Components)
- Datos que no necesitan revalidacion client-side
- Formularios simples (usar Server Actions con useActionState)
- Datos que solo necesitan cache server-side (usar `'use cache'` de Next.js)
