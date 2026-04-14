/**
 * Paso 2 · Verificación de volumen real con Outscraper
 *
 * - Carga raw/sourced.json
 * - Por cada candidato, pide reviewsLimitPerPlace reseñas (sort=newest)
 * - Cuenta reviews_90d / reviews_60d / reviews_30d
 * - Calcula response_rate_90d, negative_unanswered_90d, distribución estrellas
 * - Asigna bucket preliminar (discard / core / pro)
 * - Escribe raw/verified.json
 *
 * Características:
 * - Imprime coste estimado y espera 5 segundos (Ctrl+C para abortar)
 * - Guarda progreso parcial cada 10 candidatos (por si falla a media)
 * - Rate limit: delay configurable + backoff en 429
 *
 * Uso: node scripts/outreach/2-verify-volume.mjs
 *      node scripts/outreach/2-verify-volume.mjs --yes   (sin countdown)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, requireKeys } from './lib/env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(__dirname, 'queries.json');
const RAW_DIR = path.join(ROOT, 'velacre-outreach', 'raw');
const SOURCED_PATH = path.join(RAW_DIR, 'sourced.json');
const VERIFIED_PATH = path.join(RAW_DIR, 'verified.json');
const REVIEWS_DIR = path.join(RAW_DIR, 'reviews');

const OUTSCRAPER_COST_PER_CALL_EUR = 0.02;
const args = process.argv.slice(2);
const AUTO_YES = args.includes('--yes');

const OUTSCRAPER_URL = 'https://api.app.outscraper.com/maps/reviews-v3';

async function fetchReviews(apiKey, placeId, limit, retriesLeft) {
  const url = `${OUTSCRAPER_URL}?query=${encodeURIComponent(placeId)}&reviewsLimit=${limit}&sort=newest&async=false`;
  try {
    const res = await fetch(url, { headers: { 'X-API-KEY': apiKey } });
    if (res.status === 429 && retriesLeft > 0) {
      await new Promise(r => setTimeout(r, 2000 * (3 - retriesLeft)));
      return fetchReviews(apiKey, placeId, limit, retriesLeft - 1);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 150)}`);
    }
    const data = await res.json();
    const reviewsArr = data?.data?.[0]?.reviews_data ?? [];
    return reviewsArr.map(r => ({
      id: r.review_id ?? '',
      rating: typeof r.review_rating === 'number' ? r.review_rating : 0,
      text: r.review_text ?? '',
      // Preferir Unix timestamp (fiable) sobre el string formateado (MM/DD/YYYY en US locale)
      timestamp: typeof r.review_timestamp === 'number' ? r.review_timestamp : null,
      dateUtc: r.review_datetime_utc ?? '',
      ownerAnswered: typeof r.owner_answer === 'string' && r.owner_answer.length > 0,
      lang: r.review_lang ?? null
    }));
  } catch (err) {
    if (retriesLeft > 0) {
      await new Promise(r => setTimeout(r, 1500));
      return fetchReviews(apiKey, placeId, limit, retriesLeft - 1);
    }
    throw err;
  }
}

function parseDate(str) {
  if (!str) return null;
  // Formato Outscraper: "MM/DD/YYYY HH:mm:ss" (US locale, UTC)
  const us = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(str);
  if (us) {
    const [, mm, dd, yyyy, hh, mi, ss] = us;
    const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss));
    return isNaN(d.getTime()) ? null : d;
  }
  // Fallback formato ISO "YYYY-MM-DD HH:mm:ss"
  const iso = new Date(str.replace(' ', 'T') + 'Z');
  return isNaN(iso.getTime()) ? null : iso;
}

function reviewTime(r) {
  // Preferir Unix timestamp en segundos (fiable), fallback a parseo de string
  if (typeof r.timestamp === 'number' && r.timestamp > 0) {
    return new Date(r.timestamp * 1000);
  }
  return parseDate(r.dateUtc);
}

function analyzeReviews(reviews, fetchLimit) {
  const now = Date.now();
  const DAY = 86400000;
  const cut90 = now - 90 * DAY;
  const cut60 = now - 60 * DAY;
  const cut30 = now - 30 * DAY;

  let total90 = 0, total60 = 0, total30 = 0;
  let answered90 = 0;
  let negativeUnanswered90 = 0;
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let oldestFetched = null;

  for (const r of reviews) {
    const d = reviewTime(r);
    if (!d) continue;
    const t = d.getTime();
    if (!oldestFetched || t < oldestFetched) oldestFetched = t;
    if (r.rating >= 1 && r.rating <= 5) dist[r.rating]++;
    if (t >= cut90) {
      total90++;
      if (r.ownerAnswered) answered90++;
      if (r.rating <= 2 && !r.ownerAnswered) negativeUnanswered90++;
    }
    if (t >= cut60) total60++;
    if (t >= cut30) total30++;
  }

  const responseRate90 = total90 > 0 ? answered90 / total90 : null;

  // Extrapolación: si hemos llegado al límite del fetch y la reseña más antigua
  // aún cae dentro de los 90 días, significa que hay más reseñas que no pedimos.
  // Proyectamos el ritmo lineal al total de 90d.
  const hitLimit = reviews.length >= fetchLimit;
  const windowCapped = hitLimit && oldestFetched !== null && oldestFetched > cut90;
  let reviews90dEffective = total90;
  let extrapolated = false;
  let daysCovered = null;

  if (windowCapped) {
    daysCovered = (now - oldestFetched) / DAY;
    if (daysCovered > 0) {
      reviews90dEffective = Math.round((reviews.length / daysCovered) * 90);
      extrapolated = true;
    }
  }

  return {
    totalFetched: reviews.length,
    reviews90d: total90,                    // conteo exacto dentro de la ventana pedida
    reviews90dEffective,                    // conteo real o extrapolado (lo que usa el bucket)
    extrapolated,
    daysCovered,
    reviews60d: total60,
    reviews30d: total30,
    answered90d: answered90,
    responseRate90d: responseRate90,
    negativeUnanswered90d: negativeUnanswered90,
    ratingDistribution: dist,
    windowCapped,
    oldestFetchedIso: oldestFetched ? new Date(oldestFetched).toISOString() : null
  };
}

function assignBucket(metrics, buckets) {
  const v = metrics.reviews90dEffective;
  if (v < buckets.core_min_reviews_90d) return 'DISCARD';
  if (v >= buckets.pro_min_reviews_90d) return 'PRO_CANDIDATE';
  return 'CORE_CANDIDATE';
}

async function countdown(seconds) {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r  Arrancando en ${i}s... (Ctrl+C para abortar)`);
    await new Promise(r => setTimeout(r, 1000));
  }
  process.stdout.write('\r                                              \r');
}

async function main() {
  if (!fs.existsSync(SOURCED_PATH)) {
    throw new Error(`No existe ${path.relative(ROOT, SOURCED_PATH)}. Corre primero 1-source-places.mjs`);
  }

  const env = loadEnv();
  requireKeys(env, ['OUTSCRAPER_API_KEY']);
  const apiKey = env.OUTSCRAPER_API_KEY;

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const { candidates } = JSON.parse(fs.readFileSync(SOURCED_PATH, 'utf8'));
  const limit = config.outscraper.reviewsLimitPerPlace;
  const delay = config.outscraper.delayBetweenCallsMs;
  const maxRetries = config.outscraper.maxRetries;
  const buckets = config.buckets;

  const totalCalls = candidates.length;
  const estCost = (totalCalls * OUTSCRAPER_COST_PER_CALL_EUR).toFixed(2);

  console.log(`\n🧪 Verificación volumen — Outscraper`);
  console.log(`   Candidatos a verificar: ${totalCalls}`);
  console.log(`   Reseñas por llamada: ${limit}`);
  console.log(`   Coste estimado: ~€${estCost}`);
  console.log(`   Delay entre llamadas: ${delay}ms\n`);

  // Skip logic: si ya existe verified.json, reanuda desde donde se paró
  let verified = [];
  let skipSet = new Set();
  if (fs.existsSync(VERIFIED_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(VERIFIED_PATH, 'utf8'));
      if (Array.isArray(prev.verified)) {
        verified = prev.verified;
        skipSet = new Set(verified.map(v => v.placeId));
        console.log(`   ↪ Reanudando: ${verified.length} candidatos ya procesados, se saltarán.\n`);
      }
    } catch { /* corrupted, ignore */ }
  }

  fs.mkdirSync(REVIEWS_DIR, { recursive: true });

  if (!AUTO_YES) await countdown(5);

  const startedAt = new Date().toISOString();
  let doneOk = 0, doneFail = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const prefix = `  [${String(i + 1).padStart(3)}/${candidates.length}] ${c.name.slice(0, 38).padEnd(38)}`;

    if (skipSet.has(c.placeId)) {
      console.log(prefix + ' ↷ ya procesado, skip');
      continue;
    }

    process.stdout.write(prefix);
    try {
      const reviews = await fetchReviews(apiKey, c.placeId, limit, maxRetries);

      // Guardar reseñas crudas para re-uso futuro (Mini Radar, pitch, re-scoring sin re-gastar)
      const safeFile = c.placeId.replace(/[^A-Za-z0-9_-]/g, '_') + '.json';
      fs.writeFileSync(
        path.join(REVIEWS_DIR, safeFile),
        JSON.stringify({
          placeId: c.placeId,
          name: c.name,
          address: c.address,
          fetchedAt: new Date().toISOString(),
          reviewsCount: reviews.length,
          reviews
        }, null, 2),
        'utf8'
      );

      const metrics = analyzeReviews(reviews, limit);
      const bucket = assignBucket(metrics, buckets);
      verified.push({ ...c, metrics, bucket, rawReviewsFile: `reviews/${safeFile}` });
      doneOk++;
      const volLabel = metrics.extrapolated
        ? `~${metrics.reviews90dEffective}*`
        : `${metrics.reviews90d}`;
      console.log(` → 90d=${volLabel}  resp=${metrics.responseRate90d !== null ? (metrics.responseRate90d * 100).toFixed(0) + '%' : '—'}  neg=${metrics.negativeUnanswered90d}  [${bucket}]`);
    } catch (err) {
      doneFail++;
      verified.push({ ...c, metrics: null, bucket: 'ERROR', error: err.message });
      console.log(` ✖ ${err.message}`);
    }

    // Guardado parcial cada 10
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(VERIFIED_PATH, JSON.stringify({
        generatedAt: startedAt,
        partial: true,
        processed: i + 1,
        total: candidates.length,
        buckets,
        verified
      }, null, 2), 'utf8');
    }

    if (i < candidates.length - 1) await new Promise(r => setTimeout(r, delay));
  }

  fs.writeFileSync(VERIFIED_PATH, JSON.stringify({
    generatedAt: startedAt,
    finishedAt: new Date().toISOString(),
    partial: false,
    totalProcessed: candidates.length,
    successful: doneOk,
    failed: doneFail,
    buckets,
    verified
  }, null, 2), 'utf8');

  const pro = verified.filter(v => v.bucket === 'PRO_CANDIDATE').length;
  const core = verified.filter(v => v.bucket === 'CORE_CANDIDATE').length;
  const discard = verified.filter(v => v.bucket === 'DISCARD').length;
  const errored = verified.filter(v => v.bucket === 'ERROR').length;

  console.log(`\n✅ Verificación completada:`);
  console.log(`   PRO_CANDIDATE  ${pro}`);
  console.log(`   CORE_CANDIDATE ${core}`);
  console.log(`   DISCARD        ${discard}`);
  console.log(`   ERROR          ${errored}`);
  console.log(`\nSalida: ${path.relative(ROOT, VERIFIED_PATH)}`);
  console.log(`Próximo paso: node scripts/outreach/3-score-and-rank.mjs\n`);
}

main().catch(err => {
  console.error('\n✖ Error fatal:', err.message);
  process.exit(1);
});
