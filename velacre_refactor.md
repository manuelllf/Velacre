# Velacre — Plan de Refactorización

> **Rama:** `202604_refactor` · **Creado:** 2026-04-13
> **Objetivo:** subir la calidad arquitectónica de un 5-6/10 a un 8/10 estable, sin reescribir desde cero.
> **Regla:** cada punto se puede hacer incrementalmente. Nada rompe producción entre commits.

---

## Puntuación actual (post-refactor)

| Eje | Antes | Ahora | Notas |
|-----|-------|-------|-------|
| Testeabilidad | 3/10 | 7/10 | 53 tests, controllers mockeables via repos |
| Seguridad BD | 2/10 | 7/10 | RLS en 7 tablas, 22 policies, defense-in-depth |
| Mantenibilidad backend | 4/10 | 8/10 | Repos + FluentValidation + .NET 10 |
| Mantenibilidad frontend | 4/10 | 8/10 | React Query, api modular, componentes <300 líneas |
| Protección de rutas | 3/10 | 8/10 | proxy.ts SSR con @supabase/ssr, sin flashing |
| Validación de input | 3/10 | 8/10 | FluentValidation auto-pipeline |
| **Media** | **3.2/10** | **7.7/10** | |

---

## Estado de ejecución

| Punto | Grupo | Estado | Commit | Fecha |
|-------|-------|--------|--------|-------|
| R1 · Repos backend | Grupo 1 | **DONE** | `4f120fc` | 2026-04-13 |
| R4 · FluentValidation | Grupo 1 | **DONE** | `4f120fc` | 2026-04-13 |
| R5 · React Query | Grupo 3 | **DONE** | `9fde768` | 2026-04-13 |
| R8 · api.ts modular | Grupo 3 | **DONE** | `9fde768` | 2026-04-13 |
| R6 · God components | Grupo 4 | **DONE** | `5a5f46a` | 2026-04-13 |
| R9 · proxy.ts SSR | Grupo 6 | **DONE** | `a67b098` | 2026-04-14 |
| R11 · .NET 9→10 | Grupo 6 | **DONE** | `a67b098` | 2026-04-14 |
| R7 · Tests (53) | Grupo 5 | **DONE** | `65ceb48` | 2026-04-14 |
| R2 · RLS policies | Grupo 2 | **DONE** | `bfb1529` | 2026-04-14 |
| R3 · Eliminar proxy CRUD | Grupo 2 | POSPUESTO | — | — |
| R10 · Cola emails/retry | Grupo 6 | POSPUESTO | — | — |

### Puntos pospuestos

**R3 · Eliminar proxy CRUD innecesario**
- El backend sigue usando service_role para todo. Migrar endpoints de CRUD puro a acceso directo frontend→Supabase con anon key requiere evaluar caso por caso y cambiar el modelo de autenticación del frontend.
- Las RLS (R2) ya están puestas para cuando se decida hacer.
- Se reevaluará cuando haya un motivo concreto (latencia, coste, simplificación).

**R10 · Cola de emails / retry**
- Emails se envían fire-and-forget. Si Resend falla, se pierden.
- Peligro 2, prioridad 1 — tolerable en MVP con pocos usuarios.
- Cuando haya 50+ clientes activos, crear tabla `email_queue` + cron de reintento.

---

## Criterios de ordenación

Cada punto se evalúa en 3 ejes (1-5):
- **Peligro** — riesgo real de bug, fallo de seguridad o pérdida de datos en producción
- **Prioridad** — impacto en velocidad de desarrollo, mantenibilidad y capacidad de escalar features
- **Dificultad** — esfuerzo estimado (1=horas, 5=semanas)

---

## R1 · Capa de repositorios en backend — DONE

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 4 | 5 | 3 |

**Problema:** los 11 controllers llaman directamente a `Supabase.Client` con queries fluent. Imposible testear, mezcla de responsabilidades, queries duplicados.

**Solución implementada:** 7 interfaces + 7 implementaciones en `backend/Interfaces/` y `backend/Repositories/`. Los 11 controllers y `GoogleBusinessService` migrados a usar repos por DI.

---

## R2 · RLS policies en Supabase — DONE

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 5 | 4 | 4 |

**Problema:** el backend usa `SUPABASE_SERVICE_KEY` (bypass total de RLS) para todo. Sin red de seguridad si un endpoint tiene un bug de autorización.

