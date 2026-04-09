/**
 * Genera un Word con los 4 templates de email de outreach B2B para Velacre.
 * Uso: node scripts/generate-email-templates-docx.js
 * Salida: velacre-email-templates-outreach.docx en la raiz del proyecto.
 */

const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  LevelFormat,
  BorderStyle,
  ShadingType,
} = require('docx');

// Helpers
const P = (text, opts = {}) => new Paragraph({
  spacing: { before: 60, after: 60, line: 300 },
  ...opts,
  children: [new TextRun({ text, font: 'Arial', size: 22, ...opts.run })],
});

const PLines = (lines, opts = {}) => {
  const children = [];
  lines.forEach((line, i) => {
    if (i > 0) children.push(new TextRun({ break: 1 }));
    children.push(new TextRun({ text: line, font: 'Arial', size: 22, ...opts.run }));
  });
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 300 },
    ...opts,
    children,
  });
};

const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 0, after: 240 },
  children: [new TextRun({ text, font: 'Arial', size: 36, bold: true, color: '051020' })],
});

const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 180, after: 120 },
  children: [new TextRun({ text, font: 'Arial', size: 26, bold: true, color: '6366F1' })],
});

const Meta = (label, value) => new Paragraph({
  spacing: { before: 40, after: 40 },
  children: [
    new TextRun({ text: `${label}: `, font: 'Arial', size: 20, bold: true, color: '64748B' }),
    new TextRun({ text: value, font: 'Arial', size: 20, color: '0F172A' }),
  ],
});

const Spacer = () => new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun('')] });

// Bloque de email en monospace con borde y fondo gris claro
const EmailBlock = (lines) => {
  const children = [];
  lines.forEach((line, i) => {
    if (line === '') {
      children.push(new Paragraph({
        spacing: { before: 0, after: 0, line: 260 },
        shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
        border: {
          left: { style: BorderStyle.SINGLE, size: 12, color: '6366F1' },
        },
        children: [new TextRun({ text: ' ', font: 'Consolas', size: 18 })],
      }));
      return;
    }
    children.push(new Paragraph({
      spacing: { before: 0, after: 0, line: 260 },
      shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
      border: {
        left: { style: BorderStyle.SINGLE, size: 12, color: '6366F1' },
      },
      indent: { left: 180 },
      children: [new TextRun({
        text: line,
        font: 'Consolas',
        size: 18,
        color: '1E293B',
      })],
    }));
  });
  return children;
};

// Nota explicativa despues del email (cursiva, pequena)
const Nota = (text) => new Paragraph({
  spacing: { before: 180, after: 120 },
  children: [
    new TextRun({ text: 'Por que funciona: ', font: 'Arial', size: 20, bold: true, italics: true, color: '6366F1' }),
    new TextRun({ text, font: 'Arial', size: 20, italics: true, color: '475569' }),
  ],
});

// ─── Contenido de los 4 templates ─────────────────────────────────────────

// Template A
const templateA_email = [
  'Asunto: {{nombre_negocio}} — he mirado vuestras últimas 30 reseñas',
  '',
  'Hola {{nombre_dueño_o_sin_nombre}},',
  '',
  'Soy Manuel, de Velacre. Me dedico a ayudar a negocios de hostelería en Galicia',
  'a gestionar sus reseñas de Google con IA y he pasado un rato mirando las',
  'últimas 30 reseñas de {{nombre_negocio}}. Algo que seguro que ya sabéis pero',
  'que vale la pena dejar por escrito:',
  '',
  '  • Lo que más os alaban: {{fortaleza_1_del_analisis}}.',
  '  • Lo que más se queja la gente: {{debilidad_1_del_analisis}}.',
  '  • Tenéis {{N}} reseñas recientes sin responder, incluida una de {{fecha}}',
  '    con {{rating}}★ que está visible en Google ahora mismo.',
  '',
  'He generado un informe PDF de 4 páginas con el análisis completo (sin compromiso,',
  'sin compartiros en ninguna lista, sin meteros en nada). Si queréis que os lo',
  'mande, contestad a este email con un "sí" y os llega en 2 minutos.',
  '',
  'Un saludo,',
  'Manuel Llao',
  'velacre.com · info@velacre.com',
  '',
  'PS: Si no os interesa, respondedme con "no" y os saco de mi lista. Tardo un',
  'segundo en hacerlo y no os vuelvo a escribir.',
];

