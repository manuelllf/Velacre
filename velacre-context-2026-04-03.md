# Velacre — Contexto del proyecto
**Fecha:** 3 de abril de 2026

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
| keywords_usadas | text[] | palabras clave del negocio que la IA incluyó en la respuesta |
| respondida_fecha | timestamptz | timestamp en que el usuario marcó como respondida (benchmark velocidad) |

### `analisis_ia`
| Campo | Tipo |
|-------|------|
| negocio_id | UUID |
| brilla | string |
| quema | string |
| accion | string |
| review_count | int |
| created_at | timestamptz |

> **Migraciones ejecutadas (2026-04-01):**
> ```sql
> ALTER TABLE negocio ADD COLUMN IF NOT EXISTS palabras_clave text[] DEFAULT '{}';
> ALTER TABLE review   ADD COLUMN IF NOT EXISTS keywords_usadas text[] DEFAULT '{}';
> ```
> **Migración (2026-04-03):**
> ```sql
> ALTER TABLE review ADD COLUMN IF NOT EXISTS respondida_fecha timestamptz;
> ```
> **RPC atómica para contador IA (ejecutada manualmente en Supabase):**
> ```sql
> CREATE OR REPLACE FUNCTION try_increment_ia_counter(p_user_id uuid, p_limit int)
> RETURNS boolean LANGUAGE plpgsql AS $$
> DECLARE v_count int; v_reset timestamptz;
> BEGIN
>   SELECT respuestas_ia_mes, respuestas_ia_mes_reset INTO v_count, v_reset
>   FROM usuario WHERE id = p_user_id FOR UPDATE;
>   IF v_reset IS NULL OR NOW() > v_reset + INTERVAL '1 month' THEN
>     UPDATE usuario SET respuestas_ia_mes = 1, respuestas_ia_mes_reset = NOW() WHERE id = p_user_id;
>     RETURN TRUE;
>   END IF;
>   IF p_limit >= 0 AND v_count >= p_limit THEN RETURN FALSE; END IF;
>   UPDATE usuario SET respuestas_ia_mes = v_count + 1 WHERE id = p_user_id;
>   RETURN TRUE;
> END; $$;
> ```

---

## Endpoints backend (`/api/...`)

### `/api/usuario`
- `GET /me` — perfil + plan efectivo (pro_override incluido)
- `POST /` — crear perfil (onboarding)
- `PUT /me` — actualizar nombre/teléfono
- `DELETE /me` — eliminar cuenta (cancela LS + anonimiza + elimina auth.users)

### `/api/negocio`
- `GET /me`, `POST /`, `PUT /me`
- Acepta campo `palabrasClave: string[]` en POST y PUT

### `/api/review`
- `POST /generate` — manual: 3 tonos, límite 3/mes basic
- `GET /all` — todas las reseñas (ordenadas por fecha desc), incluye `respondidaFecha`
- `GET /pending` — reseñas sin respuesta
- `POST /{id}/generate` — IA: límite atómico por plan (RPC `try_increment_ia_counter`)
  - Guarda `keywords_usadas` en `review`
  - **Fallback keywords:** si el negocio no tiene `palabras_clave` configuradas, usa las top 6 `keywords_usadas` de sus reseñas previas; si no hay ninguna, usa el nombre del negocio
- `PUT /{id}/estado` — pendiente/respondida/ignorada
  - Al marcar `respondida`: setea `respondida_fecha = UtcNow` (solo si es null)
  - Al revertir a `pendiente`/`ignorada`: limpia `respondida_fecha`
- `POST /{id}/translate`, `POST /{id}/translate-response`
- `GET /metrics` — incluye `topKeywordsUsadas` (top 6 keywords) y `responseRate`
- `GET /analysis`, `POST /analysis`

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
- `POST /waitlist` — envía email a `infovelacre@gmail.com` (directo, sin relay Namecheap)

### `/api/admin` (solo admin)
- CRUD estado, plan, rol, pro-override, notas, place_id

---
 
## Sistema de planes y límites
 
