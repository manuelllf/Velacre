-- ============================================================================
-- Migración 003: Row Level Security (RLS) para todas las tablas
-- Fecha: 2026-04-14
-- Contexto: R2 del plan de refactorización. Activa RLS y crea policies
--           que restringen acceso por auth.uid() / negocio del usuario.
--
-- IMPORTANTE: El backend usa service_role key, que bypassa RLS siempre.
--             Estas policies protegen contra acceso directo con anon key.
-- ============================================================================

-- ── 1. Activar RLS en las 7 tablas ──────────────────────────────────────────

ALTER TABLE usuario           ENABLE ROW LEVEL SECURITY;
ALTER TABLE negocio           ENABLE ROW LEVEL SECURITY;
ALTER TABLE review            ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE competidor        ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_analisis    ENABLE ROW LEVEL SECURITY;
ALTER TABLE analisis_ia       ENABLE ROW LEVEL SECURITY;

-- ── 2. Policies para USUARIO ────────────────────────────────────────────────
-- Cada usuario solo puede ver/modificar su propio perfil.

CREATE POLICY usuario_select_own ON usuario
  FOR SELECT USING (id = auth.uid());

CREATE POLICY usuario_update_own ON usuario
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY usuario_insert_own ON usuario
  FOR INSERT WITH CHECK (id = auth.uid());

-- ── 3. Policies para NEGOCIO ────────────────────────────────────────────────
-- Cada usuario solo accede al negocio que le pertenece.

CREATE POLICY negocio_select_own ON negocio
  FOR SELECT USING (idusuario = auth.uid());

CREATE POLICY negocio_insert_own ON negocio
  FOR INSERT WITH CHECK (idusuario = auth.uid());

CREATE POLICY negocio_update_own ON negocio
  FOR UPDATE USING (idusuario = auth.uid());

-- ── 4. Policies para REVIEW ────────────────────────────────────────────────
-- Reviews pertenecen al negocio del usuario (via idnegocio).

CREATE POLICY review_select_own ON review
  FOR SELECT USING (idnegocio IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

CREATE POLICY review_insert_own ON review
  FOR INSERT WITH CHECK (idnegocio IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

CREATE POLICY review_update_own ON review
  FOR UPDATE USING (idnegocio IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

CREATE POLICY review_delete_own ON review
  FOR DELETE USING (idnegocio IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

-- ── 5. Policies para GOOGLE_CONNECTION ─────────────────────────────────────

CREATE POLICY gc_select_own ON google_connection
  FOR SELECT USING (negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

CREATE POLICY gc_insert_own ON google_connection
  FOR INSERT WITH CHECK (negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

CREATE POLICY gc_update_own ON google_connection
  FOR UPDATE USING (negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

CREATE POLICY gc_delete_own ON google_connection
  FOR DELETE USING (negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

-- ── 6. Policies para COMPETIDOR ────────────────────────────────────────────

CREATE POLICY comp_select_own ON competidor
  FOR SELECT USING (negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

CREATE POLICY comp_insert_own ON competidor
  FOR INSERT WITH CHECK (negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

CREATE POLICY comp_delete_own ON competidor
  FOR DELETE USING (negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

-- ── 7. Policies para RADAR_ANALISIS ────────────────────────────────────────

CREATE POLICY ra_select_own ON radar_analisis
  FOR SELECT USING (negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

CREATE POLICY ra_insert_own ON radar_analisis
  FOR INSERT WITH CHECK (negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

CREATE POLICY ra_delete_own ON radar_analisis
  FOR DELETE USING (negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

-- ── 8. Policies para ANALISIS_IA ───────────────────────────────────────────

CREATE POLICY aia_select_own ON analisis_ia
  FOR SELECT USING (negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));

CREATE POLICY aia_insert_own ON analisis_ia
  FOR INSERT WITH CHECK (negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid()));
