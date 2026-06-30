# Velacre

SaaS B2B que permite a negocios locales gestionar y responder reseñas de Google con IA. Construido como proyecto personal para aprender a lanzar un producto completo de principio a fin.

**Demo:** [velacre.vercel.app](https://velacre.vercel.app)

---

## Qué hace

- Importa reseñas de Google automáticamente (vía Google Business Profile API o Outscraper como fallback)
- Genera respuestas con IA (Claude) en 6 tonos diferentes, en el idioma de la reseña
- Filtro de seguridad que retiene automáticamente reseñas con acusaciones graves antes de generar respuesta
- Panel de salud con métricas, análisis IA y evolución histórica
- Radar de competencia: análisis comparativo contra hasta 3 rivales (plan Pro)
- PDFs de benchmark mensual/anual generados en cliente
- Soporte multi-local (N negocios por usuario)
- PWA instalable en Android e iOS
- i18n en castellano, gallego e inglés

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 4 |
| Backend | .NET 10 (ASP.NET Core) — sin EF Core, repositorios sobre Postgrest |
| Base de datos | Supabase (PostgreSQL + Auth + RPC) |
| IA | Claude Sonnet via Anthropic SDK — tool use para structured output |
| Auth | Supabase Auth (email+pwd y Google OAuth), JWT ES256 validado con JWKS |
| Pagos | Lemon Squeezy (Merchant of Record, webhooks HMAC-SHA256) |
| Reseñas | Google Business Profile API + Outscraper |
| Email | Resend |
| Deploy | Railway (backend) + Vercel (frontend) |

---

## Arquitectura

```text
Next.js (Vercel)
    │ JWT Bearer
    ▼
.NET 10 (Railway)
    ├── Anthropic Claude      — respuestas IA, filtro seguridad, radar
    ├── Google Places v1      — búsqueda de negocios en onboarding
    ├── Google Business Profile API — sync y publicación de reseñas
    ├── Outscraper            — fallback scraping + reseñas de competidores
    ├── Lemon Squeezy         — checkout y suscripciones
    └── Resend                — emails transaccionales
         │ supabase-csharp (Postgrest)
         ▼
    Supabase (PostgreSQL + Auth)
```

---

## Decisiones técnicas destacadas

**Sin EF Core.** El backend usa `supabase-csharp` directamente sobre Postgrest. Para operaciones que necesitan atomicidad (contador de uso de IA, creación multi-local, cambio de negocio principal, delete en cascada) se usan RPCs en PostgreSQL con `FOR UPDATE` y `SECURITY DEFINER`.

**Structured output con tool use.** El Radar de competencia y el Mini Radar usan tool use de la API de Anthropic con JSON Schema forzado. La API valida los argumentos antes de devolverlos, eliminando el problema de JSON truncado o malformado.

**Circuit breaker en Claude.** Polly (`Microsoft.Extensions.Http.Resilience`) con threshold del 50% de fallos en ventana de 30s, timeout de 90s por intento y retry exponencial solo en `overloaded_error`.

**RLS como defense-in-depth.** 7 tablas con 22 policies por `auth.uid()`. El backend usa service_role (bypassa RLS), pero RLS queda como capa adicional.

**Auth SSR sin flash.** `proxy.ts` (Next.js 16) con `@supabase/ssr` valida sesión server-side con cookies HTTP antes del primer paint. Rutas protegidas redirigen sin flash.

**Multi-local atómico.** La creación de negocios pasa por `try_create_negocio` (RPC con `SELECT FOR UPDATE` sobre el usuario para serializar concurrencia), el cambio de principal por `set_negocio_principal` (transaccional, garantiza exactamente 1 principal por usuario).

---

## Estructura del proyecto

```text
backend/              .NET 10 — 11 controllers, 7 repos, 5 servicios, 49 endpoints
backend.Tests/        xUnit + Moq — 48 tests
frontend/src/         Next.js — ~19k LOC
  app/                App Router (rutas, layouts, páginas)
  components/         UI components
  hooks/              Custom hooks por dominio
  lib/api/            Cliente HTTP (9 módulos)
  locales/            i18n (es/en/gal, ~550 claves tipadas)
supabase/migrations/  SQL versionado (7 migraciones)
.github/workflows/    CI: build + test + tsc --noEmit en push a main
```

---

## Tests

```bash
# Backend (xUnit)
cd backend.Tests && dotnet test

# Frontend (Vitest)
cd frontend && npm test
```

~105 tests en total. Backend cubre `ClaudeService`, `NegocioController` (multi-local completo: soft delete, restore, slot gating, ownership), `UsuarioController` y `NegocioScopeExtensions`. Frontend cubre módulos de API, cliente HTTP multi-local y componentes principales.

---

## CI

GitHub Actions en `.github/workflows/ci.yml`:
- `dotnet build` + `dotnet test`
- `npm ci` + `npm test`
- `tsc --noEmit`

Se ejecuta en push a `main` y en pull requests.

---

## Variables de entorno

El backend lee configuración desde variables de entorno (`.env` en desarrollo, Railway en producción). Ver `backend/appsettings.json` para el listado completo de claves requeridas.

El frontend requiere `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Contexto

Velacre es un proyecto propio desarrollado y desplegado en producción de forma independiente. Cubre el ciclo completo de un SaaS: producto, infraestructura, integraciones, pagos y despliegue. [velacre.com](https://velacre.com)