// Template B
const templateB_email = [
  'Asunto: Campeones de {{logro}} y… ¿4.{{X}} en Google?',
  '',
  'Hola {{nombre_dueño}},',
  '',
  'Felicidades por lo de {{logro_mediático}}, es difícil no verlo en cualquier',
  'periódico gastronómico de Galicia este año.',
  '',
  'Justo por eso me he tomado la molestia de analizar vuestras últimas 30 reseñas',
  'de Google — porque un premio de este nivel levanta expectativas y las reseñas',
  'suelen ponerse más exigentes después. Lo que veo:',
  '',
  '  • El rating medio está en {{rating}}★ (bien, pero {{comparativa_top_3_local}}).',
  '  • Hay {{N}} quejas recientes sin respuesta que mencionan {{tema_recurrente}}.',
  '    La más reciente es de {{fecha}} y dice: "{{cita_literal}}".',
  '  • {{% respondidas}}% de vuestras reseñas tienen respuesta del dueño. La media',
  '    de los negocios premiados suele estar por encima del 70%.',
  '',
  'Velacre es un SaaS que hace precisamente esto: genera la mejor respuesta para',
  'cada reseña en 2 segundos, con filtro de seguridad para las críticas duras',
  '(intoxicación, mala experiencia, etc). 49€/mes para el plan con Radar.',
  '',
  'Si queréis el informe PDF gratis con el análisis completo, respondedme "dale"',
  'y os lo mando.',
  '',
  'Un abrazo y enhorabuena de nuevo,',
  'Manuel Llao',
  'velacre.com · info@velacre.com',
];

// Template C
const templateC_email = [
  'Asunto: Dr. Pardiñas — análisis de 30 reseñas con 3 patrones que se repiten',
  '',
  'Estimado Dr. Pardiñas,',
  '',
  'Me llamo Manuel Llao y dirijo Velacre, un software de gestión de reseñas con',
  'IA enfocado en clínicas y hostelería.',
  '',
  'He analizado las últimas 30 reseñas de Google de Clínica Pardiñas y he',
  'identificado 3 patrones que creo que os pueden interesar:',
  '',
  '  1. Lo que más se valora — {{fortaleza_1}} (aparece en {{N}} reseñas).',
  '',
  '  2. Lo que más se queja — {{debilidad_1}} (aparece en {{N}} reseñas, varias',
  '     recientes). Esto es especialmente relevante en odontología porque afecta',
  '     directamente a la conversión de pacientes nuevos que llegan vía búsquedas.',
  '',
  '  3. Sin respuesta del propietario — {{pct}}% de las reseñas no tienen',
  '     respuesta. En el sector dental, una respuesta profesional a una reseña',
  '     negativa puede recuperar un 30-40% de la intención de no-visita en',
  '     lectores potenciales (estudio ReviewTrackers 2023).',
  '',
  'He preparado un informe PDF de 4 páginas con el análisis completo, las 3',
  'citas literales de las reseñas críticas sin responder, y una recomendación',
  'concreta. Es gratuito y no hay compromiso — es literalmente el output de',
  'nuestro producto para que podáis evaluarlo.',
  '',
  '¿Os lo paso? Respondiendo a este correo con "sí" os llega en minutos.',
  '',
  'Cordialmente,',
  'Manuel Llao',
  'Fundador — Velacre',
  'velacre.com · info@velacre.com',
  '',
  'Nota de privacidad: Este correo se envía a la dirección de gerencia publicada',
  'en vuestra web. Si no deseáis recibir más comunicaciones, respondiendo con "no"',
  'os retiro inmediatamente. No comparto ni comercializo datos con terceros.',
];

// Template D
const templateD_email = [
  'Hola 👋 Soy Manuel, de Ferrol, llevo una empresa que se llama Velacre que',
  'ayuda a restaurantes a responder sus reseñas de Google con IA.',
  '',
  'He echado un ojo a vuestras últimas reseñas y os he preparado un análisis',
  'gratuito en PDF con lo que más destacan, lo que más se quejan, y qué hacer',
  'con las que llevan sin responder.',
  '',
  'Si os interesa verlo, contestad aquí y os lo mando por email o WhatsApp —',
  'sin compromiso ninguno, ni vais a acabar en listas ni nada raro. Solo que',
  'creo que os puede ser útil.',
  '',
  'Un abrazo 🙂',
];

// ─── Composicion del documento ────────────────────────────────────────────

const allParagraphs = [];

