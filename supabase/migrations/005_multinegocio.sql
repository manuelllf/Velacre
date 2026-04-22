-- ─────────────────────────────────────────────────────────────────────────
-- 005_multinegocio.sql
-- Soporte multi-local por usuario.
--
-- El schema ya permitía N negocios por usuario (negocio.idusuario sin UNIQUE);
-- esta migración añade:
--   · usuario.locales_contratados — slots del plan (Pro+N)
--   · negocio.estado              — ciclo de vida (activo / oculto_usuario / deshabilitado_plan)
--   · negocio.es_principal        — flag del "local principal" elegido por el usuario
--   · RPC try_create_negocio      — creación atómica con check de slot + set es_principal en el 1º
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Slots contratados por usuario. Por defecto 1 (Basic/Core/Pro base).
--    Cuando existan variants Pro+N, el webhook subscription_updated lo sube.
ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS locales_contratados SMALLINT NOT NULL DEFAULT 1;

-- 2. Ciclo de vida del negocio.
--    - activo:               visible y operativo
--    - oculto_usuario:       borrado soft por el usuario (conserva historial para posible restore)
--    - deshabilitado_plan:   el plan actual ya no cubre este slot (downgrade); read-only
ALTER TABLE negocio
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'activo'
  CHECK (estado IN ('activo', 'oculto_usuario', 'deshabilitado_plan'));

-- 3. Local principal explícito (elegido por el usuario).
--    Solo puede haber 1 principal por usuario (unique partial index).
ALTER TABLE negocio
  ADD COLUMN IF NOT EXISTS es_principal BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_negocio_principal_por_usuario
  ON negocio (idusuario) WHERE es_principal = TRUE;

-- 3.1. Migración de datos: para cada usuario con al menos 1 negocio, el más antiguo
--      pasa a ser es_principal = TRUE (replica la convención "primario = el más viejo").
UPDATE negocio n
   SET es_principal = TRUE
  FROM (
    SELECT DISTINCT ON (idusuario) id
      FROM negocio
     WHERE idusuario IS NOT NULL
     ORDER BY idusuario, creadofecha ASC
  ) first_per_user
 WHERE n.id = first_per_user.id
   AND n.es_principal = FALSE;

-- 4. RPC atómica: check slot + insert + set es_principal si es el primero del usuario.
--    Evita race condition si dos requests paralelos crean locales al mismo tiempo.
--    Para usuarios Pro, p_unlimited=true bypasa el tope (hasta que existan
--    variants de volumen).
CREATE OR REPLACE FUNCTION try_create_negocio(
  p_user_id        UUID,
  p_codigo         TEXT,
  p_nombre         TEXT,
  p_email          TEXT,
  p_telefono       TEXT,
  p_descripcion    TEXT,
  p_tono           TEXT,
  p_palabras_clave TEXT[],
  p_unlimited      BOOLEAN DEFAULT FALSE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_active INT;
  v_max_slots      INT;
  v_total          INT;
  v_new_id         UUID;
  v_set_principal  BOOLEAN;
BEGIN
  -- Lock la fila del usuario para serializar creaciones concurrentes.
  SELECT locales_contratados INTO v_max_slots
    FROM usuario
   WHERE id = p_user_id
   FOR UPDATE;

  IF v_max_slots IS NULL THEN
    RAISE EXCEPTION 'usuario_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Solo los negocios en estado 'activo' cuentan para el slot.
  SELECT COUNT(*) INTO v_current_active
    FROM negocio
   WHERE idusuario = p_user_id
     AND estado = 'activo';

  IF NOT p_unlimited AND v_current_active >= v_max_slots THEN
    RAISE EXCEPTION 'slot_limit_reached: % of %', v_current_active, v_max_slots
      USING ERRCODE = 'P0001';
  END IF;

  -- ¿Es el primer negocio del usuario (considerando todos los estados)? → es_principal=TRUE.
  SELECT COUNT(*) INTO v_total
    FROM negocio
   WHERE idusuario = p_user_id;
  v_set_principal := (v_total = 0);

  INSERT INTO negocio (
    id, codigo, nombre, email, telefono, descripcion,
    tonopredefinido, palabras_clave, idusuario, creadopor, creadofecha,
    estado, es_principal
  ) VALUES (
    gen_random_uuid(), p_codigo, p_nombre, p_email, p_telefono, p_descripcion,
    p_tono, p_palabras_clave, p_user_id, p_user_id, now(),
    'activo', v_set_principal
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION try_create_negocio IS
  'Crea un negocio validando slot disponible. p_unlimited=true para Pro mientras no haya variants de volumen.';

GRANT EXECUTE ON FUNCTION try_create_negocio TO authenticated, service_role;

-- 5. RPC para cambiar el principal en una transacción (unset anterior + set nuevo).
CREATE OR REPLACE FUNCTION set_negocio_principal(
  p_user_id    UUID,
  p_negocio_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar ownership
  IF NOT EXISTS (
    SELECT 1 FROM negocio
     WHERE id = p_negocio_id
       AND idusuario = p_user_id
       AND estado = 'activo'
  ) THEN
    RAISE EXCEPTION 'negocio_not_found_or_inactive' USING ERRCODE = 'P0002';
  END IF;

  UPDATE negocio SET es_principal = FALSE
   WHERE idusuario = p_user_id AND es_principal = TRUE;

  UPDATE negocio SET es_principal = TRUE
   WHERE id = p_negocio_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_negocio_principal TO authenticated, service_role;
