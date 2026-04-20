/**
 * Regenera todo el pack PWA a partir del master sello.
 *
 * Pasos:
 *  1. Lee el master PNG transparent.
 *  2. Detecta el bounding box del sello SÓLIDO (alpha > 240) — descarta la
 *     sombra proyectada, que tiene alpha bajo.
 *  3. Recorta a ese bounding box (sello limpio, sin sombra).
 *  4. Genera todos los iconos del pack con centrado óptico y backgrounds
 *     correctos por plataforma.
 *
 * Backgrounds decididos:
 *  - Maskable (Android adaptive): fondo navy editorial #0A0E1A + sello en
 *    el 70% central (safe zone) → sin círculo negro detrás, se funde con el
 *    background_color del manifest.
 *  - Android-chrome (legacy launcher): transparente, sello al 92%.
 *  - Apple-touch (iOS no soporta transparencias): fondo crema #E8E2D4 +
 *    sello al 78% (iOS añade esquinas redondeadas automáticamente).
 *  - Favicon (16/32/48): fondo navy #0A0E1A + sello al 80%.
 *  - Logo (64-1024): transparente + sello al 92% (para uso dentro de app).
 *  - Mstile (Windows): fondo navy #0A0E1A + sello al 65%.
 *  - og-image (1200x630): fondo navy + sello a la izquierda + wordmark.
 *    (se deja como está, no es un icono).
 */

const sharp = require(require('path').resolve(__dirname, '..', 'frontend', 'node_modules', 'sharp'))
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')
const MASTER = path.join(ROOT, 'images', 'FINAL-v6-sello-V-transparent.png')
const OUT = path.join(ROOT, 'frontend', 'public', 'icons')

const NAVY = { r: 10, g: 14, b: 26, alpha: 1 }      // #0A0E1A
const CREMA = { r: 232, g: 226, b: 212, alpha: 1 }  // #E8E2D4

async function detectSealBoundingBox(pngPath, alphaThreshold = 240) {
  const img = sharp(pngPath).ensureAlpha()
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + 3]
      if (alpha >= alphaThreshold) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) throw new Error('No pixels above alpha threshold; master vacío?')
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

