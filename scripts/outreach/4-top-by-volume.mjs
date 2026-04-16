/**
 * Paso 4 · Heavy hitters — Google Places only, sin Outscraper
 *
 * Busca negocios con >= N reseñas all-time en Google (default 1400).
 * Pensado para outreach rápido a prospects establecidos: si tienen 1400+
 * reseñas acumuladas, probablemente reciben decenas por mes y son buen ICP.
 *
 * El Mini Radar valida volumen real SOLO cuando decidas atacar un prospect
 * concreto (1 llamada Outscraper por prospect activado, no 125 a ciegas).
 *
 * Coste: ~$0.22 total (13-20 requests a Places Text Search). Cero Outscraper.
 *
 * Output:
 *   - velacre-outreach/raw/heavy-hitters.json  (procesable)
 *   - velacre-outreach/prospects-heavy-hitters.md (consumible en Drive/editor)
 *
 * Uso:
 *   node scripts/outreach/4-top-by-volume.mjs           # threshold 1400 default
 *   node scripts/outreach/4-top-by-volume.mjs --min=1000
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, requireKeys } from './lib/env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'velacre-outreach', 'raw');
const JSON_OUT = path.join(OUT_DIR, 'heavy-hitters.json');
const MD_OUT = path.join(ROOT, 'velacre-outreach', 'prospects-heavy-hitters.md');

// Queries ampliadas respecto al queries.json:
// - Cubre las 4 ciudades grandes + Ourense/Lugo/Ferrol (nuevas)
// - Añade asadores, marisquerías, pulperías (tipos fuertes en Galicia con mucho volumen)
// - Mantiene hoteles boutique y clínicas
const QUERIES = [
  // Restaurantes por ciudad
  { category: 'hosteleria', q: 'restaurantes A Coruña' },
  { category: 'hosteleria', q: 'restaurantes Vigo' },
  { category: 'hosteleria', q: 'restaurantes Santiago de Compostela' },
  { category: 'hosteleria', q: 'restaurantes Pontevedra' },
  { category: 'hosteleria', q: 'restaurantes Ourense' },
  { category: 'hosteleria', q: 'restaurantes Lugo' },
  { category: 'hosteleria', q: 'restaurantes Ferrol' },
  // Subtipos hostelería muy gallegos (alto volumen típico)
  { category: 'asador',      q: 'asador Galicia' },
  { category: 'asador',      q: 'churrasquería Galicia' },
  { category: 'marisqueria', q: 'marisquería A Coruña' },
  { category: 'marisqueria', q: 'marisquería Vigo' },
  { category: 'marisqueria', q: 'marisquería Cambados' },
  { category: 'pulperia',    q: 'pulpería Galicia' },
  // Clínicas (ICP secundario)
  { category: 'clinica',     q: 'clínica dental A Coruña' },
  { category: 'clinica',     q: 'clínica dental Vigo' },
  { category: 'clinica',     q: 'clínica estética Santiago' },
  { category: 'clinica',     q: 'medicina estética Galicia' },
  // Hoteles (heavy hitters suelen ser cadenas o resort — filtrar manual luego)
  { category: 'hotel',       q: 'hotel Sanxenxo' },
  { category: 'hotel',       q: 'parador Galicia' },
];

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
  'places.location',
].join(',');

function parseCliArgs() {
  const args = process.argv.slice(2);
  const opts = { min: 1400 };
  for (const a of args) {
    const m = a.match(/^--min=(\d+)$/);
    if (m) opts.min = parseInt(m[1], 10);
  }
  return opts;
}

async function searchPlaces(apiKey, query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'es', regionCode: 'ES' }),
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
  };
}

/** Extrae "CP + Ciudad" de una dirección española típica de Google. */
function extractCiudad(address) {
  if (!address) return '—';
  // Buscar patrón "NNNNN Ciudad" (5 dígitos + nombre)
  const m = address.match(/\b(\d{5})\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][^,]+?)(?:,|$)/);
  if (m) return m[2].trim();
  // Fallback: última parte después del penúltimo split
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  // Coger la parte que tenga una palabra alfabética (no solo número)
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(p) && !/^España$/i.test(p)) {
      return p.replace(/^\d{5}\s+/, '').trim();
    }
  }
  return '—';
}

/** Marcas/cadenas descartables (no son prospectos individuales). */
const BLOCKLIST = [
  /^Parador\s+de/i,
  /\bParadores\b/i,
  /McDonald's|Burger King|Starbucks|KFC|Telepizza|Domino's/i,
];

