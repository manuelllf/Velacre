# velacre-context-technical.md

Documento técnico exhaustivo del proyecto **Velacre (ReviewShield)**. Retrato del estado actual del código a día **12 abril 2026** — arquitectura, flujos, integraciones, seguridad, concurrencia y backlog técnico. Para contexto de negocio / pricing / outreach, ver `velacre-context.md`.

> **Última actualización:** 2026-04-12 (tras implementar Fase 2 + Fase 3). Ver §19 Changelog al final.
>
> **Alcance**: este doc no recomienda cambios, describe el estado actual. Las propuestas de implementación están marcadas **✅ implementado 2026-04-12** en §11 y los hallazgos de concurrencia accionables en §12 están marcados igual cuando se han resuelto.

---

## 0. Resumen ejecutivo

Velacre es un SaaS para hostelería (Galicia) que importa reseñas de Google, genera respuestas con IA (Claude), permite publicarlas en Google Business Profile, y ofrece un módulo "Radar" de análisis comparativo con competidores para el plan Pro. Stack:

- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind 4, TypeScript strict. PWA básica.
- **Backend**: .NET 9 (ASP.NET Core) con DI, Postgrest SDK sobre Supabase, sin EF Core.
- **Persistencia**: Supabase (Postgres + Auth). El backend usa **service key**.
- **Auth**: Supabase Auth (JWT ES256). Backend valida vía JWKS discovery.
- **IA**: Anthropic Claude (`claude-sonnet-4-6`) vía `Anthropic.SDK` v5.
- **Reseñas**: OAuth Google Business Profile (nativo) + Outscraper (fallback / competidores).
- **Pagos**: LemonSqueezy con webhook HMAC-SHA256 (Stripe.net presente pero **no usado**).
- **Email**: Resend.
- **Deploy**: Backend en Railway (PORT env var), frontend presumiblemente Vercel.

**Estado del código**:
- ~5.000 líneas backend, ~12.800 líneas frontend (incluidos locales i18n).
- 44 endpoints API, 11 controllers, 5 servicios, 9 entidades de BD.
- **0% cobertura de tests** (ni backend ni frontend).
- **Sin error boundary** global en frontend, **sin middleware global** de errores en backend.
- **Sin rate limiting** aplicativo, sin circuit breakers, sin monitoring (Sentry u otro).

**Debilidades críticas identificadas** (detalle en §10 y §13):
1. ~~Exposición de `ex.Message` al cliente en endpoints backend (500)~~ **✅ Resuelto 2026-04-12** — middleware global + `throw;` en los 7 sitios.
2. ~~Log de bodies completos de APIs Google en `GoogleBusinessService`~~ **✅ Resuelto 2026-04-12** — logs saneados, solo contadores en éxito.
3. Race condition en contadores manuales (`RespuestasManualesMes`). **Backlog** (99% imposible en uso real).
4. `dashboard/page.tsx` es un god component de **1307 líneas**. **Backlog**.
5. ~~Cascade failure posible: sin circuit breaker a Claude~~ **✅ Resuelto 2026-04-12** — Polly circuit breaker en HttpClient de Anthropic.
6. Ausencia de idempotencia en webhook LemonSqueezy. **Revisado 2026-04-12**: confirmado que no hay duplicación técnica; los "duplicados" eran 4 emails distintos (LS welcome + LS order + Velacre welcome + Velacre confirmation). Resuelto por eliminación de los 3 emails redundantes de Velacre.
7. `SendRetainedReviewAlertAsync()` definido pero **nunca invocado**. **Dejado a futuro por decisión**.

---

## 1. Stack tecnológico (resumen por capa)

| Capa | Tecnología | Versión | Notas |
|---|---|---|---|
| Frontend framework | Next.js | 16.2.1 | App Router, TS strict |
| Frontend runtime | React | 19.2.4 | |
| UI | Tailwind CSS | 4.x | Custom UI (sin shadcn, sin Radix) |
| Animaciones | framer-motion | 12.38 | Usado en landing |
| PDF | jspdf | 4.2.1 | Usado en panel salud |
| Backend | ASP.NET Core | .NET 9 | Controllers + DI |
| JWT | Microsoft.AspNetCore.Authentication.JwtBearer | 9.0 | JWKS discovery |
| BD SDK | supabase-csharp | 0.16.2 | Postgrest, sin EF Core |
| IA | Anthropic.SDK | 5.10.0 | Claude Sonnet 4.6 |
| JSON | Newtonsoft.Json | 13.0.4 | |
| Pagos | Stripe.net | 50.4.1 | **Cargado pero no usado** |
| Env loader | DotNetEnv | 3.1.1 | |
| Identity provider | Supabase Auth | — | Email+pwd y Google OAuth |
| Reseñas (API nativa) | Google Business Profile API | v1 + v4 | OAuth |
| Reseñas (fallback) | Outscraper | reviews-v3 | Síncrono |
| Búsqueda lugares | Google Places API | v1 | |
| Pagos (real) | LemonSqueezy | API + Webhooks | |
| Email | Resend | API | |
| Hosting backend | Railway | — | PORT env var |
| Hosting frontend | Vercel (asumido) | — | Previews con `CORS_EXTRA_ORIGIN` |

---

## 2. Arquitectura global

### 2.1 Diagrama conceptual

```
 ┌─────────────────────┐           ┌──────────────────────────┐
 │  Navegador / PWA    │           │  Email SMTP (Resend API) │
 │  Next.js 16         │           └────────────▲─────────────┘
 │  (CSR-first)        │                        │
 └──────┬──────────────┘                        │
        │                                       │
        │ fetch + JWT Bearer                    │
        │ (access_token de Supabase)            │
        ▼                                       │
 ┌──────────────────────┐                       │
 │  Backend .NET 9      │  HTTP                 │
 │  ASP.NET Core        ├──► Anthropic Claude   │
 │  (Railway)           ├──► Google Places v1   │
 │                      ├──► Google Business    │
 │                      ├──► Outscraper v3      │
 │                      ├──► LemonSqueezy API   │
 │                      └──► Resend ────────────┘
 │         ▲
 │         │  supabase-csharp (Postgrest)
 │         ▼
 │  ┌─────────────────┐
 │  │  Supabase       │
 │  │  (Postgres +    │
 │  │   Auth + RPC)   │
 │  └─────────────────┘
 │
 └──  Webhook ◄── LemonSqueezy (HMAC-SHA256)
 └──  Cron   ◄── Railway cron (header X-Cron-Secret)
```

### 2.2 Flujo de autenticación

1. **Frontend**: `supabase.auth.signUp()` / `signInWithPassword()` / `signInWithOAuth({ provider: 'google' })`.
2. Supabase devuelve sesión con `access_token` (JWT ES256).
3. Frontend lo guarda en su store local (gestionado por supabase-js).
4. Cada llamada al backend adjunta `Authorization: Bearer {access_token}` vía helper `authHeaders()` (`lib/api.ts:13-19`).
5. Backend valida el JWT en el middleware `UseAuthentication()` con las claves públicas obtenidas del JWKS de `SUPABASE_URL/auth/v1`.
6. El userId se extrae con `Guid.Parse(User.FindFirst("sub")!.Value)` (patrón repetido en todos los controllers — ver §13.4).

### 2.3 Protección de rutas (frontend)

**No hay `middleware.ts`** en `frontend/src/`. La protección es **puramente cliente**: cada página protegida hace `useEffect` + `supabase.auth.getSession()` y redirige si no hay sesión. Implicaciones:

- Flashing de contenido antes del redirect.
- SEO irrelevante porque es una app autenticada, pero las páginas `/dashboard`, `/settings`, etc. responden 200 con HTML vacío a cualquier request (el JS hace el gating).
- Sin riesgo de datos filtrados en el HTML inicial porque el fetch ocurre post-hidratación.

---

## 3. Backend .NET — detalle

### 3.1 Estructura de carpetas

```
backend/
├── Controllers/          11 controllers
├── Services/             5 servicios (Claude, GooglePlaces, Outscraper, GoogleBusiness, Email)
├── Interfaces/           4 interfaces (sin interfaz para EmailService)
├── Models/
│   ├── Entities/         9 entidades Postgrest
│   ├── Requests/         DTOs de entrada
│   ├── Responses/        DTOs de salida
│   └── Varios/           GbpLocation, etc.
├── Infrastructure/       **Vacío** (sin DbContext, sin DAL propio)
├── Program.cs            Punto de entrada y configuración DI
├── backend.csproj
├── appsettings.json      Logging solo
├── appsettings.Development.json
├── Dockerfile            Para Railway
└── backend.http          Scratchpad REST Client
```

**Observación**: `Infrastructure/` está vacío — el proyecto no tiene capa DAL propia; los controllers llaman directamente al `Supabase.Client` inyectado.

### 3.2 `Program.cs` — pipeline actualizado (2026-04-12)

```
Using + Env.Load()
AddControllers, AddOpenApi, AddHttpClient
AddMemoryCache()                               ← [2026-04-12] para rate limit de /api/report-error

JWT Bearer:
  - Authority: SUPABASE_URL/auth/v1
  - RequireHttpsMetadata = true
  - ValidateIssuerSigningKey = true
  - ValidateIssuer = false, ValidateAudience = false
  - ValidateLifetime = true, ClockSkew = 0
  - MapInboundClaims = false (preserva claim "sub")
AddAuthorization() (sin policies)

DI Scoped/HttpClient:
  - IReviewAiService → ClaudeService:         ← [2026-04-12] ctor ahora recibe HttpClient
      HttpClient "anthropic" con:
        Timeout = 90s                          ← [2026-04-12]
        AddResilienceHandler("claude-pipeline"): circuit breaker   ← [2026-04-12]
          (50% fallos en ventana 30s, min 8 reqs, break 30s)
          + timeout por intento 85s
  - IGooglePlacesService → HttpClient typed
  - IOutscraperService → HttpClient typed
  - IGoogleBusinessService → HttpClient typed
  - EmailService (Scoped, sin interfaz)

Supabase.Client como Singleton:
  - InitializeAsync().GetAwaiter().GetResult() ← bloqueo sync; resuelto por Railway 24/7

CORS "AllowFrontend":
  - WithOrigins(localhost:3000, localhost:3001, velacre.com, www.velacre.com)
  - + CORS_EXTRA_ORIGIN env var para previews Vercel
  - AllowAnyMethod, AllowAnyHeader, AllowCredentials

builder.Build()
app.MapOpenApi() solo en Development
app.UseCors("AllowFrontend")
app.UseMiddleware<GlobalExceptionMiddleware>() ← [2026-04-12] captura excepciones no controladas
app.UseAuthentication()
app.UseAuthorization()
Custom middleware: context.Request.EnableBuffering()
  (necesario para releer body en webhook LemonSqueezy para HMAC verify)
app.MapControllers()
app.Run($"http://0.0.0.0:{PORT ?? 5146}")
```

**Lo que SÍ hay ahora en el pipeline (✅ 2026-04-12):**
- `UseMiddleware<GlobalExceptionMiddleware>` — captura lo no controlado y devuelve `{error, mensaje, errorId}` consistente.
- `AddMemoryCache()` — usado para rate limit in-memory del endpoint de reporte de errores.
- HttpClient de Claude con `AddResilienceHandler` (circuit breaker).

