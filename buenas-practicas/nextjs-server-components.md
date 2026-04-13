# React Server Components en Next.js 16

> Basado en docs locales de Next.js 16.2.1.

## Regla fundamental

**Todo componente es Server Component por defecto.** Solo usar `'use client'` cuando se necesite interactividad o APIs del navegador.

## Cuando usar cada tipo

### Server Components

- Fetch de datos (DB, APIs, ORMs)
- Usar secrets/tokens (API keys)
- Reducir JS enviado al cliente
- Mejorar FCP y streaming progresivo

### Client Components

- Estado (`useState`, `useReducer`)
- Event handlers (`onClick`, `onChange`)
- Efectos (`useEffect`)
- APIs del navegador (`localStorage`, `window`, geolocation)
- Custom hooks

## Patron basico: Server fetches, Client interacts

```tsx
// app/[id]/page.tsx -- SERVER Component (por defecto)
import LikeButton from '@/app/ui/like-button'
import { getPost } from '@/lib/data'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPost(id)

  return (
    <div>
      <h1>{post.title}</h1>
      <LikeButton likes={post.likes} />  {/* Client Component */}
    </div>
  )
}
```

```tsx
// app/ui/like-button.tsx -- CLIENT Component
'use client'

import { useState } from 'react'

export default function LikeButton({ likes }: { likes: number }) {
  const [count, setCount] = useState(likes)
  return <button onClick={() => setCount(c => c + 1)}>{count} likes</button>
}
```

## Reducir bundle JS: `'use client'` lo mas abajo posible

```tsx
// app/layout.tsx -- Server Component (NO marcar 'use client')
import Search from './search'   // Client Component
import Logo from './logo'       // Server Component

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav>
        <Logo />      {/* Server: 0 JS al cliente */}
        <Search />    {/* Client: solo este envia JS */}
      </nav>
      <main>{children}</main>
    </>
  )
}
```

**Regla**: `'use client'` marca un BOUNDARY. Todo lo importado desde ese archivo tambien es client.

## Pasar datos de Server a Client

Los props deben ser **serializables** (no funciones, no clases, no Date objects directamente).

```tsx
// Server Component
const post = await getPost(id)
return <LikeButton likes={post.likes} />  // OK: number es serializable
```

## Intercalar Server y Client Components (patron children)

Usar `children` como "slot" para inyectar Server Components dentro de Client Components:

```tsx
// app/ui/modal.tsx -- Client Component
'use client'

export default function Modal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return open ? <dialog>{children}</dialog> : <button onClick={() => setOpen(true)}>Open</button>
}
```

```tsx
// app/page.tsx -- Server Component
import Modal from './ui/modal'
import Cart from './ui/cart'     // Server Component

export default function Page() {
  return (
    <Modal>
      <Cart />  {/* Se renderiza en el server aunque Modal es client */}
    </Modal>
  )
}
```

## Context Providers

React Context NO funciona en Server Components. Crear provider como Client Component:

```tsx
// app/theme-provider.tsx
'use client'

import { createContext } from 'react'

export const ThemeContext = createContext({})

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}
```

```tsx
// app/layout.tsx -- Server Component
import ThemeProvider from './theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html><body>
      <ThemeProvider>{children}</ThemeProvider>  {/* Lo mas profundo posible */}
    </body></html>
  )
}
```

**Regla**: Renderizar providers lo mas profundo posible en el arbol (solo `{children}`, no `<html>` entero).

## Compartir datos: React.cache + Context + use()

```tsx
// app/lib/user.ts
import { cache } from 'react'

export const getUser = cache(async () => {
  const res = await fetch('https://api.example.com/user')
  return res.json()
})
```

```tsx
// app/user-provider.tsx
'use client'
import { createContext } from 'react'

export const UserContext = createContext<Promise<User> | null>(null)

export default function UserProvider({
  children,
  userPromise,
}: {
  children: React.ReactNode
  userPromise: Promise<User>
}) {
  return <UserContext value={userPromise}>{children}</UserContext>
}
```

```tsx
// app/layout.tsx
import UserProvider from './user-provider'
import { getUser } from './lib/user'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const userPromise = getUser()  // NO await -- pasa la promise
  return (
    <html><body>
      <UserProvider userPromise={userPromise}>{children}</UserProvider>
    </body></html>
  )
}
```

```tsx
// Client Component consume con use()
'use client'
import { use, useContext } from 'react'
import { UserContext } from '../user-provider'

export function Profile() {
  const userPromise = useContext(UserContext)
  const user = use(userPromise!)  // Resuelve la promise
  return <p>Welcome, {user.name}</p>
}
```

**Nota**: `React.cache` es scoped al request actual. No comparte entre requests.

## Streaming con use() API

```tsx
// Server Component -- NO await
export default function Page() {
  const posts = getPosts()  // Returns promise, don't await
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Posts posts={posts} />
    </Suspense>
  )
}

// Client Component
'use client'
import { use } from 'react'

export default function Posts({ posts }: { posts: Promise<Post[]> }) {
  const allPosts = use(posts)  // Suspende hasta resolver
  return <ul>{allPosts.map(p => <li key={p.id}>{p.title}</li>)}</ul>
}
```

## Terceros sin 'use client'

Si un paquete usa `useState` pero no tiene `'use client'`, crear wrapper:

```tsx
// app/carousel.tsx
'use client'
import { Carousel } from 'acme-carousel'
export default Carousel  // Re-exportar como Client Component
```

## Prevenir "environment poisoning"

```tsx
// lib/data.ts -- Marcar como server-only
import 'server-only'  // Error en build si se importa en Client Component

export async function getData() {
  const res = await fetch('...', {
    headers: { authorization: process.env.API_KEY },
  })
  return res.json()
}
```

- Solo variables `NEXT_PUBLIC_*` llegan al bundle del cliente.
- Instalar `server-only` / `client-only` es opcional pero recomendable.
- Next.js maneja estos imports internamente para dar mensajes de error claros.

## Resumen de reglas

| Regla | Detalle |
|-------|---------|
| Default = Server | No marcar nada = Server Component |
| `'use client'` = boundary | Todo lo importado desde ahi es client |
| Props serializables | No pasar funciones/clases a Client Components |
| Children pattern | Para meter Server Components dentro de Client |
| Providers lo mas profundo posible | No envolver `<html>` entero |
| `server-only` | Proteger modulos con secrets |
| `React.cache` | Memoizar per-request en Server Components |
| `use()` API | Resolver promises en Client Components con Suspense |