| Plan | Precio mensual | Precio anual | Respuestas manuales/mes | Respuestas IA/mes | Panel Salud | Reseñas visibles |
|------|---------------|-------------|------------------------|-------------------|-------------|-----------------|
| Basic | Gratis | — | 3 | 3 | Teaser (nota media real + blur) | 10 últimas |
| Core | **€19/mes** | **€190/año** | 3 | 10 | Completo | 60 |
| Pro | **€45/mes** | **€450/año** | Ilimitadas | Ilimitadas | Completo + análisis IA | 60 |
 
> **Fórmula anual:** 10 meses × precio mensual ("2 meses gratis").
 
> **Estado pagos (2026-04-03):** Core y Pro muestran "Únete a la lista de espera" → email a info@velacre.com. No se procesa ningún pago hasta alta como autónomo.
 
### Estrategia post-integración Google Business Profile
 
Cuando se integre GBP (auto-publicar respuestas):
 
| Plan | GBP importar reseñas | GBP auto-publicar respuestas | Precio mensual | Precio anual |
|------|---------------------|------------------------------|---------------|-------------|
| Basic | ✅ Libre (read-only) | ❌ Manual (copy-paste) | Gratis | — |
| Core | ✅ | ✅ | €29/mes | €290/año |
| Pro | ✅ | ✅ | €69/mes | €690/año |
 
**Mecánica FOMO post-GBP:** Basic importa reseñas automáticamente (ve el valor), pero al publicar la respuesta ve: *"Respuesta lista. Para publicarla directamente en Google sin salir de aquí, activa Core."* — no es bloqueo, es upsell en momento de valor demostrado.

> **Estado pagos (2026-04-01):** Core y Pro muestran botón "Reservar acceso" — envía email a `infovelacre@gmail.com`. No se procesa ningún pago hasta alta como autónomo.
 
---

## Flujo de usuario

```
Registro (Google OAuth o email)
  ↓ auth/callback → crea usuario en BD → email bienvenida
  ↓ /onboarding
    Step 1: datos negocio + tono + hasta 5 palabras clave SEO
    Step 2: buscar Google Place
    Step 3: sync inicial (60 reseñas)
  ↓ /dashboard
    - Ver reseñas (últimas 10 si basic, 60 si core/pro)
    - Generar respuesta IA por reseña (contador atómico, sin race condition)
    - Generador manual (para otras plataformas)
    - Sync incremental
    - Mobile: master-detail (lista oculta al seleccionar, botón "← Volver" sticky)
    - Al mover reseña de filtro en móvil → deselecciona automáticamente (no pantalla vacía)
  ↓ /dashboard/salud (core/pro)
    - Métricas, keywords, análisis IA
    - Tarjeta Impacto Velacre: % respondidas, tiempo ahorrado, optimización SEO
    - Tarjeta Velocidad de respuesta: media días, %<48h, %<24h, barra distribución
    - PDFs descargables (mes/ejercicio)
  ↓ /settings
    - Perfil, tono, Google conectado
    - Palabras clave SEO (hasta 5)
    - Plan (basic: lista espera; core/pro: gestión LS)
    - Danger zone (cancelar, eliminar cuenta)
```

---

## Tonos de respuesta

- **Profesional** — formal, corporativo
- **Cercano** — amigable, cercano al cliente
- **Directo** — conciso, al grano

El idioma de respuesta es el mismo que el de la reseña (Claude detecta y responde en inglés si la reseña es en inglés, etc.).

Las palabras clave SEO se incluyen con naturalidad en las respuestas (no todas, no forzadas — la IA decide cuáles encajan según contexto).

---

## Comportamiento reseñas respondidas en dashboard

- `tono_generado === 'google'` → "Respondida directamente en Google. Reabre para generar una con Velacre."
- `tono_generado` (valor no-google) → botón **"Cargar respuesta"** (carga la respuesta guardada sin llamar a la API)
- sin `tono_generado` → "Sin respuesta generada. Reabre para generarla."
- reseña no respondida → botón **"Generar respuesta IA"** normal

---

## ClaudeService — optimizaciones (2026-04-01)

- Prompt simplificado (~5 líneas, sin repeticiones de idioma)
- `MaxTokens` reducido de 700 a 450
- Mensaje usuario acortado: `"Reseña: '{reviewText}'"` (antes más largo)
- Retry automático (3 intentos) con backoff exponencial para `overloaded_error` (1s → 2s → 4s)

---

## SectionNav

