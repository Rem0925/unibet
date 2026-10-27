# UniBet — Mercados de predicción pari-mutuel en USDT

Aplicación web de apuestas sociales para un círculo cerrado: los usuarios crean mercados de predicción, apostan USDT a una opción y el **100% del pozo** se reparte entre quienes acertaron. Recargas y retiros con **Binance Pay**, perfiles y autenticación con **Supabase**, y toda la lógica de dinero ejecutándose en PostgreSQL con funciones `SECURITY DEFINER`.

> ⚠️ **Aviso legal y de riesgo.** UniBet es software libre (licencia MIT) provisto **tal cual, sin garantía de ningún tipo**. Operar una plataforma de apuestas está regulado o prohibido en muchas jurisdicciones: verificar y cumplir la normativa local (licencias, KYC/AML, impuestos) es responsabilidad exclusiva de quien la despliegue y opere. El software no promueve el juego como fuente de ingresos; la cuota del juego es el pozo compartido entre los propios usuarios, y la casa solo cobra 3% al recargar. Usa montos pequeños y con fines recreativos.
>
> ⚠️ **Dinero real.** Esta app mueve USDT reales. Revísala, ejecuta el esquema SQL completo y prueba los flujos de Binance con montos pequeños antes de abrirla a usuarios.

## Reglas del sistema

| Regla | Detalle |
| :--- | :--- |
| Pari-mutuel | Multiplicador = pozo total / pozo de la opción. La casa no paga de su bolsillo. |
| Comisión única | **3% solo al recargar** (credita al admin activo como `FEE_DEPOSIT`). 0% en apuestas y retiros. |
| Batacazo huérfano | Si gana una opción sin apuestas: **70% casa / 30% creador** del mercado. |
| Límites | Apuesta 0.50–500 · **Tope de 150 USDT activos por persona y mercado** · Depósito 1–1000 · Retiro 1–200 USDT · 2–10 opciones · máx. 365 días. |
| Reconciliación | Retiros inciertos y depósitos con webhook perdido se revisan en el panel admin: verificación contra Binance (`order/query`), acreditación idempotente o cierre sin pagar. |
| Roles | `ADMIN` (finanzas + todo), `MODERATOR` (cierra/liquida/cancela, **sin acceso a finanzas**), `USER`. |
| Auditoría | Toda acción de staff queda en `audit_logs`; los retiros inciertos se concilian en el panel admin. |

## Stack

- **Next.js 16** (App Router, React 19, TypeScript) + **Tailwind CSS v4**
- **Supabase** (Postgres + Auth: Google OAuth y Magic Link)
- **Binance Pay** (orden de depósito, webhook RSA-SHA256, payout por UID)
- **decimal.js** para aritmética de dinero, **Zod** para validación, **Vitest** para pruebas

## Puesta en marcha

### 1. Instalar y configurar entorno

```bash
npm install
cp .env.example .env.local
# Completa las variables (ver comentarios del archivo)
```

Variables requeridas:

| Variable | Origen |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API. **Solo servidor, nunca al navegador.** |
| `BINANCE_PAY_API_KEY` / `BINANCE_PAY_API_SECRET` | Binance Merchant Portal |
| `BINANCE_PAY_CERT_SN` / `BINANCE_PAY_PUBLIC_KEY` | Opcional: fija el certificado para webhooks |
| `NEXT_PUBLIC_APP_URL` | URL pública exacta (HTTPS en producción) |

En Supabase Auth → URL Configuration: define el Site URL y agrega tu dominio (y `http://localhost:3000` en desarrollo) a Redirect URLs. Habilita el proveedor Google si lo vas a usar.

### 2. Ejecutar el esquema de base de datos

Ejecuta **todo** `schema.sql` en el SQL Editor de Supabase. El script es idempotente: puede re-ejecutarse para actualizar funciones/políticas sin perder datos y también **actualiza bases de datos antiguas** (añade columnas faltantes y reemplaza CHECKs heredados).

Después asigna el primer administrador:

```sql
UPDATE public.users SET role = 'ADMIN' WHERE email = 'tu-correo@gmail.com';
```

(El perfil se crea automáticamente cuando la persona inicia sesión por primera vez, así que primero entra a la app y luego ejecuta el UPDATE.)

### 3. Configurar Binance Pay

En el Merchant Portal configura el webhook:

```
https://tu-dominio.com/api/webhooks/binance
```

Evento requerido: `PAY_SUCCESS`. Los depósitos nacen como transacción `PENDING` con un `reference_id` que viaja como `merchantTradeNo`; el webhook lo valida (RSA-SHA256) y acredita el 97% de forma idempotente.

### 4. Desarrollo

```bash
npm run dev     # http://localhost:3000
npm run lint    # ESLint
npx tsc --noEmit
npm test        # Vitest (motor de cuotas + esquemas Zod)
npm run build   # build de producción
```

## Despliegue

1. **Supabase:** proyecto con `schema.sql` aplicado + primer admin asignado.
2. **Vercel (o similar):** importa el repo y define las variables de entorno en producción. `NEXT_PUBLIC_APP_URL` debe apuntar al dominio final.
3. **Binance Pay:** actualiza la URL del webhook al dominio de producción.
4. Verifica tras el primer deploy: cabeceras de seguridad (`curl -I`), login real, un depósito de prueba y su webhook, un retiro de prueba.

## Estructura relevante

```
schema.sql                  # DDL, RLS, triggers, RPCs de dinero, migración de DBs antiguas
src/app/api/                # Route handlers (auth Bearer + Zod + rate limit)
src/lib/server/             # auth, rpc, audit, rate-limit, service-role client
src/lib/odds.ts             # Motor pari-mutuel (decimal.js)
src/lib/security.ts         # Esquemas de validación estrictos
src/components/             # UI: Terminal, MarketCard, BetSlip, Wallet, Admin…
src/lib/__tests__/          # Pruebas unitarias (Vitest)
```

### Decisiones de seguridad clave

- El navegador usa Supabase solo con la anon key y RLS; **todo movimiento de dinero pasa por `/api/*` con token Bearer** y se ejecuta en RPCs `SECURITY DEFINER` ejecutables únicamente por `service_role`.
- El webhook de Binance se valida con RSA-SHA256 contra los certificados públicos de Binance (seleccionados por `Binancepay-Certificate-SN`) y es idempotente.
- Un retiro rechazado por Binance se reembolsa automáticamente sin comisión; si el resultado es incierto queda `PENDING` para reconciliación del admin.
- Los moderadores no pueden ver saldos, métricas de la casa ni aprobar retiros.
