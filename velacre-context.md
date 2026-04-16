# Velacre — Contexto del proyecto

> **Última actualización:** 2026-04-16. Para detalle técnico exhaustivo (endpoints, servicios, seguridad, concurrencia), ver `velacre-context-technical.md`.

---

## 1. ¿Qué es Velacre?

SaaS B2B que permite a negocios locales gestionar y responder reseñas de Google con IA. Genera respuestas en 6 tonos, detecta reseñas críticas antes de contestar, y ofrece inteligencia competitiva con un Radar que analiza a los rivales del negocio.

**Nombre legal:** Velacre · **Dominio:** velacre.com · **Email:** info@velacre.com

---

## 2. ICP y mercado objetivo

**Mercado primario:** PYMEs de hostelería en Galicia (España) — restaurantes, asadores, cafeterías, bares con cocina. Dueño-operador que recibe 5-50 reseñas/mes, no tiene tiempo de contestarlas, y le preocupa lo que dicen de su negocio en Google.

**Mercado secundario (validado para escalar):** cualquier PYME de servicios locales hispanohablante — clínicas pequeñas, talleres, peluquerías, academias, hoteles boutique. Los prompts de IA son neutrales por sector y mercado desde 2026-04-09.

**Perfil del decisor:** dueño de negocio de 30-55 años, vive del móvil, no sabe qué es "SEO" ni quiere saberlo, pero entiende que las reseñas de Google afectan a su negocio. Valora lenguaje directo sin jerga técnica.

---

## 3. Propuesta de valor y posicionamiento

**Claim principal:** *"El único SaaS español que no solo responde tus reseñas — te dice qué mejorar vs tu competencia."*

**3 armas únicas que ningún competidor español tiene:**
1. **Filtro de seguridad en reseñas críticas** — retiene automáticamente reseñas sobre intoxicaciones, amenazas legales, acusaciones graves o datos personales sensibles antes de generar respuesta. Coste cero (misma llamada IA). Argumento de marca: "el único que no te cagará encima en reseñas críticas".
2. **Radar de Competencia IA** — análisis comparativo contra hasta 3 rivales con scoring 0-10 por categorías detectadas dinámicamente, amenaza por competidor (alta/media/baja), y acción concreta semanal. Hero feature del plan Pro.
3. **PDF benchmark mensual/anual** — informe descargable con KPIs, distribución estrellas, evolución, diagnóstico IA, y matriz competitiva si hay Radar.

**Posicionamiento vs competencia:** no intentamos ser "wiReply más barato". Somos "el que te da inteligencia competitiva + filtro de seguridad + plan gratis real". La publicación directa en Google llegará con la aprobación de GBP, pero no es la única propuesta de valor.

---

## 4. Stack técnico (resumen conceptual)

