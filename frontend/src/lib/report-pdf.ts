import type { PendingReview } from './api'

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
  if (Math.abs(diff) < 0.5) return null // insignificante
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
    label: `${diff > 0 ? '+' : ''}${diff.toFixed(2)}★`,
    dir: diff > 0 ? 'up' : 'down',
  }
}

// ── PDF ──────────────────────────────────────────────────────────────────────

type RGB = readonly [number, number, number]

export interface MonthlyPdfData {
  negocioNombre: string
  currentMonth: MonthMetrics
  previousMonth: MonthMetrics | null
  yearMonths: MonthMetrics[]   // meses del año actual, orden ascendente
  keywords: { word: string; sentiment: 'positive' | 'neutral' | 'negative' }[]
  summary: SummaryData | null
}

export interface YearlyPdfData {
  negocioNombre: string
  currentYear: number
  allYears: MonthMetrics[]          // todos los ejercicios, descendente (más reciente primero)
  currentYearMonths: MonthMetrics[] // meses del año actual, ascendente
  keywords: { word: string; sentiment: 'positive' | 'neutral' | 'negative' }[]
  summary: SummaryData | null
}

// Elimina caracteres fuera de WinAnsi (Helvetica jsPDF)
function safe(s: string): string {
  return s.replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
}

// Variación como texto plano (+0.20) / (-0.15), sin Unicode
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

// ── Utilidades compartidas para jsPDF ────────────────────────────────────────
// Usamos 'any' para el doc porque jsPDF no exporta un tipo base limpio

/* eslint-disable @typescript-eslint/no-explicit-any */
function pdfHeader(doc: any, W: number, ML: number, MR: number, negocioNombre: string, reportLabel: string) {
  const DARK = [15, 23, 42], LIGHT = [148, 163, 184], WHITE = [255, 255, 255], INDIGO = [79, 70, 229]
  doc.setFillColor(...DARK); doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Velacre', ML, 14)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...LIGHT); doc.text('velacre.com', ML, 21)
  doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(safe(negocioNombre), MR, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...LIGHT); doc.text(reportLabel, MR, 21, { align: 'right' })
  doc.setFillColor(...INDIGO); doc.rect(0, 30, W, 1.5, 'F')
}

function pdfFooter(doc: any, W: number, ML: number, MR: number) {
  const n = doc.getNumberOfPages()
  const DARK = [15, 23, 42], LIGHT = [148, 163, 184]
  for (let p = 1; p <= n; p++) {
    doc.setPage(p)
    doc.setFillColor(...DARK); doc.rect(0, 284, W, 13, 'F')
    doc.setTextColor(...LIGHT); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
    const dt = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    doc.text(`Generado por Velacre - velacre.com - ${dt}`, ML, 291)
    doc.text(`Pag. ${p} / ${n}`, MR, 291, { align: 'right' })
  }
}

function sectionLabel(doc: any, text: string, y: number, ML: number) {
  const DARK = [15, 23, 42], INDIGO = [79, 70, 229], LIGHT = [148, 163, 184]
  doc.setFillColor(...INDIGO); doc.rect(ML, y, 2.5, 8, 'F')
  doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(text, ML + 6, y + 5.8)
  doc.setTextColor(...LIGHT)
}

function tableHeader(doc: any, headers: string[], widths: number[], y: number, ML: number): number {
  const CW = widths.reduce((a, b) => a + b, 0)
  const DARK = [15, 23, 42], WHITE = [255, 255, 255], S200 = [226, 232, 240]
  doc.setFillColor(...DARK); doc.setDrawColor(...S200); doc.setLineWidth(0.2); doc.rect(ML, y, CW, 6.5, 'FD')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...WHITE)
  let cx = ML + 2
  headers.forEach((h, i) => { doc.text(h, cx, y + 4.5); cx += widths[i] })
  return y + 6.5
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── PDF MENSUAL ───────────────────────────────────────────────────────────────

