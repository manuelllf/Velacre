import type { PendingReview, RadarAnalisisResult } from './api'

export interface MonthMetrics {
  year: number
  month: number
  label: string
  count: number
  avgRating: number | null
  positiveCount: number
  neutralCount: number
  negativeCount: number
  positiveRatio: number | null
  negativeRatio: number | null
  respondedCount: number
  responseRate: number | null
}

export interface SummaryData {
  brilla: string
  quema: string
  accion: string
}

export function computeMonthMetrics(reviews: PendingReview[], year: number, month: number): MonthMetrics {
  const monthReviews = reviews.filter(r => {
    const d = new Date(r.reviewDate)
    return d.getMonth() === month && d.getFullYear() === year
  })
  const withRating = monthReviews.filter(r => r.starRating != null)
  const avgRating = withRating.length > 0
    ? withRating.reduce((s, r) => s + (r.starRating ?? 0), 0) / withRating.length
    : null
  const positive = monthReviews.filter(r => (r.starRating ?? 0) >= 4).length
  const neutral = monthReviews.filter(r => (r.starRating ?? 0) === 3).length
  const negative = monthReviews.filter(r => (r.starRating ?? 0) <= 2 && r.starRating != null).length
  const responded = monthReviews.filter(r => r.tonoGenerado != null).length
  const total = monthReviews.length
  const label = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  return {
    year, month, label, count: total, avgRating,
    positiveCount: positive, neutralCount: neutral, negativeCount: negative,
    positiveRatio: total > 0 ? (positive / total) * 100 : null,
    negativeRatio: total > 0 ? (negative / total) * 100 : null,
    respondedCount: responded,
    responseRate: total > 0 ? (responded / total) * 100 : null,
  }
}

export function getLast4Months(reviews: PendingReview[]): MonthMetrics[] {
  const now = new Date()
  return Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (3 - i), 1)
    return computeMonthMetrics(reviews, d.getFullYear(), d.getMonth())
  })
}

/** Todos los meses desde la reseña más antigua hasta hoy, más reciente primero */
export function getAllMonths(reviews: PendingReview[]): MonthMetrics[] {
  if (reviews.length === 0) return []
  const dates = reviews.map(r => new Date(r.reviewDate).getTime()).filter(t => !isNaN(t))
  if (dates.length === 0) return []
  const minDate = new Date(Math.min(...dates))
  const now = new Date()
  const months: MonthMetrics[] = []
  let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  while (d.getFullYear() < now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() <= now.getMonth())) {
    months.push(computeMonthMetrics(reviews, d.getFullYear(), d.getMonth()))
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  }
  return months.reverse()
}

/** Un registro por año, más reciente primero */
export function getAllYears(reviews: PendingReview[]): MonthMetrics[] {
  if (reviews.length === 0) return []
  const years = [...new Set(reviews.map(r => new Date(r.reviewDate).getFullYear()))].filter(y => !isNaN(y))
  return years
    .sort((a, b) => b - a)
    .map(year => {
      const yearReviews = reviews.filter(r => new Date(r.reviewDate).getFullYear() === year)
      const withRating = yearReviews.filter(r => r.starRating != null)
      const avgRating = withRating.length > 0
        ? withRating.reduce((s, r) => s + (r.starRating ?? 0), 0) / withRating.length
        : null
      const positive = yearReviews.filter(r => (r.starRating ?? 0) >= 4).length
      const neutral = yearReviews.filter(r => (r.starRating ?? 0) === 3).length
      const negative = yearReviews.filter(r => (r.starRating ?? 0) <= 2 && r.starRating != null).length
      const responded = yearReviews.filter(r => r.tonoGenerado != null).length
      const total = yearReviews.length
      return {
        year, month: -1,
        label: String(year),
        count: total, avgRating,
        positiveCount: positive, neutralCount: neutral, negativeCount: negative,
        positiveRatio: total > 0 ? (positive / total) * 100 : null,
        negativeRatio: total > 0 ? (negative / total) * 100 : null,
        respondedCount: responded,
        responseRate: total > 0 ? (responded / total) * 100 : null,
      }
    })
}

