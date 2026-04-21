# velacre-context-technical.md

Retrato técnico del estado actual del proyecto **Velacre (ReviewShield)** — arquitectura, flujos, integraciones, datos, seguridad y concurrencia. Rama activa: `20260418_redefine`. Para contexto de negocio / pricing / outreach ver `velacre-context.md`.

Este documento es una **ficha de consulta**, no un diario. Describe el sistema como está hoy, no cómo llegó hasta aquí.

---

## 0. Resumen ejecutivo

SaaS para hostelería (foco Galicia) que importa reseñas de Google, genera respuestas con IA (Claude), permite publicarlas en Google Business Profile, y ofrece un módulo "Radar" de análisis comparativo con competidores en el plan Pro.

Stack:
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind 4, TypeScript strict. PWA básica.
- **Backend**: .NET 10 (ASP.NET Core) con DI, Postgrest SDK sobre Supabase, sin EF Core. Repositorios + FluentValidation.
- **Persistencia**: Supabase (Postgres + Auth). RLS activado en 7 tablas (22 policies). Backend usa **service key** (bypassa RLS como defense-in-depth).
- **Auth**: Supabase Auth (JWT ES256). Backend valida vía JWKS discovery.
- **IA**: Anthropic Claude (`claude-sonnet-4-6`) vía `Anthropic.SDK` v5.
- **Reseñas**: OAuth Google Business Profile (nativo) + Outscraper (fallback / competidores).
- **Pagos**: LemonSqueezy + webhook HMAC-SHA256.
- **Email**: Resend.
- **Deploy**: backend en Railway (PORT env var), frontend en Vercel.

Tamaño: ~5.000 LOC backend, ~19.300 LOC frontend (incluye locales i18n y `landing.css` editorial de ~1.4k líneas). 49 endpoints API, 11 controllers, 5 servicios, 9 entidades. 53 tests (~12-15% cobertura).

**Estado del hardening**:
- Middleware global de excepciones + `ErrorBoundary` + `error.tsx` + `global-error.tsx`.
- Circuit breaker + timeout 90s en Claude (Polly / `Microsoft.Extensions.Http.Resilience`).
- RPCs atómicas para contador IA, top keywords y delete en cascada.
- Sync jamás borra reseñas preexistentes (defiende del failure mode "Outscraper vacío").
- Logs saneados en `GoogleBusinessService`.
- Sin Sentry, sin rate limiting aplicativo (salvo `/api/report-error` con `MemoryCache`).

**Debilidades conocidas persistentes**:
1. Race condition teórica en contador manual (`RespuestasManualesMes`) — no resuelta; probabilidad real despreciable.
2. `SendRetainedReviewAlertAsync` existe pero no se invoca: la retención se ve sincrónicamente en el dashboard cuando el usuario pulsa "generar"; el email está previsto para cuando exista auto-publicación / batch.
3. CORS `AllowAnyMethod + AllowAnyHeader + AllowCredentials` (origen sí restringido).
4. Admin por env var única (`ADMIN_USER_ID`), no escala.
5. `salud/page.tsx` ~500 LOC aún sin refactorizar.

---

## 1. Stack tecnológico por capa

| Capa | Tecnología | Versión | Notas |
|---|---|---|---|
| Frontend framework | Next.js | 16.2.1 | App Router, TS strict |
| Frontend runtime | React | 19.2.4 | |
| UI | Tailwind CSS | 4.x | Custom UI, sin shadcn / Radix |
| Animaciones | framer-motion | 12.38 | Residual (`shared.tsx` usa IntersectionObserver) |
| Data fetching | @tanstack/react-query | — | staleTime 30s |
| PDF | jspdf | 4.2.1 | Panel salud + mini radar |
| Backend | ASP.NET Core | .NET 10 | Controllers + DI + Repos + FluentValidation |
| JWT | Microsoft.AspNetCore.Authentication.JwtBearer | 10.0 | JWKS discovery |
| Resilience | Microsoft.Extensions.Http.Resilience | 9.0.0 | Polly circuit breaker (solo Claude) |
| BD SDK | supabase-csharp | 0.16.2 | Postgrest, sin EF Core |
| IA | Anthropic.SDK | 5.10.0 | Claude Sonnet 4.6 |
| JSON | Newtonsoft.Json | 13.0.4 | |
| Env loader | DotNetEnv | 3.1.1 | |
| Identity provider | Supabase Auth | — | Email+pwd y Google OAuth |
| Reseñas (API nativa) | Google Business Profile API | v1 + v4 | OAuth |
| Reseñas (fallback) | Outscraper | reviews-v3 | Síncrono |
| Búsqueda lugares | Google Places API | v1 | |
| Pagos | LemonSqueezy | API + Webhooks | |
| Email | Resend | API | |
| Hosting backend | Railway | — | PORT env var |
| Hosting frontend | Vercel | — | Previews con `CORS_EXTRA_ORIGIN` |

---

## 2. Arquitectura global

### 2.1 Diagrama conceptual

