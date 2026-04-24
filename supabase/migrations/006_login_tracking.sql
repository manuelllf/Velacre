-- 006_login_tracking.sql
-- Añade tracking de accesos a la app para medir "dueños que vuelven",
-- la métrica líder de salud del negocio (más predictiva que MRR pre-tracción).
--
-- El frontend hace POST /api/usuarios/me/heartbeat al entrar en
-- /dashboard o /inicio, y el backend incrementa el contador.

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS inicios_sesion INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_inicio_sesion TIMESTAMPTZ;

COMMENT ON COLUMN usuario.inicios_sesion IS
  'Contador acumulado de entradas a la app (dashboard/inicio/salud). Se incrementa vía POST /usuarios/me/heartbeat con rate-limit de 1/hora por usuario.';

COMMENT ON COLUMN usuario.ultimo_inicio_sesion IS
  'Timestamp del último acceso registrado. Para métrica de 7 días activos.';
