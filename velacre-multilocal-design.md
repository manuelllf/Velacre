# Velacre — Diseño multi-local

> **Fase 1 implementada** (rama `20260422_multinegocio`): infraestructura 1:N usuario→negocio, provider, dropdown, ocultos, restore, principal, scope header. Ver `velacre-context.md` §7.
> **Fase 2 pendiente** (este doc): billing por volumen en LS, gate real de slots, webhook de downgrade/upgrade. Congelar hasta tener primer cliente Pro cerrado (o 2º cliente multi-local intent).

---

## ⚠️ Agujero de ingresos abierto — cerrar antes del primer cliente Pro

**Estado actual (placeholder):** `NegocioController.CreateNegocio` llama a `try_create_negocio` con `p_unlimited = esProEfectivo`. Esto significa que cualquier usuario Pro (€49) puede crear locales ilimitados **sin pagar un euro extra**.

**Por qué está así:** los variants Pro+N aún no existen en LS (ver §2). Sin variants, no hay manera de que el usuario pague el sobreprecio al añadir un local — y bloquearle sería peor UX que dejarle testear gratis. El bypass es consciente.

**Coste marginal por local extra en bolsillo de Velacre:** ≈ €5-7.50/mes (Outscraper cron diario + Claude Salud/Radar si usa). Multiplicado por N locales "regalados" = MRR perdido por cada local que el usuario añade sin pagar los €20 correspondientes.

**Riesgo hoy:** cero (0 clientes Pro reales). Riesgo en cuanto haya primer Pro cerrado: alto — basta que el dueño diga "tengo 3 sitios" y se los meta todos en una cuenta para que perdamos €40/mes × duración de suscripción.

**Cierre mecánico** (≈ 1 día efectivo cuando toque):
1. Crear los 4 variants en LS (§2).
2. Poblar env vars `LEMONSQUEEZY_VARIANT_ID_PRO_PLUS{1..4}_MONTHLY`.
3. Extender handler de webhook `subscription_updated` (§4.1.c): mapear `variant_id` → `usuario.locales_contratados` (1/2/3/4/5).
4. Añadir endpoint `POST /api/lemonsqueezy/change-locales` (§4.1.b) con PATCH de variant.
5. Cambiar `p_unlimited=esProEfectivo` por `p_unlimited=false` en `NegocioController.CreateNegocio`.
6. UI en Settings: modal "Pasar a Pro+N (+€20/mes)" cuando no cabe slot en lugar del 403 genérico.

**Checklist operacional:** cada vez que se cierre un Pro, verificar que tiene 1 solo local o que ha pagado el variant correspondiente. Hasta que esto esté automatizado, es vigilancia manual.

---

## Nota sobre este documento

Es un doc vivo. Fase 1 ya quedó obsoleta aquí abajo para efectos de "qué construir" (ya está construido), pero se mantiene como referencia del diseño. Lo que sigue activo son §2, §4.1.b, §4.1.c, §6, §7, §8, §9 de fase 2.

---

## 1. Decisiones de producto (tomadas)

- **Solo en plan Pro.** Core sigue siendo 1 local. Argumento: si tienes 2+ locales necesitas inteligencia competitiva sí o sí → el Radar justifica Pro.
- **Solo billing mensual.** El anual sigue siendo 1 local. Argumento: dueños con cadena pequeña prefieren flexibilidad mes a mes; el anual es para el operador puro de 1 local que quiere descuento. Son perfiles distintos, no pasa nada si no se solapan.
- **Incremento lineal: +€20/mes por local adicional.** Post-GBP revisar (+€25 o +€30, pendiente).
- **Cap comercial: 5 locales.** A partir de ahí → pricing custom / plan "Chains" en `velacre-context.md` §12.
- **Sin prorrateo manual.** LS prorratea automático al cambiar de variant.
- **Plan por usuario, no por local.** `usuario.plan` aplica a todos sus negocios por igual. No existe "local A Pro + local B Basic". Al comprar Pro+1, los 2 locales son Pro. Contador IA compartido entre todos los locales del usuario.
- **Panel Salud general (fase 2+):** agregación cross-local para dueños multi-local. KPIs globales, ranking entre los propios locales, diagnóstico IA comparativo ("patrón que brilla en A falta en B"), PDF benchmark unificado. Pendiente de diseño detallado.

---

## 2. Variants Lemon Squeezy a crear

Product en LS: "Velacre Pro" (el que ya existe). Variants a añadir:

| Variant name | Precio mensual | Var env |
|---|---|---|
| Pro (1 local) | €49 | `LEMONSQUEEZY_VARIANT_ID_PRO_MONTHLY` ← ya existe |
| Pro +1 local | €69 | `LEMONSQUEEZY_VARIANT_ID_PRO_PLUS1_MONTHLY` |
| Pro +2 locales | €89 | `LEMONSQUEEZY_VARIANT_ID_PRO_PLUS2_MONTHLY` |
| Pro +3 locales | €109 | `LEMONSQUEEZY_VARIANT_ID_PRO_PLUS3_MONTHLY` |
| Pro +4 locales | €129 | `LEMONSQUEEZY_VARIANT_ID_PRO_PLUS4_MONTHLY` |

