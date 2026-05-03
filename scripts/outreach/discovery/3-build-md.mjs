/**
 * Paso 3 · Construir los discovery-icp-*.md desde verified.json
 *
 * Lee verified.json, filtra cualificados, agrupa por ICP+ciudad y reescribe los 3 .md.
 * Sin coste — operación local.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const VERIFIED_PATH = path.join(ROOT, 'velacre-outreach', '_raw-discovery', 'verified.json');
const QUERIES_PATH = path.join(__dirname, 'queries.json');
const OUTREACH_DIR = path.join(ROOT, 'velacre-outreach');

const ICP_FILES = {
  A: { file: 'discovery-icp-a-barberias.md',         defaultCities: ['A Coruña', 'Vigo', 'Santiago', 'Pontevedra', 'Lugo', 'Ourense', 'Ferrol y Ferrolterra'] },
  B: { file: 'discovery-icp-b-estetica.md',          defaultCities: ['A Coruña', 'Vigo', 'Santiago', 'Pontevedra', 'Lugo', 'Ourense', 'Ferrol y Ferrolterra'] },
  C: { file: 'discovery-icp-c-hosteleria-joven.md',  defaultCities: null },
  D: { file: 'discovery-icp-d-hoteles.md',           defaultCities: null }
};

const CADENAS_GRANDES = [
  'NH ', 'Hesperia', 'Leonardo', 'Barceló', 'AC Hotel', 'Soho Boutique', 'Catalonia',
  'Marriott', 'Hyatt', 'Hilton', 'Mercure', 'Novotel', 'Ibis', 'ibis ', 'Holiday Inn',
  'Best Western', 'Iberostar', 'Meliá', 'Eurostars', 'Sercotel', 'Riu', 'Vincci',
  'Room Mate', 'Hotusa', 'B&B Hotel', 'Sleep&Co', 'Eurohotel'
];

function isCadenaGrande(name) {
  return CADENAS_GRANDES.some(g => name.toLowerCase().includes(g.toLowerCase()));
}

function heartbeatBadge(days) {
  if (days === null || days === undefined) return '—';
  if (days < 30) return `🔥 hace ${days}d`;
  if (days < 60) return `⚡ hace ${days}d`;
  if (days < 120) return `⚠ hace ${days}d`;
  return `❄ hace ${days}d`;
}

function spanBadge(spanDays) {
  if (spanDays === null || spanDays === undefined) return '—';
  const years = spanDays / 365.25;
  if (years > 3) return `🚩 ${years.toFixed(1)}a (probable establecido viejo)`;
  if (years > 1.5) return `⚠ ${years.toFixed(1)}a`;
  return `✓ ${years.toFixed(1)}a`;
}

function fichaCandidato(c) {
  const spanDays = (c.oldestReviewDays != null && c.mostRecentReviewDays != null)
    ? c.oldestReviewDays - c.mostRecentReviewDays
    : null;
  return [
    `### ${c.name} · ${c.cityFromQuery}`,
    ``,
    `- **Maps**: ${c.mapsUrl ?? '—'}`,
    `- **Web**: ${c.website ?? '—'}`,
    `- **Tel**: ${c.phone ?? '—'}`,
    `- **Reseñas**: ${c.userRatingCount} totales · rating ${c.rating}`,
    `- **Heartbeat**: ${heartbeatBadge(c.mostRecentReviewDays)}`,
    `- **Span 5 destacadas**: ${spanBadge(spanDays)}`,
    `- **Dirección**: ${c.address}`,
    `- **Source query**: \`${c.sourceQuery}\``,
    `- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook`,
    `- **Estado**: ⬜ por contactar`,
    ``
  ].join('\n');
}

const COMMON_HEADER = [
  `## Cómo se construyó esta lista`,
  ``,
  `Pipeline aplica solo **filtro grueso**: userRatingCount mínimo + rating ≥3.7 + canal contactable. Los proxies de edad/volumen mensual NO funcionan con Places API (la API cura las 5 destacadas hacia reviews recientes en lugar de mostrar las históricas), así que el filtro fino lo hace Manuel manualmente.`,
  ``,
  `Lista capada a **30 candidatos máximo**, ordenados por heartbeat ascendente (review más reciente devuelta = primero).`,
  ``,
  `## Banderas`,
  ``,
  `**Heartbeat** (review más reciente entre las 5 devueltas):`,
  `- 🔥 <30d · alta probabilidad de actividad alta`,
  `- ⚡ <60d · señal media`,
  `- ⚠ <120d · incierto`,
  `- ❄ ≥120d · probablemente decayendo`,
  ``,
  `**Span 5 destacadas** (gap entre la más antigua y más reciente devuelta):`,
  `- ✓ <1.5a · negocio probablemente joven`,
  `- ⚠ 1.5-3a · ambiguo`,
  `- 🚩 >3a · probable establecido viejo, descartar a no ser que tenga otra señal`,
  ``,
  `## Verificación manual antes de DM (la que de verdad cuenta)`,
  ``,
  `1. Click en Maps URL → "Más reseñas" → ordenar "Las más recientes" → contar últimos 30 días. Si <20 → descartar.`,
  `2. IG activo + DMs abiertos + cuenta llevada por dueño.`,
  `3. 1-3 sillas/cabinas/locales máximo.`,
  `4. No franquicia ni grupo.`,
  `5. Redactar hook concreto observable.`,
  ``
];

function buildIcpA(cualificados) {
  return [
    `# Discovery ICP A — Barbería Instagram premium`,
    ``,
    `> **Estado**: ${cualificados.length} candidatos pre-cualificados (pipeline grueso). Pendiente verificación manual fina.`,
    ``,
    ...COMMON_HEADER,
    buildByCity('A', cualificados)
  ].join('\n');
}

function buildIcpB(cualificados) {
  return [
    `# Discovery ICP B — Centro estética pequeño no-franquicia`,
    ``,
    `> **Estado**: ${cualificados.length} candidatos pre-cualificados (pipeline grueso). Pendiente verificación manual.`,
    `> `,
    `> **Prioridad**: paralelo a ICP A. No empezar hasta tener 5 conversaciones de A.`,
    `> `,
    `> **Anti-franquicia**: descartar Marco Aldany, Multiópticas, Hedonai, Dorsia, Centros Único, Clínica Londres y similares.`,
    ``,
    ...COMMON_HEADER,
    buildByCity('B', cualificados)
  ].join('\n');
}

function buildIcpC(cualificados) {
  return [
    `# Discovery ICP C — Restaurantes Galicia`,
    ``,
    `> **Estado**: ${cualificados.length} candidatos pre-cualificados (Galicia, banda reseñas 1600-6000, banda rating 3.7-4.5, sin DM previo). Pendiente criba humana.`,
    `> `,
    `> **Cobertura**: ciudades principales + Camino de Santiago (Sarria/Portomarín/Melide/Arzúa) + zonas turísticas (Salnés, O Grove, Combarro, Cambados, Sanxenxo, Costa da Morte, Ribeira Sacra, Finisterre).`,
    ``,
    ...COMMON_HEADER,
    buildByCity('C', cualificados)
  ].join('\n');
}

function buildIcpD(cualificados) {
  return [
    `# Discovery ICP D — Hoteles Galicia (no cadenas grandes)`,
    ``,
    `> **Estado**: ${cualificados.length} candidatos pre-cualificados (Galicia, banda reseñas 800-6000, banda rating 3.7-4.5, sin DM previo, sin cadenas grandes anónimas).`,
    `> `,
    `> **Filtro automático aplicado**: descartadas cadenas grandes anónimas tipo NH, Eurostars, Meliá, Hesperia, Marriott, ibis, Sercotel, Hyatt, Hilton, Holiday Inn, Best Western, Catalonia, Barceló, AC by Marriott, Soho Boutique, Iberostar, Riu, Vincci, Room Mate, Hotusa, B&B Hotels.`,
    `> `,
    `> **Multilocal operador SÍ entra**: si es dueño-operador con 2-5 locales (Norat Hoteles, Alda Hotels Galicia, PR Hoteles, Carrís, Attica21, Augusta…), se mantiene como caso Velacre multilocal. Si Manuel detecta que es cadena más grande de la cuenta, descartar manualmente.`,
    `> `,
    `> **OCA, Eurostars, Silken**: 🚩 banderas — son grupos hoteleros medianos. Verificar si encajan o descartar.`,
    ``,
    ...COMMON_HEADER,
    buildByCity('D', cualificados)
  ].join('\n');
}

function buildByCity(icp, cualificados) {
  const byCity = new Map();
  for (const c of cualificados) {
    const city = c.cityFromQuery ?? '—';
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city).push(c);
  }

  const cities = ICP_FILES[icp].defaultCities ?? Array.from(byCity.keys());
  const sections = [];

  for (const city of cities) {
    const list = (byCity.get(city) ?? []).sort((a, b) => (b.densityPerYear ?? 0) - (a.densityPerYear ?? 0));
    sections.push(`## Lista — ${city}\n`);
    if (list.length === 0) {
      sections.push(`*(Vacía — pipeline no encontró candidatos.)*\n`);
    } else {
      sections.push(list.map(fichaCandidato).join('\n'));
    }
  }

  // Resumen
  const rows = [];
  let total = 0;
  for (const city of cities) {
    const count = (byCity.get(city) ?? []).length;
    total += count;
    rows.push(`| ${city} | ${count} | 0 | 0 | 0 |`);
  }
  sections.push(`## Resumen\n`);
  sections.push(`| Ciudad | Cualificados | Contactados | Respuestas | Conversaciones |`);
  sections.push(`|---|---|---|---|---|`);
  sections.push(rows.join('\n'));
  sections.push(`| **Total** | **${total}** | **0** | **0** | **0** |`);

  return sections.join('\n');
}

function main() {
  if (!fs.existsSync(VERIFIED_PATH)) {
    throw new Error(`No existe ${VERIFIED_PATH}. Corre antes paso 1 + paso 2.`);
  }

  const data = JSON.parse(fs.readFileSync(VERIFIED_PATH, 'utf8'));
  // Filtro grueso solo: suelo + rating + canal contactable.
  // Edad/densidad se han descartado porque la API cura las 5 destacadas
  // hacia recientes, no muestra las históricas → cualquier proxy sale falso.
  // El filtro fino lo hace Manuel manualmente en Maps.
  // Filtro de provincia gallega — descarta falsos positivos cuando la query
  // matchea negocios homónimos fuera de Galicia (ej. "restaurante Portomarín"
  // que pesca también un local en Madrid).
  const PROVINCIAS_GALICIA = ['a coruña', 'la coruña', 'lugo', 'ourense', 'orense', 'pontevedra'];
  const isInGalicia = addr => {
    const a = (addr || '').toLowerCase();
    return PROVINCIAS_GALICIA.some(p => a.includes(p));
  };

  const cualificados = data.verified.filter(v => {
    if (v.error) return false;
    if (!v.hasContact) return false;
    if (!isInGalicia(v.address)) return false;
    if (v.icp === 'D' && isCadenaGrande(v.name)) return false;
    return true;
  });

  // Sin cap — entregamos todo lo que pase para que Manuel haga criba humana
  const byIcp = { A: [], B: [], C: [], D: [] };
  for (const c of cualificados) {
    if (byIcp[c.icp]) byIcp[c.icp].push(c);
  }
  for (const icp of ['A', 'B', 'C', 'D']) {
    byIcp[icp].sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0));
  }

  const builders = { A: buildIcpA, B: buildIcpB, C: buildIcpC, D: buildIcpD };

  for (const icp of ['A', 'B', 'C', 'D']) {
    const md = builders[icp](byIcp[icp]);
    const outPath = path.join(OUTREACH_DIR, ICP_FILES[icp].file);
    fs.writeFileSync(outPath, md, 'utf8');
    console.log(`✅ ICP ${icp}: ${byIcp[icp].length} cualificados → ${ICP_FILES[icp].file}`);
  }

  console.log(`\nTotal: ${cualificados.length} cualificados`);
  console.log(`Próximo paso: revisión manual (volumen Maps real + IG + dueño + hook).`);
}

main();