```
 ┌─────────────────────┐           ┌──────────────────────────┐
 │  Navegador / PWA    │           │  Email SMTP (Resend API) │
 │  Next.js 16         │           └────────────▲─────────────┘
 └──────┬──────────────┘                        │
        │ fetch + JWT Bearer                    │
        ▼                                       │
 ┌──────────────────────┐                       │
 │  Backend .NET 10     ├──► Anthropic Claude   │
 │  ASP.NET Core        ├──► Google Places v1   │
 │  (Railway)           ├──► Google Business    │
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

1. Frontend: `supabase.auth.signUp()` / `signInWithPassword()` / `signInWithOAuth({provider:'google'})`.
2. Supabase devuelve sesión con `access_token` (JWT ES256) + refresh token gestionado por supabase-js.
3. Cada request al backend adjunta `Authorization: Bearer {access_token}` vía helper `authHeaders()` (`lib/api/`). La sesión se obtiene fresca en cada request (sin cache en el helper).
4. Backend valida el JWT en `UseAuthentication()` con claves públicas del JWKS de `SUPABASE_URL/auth/v1`. `MapInboundClaims=false` preserva el claim `sub`.
5. El userId se extrae con `User.GetUserId()` (extension en `Infrastructure/ClaimsPrincipalExtensions.cs`): valida presencia y formato Guid del claim, lanza `InvalidOperationException` con mensaje claro si falta.

### 2.3 Protección de rutas

- **Frontend**: `proxy.ts` (Next.js 16, sustituye `middleware.ts`) usa `@supabase/ssr` para validar sesión server-side con cookies HTTP. Rutas protegidas (`/dashboard`, `/settings`, `/inicio`, `/onboarding`, `/admin`) redirigen a `/auth/login` sin flash. Usuarios logueados en `/auth/*` redirigen a `/inicio`.
- **Backend**: todos los controllers con `[Authorize]` salvo `GoogleController.Callback`, `LemonController.Webhook`, `CronController.Sync` (secret header) y `ReportErrorController` (anónimo + rate limit).

### 2.4 Transición visual post-auth (welcome/goodbye)

`WelcomeTransition.tsx` + `lib/welcome.ts` implementan un "rito de paso" entre marketing (paleta crema) y producto (paleta navy).

- **Dos modos**: `welcome` (crema → navy, "Bienvenido a velacre" ES / "Welcome" EN / "Benvido" GAL) y `goodbye` (navy → crema, "Hasta luego" / "See you soon" / "Ata logo").
- **6 fases**: `enter → hold → morph → rest → fade → gone`. Duración total ~2400ms (hasta 3200ms si espera cambio de ruta tras `/auth/callback`).
- **Sincronización con navegación**: `usePathname`. Si arranca en `/auth/callback` espera al cambio de ruta antes de iniciar fade; fallback forzado a 5s si la ruta no cambia.
- **Activación**:
  - Welcome via query `?welcome=1` (email+pwd login/register) o sessionStorage `vel_welcome` armado antes de redirect OAuth (sobrevive al viaje a google.com).
  - Goodbye via sessionStorage `vel_goodbye` armado antes de `signOut()`.
- **Helpers `welcome.ts`**: `armWelcome / consumeWelcome / armGoodbye / consumeGoodbye`. Usan sessionStorage con timestamp + TTL 10s para evitar que un flag zombie dispare la transición en un F5 posterior de la landing.
- **Logout**: `AppHeader.handleLogout` y `settings.handleDeleteAccount` hacen `armGoodbye() → supabase.auth.signOut() → window.location.href = '/'` (hard reload, no `router.replace`, para remount limpio del árbol).
- **Anti-flash pre-paint (root layout)**: `layout.tsx` inyecta en `<head>` un `<script>` inline que lee sessionStorage antes del primer paint y añade una clase al `<html>`. Un `<style>` inline + un `<div id="vel-prepaint">` en `<body>` actúan como cortina que tapa el HTML SSR de la landing hasta que React hidrata y `WelcomeTransition` monta su overlay. Resuelve el flash entre HTML pintado y hidratación.
- **`/auth/callback`**: spinner "Iniciando sesión" oculto con `display:none` (el nodo se mantiene para no romper lógica). Fondo crema `#E8E2D4` para fundir con el welcome que viene de Google OAuth.

---

## 3. Backend .NET

### 3.1 Estructura

```
backend/
├── Controllers/          11 controllers
├── Services/             5 (Claude, GooglePlaces, Outscraper, GoogleBusiness, Email)
├── Interfaces/           11 (7 repositorios + 4 servicios; sin interfaz para EmailService)
├── Repositories/         7 implementaciones sobre Supabase.Client
├── Validators/           7 FluentValidators
├── Models/
│   ├── Entities/         9 entidades Postgrest
│   ├── Requests/         DTOs de entrada
│   ├── Responses/        DTOs de salida
│   └── Varios/           GbpLocation, etc.
├── Infrastructure/       GlobalExceptionMiddleware, FireAndForget, ClaimsPrincipalExtensions
├── Program.cs
├── backend.csproj
├── appsettings.json      (logging only; config real vive en env)
├── Dockerfile            (Railway)
└── backend.http          scratchpad REST Client
```

### 3.2 `Program.cs` — pipeline

```
Env.Load() → AddControllers, AddOpenApi, AddHttpClient, AddMemoryCache()

JWT Bearer:
  Authority = SUPABASE_URL/auth/v1
  RequireHttpsMetadata = true
  ValidateIssuerSigningKey = true
  ValidateIssuer=false, ValidateAudience=false
  ValidateLifetime = true, ClockSkew = 0
  MapInboundClaims = false
AddAuthorization()

DI:
  IReviewAiService → ClaudeService (HttpClient "anthropic"):
      Timeout = 90s
      AddResilienceHandler("claude-pipeline") — circuit breaker
        (50% fallos en ventana 30s, min 8 reqs, break 30s)
        + timeout por intento 85s
  IGooglePlacesService / IOutscraperService / IGoogleBusinessService → HttpClient typed
  EmailService (Scoped, sin interfaz)
  7 repositorios + 7 validators (FluentValidation auto-pipeline)

Supabase.Client Singleton con InitializeAsync().GetAwaiter().GetResult()
  (bloqueo sync en startup; aceptable porque Railway mantiene proceso 24/7)

CORS "AllowFrontend":
  WithOrigins(localhost:3000/3001, velacre.com, www.velacre.com) + CORS_EXTRA_ORIGIN
  AllowAnyMethod + AllowAnyHeader + AllowCredentials

Pipeline:
  UseCors → UseMiddleware<GlobalExceptionMiddleware>
         → UseAuthentication → UseAuthorization
         → Request.EnableBuffering (para releer body del webhook LS)
         → MapControllers
  app.Run($"http://0.0.0.0:{PORT ?? 5146}")
```

No hay: políticas `ProblemDetails` nativas (shape custom), `AddRateLimiter` aplicativo, `UseHsts`/`UseHttpsRedirection` (Railway termina TLS), health check oficial de ASP.NET Core (`HealthController` es el análisis IA, no liveness).

### 3.3 Controllers — tabla completa (49 endpoints)

Todos con `[Authorize]` salvo marcados. Todos los métodos devuelven `Task<IActionResult>`.

**`HealthController`** — 1 endpoint
| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/health/analysis` | Análisis IA del panel "salud" (3 bloques brillante/preocupa/acción sobre últimas 50 reseñas) |

**`AdminController`** — 10 endpoints (check extra `IsAdminAsync()`, prioriza `ADMIN_USER_ID` env, fallback a `rol="admin"` en BD)
| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/admin/usuarios` | Lista usuarios con plan/estado/negocio |
| POST | `/api/admin/usuarios/{id}/estado` | activo/baneado/prueba + DiasPrueba |
| POST | `/api/admin/usuarios/{id}/pro-override` | Activar/desactivar Pro sin cambiar plan |
| PUT | `/api/admin/usuarios/{id}/notas` | Notas internas admin |
| POST | `/api/admin/usuarios/{id}/plan` | Cambiar plan (override manual) |
| PUT | `/api/admin/negocios/{id}/place` | Setear place_id a mano |
| POST | `/api/admin/usuarios/{id}/activar`·`/desactivar` | Legacy, llaman a `/estado` |
| PUT | `/api/admin/usuarios/{id}/rol` | cliente/admin |
| POST | `/api/admin/mini-radar` | **B2B prospección** — análisis ad-hoc de place_id. No persiste. Outscraper (`GetRecentReviewsAsync`, dias=30, max=60) + Claude. Devuelve `{stats:{total,ratingAvg,distribucion,pctRespondidas,fechaDesde,fechaHasta}, peoresSinResponder, analisis:{fortalezas,debilidades,accion,resumen,emailPitch,oportunidad?}}`. `oportunidad` nullable: Claude detecta patrón concreto con 3 ejemplos o devuelve null. |

**`CronController`** — 1 endpoint (header `X-Cron-Secret`, comparado con `==` no timing-safe)
| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/cron/sync` | Sync semanal (martes) para todos los negocios con place_id. Devuelve `{synced,total,totalNew,errors}` |

**`GoogleController`** — 6 endpoints (OAuth GBP)
| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| GET | `/api/google/auth-url` | JWT | URL OAuth con state HMAC firmado (TTL 10 min) |
| GET | `/api/google/callback` | Anónimo | Intercambia code, guarda tokens, auto-finalize si 1 local |
| GET | `/api/google/status` | JWT | `{connected, locationName, displayName, connectedAt}` |
| GET | `/api/google/locations` | JWT | Lista locales disponibles |
| POST | `/api/google/finalize` | JWT | Finaliza conexión (borra reseñas previas, sync inicial) |
| DELETE | `/api/google/disconnect` | JWT | Revoca en Google, borra conexión y reseñas |

**`LemonController`** — 3 endpoints
| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| GET | `/api/lemonsqueezy/checkout` | JWT | Sesión LS (core/pro × monthly/yearly), payload JSON:API |
| POST | `/api/lemonsqueezy/cancelar` | JWT | DELETE en LS API + update BD |
| POST | `/api/lemonsqueezy/webhook` | Anónimo | HMAC-SHA256 verify `X-Signature`. Eventos: created/resumed/updated/cancelled/expired/paused |

**`NegocioController`** — 3 endpoints
| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/negocio/me` | Lee negocio |
| POST | `/api/negocio` | Crea (código `NEG` + 7 chars random) |
| PUT | `/api/negocio/me` | Update; `PlaceId` bloqueado tras setup salvo admin |

**`NotifyController`** — 1 endpoint
| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/notify/waitlist` | Notifica a `infovelacre@gmail.com`. Sin dedupe. |

**`PlacesController`** — 2 endpoints
| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/places/search?q=...` | Google Places Text Search v1 |
| POST | `/api/places/sync` | Sync reseñas (GBP si conectado, Outscraper si no). **Nunca borra preexistentes.** |

**`RadarController`** — 4 endpoints (Pro only)
| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/radar` | Competidores + último análisis + `analisisEstaSemana` |
| POST | `/api/radar/competidores` | Add (max 3), 400 si duplicado/límite |
| DELETE | `/api/radar/competidores/{id}` | Borrar |
| POST | `/api/radar/analizar` | **Límite hard: 1/semana** (ISO, lunes UTC). Outscraper paralelo (`Task.WhenAll`) + Claude comparativo. Conserva últimos 2. Error: `ya_analizado_esta_semana`. Helper privado `GetIsoWeekStart` (`daysSinceMonday = (dow+6)%7`). |

**`ReviewController`** — 13 endpoints (controller **crítico**)
| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/review/generate` | 1 respuesta SIN guardar (modal manual). Plan+estado+límite manual (5/mes no-Pro). Tono = request.Tono ?? negocio.TonoPredefinido. MaxTokens 500. Filtro seguridad IA. Race teórica en contador manual. |
| POST | `/api/review/save-manual` | Guarda manual con 1 campo `Respuesta` + tono. Escribe sobre la única columna `respuesta` de la tabla (migración 004 consolidó las 3 columnas legacy profesional/colegueo/orgullosa). |
| GET | `/api/review/pending` | Lista sin respuesta (WHERE `respuesta IS NULL`) |
| POST | `/api/review/{id}/generate` | Genera respuesta para reseña existente. **Query param `force=bool`** para forzar regeneración sobrescribiendo la anterior. **Detección de cambio de tono**: si existe `respuesta` pero `tono_generado` != tono actual del negocio → regenera con tono nuevo y consume IA aunque no se haya pasado force. Si match + !force → devuelve existente + rollback del contador. **RPC atómica `try_increment_ia_counter(userId, iaLimit)`**. Límites: **Basic 10, Core 25, Pro -1 (ilimitado con soft cap warning a 250)**. Fallback keywords vía RPC `get_top_keywords`. Pro nunca bloqueado por RPC: `allowed = esProEfectivo \|\| rpcAllowed`. No cambia `estado` tras force-regenerate (es reemplazo de texto, no reapertura). |
| PUT | `/api/review/{id}/response` | Edición manual del texto de la respuesta (autosave desde dashboard). Escribe sobre `review.respuesta`. Valida: texto no vacío, ≤2000 chars, `tono_generado` existe y ≠ `google` (Google answers read-only desde aquí). |
| GET | `/api/review/all` | Todas las reseñas del negocio |
| POST | `/api/review/{id}/translate` | Traduce original a ES |
| POST | `/api/review/{id}/translate-response` | Traduce `review.respuesta` a ES |
| GET | `/api/review/metrics` | `velacreCount`, `timeSaved` (×3.75 min), response rate histórico vs 3m |
| GET | `/api/review/analysis` | Carga último análisis IA de BD. `{analysis, currentReviewCount, analysisReviewCount}` |
| POST | `/api/review/analysis` | Genera análisis (últimas 50 reseñas). **Límite: 1/día fijo** (`if (todayCount >= 1)`). Guarda en `analisis_ia`. |
| POST | `/api/review/summary` | Alias POST de `/analysis` (compat antigua) |
| POST | `/api/review/{id}/publish-google` | Publica en GBP. Solo Core/Pro + `google_review_id` + GBP conectado. |
| PUT | `/api/review/{id}/estado` | pendiente/respondida/ignorada. Actualiza `respondidaFecha`. |

**`UsuarioController`** — 4 endpoints
| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/usuario/me` | `{id, nombre, rol, plan, ls*, respuestasIaMes, isAdmin, planEfectivo}` |
| PUT | `/api/usuario/me` | Update nombre |
| DELETE | `/api/usuario/me` | RPC transaccional `delete_user_cascade` + cancel LS + delete auth.users. Fallback manual conservado. |
| POST | `/api/usuario` | Crea perfil post-signup, `plan="basic"`, welcome email fire-and-forget |

**`ReportErrorController`** — 1 endpoint (anónimo + rate limit)
| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/report-error` | Rate limit 10/hora por IP (`IMemoryCache`). Sanitiza campos. Genera `reportId = RPT-yyyyMMdd-HHmmss-XXXX`. Email a `info@velacre.com` con observaciones + contexto. **Sin stack trace.** |

### 3.4 Services

#### `ClaudeService` (`IReviewAiService`)
- Modelo: `AI_MODEL` env, default `claude-sonnet-4-6`.
- MaxTokens 500-2500 según endpoint; temp 0.4-0.7.
- Retry exponencial x3 solo en `overloaded_error` para endpoints de texto libre; 2× para structured output (overloaded + rate_limit + HttpRequestException + TaskCanceledException).
- HttpClient inyectado con `Timeout=90s` + circuit breaker Polly.
- Métodos activos:
  - `GenerateSingleResponseAsync` / `GenerateSingleResponseWithContextAsync` (respuesta individual a reseña; prompt JSON en texto libre + parse defensivo).
  - `AnalyzeRadarAsync` (Pro radar): **tool use** con schema forzado `registrar_analisis_radar`, MaxTokens 2500.
  - `AnalyzeMiniRadarAsync` (admin prospección): **tool use** con schema forzado `registrar_analisis_mini_radar`, MaxTokens 1500.
  - `GetClaudeMessageAsync` (helper texto plano, p.ej. traducciones).
- **Helper privado `GetStructuredOutputAsync<T>`**: punto de entrada común para tool use. Construye `Common.Function(toolName, description, inputSchema)` con JSON Schema a mano (JsonNode), la envuelve en `Common.Tool`, y fuerza `ToolChoice { Type = ToolChoiceType.Tool, Name = toolName }`. Deserializa `ToolUseContent.Input` a `T` con `JsonSerializerOptions { PropertyNamingPolicy = CamelCase }`. La API de Anthropic valida los argumentos contra el schema antes de devolverlos → imposible recibir JSON truncado o malformado. Log de `Usage.InputTokens` / `Usage.OutputTokens` + `StopReason` en cada llamada para ajustar MaxTokens con datos empíricos.
- Schemas construidos con `JsonNode.Parse(...)` inline en `BuildMiniRadarSchema()` y `BuildRadarSchema()`. El `amenaza` del radar está restringido por `enum` del schema a `["alta","media","baja"]`.
- Records tipados en `Models/Responses/`: `MiniRadarAnalysis` + `MiniRadarOportunidad`; `RadarAnalysis` + `RadarCompetidorAnalisis` + `RadarCategoria` + `RadarRivalScore`.
- **6 tonos**: Profesional, Empático, Cercano, Directo, Agradecido, Humorístico (switch con y sin tilde). Agradecido incluye keywords del negocio con naturalidad.
- **Filtro de seguridad** — categorías de retención: `intoxicacion`, `maltrato`, `amenaza_legal`, `datos_personales`, `acusacion_fraude` (distingue de queja de precio), `discriminacion` (raza/etnia/nacionalidad/género/orientación/religión/discapacidad). Devuelve `{retenida, motivoRetencion}`. Cuando se retiene, el controller revierte el contador vía RPC.
- **Bomba de relojería documentada (modal manual)**: `handleSaveManual` envía `tonoSeleccionado = negocio.tonopredefinido`. Funciona porque `handleGenerateManual` usa el mismo tono. Si se añade selector de tono dentro del modal manual, ese campo DEBE reflejar el tono real usado en la generación, si no `TonoGenerado` en BD no coincidirá con la respuesta almacenada.
- Parsing de respuestas de Claude fuera de tool use: busca primer `{` y último `}` sin validar JSON estructuralmente (legacy de `GenerateSingleResponse*`). Las features de radar y mini-radar ya no usan este parsing — todo va por structured output.

#### `GooglePlacesService`
- `https://places.googleapis.com/v1/places:searchText`.
- Headers: `X-Goog-Api-Key`, `X-Goog-FieldMask`. Fields: `places.id, displayName, formattedAddress, rating`.
- Sin cache, sin rate limit, sin retry, sin timeout personalizado.

#### `OutscraperService`
- `https://api.app.outscraper.com/maps/reviews-v3`. Sync.
- 3 métodos públicos compartiendo helper privado `MapReview` (mapea `review_id, author_title, review_rating, review_text, review_datetime_utc, owner_answer, review_lang`):
  - `GetReviewsAsync(placeId, sinceDate?)` — sync inicial 60 reseñas / incremental 500 con cutoff.
  - `GetCompetitorReviewsAsync(placeId, limit=20)` — snapshot Radar.
  - `GetRecentReviewsAsync(placeId, dias=30, maxReviews=60)` — Mini Radar (cutoff server + filtro client, incluye owner_answer). 60 = techo anti-timeout (v3 síncrono peta a 100s con 200).
- Cutoff = unix timestamp.
- **Failure mode**: error de red → devuelve lista vacía silenciosamente. Mitigado porque el sync jamás borra preexistentes.

#### `EmailService` (sin interfaz)
- `https://api.resend.com/emails`. Templates HTML hardcodeados con Tailwind inline.
- Métodos:
  - `SendWelcomeAsync` — **único transaccional activo** tras post-signup.
  - `SendWaitlistNotificationAsync`.
  - `SendRetainedReviewAlertAsync` — **dormant por diseño** (XML doc explica: la retención es síncrona y se ve en el dashboard; sentido cuando exista auto-publicación o cron batch).
  - `SendSubscriptionConfirmedAsync` / `SendSubscriptionCancelledAsync` / `SendSubscriptionExpiredAsync` — **no se invocan** (LS envía los suyos con factura). Conservados por si se reutilizan.
  - `SendErrorReportAsync(ReportErrorRequest, reportId)` — asunto `[Velacre] Error reportado {reportId}`, a `info@velacre.com`, HTML con observaciones destacadas + tabla contexto.
  - `SendEmailAsync` (helper).
- Fire-and-forget estandarizado con `FireAndForget.Run(task, logger, tag)` (`Infrastructure/FireAndForget.cs`): `ContinueWith` con logging de excepciones en lugar de descartarlas.

#### `GoogleBusinessService` (749 LOC, más complejo)
- **OAuth flow**:
  1. `GenerateAuthUrl(negocioId, userId, returnTo)` → state firmado HMAC-SHA256 con `base64(JSON{negocioId,userId,returnTo,ts})` + signature con `_clientSecret`. TTL 10 min. Comparación timing-safe.
  2. `HandleCallbackAsync(code, state)` → valida state, intercambia code, guarda `GoogleConnectionEntity` con `isActive=false`, lista locales, auto-finalize si 1.
  3. `FinalizeConnectionAsync(locationName)` → marca `isActive=true`, borra reseñas anteriores (sin backup), lanza sync inicial.
- **Token refresh**: `EnsureValidTokenAsync()` compara expiry con ahora (sin grace period), llama `oauth2.googleapis.com/token`, actualiza BD. No detecta `token_revoked` → conexión puede quedar muerta silenciosamente; el endpoint de publish devuelve 401 `token_refresh_failed` que el frontend traduce a CTA "Reconectar" en Settings.
- **Fetch locales**: primero Business Information v1 (`mybusinessbusinessinformation.googleapis.com/v1/{account}/locations`), fallback a v4 legacy.
- **Sync**: GET `/v4/{location}/reviews` paginado. **Nunca borra preexistentes** (protección contra fallo transitorio de la API).
- **Publish reply**: POST `/v4/{location}/reviews/{id}/reply`. Update BD: `RespuestaPublicada`, `PublicadaEnGoogle=true`, `PublicadaFecha`, `Estado="respondida"`.
- **Delete**: `DeleteAllReviewsForNegocioAsync` hace bulk delete en 1 query.
- Logs saneados: solo contadores en success paths (nº cuentas, nº locales añadidos). Los paths de error mantienen body porque Google devuelve solo códigos tipo `{"error":{"code":...}}`.

### 3.5 `appsettings.json`

Solo logging: `Logging:LogLevel:Default=Information`, `Microsoft.AspNetCore=Warning`, `AllowedHosts=*`. Configuración real en env vars.

### 3.6 Variables de entorno

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
CORS_EXTRA_ORIGIN (opcional)
PORT (Railway)
```

Muchos se leen con `!` sin validación previa en startup. El proceso arranca y falla en el primer request que las necesite.

---

## 4. Frontend Next.js

### 4.1 Estructura de `src/`

```
src/
├── app/                    App Router
│   ├── layout.tsx          Root layout (Geist fonts, Providers, metadata PWA,
│   │                        <script> pre-paint + <style> + <div #vel-prepaint>)
│   ├── manifest.ts         Server Component → /manifest.webmanifest
│   ├── page.tsx            Landing CSR
│   ├── es/ · en/ · gal/    Variantes i18n landing
│   ├── auth/{login,register,callback,reset-password}/
│   ├── onboarding/{page.tsx, plan/}
│   ├── inicio/             Hub autenticado
│   ├── dashboard/{page.tsx (555 LOC), salud/}
│   ├── settings/
│   ├── admin/{page.tsx, mini-radar/}
│   ├── health/             Página pública health check
│   ├── (legal)/            route group con layout.tsx server component
│   │   ├── layout.tsx      isAuthenticatedSSR() → <PublicShell authed={bool}>
│   │   ├── privacidad/, terminos/, contacto/
│   ├── error.tsx           per-route error boundary
│   ├── global-error.tsx    root error boundary (fallback ES)
│   └── globals.css         tokens editoriales + remap Tailwind + utilities
├── components/             ~1.500 LOC
│   ├── Providers.tsx       ErrorBoundary + QueryClientProvider + LanguageProvider + PWAInstall + LangSwitcher
│   ├── LandingPage.tsx     ~246 LOC (secciones extraídas a landing/)
│   ├── WelcomeTransition.tsx   overlay rito de paso (welcome/goodbye)
│   ├── AppHeader.tsx       header app (VelacreMark+wordmark+negocio+plan badge+logout)
│   ├── AppFooter.tsx
│   ├── PublicShell.tsx     wraps marketing/legal (NavBar+main+FooterEditorial)
│   ├── ErrorBoundary.tsx
│   ├── ReportErrorModal.tsx
│   ├── ResponseCard.tsx · Tooltip.tsx · PWAInstall.tsx
│   ├── PublishGoogleModal.tsx · WaitlistModal.tsx · HelpModal.tsx
│   ├── SectionNav.tsx · LangSwitcher.tsx
│   ├── dashboard/          6 componentes extraídos (refactor del god component)
│   └── landing/            NavBar, Hero, Demo, RadarPreview, Pricing, Footer,
│                           VelacreMark, CountUp, shared.tsx, landing.css (~1.4k LOC)
├── hooks/                  5 hooks por dominio (useReviews, etc.) + useOAuthLoading
├── lib/
│   ├── api/                9 módulos + barrel index.ts (~580 LOC)
│   ├── welcome.ts          armWelcome/consume/armGoodbye/consume (sessionStorage + TTL 10s)
│   ├── i18n.tsx            LanguageContext + useLanguage, sincroniza document.documentElement.lang
│   ├── errorReporter.ts    useErrorReporter + trackLastAction
│   ├── supabase.ts         cliente supabase-js (createBrowserClient @supabase/ssr)
│   ├── auth-ssr.ts         isAuthenticatedSSR() — createServerClient + cookies() de next/headers,
│   │                       usado por (legal)/layout.tsx para detectar sesión sin flash
│   ├── lemon.ts · report-pdf.ts · mini-radar-pdf.ts
└── locales/
    ├── types.ts            LandingLocale (~550 claves, incluye landingEditorial)
    └── es.ts · en.ts · gal.ts
```

### 4.2 `app/layout.tsx` + `Providers`

`layout.tsx`:
- Fonts `Geist` + `Geist_Mono` via `next/font/google`.
- `metadata` Velacre + manifest + `appleWebApp` + openGraph.images + favicons completos (16/32/48 PWA pack).
- `viewport.themeColor = '#0A0E1A'` (Next 16 deprecó themeColor dentro de metadata).
- `document.documentElement.lang` dinámico (sincronizado por `LanguageProvider`).
- Class `dark` fija a nivel raíz; paleta paginada por `.vel-lp` (landing crema) vs resto (app navy).
- **Pre-paint anti-flash**: `<script>` inline en `<head>` lee `vel_welcome` / `vel_goodbye` antes del primer paint y aplica clase al `<html>`. Un `<style>` inline declara la cortina. Un `<div id="vel-prepaint">` se renderiza en `<body>` como cortina visible que cubre la landing SSR hasta que React hidrata y `WelcomeTransition` monta su overlay propio.

`Providers.tsx` (`'use client'`):
- Envuelve children en `ErrorBoundary` + `QueryClientProvider` (staleTime 30s) + `LanguageProvider`.
- Renderiza `<PWAInstall />` + `<LangSwitcher />` como overlays globales.

### 4.3 Rutas

| Ruta | Protección | Descripción |
|---|---|---|
| `/` | Pública | Landing (i18n) |
| `/es` `/en` `/gal` | Pública | Variantes landing (setean locale al montar) |
| `/auth/login` | Pública | Email+pwd + Google + reset |
| `/auth/register` | Pública | Email+pwd + Google |
| `/auth/callback` | Pública (PKCE) | `createBrowserClient` con `detectSessionInUrl:true` auto-consume code; fallback `exchangeCodeForSession`. Spinner oculto, fondo crema para fundir con welcome. |
| `/auth/reset-password` | Pública (con token) | Cambio pwd. Incluye sello+wordmark. |
| `/onboarding` | JWT (proxy.ts) | GBP o búsqueda manual. Sello+wordmark en form y GBP select. |
| `/onboarding/plan` | JWT | Core / Pro / Skip. Sello+wordmark. |
| `/inicio` | JWT | Hub |
| `/dashboard` | JWT | Lista reseñas, genera respuestas |
| `/dashboard/salud` | JWT (Pro para Radar) | Métricas + análisis + Radar |
| `/settings` | JWT | Perfil, negocio, plan, GBP |
| `/admin` | JWT + admin | Gestión |
| `/admin/mini-radar` | JWT + admin | Prospección B2B |
| `/health` | Pública | Health check |
| `/privacidad` `/terminos` `/contacto` | Pública | Legales |

### 4.4 Cliente HTTP (`lib/api/`)

- Fetch nativo envuelto en 9 módulos (negocio, usuario, reviews, radar, places, google, lemon, admin, report). Barrel `index.ts`.
- React Query (`@tanstack/react-query`) para data fetching (staleTime 30s). Sin axios, sin Zustand/Redux.
- `API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5146'`.
- `authHeaders()` obtiene sesión fresca de Supabase en cada request.
- Clase `ApiError(status, message, data?)`.
- 401 handling: cada página lo interpreta (`err.status === 401` → `router.replace('/auth/login')`). Sin refresh automático aplicativo (supabase-js gestiona refresh de token).

### 4.5 Estado global / data

- React Query cachea usuario, negocio, reseñas (staleTime 30s).
- Contexts: `LanguageProvider` + `QueryClientProvider`.
- `dashboard/page.tsx` mantiene ~15 `useState` locales (reviews, filters, sync progress, modals, upsell, softCap, etc.).

### 4.5.bis Dashboard UX patterns

- **Layout compacto PC**: main `py-4 space-y-3` con toolbar 1-fila (IaUsageBar pill a la izquierda, SyncBar icon-buttons a la derecha, `flex-wrap` si no caben). Split view con `h-[calc(100vh-13rem)]` y scroll interno en lista + detalle para que la página no scrollee.
- **SyncBar sin card**: los 3 botones (refresh / otra plataforma / sincronizar) son icon-only 36×36 con tooltips; sincronizar mantiene label en desktop por ser acción primaria. El contador `N pendientes · M respondidas` se eliminó (redundante con filter tabs).
- **IaUsageBar dos variantes**: pill compacto cuando `pct<70%` (badge inline con mini-progress), bloque expandido ámbar/rojo cuando `≥70%` o `limitReached`. Pro devuelve null (sin barra).
- **Filter tabs compactos**: segmented control 1 fila dentro de la lista, `flex + flex-1 + whitespace-nowrap` para que "Pendientes", "Respondidas", "Ignoradas", "Todas" se lean enteros sin truncar.
- **DetailPanel con sticky footer (desktop)**: acciones (Copiar · Regenerar con IA / Reabrir · Ignorar · Respondida) `lg:sticky lg:bottom-0 lg:bg-white/95 lg:backdrop-blur-sm` + sombra top suave (`lg:shadow-[0_-8px_14px_-6px_rgba(0,0,0,0.22)]`) en vez de `border-t` duro. Móvil mantiene flujo normal.
- **Edición in-place con autosave** (`DetailPanel.tsx`): textarea reemplaza el `<p>` cuando hay respuesta. Estado local `editedText` + `saveState ('idle'|'dirty'|'saving'|'saved'|'error')`. Dos disparadores: debounce 2s vía `useRef<setTimeout>` reseteado en cada tecla, o `onBlur` inmediato (cancela el timer). `persistEdit` + `Promise.all([onSaveResponse, minVisible450ms])` para que el "Guardando…" sea perceptible aunque el backend responda en 50ms. Cleanup del timer en unmount y al cambiar de reseña. Sincroniza con `generated` prop via `useEffect([review.id, generated])` para que regenerar resetee el textarea.
- **Regenerar con IA**: estado local `confirmingRegen` para doble-click inline (1er click → amber "Toca de nuevo para confirmar", setTimeout 4s reset; 2º → `onRegenerateIA()`). Durante `isGenerating` el botón muestra spinner + "Regenerando…" y está disabled. No se cambia `estado` — es reemplazo de texto, no cambio de flow.
- **Históricas Google**: cuando `estado='respondida' && tonoGenerado==='google'`, los botones Ignorar/Reabrir van disabled con `title={d.states.historicalGoogle}` + `opacity-40 cursor-not-allowed`. El textarea pasa a `<p>` plano read-only (no editable porque no podemos alcanzar lo publicado en GBP desde aquí).

### 4.6 i18n custom (sin next-intl)

- `LanguageContext` + `<LanguageProvider>` + `useLanguage()`.
- 3 idiomas: `es`, `en`, `gal`. Persistencia en `localStorage`.
- Shape tipado `LandingLocale` en `types.ts` con secciones `nav`, `hero`, `app.*`, `landingEditorial`, etc.
- Consumo: `const { t } = useLanguage(); const d = t.app.dashboard`.
- `document.documentElement.lang` se actualiza al cambiar idioma (no-SSR, via `useEffect` en Provider).
- **LangSwitcher**: botón flotante fijo `fixed bottom-5 left-5 z-50` (simétrico al HelpButton). Círculo `w-10 h-10 rounded-full` con código del idioma (ES/GL/EN). Dropdown hacia arriba, click-outside cierra. Montado globalmente en `Providers.tsx`.

### 4.7 PWA

- `app/manifest.ts` (Server Component) → `/manifest.webmanifest`:
  ```
  name: 'Velacre', short_name: 'Velacre',
  start_url: '/inicio',
  display: 'standalone',
  background_color: '#0A0E1A', theme_color: '#0A0E1A',
  icons: [android-chrome 192/512, maskable 192/512]
  ```
- `public/sw.js` (4 líneas): install → `skipWaiting`, activate → `clients.claim`, fetch → **pass-through a red** (network-first sin cache). **No hay offline.**
- `PWAInstall.tsx`: registra SW, escucha `beforeinstallprompt` (Android), detecta iOS no-standalone para mostrar instrucciones. Banner solo en `/` e `/inicio`. Auto-hide 10s + flag `localStorage.velacre-pwa-banner-dismissed` (primera-vez-de-por-vida).
- Pack de iconos completo en `public/icons/` (18 ficheros): `favicon.ico` + `favicon-{16,32,48}.png` (regenerados al 100% del canvas, sin padding extra) + `apple-touch-icon-{120,152,180}.png` + `android-chrome-{192,512}.png` + `maskable-{192,512}.png` + `mstile-{150,310}.png` + `logo-{64,128,256,1024}.png` + `og-image-1200x630.png`.

### 4.8 Shell / wordmark unificado

Centrado óptico de "velacre" junto al sello mediante:
```css
display: inline-flex; align-items: center;
height: [sello size];
line-height: 1;
transform: translateY(-1px);
```
Reemplaza hack anterior de line-height + margin-top. Aplicado en `AppHeader` (dashboard, inicio, salud, settings, admin), `landing.css .auth-brand-name` (login + register), `/auth/reset-password`, `/onboarding` (form principal y GBP select; componente interno `OnboardingBrand`; eliminado h1 redundante "Velacre"), `/onboarding/plan`. Footer editorial landing (`.foot-min-row`) centrado en móvil.

### 4.9 Landing — anchors y tabla comparativa

- Helper `scrollToAnchor` + `handleAnchorClick` en `components/landing/shared.tsx`: previene default del `Link` de Next y ejecuta `scrollIntoView` aunque el hash coincida con la URL. Aplicado en NavBar (3 iconos), HeroSection ("↓ Ver demo") y LandingPage sec 07 ("↑ Volver a la demo"). Resuelve "clic en ancla activa no hace nada".
- Tabla comparativa (`PricingSection`): tipo extendido `rows: Array<{ lbl: string; values: [boolean|'soon', boolean|'soon', boolean|'soon'] }>` + clave `soonLabel`. Fila GBP: etiqueta "Publicación directa en Google" (sin "(pendiente)"); Velacre muestra badge `Próximamente` (mono, dorado warn) en lugar de ✗ rojo; competidores mantienen ✓.

### 4.10 TypeScript / lint

- `tsconfig.json`: `strict: true`, target ES2017, alias `@/* → ./src/*`.
- 0 `any`, 0 `@ts-ignore`. 1 `eslint-disable-next-line react-hooks/exhaustive-deps` en `dashboard/page.tsx` (dependency router).

### 4.11 Tests

- **Backend** (`backend.Tests/` xUnit + Moq, 18 tests):
  - `Services/ClaudeServiceTests.cs` (9): parseo JSON, filtro seguridad, fallback raw, mapeo 6 tonos. `FakeHttpMessageHandler`.
  - `Controllers/NegocioControllerTests.cs` (5): CRUD básico.
  - `Controllers/UsuarioControllerTests.cs` (4): GetMe, admin role, pro override.
- **Frontend** (`frontend/src/test/` Vitest + @testing-library/react + jsdom, 35 tests):
  - `lib/api.test.ts` (8): ApiError, generateResponses, saveManualReview.
  - `lib/api-modules.test.ts` (14): negocio, usuario, radar, reviews.
  - `components/ResponseCard.test.tsx` (4).
  - `components/Tooltip.test.tsx` (4).
  - `hooks/useReviews.test.ts` (5).
- Cobertura ~12-15%. CI en `.github/workflows/ci.yml`: `dotnet build + test` + `npm test` + `tsc --noEmit` en push a main y PRs.

---

## 5. Integraciones externas

| Integración | Dirección | Auth | Timeout | Retry | Circuit breaker | Cache |
|---|---|---|---|---|---|---|
| Supabase (Postgrest) | Backend → Supabase | Service Key | default | No | No | No |
| Supabase Auth (JWT) | Backend (JWKS) | — | default | Lib | No | Lib |
| Anthropic Claude | Backend → api.anthropic.com | API key | 90s | 3x exp, solo overloaded | Sí (Polly, 50% en 30s, break 30s) | No |
| Google Places v1 | Backend | API key | default | No | No | No |
| Google Business Profile | Backend | OAuth2+refresh | default | No | No | No |
| Outscraper | Backend | API key | default | No (vacío en error) | No | No |
| LemonSqueezy API | Backend | API key | default | No | No | No |
| LemonSqueezy webhook | LS → Backend | HMAC-SHA256 | — | LS retry | Sin idempotencia explícita | — |
| Resend | Backend | API key | default | No | No | — |
| Railway cron | Railway → Backend | Header secret | — | — | — | — |

HttpClients registrados con `AddHttpClient<T>()` → pooling gestionado por `HttpClientFactory`. Sin `SetHandlerLifetime` custom (default 2 min).

---

## 6. Base de datos

### 6.1 Acceso

- SDK: `supabase-csharp` v0.16.2 (Postgrest + Functions + Auth Admin). Sin EF Core, sin Dapper, sin raw SQL aplicativo.
- `Supabase.Client` Singleton inicializado síncronamente en `Program.cs`. Auth admin (delete `auth.users`) via service key.
- **RLS activado en 7 tablas (22 policies)** por `auth.uid()` / negocio del usuario. Backend usa service_role que las bypassa → RLS es defense-in-depth. SQL en `supabase/migrations/003_rls_policies.sql`.

### 6.2 Entidades (Models/Entities/)

| Tabla | Propósito | Campos clave |
|---|---|---|
| `usuario` | Usuarios | id (Guid), email, nombre, rol (`cliente`\|`admin`\|`sales`), plan (`basic`\|`core`\|`pro`), estado (`activo`\|`baneado`\|`prueba`), pruebaHasta, activoDesde, proOverride, proOverrideHasta, respuestasManualesMes, respuestasMesReset, respuestasIaMes, lsSubscriptionId, lsStatus, lsRenewsAt, lsEndsAt |
| `negocio` | Establecimiento | id, idUsuario (FK), codigo (NEG+7), nombre, email, telefono, descripcion, tonoPredefinido, placeId, palabrasClave (string[]) |
| `review` | Reseñas | id, idNegocio, googleReviewId (null si manual), autor, rating, texto, fecha, plataforma, estado (`pendiente`\|`respondida`\|`ignorada`), tonoGenerado (null\|`Profesional`\|`Empatico`\|`Cercano`\|`Directo`\|`Agradecido`\|`Humoristico`\|`google`), **respuesta** (1 columna tras migración 004 — antes 3 columnas `respuestaprofesional`/`respuestacolegueo`/`respuestaorgullosa` con duplicación en sync Google + catch-all en profesional para 4 tonos), publicadaEnGoogle, publicadaFecha, respuestaPublicada, retenida, motivoRetencion |
| `google_connection` | Tokens OAuth | negocioId (PK), googleAccountId, locationName, displayName, accessToken, refreshToken, tokenExpiry, isActive, connectedAt |
| `competidor` | Radar | id, idNegocio, placeId, nombre |
| `radar_analisis` | Resultados Radar | id, idNegocio, createdAt, resultado (jsonb) |
| `analisis_ia` | Panel Salud | id, idNegocio, createdAt, resultado (jsonb) |
| `costo_mes`, `liquidacion` | Sin uso activo | — |

### 6.3 RPC Postgres

- **`try_increment_ia_counter(p_user_id uuid, p_limit int) → boolean`**
  - Único mecanismo atómico del proyecto para contador IA.
  - `FOR UPDATE` + `INTERVAL '1 month'` reset + check `p_limit >= 0` antes de devolver FALSE. `p_limit = -1` → sin límite (Pro).
  - Usado por `ReviewController.GenerateForReview()`. Si retorna false → 429 (sólo para non-Pro).
  - Sin RPC equivalente para contador manual (race teórica aceptada).

- **`get_top_keywords(p_negocio_id uuid, p_limit int) → TABLE(word text, count bigint)`**
  - SQL STABLE, `CROSS JOIN LATERAL unnest(r.keywords_usadas)` + GROUP BY + ORDER BY count DESC LIMIT.
  - Usado en fallback de keywords dentro de `GenerateForReview` (evita N+1).
  - `GRANT EXECUTE` a `authenticated, service_role`.

- **`delete_user_cascade(p_user_id uuid) → void`**
  - plpgsql `SECURITY DEFINER`, `SET search_path = public`.
  - Borra en una transacción: `review → radar_analisis → competidor → google_connection → analisis_ia → negocio → anonimiza usuario`. Rollback automático si algo falla.
  - Usado por `UsuarioController.DeleteMe()` con fallback manual por si no está desplegada.
  - `GRANT EXECUTE` a `authenticated, service_role`.

### 6.4 Transacciones

Ninguna a nivel aplicativo desde .NET. Operaciones multi-paso se manejan con RPC (como `delete_user_cascade`) o secuencias tolerantes a fallo parcial. `SetPlan` en webhook LS es idempotente por construcción (UPDATEs absolutos).

### 6.5 Migraciones

Sin herramienta de migraciones integrada en el proyecto .NET. Cambios aplicados manualmente vía Supabase dashboard; SQL versionado en `supabase/migrations/`:
- `002_plan.sql` — columnas de plan
- `003_rls_policies.sql` — RLS activado en 7 tablas (22 policies)
- `004_consolidate_respuesta.sql` (2026-04-22) — consolida `respuestaprofesional`/`respuestacolegueo`/`respuestaorgullosa` en una sola columna `respuesta`. `COALESCE` para preservar datos, luego `DROP COLUMN × 3`. Ejecutado en prod sin tráfico real todavía. Motivo: schema legacy de un flujo antiguo donde se generaban 3 tonos upfront; hoy solo se genera 1 y las sync desde Google duplicaban el `owner_answer` en las 3 columnas "por si cambia el tono" (absurdo). La identidad del tono vive en `tono_generado`.

---

## 7. Seguridad

### 7.1 Correcto

- JWT validación con JWKS, `RequireHttpsMetadata=true`, `ClockSkew=0`, `MapInboundClaims=false`.
- OAuth GBP: state HMAC-SHA256 con TTL 10 min + comparación timing-safe.
- Webhook LS: HMAC-SHA256 sobre body con `EnableBuffering`.
- `CronController` protegido por header secreto.
- Secrets vía env (DotNetEnv dev, Railway prod). Nada committeado.
- Postgrest evita SQL injection por construcción.
- CSRF no aplica (JWT en header, no cookie para API).
- TS strict, 0 `any`, 0 `@ts-ignore`.
- `User.GetUserId()` extension con error claro si claim falta.
- `proxy.ts` (Next.js 16) con `@supabase/ssr` protege rutas server-side con cookies HTTP.
- Logs `GoogleBusinessService` saneados.
- Middleware global de excepciones devuelve shape consistente sin stack ni `ex.Message`.

### 7.2 Pendiente / flojo

| Tema | Dónde | Riesgo |
|---|---|---|
| CORS `AllowAnyMethod + AllowAnyHeader + AllowCredentials` | `Program.cs` | Permisivo, origen restringido |
| Sin rate limiting aplicativo | Todo el backend (salvo `/api/report-error`) | DoS trivial, enumeración admin |
| Admin por env var única | `ADMIN_USER_ID` | No escala sin code change |
| Cron secret con `==` | `CronController` | Timing attack teórico (bajo) |
| CORS+credentials con `*` si `CORS_EXTRA_ORIGIN` mal configurado | `Program.cs` | Apertura total si alguien mete `*` |
| Sin Sentry / monitoring | FE+BE | Errores prod invisibles (mitigado por `/api/report-error` manual) |
| Sin HSTS / HTTPS redirect explícito | `Program.cs` | Confía en Railway TLS termination |

---

## 8. Flujos críticos end-to-end

### 8.1 Registro y onboarding

```
/auth/register (email+pwd)  ── signUp → POST /api/usuario {nombre}
  │                                       backend: crea perfil plan=basic, welcome email (F&F)
  ├─ ?welcome=1 en redirect   → WelcomeTransition (crema→navy, "Bienvenido a velacre")
  └─ router.replace('/onboarding')

/auth/register (Google OAuth)
  │  armWelcome() → window.location = supabase OAuth URL
  ├─ google.com → /auth/callback (PKCE auto-consumida por @supabase/ssr)
  └─ sessionStorage 'vel_welcome' (TTL 10s) → WelcomeTransition al entrar en /inicio

/onboarding (ruta A: GBP)
  ├─ POST /api/negocio {nombre,tono,descripcion,keywords}
  ├─ GET /api/google/auth-url?negocioId=X → {url}
  ├─ window.location = url
  ├─ Google → /api/google/callback (valida state, intercambia code, guarda conexión)
  │    Si 1 local → finalize auto (sync inicial, sin borrar preexistentes)
  │    Si N locales → /onboarding?gbp=select
  └─ → /onboarding/plan

/onboarding (ruta B: manual)
  ├─ GET /api/places/search?q=...
  ├─ POST /api/negocio → PUT /api/negocio/me {placeId}
  ├─ POST /api/places/sync → Outscraper
  └─ → /onboarding/plan
```

### 8.2 Generar respuesta IA

```
POST /api/review/{id}/generate
  ├─ Auth → carga usuario + negocio + review
  ├─ Check estado (baneado → 403; prueba expirada → 403)
  ├─ iaLimit: basic=10, core=25, pro=-1
  ├─ RPC try_increment_ia_counter(userId, iaLimit)
  │   allowed = esProEfectivo || rpcAllowed
  │   Si RPC throws → Pro pasa, non-Pro bloquea
  │   Si !allowed → 429 {error:"limit_reached", plan, limit, used}
  ├─ Si Pro y preCount+1 >= 250 → softCapWarning=true
  ├─ Fallback keywords vía RPC get_top_keywords(negocioId, 6)
  ├─ ClaudeService.GenerateSingleResponseWithContextAsync
  │   (retry 3x en overloaded; circuit breaker Polly)
  │   → {retenida, motivoRetencion, respuesta, contextoCliente, contextoRespuesta, keywordsUsadas}
  ├─ Si retenida:
  │   ├─ Revierte contador (RPC decrement)
  │   └─ Return 200 {retenida:true, motivoRetencion}
  ├─ UPDATE review SET RespuestaXxx, TonoGenerado, Retenida=false
  └─ Return 200 {response, tono, contexto*, keywordsUsadas, softCapWarning}
```

### 8.3 Sync de reseñas

```
POST /api/places/sync
  ├─ Si GBP conectado (google_connection.isActive=true):
  │   └─ GoogleBusinessService.SyncReviewsAsync
  │       EnsureValidTokenAsync → GET v4/{location}/reviews paginado
  │       Match por GoogleReviewId, inserta nuevas, actualiza ownerReply si llegó tarde
  │       Return {source:"gbp", newReviews, updatedReviews}
  └─ Si no:
      OutscraperService.GetReviewsAsync(placeId, sinceDate)
        Inicial: 60 reseñas. Incremental: 500 con cutoff.
        Error → lista vacía (sync NUNCA borra preexistentes)

Frontend: progress bar simulada 5-92% en 14s → 100% al responder → loadReviews
```

### 8.4 Checkout LemonSqueezy + webhook

```
GET /api/lemonsqueezy/checkout?plan=pro&billing=monthly
  → POST api.lemonsqueezy.com/v1/checkouts con variant_id + custom_data.user_id
  → Return {url}
Frontend: window.location.href = url

LS checkout → pago → redirect a frontend (thanks)
En paralelo: POST /api/lemonsqueezy/webhook
  ├─ HMAC-SHA256 verify X-Signature sobre body (EnableBuffering para releer)
  ├─ Extrae custom_data.user_id
  ├─ SetPlan(userId, plan, lsSubscriptionId, lsStatus, lsRenewsAt)
  └─ [ya no envía emails propios: LS manda el suyo con factura]
```

Sin idempotencia explícita; updates absolutos hacen el efecto neto idempotente.

### 8.5 Publicar respuesta en Google

```
POST /api/review/{id}/publish-google {respuesta}
  ├─ Verifica GoogleConnectionEntity.isActive
  ├─ EnsureValidTokenAsync
  │   Si token_refresh_failed → 401 {error:"token_refresh_failed"}
  │   [Frontend] PublishGoogleModal → redirige a Settings para reconectar
  ├─ POST mybusiness.googleapis.com/v4/{location}/reviews/{googleReviewId}/reply
  ├─ UPDATE review: RespuestaPublicada, PublicadaEnGoogle=true, PublicadaFecha, Estado="respondida"
  └─ Return 200
```

### 8.6 Eliminación de cuenta + logout

```
Logout:
  armGoodbye() → supabase.auth.signOut() → window.location.href='/'
  → Anti-flash pre-paint cubre HTML SSR de la landing
  → WelcomeTransition (navy→crema, "Hasta luego") se monta al hidratar

DELETE /api/usuario/me
  ├─ Si LsSubscriptionId → DELETE LS /v1/subscriptions/{id} (si falla, continúa)
  ├─ RPC delete_user_cascade(userId)  [transaccional: review→radar→competidor→gc→analisis→negocio→anonimiza usuario]
  │   Fallback manual si RPC no existe
  ├─ DELETE auth.users via Supabase Admin API
  └─ Return 200
Frontend: armGoodbye() → window.location.href='/' (igual que logout)
```

### 8.7 Error report

```
Error en frontend (render crash / api 5xx / manual):
  ErrorBoundary o catch de página → muestra fallback con [Reportar problema]
  Modal: preview payload + observaciones (textarea)
  POST /api/report-error (anónimo + rate limit)
    MemoryCache 10/hora por IP
    Genera reportId RPT-yyyyMMdd-HHmmss-XXXX
    EmailService.SendErrorReportAsync → info@velacre.com
    Return {reportId}
  Modal muestra "Reporte enviado. Gracias."
```

---

## 9. Concurrencia y alto tráfico

| # | Tema | Ubicación | Estado |
|---|---|---|---|
| 9.1 | Race contador manual | `ReviewController.GenerateResponses` | Backlog (99% imposible en uso real) |
| 9.2 | Supabase.Client singleton sync init | `Program.cs` | Mitigado por infra (Railway 24/7) |
| 9.3 | Circuit breaker Claude | `Program.cs` HttpClient "anthropic" | Polly 50%/30s/break 30s |
| 9.4 | Fallback keywords sin N+1 | `ReviewController.GenerateForReview` | RPC `get_top_keywords` |
| 9.5 | Delete reseñas en 1 query | `GoogleBusinessService.DeleteAllReviewsForNegocioAsync` | Bulk |
| 9.6 | Sin rate limiting aplicativo | Todo backend | Backlog (salvo `/api/report-error`) |
| 9.7 | DeleteMe transaccional | `UsuarioController.DeleteMe` | RPC `delete_user_cascade` |
| 9.8 | Webhook LS sin idempotencia explícita | `LemonController.Webhook` | Updates absolutos hacen efecto neto idempotente |
| 9.9 | Fire-and-forget emails con logging | `FireAndForget.Run` | Helper en Infrastructure |
| 9.10 | `User.FindFirst("sub")!` NPE | Todos los controllers | `User.GetUserId()` extension |
| 9.11 | Sync nunca borra preexistentes | `PlacesController.Sync` / `GoogleBusinessService` | Mitigación dura |
| 9.12 | Claude timeout 90s | `Program.cs` HttpClient | HttpClient.Timeout=90s + per-attempt 85s |
| 9.13 | Logs `GoogleBusinessService` saneados | Success paths | Solo contadores |
| 9.14 | Doble submit frontend | Dashboard y otros | Disabled manual (backlog hardening) |
| 9.15 | Filtros rápidos + fetch async | Dashboard | Backlog |
| 9.16 | SW pass-through sin offline | `public/sw.js` | Backlog |
| 9.17 | `500 ex.Message` sanitizado | `GlobalExceptionMiddleware` + `throw;` | Shape consistente {error, mensaje, errorId} |

### Detalle del race pendiente (9.1)

```csharp
// ReviewController.GenerateResponses
if (usuario.RespuestasManualesMes >= manualLimit)
    return StatusCode(429, ...);
// ...genera con Claude...
usuario.RespuestasManualesMes++;
await _supabase.From<UsuarioEntity>().Update(usuario);
```
Dos requests simultáneos del mismo usuario pueden ambos pasar el check y ambos incrementar. Mitigación natural existente: `try_increment_ia_counter`. No replicado para manual por decisión explícita (uso real casi imposible, escritor único por usuario).

---

## 10. Error handling

### 10.1 Backend

- **`GlobalExceptionMiddleware`** (`Infrastructure/`) captura excepciones no controladas. Shape:
  ```json
  { "error": "internal_error", "mensaje": "Ha ocurrido un error...", "errorId": "{TraceIdentifier}" }
  ```
  Sin stack, sin `ex.Message` directo. Stack completo queda en logs server-side vía `ILogger`.
- Controllers siguen con try/catch para respuestas de dominio (400/403/404/429). Los antiguos `StatusCode(500, ex.Message)` se sustituyeron por `throw;` — el middleware formatea.
- Sin structured logging con correlation ID custom (se usa `TraceIdentifier`).
- `ILogger<T>` con templates nombrados en prácticamente todos los controllers.

### 10.2 Frontend

- **`ErrorBoundary`** (clase React, `componentDidCatch`) envuelve Providers.
- **`app/error.tsx`** per-route (errores en páginas dentro del root layout).
- **`app/global-error.tsx`** para errores en el root layout (fallback ES hardcodeado — no hay Provider disponible).
- **`ReportErrorModal`** accesible desde todos los fallbacks y botones "Reportar problema".
- **`useErrorReporter`** (`lib/errorReporter.ts`): expone `reportError(info)` y `trackLastAction(action)`. Payload incluye URL, mensaje normalizado, source (`render|api|network|manual`), statusCode, endpoint, lastAction, userEmail, userPlan, userAgent, platform, language, observaciones. Sin stack trace.
- `ApiError` lanzado por `fetchJson`. Cada página maneja: 401 → login, 429 → upsell modal, resto → mensaje + CTA report.

### 10.3 UX en fallo

| Escenario | UX |
|---|---|
| Backend caído al cargar dashboard | Mensaje "Error al conectar con el servidor" + botón Reportar |
| Claude 500 al generar | Mensaje + CTA Reportar. Backend: stack en logs, middleware devuelve 500 sanitizado. |
| Render crash React | ErrorBoundary fallback con Reportar |
| 401 durante sesión | Redirect silencioso a /auth/login |
| 429 limit reached | Upsell modal (si `plan=pro`: "Error temporal" sin checkout) |
| 403 baneado | Mensaje concreto |
| GBP token revocado al publicar | 401 `token_refresh_failed` → CTA Settings reconectar |
| Fallo de red en sync | Error genérico. Sync ya no borra → sin pérdida de datos. |
| Outscraper vacío por error | Sync no borra preexistentes. No hay efecto destructivo. |

---

## 11. Reporte de errores (flujo completo)

```
Usuario en /dashboard, click "Generar"
  ├─ trackLastAction('generate_review:abc-123')
  ├─ POST /api/review/abc-123/generate
  │    Backend: GlobalExceptionMiddleware captura NRE
  │    Return 500 {error:"internal_error", mensaje:"...", errorId:"SRV-{TraceId}"}
  ├─ Frontend: ApiError 500 → dashboard muestra mensaje + [Reportar problema]
  ├─ Click "Reportar problema"
  │    ReportErrorModal abre con preview payload prellenado
  ├─ Usuario añade observaciones → Enviar
  ├─ POST /api/report-error (anónimo, rate limit 10/h por IP)
  │    Backend: sanitiza, genera RPT-yyyyMMdd-HHmmss-XXXX
  │    EmailService.SendErrorReportAsync → info@velacre.com
  │    Return {reportId}
  └─ Modal: "Reporte enviado. Gracias."
```

**No incluido**: Sentry, retry automático 5xx frontend, refresh token automático aplicativo, breadcrumb completo (solo `lastAction`).

---

## 12. Pricing y límites aplicados

### Planes (ver `velacre-context.md` para detalles comerciales)

| Plan | €/mes | €/año | Manuales/mes | IA/mes | Panel Salud | Radar |
|---|---|---|---|---|---|---|
| Basic | 0 | 0 | 5 | **10** | KPIs básicos | — |
| Core | 19 | 190 | 5 | **25** | Nota media + resumen reseñas | — |
| Pro | 49 | 490 | ilimitadas | ilimitadas (warning a 250) | Completo con análisis IA | Sí — 3 competidores, **1 análisis/semana** (ISO lunes UTC) |

### Límites aplicados en backend

- **Manuales**: `ReviewController.GenerateResponses` compara `usuario.RespuestasManualesMes >= manualLimit` (5 no-Pro, ilimitado Pro).
- **IA**: RPC `try_increment_ia_counter(userId, iaLimit)` con `iaLimit = 10 (basic), 25 (core), -1 (pro)`. Pro con `preCount+1 >= 250` → `softCapWarning=true` (no bloquea).
- **Análisis panel salud**: `POST /api/review/analysis` → `if (todayCount >= 1)` fijo (1/día).
- **Radar**: `POST /api/radar/analizar` → `weekStart = GetIsoWeekStart(UtcNow); if (thisWeekCount >= 1)` → error `ya_analizado_esta_semana`.
- **Competidores Radar**: max 3 por negocio.

### Copy i18n (ES/EN/GAL)

`aiLimitReached` "1 análisis/día", `radarTooltip` "Hasta 1 análisis a la semana", `radarAlreadyAnalyzed` "esta semana / lunes que viene". `planCore` features: `['25 respuestas IA/mes', 'Sincronización Google', 'Nota media y resumen de reseñas', 'Gestión completa de reseñas']`. `planPro` features: `['Respuestas IA ilimitadas', 'Panel Salud completo con análisis IA', 'Radar de competencia', 'Informes PDF mensual y anual', 'Soporte prioritario']`.

---

## 13. Code smells / backlog no-concurrencia

### 13.1 Backend

- Duplicación de plan check (`usuario.Plan == "pro" || (usuario.ProOverride && ...)`). Debería ser helper.
- Warnings sobre `CreateNegocio`: workaround con GET adicional (posible bug SDK Supabase).
- Hardcode orígenes CORS en `Program.cs` (no escala a entornos nuevos).
- `LemonController` mapeo manual variant_id (plan, billing) en código; debería ir a config.
- `NotifyController` sin dedupe de waitlist.
- `GoogleBusinessService.PublishReplyAsync` construye URL manualmente sin url-encoding.

### 13.2 Frontend

- `salud/page.tsx` ~500 LOC sin refactorizar (métricas + PDF + radar + polling).
- `localStorage` para i18n en `lib/i18n.tsx`.
- `NEXT_PUBLIC_API_URL ?? 'http://localhost:5146'` — el fallback solo debería existir en dev.
- Rutas hardcodeadas como literales (no enum/const central).

### 13.3 PWA

- SW network-first pass-through (4 líneas). No cache, no offline, no fallback.
- Manifest mínimo (name, icons, colors, display, start_url).

---

## 14. Settings (UI layout)

- Card "Tono de respuestas" extraída a `<section>` full-width debajo del grid `lg:grid-cols-5`, eliminando hueco vertical bajo la columna izquierda. Móvil intacto (apilado).
- Grid interno de tonos: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` para los 6 tonos (Profesional, Empático, Cercano, Directo, Agradecido, Humorístico).
- Plan cards (`planCore`, `planPro`) con copy honesto actualizado (25 IA/mes Core, sin claims falsos).
- CTA "Cerrar sesión" y "Eliminar cuenta" disparan `armGoodbye()` antes del hard reload.

---

## 15. Métricas de código

| Métrica | Backend | Frontend |
|---|---|---|
| LOC totales | ~5.000 | ~19.300 (incluye landing.css ~1.4k) |
| Controllers / páginas | 11 controllers | ~20 rutas app/ |
| Servicios / componentes | 5 services | ~20 componentes compartidos |
| Entidades BD / tipos API | 9 | ~30 en `lib/api/` |
| Endpoints API | 49 | consumidos ~35 |
| Tests | 18 (xUnit) | 35 (Vitest) |
| Cobertura | ~12-15% | ~12-15% |
| `any` / `@ts-ignore` | — | 0 / 0 |
| Error boundaries | GlobalExceptionMiddleware | ErrorBoundary + error.tsx + global-error.tsx |

---

## 16. Variables de entorno por componente

| Env var | Usado en | Crítico |
|---|---|---|
| `SUPABASE_URL` | Backend (JWT + cliente) | ✓ |
| `SUPABASE_SERVICE_KEY` | Backend (cliente) | ✓ |
| `ANTHROPIC_API_KEY` | ClaudeService | ✓ |
| `AI_MODEL` | ClaudeService | No (default) |
| `GOOGLE_PLACES_API_KEY` | GooglePlacesService | ✓ |
| `GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI` | GoogleBusinessService | ✓ |
| `OUTSCRAPER_API_KEY` | OutscraperService | ✓ |
| `LEMONSQUEEZY_API_KEY` / `STORE_ID` / `VARIANT_*` / `WEBHOOK_SECRET` | LemonController | ✓ |
| `RESEND_API_KEY` / `RESEND_FROM` | EmailService | ✓ |
| `CRON_SECRET` | CronController | ✓ |
| `ADMIN_USER_ID` | IsAdmin check | ✓ |
| `FRONTEND_URL` | OAuth redirect / emails | ✓ |
| `CORS_EXTRA_ORIGIN` | Program.cs CORS | No (opcional previews) |
| `PORT` | Railway | ✓ |
| `NEXT_PUBLIC_API_URL` | Frontend lib/api | ✓ |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend supabase-js | ✓ |
| `NEXT_PUBLIC_LEMON_*_VARIANT_ID` | Frontend checkout | ✓ |

---

## 17. Glosario

- **Plan efectivo**: plan real tras aplicar `ProOverride` + vencimiento prueba. Calculado en `/api/usuario/me`.
- **Soft cap**: umbral no-bloqueante en Pro a 250 IA/mes → banner de aviso frontend.
- **Retenida**: respuesta que Claude se niega a generar por filtro de seguridad (6 categorías). `Retenida=true` + `MotivoRetencion` en BD. Banner ⚠️ en dashboard.
- **Tono generado**: `"Profesional" | "Cercano" | "Directo" | "google" | null`. `"google"` = respuesta existente en Google, no generada por Velacre.
- **Mini-radar**: flujo B2B admin-only para prospección. No persiste. Input: place_id + nombre.
- **Welcome/Goodbye transition**: overlay de 6 fases con sessionStorage flags TTL 10s para el "rito de paso" entre paleta marketing (crema) y producto (navy).

---

## 18. Decisiones arquitectónicas relevantes

- **Paleta dual scoped**: tokens editoriales crema (`--ink`, `--paper`, `--accent`, etc.) viven scoped en `.vel-lp` (landing.css). La paleta de la app se propaga via remapeo de tokens Tailwind en `@theme inline` de `globals.css` (`--color-slate-950 = #0A0E1A`, etc.). Evolución independiente landing vs app. Tailwind v4 recompila utilidades atómicas con los nuevos valores; opacidades (`/50`, `/40`) siguen funcionando vía cálculo rgba.
- **Fade-in sin framer-motion**: `FadeInUp` y observer global en `LandingPage.tsx` usan IntersectionObserver + inline styles. Elimina bundle de framer salvo residuos.
- **Swipe móvil vanilla**: `onTouchStart` + `onTouchEnd` con delta > 48px. `touch-action: pan-y` declara al navegador que capturamos horizontales y dejamos scroll vertical nativo.
- **bfcache handling**: `useOAuthLoading` escucha `pageshow` con `event.persisted=true` + `visibilitychange` para resetear estado de botón Google OAuth al volver del back del browser.
- **Shorthand CSS prohibido junto a `.wrap`**: regla interna — en cualquier clase que comparta elemento con `.wrap` (padding/margin horizontales), NUNCA usar `padding` o `margin` shorthand, solo `padding-top/bottom` y `margin-top/bottom` explícitos. Causó 2 bugs independientes con padding editorial pisando gutters.
- **Módulos UI del dashboard dentro de la landing**: sec 01/02/03 envueltas en `<div className="dark">` con JSX copiado de ReviewList + DetailPanel + KPIs + AI cards con datos dummy. No mockups — el prospect ve lo que verá como usuario Pro.
- **`createBrowserClient` (@supabase/ssr)** tiene `detectSessionInUrl:true` por defecto: consume automáticamente el code PKCE en `/auth/callback`. El handler de callback primero comprueba si ya hay sesión; `exchangeCodeForSession` queda como fallback.
- **Hard reload en logout/delete**: `window.location.href='/'` en vez de `router.replace` para forzar remount completo del árbol React y limpiar todo state cliente. Combina con `armGoodbye` + anti-flash pre-paint.

---
