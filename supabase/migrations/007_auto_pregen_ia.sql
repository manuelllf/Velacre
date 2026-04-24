-- 007_auto_pregen_ia.sql
-- Flag opt-in a nivel usuario para que el cron nocturno de sync pre-genere
-- respuestas IA automáticamente en cada reseña nueva. Default FALSE para
-- todos los planes (incluido Pro — el usuario decide activarlo en Settings).
--
-- Comportamiento esperado en CronController.SyncAll tras la migration:
--   · Basic  → ignora el flag (el cap 10 IA/mes es barrera deliberada)
--   · Core   → si flag=TRUE, pre-genera respetando cupo 25 IA/mes vía
--              try_increment_ia_counter. Si se agota el cupo a mitad del
--              batch, el resto queda como pendiente "Generar" manual.
--   · Pro    → si flag=TRUE, pre-genera sin límite práctico (cap soft 250).

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS auto_pre_gen_ia BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN usuario.auto_pre_gen_ia IS
  'Opt-in para pre-generación IA automática en el cron nocturno. Default FALSE. Basic ignora siempre (cap 10 IA). Core/Pro pueden activarlo en Settings.';
