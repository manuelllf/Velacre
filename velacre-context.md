# Velacre — Contexto del proyecto

> Retrato vigente del producto, mercado y decisiones. No es un diario — es la foto actual. Para detalle técnico exhaustivo (endpoints, servicios, seguridad, concurrencia), ver `velacre-context-technical.md`.

---

## 1. ¿Qué es Velacre?

SaaS B2B que permite a negocios locales gestionar y responder reseñas de Google con IA. Genera respuestas en 6 tonos, detecta reseñas críticas antes de contestar, y ofrece inteligencia competitiva con un Radar que analiza a los rivales del negocio.

Objetivo de Fundador: no depender de empleador toda la vida. 

**Nombre legal:** Velacre · **Dominio:** velacre.com · **Email:** info@velacre.com

---

## 2. ICP y mercado objetivo

**Mercado primario:** PYMEs de hostelería en Galicia (España) — restaurantes, asadores, cafeterías, bares con cocina. Dueño-operador que recibe 15-50 reseñas/mes, no tiene tiempo de contestarlas, y le preocupa lo que dicen de su negocio en Google.

**Mercado secundario (validado para escalar):** cualquier PYME de servicios locales hispanohablante — clínicas pequeñas, talleres, peluquerías, academias, hoteles boutique. Los prompts de IA son neutrales por sector y mercado.

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

**Estado del código (~21k líneas):** 49 endpoints, 11 controllers, 7 repositorios, 5 servicios, 9 entidades BD. ~12-15% cobertura de tests (53 tests: 18 backend xUnit, 35 frontend Vitest). Capa de repositorios + FluentValidation + React Query (frontend). RLS en 7 tablas (22 policies). Auth SSR con proxy.ts + @supabase/ssr. Error handling global. Circuit breaker en Claude. Sin rate limiting aplicativo (backlog).

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
| Respuestas IA/mes | 10 | 25 | Ilimitadas (cap soft 250 con warning) |
| Panel Salud | Teaser blurred | Nota media + resumen básico de reseñas (sin análisis IA) | Completo (4 KPIs + sentimiento + análisis IA brilla/quema/acción) |
| Radar Competencia | — | — | ✅ (3 competidores, 1 análisis/semana) |
| PDFs benchmark | — | — | ✅ |
| Análisis IA (brilla/quema/acción) | — | — | ✅ |

### Incluido en todos los planes (transversal)
- Filtro de seguridad (retiene reseñas críticas)
- 6 tonos de respuesta (Profesional, Empático, Cercano, Directo, Agradecido, Humorístico)
- Respuestas en el idioma de la reseña
- Sin permanencia

### Lógica del pricing

- **Basic a 10 IA** (antes 3): que el dueño experimente el producto de verdad. Conversión Basic→Core esperada +20-40%.
- **Core a €19 y 25 IA:** 15% por debajo de wiReply (€22,50). 25 IA cuadra con ICP de 5-30 reseñas/mes. El ancla Pro es el Radar + análisis IA, no el volumen.
- **Pro a €49**: 5× por debajo de RepScan (€249). Justificado por Radar + PDF + análisis IA. Cap soft 250/mes detecta posibles enterprise sin bloquear.
- **Descuentos activos en LS:** 99% para test (tarjeta de colega) y 20% para primeros clientes captados.

### Estrategia de precios post-GBP