**Lo que sigue NO habiendo en el pipeline:**
- Ninguna política `ProblemDetails` nativa (usamos shape custom).
- Ningún rate limiting aplicativo (`AddRateLimiter` ausente). **Backlog.**
- Ningún `UseHsts` / `UseHttpsRedirection` (confía en Railway).
- Ningún health check endpoint oficial (hay un `HealthController` pero no es `/health` de ASP.NET Core; es para análisis de reseñas).

### 3.3 Controllers — tabla completa (45 endpoints tras 2026-04-12)

> Todos con `[Authorize]` salvo los marcados. Todos los métodos devuelven `Task<IActionResult>`.

#### `HealthController` — 1 endpoint
| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| POST | `/api/health/analysis` | JWT | Análisis IA del panel "salud": 3 bloques (brillante / preocupa / acción) sobre las últimas 50 reseñas del negocio |

#### `AdminController` — 8 endpoints (todos con `IsAdminAsync()` extra check)
| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/admin/usuarios` | Lista todos los usuarios con plan, estado, negocio |
| POST | `/api/admin/usuarios/{id}/estado` | activo/baneado/prueba + DiasPrueba |
| POST | `/api/admin/usuarios/{id}/pro-override` | Activar/desactivar pro sin cambiar plan |
| PUT | `/api/admin/usuarios/{id}/notas` | Notas internas admin |
| POST | `/api/admin/usuarios/{id}/plan` | Cambiar plan (override) |
| PUT | `/api/admin/negocios/{negocioId}/place` | Setear place_id a mano |
| POST | `/api/admin/usuarios/{id}/activar` · `/desactivar` | Legacy, llaman a `/estado` |
| PUT | `/api/admin/usuarios/{id}/rol` | cliente/admin |
| POST | `/api/admin/mini-radar` | **B2B**: análisis ad-hoc de un place_id (prospección). **No persiste.** Llama Outscraper + Claude. Devuelve stats + peoresSinResponder + email pitch pre-redactado. |

**IsAdmin check**: prioriza `ADMIN_USER_ID` env var, con fallback a `rol="admin"` en BD. Anti-escalabilidad (hardcode a 1 admin en env).

#### `CronController` — 1 endpoint
| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| POST | `/api/cron/sync` | Header `X-Cron-Secret` | Sync semanal (martes) para todos los negocios con place_id. Itera, llama Outscraper con cutoff, inserta reviews nuevas. Devuelve `{synced, total, totalNew, errors}` |

**Observación de seguridad**: el header se compara con `==` (no timing-safe). Poco crítico porque solo expone el endpoint pero no datos.

#### `GoogleController` — 6 endpoints (OAuth GBP)
| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| GET | `/api/google/auth-url` | JWT | Genera URL OAuth con state HMAC firmado |
| GET | `/api/google/callback` | Anónimo | Callback de Google → intercambia code, guarda tokens, si 1 local auto-finalize, si N devuelve lista |
| GET | `/api/google/status` | JWT | `{connected, locationName, displayName, connectedAt}` |
| GET | `/api/google/locations` | JWT | Lista locales disponibles |
| POST | `/api/google/finalize` | JWT | Finaliza conexión con local elegido (borra reseñas, sync inicial) |
| DELETE | `/api/google/disconnect` | JWT | Revoca token en Google, borra conexión y reseñas |

#### `LemonController` — 3 endpoints
| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| GET | `/api/lemonsqueezy/checkout` | JWT | Crea sesión LS (core/pro × monthly/yearly) — JSON:API payload |
| POST | `/api/lemonsqueezy/cancelar` | JWT | DELETE a LS API + update BD |
| POST | `/api/lemonsqueezy/webhook` | Anónimo | HMAC-SHA256 verify en `X-Signature`. Eventos: created, resumed, updated, cancelled, expired, paused. Dispara emails. |

#### `NegocioController` — 3 endpoints
| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/negocio/me` | Lee negocio del usuario |
| POST | `/api/negocio` | Crea negocio (código `NEG` + 7 chars random) |
| PUT | `/api/negocio/me` | Update nombre/email/tel/desc/tono/keywords. **PlaceId bloqueado tras setup** salvo admin. |

#### `NotifyController` — 1 endpoint
| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/notify/waitlist` | Notifica a `infovelacre@gmail.com` de un usuario interesado en plan. Sin dedupe (duplicados posibles). |

#### `PlacesController` — 2 endpoints
| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/places/search?q=...` | Google Places Text Search v1 |
| POST | `/api/places/sync` | Sync de reseñas: si GBP conectado usa GBP API, si no Outscraper. Modo inicial (borra obsoletas) o incremental (desde última fecha). |

#### `RadarController` — 4 endpoints (Pro only)
| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/radar` | Competidores + último análisis + análisis este mes |
| POST | `/api/radar/competidores` | Add (max 3), 400 si duplicado / límite |
| DELETE | `/api/radar/competidores/{id}` | Borrar |
| POST | `/api/radar/analizar` | **Límite hard: 2/mes**. Outscraper por competidor + Claude análisis comparativo. Guarda, conserva últimos 2. |

#### `ReviewController` — 7 endpoints (el controller **crítico**)
| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/review/generate` | Genera 3 respuestas (prof/cercano/directo) SIN guardar. Check plan + estado + límite manual (5/mes no-Pro). Filtro de seguridad IA. Race condition en contador manual (§10.1). |
| POST | `/api/review/save-manual` | Guarda reseña manual con tono elegido |
| GET | `/api/review/pending` | Lista sin respuesta |
| POST | `/api/review/{id}/generate` | Genera **1** respuesta para reseña existente. **Usa RPC atómica `try_increment_ia_counter(p_user_id, p_limit)`**. Límites: Basic 10, Core 20, Pro ilimitado con soft cap warning a 250. Fallback keywords: carga **todas** las reseñas del negocio (N+1, §10.4). |
| GET | `/api/review/all` | Todas las reseñas del negocio |
| POST | `/api/review/{id}/translate` | Traduce reseña original a ES |
| POST | `/api/review/{id}/translate-response` | Traduce respuesta publicada a ES |
| GET | `/api/review/metrics` | `velacreCount`, `timeSaved` (×3.75 min), response rate histórico vs 3m |

#### `UsuarioController` — 4 endpoints
| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/usuario/me` | `{id, nombre, rol, plan, ls*, respuestasIaMes, isAdmin, planEfectivo}` |
| PUT | `/api/usuario/me` | Update nombre |
| DELETE | `/api/usuario/me` | **Eliminación de cuenta**. **[2026-04-12]** Ahora llama a RPC `delete_user_cascade(p_user_id)` (transaccional) + cancela LS + delete auth.users. Fallback manual conservado por si la RPC no está desplegada. |
| POST | `/api/usuario` | Crea perfil post-signup, plan="basic", email de bienvenida vía `FireAndForget.Run` (con log de errores) |

#### `ReportErrorController` — 1 endpoint **[nuevo 2026-04-12]**
| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| POST | `/api/report-error` | Anónimo + rate limit | Recibe `ReportErrorRequest` del frontend cuando el usuario pulsa "Reportar problema". Rate limit 10/hora por IP vía `IMemoryCache`. Sanitiza campos (trim + max length). Genera `reportId` con formato `RPT-yyyyMMdd-HHmmss-XXXX`. Llama a `EmailService.SendErrorReportAsync` que envía a `info@velacre.com` con HTML formateado con observaciones del usuario + contexto (URL, hora, mensaje, status, endpoint, última acción, email/plan, user-agent). **Sin stack trace.** |

### 3.4 Services — resumen funcional

#### `ClaudeService` (`IReviewAiService`)
- Modelo configurable (`AI_MODEL` env, default `claude-sonnet-4-6`).
- MaxTokens 600-2200 según endpoint; temp 0.5-0.7.
- **Retry exponencial x3** solo en `overloaded_error`.
- **[2026-04-12]** HttpClient inyectado desde `Program.cs` con **Timeout 90s** + **circuit breaker** (Microsoft.Extensions.Http.Resilience): ventana 30s, 50% fallos, min 8 reqs, break 30s. Evita cascade failure si Claude cae.
- Métodos clave:
  - `GenerateThreeResponsesAsync` / `GenerateThreeResponsesWithSafeFilterAsync`
  - `GenerateSingleResponseAsync` / `GenerateSingleResponseWithContextAsync`
  - `GenerateRadarAnalysisAsync`
  - `GetClaudeMessageAsync` (helper genérico)
- **Filtro de seguridad** (retiene con `motivoRetencion`): intoxicación, maltrato, amenaza legal, datos personales sensibles, acusación de fraude/estafa, discriminación.
- **Bug funcional**: cuando una reseña se retiene, el controller **no envía alerta al usuario** aunque `EmailService.SendRetainedReviewAlertAsync()` exista.
- Parsing frágil: busca primer `{` y último `}` sin validar JSON.

#### `GooglePlacesService`
- Endpoint: `https://places.googleapis.com/v1/places:searchText`.
- Headers: `X-Goog-Api-Key`, `X-Goog-FieldMask`.
- Fields: `places.id, displayName, formattedAddress, rating`.
- **Sin cache**, sin rate limit, sin retry, sin timeout.

#### `OutscraperService`
- Endpoint: `https://api.app.outscraper.com/maps/reviews-v3`.
- **Inicial**: 60 reseñas. **Incremental**: 500.
- Cutoff como unix timestamp.
- Mapea `review_id, author_title, review_rating, review_text, review_datetime_utc, owner_answer, review_lang`.
- **Error de red → devuelve lista vacía silenciosamente** (riesgo: interpretar "vacío" como "no hay reviews nuevas" y borrar data en modo inicial).

#### `EmailService` (sin interfaz)
- Endpoint: `https://api.resend.com/emails`.
- Templates HTML hardcodeados en C# con estilo Tailwind inline.
- Métodos:
  - `SendWaitlistNotificationAsync`
  - `SendRetainedReviewAlertAsync` ← **DEFINIDO PERO NUNCA LLAMADO** (dejado a futuro)
  - `SendWelcomeAsync` ← **único email transaccional que Velacre sigue enviando** tras 2026-04-12
  - `SendSubscriptionConfirmedAsync` ← **[2026-04-12]** ya no se invoca desde el webhook (LS envía el suyo con factura); método conservado por si se reutiliza
  - `SendSubscriptionCancelledAsync` ← **[2026-04-12]** idem
  - `SendSubscriptionExpiredAsync` ← **[2026-04-12]** idem
  - `SendErrorReportAsync(ReportErrorRequest, reportId)` ← **[nuevo 2026-04-12]** template con asunto `[Velacre] Error reportado {reportId}`, destino `info@velacre.com`, incluye observaciones del usuario destacadas + tabla de contexto
  - `SendEmailAsync` (helper)
- **[2026-04-12]** Patrón fire-and-forget sustituido por `FireAndForget.Run(task, logger, tag)` (nuevo helper en `backend/Infrastructure/FireAndForget.cs`), que hace `ContinueWith` con logging de excepciones en vez de descartarlas.

#### `GoogleBusinessService` (el servicio más complejo, 749 líneas)
- **OAuth flow**:
  1. `GenerateAuthUrl(negocioId, userId, returnTo)` → state firmado HMAC-SHA256 con payload `base64(JSON{negocioId, userId, returnTo, ts})` + signature con `_clientSecret`. TTL 10 min. Timing-safe compare.
  2. `HandleCallbackAsync(code, state)` → valida state, intercambia code por tokens, guarda `GoogleConnectionEntity` con `isActive=false`, lista locales, si 1 auto-finalize.
  3. `FinalizeConnectionAsync(locationName)` → marca `isActive=true`, **borra todas las reseñas anteriores (sin backup)**, lanza sync inicial.
