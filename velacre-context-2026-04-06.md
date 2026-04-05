# Velacre — Contexto del proyecto
**Fecha:** 6 de abril de 2026

---

## ¿Qué es Velacre?

SaaS B2B para negocios de hostelería en Galicia (España). Permite gestionar y responder reseñas de Google de forma automatizada con IA. Objetivo de negocio: empezar a facturar en 2026 para no depender de un empleador.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Backend | .NET 9 Web API (C#) — puerto 5146 |
| Frontend | Next.js 16 + React 19 (TypeScript) — puerto 3000 |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth — JWT ES256 |
| IA | Claude API (`claude-sonnet-4-6`) via Anthropic SDK v5.10.0 |
| Pagos | Lemon Squeezy — checkout implementado, tienda pendiente activación (alta autónomo) |
| Scraping reseñas | Outscraper API v3 |
| Email | Resend (`hola@velacre.com`) |
| Deploy | Railway (backend) + Vercel (frontend) |

---

## Modelos de base de datos

### `usuario`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK, igual que auth.users |
| nombre, email, telefono | string | |
| plan | string | `basic` / `core` / `pro` |
| estado | string | `activo` / `baneado` / `prueba` |
| prueba_hasta | timestamptz | para estado prueba |
| rol | string | `cliente` / `admin` / `sales` |
| respuestas_manuales_mes | int | contador básico, límite 3/mes |
| respuestas_mes_reset | timestamptz | reset mensual manual |
| respuestas_ia_mes | int | contador IA |
| respuestas_ia_mes_reset | timestamptz | reset mensual IA |
| pro_override | bool | override admin → plan pro temporal |
| pro_override_hasta | timestamptz | expiración del override |
| ls_customer_portal | string | URL portal Lemon Squeezy |
| ls_subscription_id | string | ID suscripción LS |
| ls_status | string | `active`/`cancelled`/`paused`/`past_due`/`expired` |
| ls_renews_at | timestamptz | próxima renovación |
| ls_ends_at | timestamptz | fecha fin acceso (si cancelado) |
| notas_admin | string | internas, solo admin |

### `negocio`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| codigo | string | NEG + 7 chars |
| nombre, email, telefono, descripcion | string | |
| tonopredefinido | string | `Profesional` / `Cercano` / `Directo` |
| place_id | string | Google Place ID, bloqueado tras setup |
| idusuario | UUID | FK → usuario |
| palabras_clave | text[] | hasta 5 keywords SEO para incluir en respuestas |

### `review`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| codigo | string | BFK + 7 chars |
| idnegocio | UUID | FK → negocio |
| clientereview | string | texto reseña del cliente |
| respuestaprofesional, respuestacercano, respuestadirecta | string | 3 tonos generados |
| tono_generado | string | tono usado / `google` si respuesta original Google |
| google_review_id | string | ID único de Google |
| author_name | string | |
| star_rating | int | 1-5 |
| review_date | timestamptz | fecha reseña Google |
| review_language | string | código ISO: es, en, gl... |
| estado | string | `pendiente` / `respondida` / `ignorada` |
| plataforma | string | `Google`, etc. |
| keywords_usadas | text[] | keywords del negocio que la IA incluyó |
| respondida_fecha | timestamptz | timestamp cuando se marcó como respondida |
| retenida | bool | `true` si Claude detectó contenido crítico |
| motivo_retencion | string | `intoxicacion` / `maltrato` / `amenaza_legal` / `datos_personales` |

### `analisis_ia`
| Campo | Tipo |
|-------|------|
| negocio_id | UUID |
| brilla | string |
| quema | string |
| accion | string |
| review_count | int |
| created_at | timestamptz |

### `competidor` *(nuevo 2026-04-05)*
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| negocio_id | UUID | FK → negocio ON DELETE CASCADE |
| place_id | string | Google Place ID del competidor |
| nombre | string | |
| created_at | timestamptz | |

### `radar_analisis` *(nuevo 2026-04-05)*
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| negocio_id | UUID | FK → negocio ON DELETE CASCADE |
| resultado_json | text | JSON con el análisis comparativo |
| created_at | timestamptz | |

### Historial de migraciones ejecutadas en Supabase
```sql
-- 2026-04-01
ALTER TABLE negocio ADD COLUMN IF NOT EXISTS palabras_clave text[] DEFAULT '{}';
ALTER TABLE review   ADD COLUMN IF NOT EXISTS keywords_usadas text[] DEFAULT '{}';

-- 2026-04-03
ALTER TABLE review ADD COLUMN IF NOT EXISTS respondida_fecha timestamptz;

-- 2026-04-05
ALTER TABLE review ADD COLUMN IF NOT EXISTS retenida BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE review ADD COLUMN IF NOT EXISTS motivo_retencion TEXT;

CREATE TABLE IF NOT EXISTS competidor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocio(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS radar_analisis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocio(id) ON DELETE CASCADE,
  resultado_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### RPC atómica para contador IA
```sql
CREATE OR REPLACE FUNCTION try_increment_ia_counter(p_user_id uuid, p_limit int)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_count int; v_reset timestamptz;
BEGIN
  SELECT respuestas_ia_mes, respuestas_ia_mes_reset INTO v_count, v_reset
  FROM usuario WHERE id = p_user_id FOR UPDATE;
  IF v_reset IS NULL OR NOW() > v_reset + INTERVAL '1 month' THEN
    UPDATE usuario SET respuestas_ia_mes = 1, respuestas_ia_mes_reset = NOW() WHERE id = p_user_id;
    RETURN TRUE;
  END IF;
  IF p_limit >= 0 AND v_count >= p_limit THEN RETURN FALSE; END IF;
  UPDATE usuario SET respuestas_ia_mes = v_count + 1 WHERE id = p_user_id;
  RETURN TRUE;
END; $$;
```

---

## Endpoints backend (`/api/...`)

### `/api/usuario`
- `GET /me` — perfil + plan efectivo (pro_override incluido)
- `POST /` — crear perfil (onboarding)
- `PUT /me` — actualizar nombre/teléfono
- `DELETE /me` — eliminar cuenta (cancela LS + anonimiza + elimina auth.users)

### `/api/negocio`
- `GET /me`, `POST /`, `PUT /me`
- Acepta `palabrasClave: string[]` en POST y PUT

### `/api/review`
- `POST /generate` — manual: 3 tonos, límite 3/mes basic
- `GET /all` — todas las reseñas (ordenadas por fecha desc), incluye `respondidaFecha`, `retenida`, `motivoRetencion`
- `GET /pending` — reseñas sin respuesta
- `POST /{id}/generate` — IA: límite atómico por plan (RPC). Detecta contenido crítico en misma llamada Claude.
  - Si `retenida=true`: guarda en BD, rollback del contador IA, devuelve `{ retenida: true, motivoRetencion }`
  - Si normal: guarda respuesta, devuelve `{ retenida: false, response }`
  - Guarda `keywords_usadas` en `review`
  - **Fallback keywords:** si negocio no tiene `palabras_clave`, usa top 6 `keywords_usadas` de reseñas previas; si no hay, usa nombre del negocio
- `PUT /{id}/estado` — pendiente/respondida/ignorada
  - Al marcar `respondida`: setea `respondida_fecha = UtcNow` (solo si null)
  - Al revertir: limpia `respondida_fecha`
- `POST /{id}/translate`, `POST /{id}/translate-response`
- `GET /metrics` — incluye `topKeywordsUsadas` (top 6) y `responseRate`
- `GET /analysis`, `POST /analysis`

### `/api/places`
- `GET /search?q=` — buscar en Google Places
- `POST /sync` — sync reseñas (inicial: 60, incremental: 500)
  - Si reseña tiene `owner_answer` → `estado=respondida`, `tono_generado=google`
  - Sync incremental actualiza reseñas que el propietario respondió en Google

### `/api/radar` *(nuevo 2026-04-05 — solo Pro)*
- `GET /` — devuelve `{ competidores[], ultimoAnalisis }` del negocio
- `POST /competidores` — añade competidor `{ placeId, nombre }` (máx 3, sin duplicados)
- `DELETE /competidores/{id}` — elimina competidor
- `POST /analizar` — lanza análisis:
  1. Carga últimas 30 reseñas propias de BD (gratis)
  2. Outscraper: 20 reseñas de cada competidor (~€0.02/llamada)
  3. Claude genera JSON con tuFortaleza, tuDebilidad, competidores[], oportunidades[], accion
  4. Reemplaza análisis anterior en `radar_analisis`
  - **Límite:** 1 análisis por mes natural (devuelve 429 `ya_analizado_este_mes` si ya existe)

### `/api/lemonsqueezy`
- `GET /checkout?plan=core|pro&billing=monthly|yearly` — crea sesión LS, devuelve URL
- `POST /cancelar` — cancela suscripción activa via LS API, actualiza `ls_status=cancelled`
- `POST /webhook` (sin auth, firma HMAC-SHA256) — gestiona eventos de suscripción:
  - `subscription_created/resumed` → activa plan, email confirmación
  - `subscription_updated` → actualiza plan/estado
  - `subscription_cancelled` → mantiene plan hasta `ls_ends_at`, email cancelación
  - `subscription_expired/paused` → baja a basic, email expiración
  - Todos los eventos guardan `ls_customer_portal`, `ls_subscription_id`, `ls_renews_at`, `ls_ends_at`

### `/api/notify`
- `POST /waitlist` — envía email a `infovelacre@gmail.com`

### `/api/admin` (solo admin)
- CRUD estado, plan, rol, pro-override, notas, place_id

### `/api/google` *(implementado, deshabilitado en frontend)*
- OAuth flow completo con Google Business Profile
- `GET /auth-url`, `GET /callback`, `GET /locations`, `POST /finalize`, `DELETE /disconnect`

---

## Sistema de planes y límites

| Plan | Precio mensual | Precio anual | Respuestas manuales/mes | Respuestas IA/mes | Panel Salud | Radar |
|------|---------------|-------------|------------------------|-------------------|-------------|-------|
| Basic | Gratis | — | 3 | 3 | Teaser (nota media real + blur) | ❌ |
| Core | €19/mes | €190/año | 3 | **18** | Completo | ❌ |
| Pro | **€45/mes** | **€449/año** | Ilimitadas | Ilimitadas | Completo + análisis IA + Radar | ✅ |

> **Fórmula anual:** ~10 meses × precio mensual.
> **Estado pagos:** Checkout LS implementado y funcional (modo test). Tienda sin activar hasta alta como autónomo — cuando se active, los pagos en producción se procesarán automáticamente con IVA correcto (LS como Merchant of Record).

### Estrategia post-integración Google Business Profile (pendiente)

| Plan | GBP importar | GBP auto-publicar | Precio mensual | Precio anual |
|------|-------------|-------------------|---------------|-------------|
| Basic | ✅ | ❌ (copy-paste manual) | Gratis | — |
| Core | ✅ | ✅ | €29/mes | €290/año |
| Pro | ✅ | ✅ + Radar | €69/mes | €690/año |

---

## Lemon Squeezy — flujo completo (2026-04-06)

**Checkout:** `GET /api/lemonsqueezy/checkout?plan=core|pro&billing=monthly|yearly` → URL LS → `window.location.href`. `redirect_url` anidado en `product_options` (no en atributos raíz).

**Gestión suscripción:** desde settings → enlace `ls_customer_portal` (URL que llega vía webhook) → portal LS para cancelar, cambiar plan o actualizar pago. No hay modal de cancelación propio.

**Emails transaccionales (vía Resend):**
- `subscription_created` → "¡Ya tienes el plan X!" con acceso y próxima renovación
- `subscription_cancelled` → con fecha de acceso hasta `ls_ends_at`
- `subscription_expired` → con CTA para reactivar

**Variables de entorno:**
```
LEMONSQUEEZY_STORE_ID
LEMONSQUEEZY_VARIANT_ID_CORE_MONTHLY
LEMONSQUEEZY_VARIANT_ID_CORE_YEARLY
LEMONSQUEEZY_VARIANT_ID_PRO_MONTHLY
LEMONSQUEEZY_VARIANT_ID_PRO_YEARLY
LEMONSQUEEZY_API_KEY
LEMON_VELACRE_API
LEMONSQUEEZY_WEBHOOK_SECRET
```

---

## Filtro de seguridad en reseñas (2026-04-05)

Claude detecta en la misma llamada de generación (sin coste extra) si la reseña describe:
1. **intoxicacion** — intoxicación alimentaria real o enfermedad grave
2. **maltrato** — acusaciones de agresión física, malos tratos o acoso grave
3. **amenaza_legal** — amenaza explícita de denuncia judicial o demanda
4. **datos_personales** — datos personales sensibles (nombre + datos médicos/bancarios)

Si detecta alguno: `retenida=true`, `motivoRetencion=<código>`, no se genera respuesta, se hace rollback del contador IA.

En el dashboard: badge ⚠ "Revisión" naranja en la card de la reseña. En el detail panel: banner de aviso naranja con el motivo. Los botones de generar/publicar están deshabilitados para reseñas retenidas.

---

## Radar de Competencia (2026-04-05 — Pro)

Feature visible en `/dashboard/salud` al final del bloque Pro.

**Flujo:**
1. Usuario añade hasta 3 competidores buscando por nombre (Google Places API)
2. Pulsa "Analizar ahora" — límite 1 vez/mes
3. Loading animado con pasos: reseñas propias → consulta por competidor → IA → informe
4. Claude devuelve JSON: `tuFortaleza`, `tuDebilidad`, `competidores[{nombre, fortaleza, debilidad, amenaza}]`, `oportunidades[]`, `accion`
5. Se muestra: cards fortaleza/debilidad propias, tabla competidores con badge amenaza (alta/media/baja), lista oportunidades, acción concreta de la semana
6. Al mes siguiente se habilita el botón "Re-analizar"

**Coste por análisis:** ~€0.02–0.06 Outscraper + fracción de céntimo Claude (MaxTokens: 1800).

---

## Google Business Profile — Estado (2026-04-05)

**Implementado en backend pero deshabilitado en frontend con badge "Próximamente":**

- Backend completo: OAuth flow, `GoogleController`, `GoogleBusinessService`, `google_connection` table, `PublishGoogleModal`
- **Dashboard:** botón "Publicar en Google" deshabilitado (opacity-50, no-clickable) + botón "Responder en Google" activo que abre `business.google.com/reviews` para copy-paste manual
- **Settings:** sección Google Business con `pointer-events-none opacity-40` + badge Próximamente
- **Onboarding:** opción Google Business como `div` no-clickable con badge Próximamente

**Bloqueante:** Google requiere aprobación de "Application for Basic API Access" (form enviado). Plazo: 7-10 días hábiles. Proyecto GCloud: `project-72316eb2-58d3-4784-b66`, número `770493491631`.

---

## Flujo de usuario

```
Registro (Google OAuth o email)
  ↓ auth/callback → crea usuario en BD → email bienvenida
  ↓ /onboarding
    Step 1: datos negocio + tono + hasta 5 palabras clave SEO
    Step 2: buscar Google Place (manual, Outscraper) — GBP deshabilitado (Próximamente)
    Step 3: sync inicial (60 reseñas)
  ↓ /onboarding/plan
    - Elegir Core/Pro con checkout real LS, o continuar gratis (Basic)
  ↓ /dashboard
    - Ver reseñas (últimas 10 si basic, 60 si core/pro)
    - Badge ⚠ en reseñas retenidas por seguridad
    - Generar respuesta IA por reseña (contador atómico)
    - Botón "Responder en Google" → abre GBP manual (copy-paste)
    - Generador manual (para otras plataformas)
    - Sync incremental
    - Mobile: master-detail (lista oculta al seleccionar, botón "← Volver" sticky)
  ↓ /dashboard/salud (core/pro)
    - Métricas, keywords, análisis IA
    - Radar de Competencia (solo Pro) — 3 competidores, 1 análisis/mes
    - PDFs descargables (mes/ejercicio)
  ↓ /settings
    - Perfil, tono, palabras clave SEO
    - Google Business: deshabilitado con badge Próximamente
    - Plan basic: botones con checkout real Core/Pro
    - Plan core/pro: estado suscripción + upsell Pro (si Core) + enlace portal LS (gestión/cancelación)
    - Danger zone: enlace portal LS (si suscripción activa) + eliminar cuenta
```

---

## Tonos de respuesta

- **Profesional** — formal, corporativo
- **Cercano** — amigable, cercano al cliente
- **Directo** — conciso, al grano

El idioma de respuesta es el mismo que el de la reseña. Keywords SEO se incluyen con naturalidad (Claude decide cuáles encajan).

---

## Comportamiento reseñas respondidas en dashboard

- `tono_generado === 'google'` → "Respondida directamente en Google. Reabre para generar una con Velacre."
- `tono_generado` (valor no-google) → botón **"Cargar respuesta"** (sin llamada API)
- `retenida === true` → badge ⚠ naranja, banner en panel, sin botones de acción
- sin `tono_generado` → botón **"Generar respuesta IA"** normal

---

## ClaudeService — comportamiento actual

- `GenerateSingleResponseWithContextAsync` — respuesta + filtro seguridad en una sola llamada. JSON: `{ respuesta, contextoCliente, contextoRespuesta, keywordsUsadas, retenida, motivoRetencion }`. MaxTokens: 500.
- `GenerateRadarAnalysisAsync` — análisis comparativo reputación. MaxTokens: 1800. JSON: `{ tuFortaleza, tuDebilidad, competidores[], oportunidades[], accion }`.
- `GetClaudeMessageAsync` — análisis IA salud (brilla/quema/acción). MaxTokens: 800.
- Retry automático (3 intentos, backoff exponencial) para `overloaded_error`.
- Modelo configurable via `AI_MODEL` env var (default: `claude-sonnet-4-6`).

---

## SectionNav

- Pill flotante centrado: `sticky top-14 z-40 flex justify-center py-3`
- Fondo: `bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-full`
- 3 tabs con iconos SVG + labels (labels ocultos en mobile)
- Tab activo: `bg-white text-slate-900 shadow-sm`; inactivo: `text-slate-400 hover:text-white`

---

## Modo oscuro

- **Siempre dark**, independiente del sistema del usuario
- `layout.tsx` tiene `<html className="dark">` hardcodeado
- `globals.css` usa `@variant dark (&:where(.dark, .dark *))` (Tailwind v4)
- Fondo: `#0f172a`, texto: `#f1f5f9`, acento: **blue**

---

## Panel Salud — widgets

| Widget | Plan | Notas |
|--------|------|-------|
| Nota media, distribución sentimiento, keywords | Core/Pro | |
| Impacto Velacre (% respondidas, tiempo ahorrado, SEO) | Core/Pro | |
| Velocidad de respuesta | Core/Pro | Requiere `respondida_fecha` en BD |
| Análisis IA (brilla/quema/acción) | Pro | Llamada Claude bajo demanda, límite 3/día |
| Evolución mensual (tabla + drift) | Core/Pro | |
| **Radar de Competencia** | **Pro** | Hasta 3 competidores, 1 análisis/mes |

---

## PDF mensual — contenido

1. Cabecera: nombre negocio, teléfono, email
2. 6 KPIs en 2 filas: nota media · total reseñas · sin respuesta / positivas% · negativas% · respondidas%
3. Velocidad de respuesta: media, %<48h, %<24h + barra de distribución + benchmark Google 48h
4. Distribución 1★–5★ con comparativa vs mes anterior
5. Comparativa mes actual vs anterior (tabla 5 filas)
6. Evolución mes a mes en el año
7. Palabras clave y menciones (SEO del negocio + mencionadas positivas/negativas/neutras)
8. Diagnóstico IA: brilla / quema / acción recomendada

> **Nota:** `safe()` en jsPDF solo elimina caracteres fuera de WinAnsi. Tildes españolas (á, é, í, ó, ú, ñ) están dentro del rango `\xA0-\xFF` y se renderizan correctamente.

---

## Panel Admin

- Header: "Velacre · Admin" (sin enlace a dashboard)
- CRUD estado, plan, rol, pro_override, notas, place_id
- Errores en modales con fondo rojo, hint sesión caducada si 401/403

---

## Landing page

- Sección precios: "Planes"
- Copy ES con enfoque FOMO/acceso anticipado
- Solo locale ES activo en copy (en/gal mantenidos en código)

---

## Páginas legales

- `/privacidad`, `/terminos`, `/contacto` — dark normalizado (slate-950/900/800)
- Sin datos personales sensibles (solo "Manuel Llao Freire, A Coruña, Galicia, España")
- Jurisdicción: A Coruña

---

## Variables de entorno

### Backend (`/backend/.env`)
```
ANTHROPIC_API_KEY=
AI_MODEL=claude-sonnet-4-6
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ADMIN_USER_ID=
GOOGLE_PLACES_API_KEY=
OUTSCRAPER_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_VARIANT_ID_CORE_MONTHLY=
LEMONSQUEEZY_VARIANT_ID_CORE_YEARLY=
LEMONSQUEEZY_VARIANT_ID_PRO_MONTHLY=
LEMONSQUEEZY_VARIANT_ID_PRO_YEARLY=
LEMONSQUEEZY_API_KEY=
LEMON_VELACRE_API=
LEMONSQUEEZY_WEBHOOK_SECRET=
RESEND_API_KEY=
RESEND_FROM=Velacre <hola@velacre.com>
CORS_EXTRA_ORIGIN=   # preview Vercel
FRONTEND_URL=https://www.velacre.com
GOOGLE_CLIENT_ID=    # para GBP OAuth (pendiente activación)
GOOGLE_CLIENT_SECRET=
```

### Frontend (`/frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:5146
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Estructura de archivos clave

```
backend/
  Controllers/
    ReviewController.cs     — generación IA, filtro seguridad, límites atómicos,
                              keywords fallback, respondida_fecha
    RadarController.cs      — GET/POST/DELETE competidores, POST analizar (1/mes)
    PlacesController.cs     — sync Google (Outscraper)
    NegocioController.cs    — CRUD negocio (palabras_clave)
    UsuarioController.cs    — perfil, eliminación cuenta
    LemonController.cs      — checkout, webhooks, emails transaccionales suscripción
    AdminController.cs      — panel administración
    NotifyController.cs     — waitlist (→ infovelacre@gmail.com)
    GoogleController.cs     — GBP OAuth (implementado, pendiente activación)
  Services/
    ClaudeService.cs        — respuesta IA + filtro seguridad + radar analysis,
                              retry backoff, MaxTokens optimizados
    OutscraperService.cs    — sync reseñas + GetCompetitorReviewsAsync
    GooglePlacesService.cs  — búsqueda lugares
    GoogleBusinessService.cs — GBP OAuth + locations (pendiente activación)
    EmailService.cs         — Resend: bienvenida, subscription_confirmed,
                              subscription_cancelled, subscription_expired

frontend/src/
  app/
    dashboard/page.tsx      — panel reseñas (badge retenida, botón "Responder en Google"
                              copy-paste, GBP deshabilitado)
    dashboard/salud/page.tsx — analytics + Radar de Competencia (Pro, loading animado)
    settings/page.tsx       — config, planes con checkout LS, portal LS para gestión,
                              keywords SEO, GBP deshabilitado Próximamente
    onboarding/page.tsx     — setup inicial, GBP deshabilitado Próximamente
    onboarding/plan/page.tsx — elección plan con checkout LS real
    auth/callback/page.tsx  — bg-slate-950 (normalizado)
    admin/page.tsx          — panel admin
  components/
    LandingPage.tsx         — landing pública (copy FOMO, "Planes")
    SectionNav.tsx          — pill flotante centrado, 3 tabs con iconos
    WaitlistModal.tsx       — modal upsell Core/Pro con checkout LS (ya no es waitlist)
    PublishGoogleModal.tsx  — modal publicar en GBP (implementado, sin uso activo)
  lib/
    api.ts                  — PendingReview incluye retenida/motivoRetencion,
                              RadarData/RadarAnalisisResult/Competidor interfaces,
                              getRadar/addCompetidor/removeCompetidor/runRadarAnalysis,
                              getLemonCheckoutUrl
    report-pdf.ts           — PDFs mes/ejercicio: computeSpeedBenchmark, SpeedBenchmark,
                              todos los textos con tildes correctas
    i18n.tsx                — contexto multiidioma
    supabase.ts             — cliente Supabase Auth
```

---

## Decisiones de diseño relevantes

- **No usar `null` con Postgrest `.Set()`** — usar string vacía `""` en su lugar
- **Eliminar cuenta:** anonimiza `usuario`, borra `review`/`negocio`, llama `DELETE /auth/v1/admin/users/{id}`
- **Plan efectivo:** `GetMe` computa `effectivePlan = pro_override && !expired ? "pro" : usuario.plan`
- **Sync incremental:** detecta reseñas que el propietario respondió en Google desde el último sync
- **Panel salud:** solo core/pro. Basic ve teaser con nota media real + blur + upsell
- **Checkout LS:** `redirect_url` va dentro de `product_options`, no en atributos raíz
- **Gestión suscripción:** exclusivamente via portal LS (`ls_customer_portal`). Sin modal propio de cancelación.
- **Emails suscripción:** fire-and-forget (`_ = _email.SendXxx(...)`) en webhook LS
- **Contador IA atómico:** RPC PostgreSQL `try_increment_ia_counter` — check + increment en una operación SQL
- **Keywords SEO fallback:** si no hay `palabras_clave`, usa top 6 `keywords_usadas`; si ninguna, usa nombre negocio
- **Velocidad de respuesta:** `respondida_fecha` setea al marcar respondida (solo si null), limpia al revertir
- **Modo oscuro forzado:** siempre dark. `<html class="dark">` en layout
- **Acento blue** en toda la UI (cambiado de indigo)
- **Filtro seguridad reseñas:** misma llamada Claude, sin coste extra. Rollback contador IA si retenida.
- **Radar:** ParseAnalisisJson usa `RootElement.Clone()` para evitar JsonElement inválido tras dispose del JsonDocument
- **GBP deshabilitado:** todo el código está, solo la UI muestra "Próximamente". Fácil de activar cuando llegue la autorización de Google.
- **safe() en jsPDF:** solo elimina chars fuera de `\x20-\x7E\xA0-\xFF`. Las tildes españolas están dentro del rango y funcionan.

---

## Pendiente / Próximos pasos

### Activar Google Business Profile
- Autorización "Application for Basic API Access" enviada. Plazo: 7-10 días hábiles.
- Cuando llegue: quitar `opacity-50 pointer-events-none` de los tres sitios (onboarding, settings, dashboard) y eliminar badges "Próximamente".
- Revisar precios post-GBP: Core €29/mes, Pro €69/mes (incluyendo Radar como add-on integrado).

### Activar pagos
- Alta como autónomo → activar tienda Lemon Squeezy (payout/datos bancarios) → en producción los pagos se procesarán automáticamente con IVA correcto (LS como MoR).
- El checkout ya está implementado y probado en modo test.

### Backlog inmediato (antes o junto con GBP)

**Eliminación de reseñas (Pro):**
- Feature de alto valor percibido, coste mínimo de desarrollo.
- Flujo: usuario selecciona reseña → marca el motivo (spam, irrelevante, falsa, ofensiva...) → Claude genera el texto de reclamación exacto según políticas de Google → usuario copia y pega en el formulario oficial de Google.
- Velacre no elimina nada, Google decide. El valor es saber exactamente qué decir y dónde.
- Añadir a panel de reseña como botón "Solicitar eliminación" (Pro).

**Precios por ubicación (multi-local):**
- Si un negocio tiene 2+ locales, paga proporcionalmente (le ahorramos el doble de tiempo).
- Modelo: precio base primer local (ej. €45/mes Pro) + add-on por local adicional (ej. €20/mes).
- Implementación: quantity en Stripe/LS o add-on de "sede adicional".
- Gestión manual mientras no haya demanda validada (primeros clientes).
- ⚠️ **Al implementar esta feature, revisar y actualizar la tabla de planes de pago** (sistema de planes, precios, variantes LS) para reflejar el nuevo modelo de precios.

### Ideas futuras (post-GBP + tracción)
- **Marca blanca (Enterprise+):** agencias pueden ofrecer Velacre con su logo/colores a sus clientes. +100€/mes.
- **QR anti-reseñas negativas:** si 4-5★ → lleva a Google Maps; si 1-2★ → guarda nota interna sin publicar. Descartado para el corto plazo — implica cambio de paradigma de producto (diseño físico, logística, soporte, ventas distintas). Retomar cuando haya 50+ clientes de pago.
- **WhatsApp/Gmail semanal:** cron los lunes a las 10am con recuento semanal + respuesta ya preparada.
- **Métricas propias velocidad:** cuando haya usuarios reales, benchmark interno anónimo en vez del de Google (48h).
- **Auditoría FOMO** con casos de éxito cuando haya usuarios reales.