async function extractSeal() {
  const bbox = await detectSealBoundingBox(MASTER, 240)
  console.log('[bbox sello sólido]', bbox)
  // Recortamos a bbox cuadrado para centrado perfecto:
  // tomamos el lado mayor y centramos respecto al bbox original.
  const side = Math.max(bbox.width, bbox.height)
  // margen 4% para que no quede pegado al borde
  const margin = Math.round(side * 0.04)
  const finalSide = side + margin * 2
  const cx = bbox.left + bbox.width / 2
  const cy = bbox.top + bbox.height / 2
  const left = Math.round(cx - finalSide / 2)
  const top = Math.round(cy - finalSide / 2)
  // Extract con extend si nos salimos del PNG
  const meta = await sharp(MASTER).metadata()
  const extendLeft = Math.max(0, -left)
  const extendTop = Math.max(0, -top)
  const extendRight = Math.max(0, left + finalSide - meta.width)
  const extendBottom = Math.max(0, top + finalSide - meta.height)
  const pipeline = sharp(MASTER).ensureAlpha()
  if (extendLeft || extendTop || extendRight || extendBottom) {
    pipeline.extend({
      top: extendTop,
      bottom: extendBottom,
      left: extendLeft,
      right: extendRight,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
  }
  const buf = await pipeline
    .extract({
      left: left + extendLeft,
      top: top + extendTop,
      width: finalSide,
      height: finalSide,
    })
    .png()
    .toBuffer()
  return { buf, side: finalSide }
}

// Filtra la sombra semi-transparente: pixels con alpha < threshold → 0.
// Por encima de threshold se mantienen intactos. Así eliminamos la proyección
// sin crear bordes duros en el sello en sí.
async function stripShadow(buf, alphaThreshold = 200) {
  const img = sharp(buf).ensureAlpha()
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  for (let i = 3; i < data.length; i += channels) {
    if (data[i] < alphaThreshold) data[i] = 0
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer()
}

async function composeIcon({ sealBuf, canvasSize, sealRatio, background, outPath, stripShadowAlpha }) {
  let seal = sealBuf
  if (stripShadowAlpha) seal = await stripShadow(seal, stripShadowAlpha)
  const sealSize = Math.round(canvasSize * sealRatio)
  const resizedSeal = await sharp(seal)
    .resize(sealSize, sealSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const offset = Math.round((canvasSize - sealSize) / 2)
  const bgInput = background
    ? { create: { width: canvasSize, height: canvasSize, channels: 4, background } }
    : { create: { width: canvasSize, height: canvasSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }
  await sharp(bgInput)
    .composite([{ input: resizedSeal, top: offset, left: offset }])
    .png()
    .toFile(outPath)
  console.log('  →', path.relative(ROOT, outPath))
}

async function main() {
  if (!fs.existsSync(MASTER)) throw new Error(`Master no encontrado: ${MASTER}`)
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })
  console.log('[master]', path.relative(ROOT, MASTER))
  const { buf: sealBuf } = await extractSeal()

  const transparent = null

  // stripShadow=200 elimina la proyección diagonal en el fichero donde más
  // se nota (android-chrome). En el resto no merece la pena: maskable tiene
  // fondo sólido que enmascara la sombra; apple-touch idem; logos in-app
  // mantienen la sombra para estética editorial.
  const SHADOW = 235
  const tasks = [
    // Maskable — fondo navy, máximo seguro 80% (Android recorta al 80% central)
    { name: 'maskable-192x192.png', size: 192, ratio: 0.80, bg: NAVY },
    { name: 'maskable-512x512.png', size: 512, ratio: 0.80, bg: NAVY },
    // Android-chrome — transparente, sello al 100% + sombra filtrada
    { name: 'android-chrome-192x192.png', size: 192, ratio: 1.00, bg: transparent, stripShadowAlpha: SHADOW },
    { name: 'android-chrome-512x512.png', size: 512, ratio: 1.00, bg: transparent, stripShadowAlpha: SHADOW },
    // Apple-touch — crema, sello 95% (iOS redondea esquinas ~25%)
    { name: 'apple-touch-icon-120x120.png', size: 120, ratio: 0.95, bg: CREMA },
    { name: 'apple-touch-icon-152x152.png', size: 152, ratio: 0.95, bg: CREMA },
    { name: 'apple-touch-icon-180x180.png', size: 180, ratio: 0.95, bg: CREMA },
    // Favicon — navy, 90% (evita aliasing pegado al borde en 16px)
    { name: 'favicon-16x16.png', size: 16, ratio: 0.90, bg: NAVY },
    { name: 'favicon-32x32.png', size: 32, ratio: 0.90, bg: NAVY },
    { name: 'favicon-48x48.png', size: 48, ratio: 0.90, bg: NAVY },
    // Logo app — transparente al 100% (uso in-app, renderizado a tamaño controlado)
    { name: 'logo-64.png', size: 64, ratio: 1.00, bg: transparent },
    { name: 'logo-128.png', size: 128, ratio: 1.00, bg: transparent },
    { name: 'logo-256.png', size: 256, ratio: 1.00, bg: transparent },
    { name: 'logo-1024.png', size: 1024, ratio: 1.00, bg: transparent },
    // Mstile — navy, 85%
    { name: 'mstile-150x150.png', size: 150, ratio: 0.85, bg: NAVY },
    { name: 'mstile-310x310.png', size: 310, ratio: 0.85, bg: NAVY },
  ]

  for (const t of tasks) {
    await composeIcon({
      sealBuf,
      canvasSize: t.size,
      sealRatio: t.ratio,
      background: t.bg,
      outPath: path.join(OUT, t.name),
      stripShadowAlpha: t.stripShadowAlpha,
    })
  }

  console.log('\n[ok] Pack PWA regenerado. No se ha tocado favicon.ico ni og-image.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