- **Token refresh**: `EnsureValidTokenAsync()` compara expiry con ahora (sin grace period), llama `https://oauth2.googleapis.com/token`, actualiza BD. **No detecta `token_revoked`** — usuario queda con conexión muerta silenciosamente.
- **Fetch locales**: primero Business Information API v1 (`mybusinessbusinessinformation.googleapis.com/v1/{account}/locations`), fallback a My Business v4 legacy (`mybusiness.googleapis.com/v4/{account}/locations`).
- **Sync reseñas**: GET `/v4/{location}/reviews`, paginado. Modo inicial borra reseñas ausentes.
- **Publish reply**: POST `/v4/{location}/reviews/{id}/reply` con `{comment}`. Update BD (`RespuestaPublicada`, `PublicadaEnGoogle`, `PublicadaFecha`, `Estado="respondida"`).
- ~~⚠️ **SEGURIDAD**: loguea body completo de respuestas API~~ **✅ Resuelto 2026-04-12** — logs saneados, solo contadores en éxito (nº cuentas, nº locales añadidos). Los paths de error mantienen el body porque Google devuelve códigos tipo `{"error":{"code":...}}` sin datos sensibles.
- ~~**Perf**: `DeleteAllReviewsForNegocioAsync()` hace loop `foreach` con DELETE individual (O(N) queries)~~ **✅ Resuelto 2026-04-12** — bulk delete en 1 query sql-side.

### 3.5 `appsettings.json`

Prácticamente vacío — solo `Logging:LogLevel:Default=Information`, `Microsoft.AspNetCore=Warning`, `AllowedHosts=*`. Toda la configuración real vive en env vars.

### 3.6 Variables de entorno esperadas

```
SUPABASE_URL, SUPABASE_SERVICE_KEY
ANTHROPIC_API_KEY, AI_MODEL (default claude-sonnet-4-6)
GOOGLE_PLACES_API_KEY
GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI
OUTSCRAPER_API_KEY
LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID
LEMONSQUEEZY_VARIANT_CORE_MONTHLY/YEARLY, LEMONSQUEEZY_VARIANT_PRO_MONTHLY/YEARLY
LEMONSQUEEZY_WEBHOOK_SECRET
RESEND_API_KEY, RESEND_FROM
CRON_SECRET
ADMIN_USER_ID
FRONTEND_URL
CORS_EXTRA_ORIGIN (opcional, para previews Vercel)
PORT (inyectado por Railway)
```

Muchos se leen con `!` (null-forgiving) sin validación previa en startup → el proceso puede arrancar y fallar en el primer request si falta alguna.

---

## 4. Frontend Next.js — detalle

### 4.1 Estructura de `src/`

```
src/
├── app/                    App Router
│   ├── layout.tsx          Root layout (Geist fonts, Providers, metadata PWA)
│   ├── manifest.ts         Server Component → /manifest.webmanifest
│   ├── page.tsx            Landing CSR
│   ├── es/ · en/ · gal/    Variantes i18n landing
│   ├── auth/
│   │   ├── login/          Email+pwd + Google OAuth
│   │   ├── register/       Email+pwd + Google OAuth
│   │   ├── callback/       Intercambia PKCE code
│   │   └── reset-password/ Reset flow
│   ├── onboarding/
│   │   ├── page.tsx        Google Business o búsqueda manual
│   │   └── plan/           Skip / Core / Pro
│   ├── inicio/             Hub autenticado (dashboard, salud, settings)
│   ├── dashboard/
│   │   ├── page.tsx        **GOD COMPONENT 1307 LÍNEAS**
│   │   └── salud/          Métricas + Radar (Pro)
│   ├── settings/
│   ├── admin/
│   │   ├── page.tsx
│   │   └── mini-radar/     Prospección B2B
│   ├── health/             Página pública health check
│   ├── privacidad/, terminos/, contacto/
│   └── globals.css
├── components/             1504 líneas en total
│   ├── Providers.tsx       LanguageProvider + PWAInstall
│   ├── LandingPage.tsx     1000+ líneas (hero, features, pricing)
│   ├── ResponseCard.tsx
│   ├── PWAInstall.tsx      Banner Android + instrucciones iOS
│   ├── PublishGoogleModal.tsx
│   ├── WaitlistModal.tsx
│   ├── HelpModal.tsx
│   ├── SectionNav.tsx · Tooltip.tsx · LangSwitcher.tsx
├── lib/
│   ├── api.ts              732 líneas — cliente HTTP + tipos + ApiError
│   ├── i18n.tsx            LanguageContext + hook useLanguage
│   └── supabase.ts (asumido) Cliente supabase-js
└── locales/
    ├── types.ts            LandingLocale interface
    ├── es.ts · en.ts · gal.ts
```

**Total**: 12.824 líneas TS/TSX (incluidos locales). Componentes: 1.504 líneas.

### 4.2 `app/layout.tsx` + `Providers`

`layout.tsx` (44 líneas):
- Fonts `Geist` + `Geist_Mono` via `next/font/google`.
- `metadata`: title Velacre, description, `manifest: "/manifest.webmanifest"`, `appleWebApp` config, `themeColor: "#0f172a"`.
- HTML `lang="es"` **hardcodeado** (el cambio de idioma del `LangSwitcher` no actualiza este atributo).
- Class `dark` fija → la app solo tiene tema dark.
- Children envueltos en `<Providers>`.

`Providers.tsx` (14 líneas, `'use client'`):
- Envuelve todo en `LanguageProvider`.
- Renderiza `<PWAInstall />` como overlay global.
- **No hay otros providers**: ni Error Boundary, ni React Query, ni Sentry, ni toast system global.

### 4.3 Rutas completas

| Ruta | Protección | Descripción |
|---|---|---|
| `/` | Pública | Landing (i18n) |
| `/es` `/en` `/gal` | Pública | Variantes landing |
| `/auth/login` | Pública | Email+pwd + Google + reset |
| `/auth/register` | Pública | Email+pwd + Google |
| `/auth/callback` | Pública (PKCE) | Exchange code, crea perfil si nuevo |
| `/auth/reset-password` | Pública (con token) | Cambio pwd |
| `/onboarding` | JWT (client-side) | Conectar GBP o buscar manualmente |
| `/onboarding/plan` | JWT | Core / Pro / Skip |
| `/inicio` | JWT | Hub con tarjetas |
| `/dashboard` | JWT | Lista reseñas, genera respuestas |
| `/dashboard/salud` | JWT (Pro para Radar) | Métricas + análisis + Radar |
| `/settings` | JWT | Perfil, negocio, plan, GBP |
| `/admin` | JWT + admin | Gestión usuarios |
| `/admin/mini-radar` | JWT + admin | Prospección B2B |
| `/health` | Pública | Health check |
| `/privacidad` `/terminos` `/contacto` | Pública | Legales |

### 4.4 Cliente HTTP (`lib/api.ts`)

- **Fetch nativo**, sin axios / SWR / React Query.
- `API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5146'`.
- `authHeaders()` obtiene sesión fresca de Supabase en **cada** request (performance: no hay cache de sesión ahí).
- Clase `ApiError`:
  ```ts
  class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
      public readonly data?: Record<string, unknown>
    )
  }
  ```
- Manejo de 401: la función `fetchJson` no tiene lógica especial — son las **páginas** quienes interpretan `err.status === 401` y llaman `router.replace('/auth/login')`. Sin refresh token automático.
- Logging: `console.log('[api] fnName →')` / `console.error('[api] fnName ERROR', status, body)` en varias funciones.

### 4.5 Flujos críticos end-to-end

Ver §8 para los diagramas secuenciales completos (generación de respuesta, sync, onboarding, checkout, publicación GBP).

### 4.6 Estado global y gestión de datos

- **Sin estado global** de usuario/negocio. Cada página refetch al montar.
- Único context: `LanguageProvider` (i18n) en `lib/i18n.tsx`.
- `dashboard/page.tsx` mantiene ~15 `useState` locales (reviews, filters, sync progress, modals, upsell, etc.) → fuente principal de la complejidad del componente.

### 4.7 i18n custom (sin next-intl)

- `LanguageContext` con `<LanguageProvider>` + `useLanguage()`.
- 3 idiomas: `es`, `en`, `gal`.
- `lib/i18n.tsx:43` guarda la elección en `localStorage` (`STORAGE_KEY`).
- `locales/types.ts` define un shape tipado `LandingLocale` con secciones `nav`, `hero`, `app.common`, `app.dashboard`, `app.auth`, etc.
- Consumo: `const { t } = useLanguage(); const d = t.app.dashboard`.
- **No actualiza `<html lang>`** al cambiar idioma.

### 4.8 PWA

- `app/manifest.ts` (Server Component) emite `/manifest.webmanifest`:
  ```ts
  {
    name: 'Velacre', short_name: 'Velacre',
    start_url: '/inicio',
    display: 'standalone',
    background_color: '#0f172a', theme_color: '#0f172a',
    icons: [ /icon-192.png, /icon-512.png (maskable) ]
  }
  ```
- `public/sw.js` (4 líneas reales): install → `skipWaiting`, activate → `clients.claim`, fetch → **pass-through a red** (estrategia network-first sin cache). **No hay offline.**
- `components/PWAInstall.tsx`:
  - Registra SW (`navigator.serviceWorker.register('/sw.js')`).
  - Escucha `beforeinstallprompt` (Android).
  - Detecta iOS no-standalone para mostrar instrucciones manuales.
  - Banner solo en rutas `/` e `/inicio`.
  - Auto-hide a 10s + flag `dismissed` en localStorage para no volver a mostrar.

### 4.9 TypeScript & lint

- `tsconfig.json`: `strict: true`, target ES2017, alias `@/* → ./src/*`.
- `grep :any` → 0 resultados. `grep @ts-ignore` → 0. Proyecto bien tipado.
- 1 solo `eslint-disable-next-line react-hooks/exhaustive-deps` en `dashboard/page.tsx:120` (dependency router).
- ESLint config en `eslint.config.mjs`.

---

## 5. Integraciones externas (consolidado)

| Integración | Dirección | Auth | Timeout | Retry | Circuit breaker | Cache |
|---|---|---|---|---|---|---|
| Supabase (Postgrest) | Backend → Supabase | Service Key | default | No | No | No |
| Supabase Auth (JWT validation) | Backend (JWKS discovery) | — | default | Lib | No | Lib |
| Anthropic Claude | Backend → api.anthropic.com | API key | **90s [2026-04-12]** | **Sí (3x, exp backoff, solo overloaded)** | **Sí [2026-04-12]** (Polly, 50% fallos ventana 30s, break 30s) | No |
| Google Places v1 | Backend → places.googleapis.com | API key | default | No | No | No |
| Google Business Profile (OAuth) | Backend → google APIs | OAuth2 + refresh | default | No | No | No |
| Outscraper | Backend → api.app.outscraper.com | API key | default | No (devuelve lista vacía en error) | No | No |
| LemonSqueezy API | Backend → api.lemonsqueezy.com | API key | default | No | No | No |
| LemonSqueezy webhook | LS → Backend | HMAC-SHA256 | — | LS retry | Sin idempotencia | — |
| Resend | Backend → api.resend.com | API key | default | No | No | — |
| Railway cron | Railway → Backend | Header secret | — | — | — | — |