export async function generateMonthlyPDF(data: MonthlyPdfData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF('p', 'mm', 'a4')

  const W = 210, ML = 18, MR = W - 18, CW = MR - ML
  let y = 0

  const DARK: RGB = [15, 23, 42], MID: RGB = [71, 85, 105], LIGHT: RGB = [148, 163, 184]
  const INDIGO: RGB = [79, 70, 229], GREEN: RGB = [16, 185, 129], RED: RGB = [239, 68, 68]
  const AMBER: RGB = [245, 158, 11], WHITE: RGB = [255, 255, 255]
  const S50: RGB = [248, 250, 252], S200: RGB = [226, 232, 240]

  const c = (r: RGB) => doc.setTextColor(r[0], r[1], r[2])
  const f = (r: RGB) => doc.setFillColor(r[0], r[1], r[2])
  const d = (r: RGB) => doc.setDrawColor(r[0], r[1], r[2])

  const cm = data.currentMonth
  const pm = data.previousMonth
  const mLabel = safe(cm.label)
  const pLabel = pm ? safe(pm.label) : null
  const slug = safe(data.negocioNombre).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  // CABECERA
  pdfHeader(doc, W, ML, MR, data.negocioNombre, `Revision mensual - ${mLabel}`)
  y = 38

  // TITULO
  c(DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text(`Revision mensual: ${mLabel}`, ML, y)
  c(MID); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text(pLabel ? `Comparativa con ${pLabel} incluida` : 'Analisis del mes en curso', ML, y + 6)
  y += 16

  // SECTION 1: KPIs del mes
  sectionLabel(doc, `INDICADORES DE ${mLabel.toUpperCase()}`, y, ML)
  y += 13

  const kW = CW / 4
  const kpis = [
    { label: 'Nota media', val: cm.avgRating != null ? `${cm.avgRating.toFixed(2)} / 5` : 'Sin datos', vt: varText(cm.avgRating, pm?.avgRating ?? null, 2), up: true, col: AMBER },
    { label: 'Resenas del mes', val: String(cm.count), vt: varText(cm.count, pm?.count ?? null, 0), up: true, col: INDIGO },
    { label: 'Positivas (4-5)', val: cm.positiveRatio != null ? `${cm.positiveRatio.toFixed(0)}%` : '—', vt: varText(cm.positiveRatio, pm?.positiveRatio ?? null, 1), up: true, col: GREEN },
    { label: 'Respondidas', val: cm.responseRate != null ? `${cm.responseRate.toFixed(0)}%` : '—', vt: varText(cm.responseRate, pm?.responseRate ?? null, 1), up: true, col: INDIGO },
  ]
  kpis.forEach((k, i) => {
    const x = ML + i * kW
    f(S50); d(S200); doc.setLineWidth(0.2)
    doc.roundedRect(x + 0.5, y, kW - 1.5, 23, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); c(MID)
    doc.text(k.label, x + 3, y + 6)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); c(k.col)
    doc.text(k.val, x + 3, y + 14.5)
    if (k.vt.significant) {
      const good = k.up ? k.vt.positive : !k.vt.positive
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); c(good ? GREEN : RED)
      doc.text(`${k.vt.text} vs ${pLabel ?? 'anterior'}`, x + 3, y + 20)
    }
  })
  y += 28

  // SECTION 2: Comparativa directa mes actual vs anterior
  if (pm && pLabel) {
    sectionLabel(doc, `COMPARATIVA: ${mLabel.toUpperCase()} VS ${pLabel.toUpperCase()}`, y, ML)
    y += 13

    const cW1 = 56, cW2 = 36, cW3 = 36, cW4 = 46  // 174mm
    y = tableHeader(doc, ['Indicador', mLabel, pLabel, 'Variacion'], [cW1, cW2, cW3, cW4], y, ML)

    const rows = [
      { m: 'Nota media', cv: cm.avgRating != null ? `${cm.avgRating.toFixed(2)} / 5` : '—', pv: pm.avgRating != null ? `${pm.avgRating.toFixed(2)} / 5` : '—', vt: varText(cm.avgRating, pm.avgRating, 2), up: true },
      { m: 'Resenas recibidas', cv: String(cm.count), pv: String(pm.count), vt: varText(cm.count, pm.count, 0), up: true },
      { m: 'Positivas (4-5)', cv: cm.positiveRatio != null ? `${cm.positiveRatio.toFixed(1)}%` : '—', pv: pm.positiveRatio != null ? `${pm.positiveRatio.toFixed(1)}%` : '—', vt: varText(cm.positiveRatio, pm.positiveRatio, 1), up: true },
      { m: 'Negativas (1-2)', cv: cm.negativeRatio != null ? `${cm.negativeRatio.toFixed(1)}%` : '—', pv: pm.negativeRatio != null ? `${pm.negativeRatio.toFixed(1)}%` : '—', vt: varText(cm.negativeRatio, pm.negativeRatio, 1), up: false },
      { m: 'Indice respuesta', cv: cm.responseRate != null ? `${cm.responseRate.toFixed(1)}%` : '—', pv: pm.responseRate != null ? `${pm.responseRate.toFixed(1)}%` : '—', vt: varText(cm.responseRate, pm.responseRate, 1), up: true },
    ]
    rows.forEach((row, idx) => {
      d(S200); doc.setLineWidth(0.1)
      f(idx % 2 === 0 ? WHITE : S50); doc.rect(ML, y, CW, 6.5, 'FD')
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
      c(DARK); doc.text(row.m, ML + 3, y + 4.5)
      c(DARK); doc.text(row.cv, ML + cW1 + 3, y + 4.5)
      c(MID); doc.text(row.pv, ML + cW1 + cW2 + 3, y + 4.5)
      if (row.vt.significant) {
        const good = row.up ? row.vt.positive : !row.vt.positive
        c(good ? GREEN : RED); doc.setFont('helvetica', 'bold')
        doc.text(row.vt.text, ML + cW1 + cW2 + cW3 + 3, y + 4.5)
        doc.setFont('helvetica', 'normal')
      } else { c(LIGHT); doc.text('Sin variacion', ML + cW1 + cW2 + cW3 + 3, y + 4.5) }
      y += 6.5
    })
    y += 8
  }

  // SECTION 3: Evolución en el año
  if (data.yearMonths.length > 0) {
    if (y > 210) { doc.addPage(); y = 20 }
    sectionLabel(doc, `EVOLUCION MES A MES EN ${cm.year}`, y, ML)
    y += 13

    const tw = [34, 18, 24, 20, 24, 24, 30]  // 174mm
    y = tableHeader(doc, ['Mes', 'Resenas', 'Nota', 'Var.', 'Positivas', 'Negativas', 'Respondidas'], tw, y, ML)

    data.yearMonths.forEach((m, idx) => {
      if (y > 272) { doc.addPage(); y = 20 }
      const prev = idx > 0 ? data.yearMonths[idx - 1] : null
      const isCur = m.month === cm.month
      d(S200); doc.setLineWidth(0.1)
      f(isCur ? [238, 242, 255] as RGB : idx % 2 === 0 ? WHITE : S50)
      doc.rect(ML, y, CW, 6.5, 'FD')
      doc.setFont('helvetica', isCur ? 'bold' : 'normal'); doc.setFontSize(7)
      let cx = ML + 2
      c(isCur ? INDIGO : DARK)
      const ml = safe(m.label); doc.text(ml.charAt(0).toUpperCase() + ml.slice(1), cx, y + 4.5); cx += tw[0]
      c(m.count === 0 ? LIGHT : DARK); doc.setFont('helvetica', 'normal')
      doc.text(m.count === 0 ? '—' : String(m.count), cx, y + 4.5); cx += tw[1]
      c(m.avgRating == null ? LIGHT : AMBER)
      doc.text(m.avgRating == null ? '—' : `${m.avgRating.toFixed(2)}`, cx, y + 4.5); cx += tw[2]
      const nd = varText(m.avgRating, prev?.avgRating ?? null, 2)
      if (nd.significant) { c(nd.positive ? GREEN : RED); doc.setFont('helvetica', 'bold'); doc.text(nd.text, cx, y + 4.5); doc.setFont('helvetica', 'normal') } else { c(LIGHT); doc.text('—', cx, y + 4.5) }
      cx += tw[3]
      c(m.positiveRatio == null ? LIGHT : GREEN)
      doc.text(m.positiveRatio == null ? '—' : `${m.positiveRatio.toFixed(0)}%`, cx, y + 4.5); cx += tw[4]
      c(m.negativeRatio == null ? LIGHT : m.negativeRatio > 30 ? RED : MID)
      doc.text(m.negativeRatio == null ? '—' : `${m.negativeRatio.toFixed(0)}%`, cx, y + 4.5); cx += tw[5]
      c(m.responseRate == null ? LIGHT : INDIGO)
      doc.text(m.responseRate == null ? '—' : `${m.responseRate.toFixed(0)}%`, cx, y + 4.5)
      y += 6.5
    })
    y += 8
  }

  // SECTION 4: Keywords
  if (data.keywords.length > 0) {
    if (y > 235) { doc.addPage(); y = 20 }
    sectionLabel(doc, 'PALABRAS MAS MENCIONADAS', y, ML)
    y += 13
    const posKw = data.keywords.filter(k => k.sentiment === 'positive').map(k => safe(k.word))
    const negKw = data.keywords.filter(k => k.sentiment === 'negative').map(k => safe(k.word))
    if (posKw.length > 0) {
      c(GREEN); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text('Aspectos positivos:', ML, y + 3.5)
      c(MID); doc.setFont('helvetica', 'normal')
      const ln = doc.splitTextToSize(posKw.join('  -  '), CW - 42) as string[]
      doc.text(ln, ML + 42, y + 3.5); y += ln.length * 4.5 + 2
    }
    if (negKw.length > 0) {
      c(RED); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text('Aspectos negativos:', ML, y + 3.5)
      c(MID); doc.setFont('helvetica', 'normal')
      const ln = doc.splitTextToSize(negKw.join('  -  '), CW - 42) as string[]
      doc.text(ln, ML + 42, y + 3.5); y += ln.length * 4.5 + 2
    }
    y += 4
  }

  // SECTION 5: IA
  if (data.summary) {
    if (y > 205) { doc.addPage(); y = 20 }
    sectionLabel(doc, 'DIAGNOSTICO IA', y, ML)
    y += 13
    const ins = [
      { l: 'Lo que brilla', t: safe(data.summary.brilla), ac: GREEN, bg: [240, 253, 244] as RGB },
      { l: 'Lo que preocupa', t: safe(data.summary.quema), ac: RED, bg: [254, 242, 242] as RGB },
      { l: 'Accion recomendada', t: safe(data.summary.accion), ac: INDIGO, bg: [238, 242, 255] as RGB },
    ]
    ins.forEach(i => {
      if (y > 255) { doc.addPage(); y = 20 }
      const lines = doc.splitTextToSize(i.t, CW - 10) as string[]
      const bh = 11 + lines.length * 4.5
      f(i.ac); doc.rect(ML, y, 2.5, bh, 'F')
      f(i.bg); d(S200); doc.setLineWidth(0.1); doc.rect(ML + 2.5, y, CW - 2.5, bh, 'FD')
      c(i.ac); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(i.l, ML + 6, y + 6.5)
      c(DARK); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(lines, ML + 6, y + 11.5)
      y += bh + 4
    })
    c(LIGHT); doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5)
    doc.text('Analisis generado automaticamente por Claude (Anthropic). Caracter orientativo.', ML, y)
    y += 5
  }

  pdfFooter(doc, W, ML, MR)
  doc.save(`velacre-mensual-${slug}-${mLabel.replace(/\s/g, '-').toLowerCase()}.pdf`)
}

