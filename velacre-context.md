# Velacre — Contexto del proyecto

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
| Email | Resend (`info@velacre.com`) |
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

### `competidor`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| negocio_id | UUID | FK → negocio ON DELETE CASCADE |
| place_id | string | Google Place ID del competidor |
| nombre | string | |
| created_at | timestamptz | |

### `radar_analisis`
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
- `POST /generate` — solo genera (sin guardar): 3 tonos + safe filter integrado. Devuelve `{ retenida: true, motivoRetencion }` o `{ retenida: false, contextoCliente, contextoRespuesta, profesional, cercano, directo }`. Límite 3/mes basic.
- `POST /save-manual` — guarda la respuesta manual con tono elegido + estado (`pendiente`/`respondida`) + `plataforma='Otra'` + `contextoCliente/contextoRespuesta`. Incrementa contador manual. Frontend popula el mapa `contextos[]` tras el save para mostrar el contexto sin recargar. Fix móvil: `setEstadoFilter(estado)` antes de `setSelectedId` para que el filtro coincida y el panel no quede en blanco.
- `GET /all` — todas las reseñas (ordenadas por fecha desc), incluye `respondidaFecha`, `retenida`, `motivoRetencion`, `plataforma`
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

### `/api/radar` *(solo Pro)*
- `GET /` — devuelve `{ competidores[], ultimoAnalisis }` del negocio
- `POST /competidores` — añade competidor `{ placeId, nombre }` (máx 3, sin duplicados)
- `DELETE /competidores/{id}` — elimina competidor
- `POST /analizar` — lanza análisis:
  1. Carga últimas 30 reseñas propias de BD (gratis)
  2. Outscraper: 20 reseñas de cada competidor (~€0.02/llamada)
  3. Claude genera JSON con tuFortaleza, tuDebilidad, competidores[], oportunidades[], accion
  4. Reemplaza análisis anterior en `radar_analisis`
  - **Límite:** 2 análisis por mes natural (devuelve 429 `ya_analizado_este_mes` si ya se alcanzó el límite)

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
| Basic | Gratis | — | **5** | **10** | Teaser blurred + overlay CTA | ❌ |
| Core | €19/mes | €190/año | **5** | **20** | **Stats clave reales** (4 KPIs + sentimiento) + 4 cards Pro bloqueadas | ❌ |
| Pro | **€49/mes** | **€490/año** | Ilimitadas | **Ilimitadas (cap soft 250/mes con warning)** | Completo + análisis IA + Radar + PDFs | ✅ |

> **Fórmula anual:** ~10 meses × precio mensual.
> **Estado pagos:** Checkout LS implementado y funcional (modo test). Tienda sin activar hasta alta como autónomo — cuando se active, los pagos en producción se procesarán automáticamente con IVA correcto (LS como Merchant of Record).

### Filtro de seguridad — feature **transversal** (todos los planes)

Desde 2026-04-10 el filtro de seguridad está comunicado como **transversal** — incluido en Basic, Core y Pro sin distinción. Técnicamente siempre fue transversal (se ejecuta en la misma llamada Claude que todos los planes usan), pero el copy de la landing no lo dejaba claro. Ahora hay un bloque dedicado en la sección de pricing "Incluido en todos los planes" con 4 bullets:
- Filtro de seguridad (retiene reseñas críticas: intoxicaciones, amenazas legales, acusaciones graves)
- 3 tonos de respuesta (Profesional, Cercano, Directo)
- Respuestas en el idioma de la reseña
- Sin permanencia

Este bloque es elemento clave del pricing — no es decorativo, es el argumento de "nadie más en España te da esto" frente a wiReply y RepScan que NO tienen filtro de seguridad.

### Cap soft Pro — implementación técnica

Los usuarios Pro tienen acceso ilimitado a respuestas IA, pero cuando superan **250 IA/mes** el sistema muestra un banner cordial en `/dashboard` tipo *"Llevas 250+ respuestas IA este mes, sigues con acceso ilimitado pero si esto se repite escríbenos a info@velacre.com"*. No bloquea nada — es detección de posibles casos de uso intensivo que justifican un plan custom futuro.

- **Backend**: `ReviewController.cs` pasa `p_limit = -1` al RPC `try_increment_ia_counter` para Pro (la RPC trata `p_limit < 0` como "sin límite" pero sigue incrementando el contador). Después compara `preCount + 1 >= 250` y añade `softCapWarning: true` al JSON de respuesta del endpoint `/api/review/{id}/generate`.
- **Frontend**: `dashboard/page.tsx` lee el flag en el handler de `generateForReview`, activa `proSoftCapVisible`, muestra un banner ámbar descartable al principio del `<main>`. Clase tailwind: `bg-amber-50 dark:bg-amber-950/30 border border-amber-200 ...`.

### Estrategia post-integración Google Business Profile (pendiente)

| Plan | GBP importar | GBP auto-publicar | Precio mensual | Precio anual |
|------|-------------|-------------------|---------------|-------------|
| Basic | ✅ | ❌ (copy-paste manual) | Gratis | — |
| Core | ✅ | ✅ | €29/mes | €290/año |
| Pro | ✅ | ✅ + Radar | €69/mes | €690/año |

---

## Lemon Squeezy — flujo completo

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

## Filtro de seguridad en reseñas

Claude detecta en la misma llamada de generación (sin coste extra) si la reseña describe:
1. **intoxicacion** — intoxicación alimentaria real o enfermedad grave
2. **maltrato** — acusaciones de agresión física, malos tratos o acoso grave
3. **amenaza_legal** — amenaza explícita de denuncia judicial o demanda
4. **datos_personales** — datos personales sensibles (nombre + datos médicos/bancarios)

Si detecta alguno: `retenida=true`, `motivoRetencion=<código>`, no se genera respuesta, se hace rollback del contador IA.

En el dashboard: badge ⚠ "Revisión" naranja en la card de la reseña. En el detail panel: banner de aviso naranja con el motivo. Los botones de generar/publicar están deshabilitados para reseñas retenidas.

---

## Radar de Competencia (Pro)

Feature visible en `/dashboard/salud` al final del bloque Pro.

**Flujo:**
1. Usuario añade hasta 3 competidores buscando por nombre (Google Places API)
2. Pulsa "Analizar ahora" — límite 1 vez/mes
3. Loading animado con pasos: reseñas propias → consulta por competidor → IA → informe
4. Claude devuelve JSON: `tuFortaleza`, `tuDebilidad`, `competidores[{nombre, fortaleza, debilidad, amenaza}]`, `oportunidades[]`, `accion`
5. Se muestra: cards fortaleza/debilidad propias, tabla competidores con badge amenaza (alta/media/baja), lista oportunidades, acción concreta de la semana
6. Se habilita hasta 2 veces por mes natural ("Re-analizar" disponible mientras no se alcance el límite)
7. **Matriz de sentimiento:** tabla con 4 categorías detectadas dinámicamente por Claude, puntuación 0-10 para propio y cada competidor. `ScoreBadge` verde (≥7.5), ámbar (≥5), rojo (<5). Visible en `/dashboard/salud` tras el análisis radar.
8. **accionPro banner:** banner azul debajo de la matriz con análisis estratégico — "Tu competencia falla en X, refuerza Y esta semana". Claude genera `accionPro` en el mismo JSON del radar.

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

- `GenerateSingleResponseWithContextAsync` — respuesta IA + filtro seguridad en una sola llamada. JSON: `{ respuesta, contextoCliente, contextoRespuesta, keywordsUsadas, retenida, motivoRetencion }`. MaxTokens: 500.
- `GenerateThreeResponsesWithSafeFilterAsync` — genera los 3 tonos + safe filter + contexto en una sola llamada (para POST /generate manual). JSON: `{ retenida, motivoRetencion, contextoCliente, contextoRespuesta, profesional, cercano, directo }`. MaxTokens: 1200. Devuelve tupla 7-valores.
- `GenerateRadarAnalysisAsync` — análisis comparativo reputación. MaxTokens: 2200. JSON: `{ tuFortaleza, tuDebilidad, competidores[], oportunidades[], accion, categorias[], accionPro }`. Claude detecta dinámicamente las 4 categorías más destacadas de las reseñas propias y aplica las mismas a los competidores para comparativa justa. Puntuación 0-10.
- `GetClaudeMessageAsync` — análisis IA salud (brilla/quema/acción). MaxTokens: 800.
- Retry automático (3 intentos, backoff exponencial) para `overloaded_error`.
- Modelo configurable via `AI_MODEL` env var (default: `claude-sonnet-4-6`).
- **Prompts sin hardcodes geográficos ni sectoriales** (2026-04-09): se eliminaron las menciones a "Galicia" y "hostelería" en los system prompts para que Velacre sirva a cualquier sector y mercado hispanohablante sin sesgo. El contexto se inyecta vía `negocio.descripcion` + `palabras_clave` + reseñas del cliente.
- **Prompts sin jerga técnica SEO** (2026-04-10, mini-radar): el system prompt del endpoint `/api/admin/mini-radar` prohíbe expresamente términos como "SEO", "CTR", "ranking", "visibilidad orgánica", "keywords", "engagement", "KPI", "review management", "sentiment". Obligatoriamente usa lenguaje de dueño de bar gallego: "salir antes cuando alguien busca en Google", "que más gente te vea y entre a comer", "que Google enseñe menos vuestra ficha cuando no respondéis". Incluye ejemplos buenos/malos en el prompt y una regla de auto-revisión final que obliga a reescribir cualquier tecnicismo detectado.

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