Cuando se active la integración directa con Google Business Profile:
- Core sube a **€29/mes** (incluye auto-publicación en Google). Revisar (quizá a 22'5 igualando competencia o 25 dando análisis ia en panel salud) 
- Pro sube a **€69/mes** (incluye auto-publicación + Radar). Revisar (quizá es demasiado salto y deberíamos poner 44 pre gbp y 55 post gbp? Me empieza a parecer caro 49/69 aunque sepa que tiene valor) 
- Basic mantiene gratis (importa reseñas de GBP pero publica manualmente vía copy-paste)

### Estado de pagos

Checkout Lemon Squeezy **activo en producción** (live mode). Cobra con IVA correcto automáticamente (LS como Merchant of Record). Los prospects que conviertan pueden pagar Core/Pro directamente desde el onboarding sin workaround manual.

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
- **Pro:** todo lo anterior + análisis IA bajo demanda (brilla/quema/acción, 1/día), velocidad de respuesta, evolución mensual, Radar de Competencia, PDFs descargables

### Radar de Competencia (Pro)
1. Añadir hasta 3 competidores buscando por nombre (Google Places)
2. Analizar: carga reseñas propias de BD + scraping 20 reseñas por competidor
3. Claude genera: fortaleza/debilidad propias, tabla competidores con amenaza, oportunidades, acción semanal, matriz de sentimiento 0-10 por 4 categorías dinámicas, acción Pro estratégica
4. Límite: 1 análisis por semana (ISO, empieza lunes UTC)
5. Coste real por análisis: ~€0,22-0,28 · Desglose: 3 competidores × 20 reseñas cada uno = 60 reseñas Outscraper (~$0,18 ≈ €0,17) + 1 llamada a Claude Sonnet (~€0,05-0,10 según longitud de reseñas propias incluidas). Anteriormente documentado como "~€0,02-0,06" por error de modelo de pricing (Outscraper cobra por reseña, no por llamada).

### PDFs benchmark (Pro)
- **PDF mensual:** cabecera Atlantic Blue, 6 KPIs, velocidad de respuesta, distribución estrellas con comparativa, evolución, keywords, diagnóstico IA, matriz competitiva si hay Radar
- **PDF anual:** gráfico de barras verticales mes a mes
- Generados client-side con jsPDF

### Sync de reseñas
- Inicial: 60 reseñas vía Outscraper
- Incremental: hasta 500, detecta reseñas respondidas directamente en Google
- Cron diario a medianoche. 
- Si GBP conectado: usa API nativa de Google (pendiente activación)

### Google Business Profile (implementado, deshabilitado)
Backend completo: OAuth flow, listar locales, publicar respuestas directamente en Google. Frontend deshabilitado con badges "Próximamente" en onboarding, settings y dashboard. Botón "Responder en Google" activo que abre business.google.com para copy-paste manual.

**Bloqueante:** aprobación "Application for Basic API Access" de Google (enviada, plazo 7-10 días hábiles). Rechazada por no tener antigüedad de +60 días. 

**Modo de publicación (diseño decidido, pendiente de implementar):** por defecto, modo supervisado — el usuario revisa y aprueba cada respuesta antes de publicar en Google. Para activar auto-publicación, el usuario debe marcar un toggle en Settings y guardar cambios. Esto es deliberado: los dueños de negocio tienen miedo a que la IA publique sin su control. El modo supervisado es el estándar, auto-publicar es opt-in explícito.

### Mini Radar — herramienta de prospección B2B (admin)
Herramienta interna para generar informes gratuitos de cualquier negocio como lead magnet de outreach. Busca por Google Places, scraping de reseñas de los últimos 30 días (cutoff server-side + limit 60) con `owner_answer` mapeado → Claude analiza reseñas y respuestas → PDF de 3 páginas con KPIs, quejas sin responder, **oportunidad detectada** (patrón de mejora concreto con 3 ejemplos reales), diagnóstico IA y email pitch en lenguaje humano (sin jerga SEO).

**Transparencia**: PDF muestra rango real de fechas del sample (*"Análisis de las N reseñas más recientes, del X al Y"*). No ment "30 reseñas del último mes" cuando el sample cubre menos (high-volume) o más (low-volume). Layout: 3 tarjetas KPI en fila (Rating / Reseñas analizadas con rango / % Respondidas).

**Coste real por informe**: ~€0,13-0,18 (Outscraper reviews-v3 ≈ $0,003 por reseña devuelta, ~$0,09-0,18 dependiendo del volumen + 1 llamada Claude Sonnet ≈ €0,05-0,10). Sin persistencia. Prompt con auto-revisión que prohíbe tecnicismos ("SEO", "CTR", "ranking", etc.) y obliga a lenguaje de "vecino que quiere echar una mano".

### PWA instalable
Service Worker + manifest. Instalable en Android (prompt nativo) e iOS (instrucciones "Compartir → Añadir"). Banner solo en landing/inicio, primera vez de por vida, auto-hide 10s.

### Transiciones marketing ↔ producto
Overlay fullscreen que cubre el salto entre landing y app con un rito de paso editorial:
- **Welcome** (entrada post-auth): crema → navy, *"Bienvenido a velacre"* en 3 idiomas. Se activa con `?welcome=1` (login/register email-pwd) o sessionStorage `vel_welcome` (OAuth Google, armado antes del redirect externo para sobrevivir a `google.com`).
- **Goodbye** (logout): navy → crema, *"Hasta luego"* / *"See you soon"* / *"Ata logo"*. Armado antes del `signOut` + hard reload a `/`.
- 6 fases (enter → hold → morph → rest → fade → gone, ~2400-3200ms). La interpolación de color (bg + texto) ocurre durante el morph con el texto aún visible — se ve la marca pasar de ink sobre paper a paper sobre ink en directo.
- Sincroniza con `usePathname`: si el overlay arranca en `/auth/callback` (Google OAuth), espera al cambio de ruta antes del fade. Fallback 5s para flujos sin navegación posterior.
- Cortina anti-flash pre-paint: script inline en `<head>` del `RootLayout` lee sessionStorage antes del primer paint y muestra un `<div>` estático que cubre la landing SSR hasta que React hidrata el overlay. Imprescindible porque entre "HTML estático pintado" y "React hidratado" hay 100-500ms donde Next.js sirve la landing entera sin que WelcomeTransition pueda reaccionar aún.

### Modo oscuro forzado
Siempre dark en app. Navy `#0A0E1A`, acento azul maduro `#4A6FE5`. Cal Sans para headers, Geist para body.

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
| **Lemon Squeezy** | Pagos con IVA NO incluido en el precio de pantalla (MoR), checkout, portal de gestión para el cliente, webhooks de suscripción. Sin necesidad de gestionar facturación propia. | ✅ **Activo en producción** (live mode). |
| **Resend** | Emails transaccionales (bienvenida, reportes de error). Los emails de suscripción los envía LS directamente. | ✅ Activo. |
| **Supabase Auth** | Auth con email+pwd y Google OAuth. JWT para el backend. Sin dependencia de auth propio. | ✅ Activo. |

---

## 10. Análisis de competencia (condensado)

### wiReply (SocialwiBox) — competidor directo
- **Target:** negocios locales multi-ubicación, hostelería/hoteles/retail
- **Precio:** ~€22,50/mes (calculadora dinámica, trial 7d sin tarjeta)
- **Nos gana en:** integración GBP real con publicación automática, multi-ubicación nativa (importante), presencia mediática (podemos replicar?) 
- **Le ganamos en:** Radar de Competencia, filtro de seguridad, PDF benchmark, plan gratis, pricing transparente, precio 15% menor

### RepScan — referencia premium
- **Target:** restaurantes, clínicas, hoteles, cadenas, personal branding
- **Precio:** SaaS €249/mes (5× más caro que Velacre Pro). Servicios extra: eliminar reseñas €99, auditoría GBP €80
- **Nos gana en:** servicios de eliminación de reseñas (legal), marca consolidada, 9 tonos, modo supervisado (aunque también funcionaría así el nuestro), multi-perfil
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

### Marca y shell
- **Paleta editorial navy + crema:** navy `#0A0E1A` + crema papel `#E8E2D4` + azul maduro `#4A6FE5` como acento único. Tokens Tailwind (`slate-*`, `blue-*`, `emerald-*`, `amber-*`, `red-*`, `white`) remapeados en `globals.css @theme inline` para propagar automáticamente a toda la app sin tocar JSX. Semánticos: good `#6E9E7E`, warn `#D4A84A`, danger `#C46A5C`. Decisión contrarian vs el SaaS-azul-eléctrico genérico — diferenciación de marca deliberada.
- **Landing invertida (crema base + módulos dark):** la landing usa crema como papel editorial y solo los módulos que simulan la app real (demo, radar, salud, card Pro, ticker) van en navy. Principio: *"el fondo es tu papel, lo oscuro es el producto"*. Webapp autenticada queda íntegra en dark.
- **Logo oficial: sello de lacre con "V" monograma.** Master PNG centrado simétricamente (corregido trim + extend porque el original tenía padding asimétrico que descolocaba el flex-alignment). Pack PWA en `public/icons/`: favicon.ico + 16/32/48, apple-touch 120/152/180, android-chrome 192/512, maskable 192/512 con safe zone 10%, mstile 150/310, og-image, logo 64/128/256/1024.
- **Wordmark "velacre" en minúsculas Cal Sans 700** letter-spacing -0.02em. Unificado en todos los encabezados con el mismo approach de centrado óptico (`display: inline-flex; align-items: center; height: [sello]; line-height: 1; transform: translateY(-1px)`) — reemplazó el hack anterior de `line-height + margin-top` que se rompía entre navegadores. Aplicado en: NavBar landing, AppHeader app, `auth/login` + `auth/register` + `auth/reset-password`, `onboarding` (formulario y GBP select) y `onboarding/plan`.
- **Shell app unificado:** `AppHeader` + `AppFooter` compartidos en `/inicio`, `/dashboard`, `/dashboard/salud`, `/settings`, `/admin`. Mismo tono `rgba(10,14,26,0.96)` + blur 14px que el NavBar de la landing — la navegación landing → app no tiene salto. `PublicShell` (NavBar editorial + FooterEditorial) para `/contacto`, `/privacidad`, `/terminos`.
- **Plan badge en header** (Basic/Core/Pro) junto al wordmark en todas las páginas app — pill redondeado vs los badges mono cuadrados de la landing. Outline slate en Basic/Core, outline accent en Pro.
- **Transiciones welcome/goodbye:** rito de paso deliberado entre marketing y producto (ver §7). El objetivo es que el usuario perciba el cambio de contexto, no un salto abrupto entre dos webs distintas. Coste bajo (CSS + sessionStorage) y marca diferenciadora.

### Producto
- **6 tonos:** Profesional, Empático, Cercano, Directo, Agradecido y Humorístico. Agradecido para reseñas positivas (4-5★), incluye keywords con naturalidad. Gap vs RepScan (9 tonos) reducido significativamente.
- **Filtro seguridad transversal (no solo Pro):** coste cero (misma llamada Claude) y es el mejor argumento de marca. Comunicado como feature de todos los planes en la landing.
- **GBP deshabilitado con "Próximamente":** todo el código está listo. La UI muestra badges y elementos con opacity reducida. Activación = quitar CSS, no desarrollar. En la tabla comparativa de la landing, la fila "Publicación directa en Google" muestra badge "Próximamente" (warn dorado, mono) en la columna Velacre — deliberado para no auto-sabotear con un ✗ rojo.
- **Copy-paste como flujo interino:** mientras no haya GBP, botón "Responder en Google" abre business.google.com. Con PWA en el móvil, el flujo generar → copiar → pegar es razonable para ≤50 reseñas/mes.
- **Core no tiene análisis IA en Panel Salud:** Core solo da nota media + resumen básico de reseñas (sin IA brilla/quema/acción, sin sentimiento, sin evolución). El claim "Panel de Salud con estadísticas clave" se eliminó de todas las descripciones Core por ser engañoso. Anclar Pro con análisis IA + Radar + PDFs, no con volumen.

### Pricing y límites
- **Core €19/mes · 25 IA/mes** (subido desde 20): 15% por debajo de wiReply (€22,50), deja margen para cubrir ICP de 5-30 reseñas/mes sin que el límite sea fricción constante. Post-GBP subirá a €29.
- **Pro €49/mes · IA ilimitadas con cap soft 250:** 5× por debajo de RepScan (€249). Radar + PDFs justifican el precio por sí solos. Cap soft avisa sin bloquear — detecta enterprise para pricing custom futuro. Post-GBP subirá a €69.
- **Basic 10 IA/mes gratis, sin tarjeta, para siempre:** plan de verdad, no trial. Conversión Basic→Core esperada +20-40% vs el "3 IA trial" original.
- **Founding price −20% para siempre · primeros 20:** código `VELFOUND20`. Core €19 → €15/mes, Pro €49 → €39/mes. Vs precio futuro post-GBP (€29/€69), el founding lock equivale a ~48% off del precio futuro.

### Técnicas
- **Prompts sin hardcodes geográficos:** prompts de Claude no mencionan "Galicia" ni "hostelería". Contexto vía descripción del negocio + keywords + reseñas. Permite escalar a cualquier sector.
- **Prompts sin jerga SEO (Mini Radar):** prohíbe "SEO", "CTR", "ranking", "KPI", etc. Usa lenguaje de "vecino que quiere echar una mano". Incluye ejemplos buenos/malos y auto-revisión.
- **Contador IA atómico:** RPC PostgreSQL (`try_increment_ia_counter`) con check + increment en una operación SQL. Pro usa `p_limit=-1` para no bloquear por resultado RPC.
- **Checkout LS con redirect_url en product_options:** no en atributos raíz (particularidad de la API de Lemon Squeezy).
- **Eliminación de cuenta transaccional:** RPC Postgres que borra todo en una transacción. Cancelación LS y delete `auth.users` quedan fuera (APIs externas).
- **Error handling global:** el usuario nunca ve pantalla en blanco. Error → mensaje amable + botón "Reportar problema" → email a info@velacre.com con contexto (sin stack trace).
- **Flags welcome/goodbye con TTL 10s:** los flags en sessionStorage incluyen timestamp. `consumeFlag` borra al leer y descarta si tiene más de 10s, evitando que un flag "zombie" (por dev tools, error del overlay, etc.) dispare la animación al abrir la landing horas después.

---


## 12. Pendiente estratégico y técnico

### Prioridad máxima — Activar GBP
- Aprobación de Google enviada (7-10 días hábiles). Backend listo.
- Al activar: quitar CSS de badges "Próximamente" + subir precios Core/Pro (€19→€29, €49→€69).
- Cierra el flanco abierto #1 vs wiReply.

### Pagos operativos
- Tienda Lemon Squeezy **activa en producción** (live mode). Los prospects pueden pagar Core/Pro directamente desde el onboarding.
- Descuentos creados: 99% para test/QA, 15% para primeros clientes captados por outreach, `VELFOUND20` (−20% forever) para los primeros 20.
- Próximo paso operativo al cerrar el primer cliente: generarle el cupón 15% antes de mandarle el link de checkout.

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
- **Panel Salud Core (decidir):** o activamos una versión mínima real (nota media + % respondidas + conteo, sin IA) o unificamos Basic+Core en el teaser blurred. Hoy Core muestra lo mismo que Basic salvo el bullet de marketing (que ya está corregido).
- **Tests:** ~12-15% cobertura (53 tests). Backend: ClaudeService, NegocioController, UsuarioController. Frontend: API client + modules + hooks + componentes. Próximos: ReviewController, LemonController, flujos e2e.
- **Rate limiting aplicativo:** no crítico sin atacantes, buena práctica para producción.

### Ideas futuras (post-tracción)
- **Marca blanca (Enterprise+):** agencias ofrecen Velacre con su logo. +€100/mes.
- **QR anti-reseñas negativas:** si 4-5★ → Google Maps; si 1-2★ → nota interna. Descartado para corto plazo (cambio de paradigma de producto).
- **WhatsApp/Gmail semanal:** cron los lunes con recuento + respuestas preparadas.
- **Plan "Chains":** €99-129/mes para cadenas 2-5 locales. Gap entre wiReply y RepScan.
- **Lead magnet público:** `/informe-gratis?place_id=X` (Mini Radar desateado de admin). Valorar tras 5 clientes.

---

## 13. Objetivos de negocio

- **2026:** empezar a facturar para no depender de un empleador.
- **Primer hito:** 1 cliente de pago cerrado antes de escalar outreach.
- **Segundo hito:** 3-5 clientes con testimonios → sección "Clientes actuales" en landing.
- **Métrica norte star:** MRR (Monthly Recurring Revenue).

---

## 14. Outreach — herramientas disponibles

- **Mini Radar** (`/admin/mini-radar`): genera informe PDF de cualquier negocio en ~10s. Incluye stats, diagnóstico IA, email pitch pre-personalizado.
- **Word de templates** (`velacre-email-templates-outreach.docx`): 5 plantillas (A-E) con workflow. Template E es el DM exacto para O Fogar da Carne.
- **Canal único:** DM digital (IG, email). Sin puerta fría ni presencial por preferencia del fundador.
- **Instrumentación pendiente:** tracking de aperturas (Resend), dashboard de prospects (cuando haya 10+).

---

*Para detalle técnico (endpoints, servicios, seguridad, pipeline, hallazgos de concurrencia): ver `velacre-context-technical.md`.*
