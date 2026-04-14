/**
 * Lee backend/.env y devuelve las claves necesarias.
 * Soporta comentarios (#), líneas vacías y valores entre comillas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, '..', '..', '..', 'backend', '.env');

export function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`No encuentro ${ENV_PATH}. ¿Está configurado el backend?`);
  }
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function requireKeys(env, keys) {
  const missing = keys.filter(k => !env[k]);
  if (missing.length) {
    throw new Error(`Faltan claves en backend/.env: ${missing.join(', ')}`);
  }
}