**5 variants total** (1 base ya existe + 4 nuevos). Post-GBP subirán +€20 base cada uno.

---

## 3. Cambios en BD (Supabase)

### 3.1 `negocio` — ya soporta multi-local estructuralmente

- `idusuario UUID` — **ya existe y es nullable** (un usuario puede tener N negocios). No hace falta migración de schema en esta tabla.
- RLS de `negocio` ya usa `idusuario = auth.uid()` → el usuario ve todos sus negocios.
- RLS de tablas hijas (`review`, `analisis_ia`, `competidor`, `radar_analisis`) ya scope por `negocio_id IN (SELECT id FROM negocio WHERE idusuario = auth.uid())` → **ya multi-local compatible**.

**Conclusión:** BD no necesita migración para soportar multi-local. Solo la UI y la lógica de límites de plan.

### 3.2 `usuario` — campo nuevo para tracking de slots

```sql
ALTER TABLE usuario ADD COLUMN locales_contratados SMALLINT NOT NULL DEFAULT 1;
-- 1 = Pro base, 2 = Pro+1, etc. Se actualiza desde webhook LS subscription_updated.
```

Se deriva del `variant_id` activo pero guardarlo acelera checks de límite (no leer LS en cada request).

### 3.3 Nuevo check de límite

Antes de permitir `POST /api/negocio` (crear un local nuevo), backend comprueba:

```
COUNT(negocio WHERE idusuario = X) < usuario.locales_contratados
```

Si no cumple → 403 con mensaje "Tienes N locales contratados. Añade otro en Settings o contrata un slot más."

---

## 4. Cambios en Backend (.NET)

### 4.1 `LemonController.cs`

**a) Expand switch de variant lookup** (L42-49). Añadir soporte para parámetro `locales_extra`:

```csharp
var envKey = (plan, billing, localesExtra) switch
{
    ("pro", "monthly", 0) => "LEMONSQUEEZY_VARIANT_ID_PRO_MONTHLY",
    ("pro", "monthly", 1) => "LEMONSQUEEZY_VARIANT_ID_PRO_PLUS1_MONTHLY",
    ("pro", "monthly", 2) => "LEMONSQUEEZY_VARIANT_ID_PRO_PLUS2_MONTHLY",
    ("pro", "monthly", 3) => "LEMONSQUEEZY_VARIANT_ID_PRO_PLUS3_MONTHLY",
    ("pro", "monthly", 4) => "LEMONSQUEEZY_VARIANT_ID_PRO_PLUS4_MONTHLY",
    // Core y yearly no cambian
    ("core", "yearly", _) => "LEMONSQUEEZY_VARIANT_ID_CORE_YEARLY",
    ("core", _, _)        => "LEMONSQUEEZY_VARIANT_ID_CORE_MONTHLY",
    ("pro",  "yearly", _) => "LEMONSQUEEZY_VARIANT_ID_PRO_YEARLY",
    _                     => ""
};
```

**Validación:** si `plan != "pro"` o `billing != "monthly"`, forzar `localesExtra = 0` antes del switch (ignorar silenciosamente, no error). Evita que un usuario en Core/anual llegue por accidente con `?locales_extra=2`.

**b) Endpoint nuevo: swap de variant in-place.**

```
POST /api/lemonsqueezy/change-locales
Body: { locales: 2 }   // total absoluto, no delta
```

Llama a:
```
PATCH https://api.lemonsqueezy.com/v1/subscriptions/{subscription_id}
Body: {
  "data": {
    "type": "subscriptions",
    "id": "{subscription_id}",
    "attributes": {
      "variant_id": <variant_id_correspondiente>,
      "invoice_immediately": true   // opcional: cobra ahora la diferencia
    }
  }
}
```

LS prorratea automático. **No crea segunda suscripción.** Es el mismo `subscription_id` con variant cambiada.

**c) Webhook handler — `subscription_updated`.**

El handler actual ya existe en `LemonController.cs` (grep por `variant_id` L293). Necesita:

1. Mapear `variant_id` recibido → `locales_contratados` (1-5).
2. Actualizar `usuario.locales_contratados`.
3. **Caso borde crítico:** si el nuevo valor es menor que los negocios actuales del usuario (ej. tiene 3 locales activos y se baja a Pro+1 = 2 slots), NO borrar negocios automáticamente. Marcar uno como "deshabilitado" (campo nuevo `negocio.deshabilitado BOOLEAN`) y enviar email al usuario para que decida cuál desactivar. El último editado gana. Mientras tanto, el de ID más antiguo queda activo por defecto, el resto read-only en dashboard.

### 4.2 `NegocioController.cs`

