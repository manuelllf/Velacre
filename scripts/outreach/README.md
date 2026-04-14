# Research outreach Velacre

Pipeline en 3 pasos para encontrar prospects con dolor real y clasificarlos por bucket (Core €19 / Pro €49).

## Flujo

```
queries.json                 (configuración editable: queries, umbrales, scoring)
      ↓
1-source-places.mjs          Google Places Text Search · 13 llamadas (~$0.30 de los $200/mes gratis = de facto gratis)
      → velacre-outreach/raw/sourced.json
      ↓
2-verify-volume.mjs          Outscraper · ~€0.02/candidato · 60 reseñas/llamada con extrapolación del ritmo
      → velacre-outreach/raw/verified.json
      ↓
3-score-and-rank.mjs         Local, sin coste
      → velacre-outreach/prospects.md  (tabla editable, versionada en git)
      → velacre-outreach/raw/top.json
```

## Sobre el volumen 90d

El paso 2 pide solo 60 reseñas por candidato (`sort=newest`). Para negocios muy activos que tienen más de 60 reseñas en 90 días, el script **extrapola el ritmo lineal**:

```
60 reseñas más recientes cubren 60 días → ritmo 60/mes → ~180 en 90d
60 reseñas más recientes cubren 90+ días → se cuenta el número exacto dentro de la ventana
```

Los valores extrapolados aparecen marcados con `~N*` (asterisco) en `prospects.md`.

## Uso

```bash
# Paso 1 — sourcing
node scripts/outreach/1-source-places.mjs

# Paso 2 — verificación (pide confirmación 5s antes de gastar)
node scripts/outreach/2-verify-volume.mjs
# o --yes para saltar el countdown
node scripts/outreach/2-verify-volume.mjs --yes

# Paso 3 — scoring + markdown
node scripts/outreach/3-score-and-rank.mjs
```

Cada paso es independiente: puedes editar `queries.json` y repetir solo el paso 3 sin volver a gastar APIs.

## Configuración

Todo en [`queries.json`](queries.json):

- **`prefilter.minUserRatingCount`** — descartar negocios con menos de N reseñas totales (pre-filtro barato antes de Outscraper)
- **`buckets`** — umbrales de clasificación por reseñas en últimos 90 días
- **`outscraper.reviewsLimitPerPlace`** — cuántas reseñas recientes pedir (150 cubre bien un trimestre de los más activos)
- **`scoring`** — pesos de las 4 señales de dolor
- **`queries`** — la lista de 13 queries (editable)

## Buckets

| Bucket | Reseñas en 90d | Plan target |
|---|---|---|
| `DISCARD` | < 45 (menos de 15/mes) | No hay dolor suficiente |
| `CORE_CANDIDATE` | 45-89 (15-29/mes) | Core €19 (20 IA/mes le llega) |
| `PRO_CANDIDATE` | ≥ 90 (30+/mes) | Pro €49 (Core se queda corto) |

## Scoring (sobre 100, dentro de cada bucket)

- **+40** · tasa de respuesta 90d (0% contestadas = 40 pts, lineal)
- **+30** · reseñas 1-2★ sin contestar (5 pts c/u, tope 30)
- **+20** · rating vulnerable 3.8-4.4 (por debajo = caso perdido, por encima = no sangra)
- **+10** · canal contactable (web propia o teléfono en Google Places)

## Ficheros generados

Bajo `velacre-outreach/` (raíz del repo):

- **`prospects.md`** — tabla editable con Top 5 Pro + Top 5 Core. Commiteable. Edita a mano la columna "Estado outreach" según avances.
- **`raw/sourced.json`** — salida del paso 1 (gitignored)
- **`raw/verified.json`** — salida del paso 2 (gitignored)
- **`raw/top.json`** — salida del paso 3 (gitignored)

## Requisitos

- Node 18+ (probado con 24). Sin dependencias npm — usa `fetch` y `fs` nativos.
- `backend/.env` con `GOOGLE_PLACES_API_KEY` y `OUTSCRAPER_API_KEY`.

## Notas

- **O Fogar da Carne** está pineado manualmente en `prospects.md` como prospect #1. No pasa por el batch automático.
- Los scripts **no envían outreach** — solo generan la lista priorizada. El DM/email lo envías tú.
- Si Outscraper falla en algún candidato, queda con `bucket: ERROR` y se salta en el scoring.
- Guardado parcial cada 10 candidatos en el paso 2 por si hay corte a media ejecución.