**HttpClient**: los servicios registrados con `AddHttpClient<T>()` reutilizan `HttpClientFactory` → pooling gestionado por .NET. No hay `SetHandlerLifetime` personalizado (default 2 min).

---

## 6. Base de datos

### 6.1 Acceso

- SDK: `supabase-csharp` v0.16.2 (Postgrest + Functions + Auth Admin).
- **Sin EF Core**, sin Dapper, sin raw SQL.
- Cliente **Singleton** inicializado síncronamente en `Program.cs:47-55` — bloquea el thread de startup durante `InitializeAsync()`.
- Auth admin (delete `auth.users`) via service key.

### 6.2 Entidades conocidas (Models/Entities/)

| Tabla | Propósito | Campos clave |
|---|---|---|
| `usuario` | Usuarios Velacre | id (Guid), email, nombre, rol ("cliente"\|"admin"\|"sales"), plan ("basic"\|"core"\|"pro"), estado ("activo"\|"baneado"\|"prueba"), pruebaHasta, activoDesde, proOverride, proOverrideHasta, respuestasManualesMes, respuestasMesReset, respuestasIaMes, lsSubscriptionId, lsStatus, lsRenewsAt, lsEndsAt |
| `negocio` | Establecimiento | id, idUsuario (FK), codigo (NEG+7), nombre, email, telefono, descripcion, tonoPredefinido, placeId, palabrasClave (string[]) |
| `review` | Reseñas Google/manuales | id, idNegocio, googleReviewId (nullable), autor, rating, texto, fecha, plataforma, estado ("pendiente"\|"respondida"\|"ignorada"), tonoGenerado (null\|"Profesional"\|"Cercano"\|"Directo"\|"google"), respuestaProfesional/Cercano/Directo, publicadaEnGoogle, publicadaFecha, respuestaPublicada, retenida, motivoRetencion |
| `google_connection` | Tokens OAuth GBP | negocioId (PK), googleAccountId, locationName, displayName, accessToken, refreshToken, tokenExpiry, isActive, connectedAt |
| `competidor` | Para Radar | id, idNegocio, placeId, nombre |
| `radar_analisis` | Resultados Radar | id, idNegocio, createdAt, resultado (jsonb) |
| `costo_mes`, `liquidacion`, `analisis_ia` | Aparentemente sin uso activo | — |

### 6.3 RPC Postgres

- `try_increment_ia_counter(p_user_id uuid, p_limit int) → boolean`
  - **Único mecanismo atómico** del proyecto para evitar race conditions en contadores de respuestas IA.
  - Usado en `ReviewController.GenerateForReview()`.
  - Si devuelve `false`, el endpoint responde 429.
  - **No hay RPC equivalente para el contador manual** (`RespuestasManualesMes`) — descartado por decisión (99% imposible en uso real).

- **[nuevo 2026-04-12]** `get_top_keywords(p_negocio_id uuid, p_limit int) → TABLE(word text, count bigint)`
  - Language SQL, STABLE.
  - Usa `CROSS JOIN LATERAL unnest(r.keywords_usadas) AS kw` + GROUP BY + ORDER BY count DESC LIMIT.
  - Usado por `ReviewController.GenerateForReview()` en el fallback de keywords, sustituyendo al N+1 anterior (antes se cargaban todas las reseñas del negocio en memoria del backend).
  - `GRANT EXECUTE` a `authenticated, service_role`.

- **[nuevo 2026-04-12]** `delete_user_cascade(p_user_id uuid) → void`
  - Language plpgsql, `SECURITY DEFINER`, `SET search_path = public`.
  - Borra dentro de una única transacción: `review` → `radar_analisis` → `competidor` → `google_connection` → `analisis_ia` → `negocio` → anonimiza `usuario`. Si algo falla, Postgres hace rollback automático.
  - Usado por `UsuarioController.DeleteMe()`. Tiene fallback en el .NET al flujo manual por si la RPC no está desplegada.
  - `GRANT EXECUTE` a `authenticated, service_role`.

### 6.4 Transacciones

**Ninguna** a nivel aplicativo. Operaciones multi-paso (DeleteMe, FinalizeConnection, SetPlan) son secuencias independientes sin rollback.

### 6.5 Migraciones

Sin herramienta de migraciones en el repo. Asumido: cambios de schema a mano vía Supabase dashboard.

---

## 7. Seguridad (transversal)

### 7.1 Lo que está bien

- JWT validación correcta: JWKS discovery, `RequireHttpsMetadata=true`, `ClockSkew=0`, `MapInboundClaims=false` preserva `sub`.
- OAuth GBP con state firmado HMAC-SHA256 y comparación timing-safe, TTL 10 min.
- Webhook LemonSqueezy valida HMAC-SHA256 sobre body con `EnableBuffering` para releerlo.
- `CronController` protegido por header secreto.
- Secrets cargados vía env (DotNetEnv en dev, Railway en prod). No hay secretos committeados.
- Postgrest evita SQL injection por construcción.
- CSRF no aplica: JWT en header, no en cookie.
- TypeScript strict, sin `any`, sin `@ts-ignore`.

### 7.2 Lo que está mal / flojo

| Tema | Dónde | Riesgo |
|---|---|---|
| ~~Logs filtran bodies API Google~~ **✅ Resuelto 2026-04-12** | `GoogleBusinessService` — ahora solo contadores en success paths | — |
| ~~`500` expone `ex.Message` al cliente~~ **✅ Resuelto 2026-04-12** | Middleware global + `throw;` en los 7 sitios | — |
| CORS `AllowAnyMethod` + `AllowAnyHeader` + `AllowCredentials` | `Program.cs:76-78` | Permisivo. Origen sí está restringido, pero cualquier método/header pasa |
| Sin rate limiting | Todo el backend | DoS trivial; enumeración admin |
| Sin validación centralizada | Validación manual dispersa en cada endpoint | Fácil olvidar validaciones |
| Admin por env var única | `ADMIN_USER_ID` | No escala a varios admins sin code change |
| Cron secret con `==` | `CronController` | Timing attack teórico (bajo riesgo) |
| Protección de rutas frontend solo client-side | Sin `middleware.ts` | Flashing, no defense-in-depth |
| `User.FindFirst("sub")!.Value` | Todos los controllers | NPE si el claim falta (500 feo) |
| CORS con credentials + allowAnyOrigin si `CORS_EXTRA_ORIGIN` mal configurado | `Program.cs:72-74` | Si alguien mete `*` en esa env var, se abre todo |
| Sin Sentry / monitoring | Frontend y backend | Errores prod invisibles |
| Sin HSTS / HTTPS redirect explícito | `Program.cs` | Confía en Railway TLS termination |

---

## 8. Flujos críticos end-to-end

### 8.1 Registro y onboarding (happy path)

```
Usuario → /auth/register
  ├─ Introduce nombre+email+pwd
  ├─ Frontend: supabase.auth.signUp({email,pwd})
  │    Supabase envía email de confirmación (depende de config)
  ├─ Frontend: POST /api/usuario  {nombre}
  │    Backend: crea perfil con plan="basic", envía welcome email (fire-and-forget)
  │    Devuelve 204
  └─ Frontend: router.replace('/onboarding')

/onboarding (ruta A: Google Business)
  ├─ Usuario mete nombre de negocio
  ├─ POST /api/negocio {nombre, tono, descripción, keywords}
  ├─ GET /api/google/auth-url?negocioId=X → {url}
  ├─ window.location = url (Google OAuth)
  ├─ Google → /api/google/callback?code=...&state=...
  │    Backend: valida state, intercambia code, guarda GoogleConnectionEntity
  │    Si 1 local → finalize auto (borra reseñas viejas, sync inicial)
  │    Redirige a /onboarding?gbp=connected o ?gbp=select
  ├─ Si "select": GET /api/google/locations → user elige
  │    POST /api/google/finalize {locationName}
  └─ → /onboarding/plan → Core/Pro/Skip

/onboarding (ruta B: manual)
  ├─ GET /api/places/search?q=...
  ├─ User elige place_id
  ├─ POST /api/negocio
  ├─ PUT /api/negocio/me {placeId}
  ├─ POST /api/places/sync → Outscraper pulls reseñas
  └─ → /onboarding/plan
```

### 8.2 Generar respuesta IA para una reseña existente (endpoint crítico)

```
[Dashboard] Usuario hace click "Generar" en una reseña
  │
  ▼
POST /api/review/{id}/generate
  │
  ├─ Auth (JWT)
  ├─ Lee usuario, negocio, reseña
  ├─ Check estado: baneado → 403; prueba expirada → 403
  ├─ Determina iaLimit según plan: basic=10, core=20, pro=-1 (ilimitado)
  │
  ├─ Si plan ≠ pro:
  │   └─ RPC try_increment_ia_counter(userId, iaLimit) ── ATÓMICO
  │       Si false → 429 {error:"limit_reached", plan, limit, used}
  │
  ├─ Si plan = pro:
  │   └─ RPC try_increment_ia_counter(userId, INT_MAX)
  │       Si > 250 → softCapWarning=true (no bloquea)
  │
  ├─ Carga fallback keywords:
  │   └─ SELECT * FROM review WHERE idNegocio=... ← **N+1**, carga TODO en memoria
  │       Agrupa, top 6
  │
  ├─ ClaudeService.GenerateSingleResponseWithContextAsync(
  │     reviewText, tono, idioma, keywords, contextoNegocio)
  │   ├─ POST api.anthropic.com/v1/messages (retry 3x en overloaded)
  │   └─ Devuelve {retenida, motivoRetencion, respuesta, contextoCliente, contextoRespuesta, keywordsUsadas}
  │
  ├─ Si retenida:
  │   ├─ RPC para **revertir** contador
  │   ├─ ❌ **BUG**: no llama EmailService.SendRetainedReviewAlertAsync()
  │   └─ Return 200 {retenida:true, motivoRetencion}
  │
  ├─ UPDATE review SET RespuestaXxx=..., TonoGenerado=..., Retenida=false
  │
  └─ Return 200 {response, tono, contextoCliente, contextoRespuesta, keywordsUsadas, softCapWarning}
```

### 8.3 Sync de reseñas

```
[Dashboard] Click "Sincronizar"
  │
  ▼
POST /api/places/sync
  │
  ├─ Si GBP conectado (google_connection.isActive=true):
  │   └─ GoogleBusinessService.SyncReviewsAsync()
  │       ├─ EnsureValidTokenAsync (refresh si expira)
  │       ├─ GET v4/{location}/reviews paginado
  │       ├─ Match por GoogleReviewId
  │       ├─ Inserta nuevas, actualiza ownerReply si llegó tarde
  │       └─ Devuelve {source:"gbp", newReviews, updatedReviews}
  │
  └─ Si no:
      └─ OutscraperService.GetReviewsAsync(placeId, sinceDate)
          ├─ Modo inicial (sin sinceDate): 60 reseñas, borra las ausentes
          ├─ Modo incremental: 500 reseñas con cutoff
          └─ Devuelve {newReviews, updatedReviews}

[Frontend] Progress bar simulada (5-92% en 14s)
  al recibir respuesta → 100% → loadReviews() → refresh UI
```

### 8.4 Checkout LemonSqueezy + webhook

