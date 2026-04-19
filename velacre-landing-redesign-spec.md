# Velacre — Rediseño de paleta de la landing (light + módulos dark, mobile-first)

Especificación completa del cambio de dirección estética de la landing y app, sin alterar estructura, copy ni lógica. Este documento define qué se cambia, por qué, y cómo, para poder ejecutarlo en una rama dedicada con commits atómicos.

**Rama objetivo:** `20260418_landing_light` (desde `20260418_redefine`).
**Scope:** landing y shell público (`/`, `/es`, `/en`, `/gal`, `/contacto`, `/privacidad`, `/terminos`). La webapp autenticada (`/inicio`, `/dashboard`, `/settings`, `/admin`) **se mantiene dark**.
**Enfoque:** mobile-first real — cada sección se diseña primero para móvil y se escala a desktop. No se trata desktop como "lo normal" con ajustes móviles después.

---

## 0. Enfoque mobile-first y breakpoints

### 0.1 Target device

**Primario:** móvil medio post-2020 — iPhone 12/13/14/15 base (390-393px), Samsung Galaxy S21/S22 (360-384px), Pixel 6/7 (412px). Este es el 75-85% del tráfico esperado (ICP: dueños de bar/asador, outreach por IG DM y email abiertos en el móvil).

**Compatibilidad:** no comprometer iPhone SE 2020 (375px) ni Android compactos antiguos (360px). Sin diseño específico para <360px, pero sí garantizar que nada se rompe.

### 0.2 Breakpoints

```css
/* Mobile first — defaults sin media query */
/* 360px-479px: móvil base (diseño base) */

@media (min-width: 480px) {
  /* Móviles grandes / phablets en landscape */
}

@media (min-width: 720px) {
  /* Tablets verticales, móviles grandes en landscape */
  /* Primer breakpoint donde el layout empieza a "abrirse" */
}

@media (min-width: 960px) {
  /* Tablets horizontales, portátiles pequeños */
}

@media (min-width: 1200px) {
  /* Desktop completo — layout editorial en toda su extensión */
}

@media (min-width: 1440px) {
  /* Pantallas grandes — no se agranda más, se centra con max-width */
}
```

Nota: el breakpoint `720px` ya existe en el `landing.css` actual. Lo mantenemos como eje divisor entre "mundo móvil" y "mundo desktop-like" para no inventar nueva nomenclatura.

**Excepción del NavBar:** el cambio de layout del NavBar (hamburguesa → links visibles) ocurre en **960px**, no en 720px. En el rango 720-960px (iPads verticales, tablets) la hamburguesa se mantiene porque el ancho no acomoda wordmark + 3 links + 2 botones con aire editorial. Ver sección 3.1. El resto del layout de la landing sí usa 720px como punto principal de apertura.

### 0.3 Principios transversales

- **CSS sin media query = CSS para móvil.** Todo lo que se declara sin breakpoint debe funcionar en 360px.
- **Progressive enhancement**: se parte del layout más simple (una columna, tipografía cómoda de leer en pulgar) y se enriquece al crecer el viewport.
- **Touch targets ≥ 44×44px** en todo elemento interactivo (CTA, chips, tonos del demo, tabs). Esto no es negociable aunque el diseño editorial pida algo más compacto.
- **Line-height holgado (1.5-1.6)** en body copy para lectura cómoda en pulgar con una sola mano.
- **Gutter mínimo lateral 16px** (no 24 ni 18). 16 es el estándar iOS/Android y deja suficiente aire sin comerse el ancho de card.
- **Font sizes base**: body 16px (no 14), H1 40px en móvil (no 56), H2 28px. Más grande de lo que el editorial pide, porque priorizamos legibilidad por encima de elegancia tipográfica en el dispositivo principal.

---

## 1. Motivación

La landing actual (rama `20260418_redefine`) funciona en desktop — es editorial, diferenciada, con sistema tipográfico claro. Dos problemas identificados:

1. **Dark no encaja con el ICP.** El dueño de bar/asador de 30-55 años asocia dark con "herramienta técnica compleja". Los competidores que sí venden a hostelería (Covermanager, TheFork) son todos light. Dark vende bien a desarrolladores (Linear, Vercel) — no a Bruno Casal.
2. **En móvil la landing se lee como blog de Google.** Al colapsar los bloques editoriales a columna única, la numeración 01–07, las rules horizontales y la prosa larga convergen visualmente con un artículo de Medium o un post corporativo. El contenedor editorial deja de transmitir "producto" y pasa a transmitir "contenido".

**La solución no es cambiar la paleta entera**, porque eso rompería la coherencia entre landing y app. La solución es invertir la relación fondo/texto en la landing (crema → navy) y convertir los módulos que representan el producto (demo, Radar, Panel Salud, pricing Pro) en **cards dark**, de forma que:

- El fondo cálido saca a la landing del frame "blog tech"
- Los módulos dark se leen como "pantallas reales del producto" — continuidad visual con la app
- Al hacer login, el usuario no percibe salto de paleta porque ya ha visto esos bloques dark en la landing

Este patrón es el estándar moderno de SaaS bien diseñados (Stripe, Vercel, Resend, Linear) y es coherente con el sistema editorial existente — solo invierte la relación de colores, no el rigor visual.

---

## 2. Nueva paleta de la landing

### 2.1 Tokens editoriales (landing.css)

La paleta editorial existente se mantiene, pero cambia el rol de cada token.

