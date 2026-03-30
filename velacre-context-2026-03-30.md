# Velacre — Contexto del proyecto
**Fecha:** 30 de marzo de 2026

---

## ¿Qué es Velacre?

SaaS B2B para negocios de hostelería en Galicia (España). Permite gestionar y responder reseñas de Google de forma automatizada con IA. Objetivo de negocio: 25.000 €/año en 2026.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Backend | .NET 9 Web API (C#) — puerto 5146 |
| Frontend | Next.js 16 + React 19 (TypeScript) — puerto 3000 |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth — JWT ES256 |
| IA | Claude API (`claude-sonnet-4-6`) via Anthropic SDK v5.10.0 |
| Pagos | Lemon Squeezy (COMING SOON — botones desactivados hasta alta autónomo) |
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
| respuestas_ia_mes | int | contador IA, límite 10/mes core |
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

### `review`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| codigo | string | BFK + 7 chars |
| idnegocio | UUID | FK → negocio |
| clientereview | string | texto reseña del cliente |
| respuestaprofesional, respuestacolegueo, respuestaorgullosa | string | 3 tonos generados |
| tono_generado | string | tono usado / `google` si respuesta original Google |
| google_review_id | string | ID único de Google |
| author_name | string | |
| star_rating | int | 1-5 |
| review_date | timestamptz | fecha reseña Google |
| review_language | string | código ISO: es, en, gl... |
| estado | string | `pendiente` / `respondida` / `ignorada` |
| plataforma | string | `Google`, etc. |

### `analisis_ia`
| Campo | Tipo |
|-------|------|
| negocio_id | UUID |
| brilla | string |
| quema | string |
| accion | string |
| review_count | int |
| created_at | timestamptz |

---

## Endpoints backend (`/api/...`)

### `/api/usuario`
- `GET /me` — perfil + plan efectivo (pro_override incluido)
- `POST /` — crear perfil (onboarding)
- `PUT /me` — actualizar nombre/teléfono
- `DELETE /me` — eliminar cuenta (cancela LS + anonimiza + elimina auth.users)

### `/api/negocio`
- `GET /me`, `POST /`, `PUT /me`

### `/api/review`
- `POST /generate` — manual: 3 tonos, límite 3/mes basic
- `GET /all` — todas las reseñas (ordenadas por fecha desc)
- `GET /pending` — reseñas sin respuesta
- `POST /{id}/generate` — IA: límite 10/mes core
- `PUT /{id}/estado` — pendiente/respondida/ignorada
- `POST /{id}/translate`, `POST /{id}/translate-response`
- `GET /metrics`, `GET /analysis`, `POST /analysis`

### `/api/places`
- `GET /search?q=` — buscar en Google Places
- `POST /sync` — sync reseñas (inicial: 60, incremental: 500)
  - Si reseña tiene `owner_answer` → `estado=respondida`, `tono_generado=google`
  - Sync incremental actualiza reseñas existentes que ahora tienen owner_answer

### `/api/lemonsqueezy`
- `GET /checkout?plan=core|pro&billing=monthly|yearly`
- `POST /cancelar`
- `POST /webhook` (sin auth, firma HMAC-SHA256)

### `/api/notify`
- `POST /waitlist` — envía email a info@velacre.com cuando usuario quiere Core/Pro

### `/api/admin` (solo admin)
- CRUD estado, plan, rol, pro-override, notas, place_id

---

## Sistema de planes y límites

| Plan | Precio | Respuestas manuales/mes | Respuestas IA/mes | Panel Salud | Reseñas visibles |
|------|--------|------------------------|-------------------|-------------|-----------------|
| Basic | Gratis | 3 | 3 | Teaser (solo nota media real) | 10 últimas |
| Core | 19,90€/mes · 190€/año | 3 | 10 | Completo | 60 |
| Pro | 29,90€/mes · 290€/año | Ilimitadas | Ilimitadas | Completo | 60 |

> **Estado pagos (2026-03-30):** Core y Pro muestran botón "Únete a la lista de espera" — envía email a info@velacre.com. No se procesa ningún pago hasta alta como autónomo. Se activan cuando haya 10-15 usuarios interesados.

---

## Flujo de usuario

```
Registro (Google OAuth o email)
  ↓ auth/callback → crea usuario en BD → email bienvenida
  ↓ /onboarding
    Step 1: datos negocio + tono
    Step 2: buscar Google Place
    Step 3: sync inicial (60 reseñas)
  ↓ /dashboard
    - Ver reseñas (últimas 10 si basic, 60 si core/pro)
    - Generar respuesta IA por reseña
    - Generador manual (para otras plataformas)
    - Sync incremental
  ↓ /dashboard/salud (core/pro)
    - Métricas, keywords, análisis IA
    - PDFs descargables (mes/ejercicio)
  ↓ /settings
    - Perfil, tono, Google conectado
    - Plan (basic: lista espera; core/pro: gestión LS)
    - Danger zone (cancelar, eliminar cuenta)
```

---

## Tonos de respuesta

- **Profesional** — formal, corporativo
- **Cercano** — amigable, cercano al cliente
- **Directo** — conciso, al grano

El idioma de respuesta es el mismo que el de la reseña (Claude detecta y responde en inglés si la reseña es en inglés, etc.).

---

## Lemon Squeezy — configuración

Variables de entorno backend:
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

Eventos webhook manejados: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`, `subscription_paused`.

Solo `subscription_expired` baja el plan a basic. `subscription_cancelled` mantiene el plan hasta `ls_ends_at`.

---

## Multiidioma

Locales: `es` (español), `en` (inglés), `gal` (gallego).
Rutas: `/es`, `/en`, `/gal` para la landing pública.
Dentro de la app: selector de idioma funcional pero oculto en la UI (sin LangSwitcher visible).

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
CORS_EXTRA_ORIGIN=  (preview Vercel)
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
    ReviewController.cs    — generación IA, límites por plan
    PlacesController.cs    — sync Google (Outscraper)
    NegocioController.cs   — CRUD negocio
    UsuarioController.cs   — perfil, eliminación cuenta
    LemonController.cs     — pagos, webhooks
    AdminController.cs     — panel administración
    NotifyController.cs    — lista de espera waitlist
  Services/
    ClaudeService.cs       — llamadas a Claude API
    OutscraperService.cs   — scraping reseñas Google
    GooglePlacesService.cs — búsqueda de lugares
    EmailService.cs        — Resend (bienvenida, waitlist)
  Models/Entities/         — entidades Supabase/Postgrest

frontend/src/
  app/
    dashboard/page.tsx     — panel principal reseñas
    dashboard/salud/       — analytics y health
    settings/page.tsx      — configuración y planes
    onboarding/            — flujo setup inicial
    admin/page.tsx         — panel admin
  components/
    LandingPage.tsx        — landing pública
    SectionNav.tsx         — nav entre secciones app
    WaitlistModal.tsx      — modal lista espera Core/Pro
  lib/
    api.ts                 — cliente REST al backend
    supabase.ts            — cliente Supabase Auth
    i18n.tsx               — contexto multiidioma
    report-pdf.ts          — generación PDFs (jsPDF)
  locales/
    es.ts, en.ts, gal.ts   — traducciones
    types.ts               — tipos TypeScript locales
```

---

## Decisiones de diseño relevantes

- **No usar `null` con Postgrest `.Set()`** — usar string vacía `""` en su lugar
- **Eliminar cuenta:** anonimiza `usuario` (historial de facturación), borra `review`/`negocio`, llama `DELETE /auth/v1/admin/users/{id}` con service role key
- **LangSwitcher:** lógica intacta pero oculto en toda la UI (rutas por idioma siguen funcionando)
- **Plan effectivo:** `GetMe` computa `effectivePlan = pro_override && !expired ? "pro" : usuario.plan`
- **Sync incremental:** detecta reseñas que el propietario respondió en Google desde el último sync y las actualiza en BD
- **Panel salud:** solo visible para core y pro. Basic ve teaser con nota media real + blur con datos dummy + upsell waitlist
- **Pagos desactivados:** Core/Pro muestran "Únete a la lista de espera" → email a info@velacre.com
