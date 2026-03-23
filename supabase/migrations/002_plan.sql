ALTER TABLE usuario ADD COLUMN IF NOT EXISTS plan text DEFAULT 'basic';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS respuestas_manuales_mes integer DEFAULT 0;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS respuestas_mes_reset timestamptz DEFAULT now();
-- Update existing active users to 'pro' for now (they're test users)
UPDATE usuario SET plan = 'pro' WHERE activo = true;
