/**
 * Paso 1 · Sourcing con Google Places Text Search v1
 *
 * - Ejecuta queries de queries.json
 * - Aplica suelo userRatingCount + banda rating [min,max] + priceLevel (si aplica)
 * - Dedupe por placeId
 * - Escribe _raw-discovery/sourced.json
 *
 * Coste: 1 query = $0.032.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, requireKeys } from '../lib/env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const CONFIG_PATH = path.join(__dirname, 'queries.json');
const OUT_DIR = path.join(ROOT, 'velacre-outreach', '_raw-discovery');
const OUT_PATH = path.join(OUT_DIR, 'sourced.json');
const DM_HISTORY_PATH = path.join(ROOT, 'velacre-outreach', 'dm-history.md');

function loadExcludePatterns() {
  if (!fs.existsSync(DM_HISTORY_PATH)) return [];
  const md = fs.readFileSync(DM_HISTORY_PATH, 'utf8');
  const fenceMatch = md.match(/```\n([\s\S]*?)\n```/);
  if (!fenceMatch) return [];
  return fenceMatch[1]
    .split('\n')
    .map(l => l.trim().toLowerCase())
    .filter(Boolean);
}

function isExcluded(candidate, patterns) {
  const haystack = `${candidate.name} ${candidate.address}`.toLowerCase();
  return patterns.some(p => haystack.includes(p));
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.primaryType',
  'places.types',
  'places.websiteUri',
  'places.internationalPhoneNumber',
  'places.googleMapsUri',
  'places.location'
].join(',');

async function searchText(apiKey, query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'es', regionCode: 'ES' })
  });
  if (!res.ok) throw new Error(`Search ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.places ?? [];
}

function normalize(place, meta) {
  return {
    placeId: place.id,
    icp: meta.icp,
    cityFromQuery: meta.city,
    sourceQuery: meta.q,
    name: place.displayName?.text ?? '',
    address: place.formattedAddress ?? '',
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? 0,
    priceLevel: place.priceLevel ?? null,
    primaryType: place.primaryType ?? null,
    types: place.types ?? [],
    website: place.websiteUri ?? null,
    phone: place.internationalPhoneNumber ?? null,
    mapsUrl: place.googleMapsUri ?? null,
    location: place.location ?? null
  };
}

async function main() {
  const env = loadEnv();
  requireKeys(env, ['GOOGLE_PLACES_API_KEY']);
  const apiKey = env.GOOGLE_PLACES_API_KEY;

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const { thresholds, queries, priceLevelOrdinals } = config;
  const excludePatterns = loadExcludePatterns();

  console.log(`\n🔎 Paso 1 · Sourcing — ${queries.length} queries`);
  console.log(`   Banda rating ${thresholds[queries[0].icp].minRating}-${thresholds[queries[0].icp].maxRating}`);
  console.log(`   Excluyendo ${excludePatterns.length} nombres del histórico de DMs\n`);

  const byPlaceId = new Map();
  const stats = [];

  for (const meta of queries) {
    const t = thresholds[meta.icp];
    process.stdout.write(`  [${meta.icp}] ${meta.q.padEnd(45)} `);
    try {
      const raw = await searchText(apiKey, meta.q);
      let passed = 0;
      let dupes = 0;
      let aboveCap = 0;
      let excluded = 0;
      for (const place of raw) {
        const c = normalize(place, meta);
        if (!c.placeId) continue;
        if (c.userRatingCount < t.minUserRatingCount) continue;
        if (t.maxUserRatingCount != null && c.userRatingCount > t.maxUserRatingCount) {
          aboveCap++;
          continue;
        }
        if ((c.rating ?? 0) < t.minRating) continue;
        if ((c.rating ?? 0) > t.maxRating) continue;

        if (t.minPriceLevelOrdinal != null) {
          const ordinal = priceLevelOrdinals[c.priceLevel] ?? -1;
          if (ordinal < t.minPriceLevelOrdinal) continue;
        }

        if (isExcluded(c, excludePatterns)) {
          excluded++;
          continue;
        }

        if (byPlaceId.has(c.placeId)) {
          dupes++;
          continue;
        }
        byPlaceId.set(c.placeId, c);
        passed++;
      }
      const tags = [`${raw.length} bruto`, `${passed} pasan`];
      if (dupes) tags.push(`${dupes} dupes`);
      if (aboveCap) tags.push(`${aboveCap} >cap`);
      if (excluded) tags.push(`${excluded} ya-DMd`);
      stats.push({ icp: meta.icp, query: meta.q, returned: raw.length, passed, dupes, aboveCap, excluded });
      console.log(`→ ${tags.join(' · ')}`);
    } catch (err) {
      console.log(`✖ ${err.message}`);
      stats.push({ icp: meta.icp, query: meta.q, error: err.message });
    }
    await new Promise(r => setTimeout(r, 300));
  }

  const candidates = Array.from(byPlaceId.values());
  candidates.sort((a, b) => b.userRatingCount - a.userRatingCount);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    thresholds,
    stats,
    candidates
  }, null, 2), 'utf8');

  const byIcp = candidates.reduce((acc, c) => {
    acc[c.icp] = (acc[c.icp] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n✅ ${candidates.length} candidatos únicos tras prefilter:`);
  console.log(`   ICP A: ${byIcp.A ?? 0} · ICP B: ${byIcp.B ?? 0} · ICP C: ${byIcp.C ?? 0}`);
  console.log(`   ${path.relative(ROOT, OUT_PATH)}`);
  console.log(`\nPróximo paso: node scripts/outreach/discovery/2-volume.mjs\n`);
}

main().catch(err => {
  console.error('\n✖ Error fatal:', err.message);
  process.exit(1);
});