function renderMarkdown(candidates, minRatings) {
  const filtered = candidates.filter(c => !BLOCKLIST.some(rx => rx.test(c.name)));
  const excluded = candidates.length - filtered.length;

  const lines = [];
  lines.push(`# Prospects heavy hitters — Google Places only`);
  lines.push('');
  lines.push(`> Generado ${new Date().toISOString().slice(0, 10)}. Filtro: \`userRatingCount >= ${minRatings}\`. Sin Outscraper.`);
  lines.push('');
  lines.push(`**${filtered.length} candidatos** (de ${candidates.length} brutos, ${excluded} filtrados por ser cadenas/paradores).`);
  lines.push('Ordenados por volumen de reseñas (más primero).');
  lines.push('');
  lines.push('Columnas:');
  lines.push('- `#`: rank por volumen');
  lines.push('- `Nombre`: display name de Google');
  lines.push('- `★`: rating medio Google');
  lines.push('- `Reseñas`: total all-time');
  lines.push('- `Ciudad`: extraída del address');
  lines.push('- `Tipo`: categoría de la query que lo encontró');
  lines.push('- `Contacto`: web o teléfono público');
  lines.push('');
  lines.push('| # | Nombre | ★ | Reseñas | Ciudad | Tipo | Contacto |');
  lines.push('|---|---|---|---|---|---|---|');

  filtered.forEach((c, i) => {
    const ciudad = extractCiudad(c.address);
    const ratingStr = c.rating != null ? c.rating.toFixed(1) : '—';
    let contacto = '—';
    if (c.website) contacto = `[web](${c.website})`;
    else if (c.phone) contacto = c.phone;
    const name = c.name.replace(/\|/g, '\\|');
    lines.push(`| ${i + 1} | ${name} | ${ratingStr} | ${c.userRatingCount.toLocaleString('es-ES')} | ${ciudad} | ${c.sourceCategory} | ${contacto} |`);
  });

  lines.push('');
  lines.push('## Siguiente paso');
  lines.push('');
  lines.push('Para cada prospect que decidas atacar:');
  lines.push('1. Abre `/admin/mini-radar` en la web de Velacre');
  lines.push(`2. Pega el \`placeId\` (lista completa en \`raw/heavy-hitters.json\`)`);
  lines.push('3. Genera el Mini Radar (~€0,15 por informe)');
  lines.push('4. Envía el PDF por DM con el Template adecuado');
  lines.push('');
  lines.push('**No envíes DMs sin Mini Radar previo** — pierdes el hook comercial específico.');
  return lines.join('\n');
}

async function main() {
  const opts = parseCliArgs();
  const env = loadEnv();
  requireKeys(env, ['GOOGLE_PLACES_API_KEY']);
  const apiKey = env.GOOGLE_PLACES_API_KEY;

  console.log(`\n🎯 Top by volume — threshold userRatingCount >= ${opts.min}`);
  console.log(`   ${QUERIES.length} queries · Google Places only · sin Outscraper\n`);

  const byPlaceId = new Map();
  const stats = [];

  for (const q of QUERIES) {
    process.stdout.write(`  ${q.q.padEnd(38)} `);
    try {
      const raw = await searchPlaces(apiKey, q.q);
      let passed = 0;
      for (const place of raw) {
        const candidate = normalize(place, q);
        if (!candidate.placeId) continue;
        if (candidate.userRatingCount < opts.min) continue;
        if (!byPlaceId.has(candidate.placeId)) {
          byPlaceId.set(candidate.placeId, candidate);
          passed++;
        }
      }
      stats.push({ query: q.q, returned: raw.length, passed });
      console.log(`→ ${String(raw.length).padStart(2)} bruto · ${passed} nuevos ≥${opts.min}`);
    } catch (err) {
      console.log(`✖ ${err.message}`);
      stats.push({ query: q.q, error: err.message });
    }
    await new Promise(r => setTimeout(r, 250));
  }

  const candidates = Array.from(byPlaceId.values());
  candidates.sort((a, b) => b.userRatingCount - a.userRatingCount);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    threshold: opts.min,
    queries: QUERIES,
    stats,
    candidates,
  }, null, 2), 'utf8');

  fs.writeFileSync(MD_OUT, renderMarkdown(candidates, opts.min), 'utf8');

  console.log(`\n✅ ${candidates.length} heavy hitters encontrados (≥ ${opts.min} reseñas all-time)`);
  console.log(`   JSON: ${path.relative(ROOT, JSON_OUT)}`);
  console.log(`   MD:   ${path.relative(ROOT, MD_OUT)}`);
  if (candidates.length > 0) {
    console.log(`\n   Top 5:`);
    candidates.slice(0, 5).forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.name.padEnd(38)} ${String(c.userRatingCount).padStart(5)} reseñas · ${c.rating?.toFixed(1) ?? '—'}★`);
    });
  }
  console.log('');
}

main().catch(err => {
  console.error('\n✖ Error fatal:', err.message);
  process.exit(1);
});