- Rediseñado como **pill flotante** centrado: `sticky top-14 z-40 flex justify-center py-3`
- Fondo: `bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-full`
- 3 tabs con iconos SVG + labels (labels ocultos en mobile, `hidden sm:inline`)
- Tab activo: `bg-white text-slate-900 shadow-sm`; inactivo: `text-slate-400 hover:text-white`

---

## Modo oscuro

- **Siempre dark**, independiente del sistema del usuario
- `layout.tsx` tiene `<html className="dark">` hardcodeado
- `globals.css` usa variante clase: `@variant dark (&:where(.dark, .dark *))` (Tailwind v4)
- Fondo: `#0f172a`, texto: `#f1f5f9`
- Acento: **blue** (cambiado de indigo globalmente en 2026-04-03)

---

## Panel Salud — widgets

| Widget | Plan | Notas |
|--------|------|-------|
| Nota media, distribución sentimiento, keywords | Core/Pro | |
| Impacto Velacre (% respondidas, tiempo ahorrado, SEO) | Core/Pro | |
| Velocidad de respuesta | Core/Pro | Requiere `respondida_fecha` en BD |
| Análisis IA (brilla/quema/acción) | Pro | Llamada Claude bajo demanda |
| Evolución mensual (tabla + drift) | Core/Pro | |

El widget de **Velocidad de respuesta** ocupa 2 columnas (`md:col-span-2`). Muestra:
- Media de días entre `review_date` y `respondida_fecha`
- % respondidas en <24h / <48h
- Barra de distribución verde/ámbar/rojo
- Solo visible cuando hay al menos 1 reseña con `respondida_fecha`

---

## PDF mensual — contenido (2026-04-03)

Secciones en orden:
1. **Cabecera**: nombre negocio, teléfono, email si disponibles
2. **6 KPIs en 2 filas**: nota media · total reseñas · sin respuesta / positivas% · negativas% · respondidas% (con conteos absolutos)
3. **Velocidad de respuesta**: media, %<48h, %<24h + barra de distribución + benchmark Google 48h
4. **Distribución 1★–5★**: barras horizontales con comparativa vs mes anterior
5. **Comparativa mes actual vs anterior**: tabla 5 filas
6. **Evolución mes a mes en el año**
7. **Palabras clave y mencionadas**: keywords SEO del negocio + menciones positivas/negativas/neutrales de clientes
8. **Diagnóstico IA**: brilla / quema / acción recomendada

---

## Panel Admin

- Header: "Velacre · Admin" (sin enlace a dashboard)
- Botón actualizar: protegido con try/catch/finally (no se queda girando si `load()` falla)
- Errores en modales: visibles con fondo rojo, hint de sesión caducada si error 401/403

---

## Landing page

- Sección de precios: **"Planes"** (era "Precios")
- Solo locale ES activo en copy (en/gal mantenidos en código pero no se actualiza el copy)
- Copy ES reescrito con enfoque FOMO/moneyshot (acceso anticipado, plazas limitadas)

---

## Páginas legales

- `/privacidad`, `/terminos`, `/contacto` — estilo dark normalizado (slate-950/900/800)
- Sin datos personales sensibles (solo "Manuel Llao Freire, A Coruña, Galicia, España")
- Jurisdicción: A Coruña

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
    ReviewController.cs    — generación IA, límites atómicos, keywords fallback,
                             respondida_fecha en SetEstado
    PlacesController.cs    — sync Google (Outscraper)
    NegocioController.cs   — CRUD negocio (incluye palabras_clave)
    UsuarioController.cs   — perfil, eliminación cuenta
    LemonController.cs     — pagos, webhooks
    AdminController.cs     — panel administración
    NotifyController.cs    — lista de espera waitlist (→ infovelacre@gmail.com)
  Services/
    ClaudeService.cs       — llamadas Claude API (prompt optimizado, retry backoff)
    OutscraperService.cs   — scraping reseñas Google
    GooglePlacesService.cs — búsqueda de lugares
    EmailService.cs        — Resend (bienvenida, waitlist directo a Gmail)
  Models/Entities/         — entidades Supabase/Postgrest