```
[Frontend] Usuario elige plan en /onboarding/plan o /settings
  │
  ▼
GET /api/lemonsqueezy/checkout?plan=pro&billing=monthly
  │
  ├─ Construye JSON:API payload con variant_id + custom_data.user_id
  ├─ POST api.lemonsqueezy.com/v1/checkouts
  └─ Return {url}

[Frontend] window.location.href = url
  │
  ▼
[LS] Checkout nativo → pago con tarjeta
  │
  ├─ Redirige al frontend (thanks URL)
  │
  └─ En paralelo: POST /api/lemonsqueezy/webhook
      ├─ Header X-Signature verificado con HMAC-SHA256 sobre body
      ├─ Event type: subscription_created|resumed|updated|cancelled|...
      ├─ Extrae custom_data.user_id
      ├─ SetPlan(userId, plan, lsSubscriptionId, lsStatus, lsRenewsAt)
      │   ── varias UPDATEs individuales, sin transacción
      └─ Envía email Resend (fire-and-forget)
      
⚠️ Sin idempotencia: si LS reenvía, SetPlan se ejecuta otra vez (inocuo
en este caso porque el update es idempotente, pero frágil si se añaden efectos).
```

### 8.5 Publicar respuesta en Google

```
[Dashboard] Usuario click "Publicar en Google" en reseña con respuesta generada
  │
  ├─ Abre PublishGoogleModal con respuesta editable
  │
  ▼
POST /api/review/{id}/publish-google {respuesta}
  │
  ├─ Verifica GoogleConnectionEntity.isActive
  ├─ EnsureValidTokenAsync()
  ├─ Si token_refresh_failed → 401 {error:"token_refresh_failed"}
  │   [Frontend] PublishGoogleModal.tsx:31-32 → redirige a Settings para reconectar
  │
  ├─ POST mybusiness.googleapis.com/v4/{location}/reviews/{googleReviewId}/reply
  │   Body: {comment: respuesta}
  │
  ├─ UPDATE review SET RespuestaPublicada, PublicadaEnGoogle=true, PublicadaFecha, Estado="respondida"
  └─ Return 200
```

### 8.6 Eliminación de cuenta (flujo frágil — §10.7)

```
DELETE /api/usuario/me
  ├─ Si LsSubscriptionId presente:
  │   └─ DELETE LS /v1/subscriptions/{id}  (si falla → continúa)
  ├─ DELETE review WHERE idNegocio IN (...)  (N queries, sin transacción)
  ├─ DELETE negocio WHERE idUsuario=...      (si falla aquí, reviews ya borradas)
  ├─ UPDATE usuario SET nombre='[eliminado]', email='', telefono=''
  ├─ DELETE auth.users via Supabase Admin API (service key)
  └─ Return 200 (aunque algo haya fallado)
```

---

## 9. Concurrencia y alto tráfico — **hallazgos**

> Esta sección lista los problemas reales encontrados. **La decisión de cuáles fijar se toma en Fase 3** (ver §12).

### 9.1 Matriz de severidad (estado 2026-04-12)

| # | Problema | Ubicación | Severidad | Estado |
|---|---|---|---|---|
| 9.1 | Race condition contador manual | `ReviewController.GenerateResponses` | Media | **Backlog** (99% imposible en uso real) |
| 9.2 | Supabase.Client singleton sync init | `Program.cs:47-55` | Media | **Resuelto por infra** — Railway 24/7 sin cold start |
| 9.3 | Sin circuit breaker a APIs externas | Todos los services | **Alta** | **✅ Resuelto 2026-04-12** (solo Claude, con Polly) |
| 9.4 | N+1 queries en fallback keywords | `ReviewController.GenerateForReview` | Media | **✅ Resuelto 2026-04-12** (RPC `get_top_keywords`) |
| 9.5 | Delete loop O(N) sin batch | `GoogleBusinessService.DeleteAllReviewsForNegocioAsync` | Baja | **✅ Resuelto 2026-04-12** (bulk delete) |
| 9.6 | Sin rate limiting | Todo el backend | **Alta** | **Backlog** (no crítico hoy sin atacantes activos) |
| 9.7 | DeleteMe sin transacción | `UsuarioController.DeleteMe` | Alta | **✅ Resuelto 2026-04-12** (RPC `delete_user_cascade`) |
| 9.8 | Webhook LS sin idempotencia explícita | `LemonController.Webhook` | Baja | **Revisado** — no era duplicación; resuelto por eliminación de emails redundantes |
| 9.9 | Fire-and-forget emails sin await | Varios | Baja | **✅ Resuelto 2026-04-12** (`FireAndForget.Run` con logging) |
| 9.10 | `User.FindFirst("sub")!` NPE | Todos los controllers | Baja | **Backlog** (muy baja probabilidad) |
| 9.11 | Outscraper error → lista vacía silenciosa + modo inicial borra | `OutscraperService` + `PlacesController.Sync` | **Alta** | **✅ Resuelto 2026-04-12** (sync nunca borra preexistentes) |
| 9.12 | Claude sin timeout explícito | `ClaudeService` | Media | **✅ Resuelto 2026-04-12** (`HttpClient.Timeout = 90s`) |
| 9.13 | Logs exponen tokens/bodies | `GoogleBusinessService` | **Alta** (seguridad) | **✅ Resuelto 2026-04-12** |
| 9.14 | Frontend: doble submit protegido, pero algunos flujos dependen de disabled manual | Dashboard y otros | Baja | **Backlog** |
| 9.15 | Frontend: filtros rápidos pueden dejar respuestas viejas si se añade fetch async | Dashboard | Baja | **Backlog** |
| 9.16 | SW pass-through sin offline — falla de red = fallo total | `public/sw.js` | Media | **Backlog** |
| 9.17 | `500 ex.Message` expuesto | Todos los controllers | Media (seguridad + UX) | **✅ Resuelto 2026-04-12** (middleware global + `throw;`) |

### 9.2 Detalle de los hallazgos críticos

**9.1 – Race condition contador manual**
```csharp
// ReviewController.GenerateResponses (línea aprox. 37-95)
if (usuario.RespuestasManualesMes >= manualLimit)
    return StatusCode(429, ...);
// ...genera con Claude...
usuario.RespuestasManualesMes++;
await _supabase.From<UsuarioEntity>().Update(usuario);
```
Dos requests simultáneos del mismo usuario pueden ambos pasar el check y ambos incrementar. El patrón correcto ya existe en el proyecto: la RPC `try_increment_ia_counter`. Falta aplicarla aquí o crear `try_increment_manual_counter`.

**9.3 – Sin circuit breaker**
Si Claude empieza a dar 500 de forma sostenida, cada request frontend espera el timeout (unbounded por defecto en `HttpClient`) y suma carga hasta que el thread pool se agota. `ClaudeService` solo hace retry en `overloaded_error` — otros errores (5xx, timeout) se propagan como excepción al controller, que devuelve 500 `ex.Message`.

**9.4 – N+1 keywords fallback**
`GenerateForReview` carga con Postgrest **todas** las reseñas del negocio para calcular las 6 keywords más usadas. Para un negocio con 2.000 reseñas son 2.000 filas en cada generación. Coste: red Railway ↔ Supabase + memoria server-side + GC pressure.

**9.11 – Outscraper silenciosamente vacío**
```csharp
// OutscraperService.GetReviewsAsync (simplificado)
try {
  var resp = await _http.GetAsync(url);
  if (!resp.IsSuccessStatusCode) return new List<OutscraperReview>();
  // ...parse...
} catch {
  return new List<OutscraperReview>();
}
```
Luego `PlacesController.Sync` en **modo inicial** interpreta "0 reviews devueltas" como "no hay reviews en Google" y **borra las existentes**. Un fallo transitorio de Outscraper en un disconnect/finalize puede vaciar reseñas históricas.

**9.13 – Log leakage**
```csharp
_logger.LogInformation("[GBP] Accounts response: {Body}", accountsBody);
_logger.LogInformation("[GBP] Locations v1 response: {Body}", body);
_logger.LogInformation("[GBP] Locations v4 response: {Body}", body);
```
Estos bodies contienen nombres de cuentas Google, IDs de locales, a veces tokens según endpoint. Railway tiene logs persistentes → potencial filtración.

**9.17 – `500 ex.Message` expuesto**
Patrón repetido en prácticamente todos los catch:
```csharp
catch (Exception ex) {
  _logger.LogError(ex, "[X] ...");
  return StatusCode(500, ex.Message);
}
```
Esto:
1. Viola el principio de no exponer internals.
2. Rompe el modelo frontend (algunas páginas esperan `{error, mensaje}` y reciben texto plano).
3. Hace el error handling del usuario inconsistente.

---

## 10. Estado del error handling — estado ANTERIOR al 2026-04-12

> **Esta sección retrata el estado previo a Fase 2** (así quedó el proyecto antes de la sesión de hardening). Para el estado actual post-implementación, ver **§11 Propuesta de implementación — realizada**.

### 10.1 Backend

- **Sin middleware global de excepciones**. No hay `UseExceptionHandler`, no hay `IExceptionHandler`, no hay Serilog con enrichers, no hay ProblemDetails config.
- Cada controller hace su propio try/catch y devuelve:
  - 400 `{error, mensaje}` para validación de entrada.
  - 403 `Forbid()` o `{error, mensaje}` para auth/plan.
  - 404 `NotFound("string")`.
  - 429 `{error:"limit_reached", plan, limit, used}`.
  - 500 `StatusCode(500, ex.Message)` ← inconsistente y filtrador.
- Sin structured logging con correlation ID / request ID.
- `ILogger<T>` usado con templates nombrados (`{UserId}`, etc.) — bien, pero inconsistente entre controllers.

### 10.2 Frontend

- **Sin `error.tsx`** por ruta.
- **Sin `global-error.tsx`** en `app/`.
- **Sin `loading.tsx`**.
- **Sin Suspense boundaries**.
- **Sin Sentry / Datadog / monitoring** de ningún tipo.
- `ApiError` definido, pero el manejo vive en cada página con patrones distintos:
  - `dashboard/page.tsx`: 401 → redirect login, 429 → upsell modal, resto → "Error al conectar con el servidor".
  - `salud/page.tsx`: mensaje genérico "Error al conectar con el servidor".
  - `onboarding/page.tsx`: `err.message` o fallback i18n.
  - `admin/page.tsx`: mensaje en alert / estado local.
- Si un componente **renderiza** y lanza excepción (no API sino render crash), **pantalla blanca** porque no hay Error Boundary de React.
- `console.log`/`console.error` en `lib/api.ts` dejan traza en browser.
- No hay reintento automático por 5xx, no hay refresh token automático por 401.

### 10.3 Lo que el usuario ve hoy en caso de fallo real

| Escenario | UX actual |
|---|---|
| Backend caído al abrir dashboard | Mensaje "Error al conectar con el servidor. Recarga la página." |
| Claude falla con 500 al generar respuesta | En frontend: mensaje genérico. En logs backend: `ex.Message` + stack. |
| Component crash React (error en render) | **Pantalla blanca**. Usuario reinicia browser. |
| 401 durante sesión | Redirect silencioso a /auth/login (sesión Supabase probablemente caducó) |
| 429 limit reached | Upsell modal (correcto) |
| 403 baneado | Mensaje concreto |
| Publicar a Google falla por token revocado | Mensaje con CTA a Settings (correcto, ya implementado) |
| Fallo de red durante sync | Error genérico + posible pérdida de progreso |
| Outscraper devuelve vacío por error | **Silencioso**, peor caso: borra reseñas históricas (§9.11) |