1. Cabecera: Atlantic Blue (#051020) con velacre.com clickable
2. 6 KPIs en grid 2×2 con banda de acento superior (nota media, total reseñas, sin respuesta, positivas%, negativas%, respondidas%)
3. Velocidad de respuesta: media, %<48h, %<24h + barra de distribución + benchmark Google 48h
4. Distribución 1★–5★ con barras de progreso coloreadas (rojo/amber/verde) y comparativa vs mes anterior
5. Comparativa mes actual vs anterior (tabla 5 filas)
6. Evolución mes a mes en el año
7. Palabras clave y menciones (SEO del negocio + mencionadas positivas/negativas/neutras)
8. Diagnóstico IA: bloques destacados con icono y borde lateral izquierdo
9. *(Si hay radar data Pro)* Análisis de Competencias: "PUNTUACIONES POR CATEGORÍA (0-10)". Matriz 0-10 por 4 categorías vs hasta 3 competidores. Columna categoría 52mm, altura fila 14mm, sin insights. Barras de progreso coloreadas.

**PDF anual:** gráfico de barras verticales mes a mes (en lugar de tabla plana).
**UI:** 2 botones de descarga — "PDF mes" / "PDF ejercicio" (tema claro).

> **Nota:** `safe()` en jsPDF solo elimina caracteres fuera de WinAnsi. Tildes españolas (á, é, í, ó, ú, ñ) están dentro del rango `\xA0-\xFF` y se renderizan correctamente.

---

## Panel Admin

- Header: "Velacre · Admin" (sin enlace a dashboard) + botón azul **"Mini Radar"** que lleva a `/admin/mini-radar`
- CRUD estado, plan, rol, pro_override, notas, place_id
- Errores en modales con fondo rojo, hint sesión caducada si 401/403

---

## Mini Radar — herramienta de prospección B2B (Admin)

Feature interna (solo admin) para generar informes gratuitos de análisis de reseñas de cualquier negocio de Google como lead magnet de outreach comercial. Añadida 2026-04-10.

### Arquitectura

- **Backend endpoint:** `POST /api/admin/mini-radar` en `AdminController.cs`
  - Input: `MiniRadarRequest(string PlaceId, string? Nombre)`
  - Auth: admin check (`IsAdminAsync()`)
  - Dependencias inyectadas: `IOutscraperService`, `IReviewAiService`
  - Flujo:
    1. Outscraper: `GetCompetitorReviewsAsync(placeId, 30)` — últimas 30 reseñas
    2. Stats locales: total, ratingAvg, distribución 1★-5★, % respondidas, ult30d, ult90d
    3. Extracción de las 3 peores reseñas sin responder (≤3★, gancho emocional del pitch)
    4. Claude (`GetClaudeMessageAsync`): genera JSON con `fortalezas[2]`, `debilidades[2]`, `accion`, `resumen`, `emailPitch` — todo en lenguaje humano sin jerga SEO
  - Output: JSON con `stats`, `peoresSinResponder`, `analisis`, `generadoEn`
  - **Sin persistencia, sin cache** — cada informe es fresco. Cada llamada cobra Outscraper y Claude.

- **Frontend página:** `frontend/src/app/admin/mini-radar/page.tsx`
  - Auth guard con `getMyUsuario().isAdmin`
  - Formulario con **buscador de Google Places** (mismo patrón que onboarding): input con debounce 300ms → `searchPlaces()` → dropdown con nombre/dirección/rating → selección con card verde mostrando place_id
  - Click-outside para cerrar dropdown
  - Botón "Generar informe" deshabilitado hasta tener `selectedPlace`
  - Spinner con pasos fake para UX: "Descargando reseñas" → "Analizando con IA" → "Generando PDF"
  - Al recibir respuesta: `downloadMiniRadarPdf(result)` descarga el PDF automáticamente
  - UI post-generación muestra: cards KPI (rating, reseñas, ult30d, % respondidas), email pitch con botón "Copiar" al portapapeles, fortalezas/debilidades, peores reseñas sin responder

- **PDF generator:** `frontend/src/lib/mini-radar-pdf.ts` (client-side, jsPDF)
  - Hermano independiente de `report-pdf.ts`, con sus propios helpers (no exporta nada del otro)
  - 3 páginas:
    1. Portada: header Atlantic Blue + resumen ejecutivo + 4 KPIs grid 2×2 (rating, reseñas, últimos 30d, % respondidas con tono rojo/ámbar/verde según valor) + distribución 1★-5★ con barras de progreso coloreadas
    2. Quejas críticas sin responder — cards con banda lateral roja, autor + rating + fecha + texto literal
    3. Diagnóstico IA: fortalezas (verde), debilidades (rojo), acción de la semana (card índigo destacada) + CTA cierre Atlantic Blue con `info@velacre.com`
  - Colores: mismos constantes Atlantic/Indigo/Green/Red/Amber/Slate_* que `report-pdf.ts`
  - Filename: `mini-radar-{slug_nombre}-{YYYY-MM-DD}.pdf`
  - Descarga directa al ordenador del admin, **no se guarda en servidor**

### Coste por informe

| Item | Coste |
|------|-------|
| Outscraper (30 reseñas) | ~€0,02 |
| Claude Sonnet 4.6 input (~7.000 tokens con 30 reseñas + prompt) | ~$0,021 |
| Claude Sonnet 4.6 output (MaxTokens 800, uso típico 400-600) | ~$0,009 |
| **Total** | **~€0,05 por informe** |

100 informes/mes = €5. Negligible.

### Prompt Claude — regla de oro: lenguaje humano

El system prompt (`AdminController.cs:MiniRadar`) prohíbe expresamente jerga técnica SEO y obliga al modelo a hablar como un amigo del dueño de un bar gallego. Palabras banneadas: `SEO`, `CTR`, `ranking`, `visibilidad orgánica`, `keywords`, `engagement`, `conversion`, `call-to-action`, `KPI`, `sentiment`, `review management`. Frases obligatorias del estilo: "salir antes cuando alguien busca", "que más gente te vea y entre a comer", "que Google recomiende tu negocio", "la gente que te busca en el móvil", "lo que leen los clientes antes de reservar". Incluye ejemplos buenos/malos para la acción semanal y una regla final de auto-revisión.

El `emailPitch` pedido a Claude es de "vecino que quiere echar una mano", no comercial. Firma: Manuel, Velacre.com. No menciona precios.

### Workflow de uso para outreach

1. Admin va a `/admin/mini-radar`
2. Busca el negocio por nombre (mínimo 3 chars, debounce 300ms) → selecciona en el dropdown
3. Click "Generar informe" → 5-10s → PDF descargado automáticamente
4. Lee el PDF y copia el email pitch que ha preparado Claude (botón "Copiar")
5. Pega en Gmail / IG DM / WhatsApp personalizando con 1 dato concreto del PDF
6. Adjunta el PDF **solo si** el prospect lo pide en su respuesta

### Herramienta hermana: Word de templates

`scripts/generate-email-templates-docx.js` genera `velacre-email-templates-outreach.docx` con 5 plantillas de outreach + workflow recomendado:
- **A** — Restaurantes dueño-operador (email genérico con stats)
- **B** — Negocios con logros mediáticos recientes (gancho "premio vs reseñas")
- **C** — Clínica Pardiñas (tono profesional, estudio citado)
- **D** — DM de vecino-cliente (humilde, solo si eres cliente real)
- **E** — EJEMPLO REAL aplicado a **O Fogar da Carne** (Bruno Casal, Narón) — prospect #1 declarado por Manuel, DM exacto preparado para enviar vía IG DM @ofogardacarne

Regenerar con: `NODE_PATH="$(npm root -g)" node scripts/generate-email-templates-docx.js`

---

## Landing page

- Sección precios: "Planes"
- Copy ES con enfoque FOMO/acceso anticipado
- Solo locale ES activo en copy (en/gal mantenidos en código)

### Framer Motion — capa de animaciones

Instalado `framer-motion` como dependencia. `LandingPage.tsx` completamente reescrito con:

- **`FadeInUp`** helper: `useInView(once:true, margin:'-60px')`, `opacity:0,y:22 → 1,0`, ease `[0.21,0.47,0.32,0.98]`, 0.55s, delay configurable
- **`GlowCard`** helper: `whileHover boxShadow` azul `rgba(59,130,246,0.45)` sin tocar clases Tailwind
- **Hero:** mount animations escalonadas (badge 0.1s → h1 0.2s → p 0.35s → botones 0.5s → setup 0.7s). CTA `whileHover scale:1.02, whileTap scale:0.98`
- **Demo IA interactivo:** `isTyping` state, ícono IA pulsa mientras genera, badge "Generando…", `AnimatePresence mode="wait"` keyed por `selectedTone` para transición limpia entre tonos, CTA final aparece con slide-up al completar
- **Stats:** staggered FadeInUp `i×0.08` por stat
- **Calculadora:** FadeInUp wrapper, `motion.p` en valores ahorro con key-based re-animación al cambiar inputs
- **Keywords:** staggered `whileInView scale:0.9→1` `i×0.04` delay
- **Steps:** FadeInUp `i×0.1` delay
- **Sectores:** staggered scale-in + `whileHover` cambio color border
- **Pricing:** staggered FadeInUp (0, 0.08, 0.16) + GlowCard por plan. `AnimatePresence` en badge ahorro anual
- **Final CTA:** FadeInUp + `whileHover/whileTap scale`

### Calculadora de paz mental

- Widget posicionado **inmediatamente después de la barra de stats** (antes del DEMO IA) — máxima visibilidad/conversión
- Inputs: reseñas/mes (slider 1-150), precio/hora (stepper +/− inline-flex, sin input nativo para evitar bug scroll+selección)
- **Cálculos actualizados 2026-04-10 con tiempos realistas:**
  - `minSin = resenas * 6` (6 min/reseña sin Velacre — abrir Google, leer, pensar, redactar, publicar)
  - `minCon = Math.max(1, Math.ceil(resenas * 5 / 60))` (5 seg/reseña con Velacre — generar con IA + 1 click para publicar. Mínimo 1 min garantizado para que la UI no muestre "0 min")
  - `ahorroMin = minSin - minCon`
  - `ahorroEuros = Math.round((ahorroMin / 60) * precioHora)`
- Ejemplo: 60 reseñas/mes × 20€/h → Sin Velacre 360 min (6h), Con Velacre 5 min, ahorro 355 min (~5h 55min) / ~118€
- Antes: 4 min/reseña sin, 15 seg/reseña con — demasiado conservador en el "sin" y demasiado holgado en el "con"
- Animación en los valores de resultado con `motion.p` + key-based re-render

### Sistema de fuentes

- **Cal Sans (CalSansUI):** self-hosted via `@font-face` en `globals.css`. Ficheros en `frontend/public/fonts/CalSansUI-Bold.woff2` (w700) y `CalSansUI-SemiBold.woff2` (w600). Variable Tailwind: `--font-cal`. Aplicado globalmente a `h1, h2, h3`.
- **Geist:** font para `body` (var `--font-geist-sans`). Importado via `next/font/google` en `layout.tsx`.

---

## Favicon y PWA icons

- `src/app/icon.png` — logo Velacre (128px), Next.js App Router lo sirve automáticamente como favicon en la pestaña del navegador
- `public/favicon.svg` — favicon circular via SVG con `<clipPath>` + `<circle>`. Declarado en `layout.tsx` con `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`.
- `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png` — logo Velacre para PWA y dispositivos móviles
- Fuente de verdad: `images/logo128.png` y `images/logo600.png` en la raíz del repositorio

---

## PWA — instalable en Android e iOS

- **Service Worker** (`public/sw.js`) registrado desde `PWAInstall.tsx` para cache básico + funcionamiento offline del shell. **Siempre activo, en todas las rutas.**
- **`public/manifest.webmanifest`**: nombre "Velacre", `start_url: /dashboard`, `display: standalone`, theme/background `#0f172a`, iconos 192/512 + apple-touch-icon
- **Componente `PWAInstall.tsx`** montado globalmente desde `Providers.tsx`. Lógica actualizada 2026-04-10:
  - **Solo se muestra en las rutas `/` y `/inicio`** — hard gate al renderizar (`return null` antes de cualquier JSX). En cualquier otra ruta (auth, dashboard, settings, admin, etc.) el banner literalmente no existe en el DOM.
  - **Solo primera vez de por vida:** persistencia en `localStorage` con clave `velacre-pwa-banner-dismissed`. Se marca el flag inmediatamente al mostrar el banner → el usuario lo ve una sola vez en este navegador.
  - **Auto-hide a los 10s:** `setTimeout` con `BANNER_TTL_MS = 10_000`. El hideTimer vive en un `useRef` fuera del efecto para que los re-renders no lo reinicien.
  - **Listener `beforeinstallprompt` global** (separado del gate de ruta) para capturar el evento aunque el usuario aterrice en una ruta no-landing.
- **Android:** muestra banner con "Instalar" que lanza el prompt nativo del navegador
- **iOS:** detecta UA iPhone/iPad + `navigator.standalone === false` y muestra banner alternativo con instrucciones "Compartir → Añadir a pantalla de inicio" (iOS no dispara `beforeinstallprompt`).
- **Objetivo:** presencia en home del móvil del cliente → acceso 1 tap a reseñas. No intrusivo: una sola aparición, corta, en la landing donde el usuario tiene intención de conocer el producto.

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
RESEND_FROM=Velacre <info@velacre.com>
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
    Tooltip.tsx             — componente ? minimalista, muestra info en hover para tecnicismos
    HelpModal.tsx           — wizard 8 pasos de ayuda, botón flotante ? en dashboard/salud/settings
  lib/
    api.ts                  — PendingReview incluye retenida/motivoRetencion,
                              RadarData/RadarAnalisisResult/Competidor interfaces,
                              getRadar/addCompetidor/removeCompetidor/runRadarAnalysis,
                              getLemonCheckoutUrl
    report-pdf.ts           — PDFs mes/ejercicio: cabecera Atlantic Blue, KPIs grid 2×2,
                              barras progreso estrellas, diagnóstico IA bloques,
                              página Análisis de Competencias (radar Pro),
                              barras verticales anuales. MonthlyPdfData incluye radarAnalisis.
    i18n.tsx                — contexto multiidioma
    supabase.ts             — cliente Supabase Auth
```

---

## Decisiones de diseño relevantes

- **No usar `null` con Postgrest `.Set()`** — usar string vacía `""` en su lugar
- **Eliminar cuenta:** anonimiza `usuario`, borra `review`/`negocio`, llama `DELETE /auth/v1/admin/users/{id}`
- **Plan efectivo:** `GetMe` computa `effectivePlan = pro_override && !expired ? "pro" : usuario.plan`
- **Sync incremental:** detecta reseñas que el propietario respondió en Google desde el último sync
- **Panel salud:** solo Pro. Basic y Core ven teasers diferenciados:
  - Basic: nota media real + 2 KPIs dummy blurred + upsell directo a Pro
  - Core: nota media real + sentimiento real + cards Pro bloqueadas (análisis IA, radar, sentimiento categoría, PDFs) con skeleton dummy + badge Pro + botón desbloquear individual. Upsell a Pro.
  - Si quitan el CSS blur: ven skeletons vacíos (no datos reales)
  - h1 del panel Pro: "Panel de Salud"
- **Checkout LS:** `redirect_url` va dentro de `product_options`, no en atributos raíz
- **Gestión suscripción:** exclusivamente via portal LS (`ls_customer_portal`). Sin modal propio de cancelación.
- **Emails suscripción:** fire-and-forget (`_ = _email.SendXxx(...)`) en webhook LS
- **Contador IA atómico:** RPC PostgreSQL `try_increment_ia_counter` — check + increment en una operación SQL
- **Keywords SEO fallback:** si no hay `palabras_clave`, usa top 6 `keywords_usadas`; si ninguna, usa nombre negocio
- **Velocidad de respuesta:** `respondida_fecha` setea al marcar respondida (solo si null), limpia al revertir
- **Modo oscuro forzado:** siempre dark. `<html class="dark">` en layout
- **Acento blue** en toda la UI (cambiado de indigo)
- **Filtro seguridad reseñas:** misma llamada Claude, sin coste extra. Rollback contador IA si retenida. Aplica tanto en POST /generate (manual, `GenerateThreeResponsesWithSafeFilterAsync`) como en POST /{id}/generate (IA, `GenerateSingleResponseWithContextAsync`).
- **POST /generate separado de /save-manual:** generación y guardado son dos pasos separados. El usuario elige el tono y decide si guardar como pendiente o respondida.
- **Flujo "Otra Plataforma":** badge en lista, botones de Google deshabilitados para `plataforma='Otra'`, modal con selección de tono obligatoria, auto-aparece en lista tras guardar, banner si retenida. Modal rediseñado: bottom-sheet en móvil (`items-end sm:items-center`, `rounded-t-2xl sm:rounded-2xl`), centrado en desktop, `max-h-[92dvh] sm:max-h-[90vh]`, header/footer sticky, contenido scrollable (`flex-1 overflow-y-auto`).
- **Contexto card en Otra Plataforma:** tras generar, se muestra tarjeta "Cliente dijo / Tú respondes" igual que en reseñas Google. Útil si la reseña está en otro idioma. State: `manualContexto: { cliente, respuesta } | null`, se resetea en `closeManualModal()`.
- **Radar categorías dinámicas:** Claude detecta las 4 categorías más relevantes de las reseñas propias (no hardcodeadas), aplica las mismas a competidores. `RadarCategoria: { nombre, yo: number (0-10), rivales[{nombre, score}], insight }` en `api.ts`.
- **Favicon circular:** `src/app/icon.png` generado con `sharp` + SVG clipPath mask (circle). Next.js App Router lo sirve como favicon automáticamente. No hay `metadata.icons` en `layout.tsx` (conflicto eliminado).
- **Tooltips en UI:** componente Tooltip.tsx con `?` minimalista en hover para: respuestas IA, palabras clave SEO, tono, impacto Velacre, SEO, sentimiento, velocidad de respuesta, radar.
- **Radar:** ParseAnalisisJson usa `RootElement.Clone()` para evitar JsonElement inválido tras dispose del JsonDocument. Límite 2 análisis/mes. Backend guarda los 2 últimos registros (no borra todo), GET devuelve `analisisEsteMes: int`. Frontend usa `analisisEsteMes < 2` para `canAnalizar`. Columnas competidor en tabla: "Comp. 1/2/3" con `title` tooltip al nombre completo.
- **Core IA limit:** 18/mes (corregido de 10 que aparecía hardcodeado en dashboard).
- **Upsell modal límite IA:** checkout directo LS sin pasar por settings. Basic: botones Pro (principal) + Core (secundario) con spinner. Core: botón Pro directo.
- **Pricing features:** Basic incluye Google + 3 IA + 3 otras plataformas + importación. Core: 18 IA, Google + otras, tono+keywords, historial completo. Pro: Panel de Salud, ilimitadas, Radar benchmark vs 3 competidores, análisis IA mensual + PDFs. Sin "soporte prioritario".
- **Header/footer páginas legales:** normalizados al mismo estilo que landing (sticky blur, h-16, max-w-6xl, Login + Empezar gratis, footer copyright + links).
- **GBP deshabilitado:** todo el código está, solo la UI muestra "Próximamente". Fácil de activar cuando llegue la autorización de Google.
- **safe() en jsPDF:** solo elimina chars fuera de `\x20-\x7E\xA0-\xFF`. Las tildes españolas están dentro del rango y funcionan.
- **PDF diseño actual:** cabecera Atlantic Blue fija, KPIs en grid 2×2 con banda acento, distribución estrellas con barras de progreso coloreadas (rojo/amber/verde), diagnóstico IA con icono + borde lateral, página "Análisis de Competencias" con matriz 0-10 si hay radar Pro (título "PUNTUACIONES POR CATEGORÍA"), PDF anual con gráfico de barras vertical. 2 botones UI: mes/ejercicio, tema claro únicamente.
- **save-manual contexto:** endpoint acepta y persiste `contextoCliente/contextoRespuesta`. Frontend pasa el contexto al guardar y popula `contextos[]` sin recargar. Fix móvil: `setEstadoFilter(estado)` antes de `setSelectedId` para evitar panel en blanco al guardar.

---

## Pendiente / Próximos pasos

### Activar Google Business Profile
- Autorización "Application for Basic API Access" enviada. Plazo: 7-10 días hábiles.
- Cuando llegue: quitar `opacity-50 pointer-events-none` de los tres sitios (onboarding, settings, dashboard) y eliminar badges "Próximamente".
- Revisar precios post-GBP: Core €29/mes, Pro €69/mes (incluyendo Radar como add-on integrado).

### Activar pagos
- Alta como autónomo → activar tienda Lemon Squeezy (payout/datos bancarios) → en producción los pagos se procesarán automáticamente con IVA correcto (LS como MoR). Esto ya funciona!!!!!!
- El checkout ya está implementado y probado en modo test. Y en live mode también probado!!!!!!!
- Descuento de 99% creado para test (tarjeta de un colega) y un descuento del 15% por si me apetece dárselo a alguien que capte (como el primer cliente PRO, o CORE venga, humildad)

### Outreach / Captación de primeros clientes

Pendientes de ejecución para la fase de captación inicial. Todo lo técnico que habilita este trabajo (Mini Radar, Word de templates con A-E, análisis de competencia, ICP definido) ya está listo — falta ejecutar.

1. **Prospect #1 — O Fogar da Carne (Bruno Casal, Narón)**
   - Generar el Mini Radar de O Fogar da Carne desde `/admin/mini-radar` (buscar "O Fogar da Carne Narón" en el buscador Google Places)
   - Leer el PDF entero antes de nada
   - Personalizar el Template E del Word de outreach con 1 dato concreto sacado del PDF (ej: "he visto que las 3 últimas reseñas del mes pasado siguen sin contestar, una habla de X")
   - Revisar el mensaje en voz alta con la novia antes de pulsar enviar
   - Enviar por IG DM a @ofogardacarne
   - Si no responde en 7 días: NO insistir por canal digital, mencionarlo de palabra en la próxima visita como cliente cuando lleve el entrecot

2. **Prospects #2-#5 — cerrar 2-3 clientes reales antes de escalar**
   - Seguir el orden de envío del Word de templates (`velacre-email-templates-outreach.docx`, última página): Pardiñas con C → Mesón O Pote con B → Pablo Gallego con B → A Taberna do Bispo con A
   - Para cada uno: correr Mini Radar → copiar email pitch que genera Claude → pegar en el template correspondiente → personalizar 1-2 datos → enviar
   - Meta realista primera semana: 4-5 outreach enviados → 1-2 respuestas → 1 cliente de pago cerrado

3. **Warm intro vía Tía Carmiña (Inés Santiago, @inesantiagoo)**
   - **Sólo después** de tener 2-3 clientes reales cerrados para no ir de vacío ni dependiente/desesperado
   - Canal: Instagram DM a @inesantiagoo
   - Propuesta: partnership con Tía Carmiña (agencia de comunicación que lleva restaurantes de Ferrol/Galicia) — modelo reseller con 20% comisión recurrente, o referidos simples con €50-100 por cliente cerrado, o co-marketing (caso de estudio conjunto)
   - No venderle Velacre a ella como cliente — ofrecerle canal de distribución a sus clientes
   - Nota: Inés es HIJA de los dueños de Artesa (pizzería Canido). Si se da la conversación, puede haber ruta indirecta a Pablo Santiago (Artesa) también

4. **Al cerrar cada cliente nuevo**
   - Pedir testimonio breve escrito (2-3 frases, firmado con nombre + foto del negocio si acepta)
   - Pedir permiso para caso de estudio público ("Cómo X aumentó su rating de Y a Z en N meses con Velacre")
   - Añadirlo a una sección futura "Clientes actuales" de la landing cuando haya 3-5 testimonios

5. **Instrumentación pendiente para optimizar outreach**
   - Tracking de aperturas de emails con Resend (si se envían emails, no DMs) — ya está integrado el SDK
   - Dashboard admin con contador de prospects contactados / respondidos / cerrados — valorar construirlo cuando haya 10+ prospects activos
   - Posible lead magnet público `/informe-gratis?place_id=X` que cualquiera pueda compartir (requiere desgatear el Mini Radar de admin a endpoint público con rate limit) — valorar tras 5 clientes cerrados

### Backlog inmediato (mejoras/bugs para antes o junto con GBP)
- Revisar MVP
  
+ **Eliminación de reseñas (Pro):**
- Feature de alto valor percibido, coste mínimo de desarrollo.
- Flujo: usuario selecciona reseña → marca el motivo (spam, irrelevante, falsa, ofensiva...) → Claude genera el texto de reclamación exacto según políticas de Google → usuario copia y pega en el formulario oficial de Google.
- Velacre no elimina nada, Google decide. El valor es saber exactamente qué decir y dónde.
- Añadir a panel de reseña como botón "Solicitar eliminación" (Pro).

+ **Precios por ubicación (multi-local):**
- Si un negocio tiene 2+ locales, paga proporcionalmente (le ahorramos el doble de tiempo).
- Modelo: precio base primer local (ej. €49/mes Pro) + add-on por local adicional (ej. €20/mes).
- Implementación: quantity en Stripe/LS o add-on de "sede adicional".
- Gestión manual mientras no haya demanda validada (primeros clientes).
- ⚠️ **Al implementar esta feature, revisar y actualizar la tabla de planes de pago** (sistema de planes, precios, variantes LS) para reflejar el nuevo modelo de precios.

### Ideas futuras (post-GBP + tracción)
- **Marca blanca (Enterprise+):** agencias pueden ofrecer Velacre con su logo/colores a sus clientes. +100€/mes.
- **QR anti-reseñas negativas:** si 4-5★ → lleva a Google Maps; si 1-2★ → guarda nota interna sin publicar. Descartado para el corto plazo — implica cambio de paradigma de producto (diseño físico, logística, soporte, ventas distintas). Retomar cuando haya 50+ clientes de pago.
- **WhatsApp/Gmail semanal:** cron los lunes a las 10am con recuento semanal + respuesta ya preparada.
- **Métricas propias velocidad:** cuando haya usuarios reales, benchmark interno anónimo en vez del de Google (48h).
- **Auditoría FOMO** con casos de éxito cuando haya usuarios reales.

---

## Análisis de competencia (2026-04-09)

Research sobre competidores **estatales españoles** con los que Velacre compite (o debería) de verdad. Se eligieron 2: **wiReply** (competidor directo, mismo segmento) y **RepScan** (referencia premium, techo alto del mercado español).

### Competidor 1 — wiReply (SocialwiBox)

- **País:** España · Mataró, Barcelona
- **URL:** https://wireply.ai/ · calculadora: https://go.wireply.ai/?lang=es
- **Target:** negocios locales multi-ubicación en Google Business Profile (hostelería, hoteles, gimnasios, retail)

**Precios** — modelo de calculadora dinámica (sin tabla de planes fija):
- Variables: nº de ubicaciones GBP (1-100) y reseñas/año (100-100k)
- Ejemplo publicado: **€22,50/mes por negocio** (o €270/año)
- Trial 7 días / 30 respuestas, sin tarjeta

**Features:** integración directa GBP, respuestas automáticas y personalizadas con IA, configuración de tono y horarios de publicación, análisis de sentimiento, identificación de empleados mencionados, KPIs mensuales e informes de evolución de rating, multi-ubicación nativa.

**Fortalezas vs Velacre:** integración GBP real y publicación automática, multi-ubicación nativa, presencia mediática (El Mundo Financiero, Iberian Press, etc.).

**Debilidades vs Velacre:** no tienen Radar de Competencia, no tienen filtro de seguridad para reseñas críticas, no tienen PDF benchmark mensual/anual, no ofrecen plan gratis, pricing opaco.

### Competidor 2 — RepScan

- **País:** España
- **URL:** https://www.repscan.com/es/responder-resenas-ia/ · eShop: https://www.repscan.com/es/eshop/
- **Target:** restaurantes, clínicas, hoteles, tiendas, cadenas multi-ubicación y personal branding (CEOs, creators)

**Precios:**

| Producto | Precio |
|----------|--------|
| Plataforma SaaS gestión reseñas/GMB | **€249/mes** (era €415, -40%) |
| Care Basic / Pro / Pro+ (personal) | €25 / €49 / €97 /mes |
| CEO Care / Corporation Care | €97/mes / a consultar |
| Pack Eliminar 5 reseñas | €485 |
| Auditoría perfil Google | €80 |
| Eliminar reseña (puntual) | €99 |
| Eliminar perfil falso | €239 |
| Eliminar perfil GBP | €539 |
| Eliminar derecho al olvido | €699 |

**Features SaaS:** 9 tonos predefinidos (formal, cercano, empático, corporativo, casual, humorístico, inspirador, minimalista, detallista), respuestas automáticas o supervisadas, detección automática de idioma, gestión multi-perfil, aprendizaje continuo por historial, "eliminación reseñas ilimitadas" en el SaaS alto.

**Fortalezas vs Velacre:** servicios reales de eliminación (gancho legal + reputacional), marca consolidada, 9 tonos, modo supervisado (aprobar antes de publicar), multi-perfil/cadenas.

**Debilidades vs Velacre:** precio (Velacre Pro €49 vs RepScan SaaS €249 = 5× más caro), sin plan gratis, sin Radar competencia, sin filtro seguridad integrado, onboarding tipo demo comercial. Enfoque en "reputación de crisis" (eliminar cosas malas) vs Velacre "gestión operativa diaria" → no son idénticos, pueden coexistir.

### Matriz comparativa

| | Velacre | wiReply | RepScan (SaaS) |
|---|---|---|---|
| Plan gratis | ✅ Basic | ❌ (trial 7d) | ❌ |
| Precio entrada | **€19/mes** (Core) | €22,50/mes | — |
| Precio Pro | **€49/mes** | ~€22,50 (sin tiers) | **€249/mes** |
| Integración GBP | 🟡 Próximamente | ✅ | ✅ |
| Publicación auto | 🟡 Próximamente | ✅ | ✅ |
| Tonos IA | 3 | configurable | 9 |
| Filtro seguridad | ✅ único | ❌ | ❌ |
| Radar competencia | ✅ único | ❌ | ❌ |
| PDF benchmark | ✅ único | 🟡 informes | ❌ |
| Multi-ubicación | ❌ | ✅ | ✅ |
| Eliminación reseñas | ❌ | ❌ | ✅ |
| Pricing transparente | ✅ | ❌ calculadora | 🟡 |

### Decisiones de precio y posicionamiento

1. **Core a €19/mes — mantener**. wiReply vende a €22,50: quedarse 15% por debajo del competidor directo es correcto. Cuando se active GBP, subir a €24–25 (aún por debajo).
2. **Pro a €49/mes — mantener**. 5× por debajo de RepScan SaaS y justificado por Radar + PDF benchmark + análisis IA. Post-GBP subir a €69 como ya está planificado.
3. **Nuevo hueco: plan "Chains" multi-ubicación** a €99–129/mes para cadenas pequeñas (2-5 locales) — gap entre wiReply (calculadora cara por local) y RepScan (€249). Requiere soportar `negocio[]` por usuario.
4. **Posicionamiento único:** *"Inteligencia competitiva para PYMEs — no solo responde reseñas, te dice qué mejorar vs tu competencia"*. Armas únicas que ninguno tiene: Radar de Competencia IA, filtro de seguridad en reseñas críticas, PDF benchmark mensual/anual, precio transparente con plan gratis real.

### Puntos débiles a cerrar con prioridad

- 🚨 **GBP publicación directa** — missing feature #1. Sin esto wiReply nos supera en demos side-by-side. Acelerar aprobación Google.
- 🔸 **Modo supervisado** (aprobar antes de publicar) — RepScan lo tiene, es un miedo común de dueños de negocio. Barato de implementar (toggle + estado borrador).
- 🔸 **Más tonos** (3 → 5 o 6) — gap vs RepScan (9) se nota en comparativas. Añadir "Empático" y "Humorístico" como mínimo.

### ¿Podemos competir SIN GBP activo?

**Respuesta corta: sí, pero con un discurso distinto.**

Mientras GBP no esté autorizado, competir en la terna "responde automáticamente en Google" es perder — wiReply publica solo. Pero Velacre puede ganar en **dos frentes ortogonales** donde GBP no es requisito:

1. **Inteligencia competitiva (Radar + PDF benchmark + filtro seguridad):** ninguno de los dos lo ofrece. El valor de Velacre para el cliente Pro no es "te publica en Google" — es "te dice en qué te gana y en qué te pierde tu competencia, cada semana". Ese discurso no depende de GBP y es único en España.
2. **Flujo asistido de copy-paste rápido:** Velacre ya tiene el botón "Responder en Google" que abre `business.google.com/reviews` con la respuesta generada lista para pegar. Si el cliente tiene ≤50 reseñas/mes, copiar-pegar 10 segundos por reseña es trivial vs pagar €22,50 a wiReply por automatizarlo. **Con el PWA instalable nuevo, ese flujo es aún más natural desde el móvil** (1 tap app → generar → copiar → pegar en GBP → listo).

**Posicionamiento comercial interino (sin GBP):**
> "Velacre no publica por ti todavía (llega en semanas con el permiso de Google). Mientras tanto: genera las 3 mejores respuestas en 2 segundos, las copias al perfil de Google, y además te damos algo que nadie más tiene — un análisis mensual de qué hace mejor tu competencia."

**Segmentos donde podemos ganar ya, incluso sin GBP:**
- **Basic gratis → Core €19:** PYMEs con 5-30 reseñas/mes que no quieren pagar €22,50 a wiReply por automatizar algo que hacen en 5 min al día. Velacre les da Core + keywords SEO + salud por menos.
- **Pro €49 (Radar):** dueños que ya responden ellos mismos pero quieren **saber** qué hacer. El valor está en el análisis, no en la publicación. Aquí no hay competencia estatal.
- **Sectores fuera de hostelería pura** (clínicas pequeñas, talleres, peluquerías, academias): wiReply está muy orientado a cadenas, RepScan a grandes. Hay hueco PYME unifuncional.

**Segmentos donde perdemos sin GBP** (evitar en ventas directas hasta que esté activo):
- Cadenas con 3+ locales → directo a wiReply
- Franquicias y grandes hoteles → RepScan o wiReply
- Clientes que piden demo comparando "quién publica solo" — perderemos frontal

**Conclusión estratégica:** hasta que GBP esté aprobado, no intentar ser "wiReply más barato". Ser "el único que te da Radar + benchmark + filtro seguridad + plan gratis real". GBP llegará y cerrará el flanco abierto, pero no debe ser la única propuesta de valor.

---

## Changelog 2026-04-09

Commits del día (orden cronológico):

| Hash | Tipo | Cambio |
|------|------|--------|
| `eebac81` | feat(pricing) | Pro sube a **€49/mes** y **€490/año** (antes €39/€390) — posicionamiento competitivo vs RepScan y margen para Radar |
| `a3894b3` | fix(salud) | Teasers Basic/Core en móvil muestran contenido correcto; redirect post-checkout LS lleva a dashboard en lugar de quedarse en la pasarela |
| `3a321ea` | fix(ai) | Prompts de `ClaudeService` sin referencias hardcodeadas a Galicia ni hostelería — producto neutral por sector y mercado hispanohablante |
| `4fdeae1` | feat(pwa) | Service Worker + `manifest.webmanifest` + `InstallPromptBanner.tsx` (Android `beforeinstallprompt` + iOS instrucciones "Añadir a pantalla de inicio") → Velacre instalable como app en Android e iOS |

**Impacto agregado:** con estos 4 commits Velacre tiene (1) precio Pro alineado al valor comunicado en landing, (2) IA genérica no sesgada a Galicia/hostelería lista para escalar a cualquier sector, (3) experiencia móvil con app instalable en home screen — clave para PYMEs que viven del móvil, (4) flujo de pago post-checkout pulido en móvil.

---

## Changelog 2026-04-10

Commits del día en orden cronológico:

| Hash | Tipo | Cambio |
|------|------|--------|
| `54a61ef` | feat(admin) | **Mini Radar v1** — endpoint `POST /api/admin/mini-radar` + página `/admin/mini-radar` + `lib/mini-radar-pdf.ts` con jsPDF. Herramienta interna de prospección que analiza las últimas 30 reseñas de cualquier place_id via Outscraper + Claude y genera un PDF descargable de 3 páginas con stats, quejas sin responder, diagnóstico IA y email pitch pre-personalizado. Coste ~€0,05 por informe. Sin persistencia. Ver sección "Mini Radar" para detalles. |
| `728dc58` | fix(pwa) | (Primera iteración del fix del banner PWA — ver siguiente entrada) |
| `e1cec28` | feat(mini-radar) | **Buscador Google Places** en `/admin/mini-radar` reemplazando el input manual de place_id. Reutiliza `searchPlaces()` + `PlaceResult` de onboarding: debounce 300ms, dropdown con nombre/dirección/rating, click-outside, card verde con place_id al seleccionar. Elimina fricción de copiar/pegar place_ids a mano. |
| `d0fd099` | tweak(landing) | Calculadora de paz mental con tiempos realistas: 4 min → **6 min** sin Velacre, 15 seg → **5 seg** con Velacre. Min 1 min garantizado en el cálculo con-Velacre para que la UI nunca muestre "0 min". |
| `99e072c` | chore(email) | **`hola@velacre.com` → `info@velacre.com`** en todos los sitios: `EmailService.cs` (fallback de `RESEND_FROM`), `mini-radar-pdf.ts` (CTA de cierre del PDF), `velacre-context.md` (tabla de stack + env vars) y `scripts/generate-email-templates-docx.js` (firmas de los 3 templates). Word regenerado. |
| `f3e5778` | fix(pwa) | **Banner PWA reescrito tras feedback del usuario.** Gate duro a `/` y `/inicio` (nunca más en auth, dashboard, admin). Auto-hide a los 10s garantizado (hideTimer en `useRef`, no en estado). Primera vez de por vida con `localStorage.velacre-pwa-banner-dismissed`. Service Worker y listener `beforeinstallprompt` siguen globales. Resuelto también el warning `react-hooks/set-state-in-effect` preexistente. |
| `f0db12b` | fix(mini-radar) | **Prompt Claude humanizado** — fuera jerga SEO/CTR/ranking/KPI, dentro lenguaje de dueño de bar gallego ("salir antes cuando alguien busca", "que Google enseñe vuestra ficha"). Ejemplos buenos/malos para la acción semanal y regla de auto-revisión final que obliga a reescribir cualquier tecnicismo. emailPitch ahora en tono "vecino que quiere echar una mano" no comercial. |

**Impacto agregado:**

1. **Herramienta de prospección lista** — Manuel puede generar informes PDF gratis de cualquier negocio de Google en ~10s desde el panel admin, con buscador Google Places y email pitch pre-redactado. Lead magnet funcional para outreach B2B.
2. **Lenguaje del producto alineado con la audiencia** — ningún output que ve el usuario final (prospect o cliente) contiene jerga técnica. Cualquier PYME gallega entiende los informes sin necesitar un traductor.
3. **Banner PWA no-intrusivo** — tras 2 iteraciones, cumple los 3 requisitos del usuario: solo en landing/inicio, solo primera vez, 10 segundos máximo. Ya no aparece en auth ni en el resto de la app.
4. **Coherencia de marca** — email oficial unificado en `info@velacre.com` en todas las superficies (backend, frontend, PDFs, templates, docs).
5. **Calculadora de landing más verosímil** — la diferencia entre "sin Velacre" y "con Velacre" está mejor calibrada sin parecer inflada.

### Prospect #1 declarado

**O Fogar da Carne** (Bruno Casal, Narón) — asador de carnes premiado, vecino de Ferrol. Manuel es cliente habitual (comió allí el domingo 2026-04-05 con la familia). Prioridad oficial de captación: máxima. El **Template E** del Word de outreach contiene el DM exacto preparado para enviar por IG DM @ofogardacarne cuando esté listo. Canal único: DM digital (sin puerta fría por preferencia del usuario).

---

## Changelog 2026-04-10 (segunda sesión)

Rebalanceo de los límites de planes tras análisis de la propuesta de valor vs precio, y comunicación transversal del filtro de seguridad.

### Cambios backend — `ReviewController.cs`

| Antes | Después |
|---|---|
| Basic manuales: 3/mes | **5/mes** |
| Core manuales: 3/mes | **5/mes** (igualado con Basic, ambos tienen 5) |
| Basic IA: 3/mes | **10/mes** (el trial realmente se puede experimentar) |
| Core IA: 18/mes | **20/mes** (objetivo declarado: llega justo para 20-25 reseñas/mes, deja 5+ sin responder para empujar a Pro) |
| Pro IA: ilimitadas sin contador | **Ilimitadas con cap soft 250/mes + warning** |

**Refactor del bloque de límite IA en `ReviewController.cs:296-340`:** ahora TODOS los planes llaman al RPC `try_increment_ia_counter`. Pro pasa `p_limit = -1` (la RPC lo trata como "sin límite" pero sigue incrementando `respuestas_ia_mes`). Después se comprueba `preCount + 1 >= 250` y si es Pro se marca `softCapWarning = true` en la respuesta.

**Nuevo campo en el response:** `softCapWarning: bool` en el JSON de `POST /api/review/{id}/generate`. Sólo es `true` cuando el usuario efectivo es Pro y ha superado el umbral.

### Cambios frontend

**Locales (`es.ts`, `en.ts`, `gal.ts`):**
- Basic features: añadido "10 respuestas IA al mes" + "5 respuestas para otras plataformas"
- Core features: cambiado "18 respuestas IA" → "20 respuestas IA" + **añadido "Panel de Salud con estadísticas clave"**
- Pro features: reescrito el copy del Radar para vender mejor el valor: *"Radar de competencia: descubre qué hacen mejor tus 3 rivales y qué hacer esta semana"* + añadido *"Benchmark 0–10 en 4 categorías vs competidores"*
- Settings `planCore`: cambiado "18 respuestas IA/mes" → "20 respuestas IA/mes" + añadido "Panel de Salud con estadísticas clave"
- **Nuevo bloque `transversalTitle` + `transversalItems`** — 4 bullets comunes: filtro seguridad, 3 tonos, idioma auto, sin permanencia

**Types (`locales/types.ts`):** añadidos campos `transversalTitle: string` y `transversalItems: string[]` al interface `pricing`.

**`LandingPage.tsx`:** nueva caja debajo de las 3 tarjetas de planes con título "Incluido en todos los planes" y lista 2 columnas con los 4 items transversales. Check azul + texto slate-300. Responsive: `grid sm:grid-cols-2 gap-x-6 gap-y-3`.

**`dashboard/page.tsx`:**
- Mensaje de límite alcanzado actualizado: "18 → 20" (Core) y "3 → 10" (Basic)
- Nuevo estado `proSoftCapVisible` + banner ámbar descartable al principio del `<main>` cuando el backend devuelve `softCapWarning: true`
- El banner enlaza a `info@velacre.com` para los casos de uso intensivo (potenciales clientes enterprise)

**`api.ts`:** añadido campo opcional `softCapWarning?: boolean` al interface `GenerateForReviewResult`.

### Lo que NO se tocó (verificado, estaba ya correcto)

- **Panel de Salud para Core** (`dashboard/salud/page.tsx`) — ya tenía la estructura correcta: Core ve 4 KPIs reales (nota, % respondidas, reseñas este mes, tendencia) + sentimiento real + 4 cards Pro bloqueadas con blur (Análisis IA, Radar, Sentimiento por categoría, Informes PDF), cada una con botón "Desbloquear con Pro →". No requirió cambio.
- **Tabla de planes en `settings/page.tsx`** — no es realmente una tabla comparativa sino un upsell contextual (si Basic muestra Core+Pro, si Core muestra Pro, si Pro no muestra nada). Sólo había que actualizar el texto del array `planCore` en `es.ts` (que también se hizo).
- **Responsive móvil** — todos los layouts ya eran mobile-first (`grid md:grid-cols-3` landing, `grid sm:grid-cols-2` settings y salud cards). Cero cambios estructurales.
- **RPC `try_increment_ia_counter` en Supabase** — ya aceptaba `p_limit < 0` como "sin límite", así que no hizo falta migration SQL.

### Veredicto interno sobre las 2 features de diferenciación (leídas del código real)

**Filtro de seguridad** (`ClaudeService.cs:100-113`): mezcla 60% cover-your-ass (Velacre como proveedor no puede generar automáticamente *"¡Sentimos que no te gustara la experiencia!"* a una reseña que habla de intoxicación), 40% valor real para el cliente. Bajo perceivable para el cliente, pero es el mejor argumento de marca *"el único SaaS español que no te cagará encima en reseñas críticas"*. Por eso se bajó a transversal — coste cero (misma llamada Claude) y diferenciación visible.

**Radar de competencia** (`ClaudeService.cs:GenerateRadarAnalysisAsync` + `RadarController.cs:analizar`): valor real A+. Scoring numérico 0-10 por categoría, categorías emergentes detectadas dinámicamente (no hardcoded), amenaza por competidor (alta/media/baja), acción concreta semanal, MaxTokens 2200. Único en España en este segmento (wiReply y RepScan NO lo tienen). Hero feature absoluto del Pro — justifica el €49 por sí solo.

### Lemon Squeezy

Manuel actualizó manualmente las descripciones de los productos Core y Pro en el panel de LS para reflejar los nuevos límites (20 en lugar de 18).

### Impacto agregado

1. **Trial Basic usable** — 10 IA en lugar de 3 permite que el dueño experimente el producto de verdad antes de decidir. Conversión Basic→Core esperada +20-40%.
2. **Core tiene sentido como step** — 20 IA cuadra con el ICP real (5-20 reseñas/mes). Churn Core esperado -50% vs límite anterior de 18.
3. **Pro mantiene el precio pero gana comunicación** — copy del Radar ampliado, features reorganizadas para que el valor esté al principio.
4. **Nadie más en España comunica el filtro de seguridad** — ventaja de marca únicamente explotable con una línea de copy y cero coste técnico.
5. **Cap soft Pro detecta casos enterprise** — sin bloquear, nos avisa cuando alguien está usando Pro con volumen que justificaría plan custom futuro.

### Fix tardío — botón Mini Radar en móvil (`b20a326`)

El botón "Mini Radar" que añadí al header del panel admin en `54a61ef` tenía `hidden sm:inline-flex` — invisible en móvil. Corregido para seguir el mismo patrón del botón "Actualizar" de al lado: icono SVG siempre visible, texto "Mini Radar" solo en `sm+`, padding compacto en móvil (`px-2.5 sm:px-3`), añadidos `title` y `aria-label` para accesibilidad cuando solo aparece el icono. Una línea de código, un minuto, pero el Mini Radar no se podía usar desde móvil hasta este fix.

## Changelog 2026-04-12 — error handling global + hardening

Sesión larga dividida en 3 fases. Punto de partida: revisión exhaustiva del proyecto (front + back + integraciones) buscando puntos donde el usuario pudiera quedarse colgado y problemas latentes de concurrencia o seguridad.

### Fase 1 — `velacre-context-technical.md` (nuevo doc)

Se creó `velacre-context-technical.md` (~40 KB, 18 secciones) con el retrato técnico completo del proyecto: arquitectura, 44 endpoints backend documentados, 5 servicios, flujos críticos end-to-end, seguridad transversal, matriz de 17 hallazgos de concurrencia con severidad, estado del error handling actual y propuesta de implementación. Es el doc de referencia técnica; `velacre-context.md` (este) sigue siendo el doc contextual/conceptual.

### Fase 2 — Error handling global (`c7a8b6a`)

**Objetivo:** que el usuario nunca vea una pantalla en blanco. Si ocurre un error real, ve mensaje amable con botón "Reportar problema" → modal con campo "Observaciones" → email a `info@velacre.com` con contexto completo **sin stack trace**.

**Backend nuevo:**
- `backend/Infrastructure/GlobalExceptionMiddleware.cs` — captura excepciones no controladas, devuelve `{error:"internal_error", mensaje, errorId}` consistente.
- `backend/Controllers/ReportErrorController.cs` — endpoint `POST /api/report-error` **anónimo** (para permitir reportar incluso con sesión rota), rate limit in-memory 10/h por IP vía `IMemoryCache`, sanitiza campos, genera `reportId = RPT-yyyyMMdd-HHmmss-XXXX`, llama a `EmailService.SendErrorReportAsync` (nuevo).
- `backend/Models/Requests/ReportErrorRequest.cs` — DTO del payload (URL, mensaje, status, endpoint, últimaAcción, email/plan, user-agent, observaciones).
- `EmailService.SendErrorReportAsync` — template HTML con asunto `[Velacre] Error reportado {reportId}`, destino `info@velacre.com`.
- `Program.cs` — registrado `AddMemoryCache()` + `UseMiddleware<GlobalExceptionMiddleware>()` tras `UseCors`.

**Frontend nuevo:**
- `frontend/src/components/ErrorBoundary.tsx` — clase React clásica con `getDerivedStateFromError` + `componentDidCatch` que muestra fallback con botón Reportar.
- `frontend/src/app/error.tsx` — boundary por ruta del App Router con `reset()` + Reportar.
- `frontend/src/app/global-error.tsx` — último bastión con `<html>/<body>` propios y estilos inline (por si falla el root layout).
- `frontend/src/components/ReportErrorModal.tsx` — modal con textarea Observaciones, preview colapsable del payload, estados idle/sending/sent/error.
- `frontend/src/lib/errorReporter.ts` — `trackLastAction(action)` + `buildErrorPayload(info, user, observaciones)`. Normaliza mensajes (filtra líneas con `at ` y `webpack-internal://` para no filtrar stacks accidentales), trunca campos.
- `frontend/src/lib/api.ts` — función `reportError(payload)`, anónima con JWT opcional.
- `frontend/src/components/Providers.tsx` — envuelve children con `<ErrorBoundary>`.
- `frontend/src/app/dashboard/page.tsx` + `dashboard/salud/page.tsx` — añadido estado `initError` (en dashboard no existía), bloque UI con botón "Reportar problema", `trackLastAction` en `handleSync` y `handleGenerate`.

### Fase 3 — Hardening de concurrencia y seguridad (`c7a8b6a`)

10 hallazgos del análisis técnico fueron priorizados por severidad real. Tras discutir cada uno, se implementaron los que tenían impacto real sin introducir riesgo nuevo.

**Implementados:**

1. **Sync nunca borra reseñas preexistentes** (`PlacesController.cs`). Antes, en modo inicial, se borraban reseñas que no vinieran en la respuesta de Outscraper. Si Outscraper fallaba y devolvía lista vacía o parcial, se perdían datos. Ahora la sincronización es 100% aditiva: solo inserta nuevas y actualiza las que tienen `ownerAnswer` recién llegada. El cron ya era seguro (solo INSERT), no se tocó.

2. **Logs de `GoogleBusinessService` saneados.** Se volcaban bodies completos de las respuestas de Google Accounts/Locations v1/v4 en nivel Information (`"[GBP] Accounts response: {Body}"`). Los logs de Railway son persistentes → potencial leak de nombres de cuentas e IDs. Ahora solo se loguea status HTTP + contadores (nº de cuentas, nº de locales añadidos). Los logs de error mantienen el body porque Google devuelve códigos tipo `{"error":{"code":400,"message":"..."}}` sin datos sensibles.

3. **Circuit breaker en llamadas a Claude** (`Program.cs` + `ClaudeService.cs`). Añadido paquete `Microsoft.Extensions.Http.Resilience` 9.0.0. El `HttpClient` del SDK de Anthropic ahora tiene:
   - `Timeout = 90s` (antes: infinito por defecto).
   - `AddResilienceHandler("claude-pipeline")` con circuit breaker (ventana 30s, 50% fallos, mínimo 8 requests, break 30s) + timeout por intento 85s.
   - Motivación: si Claude cae, antes cada request esperaba el timeout default y el thread pool se saturaba → Velacre entero caía. Ahora el circuito abre tras 8 fallos y los requests fallan al instante con `BrokenCircuitException` → solo cae "generar respuesta", el resto de la app (dashboard, settings, publicar, métricas) sigue funcionando.
   - Se refactorizó el ctor de `ClaudeService` para aceptar `HttpClient` externamente e inyectarlo al `AnthropicClient(auth, http, null)`.

4. **DeleteMe atómico vía RPC Postgres** (`UsuarioController.cs` + Supabase). Antes eran 4-5 pasos secuenciales sin transacción: si fallaba en medio, usuario quedaba con reviews borradas + negocio huérfano + auth.users no eliminado. Ahora se llama a `delete_user_cascade(p_user_id)` — función SQL con `SECURITY DEFINER` que borra dentro de una única transacción: reviews, radar_analisis, competidores, google_connection, analisis_ia, negocios y anonimiza el usuario. Si algo falla, Postgres hace rollback automático. La cancelación de Lemon Squeezy y el delete de `auth.users` quedan fuera porque son APIs externas. **Fallback manual mantenido en el .NET** por si la RPC no está desplegada.

5. **N+1 keywords sustituido por RPC** (`ReviewController.cs`). El fallback de keywords cargaba **todas** las reseñas del negocio en memoria para calcular las 6 más usadas por la IA. Para negocios con miles de reseñas era un N+1 y un spike de memoria. Ahora se llama a `get_top_keywords(p_negocio_id, p_limit)` — función SQL con `CROSS JOIN LATERAL unnest(keywords_usadas)` + GROUP BY que devuelve solo las 6 top. Si la RPC falla, fallback al nombre del negocio como keyword.

6. **`StatusCode(500, ex.Message)` eliminado** (7 sitios en 4 controllers). El patrón exponía internals del backend al cliente y era inconsistente con el shape esperado. Sustituidos por `throw;` para que el `GlobalExceptionMiddleware` los capture y devuelva `{error, mensaje, errorId}` estándar. El log server-side sigue conservando el stack completo. Único caso no-puro: `AdminController.MiniRadar` devolvía `{error:"ai_error", mensaje: ex.Message}` → ahora devuelve mensaje genérico.

7. **Bulk delete** (`GoogleBusinessService.DeleteAllReviewsForNegocioAsync`). Era un loop `foreach` con `DELETE` individual por reseña (O(N) queries). Ahora 1 query bulk con `.Where(r => r.IdNegocio == negocioId).Delete()`.

8. **Helper `FireAndForget.Run(task, logger, tag)`** (`backend/Infrastructure/FireAndForget.cs`). Sustituye al patrón `_ = _email.SendXAsync()` que descarta errores silenciosamente. Aplica `ContinueWith` con log de excepciones. Usado en `LemonController.Webhook` (hasta el siguiente punto) y en `UsuarioController.CreateProfile` (welcome email).

9. **Emails redundantes eliminados del webhook LemonSqueezy** (`LemonController.cs`). Lemon Squeezy ya envía emails al cliente en cada evento de suscripción (compra con factura, cancelación, expiración). Velacre estaba enviando los suyos en paralelo → cliente recibía 2 emails casi idénticos por cada evento. Eliminadas las llamadas a `SendSubscriptionConfirmedAsync`, `SendSubscriptionCancelledAsync` y `SendSubscriptionExpiredAsync` desde el webhook. Los métodos en `EmailService.cs` se quedan definidos por si se reutilizan. **Mantenido el email de Welcome** (`SendWelcomeAsync`) en `POST /api/usuario` — es el único que Velacre envía, cubre onboarding incluso para usuarios que no pagan.

**No implementados (backlog por decisión):**

- **Rate limiting aplicativo** — no crítico hoy sin atacantes activos; buena práctica pero requiere tuning para no molestar a clientes.
- **Race condition contador manual** — 99% imposible (usuario no hace 2 manuales a la vez).
- **Supabase singleton sync init** — resuelto en infraestructura: Railway 5$/mes 24/7 sin cold start.
- **Idempotencia webhook LS** — confirmado que no era duplicación; eran emails distintos (welcome LS + order confirmation LS + welcome Velacre + subscription confirmed Velacre). Resuelto con la eliminación de los 3 emails redundantes de Velacre (punto 9 arriba).
- **`SendRetainedReviewAlertAsync` nunca invocado** — decidido dejar a futuro.

### Nuevas RPCs en Supabase (pegadas en SQL Editor)

```sql
-- get_top_keywords(p_negocio_id uuid, p_limit int) → TABLE(word, count)
-- Calcula server-side las keywords más usadas por la IA en el negocio.

-- delete_user_cascade(p_user_id uuid) → void (SECURITY DEFINER)
-- Borrado atómico transaccional de todos los datos del usuario:
-- reviews → radar_analisis → competidor → google_connection → analisis_ia → negocio → usuario (anonimizado).
```

Ambas con `GRANT EXECUTE` a `authenticated, service_role`. El SQL completo está documentado en la propuesta de implementación de Fase 3 (sección interna de trabajo).

### Paquetes nuevos en backend

- `Microsoft.Extensions.Http.Resilience` 9.0.0 (para el circuit breaker de Claude).

### Nueva carpeta `backend/Infrastructure/`

Antes estaba vacía (el análisis inicial lo flagueaba como code smell). Ahora contiene:
- `GlobalExceptionMiddleware.cs`
- `FireAndForget.cs`

### Validación

- `dotnet build` → 0 errores, 22 warnings preexistentes (todos `CS8603` en controllers no tocados).
- `tsc --noEmit` del frontend → 0 errores.
- Lint: sin errores nuevos introducidos (los 16 warnings existentes eran preexistentes).

### Qué puede ver el usuario ahora cuando algo falla

| Escenario | Antes | Ahora |
|---|---|---|
| Component crash (error en render) | Pantalla blanca | `app/error.tsx` / `ErrorBoundary` con botón "Reportar problema" |
| Crash del root layout | Pantalla blanca | `global-error.tsx` con `<html>/<body>` propios |
| 500 del backend al generar | Texto raw con `ex.Message` + internals | `{error, mensaje, errorId}` consistente + botón Reportar |
| Claude caído (outage) | Todo Velacre cae | Solo "generar respuesta" cae; resto de la app funciona |
| Backend inalcanzable en init | Mensaje genérico | Mensaje + botón "Reportar problema" con contexto |
| 401 / 429 / 403 | Flujos actuales (redirect login / upsell / forbid) | Idénticos, no se tocaron |

### Archivos relevantes para futuras referencias

- Backend: `Infrastructure/GlobalExceptionMiddleware.cs`, `Infrastructure/FireAndForget.cs`, `Controllers/ReportErrorController.cs`, `Models/Requests/ReportErrorRequest.cs`, `Services/EmailService.cs:SendErrorReportAsync`.
- Frontend: `components/ErrorBoundary.tsx`, `components/ReportErrorModal.tsx`, `app/error.tsx`, `app/global-error.tsx`, `lib/errorReporter.ts`, `lib/api.ts:reportError`.
- Supabase RPC: `get_top_keywords`, `delete_user_cascade`.