frontend/src/
  app/
    dashboard/page.tsx     — panel reseñas (mobile master-detail, sticky Volver,
                             deselección automática al mover entre filtros)
    dashboard/salud/       — analytics: Impacto Velacre, Velocidad de respuesta,
                             PDFs, análisis IA
    settings/page.tsx      — configuración, planes, palabras clave SEO
    onboarding/            — flujo setup inicial (incluye palabras clave)
    admin/page.tsx         — panel admin (try/catch/finally, errores visibles)
    privacidad/page.tsx    — política privacidad (dark normalizado)
    terminos/page.tsx      — términos y condiciones (dark normalizado)
    contacto/page.tsx      — contacto + FAQ (dark normalizado)
  components/
    LandingPage.tsx        — landing pública (copy FOMO, "Planes")
    SectionNav.tsx         — pill flotante centrado, 3 tabs con iconos
    WaitlistModal.tsx      — modal lista espera Core/Pro
  lib/
    api.ts                 — PendingReview incluye respondidaFecha
    supabase.ts            — cliente Supabase Auth
    i18n.tsx               — contexto multiidioma
    report-pdf.ts          — PDFs maximizados: computeSpeedBenchmark,
                             SpeedBenchmark, MonthlyPdfData ampliado
  locales/
    es.ts, en.ts, gal.ts   — traducciones
  app/globals.css          — @variant dark class-based (siempre dark)
```

---

## Decisiones de diseño relevantes

- **No usar `null` con Postgrest `.Set()`** — usar string vacía `""` en su lugar
- **Eliminar cuenta:** anonimiza `usuario` (historial de facturación), borra `review`/`negocio`, llama `DELETE /auth/v1/admin/users/{id}` con service role key
- **LangSwitcher:** lógica intacta pero oculto en toda la UI (rutas por idioma siguen funcionando)
- **Plan efectivo:** `GetMe` computa `effectivePlan = pro_override && !expired ? "pro" : usuario.plan`
- **Sync incremental:** detecta reseñas que el propietario respondió en Google desde el último sync y las actualiza en BD
- **Panel salud:** solo visible para core y pro. Basic ve teaser con nota media real + blur con datos dummy + upsell waitlist
- **Pagos desactivados:** Core/Pro muestran "Únete a la lista de espera" → email directo a `infovelacre@gmail.com`
- **Contador IA atómico:** RPC PostgreSQL `try_increment_ia_counter` — check + increment en una sola operación SQL para evitar race conditions
- **Keywords SEO fallback:** si negocio no tiene `palabras_clave`, usa top 6 `keywords_usadas` de sus reseñas previas; si ninguna, usa nombre del negocio
- **Velocidad de respuesta:** `respondida_fecha` se setea al marcar como "respondida" (solo si es null); se limpia al revertir. `computeSpeedBenchmark()` calcula media de días y distribución <24h/<48h/>48h
- **Modo oscuro forzado:** siempre dark. `<html class="dark">` en layout + variante clase en globals.css
- **Acento blue:** cambiado de indigo globalmente (2026-04-03)

---

## Pendiente / Próximos pasos

### Bugs / mejoras pequeñas
- Futuro POST GBP: para agencias: marca blanca (B2B2B): eliminamos rastro de velacre y en el onboarding el cliente sube su logo y elige su paleta de colores corporativos para mandar a sus clientes como si el software fuera suyo. Lo veo extremadamente lejano, pero sería un precio Enterprise+ a cuadrar personalmente no? +100 eur/mes.
- Futuro POST GBP: ADD-ON: Radar de competencia, le dejamos poner 3 locales competidores y cogemos con Outscraper una vez al mes sus reseñas para generar un analisis IA que le enseñaremos a nuestro cliente. Cron mensual actualizando reseñas y analsis? ADD-ON de 14,90 euros sumado a core/pro?
- Futuro POST GBP: ADD-ON DE PROPUESTA OFENSIVA: QR generado para los locales que sugieran a sus clientes la reseña, gestionado por nosotros (landing nuestra con un selector de estrellas, si es 4-5 le lleva a google y si es 1-2 crea una nota nuestra y no lo lleva a google, para publicarla tiene que buscarse la vida; si elige 3, decidir en qué bando meterla). Esto aumentaría el valor de la suscripción, hay que decidir cuanto, un 30/40% a la suscripción como add on de core/pro o nuevo plan?
- Futuro POST GBP: Posibilidad de eliminación de reseñas, si es muy mala le dejamos al usuario decidir eliminarla (Velacre cruza las políticas de spam de google y usa a claude para redactar el texto legal exacto y óptimo para que sea eliminada con mayor probabilidad de éxito). Esto aumenta valor, gemini dice 0% a la suscripción pero 50% al engagement. 
- Futuro POST GBP: Integración WhatsApp/Gmail que un día de la semana (lunes a las 10 am por ejemplo) mande un mensaje o email al usuario con el recuento semanal y un aviso de que la respuesta ya está preparada en caso de que no esté ya respondida (cron que mande el mail y llame a claude para generar la respuesta y guardarla). Esto aumenta valor, gemini dice 0% a la suscripción pero 50% al engagement.
- Si la reseña es extremadamente negativa o incluye situaciones reales que la IA desconoce (intoxicación, malos tratos, algo demasiado personal) deberíamos no dejar la republicación y sugerir algo tipo "Retenida por seguridad. Requiere tu revisión manual debido a la gravedad." y un email urgente con el aviso al usuario.
- Futuro: Ahora la métrica de velocidad de respuesta coge el benchmark, cuando tengamos usuarios reales deberíamos coger una métrica propia anónima (el problema que veo es que si todos tardan menos de dos días, no va a notar mejora ninguna porque va a estar en la media entre nuestros clientes).
- Actualizar precios en código
- Auditoría fomo cuando haya usuarios reales (para poner casos de éxito, clientes usándolas o conteo de reserva de plazas)
- Posibilidad de varios locales en modo PRO (hasta 3-5, pensando en cadenas para plan PRO)
- Darle una vuelta a que un local con 20/30 reseñas pague PRO y uno con más de 100 pague el mismo precio.

### Integración Google Business Profile (iteración grande)
Rediseño del onboarding step 2 con dos caminos **excluyentes** (nunca los dos, nunca ninguno):

```
Onboarding Step 2 — Conecta tu local
  ┌─────────────────────────────────────────┐
  │  [G] Conectar con Google Business       │  → OAuth + scope business.manage
  │      Acceso nativo, sin Outscraper      │    → muestra los locales del usuario
  │                                         │
  │  [🔍] Buscar manualmente                │  → text search Places API como ahora
  │       Introduce el nombre de tu local   │    → Outscraper para sync
  └─────────────────────────────────────────┘
