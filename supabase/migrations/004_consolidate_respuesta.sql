-- ============================================================================
-- Migración 004: Consolidar las 3 columnas de respuesta en una sola
-- Fecha: 2026-04-22
--
-- Contexto: histórico del proyecto tenía 3 columnas para soportar un flujo
-- antiguo donde se generaban los 3 tonos a la vez. Los nombres de columna son
-- además legacy de versiones aún anteriores ("colegueo" por cercano, "orgullosa"
-- por directo). Hoy solo se genera UNA respuesta según el tono_predefinido del
-- negocio, y las otras 2 columnas quedaban siempre vacías. Peor: en los paths
-- de sync desde Google se copiaba la misma owner_answer a las 3 columnas "por
-- si acaso el tono cambia" → triplicación absurda. Peor aún: la columna
-- "respuestaprofesional" hacía de catch-all para 4 de los 6 tonos (profesional,
-- empático, agradecido, humorístico) → el nombre de la columna mentía sobre su
-- contenido.
--
-- Solución: 1 columna "respuesta" + el campo "tono_generado" (ya existente) que
-- indica qué tono se usó. La identidad del tono va en metadata, no en schema.
--
-- Seguridad: sin tráfico real todavía, los datos que hay son de test. COALESCE
-- por si alguna fila tuviera datos en colegueo u orgullosa, aunque lo esperado
-- es que casi todo esté en respuestaprofesional.
-- ============================================================================

-- 1. Nueva columna consolidada
ALTER TABLE review ADD COLUMN respuesta TEXT;

-- 2. Migrar datos existentes (profesional → colegueo/cercano → orgullosa/directo)
UPDATE review
SET respuesta = COALESCE(respuestaprofesional, respuestacolegueo, respuestaorgullosa)
WHERE respuesta IS NULL
  AND (respuestaprofesional IS NOT NULL OR respuestacolegueo IS NOT NULL OR respuestaorgullosa IS NOT NULL);

-- 3. Drop columnas viejas
ALTER TABLE review DROP COLUMN respuestaprofesional;
ALTER TABLE review DROP COLUMN respuestacolegueo;
ALTER TABLE review DROP COLUMN respuestaorgullosa;