- `POST /api/negocio` — añadir check de slot disponible antes de insertar.
- `GET /api/negocio` — devolver **lista** en vez de objeto único. Cuidado: hoy todo el código asume 1 negocio por usuario, hay que refactorizar callers.
- `DELETE /api/negocio/:id` — liberar slot al borrar (`locales_contratados` no cambia, pero el usuario podrá crear otro).

### 4.3 Concurrencia — guard rail

Race condition posible: usuario crea 2 negocios en paralelo con solo 1 slot. **Solución:** usar el patrón de la RPC `try_increment_ia_counter` (ver `velacre-context.md` §11). Crear `try_create_negocio(user_id, ...)` que hace check + insert en una transacción SQL atómica.

---

## 5. Cambios en Frontend (Next.js)

### 5.1 Settings — nueva sección "Locales"

`src/app/settings/page.tsx`:

- Lista de negocios del usuario con nombre, place_id, badge "Principal" en el primero.
- Botón "+ Añadir local" → solo visible si `plan === "pro" && billing === "monthly" && count < locales_contratados`.
- Si `count === locales_contratados`: CTA "Contratar otro local (+€20/mes)" → llama a `POST /api/lemonsqueezy/change-locales { locales: count+1 }`.
- Botón "Eliminar local" → modal de confirmación + opción de bajar slot contratado.

### 5.2 Dashboard — selector de local

Header del dashboard con dropdown "Local activo: [nombre]". Estado en `localStorage` + query param `?negocio=<id>` para compartir URLs.

Todas las queries React Query se keyean por `negocio_id`.

### 5.3 Onboarding — no cambia

El onboarding sigue creando el primer y único negocio. Multi-local se añade desde Settings **después**.

### 5.4 Panel Salud — scope por local

El panel actual asume 1 negocio. Hay que pasar `negocio_id` explícito a todas las llamadas de `/api/salud/*`. Análisis IA y Radar ya tienen `negocio_id` en el payload → OK.

### 5.5 PDF benchmark — opción "Todos los locales"

Generación combinada opcional: un PDF que agrega los N locales del usuario. Nice-to-have, no bloqueante.

---

## 6. Cambios en LS (admin manual)

1. Crear 4 variants nuevos del producto "Velacre Pro" con precios €69/€89/€109/€129.
2. Copiar sus IDs a variables de entorno en Railway (`LEMONSQUEEZY_VARIANT_ID_PRO_PLUS{1,2,3,4}_MONTHLY`).
3. Verificar que los webhooks llegan con los nuevos `variant_id`.
4. Si hay descuentos activos (VELFOUND20, 15% primeros clientes), aplicarlos a los nuevos variants también si queremos que el founding price se mantenga en multi-local.

---

## 7. Tests mínimos antes de activar

- [ ] Checkout de Pro+1 crea suscripción con variant correcta.
- [ ] Webhook `subscription_created` con variant Pro+1 pone `locales_contratados = 2`.
- [ ] Webhook `subscription_updated` al cambiar variant actualiza `locales_contratados`.
- [ ] `POST /api/negocio` respeta el límite de slots.
- [ ] Downgrade de Pro+2 a Pro con 2 locales activos marca el segundo como `deshabilitado` y NO lo borra.
- [ ] `try_create_negocio` es atómico bajo concurrencia (test con 2 requests paralelas).
- [ ] RLS sigue aislando locales entre usuarios (ya lo hace, pero re-verificar con 2 usuarios × 2 locales).

---

## 8. Lo que NO hacer (trampas conocidas)

- **NO crear una segunda suscripción por cada local extra.** Es la opción C descartada — dos ciclos de facturación desincronizados, posibilidad de que el cliente cancele una y no la otra. Todo va en **una sola suscripción con variant cambiada**.
- **NO abandonar LS para facturar "por fuera" con gestoría.** Análisis en conversación del 2026-04-22: perderías MoR (IVA automático), portal cliente, absorción de chargebacks e impagos. Coste fijo gestoría €80-150/mes + RETA vs medio día de código. No merece la pena.
- **NO replicar multi-local en Core ni en anual** sin re-discutir la decisión de producto de §1. Duplicaría el número de variants a mantener.
- **NO borrar negocios automáticamente en downgrade.** Siempre marcar `deshabilitado` + email al usuario. Borrado destructivo fuera del control del usuario = pérdida de datos de reseñas históricas.
- **NO asumir "1 usuario = 1 negocio"** en código nuevo. El schema ya permite N, pero el código frontend/backend actual lo asume en muchos sitios. Cualquier feature nueva debe aceptar `negocio_id` explícito.

---

## 9. Esfuerzo estimado

- Backend: 1 día (switch, endpoint swap, webhook update, `try_create_negocio` RPC).
- Frontend: 1-2 días (Settings, selector dashboard, refactor callers que asumen 1 negocio).
- LS admin: 30 min.
- Tests: 0.5 días.
- **Total: 3-4 días efectivos.**

Cuando llegue el primer cliente con 2 locales: puede gestionarse **manual** (variant ad-hoc + email) hasta tener 3 casos reales. Activar esta feature con 1 solo cliente es over-engineering.