**Solución implementada:** RLS activado en las 7 tablas. 22 policies creadas:
- `usuario`: SELECT/UPDATE/INSERT — `id = auth.uid()`
- `negocio`: SELECT/INSERT/UPDATE — `idusuario = auth.uid()`
- Tablas hijas (review, google_connection, competidor, radar_analisis, analisis_ia): CRUD restringido al negocio del usuario via subquery.

El backend sigue usando service_role (bypassa RLS), así que no hay cambio funcional. Es defense-in-depth. SQL en `supabase/migrations/003_rls_policies.sql`.

---

## R3 · Eliminar proxy CRUD innecesario — POSPUESTO

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 2 | 4 | 3 |

**Problema:** muchas operaciones son un proxy transparente: `Next.js → .NET → Supabase` sin lógica de negocio.

**Decisión:** pospuesto. El backend funciona bien como gateway único. Cuando las RLS estén probadas en producción y haya motivo para reducir latencia, se reevaluará qué endpoints mover a acceso directo frontend→Supabase.

---

## R4 · Validación de input (FluentValidation) — DONE

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 4 | 3 | 2 |

**Solución implementada:** 7 validators en `backend/Validators/`, registrados con auto-validation en el pipeline MVC. Validación manual eliminada de controllers.

---

## R5 · React Query — DONE

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 2 | 5 | 3 |

**Solución implementada:** `@tanstack/react-query` con `QueryClientProvider` en `Providers.tsx`. 5 hooks por dominio en `frontend/src/hooks/`: useUsuario, useNegocio, useReviews (query + 3 mutations), useRadar (query + 3 mutations), useMetrics.

---

## R6 · Romper god components — DONE

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 1 | 4 | 3 |

**Solución implementada:**
- `dashboard/page.tsx`: 1324 → 555 líneas. 6 componentes extraídos en `components/dashboard/`: DetailPanel, ReviewList, SyncBar, IaUsageBar, ManualReviewModal, UpsellModal.
- `LandingPage.tsx`: 744 → 227 líneas. 4 componentes extraídos en `components/landing/`: HeroSection, DemoSection, PricingSection, CalculatorSection + shared helpers.
- Cero cambios visuales.

---

## R7 · Tests — DONE

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 3 | 3 | 3 |

**Solución implementada:** de 25 a 53 tests.
- Backend (18): ClaudeService (9), NegocioController (5), UsuarioController (4)
- Frontend (35): API client (8), ResponseCard (4), Tooltip (4), api modules negocio/usuario/radar/reviews (14), useReviews hook (5)
- Cobertura estimada: ~12-15%

---

## R8 · api.ts modular — DONE

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 1 | 3 | 2 |

**Solución implementada:** `lib/api.ts` (759 líneas) → 8 módulos en `lib/api/`: client.ts, types.ts, reviews.ts, negocio.ts, usuario.ts, radar.ts, google.ts, admin.ts + barrel index.ts. Helper `fetchApi<T>` centraliza auth + error handling.

---

## R9 · Next.js proxy.ts SSR — DONE

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 1 | 2 | 4 |

**Solución implementada:**
- `@supabase/ssr` instalado. Browser client migrado de `createClient` a `createBrowserClient` (sesión en cookies HTTP en vez de localStorage).
- `proxy.ts` creado (Next.js 16 renombra middleware→proxy). Protege `/dashboard`, `/settings`, `/inicio`, `/onboarding`, `/admin` — redirect instantáneo sin flashing. Usuarios logueados redirigidos de `/auth/*` a `/inicio`.
- Política de privacidad ya cubría cookies técnicas (§7 en las 3 traducciones).

---

## R10 · Cola de emails / retry — POSPUESTO

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 2 | 1 | 2 |

**Decisión:** tolerable en MVP. Implementar cuando haya volumen de usuarios (50+). Solución futura: tabla `email_queue` + cron de reintento.

---

## R11 · .NET 9 → 10 — DONE

| Peligro | Prioridad | Dificultad |
|---------|-----------|------------|
| 1 | 2 | 1 |

**Solución implementada:** SDK 10.0.201 instalado. `TargetFramework` actualizado a `net10.0` en backend y backend.Tests. Paquetes Microsoft.AspNetCore.* actualizados a v10. Cero breaking changes.

---

*Refactorización completada 2026-04-14. 10 de 11 puntos ejecutados, 2 pospuestos por diseño.*
