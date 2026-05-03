/**
 * Paso 2 · Edad estimada + densidad con Google Places Details v1
 *
 * - Lee _raw-discovery/sourced.json
 * - Para cada candidato pide Place Details con campo `reviews`
 * - Captura las 5 publishTime devueltas
 * - Estima edad del negocio = días desde la review más antigua de las 5 (lower bound)
 * - Calcula densidad = userRatingCount / max(años_estimados, 0.5)
 * - Filtra: maxYearsOpen + minDensityPerYear + canal contactable
 * - Guarda heartbeat (review más reciente) como señal informativa
 * - Escribe _raw-discovery/verified.json
 *
 * Justificación del proxy edad:
 * Google devuelve 5 reviews destacadas (no las 5 más antiguas ni las 5 más recientes).
 * La review más antigua entre las 5 destacadas es un LOWER BOUND honesto de la edad
 * del negocio: si Google ha curado una review de 2019 como "destacada",
 * el negocio existe al menos desde 2019. La edad real puede ser mayor pero no menor.
 * Para nuestro filtro "≤5 años" eso basta: si la más antigua devuelta tiene >5 años,
 * el negocio TIENE >5 años. Si la más antigua tiene <5 años, podría tener <5 o más.
 * Asumimos que Google curaría una review más vieja si la hubiera; falible pero útil.
 *
 * Coste: ~$0.020 por candidato.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, requireKeys } from '../lib/env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const RAW_DIR = path.join(ROOT, 'velacre-outreach', '_raw-discovery');
const SOURCED_PATH = path.join(RAW_DIR, 'sourced.json');
const VERIFIED_PATH = path.join(RAW_DIR, 'verified.json');
const QUERIES_PATH = path.join(__dirname, 'queries.json');

const args = process.argv.slice(2);
const AUTO_YES = args.includes('--yes');

const FIELD_MASK = ['id', 'reviews'].join(',');

async function getDetails(apiKey, placeId) {
  const url = `https://places.googleapis.com/v1/places/${placeId}?languageCode=es&regionCode=ES`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Details ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function daysSince(iso) {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

async function countdown() {
  if (AUTO_YES) return;
  console.log('Tienes 5s para abortar (Ctrl+C). Ejecuta con --yes para saltar.\n');
  for (let i = 5; i > 0; i--) {
    process.stdout.write(`\r  ${i}...`);
    await new Promise(r => setTimeout(r, 1000));
  }
  process.stdout.write('\r       \r');
}

async function main() {
  const env = loadEnv();
  requireKeys(env, ['GOOGLE_PLACES_API_KEY']);
  const apiKey = env.GOOGLE_PLACES_API_KEY;

  if (!fs.existsSync(SOURCED_PATH)) {
    throw new Error(`No existe ${SOURCED_PATH}. Corre antes el paso 1.`);
  }

  const sourced = JSON.parse(fs.readFileSync(SOURCED_PATH, 'utf8'));
  const { candidates } = sourced;
  // Thresholds desde queries.json (fuente de verdad), no desde sourced.json
  // (que pudo generarse con thresholds viejos antes de cambiar queries.json).
  const { thresholds } = JSON.parse(fs.readFileSync(QUERIES_PATH, 'utf8'));

  const estimatedCost = (candidates.length * 0.020).toFixed(2);
  console.log(`\n🩺 Paso 2 · Edad + densidad — ${candidates.length} candidatos · coste estimado $${estimatedCost}\n`);
  await countdown();

  const verified = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const t = thresholds[c.icp];
    const prefix = `  [${(i + 1).toString().padStart(2)}/${candidates.length}] [${c.icp}] ${(c.name ?? '?').slice(0, 32).padEnd(32)} `;
    process.stdout.write(prefix);

    try {
      const details = await getDetails(apiKey, c.placeId);
      const reviews = details.reviews ?? [];

      const allDates = reviews
        .map(r => r.publishTime)
        .filter(Boolean)
        .map(t => daysSince(t))
        .sort((a, b) => a - b); // ascending: más reciente (menos días) primero

      const mostRecentDays = allDates[0] ?? null;
      const oldestDays = allDates[allDates.length - 1] ?? null;

      const ageYearsLowerBound = oldestDays !== null ? oldestDays / 365.25 : null;
      const hasContact = !!(c.website || c.phone);
      const cualificado = hasContact;

      verified.push({
        ...c,
        mostRecentReviewDays: mostRecentDays !== null ? Math.round(mostRecentDays) : null,
        oldestReviewDays: oldestDays !== null ? Math.round(oldestDays) : null,
        ageYearsLowerBound: ageYearsLowerBound !== null ? +ageYearsLowerBound.toFixed(2) : null,
        reviewsReturnedCount: reviews.length,
        hasContact,
        cualificado
      });

      const heartTag = mostRecentDays !== null ? ` · heartbeat ${Math.round(mostRecentDays)}d` : '';
      const ageTag = ageYearsLowerBound !== null ? ` · span ${ageYearsLowerBound.toFixed(1)}a` : '';
      const tag = cualificado ? `✅${heartTag}${ageTag}` : `❌ sin canal`;
      console.log(tag);
    } catch (err) {
      console.log(`✖ ${err.message}`);
      verified.push({ ...c, error: err.message, cualificado: false });
    }

    await new Promise(r => setTimeout(r, 250));

    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(VERIFIED_PATH, JSON.stringify({
        generatedAt: new Date().toISOString(),
        partial: true,
        thresholds,
        verified
      }, null, 2), 'utf8');
    }
  }

  fs.writeFileSync(VERIFIED_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    partial: false,
    thresholds,
    verified
  }, null, 2), 'utf8');

  const cualificados = verified.filter(v => v.cualificado);
  const byIcp = cualificados.reduce((acc, v) => {
    acc[v.icp] = (acc[v.icp] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n✅ ${cualificados.length} cualificados de ${verified.length}:`);
  console.log(`   ICP A: ${byIcp.A ?? 0} · ICP B: ${byIcp.B ?? 0} · ICP C: ${byIcp.C ?? 0}`);
  console.log(`   ${path.relative(ROOT, VERIFIED_PATH)}`);
  console.log(`\nPróximo paso: node scripts/outreach/discovery/3-build-md.mjs\n`);
}

main().catch(err => {
  console.error('\n✖ Error fatal:', err.message);
  process.exit(1);
});
