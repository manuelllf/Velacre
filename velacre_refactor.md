# Velacre — Plan de Refactorización

> **Rama:** `202604_refactor` · **Creado:** 2026-04-13
> **Objetivo:** subir la calidad arquitectónica de un 5-6/10 a un 8/10 estable, sin reescribir desde cero.
> **Regla:** cada punto se puede hacer incrementalmente. Nada rompe producción entre commits.

---

## Criterios de ordenación

Cada punto se evalúa en 3 ejes (1-5):
- **Peligro** — riesgo real de bug, fallo de seguridad o pérdida de datos en producción
- **Prioridad** — impacto en velocidad de desarrollo, mantenibilidad y capacidad de escalar features
- **Dificultad** — esfuerzo estimado (1=horas, 5=semanas)

---

## R1 · Capa de repositorios en backend

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 4 | 5 | 3 |

**Problema:** los 11 controllers llaman directamente a `Supabase.Client` con queries fluent (`From<T>().Where(...).Get()`). Esto:
- Hace **imposible testear** controllers (no se puede mockear `Supabase.Client` fácilmente)
- Mezcla lógica de negocio con acceso a datos en el mismo método
- Repite patrones idénticos (buscar usuario, buscar negocio, verificar plan) en múltiples controllers
- Un typo en un `.Where()` es un bug silencioso en producción

**Solución:** extraer interfaces de repositorio (`IUsuarioRepository`, `INegocioRepository`, `IReviewRepository`, etc.) con implementaciones que encapsulan Supabase. Los controllers reciben repos por DI.

**Relacionado con:** R7 (tests de controllers), R2 (RLS)

**Resultado esperado:** controllers testeables, queries centralizados, un solo sitio donde tocar si cambia el acceso a BD.

---

## R2 · RLS policies en Supabase + dejar de usar service key para todo

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 5 | 4 | 4 |

**Problema:** el backend usa `SUPABASE_SERVICE_KEY` (bypass total de Row Level Security) para todas las operaciones. Si un endpoint tiene un bug de autorización (ej: no valida que el userId del JWT coincida con el recurso), no hay red de seguridad — se puede leer/escribir cualquier dato de cualquier usuario.

**Solución:** crear RLS policies por tabla que restrinjan acceso por `auth.uid()`. El backend pasa el JWT del usuario a Supabase en lugar de la service key para operaciones normales. Service key solo para: admin, cron, webhooks.

**Relacionado con:** R1 (los repos encapsularían la lógica de qué client usar)

**Resultado esperado:** si un controller tiene un bug, la BD se protege sola. Defense in depth.

**Nota:** requiere decisión sobre si el frontend debería hablar directo con Supabase para CRUD simple (ver R3).

---

## R3 · Eliminar proxy CRUD innecesario en .NET

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 2 | 4 | 3 |

**Problema:** muchas operaciones son un proxy transparente: `Next.js → .NET → Supabase`. Ejemplos:
- `GET /api/negocio/me` → lee de Supabase y devuelve
- `GET /api/review/all` → lee de Supabase y devuelve
- `PUT /api/usuario/me` → update nombre en Supabase

El backend no añade lógica en estos casos. Es latencia extra y código extra.

**Opciones:**
- **Opción A — Frontend → Supabase directo para CRUD:** el frontend usa `supabase-js` para leer/escribir datos simples (con RLS). .NET solo para lógica de negocio (IA, scraping, webhooks, validaciones complejas). Menos latencia, menos endpoints.
- **Opción B — Mantener .NET como gateway único:** todos los datos pasan por .NET. Más control centralizado, pero más código boilerplate.

**Relacionado con:** R2 (sin RLS no se puede hacer Opción A), R1 (afecta qué repos se necesitan)

**⚠️ REQUIERE DECISIÓN antes de implementar.**

---

## R4 · Validación de input formal en backend

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 4 | 3 | 2 |

**Problema:** no hay FluentValidation ni data annotations. Cada controller valida manualmente con `if (string.IsNullOrEmpty(...))`. Hay validaciones que faltan o son inconsistentes. Un campo inesperado o malformado puede causar un 500 en vez de un 400.

**Solución:** añadir FluentValidation. Un validator por request DTO, registrado por DI, ejecutado automáticamente por el pipeline de ASP.NET. Los controllers dejan de tener `if` de validación.

**Relacionado con:** R1 (validators van junto a la reestructuración de controllers)

**Resultado esperado:** errores 400 claros y consistentes. Menos código en controllers.

---

## R5 · Estado global frontend (React Query)

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 2 | 5 | 3 |

**Problema:** cada página hace fetch al montar sin cache. No hay React Query, no hay SWR, no hay context de usuario/negocio. Consecuencias:
- Refetches innecesarios al navegar (usuario, negocio se piden N veces)
- Sin loading states compartidos
- Sin optimistic updates
- `dashboard/page.tsx` tiene ~15 `useState` porque todo es local
- Sin retry automático en errores transitorios

**Solución:** añadir TanStack Query (React Query). Crear custom hooks por dominio (`useUsuario()`, `useNegocio()`, `useReviews()`, `useRadar()`). Cache inteligente, invalidación tras mutaciones, retry automático.

**Relacionado con:** R6 (romper god components), R8 (romper api.ts)

**Resultado esperado:** navegación instantánea con cache, menos código en páginas, loading/error states consistentes.

---

## R6 · Romper god components

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 1 | 4 | 3 |