**Antes (rama `20260418_redefine`):**
```css
--ink: #0A0E1A;       /* fondo */
--ink-2: #0F1729;     /* fondo-2 */
--ink-3: #1A2236;     /* fondo-3 */
--paper: #E8E2D4;     /* texto principal */
--paper-dim: #B8B1A0; /* texto secundario */
--mute: #6E7689;      /* muted */
--accent: #4A6FE5;    /* accent */
--good: #6E9E7E;
--warn: #D4A84A;
--danger: #C46A5C;
--line: rgba(232, 226, 212, 0.12);
```

**Después (rama `20260418_landing_light`):**
```css
/* Fondos */
--paper: #E8E2D4;       /* fondo principal de la landing */
--paper-2: #F0EBE0;     /* fondo alternativo (secciones "claras" intercaladas, opcional) */

/* Tintas (texto sobre crema) */
--ink: #0A0E1A;         /* texto principal */
--ink-2: #0F1729;       /* (reservado para módulos dark) */
--ink-3: #1A2236;       /* (reservado para módulos dark) */

/* Texto secundario sobre crema */
--mute: #5A5245;        /* navy muy desaturado, o marrón cálido */
--muted-strong: #2E2A22; /* prácticamente negro cálido */

/* Accent y semánticos (sin cambios en valor, cambian en dónde aparecen) */
--accent: #4A6FE5;
--accent-strong: #3E5CC7; /* variante más oscura para textos pequeños sobre crema */
--good: #6E9E7E;
--warn: #D4A84A;
--danger: #C46A5C;

/* Líneas y bordes sobre crema */
--line: rgba(10, 14, 26, 0.12);        /* navy a 12% alpha sobre crema */
--line-strong: rgba(10, 14, 26, 0.22); /* para rules marcadas */

/* Tokens específicos para módulos dark (cards de producto) */
--module-bg: #0F1729;              /* fondo de card dark */
--module-bg-alt: #1A2236;          /* fondo de card dark alternativo */
--module-border: rgba(232, 226, 212, 0.14); /* borde crema sobre dark */
--module-text: #E8E2D4;            /* texto sobre dark */
--module-text-dim: #B8B1A0;        /* texto secundario sobre dark */
```

### 2.2 Regla de aplicación

**Crema como fondo global de la landing.** Todo el body de la landing, el NavBar, el footer y las secciones estructurales usan crema.

**Dark solo donde hay producto.** Los módulos dark se usan exclusivamente cuando el contenido representa una pantalla real o un componente del producto:

- Demo de 6 tonos (sección 01) — es la pantalla de generación de respuesta
- Radar de Competencia (sección 02) — es el panel del dashboard Pro
- Panel de Salud con 4 KPIs y análisis IA (sección 03) — es el dashboard de salud
- Ticker "Bandeja en vivo" del hero — es una mini-vista del dashboard
- Card de plan Pro (sección 06) — destacada en dark para señalar premium

**Todo lo demás en crema.** Hero text, stats, sección 04 (Flujo), sección 05 (Público), cards Basic y Core, sección 07 (CTA final), footer.

---

## 3. Cambios por sección — móvil y desktop en paralelo

Cada subsección documenta **primero el móvil** (viewport base 360-480px) y luego cómo se escala a desktop. La implementación sigue el mismo orden: primero haz que funcione en 375px, luego añade las media queries que lo abren hasta 1200px+.

### 3.1 NavBar

**Móvil y tablet (base, <960px):**
- Alto 56px (suficiente para touch target + gutter vertical)
- Logo + wordmark "velacre" a la izquierda
- Dos iconos a la derecha: menú hamburguesa + botón accent "Empezar" (solo icono con flecha o "→", 44×44px mínimo)
- **Sin links de nav visibles**. El menú hamburguesa abre un overlay full-screen con los 3 links (Producto, Radar, Precios) + "Iniciar sesión" al final
- Fondo `rgba(232, 226, 212, 0.92)` con `backdrop-filter: blur(14px)`
- Borde inferior `1px solid var(--line)`
- Position sticky al scrollear

**Desktop (≥960px):**
- Alto 64-72px
- Logo + wordmark a la izquierda
- Links de nav centrados o a la izquierda tras el wordmark: Producto, Radar, Precios
- Botón "Iniciar sesión" ghost + botón "Empezar gratis" accent a la derecha
- Sin hamburguesa

**Por qué la hamburguesa persiste hasta 960px (y no desaparece en el breakpoint general de 720px):** en el rango 720-960px (iPads verticales 768px, Chromebooks pequeños, tablets Android) el ancho no basta para acomodar wordmark + 3 links + 2 botones con el aire editorial que el sistema necesita. Además, esos dispositivos son táctiles, donde la hamburguesa sigue siendo el patrón intuitivo. Solo a partir de portátiles y monitores (≥960px) aparece la nav completa con el respiro tipográfico que merece. Esto desacopla el breakpoint del NavBar (960px) del breakpoint general del layout (720px), y es deliberado.

**Por qué menú hamburguesa y no tabs visibles en móvil puro**: el ancho de 360-390px no admite wordmark + 3 links + 2 botones sin apretar por debajo de los 44px de touch target. Mejor sacrificar la visibilidad de los anchors y mantener touch targets holgados.

### 3.2 Hero

**Móvil:**
- Padding vertical 48px arriba, 32px abajo
- Meta-bar "ES · GAL · EN · V · 2026.04" **oculta** (ya lo estaba en el diseño actual — se mantiene)
- Pill "Sin permanencia · plan gratis real" centrada, 13px, borde navy 22%
- H1 40px (line-height 1.15), Cal Sans, peso 600, navy. Centrado. Máximo 3-4 líneas. *Boca a boca* en accent
- Lede 17px (line-height 1.55), `var(--muted-strong)`. Máximo 2-3 líneas. Centrado
- **Dos botones stack vertical**, full-width menos gutter (16px cada lado):
  - "Entrar con Google" accent, 52px de alto, icono + texto
  - "Con email →" ghost navy, 52px de alto