/** Diferencia entre dos ratios, con signo y formato */
export function drift(current: number | null, previous: number | null): { value: number; label: string; dir: 'up' | 'down' | 'flat' } | null {
  if (current == null || previous == null || previous === 0) return null
  const diff = current - previous
  if (Math.abs(diff) < 0.5) return null
  return {
    value: diff,
    label: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`,
    dir: diff > 0 ? 'up' : 'down',
  }
}

export function ratingDrift(current: number | null, previous: number | null): { value: number; label: string; dir: 'up' | 'down' | 'flat' } | null {
  if (current == null || previous == null) return null
  const diff = current - previous
  if (Math.abs(diff) < 0.05) return null
  return {
    value: diff,
    label: `${diff > 0 ? '+' : ''}${diff.toFixed(2)}*`,
    dir: diff > 0 ? 'up' : 'down',
  }
}

// ── PDF ──────────────────────────────────────────────────────────────────────

type RGB = readonly [number, number, number]
export type PdfTheme = 'light' | 'dark'

export interface SpeedBenchmark {
  avgDays: number
  pct24h: number
  pct48h: number
  pctOver48h: number
  totalResponded: number
}

/** Calcula benchmark de velocidad de respuesta a partir de reviews con respondidaFecha */
export function computeSpeedBenchmark(reviews: PendingReview[]): SpeedBenchmark | null {
  const responded = reviews.filter(r => r.respondidaFecha && r.reviewDate)
  if (responded.length === 0) return null

  const days = responded.map(r => {
    const diff = new Date(r.respondidaFecha!).getTime() - new Date(r.reviewDate).getTime()
    return diff / (1000 * 60 * 60 * 24)
  }).filter(d => d >= 0)

  if (days.length === 0) return null

  const avgDays = days.reduce((a, b) => a + b, 0) / days.length
  const pct24h = (days.filter(d => d < 1).length / days.length) * 100
  const pct48h = (days.filter(d => d < 2).length / days.length) * 100
  const pctOver48h = 100 - pct48h

  return { avgDays, pct24h, pct48h, pctOver48h, totalResponded: days.length }
}

export interface MonthlyPdfData {
  negocioNombre: string
  negocioTelefono?: string
  negocioEmail?: string
  negocioPalabrasClave?: string[]
  currentMonth: MonthMetrics
  previousMonth: MonthMetrics | null
  yearMonths: MonthMetrics[]
  keywords: { word: string; sentiment: 'positive' | 'neutral' | 'negative' }[]
  summary: SummaryData | null
  starCountsCurrent: number[]
  starCountsPrevious?: number[]
  pendingCount: number
  speedBenchmark: SpeedBenchmark | null
  radarAnalisis?: RadarAnalisisResult | null
}

export interface YearlyPdfData {
  negocioNombre: string
  currentYear: number
  allYears: MonthMetrics[]
  currentYearMonths: MonthMetrics[]
  keywords: { word: string; sentiment: 'positive' | 'neutral' | 'negative' }[]
  summary: SummaryData | null
}

// Elimina caracteres fuera de WinAnsi (Helvetica jsPDF)
function safe(s: string): string {
  // Los modelos sueltan em-dash/en-dash (U+2013/2014) que están fuera de Latin-1
  // y el strip los dejaba como huecos raros. Los sustituimos por coma, que
  // cumple la misma función sintáctica en castellano.
  return s.replace(/[\u2012-\u2015]/g, ',').replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
}

function varText(
  current: number | null,
  previous: number | null,
  decimals = 1,
): { text: string; positive: boolean; significant: boolean } {
  if (current == null || previous == null) return { text: '—', positive: true, significant: false }
  const d = current - previous
  if (Math.abs(d) < 0.01) return { text: '=', positive: true, significant: false }
  return { text: `(${d > 0 ? '+' : ''}${d.toFixed(decimals)})`, positive: d > 0, significant: true }
}

// ── Colores por tema ──────────────────────────────────────────────────────────

const ATLANTIC: RGB = [5, 16, 32]   // #051020 - cabecera siempre
const GREEN: RGB = [16, 185, 129]
const RED: RGB = [239, 68, 68]
const AMBER: RGB = [245, 158, 11]
const INDIGO: RGB = [99, 102, 241]
const WHITE: RGB = [255, 255, 255]

interface TC {
  BG: RGB; CARD: RGB; BORDER: RGB
  ROW_ODD: RGB; ROW_EVEN: RGB
  TEXT: RGB; MID: RGB; LIGHT: RGB
  HDR_BG: RGB; HDR_TXT: RGB
  AI_SHINE: RGB; AI_WORRY: RGB; AI_ACTION: RGB
}

function tc(theme: PdfTheme): TC {
  if (theme === 'dark') return {
    BG: [2, 6, 23], CARD: [15, 23, 42], BORDER: [30, 41, 59],
    ROW_ODD: [15, 23, 42], ROW_EVEN: [7, 14, 31],
    TEXT: [241, 245, 249], MID: [148, 163, 184], LIGHT: [71, 85, 105],
    HDR_BG: [30, 41, 59], HDR_TXT: [241, 245, 249],
    AI_SHINE: [5, 22, 14], AI_WORRY: [24, 5, 5], AI_ACTION: [5, 12, 28],
  }
  return {
    BG: [255, 255, 255], CARD: [248, 250, 252], BORDER: [226, 232, 240],
    ROW_ODD: [248, 250, 252], ROW_EVEN: [255, 255, 255],
    TEXT: [15, 23, 42], MID: [71, 85, 105], LIGHT: [148, 163, 184],
    HDR_BG: [15, 23, 42], HDR_TXT: [255, 255, 255],
    AI_SHINE: [240, 253, 244], AI_WORRY: [254, 242, 242], AI_ACTION: [238, 242, 255],
  }
}

// ── Utilidades compartidas para jsPDF ────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

function fillPage(doc: any, W: number, theme: PdfTheme) {
  if (theme === 'dark') {
    doc.setFillColor(2, 6, 23)
    doc.rect(0, 0, W, 297, 'F')
  }
}

function addPageThemed(doc: any, W: number, theme: PdfTheme) {
  doc.addPage()
  fillPage(doc, W, theme)
}

function pdfHeader(doc: any, W: number, ML: number, MR: number, negocioNombre: string, reportLabel: string) {
  const LIGHT: RGB = [148, 163, 184]
  doc.setFillColor(...ATLANTIC); doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Velacre', ML, 14)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...LIGHT); doc.text('velacre.com', ML, 21)
  // Enlace clickable sobre "velacre.com"
  const linkW = doc.getTextWidth('velacre.com')
  doc.link(ML, 17, linkW, 5, { url: 'https://velacre.com' })
  doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(safe(negocioNombre), MR, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...LIGHT); doc.text(reportLabel, MR, 21, { align: 'right' })
  // Línea separadora Indigo
  doc.setFillColor(...INDIGO); doc.rect(0, 30, W, 1.5, 'F')
}

function pdfFooter(doc: any, W: number, ML: number, MR: number, theme: PdfTheme) {
  const n = doc.getNumberOfPages()
  const colors = tc(theme)
  for (let p = 1; p <= n; p++) {
    doc.setPage(p)
    doc.setFillColor(...ATLANTIC); doc.rect(0, 284, W, 13, 'F')
    doc.setTextColor(...colors.MID); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
    const dt = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    const footerTxt = `Generado por Velacre - velacre.com - ${dt}`
    doc.text(footerTxt, ML, 291)
    // Enlace sobre "velacre.com" en el footer
    const preW = doc.getTextWidth('Generado por Velacre - ')
    const urlW = doc.getTextWidth('velacre.com')
    doc.link(ML + preW, 287, urlW, 5, { url: 'https://velacre.com' })
    doc.text(`Pág. ${p} / ${n}`, MR, 291, { align: 'right' })
  }
}

function sectionLabel(doc: any, text: string, y: number, ML: number, colors: TC) {
  doc.setFillColor(...INDIGO); doc.rect(ML, y, 2.5, 8, 'F')
  doc.setTextColor(...colors.TEXT); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
  doc.text(text, ML + 6, y + 5.8)
}

function themedTableHeader(doc: any, headers: string[], widths: number[], y: number, ML: number, colors: TC): number {
  const CW = widths.reduce((a, b) => a + b, 0)
  doc.setFillColor(...colors.HDR_BG); doc.setDrawColor(...colors.BORDER); doc.setLineWidth(0.2)
  doc.rect(ML, y, CW, 6.5, 'FD')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...colors.HDR_TXT)
  let cx = ML + 2
  headers.forEach((h, i) => { doc.text(h, cx, y + 4.5); cx += widths[i] })
  return y + 6.5
}

// Barra de progreso horizontal coloreada por valor (0-5 estrellas, o 0-10 radar)
function progressBar(doc: any, x: number, y: number, W: number, h: number, value: number, maxVal: number, color: RGB, bgColor: RGB) {
  const fillW = maxVal > 0 ? Math.max(0, Math.min(1, value / maxVal)) * W : 0
  doc.setFillColor(...bgColor); doc.rect(x, y, W, h, 'F')
  if (fillW > 0) { doc.setFillColor(...color); doc.rect(x, y, fillW, h, 'F') }
}

// Gráfico de barras verticales para evolución temporal
function monthBarChart(
  doc: any,
  months: MonthMetrics[],
  x: number, y: number, W: number, H: number,
  colors: TC,
) {
  const n = months.length
  if (n === 0) return
  const chartH = H - 18  // espacio para etiquetas
  const barW = Math.min(Math.floor((W - 4) / n) - 1, 14)
  const totalBarSpace = n * (barW + 1)
  const startX = x + (W - totalBarSpace) / 2

  // Fondo del chart
  doc.setFillColor(...colors.CARD); doc.rect(x, y, W, H, 'F')

  // Líneas guía horizontales
  doc.setDrawColor(...colors.BORDER); doc.setLineWidth(0.2)
  for (let g = 0; g <= 5; g++) {
    const gy = y + chartH - (g / 5) * chartH
    doc.line(x + 2, gy, x + W - 2, gy)
    if (g > 0 && g < 5) {
      doc.setTextColor(...colors.LIGHT); doc.setFontSize(4.5); doc.setFont('helvetica', 'normal')
      doc.text(String(g), x + 2, gy - 0.5)
    }
  }

  months.forEach((m, i) => {
    const bx = startX + i * (barW + 1)
    const val = m.avgRating ?? 0
    const bh = val > 0 ? (val / 5) * chartH : 0
    const barColor: RGB = val >= 4 ? GREEN : val >= 3 ? AMBER : val > 0 ? RED : colors.BORDER

    if (bh > 0) {
      doc.setFillColor(...barColor)
      doc.rect(bx, y + chartH - bh, barW, bh, 'F')
    }

    // Valor encima
    if (val > 0) {
      doc.setTextColor(...colors.TEXT); doc.setFontSize(5); doc.setFont('helvetica', 'bold')
      doc.text(val.toFixed(1), bx + barW / 2, y + chartH - bh - 1.5, { align: 'center' })
    }

    // Etiqueta mes
    const ml = safe(m.label).slice(0, 3)
    doc.setTextColor(...colors.MID); doc.setFont('helvetica', 'normal'); doc.setFontSize(4.5)
    doc.text(ml, bx + barW / 2, y + H - 4, { align: 'center' })

    // Reseñas debajo del mes
    doc.setTextColor(...colors.LIGHT); doc.setFontSize(4)
    doc.text(m.count > 0 ? String(m.count) : '—', bx + barW / 2, y + H - 0.5, { align: 'center' })
  })

  // Línea base
  doc.setDrawColor(...colors.BORDER); doc.setLineWidth(0.4)
  doc.line(x + 2, y + chartH, x + W - 2, y + chartH)
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ── PDF MENSUAL ───────────────────────────────────────────────────────────────

export async function generateMonthlyPDF(data: MonthlyPdfData, theme: PdfTheme = 'dark'): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF('p', 'mm', 'a4')

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const d = doc as any
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const W = 210, ML = 18, MR = W - 18, CW = MR - ML
  let y = 0

  const colors = tc(theme)
  const c = (r: RGB) => d.setTextColor(r[0], r[1], r[2])
  const f = (r: RGB) => d.setFillColor(r[0], r[1], r[2])
  const dr = (r: RGB) => d.setDrawColor(r[0], r[1], r[2])

  fillPage(d, W, theme)

  const cm = data.currentMonth
  const pm = data.previousMonth
  const mLabel = safe(cm.label)
  const pLabel = pm ? safe(pm.label) : null
  const slug = safe(data.negocioNombre).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  // CABECERA
  pdfHeader(d, W, ML, MR, data.negocioNombre, `Revisión mensual - ${mLabel}`)
  y = 38

  // Contacto
  const contactParts: string[] = []
  if (data.negocioTelefono) contactParts.push(safe(data.negocioTelefono))
  if (data.negocioEmail) contactParts.push(safe(data.negocioEmail))
  if (contactParts.length > 0) {
    c(colors.MID); d.setFont('helvetica', 'normal'); d.setFontSize(7)
    d.text(contactParts.join('   |   '), ML, y)
    y += 7
  }

  // TÍTULO
  c(colors.TEXT); d.setFont('helvetica', 'bold'); d.setFontSize(14)
  d.text(`Revisión mensual: ${mLabel}`, ML, y)
  c(colors.MID); d.setFont('helvetica', 'normal'); d.setFontSize(8)
  d.text(pLabel ? `Comparativa con ${pLabel} incluida` : 'Análisis del mes en curso', ML, y + 6)
  y += 16

  // SECTION 1: KPIs 2x2
  sectionLabel(d, `INDICADORES DE ${mLabel.toUpperCase()}`, y, ML, colors)
  y += 13

  const kW2 = CW / 2
  const kpis2x2: Array<{ label: string; val: string; vt: ReturnType<typeof varText>; up: boolean; col: RGB }>[] = [
    [
      { label: 'Nota media', val: cm.avgRating != null ? `${cm.avgRating.toFixed(2)} / 5` : 'Sin datos', vt: varText(cm.avgRating, pm?.avgRating ?? null, 2), up: true, col: AMBER },
      { label: 'Reseñas del mes', val: String(cm.count), vt: varText(cm.count, pm?.count ?? null, 0), up: true, col: INDIGO },
    ],
    [
      { label: 'Positivas (4-5 estrellas)', val: cm.positiveRatio != null ? `${cm.positiveRatio.toFixed(0)}%  (${cm.positiveCount})` : '—', vt: varText(cm.positiveRatio, pm?.positiveRatio ?? null, 1), up: true, col: GREEN },
      { label: 'Sin respuesta', val: String(data.pendingCount), vt: varText(data.pendingCount, null, 0), up: false, col: data.pendingCount > 0 ? RED : GREEN },
    ],
  ]

  kpis2x2.forEach(row => {
    row.forEach((k, i) => {
      const x = ML + i * kW2
      f(colors.CARD); dr(colors.BORDER); d.setLineWidth(0.2)
      d.roundedRect(x + 0.5, y, kW2 - 1.5, 28, 2, 2, 'FD')

      // Barra de fondo coloreada en la parte superior de la tarjeta
      f(k.col); d.rect(x + 0.5, y, kW2 - 1.5, 3, 'F')

      d.setFont('helvetica', 'normal'); d.setFontSize(6.5); c(colors.MID)
      d.text(k.label, x + 3, y + 9)
      d.setFont('helvetica', 'bold'); d.setFontSize(14); c(k.col)
      d.text(k.val, x + 3, y + 19)

      if (k.vt.significant) {
        const good = k.up ? k.vt.positive : !k.vt.positive
        d.setFont('helvetica', 'normal'); d.setFontSize(6.5); c(good ? GREEN : RED)
        d.text(`${k.vt.text} vs ${pLabel ?? 'anterior'}`, x + 3, y + 25)
      }
    })
    y += 31
  })

  // Mini KPIs secundarios: negativas + respondidas
  const miniKpis = [
    { label: 'Negativas (1-2)', val: cm.negativeRatio != null ? `${cm.negativeRatio.toFixed(0)}%  (${cm.negativeCount})` : '—', vt: varText(cm.negativeRatio, pm?.negativeRatio ?? null, 1), up: false, col: cm.negativeCount > 0 ? RED : colors.MID },
    { label: 'Respondidas', val: cm.responseRate != null ? `${cm.responseRate.toFixed(0)}%  (${cm.respondedCount})` : '—', vt: varText(cm.responseRate, pm?.responseRate ?? null, 1), up: true, col: INDIGO },
    { label: 'Ratio positivas', val: cm.positiveRatio != null ? `${cm.positiveRatio.toFixed(1)}%` : '—', vt: varText(cm.positiveRatio, pm?.positiveRatio ?? null, 1), up: true, col: GREEN },
  ]
  const mkW = CW / 3
  miniKpis.forEach((k, i) => {
    const x = ML + i * mkW
    f(colors.CARD); dr(colors.BORDER); d.setLineWidth(0.15)
    d.roundedRect(x + 0.5, y, mkW - 1.5, 18, 1.5, 1.5, 'FD')
    d.setFont('helvetica', 'normal'); d.setFontSize(6); c(colors.MID)
    d.text(k.label, x + 3, y + 5.5)
    d.setFont('helvetica', 'bold'); d.setFontSize(9); c(k.col)
    d.text(k.val, x + 3, y + 13)
  })
  y += 22

  // SECTION 1b: Velocidad de respuesta
  if (data.speedBenchmark) {
    const sb = data.speedBenchmark
    if (y > 230) { addPageThemed(d, W, theme); y = 20 }
    sectionLabel(d, 'VELOCIDAD DE RESPUESTA', y, ML, colors)
    y += 13

    const sbW = CW / 3
    const sbKpis = [
      { label: 'Media de respuesta', val: sb.avgDays < 1 ? `${Math.round(sb.avgDays * 24)}h` : `${sb.avgDays.toFixed(1)} días`, col: sb.avgDays < 2 ? GREEN : RED },
      { label: 'Respondidas en <48h', val: `${sb.pct48h.toFixed(0)}%`, col: sb.pct48h >= 80 ? GREEN : sb.pct48h >= 50 ? AMBER : RED },
      { label: 'Respondidas en <24h', val: `${sb.pct24h.toFixed(0)}%`, col: sb.pct24h >= 60 ? GREEN : sb.pct24h >= 30 ? AMBER : RED },
    ]
    sbKpis.forEach((k, i) => {
      const x = ML + i * sbW
      f(colors.CARD); dr(colors.BORDER); d.setLineWidth(0.2)
      d.roundedRect(x + 0.5, y, sbW - 1.5, 20, 1.5, 1.5, 'FD')
      d.setFont('helvetica', 'normal'); d.setFontSize(6.5); c(colors.MID)
      d.text(k.label, x + 3, y + 5.5)
      d.setFont('helvetica', 'bold'); d.setFontSize(13); c(k.col)
      d.text(k.val, x + 3, y + 14)
    })
    y += 23

    // Barra distribución velocidad
    const barTotalW = CW
    const b24 = (sb.pct24h / 100) * barTotalW
    const b48 = ((sb.pct48h - sb.pct24h) / 100) * barTotalW
    const bOver = ((100 - sb.pct48h) / 100) * barTotalW
    const bh = 6
    f(GREEN); d.rect(ML, y, b24, bh, 'F')
    f(AMBER); d.rect(ML + b24, y, b48, bh, 'F')
    if (bOver > 0) { f(RED); d.rect(ML + b24 + b48, y, bOver, bh, 'F') }
    y += bh + 4

    d.setFont('helvetica', 'normal'); d.setFontSize(6.5)
    const legend = [
      { col: GREEN, txt: `< 24h (${sb.pct24h.toFixed(0)}%)` },
      { col: AMBER, txt: `24-48h (${(sb.pct48h - sb.pct24h).toFixed(0)}%)` },
      { col: RED,   txt: `> 48h (${sb.pctOver48h.toFixed(0)}%)` },
    ]
    let lx = ML
    legend.forEach(l => {
      f(l.col); d.rect(lx, y, 3.5, 3.5, 'F')
      c(colors.MID); d.text(l.txt, lx + 5, y + 3.2)
      lx += 38
    })
    c(colors.LIGHT); d.setFontSize(6)
    d.text(`Benchmark Google: responder en < 48h. Basado en ${sb.totalResponded} reseñas respondidas.`, ML, y + 9)
    y += 14
  }

  // SECTION 1c: Distribución de estrellas — barras de progreso
  const sc = data.starCountsCurrent
  const sp = data.starCountsPrevious
  const totalStars = sc.slice(1).reduce((a, b) => a + b, 0)
  if (totalStars > 0) {
    if (y > 225) { addPageThemed(d, W, theme); y = 20 }
    sectionLabel(d, 'DISTRIBUCIÓN DE ESTRELLAS', y, ML, colors)
    y += 13

    const BAR_MAX = 100
    // Cabecera
    d.setFont('helvetica', 'bold'); d.setFontSize(7); c(colors.MID)
    d.text('Estrellas', ML, y + 4)
    d.text('Reseñas', ML + 22 + BAR_MAX + 2, y + 4)
    d.text('%', ML + 22 + BAR_MAX + 18, y + 4)
    if (sp) d.text(safe(pLabel ?? 'Anterior'), ML + 22 + BAR_MAX + 34, y + 4)
    y += 7

    for (let star = 5; star >= 1; star--) {
      const count = sc[star] ?? 0
      const pct = totalStars > 0 ? (count / totalStars) * 100 : 0
      const barW = totalStars > 0 ? (count / totalStars) * BAR_MAX : 0
      const prevCount = sp ? (sp[star] ?? 0) : null
      const starColor: RGB = star >= 4 ? GREEN : star === 3 ? AMBER : RED

      // Etiqueta estrella
      c(starColor); d.setFont('helvetica', 'bold'); d.setFontSize(7.5)
      d.text(`${star}*`, ML, y + 4.5)

      // Barra de progreso
      progressBar(d, ML + 22, y + 1, BAR_MAX, 5.5, barW, BAR_MAX, starColor, colors.BORDER)

      // Número
      c(colors.TEXT); d.setFont('helvetica', 'normal'); d.setFontSize(7)
      d.text(String(count), ML + 22 + BAR_MAX + 2, y + 4.5)

      // Porcentaje
      c(colors.MID); d.text(`${pct.toFixed(0)}%`, ML + 22 + BAR_MAX + 18, y + 4.5)

      // Mes anterior
      if (sp && prevCount !== null) {
        const prevTotal = sp.slice(1).reduce((a, b) => a + b, 0)
        const diff = count - prevCount
        const prevPct = prevTotal > 0 ? (prevCount / prevTotal) * 100 : 0
        void prevPct
        c(diff > 0 ? GREEN : diff < 0 ? RED : colors.LIGHT)
        d.text(`${prevCount} (${diff >= 0 ? '+' : ''}${diff})`, ML + 22 + BAR_MAX + 34, y + 4.5)
      }
      y += 8
    }
    y += 4
  }

  // SECTION 2: Comparativa directa
  if (pm && pLabel) {
    if (y > 210) { addPageThemed(d, W, theme); y = 20 }
    sectionLabel(d, `COMPARATIVA: ${mLabel.toUpperCase()} VS ${pLabel.toUpperCase()}`, y, ML, colors)
    y += 13

    const cW1 = 56, cW2 = 36, cW3 = 36, cW4 = 46
    y = themedTableHeader(d, ['Indicador', mLabel, pLabel, 'Variación'], [cW1, cW2, cW3, cW4], y, ML, colors)

    const rows = [
      { m: 'Nota media', cv: cm.avgRating != null ? `${cm.avgRating.toFixed(2)} / 5` : '—', pv: pm.avgRating != null ? `${pm.avgRating.toFixed(2)} / 5` : '—', vt: varText(cm.avgRating, pm.avgRating, 2), up: true },
      { m: 'Reseñas recibidas', cv: String(cm.count), pv: String(pm.count), vt: varText(cm.count, pm.count, 0), up: true },
      { m: 'Positivas (4-5)', cv: cm.positiveRatio != null ? `${cm.positiveRatio.toFixed(1)}%` : '—', pv: pm.positiveRatio != null ? `${pm.positiveRatio.toFixed(1)}%` : '—', vt: varText(cm.positiveRatio, pm.positiveRatio, 1), up: true },
      { m: 'Negativas (1-2)', cv: cm.negativeRatio != null ? `${cm.negativeRatio.toFixed(1)}%` : '—', pv: pm.negativeRatio != null ? `${pm.negativeRatio.toFixed(1)}%` : '—', vt: varText(cm.negativeRatio, pm.negativeRatio, 1), up: false },
      { m: 'Índice de respuesta', cv: cm.responseRate != null ? `${cm.responseRate.toFixed(1)}%` : '—', pv: pm.responseRate != null ? `${pm.responseRate.toFixed(1)}%` : '—', vt: varText(cm.responseRate, pm.responseRate, 1), up: true },
    ]
    rows.forEach((row, idx) => {
      dr(colors.BORDER); d.setLineWidth(0.1)
      f(idx % 2 === 0 ? colors.ROW_EVEN : colors.ROW_ODD)
      d.rect(ML, y, CW, 6.5, 'FD')
      d.setFont('helvetica', 'normal'); d.setFontSize(7)
      c(colors.TEXT); d.text(row.m, ML + 3, y + 4.5)
      c(colors.TEXT); d.text(row.cv, ML + cW1 + 3, y + 4.5)
      c(colors.MID); d.text(row.pv, ML + cW1 + cW2 + 3, y + 4.5)
      if (row.vt.significant) {
        const good = row.up ? row.vt.positive : !row.vt.positive
        c(good ? GREEN : RED); d.setFont('helvetica', 'bold')
        d.text(row.vt.text, ML + cW1 + cW2 + cW3 + 3, y + 4.5)
        d.setFont('helvetica', 'normal')
      } else { c(colors.LIGHT); d.text('Sin variación', ML + cW1 + cW2 + cW3 + 3, y + 4.5) }
      y += 6.5
    })
    y += 8
  }

  // SECTION 3: Evolución en el año
  if (data.yearMonths.length > 0) {
    if (y > 210) { addPageThemed(d, W, theme); y = 20 }
    sectionLabel(d, `EVOLUCIÓN MES A MES EN ${cm.year}`, y, ML, colors)
    y += 13

    const tw = [34, 18, 24, 20, 24, 24, 30]
    y = themedTableHeader(d, ['Mes', 'Reseñas', 'Nota', 'Var.', 'Positivas', 'Negativas', 'Respondidas'], tw, y, ML, colors)

    data.yearMonths.forEach((m, idx) => {
      if (y > 272) { addPageThemed(d, W, theme); y = 20 }
      const prev = idx > 0 ? data.yearMonths[idx - 1] : null
      const isCur = m.month === cm.month
      dr(colors.BORDER); d.setLineWidth(0.1)
      f(isCur ? (theme === 'dark' ? [20, 30, 70] as RGB : [238, 242, 255] as RGB) : idx % 2 === 0 ? colors.ROW_EVEN : colors.ROW_ODD)
      d.rect(ML, y, CW, 6.5, 'FD')
      d.setFont('helvetica', isCur ? 'bold' : 'normal'); d.setFontSize(7)
      let cx = ML + 2
      c(isCur ? INDIGO : colors.TEXT)
      const ml = safe(m.label); d.text(ml.charAt(0).toUpperCase() + ml.slice(1), cx, y + 4.5); cx += tw[0]
      c(m.count === 0 ? colors.LIGHT : colors.TEXT); d.setFont('helvetica', 'normal')
      d.text(m.count === 0 ? '—' : String(m.count), cx, y + 4.5); cx += tw[1]
      c(m.avgRating == null ? colors.LIGHT : AMBER)
      d.text(m.avgRating == null ? '—' : `${m.avgRating.toFixed(2)}`, cx, y + 4.5); cx += tw[2]
      const nd = varText(m.avgRating, prev?.avgRating ?? null, 2)
      if (nd.significant) { c(nd.positive ? GREEN : RED); d.setFont('helvetica', 'bold'); d.text(nd.text, cx, y + 4.5); d.setFont('helvetica', 'normal') } else { c(colors.LIGHT); d.text('—', cx, y + 4.5) }
      cx += tw[3]
      c(m.positiveRatio == null ? colors.LIGHT : GREEN)
      d.text(m.positiveRatio == null ? '—' : `${m.positiveRatio.toFixed(0)}%`, cx, y + 4.5); cx += tw[4]
      c(m.negativeRatio == null ? colors.LIGHT : m.negativeRatio > 30 ? RED : colors.MID)
      d.text(m.negativeRatio == null ? '—' : `${m.negativeRatio.toFixed(0)}%`, cx, y + 4.5); cx += tw[5]
      c(m.responseRate == null ? colors.LIGHT : INDIGO)
      d.text(m.responseRate == null ? '—' : `${m.responseRate.toFixed(0)}%`, cx, y + 4.5)
      y += 6.5
    })
    y += 8
  }

  // SECTION 4: Keywords
  const hasPalabrasClave = data.negocioPalabrasClave && data.negocioPalabrasClave.length > 0
  if (data.keywords.length > 0 || hasPalabrasClave) {
    if (y > 235) { addPageThemed(d, W, theme); y = 20 }
    sectionLabel(d, 'PALABRAS CLAVE Y MENCIONADAS', y, ML, colors)
    y += 13

    if (hasPalabrasClave) {
      c(INDIGO); d.setFont('helvetica', 'bold'); d.setFontSize(7.5)
      d.text('Palabras clave SEO del negocio:', ML, y + 3.5)
      c(colors.TEXT); d.setFont('helvetica', 'normal')
      const kwLine = data.negocioPalabrasClave!.map(k => safe(k)).join('   /   ')
      const kwLines = d.splitTextToSize(kwLine, CW - 48) as string[]
      d.text(kwLines, ML + 48, y + 3.5); y += kwLines.length * 4.5 + 4
    }

    const posKw = data.keywords.filter(k => k.sentiment === 'positive').map(k => safe(k.word))
    const negKw = data.keywords.filter(k => k.sentiment === 'negative').map(k => safe(k.word))
    const neuKw = data.keywords.filter(k => k.sentiment === 'neutral').map(k => safe(k.word))
    if (posKw.length > 0) {
      c(GREEN); d.setFont('helvetica', 'bold'); d.setFontSize(7.5); d.text('Mencionadas positivas:', ML, y + 3.5)
      c(colors.MID); d.setFont('helvetica', 'normal')
      const ln = d.splitTextToSize(posKw.join('  -  '), CW - 42) as string[]
      d.text(ln, ML + 42, y + 3.5); y += ln.length * 4.5 + 2
    }
    if (negKw.length > 0) {
      c(RED); d.setFont('helvetica', 'bold'); d.setFontSize(7.5); d.text('Mencionadas negativas:', ML, y + 3.5)
      c(colors.MID); d.setFont('helvetica', 'normal')
      const ln = d.splitTextToSize(negKw.join('  -  '), CW - 42) as string[]
      d.text(ln, ML + 42, y + 3.5); y += ln.length * 4.5 + 2
    }
    if (neuKw.length > 0) {
      c(AMBER); d.setFont('helvetica', 'bold'); d.setFontSize(7.5); d.text('Mencionadas neutras:', ML, y + 3.5)
      c(colors.MID); d.setFont('helvetica', 'normal')
      const ln = d.splitTextToSize(neuKw.join('  -  '), CW - 42) as string[]
      d.text(ln, ML + 42, y + 3.5); y += ln.length * 4.5 + 2
    }
    y += 4
  }

  // SECTION 5: Diagnóstico IA — bloques destacados
  if (data.summary) {
    if (y > 205) { addPageThemed(d, W, theme); y = 20 }
    sectionLabel(d, 'DIAGNÓSTICO IA', y, ML, colors)
    y += 13

    const ins = [
      { l: 'Lo que brilla', t: safe(data.summary.brilla), ac: GREEN, bg: colors.AI_SHINE, icon: '+' },
      { l: 'Lo que preocupa', t: safe(data.summary.quema), ac: RED, bg: colors.AI_WORRY, icon: '!' },
      { l: 'Acción recomendada', t: safe(data.summary.accion), ac: INDIGO, bg: colors.AI_ACTION, icon: '>' },
    ]

    ins.forEach(i => {
      if (y > 255) { addPageThemed(d, W, theme); y = 20 }
      const lines = d.splitTextToSize(i.t, CW - 14) as string[]
      const bh = 14 + lines.length * 4.5

      // Bloque fondo coloreado
      f(i.bg); d.rect(ML, y, CW, bh, 'F')

      // Barra lateral de acento
      f(i.ac); d.rect(ML, y, 3, bh, 'F')

      // Icono circular
      f(i.ac); d.circle(ML + 10, y + 7, 3.5, 'F')
      d.setTextColor(255, 255, 255); d.setFont('helvetica', 'bold'); d.setFontSize(8)
      d.text(i.icon, ML + 10, y + 8.5, { align: 'center' })

      // Label
      c(i.ac); d.setFont('helvetica', 'bold'); d.setFontSize(8)
      d.text(i.l, ML + 17, y + 7)

      // Línea separadora
      d.setDrawColor(...i.ac); d.setLineWidth(0.3)
      d.line(ML + 17, y + 9, ML + CW - 4, y + 9)

      // Texto
      c(colors.TEXT); d.setFont('helvetica', 'normal'); d.setFontSize(7.5)
      d.text(lines, ML + 17, y + 13.5)

      y += bh + 5
    })

    c(colors.LIGHT); d.setFont('helvetica', 'italic'); d.setFontSize(6.5)
    d.text('Análisis generado automáticamente por Claude (Anthropic). Carácter orientativo.', ML, y)
    y += 5
  }

  // SECTION 6: Benchmark Pro (Radar) — nueva página
  const radar = data.radarAnalisis?.resultado ?? null
  const radarCats = radar?.categorias ?? []
  if (radar && radarCats.length > 0) {
    addPageThemed(d, W, theme)
    y = 20

    pdfHeader(d, W, ML, MR, data.negocioNombre, `Análisis de Competencias - ${mLabel}`)
    y = 45

    c(colors.TEXT); d.setFont('helvetica', 'bold'); d.setFontSize(13)
    d.text('Análisis de Competencias', ML, y)
    c(colors.MID); d.setFont('helvetica', 'normal'); d.setFontSize(8)
    d.text('Posición de tu negocio frente a competidores en las categorías clave (escala 0-10)', ML, y + 7)
    y += 18

    // Nombres de competidores
    const maxComps = 3
    const compNames: string[] = []
    if (radarCats[0]?.rivales) {
      radarCats[0].rivales.slice(0, maxComps).forEach((r, i) => {
        compNames.push(safe(r.nombre || `Competidor ${i + 1}`))
      })
    }
    while (compNames.length < maxComps) compNames.push(`Comp. ${compNames.length + 1}`)

    // Cabecera de matriz
    sectionLabel(d, 'PUNTUACIONES POR CATEGORÍA (0-10)', y, ML, colors)
    y += 13

    // Columnas: categoría más ancha, score propio, 3 competidores
    const colCat = 52, colYo = 36, colComp = Math.floor((CW - colCat - colYo) / maxComps)
    const headers = ['Categoría', 'Tu negocio', ...compNames.slice(0, maxComps)]
    const widths = [colCat, colYo, ...Array(maxComps).fill(colComp)]
    y = themedTableHeader(d, headers, widths, y, ML, colors)

    const ROW_H = 14

    radarCats.forEach((cat, idx) => {
      if (y > 265) { addPageThemed(d, W, theme); y = 20 }
      dr(colors.BORDER); d.setLineWidth(0.1)
      f(idx % 2 === 0 ? colors.ROW_EVEN : colors.ROW_ODD)
      d.rect(ML, y, CW, ROW_H, 'FD')

      // Nombre categoría centrado verticalmente
      c(colors.TEXT); d.setFont('helvetica', 'bold'); d.setFontSize(8)
      d.text(safe(cat.nombre), ML + 3, y + ROW_H / 2 + 2.5)

      // Mi score: número + barra
      const myScore = cat.yo ?? 0
      const myCol: RGB = myScore >= 7 ? GREEN : myScore >= 5 ? AMBER : RED
      const scoreX = ML + colCat
      c(myCol); d.setFont('helvetica', 'bold'); d.setFontSize(10)
      d.text(myScore.toFixed(1), scoreX + 3, y + 6.5)
      progressBar(d, scoreX + 3, y + 9, colYo - 7, 3, myScore, 10, myCol, colors.BORDER)

      // Scores competidores
      cat.rivales?.slice(0, maxComps).forEach((r, ci) => {
        const rx = ML + colCat + colYo + ci * colComp
        const rScore = r.score ?? 0
        const rCol: RGB = rScore >= 7 ? GREEN : rScore >= 5 ? AMBER : RED
        c(rCol); d.setFont('helvetica', 'bold'); d.setFontSize(10)
        d.text(rScore.toFixed(1), rx + 3, y + 6.5)
        progressBar(d, rx + 3, y + 9, colComp - 7, 3, rScore, 10, rCol, colors.BORDER)
      })
      // Columnas sin datos
      for (let ci = (cat.rivales?.length ?? 0); ci < maxComps; ci++) {
        const rx = ML + colCat + colYo + ci * colComp
        c(colors.LIGHT); d.setFont('helvetica', 'normal'); d.setFontSize(7)
        d.text('—', rx + 3, y + 6.5)
      }

      y += ROW_H
    })
    y += 6

    // Fortaleza / Debilidad / Acción Pro
    if (radar.tuFortaleza || radar.tuDebilidad || radar.accionPro) {
      if (y > 210) { addPageThemed(d, W, theme); y = 20 }
      sectionLabel(d, 'DIAGNÓSTICO COMPETITIVO IA', y, ML, colors)
      y += 13

      const compIns = [
        { l: 'Tu fortaleza', t: safe(radar.tuFortaleza ?? ''), ac: GREEN, bg: colors.AI_SHINE, icon: '+' },
        { l: 'Tu debilidad', t: safe(radar.tuDebilidad ?? ''), ac: RED, bg: colors.AI_WORRY, icon: '!' },
        { l: 'Acción prioritaria', t: safe(radar.accionPro ?? radar.accion ?? ''), ac: INDIGO, bg: colors.AI_ACTION, icon: '>' },
      ].filter(i => i.t.length > 0)

      compIns.forEach(i => {
        if (y > 255) { addPageThemed(d, W, theme); y = 20 }
        const lines = d.splitTextToSize(i.t, CW - 14) as string[]
        const bh = 14 + lines.length * 4.5

        f(i.bg); d.rect(ML, y, CW, bh, 'F')
        f(i.ac); d.rect(ML, y, 3, bh, 'F')
        f(i.ac); d.circle(ML + 10, y + 7, 3.5, 'F')
        d.setTextColor(255, 255, 255); d.setFont('helvetica', 'bold'); d.setFontSize(8)
        d.text(i.icon, ML + 10, y + 8.5, { align: 'center' })
        c(i.ac); d.setFont('helvetica', 'bold'); d.setFontSize(8)
        d.text(i.l, ML + 17, y + 7)
        d.setDrawColor(...i.ac); d.setLineWidth(0.3)
        d.line(ML + 17, y + 9, ML + CW - 4, y + 9)
        c(colors.TEXT); d.setFont('helvetica', 'normal'); d.setFontSize(7.5)
        d.text(lines, ML + 17, y + 13.5)
        y += bh + 5
      })
    }

    // Oportunidades
    if (radar.oportunidades && radar.oportunidades.length > 0) {
      if (y > 235) { addPageThemed(d, W, theme); y = 20 }
      sectionLabel(d, 'OPORTUNIDADES DETECTADAS', y, ML, colors)
      y += 13
      radar.oportunidades.forEach((op, i) => {
        if (y > 270) { addPageThemed(d, W, theme); y = 20 }
        f(i % 2 === 0 ? colors.ROW_EVEN : colors.ROW_ODD); dr(colors.BORDER); d.setLineWidth(0.1)
        const opLines = d.splitTextToSize(`${i + 1}. ${safe(op)}`, CW - 6) as string[]
        const rh = 5 + opLines.length * 4.5
        d.rect(ML, y, CW, rh, 'FD')
        c(colors.TEXT); d.setFont('helvetica', 'normal'); d.setFontSize(7)
        d.text(opLines, ML + 3, y + 4.5)
        y += rh
      })
      y += 4
    }

    c(colors.LIGHT); d.setFont('helvetica', 'italic'); d.setFontSize(6.5)
    d.text('Análisis radar generado por IA. Referencia orientativa para toma de decisiones.', ML, y)
  }

  pdfFooter(d, W, ML, MR, theme)
  const suffix = theme === 'light' ? 'claro' : 'oscuro'
  d.save(`velacre-mensual-${slug}-${mLabel.replace(/\s/g, '-').toLowerCase()}-${suffix}.pdf`)
}

// ── PDF ANUAL ─────────────────────────────────────────────────────────────────

export async function generateYearlyPDF(data: YearlyPdfData, theme: PdfTheme = 'dark'): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF('p', 'mm', 'a4')

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const d = doc as any
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const W = 210, ML = 18, MR = W - 18, CW = MR - ML
  let y = 0

  const colors = tc(theme)
  const c = (r: RGB) => d.setTextColor(r[0], r[1], r[2])
  const f = (r: RGB) => d.setFillColor(r[0], r[1], r[2])
  const dr = (r: RGB) => d.setDrawColor(r[0], r[1], r[2])

  fillPage(d, W, theme)

  const slug = safe(data.negocioNombre).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const cy = data.allYears.find(yr => yr.year === data.currentYear) ?? null
  const py = data.allYears.find(yr => yr.year === data.currentYear - 1) ?? null

  // CABECERA
  pdfHeader(d, W, ML, MR, data.negocioNombre, `Revisión anual - ${data.currentYear}`)
  y = 38

  // TITULO
  c(colors.TEXT); d.setFont('helvetica', 'bold'); d.setFontSize(14)
  d.text(`Balance del ejercicio ${data.currentYear}`, ML, y)
  c(colors.MID); d.setFont('helvetica', 'normal'); d.setFontSize(8)
  d.text(py ? `Comparativa con ejercicio ${data.currentYear - 1} incluida` : 'Primer ejercicio con datos registrados', ML, y + 6)
  y += 16

  // SECTION 1: KPIs 2x2 del ejercicio
  if (cy) {
    sectionLabel(d, `INDICADORES DEL EJERCICIO ${data.currentYear}`, y, ML, colors)
    y += 13

    const kW2 = CW / 2
    const kpis2x2: Array<{ label: string; val: string; vt: ReturnType<typeof varText>; up: boolean; col: RGB }>[] = [
      [
        { label: `Nota media ${data.currentYear}`, val: cy.avgRating != null ? `${cy.avgRating.toFixed(2)} / 5` : 'Sin datos', vt: varText(cy.avgRating, py?.avgRating ?? null, 2), up: true, col: AMBER },
        { label: `Reseñas ${data.currentYear}`, val: String(cy.count), vt: varText(cy.count, py?.count ?? null, 0), up: true, col: INDIGO },
      ],
      [
        { label: 'Positivas (4-5 estrellas)', val: cy.positiveRatio != null ? `${cy.positiveRatio.toFixed(0)}%` : '—', vt: varText(cy.positiveRatio, py?.positiveRatio ?? null, 1), up: true, col: GREEN },
        { label: 'Índice de respuesta', val: cy.responseRate != null ? `${cy.responseRate.toFixed(0)}%` : '—', vt: varText(cy.responseRate, py?.responseRate ?? null, 1), up: true, col: INDIGO },
      ],
    ]

    kpis2x2.forEach(row => {
      row.forEach((k, i) => {
        const x = ML + i * kW2
        f(colors.CARD); dr(colors.BORDER); d.setLineWidth(0.2)
        d.roundedRect(x + 0.5, y, kW2 - 1.5, 28, 2, 2, 'FD')
        f(k.col); d.rect(x + 0.5, y, kW2 - 1.5, 3, 'F')
        d.setFont('helvetica', 'normal'); d.setFontSize(6.5); c(colors.MID)
        d.text(k.label, x + 3, y + 9)
        d.setFont('helvetica', 'bold'); d.setFontSize(14); c(k.col)
        d.text(k.val, x + 3, y + 19)
        if (k.vt.significant) {
          const good = k.up ? k.vt.positive : !k.vt.positive
          d.setFont('helvetica', 'normal'); d.setFontSize(6.5); c(good ? GREEN : RED)
          d.text(`${k.vt.text} vs ${data.currentYear - 1}`, x + 3, y + 25)
        }
      })
      y += 31
    })
  }

  // SECTION 2: Evolución interanual (tabla)
  sectionLabel(d, 'EVOLUCIÓN INTERANUAL (POR EJERCICIO)', y, ML, colors)
  y += 13

  const yw = [22, 22, 28, 24, 26, 26, 26]
  y = themedTableHeader(d, ['Ejercicio', 'Reseñas', 'Nota media', 'Var. nota', 'Positivas', 'Negativas', 'Respondidas'], yw, y, ML, colors)

  data.allYears.forEach((yr, idx) => {
    const prevYr = data.allYears[idx + 1] ?? null
    const isCur = yr.year === data.currentYear
    dr(colors.BORDER); d.setLineWidth(0.1)
    f(isCur ? (theme === 'dark' ? [20, 30, 70] as RGB : [238, 242, 255] as RGB) : idx % 2 === 0 ? colors.ROW_EVEN : colors.ROW_ODD)
    d.rect(ML, y, CW, 6.5, 'FD')
    d.setFont('helvetica', isCur ? 'bold' : 'normal'); d.setFontSize(7)
    let cx = ML + 2
    c(isCur ? INDIGO : colors.TEXT); d.text(String(yr.year), cx, y + 4.5); cx += yw[0]
    c(colors.TEXT); d.setFont('helvetica', 'normal'); d.text(String(yr.count), cx, y + 4.5); cx += yw[1]
    c(yr.avgRating == null ? colors.LIGHT : AMBER)
    d.text(yr.avgRating == null ? '—' : `${yr.avgRating.toFixed(2)} / 5`, cx, y + 4.5); cx += yw[2]
    const nd = varText(yr.avgRating, prevYr?.avgRating ?? null, 2)
    if (nd.significant) { c(nd.positive ? GREEN : RED); d.setFont('helvetica', 'bold'); d.text(nd.text, cx, y + 4.5); d.setFont('helvetica', 'normal') } else { c(colors.LIGHT); d.text('—', cx, y + 4.5) }
    cx += yw[3]
    c(yr.positiveRatio == null ? colors.LIGHT : GREEN)
    d.text(yr.positiveRatio == null ? '—' : `${yr.positiveRatio.toFixed(0)}%`, cx, y + 4.5); cx += yw[4]
    c(yr.negativeRatio == null ? colors.LIGHT : yr.negativeRatio > 30 ? RED : colors.MID)
    d.text(yr.negativeRatio == null ? '—' : `${yr.negativeRatio.toFixed(0)}%`, cx, y + 4.5); cx += yw[5]
    c(yr.responseRate == null ? colors.LIGHT : INDIGO)
    d.text(yr.responseRate == null ? '—' : `${yr.responseRate.toFixed(0)}%`, cx, y + 4.5)
    y += 6.5
  })
  y += 8

  // SECTION 3: Desglose mensual — GRÁFICO DE BARRAS
  if (data.currentYearMonths.length > 0) {
    if (y > 180) { addPageThemed(d, W, theme); y = 20 }
    sectionLabel(d, `RESUMEN DE CRECIMIENTO - ${data.currentYear} MES A MES`, y, ML, colors)
    y += 13

    // Gráfico de barras de nota media
    c(colors.MID); d.setFont('helvetica', 'bold'); d.setFontSize(7)
    d.text('Nota media por mes (barras) y volumen de reseñas (etiqueta inferior)', ML, y)
    y += 5

    // Usamos los meses en orden ascendente (ya están así)
    const chartH = 60
    monthBarChart(d, data.currentYearMonths, ML, y, CW, chartH, colors)
    y += chartH + 4

    // Leyenda del gráfico
    const legendItems = [
      { col: GREEN, txt: 'Nota >= 4.0' },
      { col: AMBER, txt: 'Nota 3.0-3.9' },
      { col: RED, txt: 'Nota < 3.0' },
    ]
    let lx = ML
    legendItems.forEach(l => {
      f(l.col); d.rect(lx, y, 3.5, 3.5, 'F')
      c(colors.MID); d.setFont('helvetica', 'normal'); d.setFontSize(6.5)
      d.text(l.txt, lx + 5, y + 3.2)
      lx += 45
    })
    y += 8

    // Tabla compacta de datos mensuales debajo del gráfico
    if (y < 230) {
      const mw = [30, 16, 24, 18, 22, 22, 22]
      y = themedTableHeader(d, ['Mes', 'Res.', 'Nota', 'Var.', 'Positiv.', 'Negativ.', 'Respond.'], mw, y, ML, colors)

      data.currentYearMonths.forEach((m, idx) => {
        if (y > 272) { addPageThemed(d, W, theme); y = 20 }
        const prev = idx > 0 ? data.currentYearMonths[idx - 1] : null
        dr(colors.BORDER); d.setLineWidth(0.1)
        f(idx % 2 === 0 ? colors.ROW_EVEN : colors.ROW_ODD); d.rect(ML, y, CW, 6, 'FD')
        d.setFont('helvetica', 'normal'); d.setFontSize(6.5)
        let cx = ML + 2
        const ml2 = safe(m.label); c(colors.TEXT); d.text(ml2.charAt(0).toUpperCase() + ml2.slice(1), cx, y + 4); cx += mw[0]
        c(m.count === 0 ? colors.LIGHT : colors.TEXT); d.text(m.count === 0 ? '—' : String(m.count), cx, y + 4); cx += mw[1]
        c(m.avgRating == null ? colors.LIGHT : AMBER)
        d.text(m.avgRating == null ? '—' : `${m.avgRating.toFixed(2)}`, cx, y + 4); cx += mw[2]
        const nd = varText(m.avgRating, prev?.avgRating ?? null, 2)
        if (nd.significant) { c(nd.positive ? GREEN : RED); d.setFont('helvetica', 'bold'); d.text(nd.text, cx, y + 4); d.setFont('helvetica', 'normal') } else { c(colors.LIGHT); d.text('—', cx, y + 4) }
        cx += mw[3]
        c(m.positiveRatio == null ? colors.LIGHT : GREEN)
        d.text(m.positiveRatio == null ? '—' : `${m.positiveRatio.toFixed(0)}%`, cx, y + 4); cx += mw[4]
        c(m.negativeRatio == null ? colors.LIGHT : m.negativeRatio > 30 ? RED : colors.MID)
        d.text(m.negativeRatio == null ? '—' : `${m.negativeRatio.toFixed(0)}%`, cx, y + 4); cx += mw[5]
        c(m.responseRate == null ? colors.LIGHT : INDIGO)
        d.text(m.responseRate == null ? '—' : `${m.responseRate.toFixed(0)}%`, cx, y + 4)
        y += 6
      })
      y += 6
    }
  }

  // SECTION 4: Keywords
  if (data.keywords.length > 0) {
    if (y > 235) { addPageThemed(d, W, theme); y = 20 }
    sectionLabel(d, 'PALABRAS MAS MENCIONADAS', y, ML, colors)
    y += 13
    const posKw = data.keywords.filter(k => k.sentiment === 'positive').map(k => safe(k.word))
    const negKw = data.keywords.filter(k => k.sentiment === 'negative').map(k => safe(k.word))
    if (posKw.length > 0) {
      c(GREEN); d.setFont('helvetica', 'bold'); d.setFontSize(7.5); d.text('Aspectos positivos:', ML, y + 3.5)
      c(colors.MID); d.setFont('helvetica', 'normal')
      const ln = d.splitTextToSize(posKw.join('  -  '), CW - 42) as string[]
      d.text(ln, ML + 42, y + 3.5); y += ln.length * 4.5 + 2
    }
    if (negKw.length > 0) {
      c(RED); d.setFont('helvetica', 'bold'); d.setFontSize(7.5); d.text('Aspectos negativos:', ML, y + 3.5)
      c(colors.MID); d.setFont('helvetica', 'normal')
      const ln = d.splitTextToSize(negKw.join('  -  '), CW - 42) as string[]
      d.text(ln, ML + 42, y + 3.5); y += ln.length * 4.5 + 2
    }
    y += 4
  }

  // SECTION 5: IA
  if (data.summary) {
    if (y > 205) { addPageThemed(d, W, theme); y = 20 }
    sectionLabel(d, 'DIAGNÓSTICO IA', y, ML, colors)
    y += 13
    const ins = [
      { l: 'Lo que brilla', t: safe(data.summary.brilla), ac: GREEN, bg: colors.AI_SHINE, icon: '+' },
      { l: 'Lo que preocupa', t: safe(data.summary.quema), ac: RED, bg: colors.AI_WORRY, icon: '!' },
      { l: 'Acción recomendada', t: safe(data.summary.accion), ac: INDIGO, bg: colors.AI_ACTION, icon: '>' },
    ]
    ins.forEach(i => {
      if (y > 255) { addPageThemed(d, W, theme); y = 20 }
      const lines = d.splitTextToSize(i.t, CW - 14) as string[]
      const bh = 14 + lines.length * 4.5

      f(i.bg); d.rect(ML, y, CW, bh, 'F')
      f(i.ac); d.rect(ML, y, 3, bh, 'F')
      f(i.ac); d.circle(ML + 10, y + 7, 3.5, 'F')
      d.setTextColor(255, 255, 255); d.setFont('helvetica', 'bold'); d.setFontSize(8)
      d.text(i.icon, ML + 10, y + 8.5, { align: 'center' })
      c(i.ac); d.setFont('helvetica', 'bold'); d.setFontSize(8)
      d.text(i.l, ML + 17, y + 7)
      d.setDrawColor(...i.ac); d.setLineWidth(0.3)
      d.line(ML + 17, y + 9, ML + CW - 4, y + 9)
      c(colors.TEXT); d.setFont('helvetica', 'normal'); d.setFontSize(7.5)
      d.text(lines, ML + 17, y + 13.5)
      y += bh + 5
    })

    c(colors.LIGHT); d.setFont('helvetica', 'italic'); d.setFontSize(6.5)
    d.text('Análisis generado automáticamente por Claude (Anthropic). Carácter orientativo.', ML, y)
  }

  pdfFooter(d, W, ML, MR, theme)
  const suffix = theme === 'light' ? 'claro' : 'oscuro'
  d.save(`velacre-anual-${slug}-${data.currentYear}-${suffix}.pdf`)
}