---

## 11. Implementación del error handling — ✅ REALIZADA 2026-04-12

> **Esta sección documentaba originalmente la propuesta de Fase 2. Tras la sesión del 2026-04-12, todo lo descrito aquí ha sido implementado.** Los nombres de fichero y la estructura son los reales. Objetivo cumplido: **que el usuario no vea nunca una pantalla en blanco**.

### 11.1 Datos del reporte (payload al backend)

```ts
type ReportErrorPayload = {
  occurredAt: string           // ISO 8601
  url: string                  // window.location.href
  errorMessage: string         // normalizado, sin stack
  errorSource: 'render' | 'api' | 'network' | 'manual'
  statusCode?: number          // si aplica (api/network)
  endpoint?: string            // path del backend si aplica
  lastAction?: string          // última acción trazada ("click_generate_review", "sync_reviews", ...)
  userEmail?: string           // del usuario logueado si hay sesión
  userPlan?: string            // plan efectivo
  userAgent: string            // navigator.userAgent
  platform: string             // navigator.platform / OS
  language: string             // navigator.language
  observaciones: string        // free text del usuario
}
```

**No se incluye stack trace.** El backend genera un `reportId` corto (ej: `RPT-20260412-XXXX`) para referenciar en el email.

### 11.2 Cambios backend

**Nuevo endpoint**: `POST /api/report-error` — anónimo (permite reportar aunque la sesión esté rota), con rate limit in-memory simple por IP para evitar abuso (ej: 10 reportes/hora por IP → por ahora basta con un `MemoryCache` simple, no añadir `System.Threading.RateLimiting` en este paso).

**Fichero nuevo**: `backend/Controllers/ReportErrorController.cs`
- Valida tamaño máximo del payload (ej: 8 KB).
- Sanitiza `errorMessage` y `observaciones` (trim, max length, strip HTML).
- Genera `reportId`.
- Llama a `EmailService.SendErrorReportAsync(payload, reportId)` (método nuevo).
- Devuelve `{ reportId }`.

**Fichero nuevo (método en existente)**: `backend/Services/EmailService.cs`
- `SendErrorReportAsync(ReportErrorPayload payload, string reportId)`.
- Template HTML con todos los campos bien formateados + `[CONCERNS]` destacado + `reportId` en asunto: `[Velacre] Error reportado {reportId}`.
- To: `info@velacre.com`.

**Middleware global de excepciones** — fichero nuevo `backend/Infrastructure/GlobalExceptionMiddleware.cs`:
- Captura todo lo no controlado.
- Loguea con `ILogger` (con stack completo, eso queda server-side).
- Devuelve al cliente **siempre** el mismo shape:
  ```json
  {
    "error": "internal_error",
    "mensaje": "Ha ocurrido un error. Si el problema persiste, repórtalo.",
    "errorId": "SRV-20260412-XXXX"
  }
  ```
- `errorId` viene del `TraceIdentifier` de ASP.NET Core (ya existe, no hay que generar UUID).
- Sin stack, sin `ex.Message` directo.

**Registro**: `Program.cs` añade `app.UseMiddleware<GlobalExceptionMiddleware>()` antes de `UseAuthentication` (para que capture también fallos de deserialización), o tras `UseRouting` si se añade — por simplicidad va justo tras `UseCors`.

**Retrofit controllers**: no es estrictamente necesario eliminar los try/catch existentes — el middleware los captura si se dejan caer. Pero sí conviene sustituir los `StatusCode(500, ex.Message)` por `throw` (re-lanza) para que el middleware formatee consistentemente. Alternativa pragmática: dejar los catch como están por ahora y dejar que el middleware capture el resto.

### 11.3 Cambios frontend

**Nuevo componente**: `frontend/src/components/ErrorBoundary.tsx` (Client Component).
- Clase React tradicional (ErrorBoundary necesita `componentDidCatch`).
- Captura errores de render.
- Muestra fallback UI: mensaje amable + botón "Reportar problema".

**Nuevo fichero**: `frontend/src/app/global-error.tsx`.
- Error boundary de Next.js App Router para errores en el root layout.
- Misma UI que ErrorBoundary.

**Nuevo fichero**: `frontend/src/app/error.tsx`.
- Error boundary por ruta (captura errores en `/dashboard`, etc.).
- Misma UI.

**Nuevo componente**: `frontend/src/components/ReportErrorModal.tsx`.
- Modal overlay con:
  - Título: "Reportar problema".
  - Texto: "Se va a enviar un reporte a info@velacre.com con los detalles del error para que podamos solucionarlo."
  - Preview colapsable de los datos que se envían (URL, mensaje, hora, etc.).
  - Textarea "Observaciones" (opcional).
  - Botones: Cancelar / Enviar.
  - Estados: idle / sending / sent / error.
- Post-enviado: mensaje "Reporte enviado. Gracias." + botón cerrar.

**Nuevo hook**: `frontend/src/lib/useErrorReporter.ts`.
- Expone `reportError(errorInfo)` y `trackLastAction(action)`.
- Mantiene `lastAction` en un ref module-level para poder capturarlo desde cualquier sitio.
- Construye el payload.
- Llama `POST /api/report-error` (nueva función en `lib/api.ts`).
- No requiere JWT (endpoint anónimo).

**Nueva función en `lib/api.ts`**: `reportError(payload)`.
- `fetch` directo a `/api/report-error` sin authHeaders (pero sí con el token si existe, por si queremos enriquecer server-side).

**Providers**: `frontend/src/components/Providers.tsx` envuelve `children` con `<ErrorBoundary>`.

**API calls**: en `lib/api.ts` el helper `fetchJson` existente ya lanza `ApiError`. Añadir en el catch global del hook (o en páginas concretas) llamadas a `reportError` para errores que no son 401/429/403 normales.

**Tracking de última acción**: en puntos clave (`generateForReview`, `syncReviews`, `publishToGoogle`, etc.) llamar `trackLastAction('generate_review:id')` antes del fetch, para que el reporte sepa qué estaba haciendo el usuario.

### 11.4 Flujo end-to-end del reporte

```
[Usuario] está en /dashboard, click "Generar"
  │
  ├─ trackLastAction('generate_review:abc-123')
  ├─ POST /api/review/abc-123/generate
  │    Backend: GlobalExceptionMiddleware captura NullReferenceException (por ejemplo)
  │    Return 500 {error:"internal_error", mensaje:"...", errorId:"SRV-20260412-AB1"}
  │
  ├─ Frontend: ApiError 500 capturado en dashboard/page.tsx
  │    └─ En lugar de mostrar solo mensaje genérico, muestra:
  │        "Ha ocurrido un error al generar la respuesta. [Reportar problema]"
  │
  ├─ Usuario click "Reportar problema"
  │    ReportErrorModal abre con preview de payload ya rellenado
  │
  ├─ Usuario añade "pasó al pulsar generar tras sync" y click Enviar
  │
  ├─ POST /api/report-error con payload completo + observaciones
  │    Backend: genera RPT-20260412-XX4Z, llama Resend
  │    Email a info@velacre.com con todo el contexto
  │    Return {reportId:"RPT-20260412-XX4Z"}
  │
  └─ Modal muestra "Reporte enviado. Gracias."
```

### 11.5 Qué NO se incluye en esta fase

- Sentry / monitoring externo.
- Circuit breakers / Polly.
- Rate limiting general.
- Refresh token automático.
- Retry automático frontend en 5xx.
- Tests.
- Breadcrumb log completo (solo `lastAction`).

---

## 12. Backlog técnico — estado 2026-04-12

> Se presentaron al usuario uno por uno con severidad. Resumen del estado final:

1. **Race condition contador manual** — Medio. **Backlog** (99% imposible en uso real).
2. **Supabase singleton sync init** — Medio. **Resuelto por infra** (Railway 24/7).
3. ~~**Sin circuit breaker**~~ — **✅ Implementado 2026-04-12** (solo Claude, con `Microsoft.Extensions.Http.Resilience`).
4. ~~**N+1 keywords**~~ — **✅ Implementado 2026-04-12** (RPC `get_top_keywords`).
5. ~~**Delete loop O(N)**~~ — **✅ Implementado 2026-04-12** (bulk delete).
6. **Sin rate limiting** — Alto. **Backlog** (no crítico hoy sin atacantes activos).
7. ~~**DeleteMe sin transacción**~~ — **✅ Implementado 2026-04-12** (RPC `delete_user_cascade` + fallback manual).
8. **Webhook LS sin idempotencia** — **Revisado**: no era duplicación técnica; los emails "duplicados" eran distintos (2 LS + 2 Velacre). Resuelto por eliminación de los 3 emails redundantes de Velacre en el webhook.
9. ~~**Fire-and-forget emails**~~ — **✅ Implementado 2026-04-12** (`FireAndForget.Run` con logging de excepciones).
10. **`User.FindFirst("sub")!`** — Bajo. **Backlog**.
11. ~~**Outscraper vacío silencioso + borrado en modo inicial**~~ — **✅ Resuelto 2026-04-12** (sync nunca borra preexistentes; cron ya era seguro).
12. ~~**Claude sin timeout**~~ — **✅ Implementado 2026-04-12** (`HttpClient.Timeout = 90s`).
13. ~~**Logs exponen tokens**~~ — **✅ Resuelto 2026-04-12** (logs saneados en `GoogleBusinessService`).
14. **Doble submit / filtros rápidos** — Bajo. **Backlog**.
15. **SW pass-through** — Medio. **Backlog**.
16. ~~**`500 ex.Message` expuesto**~~ — **✅ Resuelto 2026-04-12** (middleware global + `throw;` en 7 sitios).

---

## 13. Backlog técnico / code smells (no concurrencia)

### 13.1 Backend

- **0 tests** (ni unit ni integration). Sin `backend.Tests.csproj`.
- **[2026-04-12]** ~~`Infrastructure/` vacío~~ — ahora contiene `GlobalExceptionMiddleware.cs` y `FireAndForget.cs`. Sigue sin haber capa DAL propia (se usa directamente el `Supabase.Client`).
- **Duplicación de plan check** en varios controllers: `usuario.Plan == "pro" || (usuario.ProOverride && ...)`. Debería ser método helper.
- **Duplicación de extracción de userId**: `Guid.Parse(User.FindFirst("sub")!.Value)` en todos los controllers.
- **`Stripe.net` referenciado** pero no usado.
- **Warnings sobre CreateNegocio**: comentario explícito "Supabase devuelve Models vacío" → workaround con GET adicional (posible bug SDK).
- **Hardcode orígenes CORS** en `Program.cs:57-63`. No escala a nuevos entornos.
- **Mini-radar** tiene system prompt hardcodeado en el controller (debería estar en ClaudeService).
- **LemonController** tiene mapeo manual variant_id (plan, billing) — debería estar en config.
- `NotifyController` sin dedupe de waitlist.
- `GoogleBusinessService.PublishReplyAsync` construye URL manualmente sin encoding.

### 13.2 Frontend

