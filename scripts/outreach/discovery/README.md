# Discovery pipeline (2026-05)

Genera listas cualificadas de prospects en `velacre-outreach/discovery-icp-*.md` usando solo Google Places API (Outscraper prohibido).

## Flujo

```
queries.json
   ↓
1-source.mjs       Text Search v1 · ~$0.65 (20 queries × $0.032)
   ↓ _raw-discovery/sourced.json
2-volume.mjs       Place Details v1 con reviews · ~$1.86 (~93 × $0.020)
   ↓ _raw-discovery/verified.json
3-build-md.mjs     Local · sin coste
   → velacre-outreach/discovery-icp-{a,b,c}-*.md
```

## Filtro real (paso 2)

| ICP | minUserRatingCount | minRating | maxYearsOpen | minDensityPerYear |
|---|---|---|---|---|
| A · Barbería | 300 | 3.7 | 5 | 200 |
| B · Estética | 200 | 3.7 | 5 | 150 |
| C · Hostelería joven | 500 | 3.7 | 5 | 300 |

**Edad estimada** = días desde la review más antigua entre las 5 destacadas devueltas por Places API. Es un *lower bound* honesto: si Google curó como destacada una review de hace 8 años, el negocio tiene ≥8 años. Filtra a los establecidos viejos (Atlántico 57, Casa Manolo, etc.) que tienen volumen total alto pero crecimiento muerto.

**Densidad** = userRatingCount / max(años, 0.5). Proxy honesto del ritmo de reseñas anual lifetime. Para negocios jóvenes (≤5 años) la densidad lifetime se aproxima al ritmo actual; para viejos quedan filtrados antes por `maxYearsOpen`.

**Heartbeat** (review más reciente entre las 5 devueltas) NO se usa como filtro porque la API rara vez devuelve reviews <30d en las destacadas. Se guarda como bandera informativa: 🔥/⚡/⚠/❄.

## Verificación manual (post-pipeline)

El pipeline no garantiza ≥20 reseñas/mes actuales. La verificación fina la hace Manuel:
- Click en `mapsUrl` → "Más reseñas" → ordenar por "Las más recientes" → contar últimos 30 días.
- Si <20 → descartar.
- Si ≥20 → continuar con IG handle, dueño, hook.

## Uso

```bash
node scripts/outreach/discovery/1-source.mjs
node scripts/outreach/discovery/2-volume.mjs --yes
node scripts/outreach/discovery/3-build-md.mjs
```

Cada paso es independiente. Editar `queries.json` y repetir solo el paso 3 funciona.

## Requisitos

- Node 18+ (sin dependencias npm).
- `backend/.env` con `GOOGLE_PLACES_API_KEY`.

## Coste total batch completo

~$2.50 ($0.65 search + $1.86 details).