- Hero-foot (3 chips "Setup < 2 min", "Sin tarjeta", "Cancelas cuando quieras"): una sola línea que hace wrap si no cabe, gap 10px, 12px de font-size, navy
- **Ticker "Bandeja en vivo" oculto en móvil** (ya lo está en el diseño actual — se mantiene, ocupa demasiado espacio y el ojo debe ir al CTA primero)

**≥720px:**
- Padding vertical 72-96px
- Meta-bar visible, pequeña, mono, arriba del H1
- H1 crece a 56-64px
- Botones vuelven a inline (horizontal) con ancho auto
- Hero-foot inline
- Ticker "Bandeja en vivo" aparece flotando a la derecha como módulo dark (ver 3.2.1)

**≥1200px:**
- H1 crece a 72-80px si queda espacio
- Ticker se ancla en la esquina derecha con más presencia

**3.2.1 — Ticker "Bandeja en vivo" (solo ≥720px):**
- Módulo dark con fondo `var(--module-bg)`, borde `var(--module-border)`, radius 4px
- Sombra `0 2px 8px rgba(10, 14, 26, 0.06)`
- Título "Bandeja en vivo · 03 sin responder": crema dim, mono pequeña
- 4 rows de reseña (autor + texto + estrellas + badge). Texto crema principal, autor crema dim, estrellas accent
- Badge "Positiva" / "Queja" / "Retenida": colores semánticos sobre dark
- En desktop, ocupa aproximadamente 40% del ancho del hero y flota a la derecha
- **Este es el primer módulo dark que ve el usuario en desktop — establece visualmente el pacto: "el fondo es tu papel, lo oscuro es el producto"**

### 3.3 Stats (4 celdas bajo el hero)

**Móvil:**
- Grid 2×2 (no 4 columnas)
- Cada celda con padding 20px
- Número grande (40px Cal Sans, navy), label debajo (12px mono uppercase, navy dim)
- Bordes internos únicamente: border-right en columnas pares, border-bottom en filas impares. Sin bordes externos que compitan con el padding de la sección
- Gap 0 entre celdas (los bordes las separan)

**≥720px:**
- Grid 4 columnas en fila
- Separadores verticales `1px solid var(--line)` entre celdas
- Padding por celda 24-32px

**≥1200px:**
- Misma estructura, números pueden crecer a 48-56px si el espacio lo pide

### 3.4 Sección 01 — Producto (demo de 6 tonos)

**El bloque entero es un módulo dark en todos los breakpoints.**

**Móvil:**
- El módulo ocupa ancho completo menos 16px de gutter cada lado
- Radius 4px, borde `var(--module-border)`
- Padding interno 20px
- **Orden del contenido vertical:**
  1. Header compacto: "Reseña — Google" label + flechas de navegación entre las 3 reseñas
  2. Card de reseña (autor, fecha, estrellas, texto)
  3. Selector de tonos horizontal scrollable: 6 chips en fila que se scrollean con el dedo (no wrap, no grid). Chip activo en accent, resto en crema dim con borde crema 14%. Scroll snap por chip
  4. Respuesta generada con typing animation
  5. Botón "Responder en Google →" full-width
- **Swipe horizontal** para navegar entre las 3 reseñas (ya implementado en diseño actual, mantener threshold 48px y `touch-action: pan-y`)

**≥720px:**
- Padding interno 40-48px
- Los 6 tonos pasan a grid 3×2 o fila única sin scroll
- Layout más aireado

**≥1200px:**
- El módulo puede tener max-width 1040px centrado
- Reseña y respuesta pueden ir lado a lado en lugar de apiladas, si funciona visualmente (decisión: mantener apiladas por coherencia con el flujo real del producto)

**Por qué chips scrollables horizontales en móvil y no grid:** 6 chips con labels en español ("Profesional", "Empático", "Cercano", "Directo", "Agradecido", "Humorístico") no caben en 360px sin romper el texto o hacer las chips inservibles. El scroll horizontal es el patrón iOS/Android nativo para "selector de opciones" (lo hacen Spotify, Apple Music, Netflix categorías).

### 3.5 Sección 02 — Inteligencia (Radar de Competencia)

**Módulo dark entero.**

**Móvil:**
- Módulo ancho completo menos 16px gutter
- Padding interno 20px
- **Estructura del Radar en móvil:**
  - Título "Negocio · amenaza" arriba
  - **Cada competidor es una card stacked vertical**:
    - Nombre del competidor + badge de amenaza (Alta/Media/Baja) en una línea
    - 4 filas con label mono a la izquierda (Cocina, Servicio, Ambiente, Relación c/p), barra de progreso en el medio (60% del ancho de la card), score numérico a la derecha
  - Entre cards, separador `1px solid var(--module-border)` sutil
  - "Tu negocio" como card destacada al principio con borde accent 40%
- Overlay "Solo en plan Pro": sticky al fondo del módulo en móvil, no flotante encima del contenido
- Las 3 cards de insights (Acción / Fortaleza / Oportunidad):
  - Stackean vertical después del Radar
  - Ancho completo del módulo
  - Franja lateral izquierda (4px) en color semántico
  - Padding 16px
  - Título semántico + cuerpo en crema

**≥720px:**
- Las 4 categorías pueden volver a ser columnas en lugar de filas dentro de cada competidor (tabla tradicional)
- Las 3 cards de insights pasan a 3 columnas en fila

**≥1200px:**
- Layout de tabla completa con competidores en filas y categorías en columnas
- Hover states en filas