- **`dashboard/page.tsx` = 1307 líneas**. God component. Estado disperso en ~15 useState. Mezcla data fetching, filtros, modales, upsell, sync, generación, publicación, estado manual.
- **`salud/page.tsx` ~500 líneas**, alta complejidad (métricas + PDF + radar).
- **`LandingPage.tsx` 1000+ líneas** — aceptable porque es contenido visual.
- Sin React Query / SWR → cada página refetch al montar, sin cache entre navegaciones.
- `localStorage` para i18n: `lib/i18n.tsx:43`.
- `console.log`/`console.error` en `lib/api.ts` dejados en producción.
- `NEXT_PUBLIC_API_URL ?? 'http://localhost:5146'` — el fallback solo debería existir en dev.
- `<html lang="es">` hardcodeado aunque hay i18n.
- Rutas hardcodeadas en string literals (no enum/const central).

### 13.3 PWA

- Service Worker es **network-first pass-through** (4 líneas). No hay cache, no hay offline, no hay fallback cuando falla red. Se gana el prompt de instalación pero casi nada más.
- Manifest mínimo (name, icons, colors, display).

### 13.4 Patrón repetido — extracción de userId

En cada controller:
```csharp
var userId = Guid.Parse(User.FindFirst("sub")!.Value);
```
Problemas:
1. NPE si `sub` no existe (raro pero posible con JWT malformado).
2. `FormatException` si `sub` no es GUID (Supabase lo genera como UUID, pero teóricamente podría cambiar).
3. Duplicación en 11 controllers.

Extension method candidato:
```csharp
public static class ClaimsPrincipalExtensions {
    public static Guid GetUserId(this ClaimsPrincipal user) {
        var sub = user.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(sub) || !Guid.TryParse(sub, out var id))
            throw new UnauthorizedAccessException("Token sin 'sub' válido.");
        return id;
    }
}
```

---

## 14. Métricas de código

| Métrica | Backend | Frontend |
|---|---|---|
| LOC totales | ~5.000 | 12.824 (incluidos locales) |
| Controllers / páginas | 11 controllers | ~20 rutas app/ |
| Servicios / componentes | 5 services | ~10 componentes compartidos |
| Entidades BD / tipos API | 9 entities | ~30 tipos en `lib/api.ts` |
| Endpoints API | 44 | consumidos ~35 |
| Tests | 0 | 0 |
| Cobertura | 0% | 0% |
| TODO/FIXME explícitos | 0 | 0 |
| `any` / `@ts-ignore` | — | 0 / 0 |
| Error boundaries | 0 | 0 |
| Middleware global de errores | No | No |

---

## 15. Dependencias sin usar / deprecated

- **Backend**: `Stripe.net` v50.4.1 — cargado pero sin imports. Candidato a eliminar del `.csproj`.
- **Frontend**: sin dependencias obviamente muertas.

---

## 16. Apéndice: mapa de variables de entorno por componente

| Env var | Usado en | Crítico |
|---|---|---|
| `SUPABASE_URL` | Backend (JWT + cliente) | ✓ |
| `SUPABASE_SERVICE_KEY` | Backend (cliente) | ✓ |
| `ANTHROPIC_API_KEY` | ClaudeService | ✓ |
| `AI_MODEL` | ClaudeService | No (default) |
| `GOOGLE_PLACES_API_KEY` | GooglePlacesService | ✓ |
| `GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI` | GoogleBusinessService | ✓ |
| `OUTSCRAPER_API_KEY` | OutscraperService | ✓ |
| `LEMONSQUEEZY_API_KEY` | LemonController | ✓ |
| `LEMONSQUEEZY_STORE_ID` | LemonController | ✓ |
| `LEMONSQUEEZY_VARIANT_*` | LemonController (4 variant IDs) | ✓ |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | LemonController | ✓ |
| `RESEND_API_KEY` | EmailService | ✓ |
| `RESEND_FROM` | EmailService | ✓ |
| `CRON_SECRET` | CronController | ✓ |
| `ADMIN_USER_ID` | IsAdmin check | ✓ |
| `FRONTEND_URL` | OAuth redirect / emails | ✓ |
| `CORS_EXTRA_ORIGIN` | Program.cs CORS | No (opcional previews) |
| `PORT` | Railway | ✓ |
| `NEXT_PUBLIC_API_URL` | Frontend lib/api.ts | ✓ |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend supabase-js | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend supabase-js | ✓ |
| `NEXT_PUBLIC_LEMON_*_VARIANT_ID` | Frontend checkout | ✓ |

---

## 17. Glosario interno

- **Plan efectivo**: plan real después de aplicar `ProOverride` (campo BD) y vencimiento de prueba. Calculado en `/api/usuario/me`.
- **Soft cap**: umbral no-bloqueante para el plan Pro a 250 respuestas IA/mes — solo genera un banner de aviso en frontend.
- **Retenida**: respuesta que Claude se niega a generar por detección de intoxicación/maltrato/amenaza legal/datos personales. La reseña queda con `Retenida=true` y `MotivoRetencion`.
- **Tono generado**: `"Profesional" | "Cercano" | "Directo" | "google" | null`. `"google"` significa que la respuesta ya estaba en Google (no la generó Velacre).
- **Mini-radar**: flujo B2B (admin-only) para prospección. No persiste nada. Input manual de place_id + nombre.

---

## 18. Cosas que requieren atención del owner (resumen accionable)

> Para leer en 30 segundos.

**Bugs funcionales** (impactan al usuario directamente):
1. Las reseñas retenidas por filtro IA no notifican al usuario por email (endpoint existe, no se llama). **[2026-04-12: dejado a futuro por decisión]**
2. ~~`500 ex.Message` inconsistente~~ **✅ Resuelto 2026-04-12**.

**Bugs de concurrencia / datos**:
3. ~~Outscraper en error → lista vacía → en sync inicial puede borrar reseñas históricas~~ **✅ Resuelto 2026-04-12** — sync jamás borra preexistentes.
4. Race condition contador manual (baja probabilidad real). **Backlog**.
5. ~~`DeleteMe` sin transacción~~ **✅ Resuelto 2026-04-12** — RPC `delete_user_cascade`.

**Seguridad**:
6. ~~Log de bodies completos de Google APIs en Railway~~ **✅ Resuelto 2026-04-12**.
7. Sin rate limiting aplicativo. **Backlog** (existe rate limit in-memory solo en `/api/report-error`).
8. CORS `AllowAnyMethod/Header`. **Backlog** (bajo riesgo: origen restringido).

**Mantenibilidad**:
9. `dashboard/page.tsx` 1307 líneas (god component). **Backlog**.
10. 0 tests. **Backlog**.
11. Sin monitoring (Sentry). **Backlog** — pero ahora el usuario puede reportar errores manualmente vía `/api/report-error`.
12. ~~Sin error boundaries frontend~~ **✅ Resuelto 2026-04-12** — `ErrorBoundary`, `app/error.tsx`, `app/global-error.tsx`.

**Cosas que ya están bien** (para no tocar):
- JWT validation con JWKS.
- RPC atómica `try_increment_ia_counter` para contador IA.
- RPC `get_top_keywords` y `delete_user_cascade` **[2026-04-12]**.
- Webhook LS con HMAC-SHA256 + EnableBuffering.
- Filtro de seguridad IA (intoxicación/maltrato/legal).
- OAuth GBP con state firmado y TTL.
- PWA básica funcionando en Android/iOS.
- TypeScript strict, 0 `any`, 0 `@ts-ignore`.
- `GlobalExceptionMiddleware` + `ErrorBoundary` **[2026-04-12]**.
- Circuit breaker Claude **[2026-04-12]**.

---

## 19. Changelog del doc

### 2026-04-09 — Pricing + prompts neutrales + PWA

**Commits:** `eebac81`, `a3894b3`, `3a321ea`, `4fdeae1`

- **feat(pricing):** Pro sube a **€49/mes** y **€490/año** (antes €39/€390). `LandingPage.tsx` pricing section + `es.ts`/`en.ts`/`gal.ts` locales actualizados.
- **fix(salud):** Teasers Basic/Core en `dashboard/salud/page.tsx` — contenido correcto en móvil. Redirect post-checkout LS lleva a dashboard en lugar de quedarse en la pasarela.
- **fix(ai):** `ClaudeService.cs` — eliminadas todas las referencias hardcodeadas a "Galicia" y "hostelería" en los system prompts. Ahora el contexto viene del `negocio.descripcion` + `palabras_clave` + reseñas del cliente. Velacre sirve a cualquier sector/mercado hispanohablante.
- **feat(pwa):** `public/sw.js` (Service Worker cache básico) + `public/manifest.webmanifest` (start_url `/dashboard`, display standalone) + `components/PWAInstall.tsx` (banner con `beforeinstallprompt` en Android, instrucciones iOS, `localStorage` dismiss). Registrado desde `Providers.tsx`.

### 2026-04-10 (sesión 1) — Mini Radar + banner PWA + calculadora

**Commits:** `54a61ef`, `728dc58`, `e1cec28`, `d0fd099`, `99e072c`, `f3e5778`, `f0db12b`

- **feat(admin):** **Mini Radar v1** — `POST /api/admin/mini-radar` en `AdminController.cs` + `/admin/mini-radar/page.tsx` + `lib/mini-radar-pdf.ts`. Outscraper 30 reseñas + stats locales + extracción 3 peores sin responder + Claude genera `{fortalezas[2], debilidades[2], accion, resumen, emailPitch}`. PDF 3 páginas con jsPDF. Sin persistencia. Coste ~€0.05/informe.
- **feat(mini-radar):** Buscador Google Places reemplaza input manual de place_id. Reutiliza `searchPlaces()` de onboarding: debounce 300ms, dropdown, click-outside, card verde.
- **tweak(landing):** Calculadora: 4 min → **6 min** sin Velacre, 15 seg → **5 seg** con Velacre. `Math.max(1, Math.ceil(resenas * 5 / 60))` garantiza mínimo 1 min.
- **chore(email):** `hola@velacre.com` → `info@velacre.com` en `EmailService.cs`, `mini-radar-pdf.ts`, `velacre-context.md`, `generate-email-templates-docx.js`.
- **fix(pwa):** Banner reescrito tras feedback: gate duro a `/` y `/inicio` (`return null` en otras rutas), auto-hide 10s (`useRef` para el timer), primera vez de por vida (`localStorage.velacre-pwa-banner-dismissed`). Fix `react-hooks/set-state-in-effect`.
- **fix(mini-radar):** Prompt Claude humanizado — fuera jerga SEO/CTR/ranking. Dentro: lenguaje de dueño de bar gallego. Ejemplos buenos/malos + regla auto-revisión. `emailPitch` tono "vecino".

### 2026-04-10 (sesión 2) — Rebalanceo de planes + filtro transversal

- **Backend** (`ReviewController.cs`): Basic manuales 3→**5**, Core manuales 3→**5**, Basic IA 3→**10**, Core IA 18→**20**, Pro IA ilimitadas con **cap soft 250/mes**. Refactor bloque de límite: todos los planes usan `try_increment_ia_counter`. Pro pasa `p_limit = -1`. Nuevo campo respuesta: `softCapWarning: bool`.
- **Frontend locales** (`es.ts`, `en.ts`, `gal.ts`): actualización de features por plan. Nuevos campos `transversalTitle` + `transversalItems` en `locales/types.ts`.
- **LandingPage.tsx:** bloque "Incluido en todos los planes" con 4 items transversales (filtro seguridad, 6 tonos, idioma auto, sin permanencia). Grid `sm:grid-cols-2`.
- **dashboard/page.tsx:** mensajes de límite actualizados (10 Basic, 20 Core). Nuevo estado `proSoftCapVisible` + banner ámbar descartable para `softCapWarning`.
- **`api.ts`:** campo `softCapWarning?: boolean` en `GenerateForReviewResult`.
- **Verificado sin cambios necesarios:** Panel Salud Core ya tenía la estructura correcta (4 KPIs reales + 4 cards Pro con blur), settings ya usaban upsell contextual, responsive mobile-first, RPC ya aceptaba `p_limit < 0`.
- **Fix tardío** (`b20a326`): botón Mini Radar en admin header tenía `hidden sm:inline-flex` → invisible en móvil. Corregido: icono siempre visible, texto solo en `sm+`.