```
- Si elige Google Business, estaríamos pidiendo dos veces permiso google, hay que especificar que necesitamos su permiso explícito para justificar esta doble autentificación.
- Si elige Google Business: encadena el consent de `business.manage` al login OAuth ya hecho, guarda `provider_token` + `provider_refresh_token` en BD, sync nativo sin Outscraper
- Si elige manual: flujo actual (búsqueda texto + Outscraper)
- Settings permite reconectar / cambiar de manual a nativo después
- Requiere: configurar scopes en Supabase Google provider, guardar tokens en tabla `negocio` o `usuario`, nuevo endpoint backend que use Google My Business API

**Notas técnicas importantes para la implementación:**

- `business.manage` es un scope sensible (no restringido) — los usuarios ven aviso "app no verificada" pero pueden aceptarlo ellos solos haciendo clic en "Configuración avanzada → Continuar". No hay que añadirlos manualmente como testers. Límite: 100 usuarios sin verificación; suficiente para el MVP. Verificar la app con Google cuando se escale.
- El login básico con Google (email + perfil) no se ve afectado en absoluto por la verificación del scope `business.manage`.
- **Problema del refresh token:** Google solo manda el `refresh_token` la primera vez que el usuario da consentimiento. En logins posteriores (aunque pidas el mismo scope) solo manda `access_token` (caduca en ~1h). Si el usuario ya había hecho login con Google sin el scope de business, el segundo OAuth no traerá `refresh_token` → la integración se rompe en menos de 1 hora. **Solución:** forzar siempre `prompt: consent` + `access_type: offline` en el OAuth de business.manage para que Google regenere el refresh token en cada consent:
  ```ts
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'email profile https://www.googleapis.com/auth/business.manage',
      queryParams: { access_type: 'offline', prompt: 'consent' }
    }
  })
  ```

### Activar pagos
- Dar de alta como autónomo → activar variantes Lemon Squeezy → cambiar botones de "lista de espera" a checkout real
