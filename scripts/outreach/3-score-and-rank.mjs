/**
 * Paso 3 · Scoring + ranking + generación de prospects.md
 *
 * - Carga raw/verified.json
 * - Aplica scoring 0-100 dentro de cada bucket
 * - Separa top Pro + top Core
 * - Escribe raw/top.json y velacre-outreach/prospects.md
 *
 * Scoring (de queries.json):
 *   +40 · tasa de respuesta (0% = 40 pts, 100% = 0 pts, lineal)
 *   +30 · reseñas negativas sin contestar en 90d (5 pts c/u, tope 30)
 *   +20 · rating vulnerable 3.8-4.4
 *   +10 · contactable (web o teléfono)
 *
 * Uso: node scripts/outreach/3-score-and-rank.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(__dirname, 'queries.json');
const RAW_DIR = path.join(ROOT, 'velacre-outreach', 'raw');
const VERIFIED_PATH = path.join(RAW_DIR, 'verified.json');
const TOP_PATH = path.join(RAW_DIR, 'top.json');
const PROSPECTS_MD = path.join(ROOT, 'velacre-outreach', 'prospects.md');

const TOP_N_PRO = 5;
const TOP_N_CORE = 5;

function scoreCandidate(c, scoring) {
  const m = c.metrics;
  if (!m) return { total: 0, breakdown: {} };

  // 1. Tasa de respuesta — premia baja
  const rr = m.responseRate90d;
  const responsePts = rr === null
    ? scoring.responseRateWeight
    : Math.round(scoring.responseRateWeight * (1 - rr));

  // 2. Reseñas negativas sin contestar
  const negPts = Math.min(
    scoring.negativeUnansweredMax,
    m.negativeUnanswered90d * scoring.negativeUnansweredPointsPer
  );

  // 3. Rating vulnerable
  const rating = c.rating;
  const vulnPts = (rating !== null && rating >= scoring.vulnerableRatingMin && rating <= scoring.vulnerableRatingMax)
    ? scoring.vulnerableRatingWeight : 0;

  // 4. Contactable
  const contactPts = (c.website || c.phone) ? scoring.contactableWeight : 0;

  const total = responsePts + negPts + vulnPts + contactPts;
  return {
    total,
    breakdown: { responsePts, negPts, vulnPts, contactPts }
  };
}

function pad(str, len) {
  const s = String(str ?? '');
  return s.length >= len ? s.slice(0, len - 1) + '…' : s.padEnd(len);
}

function rowFor(c) {
  const m = c.metrics ?? {};
  const rr = m.responseRate90d !== null && m.responseRate90d !== undefined
    ? `${Math.round(m.responseRate90d * 100)}%` : '—';
  const contact = c.website ? '🌐' : (c.phone ? '📞' : '—');
  const vulnerable = (c.rating >= 3.8 && c.rating <= 4.4) ? ' ⚠️' : '';
  const volRaw = m.reviews90dEffective ?? m.reviews90d;
  const vol = volRaw === undefined || volRaw === null ? '—' : (m.extrapolated ? `~${volRaw}*` : `${volRaw}`);
  return `| ${c._rank} | **${c.score.total}** | ${c.name} | ${c.sourceCategory} | ${c.rating ?? '—'}${vulnerable} (${c.userRatingCount}) | ${vol} | ${rr} | ${m.negativeUnanswered90d ?? '—'} | ${contact} | ${c.address.split(',').slice(0, 2).join(',')} |`;
}

function markdownSection(title, arr) {
  if (arr.length === 0) return `## ${title}\n\n_Sin candidatos en este bucket._\n`;
  const header = [
    `## ${title}`,
    '',
    '| # | Score | Negocio | Sector | Rating (total) | 90d | Resp | Neg¬r | Canal | Dirección |',
    '|---|-------|---------|--------|----------------|-----|------|-------|-------|-----------|',
    ...arr.map(rowFor)
  ].join('\n');
  const details = arr.map(c => {
    const m = c.metrics ?? {};
    const b = c.score.breakdown;
    return [
      `### ${c._rank}. ${c.name}`,
      ``,
      `- **Score**: ${c.score.total} (resp ${b.responsePts} + neg ${b.negPts} + vuln ${b.vulnPts} + contact ${b.contactPts})`,
      `- **Sector**: ${c.sourceCategory} · query origen: \`${c.sourceQuery}\``,
      `- **Dirección**: ${c.address}`,
      `- **Google Maps**: ${c.mapsUrl ?? '—'}`,
      `- **Web**: ${c.website ?? '—'}`,
      `- **Teléfono**: ${c.phone ?? '—'}`,
      `- **Rating Google**: ${c.rating ?? '—'} (${c.userRatingCount} reseñas totales)`,
      `- **Volumen 90d / 60d / 30d**: ${m.reviews90dEffective ?? m.reviews90d ?? '—'}${m.extrapolated ? ' (extrapolado desde el ritmo)' : ''} / ${m.reviews60d ?? '—'} / ${m.reviews30d ?? '—'}`,
      `- **Tasa respuesta 90d**: ${m.responseRate90d !== null && m.responseRate90d !== undefined ? (m.responseRate90d * 100).toFixed(0) + '%' : '—'} (${m.answered90d ?? 0}/${m.reviews90d ?? 0})`,
      `- **Reseñas 1-2★ sin contestar (90d)**: ${m.negativeUnanswered90d ?? 0}`,
      `- **Estado outreach**: ⬜ pendiente`,
      `- **Canal elegido**: _(IG DM / email / formulario web)_`,
      `- **Notas**: _(añadir tras revisión manual: handle IG, nombre dueño, hook personal)_`,
      ``
    ].join('\n');
  }).join('\n');
  return header + '\n\n' + details;
}

function main() {
  if (!fs.existsSync(VERIFIED_PATH)) {
    throw new Error(`No existe ${path.relative(ROOT, VERIFIED_PATH)}. Corre primero 2-verify-volume.mjs`);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const scoring = config.scoring;
  const buckets = config.buckets;
  const data = JSON.parse(fs.readFileSync(VERIFIED_PATH, 'utf8'));

  // Scoring
  const scored = data.verified
    .filter(v => v.bucket === 'PRO_CANDIDATE' || v.bucket === 'CORE_CANDIDATE')
    .map(v => ({ ...v, score: scoreCandidate(v, scoring) }))
    .sort((a, b) => b.score.total - a.score.total);

  const proAll = scored.filter(s => s.bucket === 'PRO_CANDIDATE');
  const coreAll = scored.filter(s => s.bucket === 'CORE_CANDIDATE');
  const proTop = proAll.slice(0, TOP_N_PRO).map((c, i) => ({ ...c, _rank: i + 1 }));
  const coreTop = coreAll.slice(0, TOP_N_CORE).map((c, i) => ({ ...c, _rank: i + 1 }));

  // top.json
  fs.writeFileSync(TOP_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    criteria: { buckets, scoring, topN: { pro: TOP_N_PRO, core: TOP_N_CORE } },
    counts: { proAll: proAll.length, coreAll: coreAll.length },
    proTop,
    coreTop
  }, null, 2), 'utf8');

  // prospects.md
  const now = new Date().toISOString().slice(0, 10);
  const md = [
    `# Velacre — Pipeline de prospects`,
    ``,
    `> Generado automáticamente por \`scripts/outreach/3-score-and-rank.mjs\` el ${now}. ` +
    `Edita la columna **Estado outreach** y las notas a mano según avances.`,
    ``,
    `## Resumen del batch`,
    ``,
    `| Bucket | Total candidatos | En ranking |`,
    `|---|---|---|`,
    `| **PRO** (>${buckets.pro_min_reviews_90d - 1} reseñas/90d → Pro €49) | ${proAll.length} | ${proTop.length} |`,
    `| **CORE** (${buckets.core_min_reviews_90d}-${buckets.pro_min_reviews_90d - 1} reseñas/90d → Core €19) | ${coreAll.length} | ${coreTop.length} |`,
    ``,
    `**Fórmula de scoring** (sobre 100):`,
    `- \`+${scoring.responseRateWeight}\` · tasa de respuesta 90d (0% contestadas = ${scoring.responseRateWeight} pts, lineal)`,
    `- \`+${scoring.negativeUnansweredWeight}\` · reseñas 1-2★ sin contestar (${scoring.negativeUnansweredPointsPer} pts c/u, tope ${scoring.negativeUnansweredMax})`,
    `- \`+${scoring.vulnerableRatingWeight}\` · rating vulnerable ${scoring.vulnerableRatingMin}-${scoring.vulnerableRatingMax} (${scoring.vulnerableRatingMax + 0.1}★+ ya no arde igual)`,
    `- \`+${scoring.contactableWeight}\` · canal contactable (web propia o teléfono)`,
    ``,
    `---`,
    ``,
    `# 🎯 O Fogar da Carne — Prospect #1 (piloto manual)`,
    ``,
    `Este prospect NO viene del batch automático: es el declarado como prioridad 1.`,
    `Workflow: Mini Radar en \`/admin/mini-radar\` → PDF → Template E → DM IG @ofogardacarne.`,
    ``,
    `- **Estado**: ⬜ pendiente de generar Mini Radar`,
    `- **Canal**: IG DM @ofogardacarne (FB DM backup · tel 881 954 986 solo si los 2 fallan)`,
    `- **Hook**: proximidad Ferrol ↔ Narón, cliente habitual, premios del asador`,
    `- **Follow-up**: SOLO 1 recordatorio a los 7 días. Si no responde → mencionar de palabra como cliente.`,
    ``,
    `---`,
    ``,
    markdownSection('🔥 Top Pro — candidatos a Velacre Pro €49', proTop),
    ``,
    `---`,
    ``,
    markdownSection('💡 Top Core — candidatos a Velacre Core €19', coreTop),
    ``,
    `---`,
    ``,
    `## Datos crudos`,
    ``,
    `- \`velacre-outreach/raw/sourced.json\` — candidatos brutos tras sourcing Google Places`,
    `- \`velacre-outreach/raw/verified.json\` — verificación Outscraper con métricas 90d`,
    `- \`velacre-outreach/raw/top.json\` — ranking final (lo que se usa para esta tabla)`,
    ``
  ].join('\n');

  fs.writeFileSync(PROSPECTS_MD, md, 'utf8');

  console.log(`\n✅ Scoring completado:`);
  console.log(`   Pro candidates (total / en ranking): ${proAll.length} / ${proTop.length}`);
  console.log(`   Core candidates (total / en ranking): ${coreAll.length} / ${coreTop.length}`);
  console.log(`\nSalidas:`);
  console.log(`   ${path.relative(ROOT, PROSPECTS_MD)}`);
  console.log(`   ${path.relative(ROOT, TOP_PATH)}`);
  console.log(``);
}

try {
  main();
} catch (err) {
  console.error('\n✖ Error fatal:', err.message);
  process.exit(1);
}