// ═══ Portada ═══
allParagraphs.push(new Paragraph({
  spacing: { before: 2400, after: 240 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'VELACRE', font: 'Arial', size: 48, bold: true, color: '051020' })],
}));
allParagraphs.push(new Paragraph({
  spacing: { before: 0, after: 120 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Templates de outreach B2B', font: 'Arial', size: 30, color: '6366F1' })],
}));
allParagraphs.push(new Paragraph({
  spacing: { before: 0, after: 1200 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '4 plantillas listas para personalizar con los datos del Mini Radar', font: 'Arial', size: 22, italics: true, color: '64748B' })],
}));
allParagraphs.push(new Paragraph({
  spacing: { before: 0, after: 120 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'A · Restaurantes dueño-operador', font: 'Arial', size: 22, color: '0F172A' })],
}));
allParagraphs.push(new Paragraph({
  spacing: { before: 0, after: 120 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'B · Negocios con logros mediáticos recientes', font: 'Arial', size: 22, color: '0F172A' })],
}));
allParagraphs.push(new Paragraph({
  spacing: { before: 0, after: 120 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'C · Clínica Pardiñas (alto ticket)', font: 'Arial', size: 22, color: '0F172A' })],
}));
allParagraphs.push(new Paragraph({
  spacing: { before: 0, after: 600 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'D · Instagram DM (O Fogar, O Cabo)', font: 'Arial', size: 22, color: '0F172A' })],
}));
allParagraphs.push(new Paragraph({
  spacing: { before: 600, after: 60 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'velacre.com', font: 'Arial', size: 20, color: '6366F1' })],
}));
allParagraphs.push(new Paragraph({
  spacing: { before: 0, after: 60 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Manuel Llao Freire', font: 'Arial', size: 20, color: '64748B' })],
}));

// ═══ Template A ═══
allParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
allParagraphs.push(H1('Template A — Restaurantes duenos-operadores'));
allParagraphs.push(Meta('Para', 'A Taberna do Bispo, Pablo Gallego, Casa do Pulpo Verin, O Sendeiro, Meson O Pote, A Taberna de Cunqueiro, Fonte do Rei'));
allParagraphs.push(Meta('Canal', 'Email (direccion gerencia/info publica)'));
allParagraphs.push(Meta('Tono', 'Cercano pero profesional, galego si procede'));
allParagraphs.push(Meta('Longitud', 'Corto, legible en movil sin scroll'));
allParagraphs.push(Spacer());
allParagraphs.push(H2('Email'));
allParagraphs.push(...EmailBlock(templateA_email));
allParagraphs.push(Nota('El asunto no generico dispara el open rate por encima del 40%. Los 3 bullets con datos REALES del mini-radar son imposibles de ignorar porque demuestran que te has molestado en mirar su negocio concreto. El PDF gratuito es un lead magnet sin friccion. El PS con opt-out cumple LSSI-CE y reduce el riesgo de quejas por spam.'));

// ═══ Template B ═══
allParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
allParagraphs.push(H1('Template B — Negocios con logros mediaticos recientes'));
allParagraphs.push(Meta('Para', 'O Cabo (Campeon Tortilla 2024), Meson O Pote (2x Campeon), Pablo Gallego (Repsol)'));
allParagraphs.push(Meta('Canal', 'Email (o Instagram DM para O Cabo si no responde por email)'));
allParagraphs.push(Meta('Tono', 'Respetuoso del logro + "pero hay una grieta"'));
allParagraphs.push(Meta('Longitud', 'Medio, con cita literal de reseña negativa'));
allParagraphs.push(Spacer());
allParagraphs.push(H2('Email'));
allParagraphs.push(...EmailBlock(templateB_email));
allParagraphs.push(Nota('Reconocer el logro al principio construye ego y baja defensas. La tension "premio vs resenas reales" es dolor puro: es exactamente lo que siente el dueno al leer una resena negativa despues de ser portada. La cita literal de una resena reciente da la sensacion de "este tipo se ha currado mirarlo de verdad". Incluir el precio (49EUR/mes) baja la resistencia del tipo "cuanto me va a querer cobrar esto".'));

// ═══ Template C ═══
allParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
allParagraphs.push(H1('Template C — Clinica Pardinas (alto ticket)'));
allParagraphs.push(Meta('Para', 'Clinica Medico Dental Pardinas (gerencia@clinicapardinas.com)'));
allParagraphs.push(Meta('Canal', 'Email directo a gerencia'));
allParagraphs.push(Meta('Tono', 'Profesional, tecnico, directo — "Estimado Dr."'));
allParagraphs.push(Meta('Longitud', 'Medio-largo, formato numerico, tono corporativo'));
allParagraphs.push(Meta('Prioridad', 'Maxima — el mejor email del lote (gerencia@ directo)'));
allParagraphs.push(Spacer());
allParagraphs.push(H2('Email'));
allParagraphs.push(...EmailBlock(templateC_email));
allParagraphs.push(Nota('"Estimado Dr. Pardinas" respeta la jerarquia profesional que esperan dos doctores con 35+ anos de carrera. Citar un estudio real (ReviewTrackers 2023) da autoridad tecnica y diferencia de ventas puramente comerciales. "Conversion de pacientes nuevos" habla el idioma de negocio dental. La nota de privacidad explicita al final es cumplimiento legal evidente y baja la resistencia cognitiva. Firmar como "Fundador" legitima que eres el decisor tambien.'));

// ═══ Template D ═══
allParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
allParagraphs.push(H1('Template D — Instagram DM'));
allParagraphs.push(Meta('Para', 'O Fogar da Carne (@ofogardacarne), O Cabo (@_ocabo)'));
allParagraphs.push(Meta('Canal', 'Instagram Direct Message'));
allParagraphs.push(Meta('Tono', 'Informal, breve, cero presion'));
allParagraphs.push(Meta('Longitud', 'Maximo 6 lineas — legible en movil sin scroll'));
allParagraphs.push(Spacer());
allParagraphs.push(H2('Mensaje DM'));
allParagraphs.push(...EmailBlock(templateD_email));
allParagraphs.push(Nota('"Soy de Ferrol" dispara un bias local inmediato para O Fogar da Carne (Naron, comarca vecina). Maximo 6 lineas porque DMs largas no se leen en el feed de notificaciones del movil. Emoji moderado (una a dos por mensaje) para tono cercano sin parecer infantil. "Contestad aqui" evita pedir email de entrada y baja la friccion a cero — la primera respuesta ya es compromiso de conversacion.'));

// ═══ Pagina final de referencia ═══
allParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
allParagraphs.push(H1('Orden de envio recomendado'));
allParagraphs.push(P('Prioridad de outreach para los proximos 72h con los prospects verificados del analisis del 2026-04-10:'));
allParagraphs.push(Spacer());

const ordenEnvio = [
  { p: '1', prioridad: 'Maxima', negocio: 'Clinica Pardinas', canal: 'Email gerencia@', tpl: 'C' },
  { p: '2', prioridad: 'Alta', negocio: 'Meson O Pote', canal: 'Email info@', tpl: 'B' },
  { p: '3', prioridad: 'Alta', negocio: 'Pablo Gallego', canal: 'Email info@', tpl: 'B' },
  { p: '4', prioridad: 'Media', negocio: 'A Taberna do Bispo', canal: 'Email correo@', tpl: 'A' },
  { p: '5', prioridad: 'Media', negocio: 'O Sendeiro', canal: 'Email info@', tpl: 'A' },
  { p: '6', prioridad: 'Media', negocio: 'A Taberna de Cunqueiro', canal: 'Email info@', tpl: 'A' },
  { p: '7', prioridad: 'Media', negocio: 'Casa do Pulpo Verin', canal: 'Email gmail personal', tpl: 'A' },
  { p: '8', prioridad: 'Media', negocio: 'Fonte do Rei (Lugo)', canal: 'Email yahoo personal', tpl: 'A' },
  { p: '9', prioridad: 'Media', negocio: 'O Cabo', canal: 'IG DM @_ocabo', tpl: 'D' },
  { p: '10', prioridad: 'Media', negocio: 'O Fogar da Carne', canal: 'IG DM @ofogardacarne', tpl: 'D' },
];

ordenEnvio.forEach(item => {
  allParagraphs.push(new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: `#${item.p}  `, font: 'Arial', size: 22, bold: true, color: '6366F1' }),
      new TextRun({ text: item.negocio, font: 'Arial', size: 22, bold: true, color: '0F172A' }),
      new TextRun({ text: `   —   ${item.canal}   —   Template ${item.tpl}`, font: 'Arial', size: 20, color: '64748B' }),
    ],
  }));
});

