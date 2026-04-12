import type { MiniRadarResult } from './api'

// ─── Colores (mismos que report-pdf.ts) ──────────────────────────────────────

type RGB = [number, number, number]

const ATLANTIC: RGB = [5, 16, 32]
const INDIGO: RGB = [99, 102, 241]
const WHITE: RGB = [255, 255, 255]
const GREEN: RGB = [16, 185, 129]
const RED: RGB = [239, 68, 68]
const AMBER: RGB = [245, 158, 11]
const SLATE_50: RGB = [248, 250, 252]
const SLATE_200: RGB = [226, 232, 240]
const SLATE_500: RGB = [100, 116, 139]
const SLATE_700: RGB = [51, 65, 85]
const SLATE_900: RGB = [15, 23, 42]

// ─── Utilidades ──────────────────────────────────────────────────────────────

/** Elimina caracteres fuera de WinAnsi (Helvetica jsPDF soporta hasta \xFF) */
function safe(s: string): string {
  return s.replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
}

/** Sanitiza un nombre para usarlo como parte de un filename */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function pdfHeader(doc: any, W: number, ML: number, MR: number, nombreNegocio: string, label: string) {
  doc.setFillColor(...ATLANTIC)
  doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Velacre', ML, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('velacre.com', ML, 21)
  const linkW = doc.getTextWidth('velacre.com')
  doc.link(ML, 17, linkW, 5, { url: 'https://velacre.com' })
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(safe(nombreNegocio), MR, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(label, MR, 21, { align: 'right' })
  doc.setFillColor(...INDIGO)
  doc.rect(0, 30, W, 1.5, 'F')
}

function pdfFooter(doc: any, W: number, ML: number, MR: number) {
  const n = doc.getNumberOfPages()
  for (let p = 1; p <= n; p++) {
    doc.setPage(p)
    doc.setFillColor(...ATLANTIC)
    doc.rect(0, 284, W, 13, 'F')
    doc.setTextColor(...SLATE_500)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    const dt = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    doc.text(`Análisis cortesía de Velacre - velacre.com - ${dt}`, ML, 291)
    const preW = doc.getTextWidth('Análisis cortesía de Velacre - ')
    const urlW = doc.getTextWidth('velacre.com')
    doc.link(ML + preW, 287, urlW, 5, { url: 'https://velacre.com' })
    doc.text(`Pag. ${p} / ${n}`, MR, 291, { align: 'right' })
  }
}

function sectionLabel(doc: any, text: string, y: number, ML: number) {
  doc.setFillColor(...INDIGO)
  doc.rect(ML, y, 2.5, 8, 'F')
  doc.setTextColor(...SLATE_900)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text(safe(text), ML + 6, y + 5.8)
}

/** Wrap text helper — jsPDF splitTextToSize devuelve array de líneas */
function wrapText(doc: any, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(safe(text), maxWidth)
}

// ─── KPI card (usado en página 2) ────────────────────────────────────────────

function kpiCard(
  doc: any,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  accent: RGB,
) {
  doc.setDrawColor(...SLATE_200)
  doc.setFillColor(...SLATE_50)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')
  // Banda superior accent
  doc.setFillColor(...accent)
  doc.rect(x, y, w, 1.2, 'F')
  doc.setTextColor(...SLATE_500)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(safe(label.toUpperCase()), x + 4, y + 7)
  doc.setTextColor(...SLATE_900)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(safe(value), x + 4, y + 18)
}

// ─── Generador principal ─────────────────────────────────────────────────────

export async function downloadMiniRadarPdf(data: MiniRadarResult): Promise<void> {
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })

  const W = doc.internal.pageSize.getWidth()
  const ML = 14
  const MR = W - 14
  const CW = MR - ML

  const nombre = data.nombre && data.nombre.trim() ? data.nombre : 'Negocio analizado'
  const analisis = data.analisis
  const stats = data.stats

  const ratingLabel = stats.ratingAvg.toFixed(2).replace('.', ',')
  const fechaGen = new Date(data.generadoEn).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // ═════════════ PORTADA (pagina 1) ═════════════

  pdfHeader(doc, W, ML, MR, nombre, 'Informe Mini Radar')

  // Titulo grande
  let y = 55
  doc.setTextColor(...SLATE_900)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text(safe('Análisis de reputación online'), ML, y)
  y += 9
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...SLATE_500)
  doc.text(safe(`Informe gratuito generado el ${fechaGen}`), ML, y)
  y += 14

  // Resumen ejecutivo
  sectionLabel(doc, 'RESUMEN EJECUTIVO', y, ML)
  y += 12
  doc.setTextColor(...SLATE_700)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const resumen = analisis?.resumen ?? 'Analisis no disponible.'
  const resumenLines = wrapText(doc, resumen, CW)
  doc.text(resumenLines, ML, y)
  y += resumenLines.length * 5 + 8

  // 4 KPIs grid 2x2
  sectionLabel(doc, 'MÉTRICAS CLAVE', y, ML)
  y += 12
  const cardW = (CW - 6) / 2
  const cardH = 24
  kpiCard(doc, ML, y, cardW, cardH, 'Rating medio', `${ratingLabel} / 5`, INDIGO)
  kpiCard(doc, ML + cardW + 6, y, cardW, cardH, 'Reseñas analizadas', `${stats.total}`, GREEN)
  y += cardH + 5
  kpiCard(doc, ML, y, cardW, cardH, 'Últimos 30 días', `${stats.ult30d} reseñas`, AMBER)
  kpiCard(
    doc,
    ML + cardW + 6,
    y,
    cardW,
    cardH,
    '% Respondidas',
    `${stats.pctRespondidas}%`,
    stats.pctRespondidas < 40 ? RED : stats.pctRespondidas < 70 ? AMBER : GREEN,
  )
  y += cardH + 10

  // Distribucion estrellas (barras horizontales)
  sectionLabel(doc, 'DISTRIBUCIÓN 1-5 ESTRELLAS', y, ML)
  y += 12
  const dist = stats.distribucion
  const maxDist = Math.max(dist.s1, dist.s2, dist.s3, dist.s4, dist.s5, 1)
  const barsData: { label: string; count: number; color: RGB }[] = [
    { label: '5*', count: dist.s5, color: GREEN },
    { label: '4*', count: dist.s4, color: GREEN },
    { label: '3*', count: dist.s3, color: AMBER },
    { label: '2*', count: dist.s2, color: RED },
    { label: '1*', count: dist.s1, color: RED },
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (const b of barsData) {
    doc.setTextColor(...SLATE_700)
    doc.text(b.label, ML, y + 3.5)
    const barMaxW = CW - 24
    const barW = (b.count / maxDist) * barMaxW
    doc.setFillColor(...SLATE_200)
    doc.rect(ML + 10, y, barMaxW, 5, 'F')
    if (barW > 0) {
      doc.setFillColor(...b.color)
      doc.rect(ML + 10, y, barW, 5, 'F')
    }
    doc.setTextColor(...SLATE_500)
    doc.text(`${b.count}`, MR, y + 3.5, { align: 'right' })
    y += 7
  }

  // ═════════════ PAGINA 2 — QUEJAS SIN RESPUESTA ═════════════

  doc.addPage()
  pdfHeader(doc, W, ML, MR, nombre, 'Mini Radar - Hallazgos')
  y = 45

  sectionLabel(doc, 'QUEJAS RECIENTES SIN RESPONDER', y, ML)
  y += 12
  doc.setTextColor(...SLATE_500)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.text(
    safe('Estas reseñas negativas están visibles en Google sin respuesta del propietario.'),
    ML,
    y,
  )
  y += 8

  if (data.peoresSinResponder.length === 0) {
    doc.setTextColor(...SLATE_500)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.text(
      safe('No se han encontrado reseñas críticas sin responder en las últimas 30. Bien hecho.'),
      ML,
      y + 6,
    )
    y += 20
  } else {
    for (const r of data.peoresSinResponder) {
      const fecha = new Date(r.fecha).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      // Card
      doc.setDrawColor(...SLATE_200)
      doc.setFillColor(...SLATE_50)
      doc.setLineWidth(0.3)
      const textLines = wrapText(doc, r.texto, CW - 10)
      const cardH = 14 + textLines.length * 4.5
      doc.roundedRect(ML, y, CW, cardH, 2, 2, 'FD')
      // Banda lateral roja
      doc.setFillColor(...RED)
      doc.rect(ML, y, 2.5, cardH, 'F')
      // Header de la card: autor + rating + fecha
      doc.setTextColor(...SLATE_900)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(safe(r.autor), ML + 6, y + 6)
      doc.setTextColor(...RED)
      doc.text(`${r.rating}*`, ML + 6 + doc.getTextWidth(safe(r.autor)) + 3, y + 6)
      doc.setTextColor(...SLATE_500)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text(fecha, MR - 4, y + 6, { align: 'right' })
      // Texto de la reseña
      doc.setTextColor(...SLATE_700)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.text(textLines, ML + 6, y + 11)
      y += cardH + 4
      if (y > 240) {
        doc.addPage()
        pdfHeader(doc, W, ML, MR, nombre, 'Mini Radar - Hallazgos (cont.)')
        y = 45
      }
    }
  }

  // ═════════════ PAGINA 3 — DIAGNOSTICO IA ═════════════

  doc.addPage()
  pdfHeader(doc, W, ML, MR, nombre, 'Mini Radar - Diagnóstico IA')
  y = 45

  // Fortalezas
  sectionLabel(doc, 'LO QUE MAS DESTACAN DE VOSOTROS', y, ML)
  y += 12
  doc.setTextColor(...SLATE_700)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const fortalezas = analisis?.fortalezas ?? []
  if (fortalezas.length === 0) {
    doc.setTextColor(...SLATE_500)
    doc.text(safe('Sin datos suficientes.'), ML, y)
    y += 8
  } else {
    for (const f of fortalezas) {
      const lines = wrapText(doc, `- ${f}`, CW - 4)
      doc.setTextColor(...GREEN)
      doc.setFont('helvetica', 'bold')
      doc.text('+', ML, y)
      doc.setTextColor(...SLATE_700)
      doc.setFont('helvetica', 'normal')
      doc.text(lines, ML + 5, y)
      y += lines.length * 5 + 2
    }
    y += 4
  }

  // Debilidades
  sectionLabel(doc, 'LO QUE MAS SE QUEJAN', y, ML)
  y += 12
  const debilidades = analisis?.debilidades ?? []
  if (debilidades.length === 0) {
    doc.setTextColor(...SLATE_500)
    doc.text(safe('Sin datos suficientes.'), ML, y)
    y += 8
  } else {
    for (const d of debilidades) {
      const lines = wrapText(doc, `- ${d}`, CW - 4)
      doc.setTextColor(...RED)
      doc.setFont('helvetica', 'bold')
      doc.text('-', ML, y)
      doc.setTextColor(...SLATE_700)
      doc.setFont('helvetica', 'normal')
      doc.text(lines, ML + 5, y)
      y += lines.length * 5 + 2
    }
    y += 4
  }

  // Accion de la semana
  sectionLabel(doc, 'ACCIÓN CONCRETA PARA ESTA SEMANA', y, ML)
  y += 12
  const accion = analisis?.accion ?? 'Sin datos suficientes.'
  // Card destacada con accent indigo
  const accionLines = wrapText(doc, accion, CW - 10)
  const accionH = 10 + accionLines.length * 5
  doc.setDrawColor(...SLATE_200)
  doc.setFillColor(238, 242, 255) // indigo-50
  doc.setLineWidth(0.3)
  doc.roundedRect(ML, y, CW, accionH, 2, 2, 'FD')
  doc.setFillColor(...INDIGO)
  doc.rect(ML, y, 2.5, accionH, 'F')
  doc.setTextColor(...SLATE_900)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(accionLines, ML + 6, y + 7)
  y += accionH + 12

  // CTA cierre
  doc.setFillColor(...ATLANTIC)
  doc.roundedRect(ML, y, CW, 38, 3, 3, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(safe('Velacre automatiza todo esto'), ML + 8, y + 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(226, 232, 240)
  doc.text(
    safe(
      'Respuestas IA en 3 tonos, radar de competencia, panel de salud mensual y filtro de contenido crítico.',
    ),
    ML + 8,
    y + 20,
  )
  doc.setTextColor(...INDIGO)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(safe('info@velacre.com | velacre.com'), ML + 8, y + 30)
  doc.link(ML + 8, y + 26, 70, 6, { url: 'https://velacre.com' })

  // Footer en todas las paginas
  pdfFooter(doc, W, ML, MR)

  // Descarga
  const slug = slugify(nombre)
  const dateStamp = new Date().toISOString().slice(0, 10)
  doc.save(`mini-radar-${slug || 'negocio'}-${dateStamp}.pdf`)
}