// ── PDF ANUAL ─────────────────────────────────────────────────────────────────

export async function generateYearlyPDF(data: YearlyPdfData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF('p', 'mm', 'a4')

  const W = 210, ML = 18, MR = W - 18, CW = MR - ML
  let y = 0

  const DARK: RGB = [15, 23, 42], MID: RGB = [71, 85, 105], LIGHT: RGB = [148, 163, 184]
  const INDIGO: RGB = [79, 70, 229], GREEN: RGB = [16, 185, 129], RED: RGB = [239, 68, 68]
  const AMBER: RGB = [245, 158, 11], WHITE: RGB = [255, 255, 255]
  const S50: RGB = [248, 250, 252], S200: RGB = [226, 232, 240]

  const c = (r: RGB) => doc.setTextColor(r[0], r[1], r[2])
  const f = (r: RGB) => doc.setFillColor(r[0], r[1], r[2])
  const d = (r: RGB) => doc.setDrawColor(r[0], r[1], r[2])

  const slug = safe(data.negocioNombre).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const cy = data.allYears.find(yr => yr.year === data.currentYear) ?? null
  const py = data.allYears.find(yr => yr.year === data.currentYear - 1) ?? null

  // CABECERA
  pdfHeader(doc, W, ML, MR, data.negocioNombre, `Revision anual - ${data.currentYear}`)
  y = 38

  // TITULO
  c(DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text(`Balance del ejercicio ${data.currentYear}`, ML, y)
  c(MID); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text(py ? `Comparativa con ejercicio ${data.currentYear - 1} incluida` : 'Primer ejercicio con datos registrados', ML, y + 6)
  y += 16

  // SECTION 1: KPIs del ejercicio actual
  if (cy) {
    sectionLabel(doc, `INDICADORES DEL EJERCICIO ${data.currentYear}`, y, ML)
    y += 13

    const kW = CW / 4
    const kpis = [
      { label: `Nota media ${data.currentYear}`, val: cy.avgRating != null ? `${cy.avgRating.toFixed(2)} / 5` : 'Sin datos', vt: varText(cy.avgRating, py?.avgRating ?? null, 2), up: true, col: AMBER },
      { label: `Resenas ${data.currentYear}`, val: String(cy.count), vt: varText(cy.count, py?.count ?? null, 0), up: true, col: INDIGO },
      { label: 'Positivas (4-5)', val: cy.positiveRatio != null ? `${cy.positiveRatio.toFixed(0)}%` : '—', vt: varText(cy.positiveRatio, py?.positiveRatio ?? null, 1), up: true, col: GREEN },
      { label: 'Respondidas', val: cy.responseRate != null ? `${cy.responseRate.toFixed(0)}%` : '—', vt: varText(cy.responseRate, py?.responseRate ?? null, 1), up: true, col: INDIGO },
    ]
    kpis.forEach((k, i) => {
      const x = ML + i * kW
      f(S50); d(S200); doc.setLineWidth(0.2)
      doc.roundedRect(x + 0.5, y, kW - 1.5, 23, 1.5, 1.5, 'FD')
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); c(MID); doc.text(k.label, x + 3, y + 6)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); c(k.col); doc.text(k.val, x + 3, y + 14.5)
      if (k.vt.significant) {
        const good = k.up ? k.vt.positive : !k.vt.positive
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); c(good ? GREEN : RED)
        doc.text(`${k.vt.text} vs ${data.currentYear - 1}`, x + 3, y + 20)
      }
    })
    y += 28
  }

  // SECTION 2: Evolución interanual
  sectionLabel(doc, 'EVOLUCION INTERANUAL (POR EJERCICIO)', y, ML)
  y += 13

  // cols: Ejercicio | Resenas | Nota | Var.nota | Positivas | Negativas | Respondidas = 174mm
  const yw = [22, 22, 28, 24, 26, 26, 26]
  y = tableHeader(doc, ['Ejercicio', 'Resenas', 'Nota media', 'Var. nota', 'Positivas', 'Negativas', 'Respondidas'], yw, y, ML)

  data.allYears.forEach((yr, idx) => {
    const prevYr = data.allYears[idx + 1] ?? null  // más antiguo (lista desc)
    const isCur = yr.year === data.currentYear
    d(S200); doc.setLineWidth(0.1)
    f(isCur ? [238, 242, 255] as RGB : idx % 2 === 0 ? WHITE : S50)
    doc.rect(ML, y, CW, 6.5, 'FD')
    doc.setFont('helvetica', isCur ? 'bold' : 'normal'); doc.setFontSize(7)
    let cx = ML + 2
    c(isCur ? INDIGO : DARK); doc.text(String(yr.year), cx, y + 4.5); cx += yw[0]
    c(DARK); doc.setFont('helvetica', 'normal'); doc.text(String(yr.count), cx, y + 4.5); cx += yw[1]
    c(yr.avgRating == null ? LIGHT : AMBER)
    doc.text(yr.avgRating == null ? '—' : `${yr.avgRating.toFixed(2)} / 5`, cx, y + 4.5); cx += yw[2]
    const nd = varText(yr.avgRating, prevYr?.avgRating ?? null, 2)
    if (nd.significant) { c(nd.positive ? GREEN : RED); doc.setFont('helvetica', 'bold'); doc.text(nd.text, cx, y + 4.5); doc.setFont('helvetica', 'normal') } else { c(LIGHT); doc.text('—', cx, y + 4.5) }
    cx += yw[3]
    c(yr.positiveRatio == null ? LIGHT : GREEN)
    doc.text(yr.positiveRatio == null ? '—' : `${yr.positiveRatio.toFixed(0)}%`, cx, y + 4.5); cx += yw[4]
    c(yr.negativeRatio == null ? LIGHT : yr.negativeRatio > 30 ? RED : MID)
    doc.text(yr.negativeRatio == null ? '—' : `${yr.negativeRatio.toFixed(0)}%`, cx, y + 4.5); cx += yw[5]
    c(yr.responseRate == null ? LIGHT : INDIGO)
    doc.text(yr.responseRate == null ? '—' : `${yr.responseRate.toFixed(0)}%`, cx, y + 4.5)
    y += 6.5
  })
  y += 8

  // SECTION 3: Desglose mensual del año actual
  if (data.currentYearMonths.length > 0) {
    if (y > 200) { doc.addPage(); y = 20 }
    sectionLabel(doc, `DESGLOSE MENSUAL ${data.currentYear}`, y, ML)
    y += 13

    const mw = [34, 18, 28, 20, 26, 26, 22]  // 174mm
    y = tableHeader(doc, ['Mes', 'Resenas', 'Nota media', 'Var.', 'Positivas', 'Negativas', 'Respondidas'], mw, y, ML)

    data.currentYearMonths.forEach((m, idx) => {
      if (y > 272) { doc.addPage(); y = 20 }
      const prev = idx > 0 ? data.currentYearMonths[idx - 1] : null
      d(S200); doc.setLineWidth(0.1)
      f(idx % 2 === 0 ? WHITE : S50); doc.rect(ML, y, CW, 6.5, 'FD')
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
      let cx = ML + 2
      const ml = safe(m.label); c(DARK); doc.text(ml.charAt(0).toUpperCase() + ml.slice(1), cx, y + 4.5); cx += mw[0]
      c(m.count === 0 ? LIGHT : DARK); doc.text(m.count === 0 ? '—' : String(m.count), cx, y + 4.5); cx += mw[1]
      c(m.avgRating == null ? LIGHT : AMBER)
      doc.text(m.avgRating == null ? '—' : `${m.avgRating.toFixed(2)} / 5`, cx, y + 4.5); cx += mw[2]
      const nd = varText(m.avgRating, prev?.avgRating ?? null, 2)
      if (nd.significant) { c(nd.positive ? GREEN : RED); doc.setFont('helvetica', 'bold'); doc.text(nd.text, cx, y + 4.5); doc.setFont('helvetica', 'normal') } else { c(LIGHT); doc.text('—', cx, y + 4.5) }
      cx += mw[3]
      c(m.positiveRatio == null ? LIGHT : GREEN)
      doc.text(m.positiveRatio == null ? '—' : `${m.positiveRatio.toFixed(0)}%`, cx, y + 4.5); cx += mw[4]
      c(m.negativeRatio == null ? LIGHT : m.negativeRatio > 30 ? RED : MID)
      doc.text(m.negativeRatio == null ? '—' : `${m.negativeRatio.toFixed(0)}%`, cx, y + 4.5); cx += mw[5]
      c(m.responseRate == null ? LIGHT : INDIGO)
      doc.text(m.responseRate == null ? '—' : `${m.responseRate.toFixed(0)}%`, cx, y + 4.5)
      y += 6.5
    })
    y += 8
  }

  // SECTION 4: Keywords
  if (data.keywords.length > 0) {
    if (y > 235) { doc.addPage(); y = 20 }
    sectionLabel(doc, 'PALABRAS MAS MENCIONADAS', y, ML)
    y += 13
    const posKw = data.keywords.filter(k => k.sentiment === 'positive').map(k => safe(k.word))
    const negKw = data.keywords.filter(k => k.sentiment === 'negative').map(k => safe(k.word))
    if (posKw.length > 0) {
      c(GREEN); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text('Aspectos positivos:', ML, y + 3.5)
      c(MID); doc.setFont('helvetica', 'normal')
      const ln = doc.splitTextToSize(posKw.join('  -  '), CW - 42) as string[]
      doc.text(ln, ML + 42, y + 3.5); y += ln.length * 4.5 + 2
    }
    if (negKw.length > 0) {
      c(RED); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text('Aspectos negativos:', ML, y + 3.5)
      c(MID); doc.setFont('helvetica', 'normal')
      const ln = doc.splitTextToSize(negKw.join('  -  '), CW - 42) as string[]
      doc.text(ln, ML + 42, y + 3.5); y += ln.length * 4.5 + 2
    }
    y += 4
  }

  // SECTION 5: IA
  if (data.summary) {
    if (y > 205) { doc.addPage(); y = 20 }
    sectionLabel(doc, 'DIAGNOSTICO IA', y, ML)
    y += 13
    const ins = [
      { l: 'Lo que brilla', t: safe(data.summary.brilla), ac: GREEN, bg: [240, 253, 244] as RGB },
      { l: 'Lo que preocupa', t: safe(data.summary.quema), ac: RED, bg: [254, 242, 242] as RGB },
      { l: 'Accion recomendada', t: safe(data.summary.accion), ac: INDIGO, bg: [238, 242, 255] as RGB },
    ]
    ins.forEach(i => {
      if (y > 255) { doc.addPage(); y = 20 }
      const lines = doc.splitTextToSize(i.t, CW - 10) as string[]
      const bh = 11 + lines.length * 4.5
      f(i.ac); doc.rect(ML, y, 2.5, bh, 'F')
      f(i.bg); d(S200); doc.setLineWidth(0.1); doc.rect(ML + 2.5, y, CW - 2.5, bh, 'FD')
      c(i.ac); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(i.l, ML + 6, y + 6.5)
      c(DARK); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(lines, ML + 6, y + 11.5)
      y += bh + 4
    })
    c(LIGHT); doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5)
    doc.text('Analisis generado automaticamente por Claude (Anthropic). Caracter orientativo.', ML, y)
  }

  pdfFooter(doc, W, ML, MR)
  doc.save(`velacre-anual-${slug}-${data.currentYear}.pdf`)
}