**Por qué NO scroll horizontal en la tabla:** probado en el diseño actual, genera fricción — el usuario no sabe que hay que scrollear. Mejor stackear cada competidor como card independiente y aceptar más altura vertical. En móvil el scroll vertical es nativo y sin fricción.

### 3.6 Sección 03 — Salud (4 KPIs + análisis IA)

**Módulo dark entero.**

**Móvil:**
- Módulo ancho completo menos 16px gutter
- Padding interno 20px
- **4 KPIs en grid 2×2**:
  - Cada KPI con número grande crema (32px), label crema dim (12px mono), delta/comparativa (11px) en semántico (good/danger según el valor)
  - Mini-barra de sentimiento debajo del KPI "Índice de respuesta" colapsada (6px de alto, full-width de la celda)
  - Bordes internos entre celdas, no externos
- **3 cards IA stackean vertical** después de los KPIs:
  - "Lo que más destacan" (franja good)
  - "Lo que más se quejan" (franja danger)
  - "Acción de esta semana" (franja accent)
- CountUp animation en los 4 KPIs: activado por IntersectionObserver al entrar en viewport. Duración 1.4s, easing cubic-out. Sin cambios vs implementación actual

**≥720px:**
- 4 KPIs en fila (grid 4 columnas)
- 3 cards IA en fila (grid 3 columnas)

**≥1200px:**
- KPIs más aireados, números pueden crecer a 40-48px

### 3.7 Sección 04 — Flujo (3 pasos)

**Se mantiene en crema en todos los breakpoints.** No es producto, es explicación de uso.

**Móvil:**
- 3 pasos stacked vertical
- Cada paso: numeral grande a la izquierda (48px Cal Sans, navy), contenido a la derecha (título + descripción)
- Padding vertical por paso 24px
- Separador `1px solid var(--line)` entre pasos

**≥720px:**
- Pasos siguen stacked o pasan a grid 3 columnas (decisión: mantener stacked con más aire, el editorial funciona mejor así y el contenido no compite con el producto)

**≥1200px:**
- Más espacio lateral, hover accent en cada paso

### 3.8 Sección 05 — Público (8 sectores)

**Se mantiene en crema.**

**Móvil:**
- Chips con wrap natural (flex-wrap), gap 8px
- Cada chip: padding 10px 16px, borde navy 12%, texto navy 14px
- Sin agrupación visual por categoría en móvil — todos los 8 chips en un bloque que hace wrap
- Centrado o alineado a la izquierda (decisión: alineado a la izquierda, más natural de leer)

**≥720px:**
- Agrupación visual por categorías (hostelería, retail, servicios) como hoy
- Chips con más padding y font 15px

### 3.9 Sección 06 — Precios

**Móvil:**
- Toggle mensual/anual centrado, full-width menos gutter
- Pill "2 meses gratis" debajo del toggle, accent
- **Las 3 cards stackean vertical**, gap 16px entre ellas:
  - Card Basic (crema, borde navy 12%, radius 4px, padding 20px)
  - Card Core (crema, borde accent 40%, badge "Más elegido")
  - Card Pro (**dark**, borde accent 60%, badge "Más completo", texto crema)
- Cada card: título del plan, precio grande, frase de valor, lista de features con iconos accent/crema según la card, botón CTA full-width al final (52px alto)
- Caja transversal "Incluido en todos los planes" al final, crema con borde navy 22%

**≥720px:**
- Cards en grid 3 columnas con gap 16-24px
- Card Pro más alta visualmente (o con scale 1.02) para destacarse
- Toggle más compacto

**≥1200px:**
- Máxima claridad tipográfica, más aire interno

**Por qué Pro en dark incluso en móvil:** el contraste visual es lo que señala "este es el plan premium". En móvil donde solo ves una card a la vez al scrollear, el salto visual de "card crema → card dark → card crema" captura la atención cuando aparece la Pro. Es coherente con el patrón del documento: dark = producto premium / pantalla real.

### 3.10 Sección 07 — CTA final

**Crema.**

**Móvil:**
- Padding vertical 48px
- H2 navy 28-32px, centrado, max 2 líneas
- Dos botones stacked: "Empezar con Google" accent + "Con email →" ghost, ambos full-width 52px
- Watermark del sello al fondo, navy a 4-6% opacity, más pequeño que en desktop
- Nota "Plan gratis · 10 respuestas al mes · Sin tarjeta" navy dim, 13px, centrada

**≥720px:**
- H2 crece a 40-48px
- Botones inline (horizontal)
- Watermark más grande

### 3.11 Footer

**Crema.**

**Móvil:**
- Una columna
- "© 2026 Velacre · Galicia, ES" en una línea mono 12px navy dim
- 3 links legales (Privacidad, Términos, Contacto) en otra línea, separados por "·"
- Padding vertical 24px, gutter lateral 16px

**≥720px:**
- Todo en una línea: copyright a la izquierda, links a la derecha

---

## 4. Webapp (/inicio, /dashboard, /settings, /admin)

**No se toca.** Mantiene todo dark como está hoy.

**Razón explícita:** el usuario autenticado está dentro de una herramienta de trabajo. Dark ahí es apropiado y coherente con el patrón de SaaS para power users. Además, el shell de la app (AppHeader, AppFooter) ya está unificado con el estilo dark editorial — no hay incoherencia interna.

**Transición landing → app:** al hacer login, el salto visual es de "fondo crema con módulos dark" a "app dark completa". El contraste está justificado porque los módulos dark de la landing ya han preparado al usuario — el dashboard se lee como "la versión completa de esos módulos que vi". No hay sorpresa.

---

## 5. Implementación técnica

### 5.1 Archivos a modificar

**Críticos:**