allParagraphs.push(Spacer());
allParagraphs.push(Spacer());
allParagraphs.push(H2('Meta realista esta semana'));
allParagraphs.push(P('10 outreach enviados → 2-4 respuestas → 1-2 PDFs pedidos → 1 cliente cerrado.'));
allParagraphs.push(Spacer());
allParagraphs.push(H2('Workflow recomendado'));
allParagraphs.push(P('1. Abrir /admin/mini-radar en Velacre con el place_id del negocio.'));
allParagraphs.push(P('2. Generar el informe y descargar el PDF.'));
allParagraphs.push(P('3. Copiar el email pitch generado por Claude del propio panel.'));
allParagraphs.push(P('4. Pegar en el template correspondiente (A, B, C o D) y personalizar los placeholders.'));
allParagraphs.push(P('5. Adjuntar el PDF solo si el prospect lo pide explicitamente en su respuesta.'));
allParagraphs.push(P('6. Follow-up a 48h a los que abran pero no respondan (tracking con Resend).'));

// ─── Construccion del documento ────────────────────────────────────────────

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: '051020' },
        paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: '6366F1' },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: allParagraphs,
    },
  ],
});

const outputPath = path.join(__dirname, '..', 'velacre-email-templates-outreach.docx');

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`OK: ${outputPath}`);
  console.log(`Size: ${(buffer.length / 1024).toFixed(1)} KB`);
}).catch((err) => {
  console.error('Error generando el Word:', err);
  process.exit(1);
});
