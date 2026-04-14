/**
 * Paso 1 · Sourcing con Google Places Text Search v1
 *
 * - Ejecuta las queries definidas en queries.json
 * - Pide field mask con userRatingCount (pre-filtro barato)
 * - Dedupe por place_id
 * - Escribe velacre-outreach/raw/sourced.json
 *
 * Uso: node scripts/outreach/1-source-places.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, requireKeys } from './lib/env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(__dirname, 'queries.json');
const OUT_DIR = path.join(ROOT, 'velacre-outreach', 'raw');
const OUT_PATH = path.join(OUT_DIR, 'sourced.json');

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.primaryType',
  'places.types',
  'places.websiteUri',
  'places.internationalPhoneNumber',
  'places.googleMapsUri',
  'places.location'
].join(',');

async function searchPlaces(apiKey, query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'es', regionCode: 'ES' })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.places ?? [];
}

function normalize(place, meta) {
  return {
    placeId: place.id,
    name: place.displayName?.text ?? '',
    address: place.formattedAddress ?? '',
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? 0,
    primaryType: place.primaryType ?? null,
    types: place.types ?? [],
    website: place.websiteUri ?? null,
    phone: place.internationalPhoneNumber ?? null,
    mapsUrl: place.googleMapsUri ?? null,
    location: place.location ?? null,
    sourceQuery: meta.q,
    sourceCategory: meta.category,
    sourceId: meta.id
  };
}

async function main() {
  const env = loadEnv();
  requireKeys(env, ['GOOGLE_PLACES_API_KEY']);
  const apiKey = env.GOOGLE_PLACES_API_KEY;

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const minRatings = config.prefilter.minUserRatingCount;

  console.log(`\n🔎 Sourcing — ${config.queries.length} queries · pre-filtro userRatingCount ≥ ${minRatings}\n`);

  const byPlaceId = new Map();
  const stats = [];

  for (const q of config.queries) {
    process.stdout.write(`  [${q.id}] ${q.q.padEnd(42)} `);
    try {
      const raw = await searchPlaces(apiKey, q.q);
      let passed = 0;
      for (const place of raw) {
        const candidate = normalize(place, q);
        if (!candidate.placeId) continue;
        if (candidate.userRatingCount < minRatings) continue;
        if (!byPlaceId.has(candidate.placeId)) {
          byPlaceId.set(candidate.placeId, candidate);
          passed++;
        }
      }
      stats.push({ id: q.id, query: q.q, returned: raw.length, passedPrefilter: passed });
      console.log(`→ ${raw.length} bruto · ${passed} nuevos tras filtro`);
    } catch (err) {
      console.log(`✖ ${err.message}`);
      stats.push({ id: q.id, query: q.q, error: err.message });
    }
    await new Promise(r => setTimeout(r, 300));
  }

  const candidates = Array.from(byPlaceId.values());
  candidates.sort((a, b) => b.userRatingCount - a.userRatingCount);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    prefilter: { minUserRatingCount: minRatings },
    stats,
    candidates
  }, null, 2), 'utf8');

  console.log(`\n✅ ${candidates.length} candidatos únicos escritos en:`);
  console.log(`   ${path.relative(ROOT, OUT_PATH)}`);
  console.log(`\nPróximo paso: node scripts/outreach/2-verify-volume.mjs\n`);
}

main().catch(err => {
  console.error('\n✖ Error fatal:', err.message);
  process.exit(1);
});