- `frontend/src/components/landing/landing.css` — reescribir los tokens CSS del `:root` scoped a `.vel-lp` (sección 2.1 de este doc). Actualizar utilidades `.wrap`, `.sec`, `.sec-head`, `.sec-idx`, `.rule-strong`, `.mono`, `.pill`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-accent`. **Todas las reglas por defecto deben ser para móvil**. Los enrichments van en `@media (min-width: 720px)` en adelante.
- `frontend/src/app/globals.css` — **no tocar el `@theme inline`** (los remapeos de tokens Tailwind siguen siendo para la app dark). Solo revisar si hay algún estilo global de body/html que deba ajustarse para la landing (normalmente no, porque la landing está scopeada a `.vel-lp`).
- `frontend/src/components/LandingPage.tsx` — reorder mobile vía `order` en flexbox (ver 5.2) + ajuste de clases para secciones que cambian de paleta.
- `frontend/src/components/landing/HeroSection.tsx` — ticker como módulo dark flotante en desktop, oculto en móvil.
- `frontend/src/components/landing/DemoSection.tsx` — contenedor dark + selector de tonos scrollable horizontal en móvil.
- `frontend/src/components/landing/RadarPreviewSection.tsx` — contenedor dark + stacked competitors en móvil, tabla en desktop.
- `frontend/src/components/landing/PricingSection.tsx` — card Pro en dark, Basic y Core en crema.
- `frontend/src/components/landing/NavBar.tsx` — fondo crema con blur + menú hamburguesa en móvil.
- `frontend/src/components/landing/FooterEditorial.tsx` — crema.

**Secundarios (shell público):**

- `frontend/src/components/PublicShell.tsx` — se hereda del NavBar/Footer editorial, revisar que no haya estilos de fondo hardcodeados.
- Páginas `/contacto`, `/privacidad`, `/terminos` — heredan del PublicShell, revisar la clase `.prose-legal` en `landing.css` para que tenga texto navy sobre crema y line-height cómodo en móvil.

**No tocar:**

- `frontend/src/components/AppHeader.tsx`, `AppFooter.tsx` — app dark intacta.
- Páginas `/inicio`, `/dashboard`, `/dashboard/salud`, `/settings`, `/admin`, `/admin/mini-radar` — intactas.
- Páginas `/auth/login`, `/auth/register`, `/auth/reset-password`, `/auth/callback` — **decidir**. Ver 5.3.

### 5.2 Reorden móvil con `order` flex

En móvil el demo debe aparecer antes que las stats para enganchar al usuario con el producto inmediatamente tras el hero.

```tsx
// LandingPage.tsx — aproximación
<main className="vel-lp">
  <Hero />             {/* order: 1 */}
  <Stats />            {/* desktop order: 2, mobile order: 3 */}
  <DemoSection />      {/* desktop order: 3, mobile order: 2 */}
  <RadarSection />     {/* order: 4 */}
  <HealthSection />    {/* order: 5 */}
  <FlowSection />      {/* order: 6 */}
  <AudienceSection />  {/* order: 7 */}
  <PricingSection />   {/* order: 8 */}
  <CtaSection />       {/* order: 9 */}
</main>
```

```css
/* landing.css */
.vel-lp main { display: flex; flex-direction: column; }
.vel-lp .sec-stats { order: 3; }
.vel-lp .sec-demo { order: 2; }
/* resto con order explícito o natural */

@media (min-width: 720px) {
  .vel-lp .sec-stats { order: 2; }
  .vel-lp .sec-demo { order: 3; }
}
```

### 5.3 Auth pages — decisión pendiente

Las páginas de auth son un puente entre landing (crema) y app (dark). Dos opciones:

**Opción A:** pasarlas a crema como la landing. El usuario completa registro/login en un entorno visualmente continuo con la web de marketing, y **el salto a dark ocurre al aterrizar en `/inicio`**. Más coherente con la promesa visual de la landing.

**Opción B:** dejarlas dark como están, haciendo de "pre-shell" de la app. El salto visual ocurre en el momento de darse de alta, anticipando la app.

Recomendación: **Opción A**. El momento del registro es el más sensible de toda la conversión — cualquier salto de paleta puede generar "¿estoy en el sitio correcto?". Mejor mantener crema hasta que hay autenticación. Y el ICP que lo abre desde el móvil aprecia especialmente que el formulario de registro sea claro y de "día" — no una caja negra intimidante.

### 5.4 Manifest + metadata

- `app/manifest.ts`: `theme_color` y `background_color` siguen en `#0A0E1A` (coherente con la app, que sigue siendo dark — esto es lo que Android/iOS usan al abrir la PWA desde home).
- `app/layout.tsx` metadata viewport `themeColor: '#0A0E1A'` — igual, coherente con la app. La landing es efímera, la PWA está en la app.
- **Opcional (follow-up):** `themeColor` dinámico por ruta (cambiar a `#E8E2D4` en rutas públicas, `#0A0E1A` en rutas autenticadas) para que la barra de navegación móvil del browser coincida con el fondo. No crítico para este cambio.

### 5.5 Favicon, iconos, og-image

- Favicon, apple-touch, android-chrome: **no cambian**. El sello de lacre es navy sobre transparente — funciona tanto sobre crema (landing, barra de browser) como sobre dark (app, barra de tareas Android).
- `og-image-1200x630.png`: revisar. Si hoy es dark, probablemente queda mejor generar una nueva versión con fondo crema + sello navy para que cuando se comparta el enlace en redes/WhatsApp se lea como la landing real (importante porque Porto Santo y Cabañitas abren el link desde móvil). Mantener la versión dark como fallback.

### 5.6 PDFs (mini-radar, benchmark mensual, benchmark anual)

