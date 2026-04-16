/**
 * Helper rápido: regenera el MD desde heavy-hitters.json sin llamar a Places.
 * Útil cuando cambias el rendering o quieres un rango distinto sin gastar
 * cuota de Places.
 *
 * Uso:
 *   node scripts/outreach/lib/regen-md.mjs                       # usa la banda del JSON
 *   node scripts/outreach/lib/regen-md.mjs --min=1400 --max=6000 # refiltra el JSON
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const JSON_IN = path.join(ROOT, 'velacre-outreach', 'raw', 'heavy-hitters.json');
const MD_OUT = path.join(ROOT, 'velacre-outreach', 'prospects-heavy-hitters.md');

function parseCliArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (const a of args) {
    const mMin = a.match(/^--min=(\d+)$/);
    if (mMin) opts.min = parseInt(mMin[1], 10);
    const mMax = a.match(/^--max=(\d+)$/);
    if (mMax) opts.max = parseInt(mMax[1], 10);
  }
  return opts;
}

function extractCiudad(address) {
  if (!address) return '—';
  const m = address.match(/\b(\d{5})\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][^,]+?)(?:,|$)/);
  if (m) return m[2].trim();
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(p) && !/^España$/i.test(p)) {
      return p.replace(/^\d{5}\s+/, '').trim();
    }
  }
  return '—';
}

const BLOCKLIST = [
  /^Parador\s+de/i,
  /\bParadores\b/i,
  /McDonald's|Burger King|Starbucks|KFC|Telepizza|Domino's/i,
];

function renderMarkdown(candidates, minRatings, maxRatings) {
  const filtered = candidates.filter(c => !BLOCKLIST.some(rx => rx.test(c.name)));
  const excluded = candidates.length - filtered.length;

  const lines = [];
  lines.push(`# Prospects heavy hitters — Google Places only`);
  lines.push('');
  lines.push(`> Generado ${new Date().toISOString().slice(0, 10)}. Banda: \`${minRatings} ≤ userRatingCount ≤ ${maxRatings}\`. Sin Outscraper.`);
  lines.push('');
  lines.push(`**${filtered.length} candidatos** (de ${candidates.length} brutos, ${excluded} filtrados por ser cadenas/paradores).`);
  lines.push('Ordenados por volumen de reseñas (más primero).');
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

const opts = parseCliArgs();
const data = JSON.parse(fs.readFileSync(JSON_IN, 'utf8'));

// Threshold original del JSON (puede ser { min, max } nuevo o legacy number)
const orig = typeof data.threshold === 'object' ? data.threshold : { min: data.threshold, max: Infinity };
const min = opts.min ?? orig.min;
const max = opts.max ?? (orig.max === Infinity ? Number.POSITIVE_INFINITY : orig.max);

// Re-filtrar desde el JSON (puede ser más estricto que el original, pero no más laxo
// porque el JSON no contiene candidatos fuera del rango original)
const refiltered = data.candidates.filter(c => c.userRatingCount >= min && c.userRatingCount <= max);

const md = renderMarkdown(refiltered, min, max);
fs.writeFileSync(MD_OUT, md, 'utf8');

const blocked = refiltered.filter(c => BLOCKLIST.some(rx => rx.test(c.name))).length;
console.log(`✅ MD regenerado: banda [${min}, ${max}] · ${data.candidates.length} en JSON → ${refiltered.length} tras rango → ${refiltered.length - blocked} tras blocklist`);