### 2026-04-12 — Implementación Fase 2 + Fase 3

- **Fase 2 (error handling global):** creado `backend/Infrastructure/GlobalExceptionMiddleware.cs` + `backend/Controllers/ReportErrorController.cs` + `backend/Models/Requests/ReportErrorRequest.cs` + `EmailService.SendErrorReportAsync`. Frontend: `components/ErrorBoundary.tsx` + `app/error.tsx` + `app/global-error.tsx` + `components/ReportErrorModal.tsx` + `lib/errorReporter.ts` + `reportError` en `lib/api.ts`. Providers envuelve con ErrorBoundary. Botón "Reportar problema" añadido a los bloques `initError` de dashboard y salud con `trackLastAction` en sync y generate.

- **Fase 3 (hardening):**
  - Sync nunca borra reseñas preexistentes (§9.11, §10.x).
  - Logs `GoogleBusinessService` saneados (§9.13).
  - Circuit breaker en HttpClient de Claude + timeout 90s (§9.3, §9.12) vía `Microsoft.Extensions.Http.Resilience` 9.0.0.
  - RPC Postgres `delete_user_cascade` + refactor `UsuarioController.DeleteMe` con fallback manual (§9.7).
  - RPC Postgres `get_top_keywords` + refactor `ReviewController.GenerateForReview` fallback de keywords (§9.4).
  - 7 sitios con `StatusCode(500, ex.Message)` → `throw;` + middleware global (§9.17).
  - `GoogleBusinessService.DeleteAllReviewsForNegocioAsync` → bulk delete (§9.5).
  - `backend/Infrastructure/FireAndForget.cs` helper + aplicado en webhook LS y welcome email (§9.9).
  - Emails redundantes eliminados del webhook LS (confirmación/cancelación/expiración) — Lemon Squeezy ya los envía.

- **BD:** 2 RPCs nuevas en Supabase pegadas por el owner.
- **Backend package:** añadido `Microsoft.Extensions.Http.Resilience 9.0.0`.
- **Build:** backend 0 errores, frontend 0 errores TS, 0 errores ESLint nuevos.
- **Commit:** `c7a8b6a` — feat(resilience): error handling global + hardening de concurrencia y seguridad

### 2026-04-12 (hotfix) — RPC parsing + upsell modal

**Bug crítico descubierto en producción:** usuarios Pro (con `plan=pro` y `respuestas_ia_mes=0`) recibían 429 "limit_reached" al generar respuesta IA. Causa raíz: `rpcResult?.Content?.Trim() == "true"` en `ReviewController.cs:321` era case-sensitive y no manejaba posibles comillas o variaciones del formato de retorno de supabase-csharp `Rpc()`. El log mostraba `plan=pro` pero el RPC devolvía un valor que no matcheaba la comparación estricta.

**Fixes:**

1. **`ReviewController.cs`** — parsing RPC robusto:
   - `.Trim('"').Equals("true", StringComparison.OrdinalIgnoreCase)` en vez de `== "true"`.
   - Try-catch en la llamada RPC: si falla, Pro sigue adelante (contador es informativo), non-Pro se bloquea por seguridad.
   - Log mejorado: incluye `rpcContent` exacto e `iaLimit` para diagnosticar.

2. **`dashboard/page.tsx`** — modal upsell:
   - Si el 429 viene con `plan: "pro"` (error temporal), muestra "Error temporal al generar" + botón "Cerrar e intentar de nuevo" en vez del checkout upsell.
   - Fix textos hardcodeados desactualizados: "Core — 18 al mes" → "Core — 20 al mes".
   - Barra de uso IA: `18 : 3` → `20 : 10` (alineados con los límites reales del backend).

### 2026-04-12 (hotfix 2) — RPC Pro + filtro seguridad ampliado

- **`ReviewController.cs`**: Pro nunca bloqueado por resultado de RPC — `allowed = esProEfectivo || rpcAllowed`. Try-catch con fallback: Pro sigue, non-Pro bloquea.
- **RPC `try_increment_ia_counter` actualizada en Supabase**: versión antigua no tenía `p_limit < 0 = sin límite`. Nueva versión con `FOR UPDATE`, `INTERVAL '1 month'` reset, y check `p_limit >= 0` antes de devolver FALSE.
- **`ClaudeService.cs`**: 2 nuevas categorías en filtro de seguridad — `acusacion_fraude` (fraude, estafa, engaño deliberado, cobro intencionado de más — no quejas de precio) y `discriminacion` (raza, etnia, nacionalidad, género, orientación sexual, religión, discapacidad). Añadidas en ambos prompts (single + three responses).
- **`dashboard/page.tsx`**: `MOTIVO_LABELS` y bloque manual ampliados con las 2 nuevas categorías. Modal upsell: detecta `plan=pro` → "Error temporal" en vez de upsell checkout. Barra IA: `18:3` → `20:10`.

### 2026-04-12 — i18n completo (ES/GAL/EN)

Migración completa de todos los textos hardcodeados del frontend al sistema i18n. 28 ficheros modificados, +3323/-937 líneas. Cero cambios funcionales — solo sustitución de strings por `t.xxx`.

**Locales expandidos:**
- `types.ts`: ~550 claves tipadas (antes ~150). Nuevas secciones: `dashboard.filters`, `dashboard.iaBar`, `dashboard.softCap`, `dashboard.empty`, `dashboard.retention` (6 categorías), `dashboard.manual`, `dashboard.context`, `dashboard.upsell`, `dashboard.actions`, `dashboard.states`, `help` (8 pasos), `report` (modal completo), `errors` (fallbacks), `sectionNav`, `waitlistModal`, `callback`, `admin` (panel completo), `miniRadar` (completo), `salud` (~80 claves: KPIs, radar, PDF, tooltips), `legal` (3 páginas completas), `auth.resetPassword`.
- `es.ts`, `en.ts`, `gal.ts`: traducciones completas en los 3 idiomas.

**Componentes migrados (solo strings, sin cambios de lógica/CSS):**
- Componentes: `SectionNav`, `HelpModal`, `ReportErrorModal`, `ErrorBoundary` (helpers funcionales con try/catch fallback ES), `WaitlistModal`, `ResponseCard`, `LandingPage`.
- Pages: `dashboard/page.tsx` (~60 strings), `dashboard/salud/page.tsx` (~80 strings), `settings/page.tsx` (~25 strings), `onboarding/page.tsx`, `onboarding/plan/page.tsx`, `admin/page.tsx`, `admin/mini-radar/page.tsx`, `inicio/page.tsx`, `auth/callback/page.tsx`, `auth/login/page.tsx`, `auth/register/page.tsx`, `auth/reset-password/page.tsx`, `error.tsx`, `privacidad/page.tsx`, `terminos/page.tsx`, `contacto/page.tsx`.

**LangSwitcher (selector de idioma):**
Rediseñado como botón flotante fijo `fixed bottom-5 left-5 z-50` (simétrico al `HelpButton` en bottom-right). Botón circular `w-10 h-10 rounded-full` con código del idioma activo (ES/GL/EN). Click abre dropdown hacia arriba con 3 opciones: Castellano, Galego, English. Click-outside cierra. Tooltip al hover. Montado globalmente desde `Providers.tsx` — quitado de los 15 headers individuales donde estaba incrustado.

**LandingPage:** refactorizado de `props.locale` a `useLanguage()` — cambiar idioma actualiza la landing en tiempo real. Rutas `/es`, `/en`, `/gal` setean el locale al montar vía `useEffect`.

**Traducciones landing corregidas:** hero, stats, demo, health, howto, forWho, cta en EN y GAL eran contenido diferente del español (pre-existente). Corregidas para ser traducciones fieles del mismo mensaje. GAL: "Próximo" → "Achegado" en transversalItems para consistencia.

**No tocados (fallback ES por diseño):** `global-error.tsx` (sin Provider disponible).

### 2026-04-12 — 6 tonos + simplificación modal manual

**6 tonos:** Profesional, Empático, Cercano, Directo, Agradecido, Humorístico. Grid 3x2 en settings/onboarding.

- `ClaudeService.cs`: switch con 6 cases (con y sin tilde para Empático/Humorístico). Agradecido orientado a reseñas positivas — incluye keywords del negocio con naturalidad.
- `ReviewController.cs POST /generate`: ahora llama a `GenerateSingleResponseWithContextAsync` (antes `GenerateThreeResponsesWithSafeFilterAsync`). Acepta `tono` opcional en el request, fallback a `negocio.TonoPredefinido`. MaxTokens 500 (antes 1200).
- `ReviewController.cs POST /save-manual`: acepta 1 campo `Respuesta` (antes 3). Validación incluye los 6 tonos. Mapeo BD: cercano→`RespuestaCercano`, directo→`RespuestaDirecto`, todo lo demás→`RespuestaProfesional` (compatible con lógica de lectura del dashboard).
- `GenerateThreeResponsesWithSafeFilterAsync` no eliminado pero ya no se llama desde ningún endpoint activo.
- Frontend: modal manual sin selección de tono — genera 1 respuesta en tono del negocio y muestra directamente. `ManualResponseRow` eliminado.
- Locales: 6 tonos en `settings.tonos` + `demo.response.tones` en ES/EN/GAL.
- Landing demo: 6 botones de tono.

**⚠️ AVISO — bomba de relojería en modal manual:** Actualmente `handleSaveManual` envía `tonoSeleccionado: negocio.tonopredefinido` al backend. Esto funciona porque `handleGenerateManual` genera con el mismo tono. **Si en el futuro se añade un selector de tono dentro del modal manual** (para que el usuario elija un tono distinto al del negocio), el `tonoSeleccionado` que se envía al save DEBE actualizarse para reflejar el tono real usado en la generación, no el predefinido del negocio. Si no, `TonoGenerado` en BD no coincidirá con la respuesta almacenada y la lógica de lectura del dashboard (`toneLower === 'cercano' ? r.respuestaCercano : ...`) devolverá la respuesta incorrecta.

### 2026-04-13 — Optimización radar + limpieza

- **`RadarController.cs`**: llamadas a Outscraper paralelizadas con `Task.WhenAll` (antes `foreach` secuencial). Reduce scraping de 3 competidores de ~15-30s a ~5-10s.
- **`dashboard/salud/page.tsx`**: polling de análisis en curso. Al lanzar el radar se guarda timestamp en `localStorage`. Si el usuario navega y vuelve, detecta el análisis en curso y muestra spinner con "Generando informe comparativo..." + polling cada 5s a `getRadar()` hasta que el resultado aparezca en BD (o timeout 2 min). Limpia el flag al completar o al expirar.
- **Eliminado `app/health/page.tsx`**: página legacy de 439 líneas sin i18n ni enlaces, versión vieja del panel de salud.

---

*Fin del documento. Actualizar cuando se añadan/retiren servicios, cambie el schema de BD o se añada monitoring.*