- **No se tocan.** Los PDFs se generan con `jsPDF` y tienen colores hardcoded. Mantener el estilo actual (cabecera Atlantic Blue sobre fondo blanco) — es apropiado para un PDF de negocio y no depende de la paleta web.

### 5.7 Testing cross-device obligatorio

Antes de merge:

- iPhone SE 2020 (375×667) — verificar que nada se rompe en el límite inferior
- iPhone 14 (390×844) — target primario
- iPhone 14 Pro Max (430×932) — target primario grande
- Pixel 7 (412×915) — target primario Android
- Samsung Galaxy S23 (360×780) — Android compacto
- iPad Mini (768×1024) vertical — tablet pequeña, fronterizo del breakpoint 720px
- iPad Pro (1024×1366) vertical — tablet grande
- Desktop 1280×800 — laptop estándar
- Desktop 1920×1080 — monitor

Chrome DevTools device emulation + al menos una prueba real en móvil propio (el que tú uses) antes de merge. No merge sin pasar por un móvil de verdad — los emuladores mienten sobre touch targets y scroll horizontal.

---

## 6. Plan de ejecución — mobile-first, por sección

Cada sección se completa en móvil + desktop **antes** de pasar a la siguiente. Esto evita la trampa de "desktop terminado, móvil a medio hacer al final".

### Fase 1 — Tokens, utilidades, shell público (2-3h)
1. Crear rama `20260418_landing_light` desde `20260418_redefine`.
2. Reescribir tokens CSS en `landing.css` (sección 2.1).
3. Actualizar utilidades `.btn-*`, `.pill`, `.rule-*`, `.mono` con reglas móvil-first.
4. NavBar: móvil con hamburguesa → desktop con nav inline.
5. FooterEditorial: móvil apilado → desktop en línea.
6. `.prose-legal` ajustada para crema.
7. Páginas `/contacto`, `/privacidad`, `/terminos`: verificar que heredan bien.
8. **QA móvil + desktop en paralelo** antes de pasar a Fase 2.
9. Commit: `refactor(landing): tokens + shell público en paleta light (mobile-first)`.

### Fase 2 — Hero (1-2h)
1. Móvil: H1 40px, botones stacked 52px, hero-foot wrap natural.
2. Desktop: H1 56-80px, botones inline, meta-bar visible.
3. Ticker "Bandeja en vivo" como módulo dark solo en ≥720px.
4. QA en iPhone SE / iPhone 14 / Pixel 7 / desktop.
5. Commit: `feat(landing): hero en paleta crema (mobile-first)`.

### Fase 3 — Stats (30-45min)
1. Móvil: grid 2×2 con bordes internos.
2. Desktop: grid 4 columnas con separadores verticales.
3. QA.
4. Commit: `feat(landing): stats section responsive`.

### Fase 4 — Sección 01 Demo (2-3h)
1. Móvil: módulo dark full-width, chips de tonos scrollables horizontal con snap, demo apilado vertical.
2. Desktop: módulo dark centrado max-width, chips en grid o fila, layout más aireado.
3. Verificar typing animation y swipe horizontal no rotos.
4. QA cross-device.
5. Commit: `feat(landing): sección 01 producto como módulo dark (mobile-first)`.

### Fase 5 — Sección 02 Radar (2-3h)
1. Móvil: módulo dark, competidores stacked como cards con barras horizontales.
2. Desktop: tabla tradicional con competidores en filas, categorías en columnas.
3. Overlay "Solo en Pro": sticky bottom en móvil, flotante en desktop.
4. 3 cards de insights: stacked en móvil, fila en desktop.
5. QA.
6. Commit: `feat(landing): sección 02 radar responsive con módulo dark`.

### Fase 6 — Sección 03 Salud (1-2h)
1. Móvil: 4 KPIs en grid 2×2 dentro del módulo dark, CountUp mantiene su lógica.
2. Desktop: 4 KPIs en fila.
3. 3 cards IA: stacked en móvil, fila en desktop.
4. QA.
5. Commit: `feat(landing): sección 03 salud responsive con módulo dark`.

### Fase 7 — Sección 04 Flujo (45min)
1. Móvil: 3 pasos stacked con numeral grande a la izquierda.
2. Desktop: mantiene stacked con más aire.
3. QA.
4. Commit: `feat(landing): sección 04 flujo en crema`.

### Fase 8 — Sección 05 Público (45min)
1. Móvil: chips con wrap natural.
2. Desktop: chips agrupados por categoría visual.
3. QA.
4. Commit: `feat(landing): sección 05 público en crema`.

### Fase 9 — Sección 06 Pricing (2h)
1. Móvil: 3 cards stacked verticales, Pro en dark destacada.
2. Desktop: 3 cards en fila con Pro levemente elevada.
3. Toggle mensual/anual: full-width en móvil, compacto en desktop.
4. Caja transversal "Incluido en todos los planes": crema, bien alineada.
5. QA.
6. Commit: `feat(landing): sección 06 pricing con Pro dark destacado`.

### Fase 10 — Sección 07 CTA final (45min)
1. Móvil: botones stacked, watermark reducido.
2. Desktop: botones inline, watermark grande.
3. QA.
4. Commit: `feat(landing): sección 07 cta final en crema`.

### Fase 11 — Reorden móvil con `order` flex (30min)
1. Aplicar `order` en landing.css para que demo aparezca antes de stats en móvil.
2. Verificar que en desktop el orden vuelve al natural.
3. QA.
4. Commit: `feat(landing): reorder móvil — demo tras hero`.

