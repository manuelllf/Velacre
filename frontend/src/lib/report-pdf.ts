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

interface PdfReportData {
  negocioNombre: string
  months: MonthMetrics[]
  allTimeAvg: number
  allTimeCount: number
  responseRate: number
  positive: number
  neutral: number
  negative: number
  keywords: { word: string; sentiment: 'positive' | 'neutral' | 'negative' }[]
  summary: SummaryData | null
}

export async function generateReputationPDF(data: PdfReportData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF('p', 'mm', 'a4')

  const W = 210
  const ML = 18   // margin left
  const MR = W - 18
  const CW = MR - ML  // content width = 174mm
  let y = 0

  // Palette
  const DARK = [15, 23, 42] as const      // slate-900
  const MID = [71, 85, 105] as const      // slate-500
  const LIGHT = [148, 163, 184] as const  // slate-400
  const INDIGO = [79, 70, 229] as const   // indigo-600
  const GREEN = [16, 185, 129] as const   // emerald-500
  const RED = [239, 68, 68] as const      // red-500
  const AMBER = [245, 158, 11] as const   // amber-500
  const WHITE = [255, 255, 255] as const

  const set = (r: readonly [number, number, number]) => doc.setTextColor(r[0], r[1], r[2])
  const fill = (r: readonly [number, number, number]) => doc.setFillColor(r[0], r[1], r[2])
  const draw = (r: readonly [number, number, number]) => doc.setDrawColor(r[0], r[1], r[2])

  // ── HEADER BAR ──
  fill(DARK)
  doc.rect(0, 0, W, 28, 'F')
  set(WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Velacre', ML, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  set(LIGHT)
  doc.text('velacre.com', ML, 20)

  // Business name + report period
  const thisMonth = data.months[data.months.length - 1]
  set(WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(data.negocioNombre, MR, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  set(LIGHT)
  doc.text(`Informe de Reputación · ${thisMonth.label}`, MR, 20, { align: 'right' })

  y = 36

  // ── SUBTITLE ──
  set(DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Resumen de reputación', ML, y)
  draw([226, 232, 240]) // slate-200
  doc.setLineWidth(0.3)
  doc.line(ML, y + 2, MR, y + 2)
  y += 8

  // ── KPI ROW ──
  const kpis = [
    { label: 'Nota media global', value: data.allTimeAvg > 0 ? `${data.allTimeAvg.toFixed(1)} ★` : 'Sin datos', color: AMBER },
    { label: 'Total reseñas importadas', value: String(data.allTimeCount), color: INDIGO },
    { label: 'Reseñas este mes', value: String(thisMonth.count), color: INDIGO },
    { label: 'Índice de respuesta', value: `${data.responseRate.toFixed(0)}%`, color: GREEN },
  ]
  const kW = CW / 4
  kpis.forEach((k, i) => {
    const x = ML + i * kW
    fill([241, 245, 249]) // slate-100
    draw([226, 232, 240])
    doc.setLineWidth(0.2)
    doc.roundedRect(x + 0.5, y, kW - 2, 18, 2, 2, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    set(MID)
    doc.text(k.label, x + 3, y + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    set(k.color)
    doc.text(k.value, x + 3, y + 14)
  })
  y += 24

  // ── NOTA: fuente de datos ──
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  set(LIGHT)
  doc.text('Datos reales obtenidos de las reseñas de Google Maps importadas a través de Outscraper. Sin datos estimados en esta sección.', ML, y)
  y += 7

  // ── EVOLUCIÓN MENSUAL ──
  set(DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Evolución mensual (últimos 4 meses)', ML, y)
  draw([226, 232, 240])
  doc.line(ML, y + 1.5, MR, y + 1.5)
  y += 7

  // Table header
  const cols = [
    { label: 'Mes', w: 38 },
    { label: 'Reseñas', w: 22 },
    { label: 'Nota media', w: 26 },
    { label: '% Positivas', w: 26 },
    { label: '% Negativas', w: 26 },
    { label: '% Respondidas', w: 30 },
    { label: 'Variación nota', w: 26 },
  ]

  fill([241, 245, 249])
  draw([226, 232, 240])
  doc.setLineWidth(0.2)
  doc.rect(ML, y, CW, 7, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  set(DARK)
  let cx = ML + 2
  cols.forEach(col => {
    doc.text(col.label, cx, y + 4.5)
    cx += col.w
  })
  y += 7

  // Table rows
  data.months.forEach((m, idx) => {
    if (idx > 0) {
      draw([241, 245, 249])
      doc.setLineWidth(0.1)
      doc.line(ML, y, MR, y)
    }
    fill(idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252])
    doc.rect(ML, y, CW, 7, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    cx = ML + 2

    // Mes
    set(DARK)
    doc.text(m.label.charAt(0).toUpperCase() + m.label.slice(1), cx, y + 4.5)
    cx += cols[0].w

    // Reseñas
    set(m.count === 0 ? LIGHT : DARK)
    doc.text(m.count === 0 ? '—' : String(m.count), cx, y + 4.5)
    cx += cols[1].w

    // Nota media
    set(m.avgRating == null ? LIGHT : AMBER)
    doc.text(m.avgRating == null ? '—' : `${m.avgRating.toFixed(1)} ★`, cx, y + 4.5)
    cx += cols[2].w

    // % positivas
    set(m.positiveRatio == null ? LIGHT : GREEN)
    doc.text(m.positiveRatio == null ? '—' : `${m.positiveRatio.toFixed(0)}%`, cx, y + 4.5)
    cx += cols[3].w

    // % negativas
    set(m.negativeRatio == null ? LIGHT : m.negativeRatio > 30 ? RED : DARK)
    doc.text(m.negativeRatio == null ? '—' : `${m.negativeRatio.toFixed(0)}%`, cx, y + 4.5)
    cx += cols[4].w

    // % respondidas
    set(m.responseRate == null ? LIGHT : INDIGO)
    doc.text(m.responseRate == null ? '—' : `${m.responseRate.toFixed(0)}%`, cx, y + 4.5)
    cx += cols[5].w

    // Variación nota vs mes anterior
    if (idx > 0) {
      const prev = data.months[idx - 1]
      if (m.avgRating != null && prev.avgRating != null) {
        const d = m.avgRating - prev.avgRating
        set(Math.abs(d) < 0.05 ? LIGHT : d > 0 ? GREEN : RED)
        doc.text(`${d > 0 ? '+' : ''}${d.toFixed(2)}★`, cx, y + 4.5)
      } else {
        set(LIGHT)
        doc.text('—', cx, y + 4.5)
      }
    } else {
      set(LIGHT)
      doc.text('—', cx, y + 4.5)
    }

    y += 7
  })
  y += 6

  // ── ANÁLISIS DE SENTIMIENTO ──
  set(DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Análisis de sentimiento (total de reseñas)', ML, y)
  draw([226, 232, 240])
  doc.line(ML, y + 1.5, MR, y + 1.5)
  y += 7

  const total = data.positive + data.neutral + data.negative || 1
  const sentRows = [
    { label: 'Positivas (4-5 ★)', count: data.positive, pct: (data.positive / total) * 100, color: GREEN },
    { label: 'Neutras (3 ★)', count: data.neutral, pct: (data.neutral / total) * 100, color: AMBER },
    { label: 'Negativas (1-2 ★)', count: data.negative, pct: (data.negative / total) * 100, color: RED },
  ]
  sentRows.forEach(row => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    set(DARK)
    doc.text(row.label, ML + 2, y + 3.5)
    // bar background
    fill([241, 245, 249])
    doc.rect(ML + 50, y, 80, 5, 'F')
    // bar fill
    fill(row.color)
    doc.rect(ML + 50, y, (row.pct / 100) * 80, 5, 'F')
    // count + pct
    set(MID)
    doc.setFontSize(7)
    doc.text(`${row.count} reseñas · ${row.pct.toFixed(1)}%`, ML + 133, y + 3.5)
    y += 8
  })
  y += 4

  // ── PALABRAS CLAVE ──
  if (data.keywords.length > 0) {
    set(DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Palabras más mencionadas', ML, y)
    draw([226, 232, 240])
    doc.line(ML, y + 1.5, MR, y + 1.5)
    y += 7

    const posKw = data.keywords.filter(k => k.sentiment === 'positive').map(k => k.word)
    const negKw = data.keywords.filter(k => k.sentiment === 'negative').map(k => k.word)
    const neuKw = data.keywords.filter(k => k.sentiment === 'neutral').map(k => k.word)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    if (posKw.length > 0) {
      set(GREEN)
      doc.setFont('helvetica', 'bold')
      doc.text('Positivas: ', ML, y + 3.5)
      set(DARK)
      doc.setFont('helvetica', 'normal')
      doc.text(posKw.join(', '), ML + 22, y + 3.5)
      y += 7
    }
    if (negKw.length > 0) {
      set(RED)
      doc.setFont('helvetica', 'bold')
      doc.text('Negativas: ', ML, y + 3.5)
      set(DARK)
      doc.setFont('helvetica', 'normal')
      doc.text(negKw.join(', '), ML + 22, y + 3.5)
      y += 7
    }
    if (neuKw.length > 0) {
      set(MID)
      doc.setFont('helvetica', 'bold')
      doc.text('Neutras: ', ML, y + 3.5)
      set(DARK)
      doc.setFont('helvetica', 'normal')
      doc.text(neuKw.join(', '), ML + 22, y + 3.5)
      y += 7
    }
    y += 3
  }

  // ── IA INSIGHTS ──
  if (data.summary) {
    // New page if not enough space
    if (y > 220) { doc.addPage(); y = 20 }

    set(DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Análisis IA', ML, y)
    draw([226, 232, 240])
    doc.line(ML, y + 1.5, MR, y + 1.5)
    y += 7

    const insights = [
      { label: 'Lo que brilla', text: data.summary.brilla, color: GREEN },
      { label: 'Lo que preocupa', text: data.summary.quema, color: RED },
      { label: 'Acción recomendada', text: data.summary.accion, color: INDIGO },
    ]
    insights.forEach(ins => {
      fill([248, 250, 252])
      draw([226, 232, 240])
      doc.setLineWidth(0.2)
      const lines = doc.splitTextToSize(ins.text, CW - 30) as string[]
      const boxH = 8 + lines.length * 4.5
      doc.roundedRect(ML, y, CW, boxH, 2, 2, 'FD')
      set(ins.color)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(ins.label, ML + 3, y + 5)
      set(DARK)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(lines, ML + 3, y + 5 + 4.5)
      y += boxH + 4
    })

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    set(LIGHT)
    doc.text('El análisis IA es generado automáticamente por Claude (Anthropic) a partir de las reseñas importadas. Es orientativo.', ML, y)
    y += 5
  }

  // ── FOOTER ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    fill([15, 23, 42])
    doc.rect(0, 284, W, 13, 'F')
    set(LIGHT)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const now = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    doc.text(`Generado por Velacre · velacre.com · ${now}`, ML, 291)
    doc.text(`Página ${i} de ${pageCount}`, MR, 291, { align: 'right' })
  }

  const slug = data.negocioNombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const period = thisMonth.label.replace(/\s/g, '-')
  doc.save(`velacre-informe-${slug}-${period}.pdf`)
}
