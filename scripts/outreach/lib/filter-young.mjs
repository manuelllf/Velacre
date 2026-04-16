/**
 * Filtro "jóvenes y digitales" sobre heavy-hitters.json:
 *  - userRatingCount ≤ max (default 2500) → proxy de negocio joven / no saturado
 *  - No cadenas (blocklist ampliada + detección de duplicados por base name)
 *  - Digital: tiene website propio (no agregador tipo facebook/guru/tripadvisor)
 *  - Separa en tabla HOSTELERÍA y tabla HOTEL
 *
 * Limitación conocida: Places v1 no devuelve Instagram handle.
 * Proxy más cercano = website sano. Si el prospecto no tiene web propia,
 * asumimos que su presencia digital es débil y lo descartamos.
 *
 * Uso: node scripts/outreach/lib/filter-young.mjs [--max=2500] [--min=1400]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const JSON_IN = path.join(ROOT, 'velacre-outreach', 'raw', 'heavy-hitters.json');
const MD_OUT = path.join(ROOT, 'velacre-outreach', 'prospects-young-digital.md');

function parseCliArgs() {
  const args = process.argv.slice(2);
  const opts = { min: 1400, max: 2500 };
  for (const a of args) {
    const mMin = a.match(/^--min=(\d+)$/);
    if (mMin) opts.min = parseInt(mMin[1], 10);
    const mMax = a.match(/^--max=(\d+)$/);
    if (mMax) opts.max = parseInt(mMax[1], 10);
  }
  return opts;
}

// Cadenas conocidas en España a descartar (además de paradores ya filtrados)
const CHAIN_BLOCKLIST = [
  /^Parador\b|\bParadores\b/i,
  /McDonald's|Burger King|Starbucks|KFC|Telepizza|Domino's/i,
  /Foster'?s\s+Hollywood/i,
  /Ginos|VIPS/i,
  /100\s*Montaditos|La\s+Sure[ñn]a/i,
  /La\s+Tagliatella|Rodilla|Pans\s*&\s*Company/i,
  /Goiko|Five\s*Guys|Tony\s*Roma'?s/i,
  /NH\s+Hotel|Meli[áa]\s|AC\s+Hotel|Iberostar|Barcel[óo]\s/i,
  /Hotel\s+Sercotel|Eurostars|Occidental/i,
  /Lidl|Mercadona|Carrefour/i,
];

// Dominios de agregadores: NO cuentan como "web sana"
const AGGREGATOR_DOMAINS = [
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'tripadvisor', 'restaurantguru', 'guiarepsol',
  'just-eat.es', 'justeat.', 'ubereats.', 'glovoapp',
  'thefork.', 'elTenedor.', 'yelp.',
  'paginasamarillas', 'paxinasgalegas',
  'booking.com', 'expedia.', 'hotels.com', 'trivago.',
];

function normalizeBaseName(name) {
  // Para detectar cadenas: quitar ciudades/sufijos típicos y comparar
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // paréntesis
    .replace(/\b(a\s+coru[ñn]a|vigo|santiago(?:\s+de\s+compostela)?|pontevedra|ourense|lugo|ferrol|sanxenxo|baiona|cambados|melide|salnes|r[íi]as\s+baixas)\b/gi, '')
    .replace(/\b(restaurante|mesón|taberna|asador|pulperia|marisqueria|hotel)\b/gi, '')
    .replace(/[^a-záéíóúñü\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isChain(name, allNames) {
  if (CHAIN_BLOCKLIST.some(rx => rx.test(name))) return true;
  // Detección por nombre base duplicado (p.ej. "Foo A Coruña" y "Foo Vigo")
  const base = normalizeBaseName(name);
  if (base.length < 4) return false; // evitar falsos positivos en nombres cortos
  const duplicates = allNames.filter(n => normalizeBaseName(n) === base);
  return duplicates.length >= 2;
}

function hasHealthyWeb(website) {
  if (!website) return false;
  try {
    const url = new URL(website);
    const host = url.hostname.toLowerCase();
    return !AGGREGATOR_DOMAINS.some(d => host.includes(d));
  } catch {
    return false;
  }
}

function classifyBucket(c) {
  const pType = (c.primaryType ?? '').toLowerCase();
  const types = (c.types ?? []).map(t => t.toLowerCase());
  const source = c.sourceCategory ?? '';

  const isLodging = pType === 'lodging' || pType === 'hotel'
    || types.some(t => t === 'lodging' || t === 'hotel')
    || source === 'hotel';
  if (isLodging) return 'hotel';

  const isFood = pType.includes('restaurant') || pType.includes('bar')
    || pType.includes('cafe') || pType.includes('food')
    || types.some(t => ['restaurant', 'bar', 'cafe', 'food'].includes(t))
    || ['hosteleria', 'asador', 'marisqueria', 'pulperia'].includes(source);
  if (isFood) return 'hosteleria';

  return 'otro';
}

function extractCiudad(address) {
  if (!address) return '—';
  const m = address.match(/\b(\d{5})\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][^,]+?)(?:,|$)/);
  if (m) return m[2].trim();
  return '—';
}

function renderTable(candidates) {
  if (candidates.length === 0) return '_(ninguno)_\n';
  const lines = [];
  lines.push('| # | Nombre | ★ | Reseñas | Ciudad | Tipo | Web |');
  lines.push('|---|---|---|---|---|---|---|');
  candidates.forEach((c, i) => {
    const ciudad = extractCiudad(c.address);
    const ratingStr = c.rating != null ? c.rating.toFixed(1) : '—';
    const name = c.name.replace(/\|/g, '\\|');
    const web = c.website ? `[link](${c.website})` : '—';
    lines.push(`| ${i + 1} | ${name} | ${ratingStr} | ${c.userRatingCount.toLocaleString('es-ES')} | ${ciudad} | ${c.sourceCategory} | ${web} |`);
  });
  return lines.join('\n') + '\n';
}

function main() {
  const opts = parseCliArgs();
  const data = JSON.parse(fs.readFileSync(JSON_IN, 'utf8'));

  // Prefiltro: rango de reseñas
  const inBand = data.candidates.filter(c =>
    c.userRatingCount >= opts.min && c.userRatingCount <= opts.max
  );

  // Nombres para detectar cadenas por duplicado de base
  const allNames = inBand.map(c => c.name);

  // Aplicar filtros de calidad
  const rejected = { chain: [], noWeb: [], otherType: [] };
  const keepers = inBand.filter(c => {
    if (isChain(c.name, allNames)) { rejected.chain.push(c); return false; }
    if (!hasHealthyWeb(c.website)) { rejected.noWeb.push(c); return false; }
    const bucket = classifyBucket(c);
    if (bucket === 'otro') { rejected.otherType.push(c); return false; }
    return true;
  });

  // Separar por bucket
  const hosteleria = keepers.filter(c => classifyBucket(c) === 'hosteleria');
  const hotel = keepers.filter(c => classifyBucket(c) === 'hotel');

  // Ordenar cada uno por rating (más alto primero), desempate por reseñas (más primero)
  const sortFn = (a, b) => {
    const rA = a.rating ?? 0;
    const rB = b.rating ?? 0;
    if (rB !== rA) return rB - rA;
    return b.userRatingCount - a.userRatingCount;
  };
  hosteleria.sort(sortFn);
  hotel.sort(sortFn);

  // Render
  const lines = [];
  lines.push('# Prospects jóvenes y digitales');
  lines.push('');
  lines.push(`> Generado ${new Date().toISOString().slice(0, 10)}. Filtros aplicados:`);
  lines.push(`> - Reseñas all-time: \`${opts.min} ≤ userRatingCount ≤ ${opts.max}\` (proxy de negocio joven / no saturado)`);
  lines.push('> - Sin cadenas (blocklist + detección de duplicados por nombre base)');
  lines.push('> - Web propia (dominio propio; excluye facebook/instagram/tripadvisor/just-eat/booking/etc.)');
  lines.push('> - Ordenado por rating descendente');
  lines.push('>');
  lines.push(`> **Limitación conocida**: Places API v1 básico no devuelve handle de Instagram. El proxy "web sana" asume que un negocio con web propia probablemente tiene presencia digital suficiente. Verifica IG manualmente antes del DM.`);
  lines.push('');
  lines.push(`Resumen: **${inBand.length} candidatos en banda** → tras filtros quedan **${keepers.length}** (${hosteleria.length} hostelería + ${hotel.length} hotel).`);
  lines.push(`Descartados: ${rejected.chain.length} cadenas · ${rejected.noWeb.length} sin web propia · ${rejected.otherType.length} tipo no-ICP.`);
  lines.push('');
  lines.push('## 🍽️ Hostelería');
  lines.push('');
  lines.push(renderTable(hosteleria));
  lines.push('## 🏨 Hotel');
  lines.push('');
  lines.push(renderTable(hotel));

  lines.push('## Siguiente paso');
  lines.push('');
  lines.push('Para cada prospect que decidas atacar:');
  lines.push('1. Verifica su Instagram manualmente (si tiene IG activo reciente + web, luz verde)');
  lines.push('2. Abre `/admin/mini-radar` con su `placeId` (ver JSON raw)');
  lines.push('3. Genera el Mini Radar (~€0,15 por informe)');
  lines.push('4. Envía el PDF por DM con el Template adecuado (o email si IG DM está cerrado)');

  fs.writeFileSync(MD_OUT, lines.join('\n'), 'utf8');

  console.log(`\n✅ Filtrado:`);
  console.log(`   Banda [${opts.min}, ${opts.max}]: ${inBand.length} candidatos`);
  console.log(`   Tras filtros: ${keepers.length} (${hosteleria.length} hostelería · ${hotel.length} hotel)`);
  console.log(`   Descartados: ${rejected.chain.length} cadenas · ${rejected.noWeb.length} sin web propia · ${rejected.otherType.length} tipo no-ICP`);
  console.log(`   Output: ${path.relative(ROOT, MD_OUT)}\n`);
}

main();