### Fase 12 — Auth pages (1-2h)
1. Decidir Opción A (recomendado) vs B.
2. Si A: migrar `/auth/login`, `/auth/register`, `/auth/reset-password`, `/auth/callback` a paleta crema. Formulario amplio en móvil, inputs 52px, botones full-width.
3. QA: OAuth loading state + bfcache restore + formulario accesible con teclado móvil.
4. Commit: `feat(auth): pages en paleta crema (mobile-first)`.

### Fase 13 — QA integral + i18n (1-2h)
1. Revisar en los 3 idiomas (ES/GAL/EN) que no haya textos con contraste roto ni line-height apretado.
2. Revisar en todos los devices de la sección 5.7.
3. Revisar las 22 rutas con `next build`.
4. Smoke test de navegación móvil completa: landing → hamburguesa → scroll hasta pricing → CTA Pro → auth/register → OAuth → /inicio.
5. Verificar que al hacer back con bfcache desde Google OAuth el botón no queda colgado.
6. Verificar que todos los touch targets son ≥44×44px (usar DevTools > Accessibility > Target size).
7. Contraste WCAG AA en todos los textos body (≥4.5).
8. Commit: `chore(landing): QA cross-device + i18n check`.

### Fase 14 — Merge
1. Push rama completa.
2. Crear PR con screenshots **antes/después** en móvil y desktop.
3. Merge `--no-ff` a `main` cuando se valide.
4. Actualizar `velacre-context-technical.md` con entrada de changelog (ver sección 11 de este doc).

**Estimación total:** 15-22 horas de trabajo efectivo. Dos o tres sesiones. El mobile-first añade tiempo respecto a la versión desktop-first pero evita retrabajo al final y da confianza de merge. Riesgo bajo: no se toca lógica de negocio, solo CSS, media queries y reordenación visual.

---

## 7. Riesgos y mitigación

**Riesgo 1:** el contraste crema + módulos dark puede sentirse inconsistente si no se ejecuta bien.
**Mitigación:** mantener los módulos dark solo en los 3 bloques estrella (01, 02, 03) + ticker hero + card Pro. No salpicar dark por toda la landing.

**Riesgo 2:** el accent blue `#4A6FE5` puede quedar débil sobre crema en elementos pequeños.
**Mitigación:** usar `var(--accent-strong)` #3E5CC7 para textos pequeños en accent sobre crema. Mantener el original para fondos y botones grandes.

**Riesgo 3:** los screenshots/mocks dentro de módulos dark pueden competir con el propio módulo dark y verse planos.
**Mitigación:** añadir un micro-borde interno o un gradient muy sutil al fondo del módulo (`--module-bg` a `--module-bg-alt` en 100% de altura) para dar profundidad sin romper el editorial.

**Riesgo 4:** salto visual landing → app demasiado fuerte.
**Mitigación:** es esperado y buscado. El usuario ha "visto el producto" en módulos dark durante la landing, por lo que al entrar en la app el dark se lee como continuidad, no como sorpresa. Si en testing hay feedback de que sí asusta, se puede suavizar con una transición de fade al hacer login.

**Riesgo 5:** los botones ghost con borde navy 22% pueden quedar invisibles sobre crema en monitores con poca calibración o bajo brillo móvil.
**Mitigación:** elevar a 32% si en QA se detecta. Mantener por encima del límite WCAG AA para cuerpo de texto (contraste > 4.5).

**Riesgo 6:** el menú hamburguesa en móvil añade un click extra a la navegación.
**Mitigación:** asumible porque el CTA "Empezar" queda siempre visible en el NavBar (icono/flecha accent). El usuario que quiere convertir no necesita el menú; el que navega secciones sí, y asume el patrón hamburguesa por ser el estándar móvil universal.

**Riesgo 7:** scroll horizontal de tonos en móvil (sección 01) puede no ser descubrible.
**Mitigación:** el tercer chip debe "asomar" parcialmente desde el borde derecho de la pantalla para indicar visualmente que hay más contenido. Evitar scroll snap demasiado agresivo que impida al usuario ver la preview del siguiente chip.

---

## 8. Qué NO entra en este cambio

Explícito para evitar scope creep:

- No se toca ningún copy, ni en español ni en los otros idiomas.
- No se añaden nuevas secciones a la landing.
- No se modifica la lógica de ninguna interacción (demo typing, radar animation, fade-in, swipe móvil, etc.) — solo su capa visual.
- No se toca el sistema i18n.
- No se modifican tests existentes (pero se añadirán test de smoke de navegación móvil si hay tiempo en Fase 13).
- No se cambia la webapp autenticada.
- No se rediseñan los PDFs.
- No se añaden screenshots reales del dashboard en la landing (eso es un trabajo aparte — ver sección 9).
- No se tocan los favicons ni los iconos PWA (salvo posiblemente og-image).

---

## 9. Follow-up sugerido (tras este cambio)

Cambios que potencian esta inversión de paleta pero son piezas independientes:

1. **Screenshots reales del dashboard dentro de los módulos dark** (sección 01, 02, 03). Hoy son mocks estáticos con datos hardcoded. Sustituirlos por capturas reales del producto en funcionamiento. Esto refuerza el mensaje "lo que ves es lo que compras".
2. **og-image en versión crema** para que al compartir el link en WhatsApp/Twitter se lea como la landing.
3. **Favicon con mayor peso visual** si al verse sobre crema queda demasiado fino (hoy está optimizado para dark).
4. **Revisión de emails transaccionales** (welcome, retention alert, error report) — si usan fondo dark con texto blanco, revisar si siguen coherentes con la nueva dirección visual de la marca pública.
5. **PWA manifest con `theme_color` dinámico por ruta** si se quiere la barra de browser móvil en crema en rutas públicas.
6. **A/B test en outreach:** mandar el mismo DM a dos prospects — uno con screenshot de la landing dark actual, otro con la crema — para ver cuál genera más respuesta. Solo tras tener 3-5 outreach más.
7. **Test de smoke de navegación móvil** automatizado con Playwright si se quiere evitar regresiones visuales en futuras iteraciones.