| Capa | Qué hace | Tecnología |
|------|----------|-----------|
| Backend | API REST, lógica de negocio, integraciones | .NET 10 (C#) en Railway |
| Frontend | App web (SPA + PWA instalable) | Next.js 16 + React 19 en Vercel |
| Base de datos | Persistencia + auth + RPCs atómicas | Supabase (PostgreSQL) |
| IA | Generación de respuestas, filtro seguridad, análisis competitivo | Claude Sonnet 4.6 via Anthropic SDK |
| Pagos | Checkout, suscripciones, portal de gestión | Lemon Squeezy (Merchant of Record, IVA incluido) |
| Scraping reseñas | Importación de reseñas de Google | Outscraper API |
| Reseñas nativas | Importación + publicación directa en Google | Google Business Profile API (implementado, pendiente aprobación) |
| Email | Bienvenida, reportes de error | Resend (info@velacre.com) |
| Búsqueda de lugares | Onboarding, Mini Radar | Google Places API |

**Estado del código (~21k líneas):** 49 endpoints, 11 controllers, 7 repositorios, 5 servicios, 9 entidades BD. ~12-15% cobertura de tests (53 tests: 18 backend xUnit, 35 frontend Vitest). Capa de repositorios + FluentValidation + React Query (frontend). RLS en 7 tablas (22 policies). Auth SSR con proxy.ts + @supabase/ssr. Error handling global (2026-04-12). Circuit breaker en Claude. Sin rate limiting aplicativo (backlog).

---

## 5. Arquitectura conceptual

```
 Navegador / PWA (Next.js)
       │
       │ JWT Bearer (Supabase Auth)
       ▼
 Backend .NET 10 (Railway)
   ├── Claude IA (respuestas, filtro, radar, análisis)
   ├── Google Places (búsqueda de negocios)
   ├── Google Business Profile (OAuth, reseñas, publicación — pendiente activación)
   ├── Outscraper (scraping reseñas Google)
   ├── Lemon Squeezy (checkout + webhooks suscripción)
   └── Resend (emails transaccionales)
       │
       │ Postgrest SDK
       ▼
 Supabase (PostgreSQL + Auth + RPCs)
```

**Auth:** Supabase Auth (email+pwd y Google OAuth) → JWT ES256 → backend valida con JWKS. Protección de rutas server-side con `proxy.ts` + `@supabase/ssr` (cookies HTTP, sin flashing). RLS en 7 tablas (22 policies).

**Modelo de datos (entidades principales):**
- `usuario` — perfil, plan, estado, contadores de uso, datos suscripción LS
- `negocio` — nombre, tono, place_id, palabras clave SEO (hasta 5)
- `review` — reseña importada con estado (pendiente/respondida/ignorada), 3 respuestas generadas, filtro seguridad (retenida/motivoRetencion)
- `analisis_ia` — diagnóstico IA del panel salud (brilla/quema/acción)
- `competidor` + `radar_analisis` — competidores y análisis comparativo (Pro)

---

## 6. Planes, precios y estrategia de pricing

| Plan | Precio mensual | Precio anual | Target |
|------|---------------|-------------|--------|
| **Basic** | Gratis | — | Trial real: experimentar el producto antes de pagar |
| **Core** | €19/mes | €190/año | PYME con 5-25 reseñas/mes que quiere IA + estadísticas |
| **Pro** | €49/mes | €490/año | Dueño que quiere inteligencia competitiva + todo ilimitado |

**Fórmula anual:** ~10 meses × precio mensual.

### Límites por plan

| | Basic | Core | Pro |
|---|---|---|---|
| Respuestas manuales/mes | 5 | 5 | Ilimitadas |
| Respuestas IA/mes | 10 | 20 | Ilimitadas (cap soft 250 con warning) |
| Panel Salud | Teaser blurred | Stats clave reales (4 KPIs + sentimiento) | Completo |
| Radar Competencia | — | — | ✅ (3 competidores, 2 análisis/mes) |
| PDFs benchmark | — | — | ✅ |
| Análisis IA (brilla/quema/acción) | — | — | ✅ |

### Incluido en todos los planes (transversal)
- Filtro de seguridad (retiene reseñas críticas)
- 6 tonos de respuesta (Profesional, Empático, Cercano, Directo, Agradecido, Humorístico)
- Respuestas en el idioma de la reseña
- Sin permanencia

### Lógica del pricing

- **Basic a 10 IA** (antes 3): que el dueño experimente el producto de verdad. Conversión Basic→Core esperada +20-40%.
- **Core a €19 y 20 IA** (antes 18): 15% por debajo de wiReply (€22,50). 20 IA cuadra con ICP de 5-25 reseñas/mes; deja 5+ sin responder para empujar a Pro.
- **Pro a €49**: 5× por debajo de RepScan (€249). Justificado por Radar + PDF + análisis IA. Cap soft 250/mes detecta posibles enterprise sin bloquear.
- **Descuentos activos en LS:** 99% para test (tarjeta de colega) y 15% para primeros clientes captados.

### Estrategia de precios post-GBP

Cuando se active la integración directa con Google Business Profile:
- Core sube a **€29/mes** (incluye auto-publicación en Google)
- Pro sube a **€69/mes** (incluye auto-publicación + Radar)
- Basic mantiene gratis (importa reseñas de GBP pero publica manualmente vía copy-paste)

### Estado de pagos

Checkout Lemon Squeezy implementado y probado en modo test Y en live mode. Tienda sin activar hasta alta como autónomo — cuando se active, los pagos en producción se procesarán automáticamente con IVA correcto (LS como Merchant of Record).

---

## 7. Features principales del producto

### Generación de respuestas IA
- 6 tonos: Profesional, Empático, Cercano, Directo, Agradecido, Humorístico
- Idioma automático: responde en el mismo idioma de la reseña
- Palabras clave SEO: hasta 5 por negocio, se incluyen con naturalidad en las respuestas (Claude decide cuáles encajan). Fallback: si no hay keywords, usa las 6 más frecuentes de respuestas previas; si tampoco, usa el nombre del negocio.
- Contexto generado: "Lo que dijo el cliente" + "Lo que respondiste" para cada reseña

### Filtro de seguridad (transversal)
Detecta en la misma llamada IA (sin coste extra) reseñas que describen:
- Intoxicación alimentaria o enfermedad grave
- Acusaciones de agresión, malos tratos o acoso
- Amenaza explícita de denuncia judicial
- Datos personales sensibles
- Acusaciones de fraude, estafa o engaño deliberado (no simples quejas de precio)
- Acusaciones de discriminación (raza, nacionalidad, género, etc.)

Si detecta: retiene la reseña, no genera respuesta, hace rollback del contador IA. En el dashboard: badge ⚠ naranja, banner de aviso, botones deshabilitados.

### Generador para otras plataformas
Modal separado para TripAdvisor, Yelp, etc. Genera 1 respuesta en el tono del negocio (mismo flujo que reseñas Google). Bottom-sheet en móvil, centrado en desktop.

### Panel de Salud (Core/Pro)
- **Core:** nota media real, 4 KPIs, sentimiento, cards Pro bloqueadas con skeleton (sin datos reales bajo el blur)
- **Pro:** todo lo anterior + análisis IA bajo demanda (brilla/quema/acción), velocidad de respuesta, evolución mensual, Radar de Competencia, PDFs descargables

### Radar de Competencia (Pro)
1. Añadir hasta 3 competidores buscando por nombre (Google Places)
2. Analizar: carga reseñas propias de BD + scraping 20 reseñas por competidor
3. Claude genera: fortaleza/debilidad propias, tabla competidores con amenaza, oportunidades, acción semanal, matriz de sentimiento 0-10 por 4 categorías dinámicas, acción Pro estratégica
4. Límite: 2 análisis por mes natural
5. Coste real por análisis: ~€0,22-0,28 · Desglose: 3 competidores × 20 reseñas cada uno = 60 reseñas Outscraper (~$0,18 ≈ €0,17) + 1 llamada a Claude Sonnet (~€0,05-0,10 según longitud de reseñas propias incluidas). Anteriormente documentado como "~€0,02-0,06" por error de modelo de pricing (Outscraper cobra por reseña, no por llamada).

### PDFs benchmark (Pro)
- **PDF mensual:** cabecera Atlantic Blue, 6 KPIs, velocidad de respuesta, distribución estrellas con comparativa, evolución, keywords, diagnóstico IA, matriz competitiva si hay Radar
- **PDF anual:** gráfico de barras verticales mes a mes
- Generados client-side con jsPDF

### Sync de reseñas
- Inicial: 60 reseñas vía Outscraper
- Incremental: hasta 500, detecta reseñas respondidas directamente en Google
- Cron semanal automático (martes)
- Si GBP conectado: usa API nativa de Google (pendiente activación)

### Google Business Profile (implementado, deshabilitado)
Backend completo: OAuth flow, listar locales, publicar respuestas directamente en Google. Frontend deshabilitado con badges "Próximamente" en onboarding, settings y dashboard. Botón "Responder en Google" activo que abre business.google.com para copy-paste manual.

**Bloqueante:** aprobación "Application for Basic API Access" de Google (enviada, plazo 7-10 días hábiles).

**Modo de publicación (diseño decidido, pendiente de implementar):** por defecto, modo supervisado — el usuario revisa y aprueba cada respuesta antes de publicar en Google. Para activar auto-publicación, el usuario debe marcar un toggle en Settings y guardar cambios. Esto es deliberado: los dueños de negocio tienen miedo a que la IA publique sin su control. El modo supervisado es el estándar, auto-publicar es opt-in explícito.

### Mini Radar — herramienta de prospección B2B (admin)
Herramienta interna para generar informes gratuitos de cualquier negocio como lead magnet de outreach. Busca por Google Places, scraping de reseñas de los últimos 30 días (cutoff server-side + limit 60) con `owner_answer` mapeado → Claude analiza reseñas y respuestas → PDF de 3 páginas con KPIs, quejas sin responder, **oportunidad detectada** (patrón de mejora concreto con 3 ejemplos reales), diagnóstico IA y email pitch en lenguaje humano (sin jerga SEO).

**Transparencia**: PDF muestra rango real de fechas del sample (*"Análisis de las N reseñas más recientes, del X al Y"*). No ment "30 reseñas del último mes" cuando el sample cubre menos (high-volume) o más (low-volume). Layout: 3 tarjetas KPI en fila (Rating / Reseñas analizadas con rango / % Respondidas).

**Coste real por informe**: ~€0,13-0,18 (Outscraper reviews-v3 ≈ $0,003 por reseña devuelta, ~$0,09-0,18 dependiendo del volumen + 1 llamada Claude Sonnet ≈ €0,05-0,10). Sin persistencia. Prompt con auto-revisión que prohíbe tecnicismos ("SEO", "CTR", "ranking", etc.) y obliga a lenguaje de "vecino que quiere echar una mano".

### PWA instalable
Service Worker + manifest. Instalable en Android (prompt nativo) e iOS (instrucciones "Compartir → Añadir"). Banner solo en landing/inicio, primera vez de por vida, auto-hide 10s.

### Modo oscuro forzado
Siempre dark. Fondo #0f172a, acento blue. Cal Sans para headers, Geist para body.

### Multiidioma (i18n)
3 idiomas: castellano (por defecto), gallego e inglés. Sistema basado en `LanguageProvider` con persistencia en `localStorage`. Todos los textos visibles al usuario usan el sistema i18n (~800 claves tipadas en TypeScript). Páginas de error crítico (`global-error.tsx`) mantienen fallback en español por seguridad (Provider puede no estar disponible).

**Selector de idioma:** botón flotante fijo en esquina inferior izquierda (mismo estilo que el botón de ayuda `?` en inferior derecha). Muestra el código del idioma activo (ES/GL/EN), click abre dropdown hacia arriba con los 3 idiomas (Castellano, Galego, English). Montado globalmente desde `Providers.tsx` — visible en todas las páginas sin necesidad de añadirlo a cada header. Tooltip al hover. Click-outside para cerrar.

---

## 8. Flujo de usuario

```
Registro (Google OAuth o email)
  ↓ auth/callback → crea usuario + email bienvenida
  ↓ /onboarding
    Step 1: datos negocio + tono + hasta 5 palabras clave SEO
    Step 2: buscar Google Place (GBP deshabilitado → Próximamente)
    Step 3: sync inicial (60 reseñas)
  ↓ /onboarding/plan
    Elegir Core/Pro (checkout LS) o continuar gratis (Basic)
  ↓ /dashboard
    Ver reseñas, generar IA, copy-paste a Google, generador manual
    Mobile: master-detail con "← Volver"
  ↓ /dashboard/salud (Core/Pro)
    Métricas, análisis IA, Radar, PDFs
  ↓ /settings
    Perfil, tono, keywords, plan, portal LS, danger zone
```

---

## 9. Integraciones (qué y por qué)

| Integración | Por qué | Estado |
|---|---|---|
| **Claude (Anthropic)** | Motor de IA para respuestas, filtro seguridad, radar, análisis. Claude detecta dinámicamente categorías de sentimiento y adapta el lenguaje al idioma de la reseña. | ✅ Activo. Circuit breaker implementado. |
| **Outscraper** | Scraping de reseñas de Google sin necesidad de OAuth. Pricing oficial: **~$0,003 por reseña scrapeada** (Reviews V3 endpoint), es decir ~$0,18 por llamada estándar de 60 reseñas y ~$0,09 por una de 30. Permite importar reseñas desde el día 1 sin aprobación de Google. | ✅ Activo. Fallback si GBP no está conectado. |
| **Google Business Profile** | Importación nativa + publicación directa de respuestas en Google (sin copy-paste). Valor diferencial clave vs competencia. | 🟡 Implementado, pendiente aprobación Google. |
| **Google Places** | Buscar negocios por nombre en onboarding y Mini Radar. | ✅ Activo. |
| **Lemon Squeezy** | Pagos con IVA incluido (MoR), checkout, portal de gestión para el cliente, webhooks de suscripción. Sin necesidad de gestionar facturación propia. | ✅ Implementado y probado. Pendiente activación tienda (alta autónomo). |
| **Resend** | Emails transaccionales (bienvenida, reportes de error). Los emails de suscripción los envía LS directamente. | ✅ Activo. |
| **Supabase Auth** | Auth con email+pwd y Google OAuth. JWT para el backend. Sin dependencia de auth propio. | ✅ Activo. |

---

## 10. Análisis de competencia (condensado)

### wiReply (SocialwiBox) — competidor directo
- **Target:** negocios locales multi-ubicación, hostelería/hoteles/retail
- **Precio:** ~€22,50/mes (calculadora dinámica, trial 7d sin tarjeta)
- **Nos gana en:** integración GBP real con publicación automática, multi-ubicación nativa, presencia mediática
- **Le ganamos en:** Radar de Competencia, filtro de seguridad, PDF benchmark, plan gratis, pricing transparente, precio 15% menor

### RepScan — referencia premium
- **Target:** restaurantes, clínicas, hoteles, cadenas, personal branding
- **Precio:** SaaS €249/mes (5× más caro que Velacre Pro). Servicios extra: eliminar reseñas €99, auditoría GBP €80
- **Nos gana en:** servicios de eliminación de reseñas (legal), marca consolidada, 9 tonos, modo supervisado, multi-perfil
- **Le ganamos en:** precio (5× menor), plan gratis, Radar competencia, filtro seguridad, onboarding self-service

### Matriz resumen

| | Velacre | wiReply | RepScan |
|---|---|---|---|
| Plan gratis | ✅ | ❌ | ❌ |
| Precio entrada | €19 | €22,50 | — |
| Precio Pro/SaaS | €49 | ~€22,50 | €249 |
| GBP publicación | 🟡 Próximamente | ✅ | ✅ |
| Filtro seguridad | ✅ único | ❌ | ❌ |
| Radar competencia | ✅ único | ❌ | ❌ |
| PDF benchmark | ✅ único | 🟡 | ❌ |
| Multi-ubicación | ❌ | ✅ | ✅ |

### Dónde podemos ganar ya (sin GBP)
- PYMEs con 5-30 reseñas/mes → Basic gratis o Core €19 (más barato que wiReply)
- Dueños que quieren **saber** qué mejorar → Pro €49 con Radar (sin competencia estatal)
- Sectores fuera de hostelería pura donde wiReply no llega

### Dónde NO competir hasta tener GBP
- Cadenas 3+ locales, franquicias, grandes hoteles
- Demos side-by-side donde el criterio es "quién publica solo en Google"

---

## 11. Decisiones de diseño clave (con el porqué)

### Producto y UX
- **Modo oscuro forzado:** decisión estética deliberada. Velacre es una herramienta de trabajo, no un portal público. Dark reduce fatiga visual para dueños que lo usan al final del día.
- **6 tonos:** Profesional, Empático, Cercano, Directo, Agradecido y Humorístico. Agradecido pensado para reseñas positivas (4-5 estrellas), incluye keywords del negocio con naturalidad. Gap vs RepScan (9 tonos) reducido significativamente.
- **Filtro seguridad transversal (no solo Pro):** coste cero (misma llamada Claude) y es el mejor argumento de marca. Desde 2026-04-10 comunicado como feature de todos los planes en la landing.
- **GBP deshabilitado con "Próximamente":** todo el código está listo. La UI muestra badges y elementos con opacity reducida. Activación será quitar CSS, no desarrollar nada nuevo.
- **Copy-paste como flujo interino:** mientras no haya GBP, botón "Responder en Google" abre business.google.com. Con PWA en el móvil, el flujo generar→copiar→pegar es razonable para ≤50 reseñas/mes.

### Pricing
- **Core a €19:** 15% por debajo de wiReply deliberadamente. Post-GBP subirá a €29 (justificado por auto-publicación).
- **Pro a €49:** 5× por debajo de RepScan. El Radar + PDF justifican el precio por sí solos. Post-GBP subirá a €69.
- **Cap soft 250/mes Pro:** no bloquea, solo avisa. Detecta casos enterprise para pricing custom futuro.

### Técnicas
- **Prompts sin hardcodes geográficos:** desde 2026-04-09 los prompts de Claude no mencionan "Galicia" ni "hostelería". El contexto se inyecta vía descripción del negocio + keywords + reseñas del cliente. Permite escalar a cualquier sector.
- **Prompts sin jerga SEO:** el Mini Radar prohíbe expresamente "SEO", "CTR", "ranking", "KPI", etc. Usa lenguaje de "vecino que quiere echar una mano". Incluye ejemplos buenos/malos y auto-revisión.
- **Contador IA atómico:** RPC PostgreSQL para evitar race conditions. Check + increment en una operación SQL.
- **Checkout LS con redirect_url en product_options:** no en atributos raíz (particularidad de la API de Lemon Squeezy).
- **Eliminación de cuenta transaccional:** RPC Postgres que borra todo en una transacción. La cancelación de LS y delete de auth.users quedan fuera por ser APIs externas.
- **Error handling global (2026-04-12):** el usuario nunca ve pantalla en blanco. Error → mensaje amable + botón "Reportar problema" → email a info@velacre.com con contexto (sin stack trace).

---

## 12. Cronología estratégica de decisiones

### 2026-04-09
- **Pro sube a €49/mes** (antes €39). Posicionamiento competitivo vs RepScan (€249) con margen para justificar Radar.
- **Prompts IA neutralizados:** eliminadas referencias a Galicia/hostelería. Velacre puede servir a cualquier PYME hispanohablante.
- **PWA instalable:** Service Worker + manifest + banner de instalación. Presencia en home del móvil = acceso 1 tap a reseñas.
- **Fix flujo móvil:** teasers Basic/Core en salud + redirect post-checkout LS.

### 2026-04-10 (sesión 1)
- **Mini Radar v1:** herramienta de prospección B2B. Genera informes PDF de cualquier negocio como lead magnet. Buscador Google Places, prompt humanizado, email pitch pre-redactado. Coste real ~€0,13-0,18 (inicialmente documentado como ~€0,05 por subestimación del pricing de Outscraper, corregido 2026-04-15).
- **Calculadora landing recalibrada:** tiempos realistas (6 min sin Velacre → 5 seg con Velacre).
- **Email unificado:** `info@velacre.com` en todas las superficies.
- **Banner PWA reescrito:** solo landing/inicio, primera vez de por vida, 10s auto-hide.

### 2026-04-10 (sesión 2)
- **Rebalanceo de límites:** Basic 3→10 IA, Core 18→20 IA, Pro ilimitado con cap soft 250/mes.
- **Filtro seguridad comunicado como transversal:** nuevo bloque "Incluido en todos los planes" en la landing.
- **Copy del Radar mejorado:** vende el valor ("descubre qué hacen mejor tus 3 rivales y qué hacer esta semana").
- **Emails redundantes de LS resueltos:** Lemon Squeezy envía los suyos, Velacre ya no duplica.

### 2026-04-12
- **Doc técnico exhaustivo:** `velacre-context-technical.md` como retrato técnico completo del proyecto.
- **Error handling global:** middleware backend + ErrorBoundary frontend + modal "Reportar problema" + email a admin.
- **Hardening:** sync nunca borra reseñas, logs saneados, circuit breaker en Claude, delete-me atómico, N+1 keywords resuelto, bulk delete, fire-and-forget con logging.
- **Fix RPC Pro bloqueado:** la RPC `try_increment_ia_counter` en producción devolvía `false` con `p_limit=-1`. Fix doble: RPC actualizada en Supabase + backend nunca bloquea Pro por resultado de RPC.
- **Filtro seguridad ampliado:** 2 nuevas categorías — acusación de fraude/estafa y discriminación (6 categorías totales).
- **i18n completo:** 3 idiomas (ES/GAL/EN), ~800 claves tipadas, selector de idioma en todas las páginas, cero textos hardcodeados visibles al usuario. 28 ficheros migrados.
- **6 tonos de respuesta:** añadidos Empático, Agradecido y Humorístico. Modal manual simplificado: genera 1 respuesta en tono del negocio (antes generaba 3 y pedía elegir). Misma UX que reseñas Google. Menos tokens, menos fricción.

### 2026-04-13
- **Tests básicos:** primera infraestructura de tests del proyecto. 25 tests iniciales con mocks (9 backend xUnit, 16 frontend Vitest).

### 2026-04-13/14 — Refactorización arquitectónica
- **Rama `202604_refactor`**, 10 de 11 puntos ejecutados. Nota media de calidad: 3.2/10 → 7.7/10.
- **Backend:** capa de repositorios (7 interfaces + 7 implementaciones), FluentValidation (7 validators), .NET 9→10.
- **Frontend:** React Query (5 hooks), api.ts modular (8 módulos), god components rotos (dashboard 1324→555, landing 744→227), proxy.ts SSR con @supabase/ssr (sin flashing).
- **Seguridad:** RLS activado en 7 tablas (22 policies por auth.uid()). Defense-in-depth.
- **Tests:** 25→53 (backend: +9 controllers, frontend: +19 api modules + hooks).
- **Pospuestos:** R3 (eliminar proxy CRUD — depende de migrar a anon key), R10 (cola emails — tolerable en MVP).

### 2026-04-14 — CI/CD + limpieza backlog
- **GitHub Actions CI:** tests automáticos en cada push (18 backend + 35 frontend + tsc). Deploy bloqueado si fallan.
- **Limpieza:** `html lang` dinámico (accesibilidad), Stripe.net eliminado, `GetUserId()` helper (33 repeticiones eliminadas), prompt mini-radar movido a ClaudeService.

### 2026-04-15 — Pipeline research outreach + fix pricing
- **Pipeline outreach research:** 3 scripts Node standalone en `scripts/outreach/` (sourcing Google Places + verificación Outscraper + scoring local). Config en `queries.json` editable. Sin dependencias npm, lee directamente `backend/.env`. Skip logic y guardado parcial cada 10. Output a `velacre-outreach/raw/` (gitignored) + `prospects.md` (versionado).
- **Batch parcial ejecutado:** 125 candidatos sourced (80 hostelería + 45 hoteles boutique, post-filtro clínicas) · 30 verificados con métricas reales Outscraper (10 Pro + 10 Core + 10 Discard, densidad de candidatos 66%). Batch detenido al 40/125 por control de coste tras error de estimación inicial.
- **Top 15 enriquecido con búsqueda web manual:** ciudad, especialidades, dueños identificados (Rubén Rey en Taberna de Cunqueiro), reconocimientos (Solete Repsol 2025 en O Gato Negro, Bib Gourmand en Casa Marco, Michelin Guide en Noa Boutique), historia (centenaria 1922 en O Gato Negro, 300 años en O Sendeiro). Resultado en `velacre-outreach/prospects.md`.
- **11 DMs personalizados** basados en Template E de Fogar da Carne. 7 restaurantes + 4 hotelitos boutique independientes (verificados sin cadena vía búsqueda web). Orden de ataque definido. En `velacre-outreach/dms-top11.md` + Google Doc subido al Drive del fundador.
- **Fix pricing Outscraper en velacre-context.md:** corregido el shorthand incorrecto "~€0,02/llamada" (4 puntos afectados) al pricing oficial real **~$0,003 por reseña scrapeada** (Outscraper cobra por reseña, no por llamada). Esto implica ~$0,18 por llamada de 60 reseñas. Mini Radar real ~€0,13-0,18 (antes documentado como €0,05). Radar competencia real ~€0,22-0,28 (antes €0,02-0,06).
- **Aprendizaje:** 2 errores consecutivos con Outscraper costaron ~$11 (modelo de pricing mal estimado + relanzar tras bug parseDate sin smoke test previo). Regla guardada en memoria del fundador: autorización explícita obligatoria para cualquier gasto en APIs de pago.

### 2026-04-16 — Sesión intensiva: landing rework + Mini Radar arreglado + outreach en marcha
- **Calculadora ROI eliminada** de la landing (hardcoded ES, no i18n, no resonaba con el target). Reemplazada por **Radar Preview dummy** con 3 competidores ficticios, 4 categorías con barras de score (0-10), badges de amenaza (Alta/Media/Baja) y overlay "Disponible en Pro". Genera FOMO mostrando lo que el plan Pro ofrece.
- **Panel de Salud en landing ampliado:** añadidas 3 tarjetas dummy de análisis IA (brilla/quema/acción) con badge "Solo en Pro", replicando el aspecto real del dashboard Pro.
- **Badges de pricing corregidos:** Core tenía "Más popular" hardcoded en español → ahora i18n (`core.badge`). Pro en EN decía "Most popular" (colisión con Core) → cambiado a "Top choice". Ambos badges usan claves de locale correctas en ES/EN/GAL.
- **Onboarding: logo duplicado en móvil corregido.** Había un `<Link>Velacre</Link>` + `<h1>{ob.title}</h1>` que renderizaban "Velacre" dos veces. Eliminado el redundante, h1 ahora es clickable. Fix aplicado en las 3 ramas condicionales del mismo fichero (loading, GBP select, formulario).
- **i18n completo:** todos los textos nuevos tienen claves en ES/EN/GAL. Gallego revisado (servizo, prezo, ameaza, queixan, recensions). 0 strings hardcodeados en componentes nuevos.
- **Fix PDF em-dash:** los 3 generadores de PDF (mini radar, mensual, anual) ahora sustituyen em-dash/en-dash de LLMs por coma antes del strip WinAnsi, eliminando los huecos raros que aparecían en texto generado por IA.

#### Mini Radar — rediseño crítico (bug + feature + fix timeout)

- **Bug crítico resuelto**: el Mini Radar mostraba `% Respondidas: 0%` siempre. Causa: `AdminController.MiniRadar` llamaba a `GetCompetitorReviewsAsync` que construía el record `OutscraperReview` con solo 5 campos (sin `owner_answer`). Al contestar 0% en todos los PDFs, Velacre mentía a los prospects. Cabañitas del Bosque (83% real) y Porto Santo (0% real) tenían el mismo PDF falso hasta el fix.
- **Nuevo método `GetRecentReviewsAsync(placeId, dias, maxReviews)`** en OutscraperService: usa `cutoff` server-side de Outscraper v3 + filtro client-side por fecha. Mapeo completo incluyendo `owner_answer` y `lang`. Helper privado `MapReview` compartido entre los 3 métodos del servicio (elimina duplicación).
- **Fix del fix (timeout)**: primera versión usaba `maxReviews=200` que causaba `TaskCanceledException` a los 100s en Outscraper síncrono. Bajado a **60**, valor ya validado por el pipeline outreach (queries.json).
- **Transparencia de fechas en el PDF**: la tarjeta KPI ahora dice "Reseñas analizadas: N / del X al Y". Header de página 1: *"Análisis de las N reseñas más recientes, del X al Y"*. Elimina el engaño potencial de "30 reseñas del último mes" cuando el sample cubría menos de 30 días (caso Cabañitas: 60 reseñas en 17 días) o cuando el negocio tenía menos volumen. Layout pasó de 4 tarjetas 2x2 (con "Últimos 30 días" redundante) a 3 tarjetas en fila.
- **Nuevo campo `oportunidad`** en el análisis IA: Claude detecta UN patrón de mejora concreto (respuestas clonadas, positivas sin contestar, queja repetida ignorada, respuestas impersonales, velocidad asimétrica, falta firma) con título + descripción + 3 ejemplos reales extraídos de las reseñas. Se renderiza en pág 2 del PDF. Si no hay patrón claro, Claude devuelve `null` y la sección no aparece (regla estricta anti-alucinación). Llena la página 2 que antes quedaba casi vacía en negocios sin reseñas negativas pendientes — es el hook comercial más potente del informe.
- **Polisher fixes PDF**: eliminado doble guión en bullets de fortalezas/debilidades ("+ - Texto" ahora es solo "+ Texto"). Añadida regex `/\s+([,.;:!?])/g → $1` en `safe()` de ambos PDF (mini-radar + report) para eliminar espacios antes de puntuación que Claude a veces mete.

#### Outreach en marcha — primera oleada enviada

- **DMs enviados**: el top 11 generado el 15 abril + Gumer (añadido tras Mini Radar) están casi todos enviados vía IG DM y email.
- **Respuestas iniciales**: Porto Santo (Vigo) y Cabañitas del Bosque respondieron por IG → pidieron el PDF por email → clavan "visto" en correo (fase de evaluación).
- **Research nuevo** añadido a la memoria de outreach:
  - **Tiagos Churrasco** (Santiago) — chef Fran, churrascaria grande (200 comensales), 30 reseñas/mes, 40% respondidas → ICP ideal, pitch "no respondéis"
  - **Lola & Lía** (Vigo) — hermanas Nazaret y Sheila Silva, cadena de 3 locales → fuera de ICP actual (multi-ubicación en backlog), parkeado hasta implementación
  - **Gumer** (Pontevedra) — chef Andrés Virgós + sala Javier Coya, #1 TripAdvisor Pontevedra, 95% respondidas → pitch "ya respondéis pero..." como Hotel Plaza, ángulo Radar Competencia

#### Infraestructura email operativa

- **Gmail "Send as" con Resend SMTP configurado**: puedes enviar desde `info@velacre.com` a mano (móvil + desktop) manteniendo la app de Gmail. Setup: Resend SMTP (smtp.resend.com:465, user `resend`, password = RESEND_API_KEY) + "Treat as alias" marcado para headers limpios.
- **Email Forwarding de Namecheap activado**: `info@velacre.com` → `infovelacre@gmail.com`. DNS MX del apex publicado (`eforward*.registrar-servers.com`), SPF apex auto-generado. Resend en `send.velacre.com` (subdominio aislado) sigue intacto — el MX de `send` pendiente de re-añadir manualmente en Host Records (Namecheap lo borró al cambiar preset). No bloquea envío, solo afecta tracking de bounces.

#### Saldado de deuda en docs

- **Auditoría completa** de `velacre-context.md` y `velacre-context-technical.md`: 20+ items stale corregidos (métricas de código, conteo de endpoints, descripción de Providers frontend, estado de Stripe.net eliminado, etc.).
- **5 endpoints faltantes documentados** en ReviewController (analysis GET/POST, publish-google, summary alias, estado PUT). Header de controller corregido: 7→13 endpoints.
- **Métricas actualizadas**: LOC ~18k→~21k, endpoints 45→49, claves i18n ~550→~800.

#### Preparación para primer cliente de pago

- **Lemon Squeezy tienda activa en producción** — los prospects que contesten "sí, me registro" pueden pagar directamente Core/Pro sin workaround.
- **`SendRetainedReviewAlertAsync` documentado como dormant por diseño**: la retención ocurre síncronamente cuando el usuario pulsa "generar respuesta", ve el banner ⚠️ en directo. El método queda documentado con comentario explícito para evitar falsos positivos en auditorías futuras. Se conectará cuando exista auto-publicación o cron de generación batch.
- **Backlog técnico pre-cliente**: verificado. **Cero bloqueantes técnicos** para primer registro. Smoke test end-to-end en móvil pendiente (responsabilidad operativa del fundador, no del código).

---

## 13. Pendiente estratégico y técnico

### Prioridad máxima — Activar GBP
- Aprobación de Google enviada (7-10 días hábiles). Backend listo.
- Al activar: quitar CSS de badges "Próximamente" + subir precios Core/Pro.
- Cierra el flanco abierto #1 vs wiReply.

### Prioridad máxima — Activar pagos
- Alta como autónomo → activar tienda LS (payout/datos bancarios).
- Checkout ya probado en test y live mode. Descuentos creados (99% test, 15% primeros clientes).

### Prioridad alta — Outreach / Captación

**Prospect #1 — O Fogar da Carne (Bruno Casal, Narón)**
- Asador premiado, Manuel es cliente habitual. Canal: IG DM @ofogardacarne.
- Workflow: Mini Radar → PDF → personalizar Template E → enviar DM.
- Si no responde en 7 días: NO insistir digitalmente, mencionarlo de palabra como cliente.

**Prospects #2-#5:** Pardiñas (Template C) → Mesón O Pote (B) → Pablo Gallego (B) → A Taberna do Bispo (A).
- Meta: 4-5 outreach → 1-2 respuestas → 1 cliente de pago.

**Warm intro vía Tía Carmiña (Inés Santiago, @inesantiagoo):**
- SOLO después de 2-3 clientes cerrados. Modelo: partnership reseller 20% recurrente o referidos €50-100/cliente.
- Inés es hija de los dueños de Artesa (pizzería Canido) → ruta indirecta posible.

**Al cerrar cada cliente:** pedir testimonio breve + permiso para caso de estudio público.

### Backlog técnico de alto nivel
- **Eliminación de reseñas (Pro):** Claude genera texto de reclamación según políticas de Google → usuario copia y pega en formulario oficial. Velacre no elimina, Google decide.
- **Modo supervisado + auto-publicación:** supervisado es el modo por defecto (decidido). Auto-publicar requiere toggle activo en Settings + guardar. Implementar cuando GBP esté activo.
- **Multi-ubicación:** soporte `negocio[]` por usuario, pricing por local adicional (~€20/mes).
- **Tests:** ~12-15% cobertura (53 tests, 2026-04-14). Backend: ClaudeService + NegocioController + UsuarioController. Frontend: API client + modules + hooks + componentes. Próximos: ReviewController, LemonController, flujos e2e.
- **Rate limiting aplicativo:** no crítico sin atacantes, buena práctica para producción.

### Ideas futuras (post-tracción)
- **Marca blanca (Enterprise+):** agencias ofrecen Velacre con su logo. +€100/mes.
- **QR anti-reseñas negativas:** si 4-5★ → Google Maps; si 1-2★ → nota interna. Descartado para corto plazo (cambio de paradigma de producto).
- **WhatsApp/Gmail semanal:** cron los lunes con recuento + respuestas preparadas.
- **Plan "Chains":** €99-129/mes para cadenas 2-5 locales. Gap entre wiReply y RepScan.
- **Lead magnet público:** `/informe-gratis?place_id=X` (Mini Radar desateado de admin). Valorar tras 5 clientes.

---

## 14. Objetivos de negocio

- **2026:** empezar a facturar para no depender de un empleador. Meta: 25.000€ ARR.
- **Primer hito:** 1 cliente de pago cerrado antes de escalar outreach.
- **Segundo hito:** 3-5 clientes con testimonios → sección "Clientes actuales" en landing.
- **Métrica norte star:** MRR (Monthly Recurring Revenue).

---

## 15. Outreach — herramientas disponibles

- **Mini Radar** (`/admin/mini-radar`): genera informe PDF de cualquier negocio en ~10s. Incluye stats, diagnóstico IA, email pitch pre-personalizado.
- **Word de templates** (`velacre-email-templates-outreach.docx`): 5 plantillas (A-E) con workflow. Template E es el DM exacto para O Fogar da Carne.
- **Canal único:** DM digital (IG, email). Sin puerta fría ni presencial por preferencia del fundador.
- **Instrumentación pendiente:** tracking de aperturas (Resend), dashboard de prospects (cuando haya 10+).

---

*Para detalle técnico (endpoints, servicios, seguridad, pipeline, hallazgos de concurrencia): ver `velacre-context-technical.md`.*