**Problema:**
- `dashboard/page.tsx` — **1307 líneas**, ~15 useState, modales inline, filtros, sync, generación IA, todo mezclado
- `LandingPage.tsx` — **1000+ líneas**, hero + features + pricing + footer en un componente

**Solución:** extraer en componentes con responsabilidad única:
- Dashboard: `ReviewList`, `ReviewFilters`, `ReviewDetail`, `GenerateModal`, `SyncProgress`
- Landing: `Hero`, `Features`, `Pricing`, `Testimonials`, `Footer`

**Relacionado con:** R5 (React Query reduce useState en dashboard), R8 (hooks por dominio)

**Resultado esperado:** componentes de <200 líneas, fáciles de leer y testear.

---

## R7 · Ampliar cobertura de tests

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 3 | 3 | 3 |

**Problema:** ~5-7% de cobertura (25 tests). Solo cubre ClaudeService, API client, y 2 componentes. Cero tests de controllers, cero tests de flujos end-to-end.

**Solución:** tras R1 (repos), los controllers se pueden testear fácilmente con mocks de interfaces. Priorizar:
1. ReviewController (el más crítico — generación, límites, filtro seguridad)
2. LemonController (webhook — dinero)
3. UsuarioController (eliminación de cuenta — destructivo)
4. Frontend: hooks de React Query (tras R5)

**Relacionado con:** R1 (prerequisito para tests de controllers)

**Resultado esperado:** 30-40% cobertura en flujos críticos.

---

## R8 · Romper `lib/api.ts` monolítico

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 1 | 3 | 2 |

**Problema:** 759 líneas, 100+ funciones, todo en un archivo. Cada función repite `fetch + authHeaders + if (!res.ok)`. Sin separación por dominio.

**Solución:** 
- Helper genérico: `fetchApi<T>(method, path, body?)` que centralice auth + error handling
- Separar por dominio: `api/reviews.ts`, `api/radar.ts`, `api/admin.ts`, `api/auth.ts`, `api/negocio.ts`
- Si se implementa R5, estos se convierten en la base de los React Query hooks

**Relacionado con:** R5 (React Query hooks consumen estos módulos), R6 (imports más limpios)

**Resultado esperado:** archivos de <100 líneas, DRY, fácil de encontrar qué toca cada dominio.

---

## R9 · Next.js — usar correctamente o migrar

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 1 | 2 | 4 |

**Problema:** Next.js 16 con App Router se usa como SPA puro. Todo es `'use client'`, no hay `middleware.ts`, no hay Server Components reales, no hay SSR. La protección de rutas es client-side (useEffect + getSession → flashing). Estamos pagando la complejidad de Next.js sin sus beneficios.

**Opciones:**
- **Opción A — Usar Next.js bien:** añadir `middleware.ts` para protección server-side, usar RSC donde tenga sentido (layout autenticado), eliminar flashing.
- **Opción B — Migrar a Vite + React Router:** build más rápido, bundle más pequeño, sin la complejidad del App Router. Misma funcionalidad para una SPA autenticada.

**⚠️ REQUIERE DECISIÓN.** Opción A es más conservadora y menor esfuerzo. Opción B es más limpia pero es una migración grande.

**Relacionado con:** R5, R6 (si migramos, hay que mover todo junto)

---

## R10 · Cola de emails / retry

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 2 | 1 | 2 |

**Problema:** emails enviados con fire-and-forget. Si Resend falla, se loguea y el email se pierde. Para un MVP es tolerable, pero con clientes reales un email de bienvenida que no llega es malo.

**Solución:** tabla `email_queue` en Supabase + cron que reintente los fallidos. O usar Resend webhooks para detectar fallos y reenviar.

**Resultado esperado:** 0 emails perdidos silenciosamente.

---

## Mapa de dependencias entre puntos

```
R2 (RLS) ──────────┐
                    ├──→ R3 (eliminar proxy CRUD) 
R1 (repos) ────────┤
    │               └──→ R7 (tests controllers)
    │
    └──→ R4 (validación)

R5 (React Query) ──┬──→ R6 (romper god components)
                    └──→ R8 (romper api.ts)

R9 (Next.js) ── decisión independiente pero afecta a R5/R6

R10 (emails) ── independiente
```

### Grupos de ataque recomendados

| Grupo | Puntos | Por qué juntos |
|-------|--------|-----------------|
| **Grupo 1 — Backend core** | R1 + R4 | Repos + validación van de la mano, se tocan los mismos archivos |
| **Grupo 2 — Seguridad BD** | R2 + R3 (parcial) | RLS habilita decisiones sobre proxy vs directo |
| **Grupo 3 — Frontend core** | R5 + R8 | React Query necesita api.ts reorganizado primero |
| **Grupo 4 — Frontend UI** | R6 | Romper god components con los hooks de R5 ya listos |
| **Grupo 5 — Tests** | R7 | Con repos (R1) ya se pueden testear controllers |
| **Grupo 6 — Independientes** | R9, R10 | Se pueden hacer en cualquier momento |

---

## Orden de ejecución sugerido

1. **Grupo 1** (R1+R4) — desbloquea tests y limpia backend
2. **Grupo 2** (R2+R3) — seguridad, requiere decisión arquitectónica
3. **Grupo 3** (R5+R8) — moderniza frontend, reduce código
4. **Grupo 4** (R6) — rompe god components con herramientas ya listas
5. **Grupo 5** (R7) — amplía tests con la nueva arquitectura
6. **Grupo 6** (R9, R10) — cuando haya hueco

---

*Este documento se irá actualizando con decisiones tomadas y progreso.*