---

## 10. Checklist de aceptación (pre-merge)

### Paleta y estructura
- [ ] Landing renderiza en `/`, `/es`, `/en`, `/gal` sin texto ilegible ni contraste roto en ninguna sección
- [ ] Páginas legales (`/contacto`, `/privacidad`, `/terminos`) en paleta crema
- [ ] Auth pages (`/auth/*`) en paleta crema si se eligió Opción A
- [ ] Webapp (`/inicio`, `/dashboard`, `/settings`, `/admin`) intacta en dark
- [ ] Módulos 01, 02, 03 se ven como cards dark flotantes sobre crema
- [ ] Card Pro de pricing destacada en dark
- [ ] Ticker "Bandeja en vivo" aparece como módulo dark flotante solo en ≥720px

### Mobile-first (crítico)
- [ ] iPhone SE (375px): ningún overflow horizontal, todos los CTA legibles, demo funciona con swipe
- [ ] iPhone 14 (390px): hero hook inmediato, H1 legible de corrido, botones 52px
- [ ] Pixel 7 (412px): Radar con cards stacked legible, scroll horizontal de tonos sin fricción
- [ ] Samsung Galaxy S23 (360px): nada se rompe en el ancho mínimo soportado
- [ ] Hamburguesa móvil abre menú correctamente y cierra con click-outside
- [ ] Demo de 6 tonos aparece antes de las stats tras el hero en móvil (orden flex)
- [ ] Numeración 01–07 oculta o minimizada en móvil
- [ ] Todos los touch targets ≥ 44×44px medidos
- [ ] Chip preview del tercer tono visible por el borde derecho para sugerir scroll horizontal

### Tablet y desktop
- [ ] iPad Mini (768px): transición al breakpoint 720px funciona sin bloques rotos. **NavBar sigue mostrando hamburguesa** (el NavBar no cambia hasta 960px)
- [ ] iPad Pro vertical (1024px): NavBar con links visibles (ya superó 960px)
- [ ] Desktop 1280px: layout editorial completo, numeración 01–07 visible, ticker hero funcional
- [ ] Desktop 1920px: max-width aplicado, no hay estirones raros

### Interacciones
- [ ] Hover states (links nav, cards, botones) funcionan en desktop
- [ ] CountUp de KPIs en módulo dark sigue animando correctamente
- [ ] Typing animation del demo sigue funcionando sin bucle infinito
- [ ] Swipe horizontal del demo en móvil sigue funcionando con threshold 48px
- [ ] Fade-in por IntersectionObserver sigue activo en todas las secciones
- [ ] Scroll horizontal de tonos en móvil tiene snap y no tiene inercia rota

### Sistema
- [ ] `next build` pasa sin warnings nuevos
- [ ] `npm test` pasa (35 tests frontend no deben verse afectados)
- [ ] `dotnet test` pasa (18 tests backend no se tocan)
- [ ] LangSwitcher y HelpButton mantienen estilo editorial con paleta invertida si están sobre crema
- [ ] OAuth loading state sigue funcionando al volver atrás desde Google (bfcache)
- [ ] Transición landing → login → dashboard no rompe en ningún paso
- [ ] Contraste WCAG AA verificado en todos los textos body

---

## 11. Changelog a añadir en `velacre-context-technical.md` tras el merge

Entrada sugerida para la sección 19 (Changelog) del doc técnico:

```
### 2026-XX-XX — Landing light + módulos dark, mobile-first (rama 20260418_landing_light)

Inversión de paleta de la landing con rediseño mobile-first completo. Fondo 
crema global, texto navy, y módulos de producto (demo 6 tonos, Radar, Panel 
Salud, card Pro de pricing, ticker hero) como cards dark flotantes sobre 
crema. Webapp autenticada mantiene dark intacto.

Motivación: dark no encajaba con el ICP (hostelería, 30-55 años, no 
desarrolladores) y en móvil la landing editorial dark se leía como blog de 
Google. La paleta invertida resuelve ambos problemas manteniendo el rigor 
editorial y da continuidad visual con la app (los módulos dark son las 
pantallas reales del producto).

Mobile-first: cada sección rediseñada primero para 360-390px (iPhone 14, 
Pixel 7, Galaxy S23 como target primario, iPhone SE 375px como mínimo 
soportado) y escalada a breakpoints 720/960/1200/1440px. Cambios críticos 
móvil: NavBar con hamburguesa, demo de tonos con chips scrollables 
horizontales, Radar con competidores stacked como cards en vez de tabla, 
4 KPIs en grid 2×2, pricing cards stacked verticales con Pro en dark, 
botones full-width 52px con touch targets ≥44px, reorder con `order` flex 
para que demo aparezca antes de stats tras el hero.

Archivos modificados: landing.css (tokens + todas las media queries 
reescritas mobile-first), LandingPage.tsx, HeroSection, DemoSection, 
RadarPreviewSection, PricingSection, NavBar, FooterEditorial, PublicShell, 
auth pages.

Archivos NO tocados: AppHeader, AppFooter, todas las páginas autenticadas, 
PDFs, favicons, manifest, tests existentes.

QA cross-device obligatorio antes de merge: iPhone SE 2020, iPhone 14, 
iPhone 14 Pro Max, Pixel 7, Samsung Galaxy S23, iPad Mini, iPad Pro, 
desktop 1280px, desktop 1920px. Más al menos una prueba real en móvil 
físico.
```

---

**Fin del documento.**
