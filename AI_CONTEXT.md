# AI_CONTEXT.md — Contexto Maestro del Proyecto UniBet

> **Para cualquier modelo de IA o asistente de código (Claude, Cursor, Copilot, ChatGPT, Gemini):**
> Este documento contiene el propósito, las decisiones de arquitectura, las reglas financieras, el modelo de datos y las pautas técnicas de este repositorio. Léelo antes de sugerir o implementar cualquier cambio.

---

## 1. Visión General del Proyecto

* **Nombre:** **UniBet**
* **Objetivo:** Plataforma web de mercados de predicción social (pari-mutuel) para un círculo cerrado y recreativo de amigos universitarios en Venezuela.
* **Problema que resuelve:** Operar apuestas con bolívares (VES) mediante cuentas bancarias personales acarrea riesgos de bloqueo por Sudeban, requerimientos de licencias y devaluación inflacionaria.
* **Solución de pagos:** La plataforma opera **100% en USDT** con **Binance Pay**. Los usuarios cambian bolívares a USDT por su cuenta (Binance P2P, El Dorado) y entran/salen de la app con su **Binance UID** (payout directo, sin comisión de retiro).
* **Estado:** Producción-ready. No hay datos demo, ni botones de trampa, ni bypass de autenticación. Probarlo end-to-end requiere credenciales reales de Supabase y Binance en `.env.local`.

---

## 2. Modelo Matemático y Reglas Financieras (INVARIABLES)

El sistema **NO** es una casa de apuestas con cuotas fijas. Es **Pari-Mutuel (pozo mutuo)**:

```
[Dinero de los Apostadores] ──► [Pozo del Mercado] ──► [Reparto íntegro a los ganadores]
```

### A. Cuotas vivas
* Multiplicador de la opción X = Pozo total del mercado / Total apostado a la opción X.
* El cliente solo *proyecta* el pago (`estimateBetPayout` en `src/lib/odds.ts` con `decimal.js`); la liquidación real la ejecuta PostgreSQL.
* Si todo el dinero entra a una sola opción, el multiplicador es estrictamente **1.00x** (los apostadores recuperan su monto, no hay ganancia).
* En la liquidación, el último ganador recibe el remanente exacto del pozo para que la suma de pagos sea idéntica al pozo, sin polvo de redondeo (ver `fn_resolve_market`).

### B. Comisiones
* **3% único al RECARGAR:** depósito de $10 → $0.30 de comisión (va a la cuenta del primer ADMIN activo, transacción `FEE_DEPOSIT`) y $9.70 netos al usuario. Si aún no existe ningún admin, se acredita el 100% para no perder fondos del usuario.
* **0% dentro de los mercados:** el 100% del pozo va a los ganadores.
* **0% al retirar:** el payout de Binance Pay no cobra comisión de la app.

### C. Regla del batacazo huérfano
Si gana una opción con **$0 apostado**:
1. Todos los tickets activos pasan a `LOST`.
2. El pozo se reparte: **70% Casa (primer admin activo, transacción `HOUSE_WIN`)** + **30% creador del mercado (`CREATOR_WIN`)**. Si el creador es el propio admin, la casa se queda el 100%.
3. Exige al menos un admin activo; si no lo hay, la liquidación falla (transacción abortada, nada cambia).

### D. Límites operativos (`src/lib/constants.ts`)
* Apuesta: **0.50 – 500.00 USDT** · Depósito: **1 – 1000 USDT** · Retiro: **1 – 200 USDT**.
* **Tope por usuario/mercado (`BET_USER_MARKET_MAX`): máximo 150 USDT activos por persona en un mismo mercado** (`fn_place_bet` lo valida atómicamente con las filas del usuario bloqueadas). Anti-ballena: ninguna cuenta puede distorsionar las cuotas con volumen desproporcionado ni "snipear" el pozo en el último segundo.
* Opciones por mercado: **2–10** · Vigencia máxima: **365 días** · Creación de mercados: **10 por hora y usuario** (rate limit por instancia).
* Estrictamente 2 decimales en los montos (validado con Zod `multipleOf(0.01)`; verificado con pruebas unitarias que Zod 4 lo maneja sin error de coma flotante).

---

## 3. Roles y Control de Acceso (RBAC)

`role IN ('ADMIN', 'MODERATOR', 'USER')` en `public.users`, con vistas y endpoints separados:

| Rol | Puede | No puede |
| :--- | :--- | :--- |
| **ADMIN** | Todo lo del moderador + panel financiero (`/api/admin/overview`): saldos totales, pozos activos, comisiones 3%, ganancias casa/creadores, saldo esperado en Binance, retiros y depósitos pendientes (conciliar), usuarios (roles/suspensión) y auditoría. | Autodemotearse o suspenderse; dejar el sistema sin admins activos (lo impide `fn_admin_update_user`). |
| **MODERATOR** | Crear mercados oficiales (`is_official`), cerrar apuestas, liquidar ganadores, cancelar con reembolso 100%. Todo queda en `audit_logs`. | **Cero acceso a finanzas:** el dashboard admin le devuelve 403 (`requireRole('ADMIN')`). No ve retiros ni saldos de la casa. |
| **USER** | Apostar, crear mercados propios (gana el 30% si ocurre un batacazo huérfano), recargar y retirar. | Cerrar/liquidar/cancelar mercados (ni los propios). |

* Los usuarios suspendidos (`is_banned`) no apostan, no recargan, no retiran ni sincronizan perfil (`/api/auth/sync` responde 403 `ACCOUNT_SUSPENDED`).
* El primer ADMIN se asigna manualmente: `UPDATE public.users SET role = 'ADMIN' WHERE email = '...';`
* Una cuenta de Google = un perfil: el trigger `fn_handle_new_user` crea el perfil con `username` único derivado del correo.

---

## 4. Arquitectura y Stack Tecnológico

```
┌─────────────────────────────────────────────────────────────┐
│                       NEXT.JS 16 (App Router)               │
│  React 19 + TypeScript + Tailwind v4 + Lucide + decimal.js  │
│  page.tsx = puerta de auth → Terminal.tsx = app autenticada │
└──────────────┬───────────────────────────────┬──────────────┘
               │ Bearer token (anon key)       │ fetch a /api/*
               ▼                               ▼
┌───────────────────────────┐   ┌──────────────────────────────┐
│   SUPABASE AUTH (browser) │   │  API ROUTE HANDLERS          │
│   getSession + OAuth      │   │  Zod strict + rate limit     │
│   Google / Magic Link     │   │  requireUser / requireRole   │
└───────────────────────────┘   │  audit + mappers + rpc       │
                                └───────────┬──────────────────┘
                                            │ service_role (solo servidor)
                                            ▼
                        ┌────────────────────────────────────────┐
                        │   SUPABASE POSTGRES                    │
                        │   RLS como segunda barrera             │
                        │   SECURITY DEFINER RPCs (solo          │
                        │   ejecutables por service_role)        │
                        └───────────────────┬────────────────────┘
                                            │
                                            ▼
                        ┌────────────────────────────────────────┐
                        │   BINANCE PAY                          │
                        │   Orden de depósito + webhook          │
                        │   RSA-SHA256 (certificados por SN)     │
                        │   Payout por UID (retiros)             │
                        └────────────────────────────────────────┘
```

### Principios de seguridad para dinero real

1. **El cliente nunca mueve dinero.** Solo envía intenciones validadas con Zod (`src/lib/security.ts`). Toda mutación de saldo vive en RPCs `SECURITY DEFINER` de `schema.sql` (`fn_place_bet`, `fn_resolve_market`, `fn_cancel_market`, `fn_credit_deposit`, `fn_fail_deposit`, `fn_start_withdrawal`, `fn_refund_withdrawal`, `fn_admin_update_user`), con `REVOKE` a `PUBLIC/anon/authenticated` y `GRANT EXECUTE` únicamente a `service_role`.
2. **Autenticación sin middleware:** los route handlers validan el `Authorization: Bearer <access_token>` con `supabase.auth.getUser()` del servidor (`src/lib/server/auth.ts`), sincronizan el perfil, bloquean cuentas suspendidas y aplican roles. No se usa `@supabase/ssr` ni cookies de sesión.
3. **Bloqueo de filas (`FOR UPDATE`) con orden determinista** (mercado → usuario) para evitar deadlocks y dobles gastos. Los `UPDATE` de saldo validan el resultado con `IF NOT FOUND` (nunca se pierde dinero por un update silencioso).
4. **Webhook Binance verificado con RSA-SHA256 asíncrono** (`crypto.verify`), seleccionando el certificado por la cabecera `Binancepay-Certificate-SN` contra los certificados publicados por Binance (`/binancepay/openapi/certificates`). Opcionalmente se puede fijar `BINANCE_PAY_CERT_SN` y/o `BINANCE_PAY_PUBLIC_KEY`. El cuerpo se lee SIEMPRE con `request.text()` (raw) antes de cualquier parseo. No hay fallback HMAC para webhooks.
5. **Idempotencia estricta:** depósitos y retiros nacen como transacción `PENDING` con `reference_id` único en la DB; el webhook solo acredita contra esa orden precreada (`fn_credit_deposit` es seguro ante reintentos) y Binance recibe `merchantTradeNo` = esa referencia.
6. **Retiros:** el saldo se descuenta atómicamente ANTES de llamar a Binance. Si Binance rechaza definitivamente el payout → reembolso automático del 100% sin comisión (`fn_refund_withdrawal`, el retiro queda `FAILED` + transacción `REFUND`). Si el resultado de red es incierto → la transacción queda `PENDING` y un ADMIN concilia desde el panel (completar o reembolsar vía `/api/admin/withdrawals/reconcile`), dejando nota en auditoría.
7. **Reconciliación de depósitos:** si el webhook no llega, la recarga queda `PENDING` y aparece en la pestaña DEPÓSITOS del panel admin. «Verificar» consulta a Binance (`/binancepay/openapi/v3/order/query` con `merchantTradeNo`): si es `PAY_SUCCESS` acredita vía `fn_credit_deposit` (idempotente, el 97% tras la comisión), si es un estado terminal (`PAY_FAIL`, `PAY_CLOSED`, `PAY_OVER_TIME`, `PAY_TIMEOUT`) lo cierra con `fn_fail_deposit`; estados en proceso no generan decisión. «Marcar fallido» cierra la orden manualmente sin acreditar. Todo queda en `audit_logs`.
8. **Precisión decimal:** `NUMERIC(18,4)` en SQL, `decimal.js` en TypeScript. Nada de float puro para dinero.
9. **Cabeceras de seguridad + CSP** en `next.config.ts` (frame-ancestors none, object-src none, connect-src limitado a Supabase, `upgrade-insecure-requests` en producción). Los route handlers responden `Cache-Control: no-store`.
10. **`schema.sql` es idempotente y también migra bases de datos antiguas:** la sección "MIGRACIÓN SEGURA PARA BASES DE DATOS ANTIGUAS" añade columnas faltantes (`ADD COLUMN IF NOT EXISTS`), reemplaza CHECKs heredados por las reglas con nombre estable y garantiza la unicidad de `reference_id`/`username`/`email`. Si hay datos legado que violan las reglas nuevas, la migración falla con mensaje claro (no silencia datos sucios).

---

## 5. Identidad Visual y Diseño (UI/UX)

* **Estética:** Terminal financiera / exchange de predicciones (inspirado en Linear, Kalshi y terminales de trading).
* **Superficies sólidas:** fondo `#090a0f`, tarjetas carbón sólido `#11141c`, hover `#161a24`. **Sin glassmorfismo, sin blur, sin sombras de color.**
* **Bordes y geometría:** bordes de 1px (`#1e2330`, hover `#2e3548`), radios sutiles (6–8px). Nada de `rounded-3xl`.
* **Tipografía:** Geist Sans para texto, Geist Mono para números, siempre con `tabular-nums`. Etiquetas pequeñas en mono uppercase con tracking amplio.
* **Acentos:** menta `#00f090` (positivo/primario), ámbar `#f59e0b` (atención/pendiente), rojo `#f43f5e` (peligro), lila `#c084fc` (staff).
* **Componentes clave:** cupón flotante (BetSlip) con montos rápidos y pago proyectado; toasts; modales con foco management; navegación inferior en móvil (`MERCADOS`, `TICKETS`, `CREAR`, `BILLETERA`, `STAFF/ADMIN`).
* **Reglas de React (React Compiler + ESLint):** nada de `Date.now()` ni `Math.random()` en render de componentes que dependen del tiempo → usar `useNow()` (`src/hooks/useNow.ts`, reloj compartido con `useSyncExternalStore`). Nada de `setState` síncrono dentro de efectos.

---

## 6. Mapa de Archivos del Proyecto

```
/home/rem/Descargas/Proyectos/apuestas-app/
├── schema.sql                    # DDL completo: tablas, índices, RLS, triggers,
│                                 # migración segura para DBs antiguas y las RPCs
│                                 # de dinero SECURITY DEFINER (solo service_role)
├── .env.example                  # Plantilla de variables con instrucciones
├── next.config.ts                # CSP + cabeceras de seguridad + no-store en /api
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Metadata ES, viewport, fuentes Geist
│   │   ├── globals.css           # Identidad visual terminal
│   │   ├── page.tsx              # Gate: AuthScreen / Terminal (key=profile.id)
│   │   └── api/                  # Route handlers (todos requieren Bearer salvo webhook)
│   │       ├── auth/sync/        # Crea/sincroniza perfil tras iniciar sesión
│   │       ├── me/               # Perfil y saldo frescos
│   │       ├── markets/          # Lista + create/close/resolve/cancel
│   │       ├── bets/             # place + mine
│   │       ├── transactions/mine/
│   │       ├── wallet/deposit/   # Orden Binance Pay + transacción PENDING
│   │       ├── wallet/withdraw/  # Descuento atómico + payout Binance
│   │       ├── admin/            # overview + users + withdrawals/reconcile (solo ADMIN)
│   │       └── webhooks/binance/ # Webhook RSA-SHA256 idempotente (sin auth JWT)
│   ├── components/               # AuthScreen, Terminal, Header/MobileNav, MarketCard,
│   │                             # BetSlip, MyBets, WalletView, ModerationPanel,
│   │                             # AdminDashboard, modales (Deposit/Withdraw/
│   │                             # CreateMarket/Resolve/Cancel) y ui.tsx
│   ├── hooks/                    # useSession (auth+perfil), useNow (reloj compartido)
│   └── lib/
│       ├── api-client.ts         # apiFetch con Bearer + mensajes de error
│       ├── auth.ts               # signInWithGoogle / signInWithMagicLink / signOut
│       ├── binance.ts            # SDK Binance Pay: orden, payout, verificación RSA
│       ├── odds.ts               # Motor pari-mutuel decimal.js (probado con vitest)
│       ├── security.ts           # Esquemas Zod estrictos (probado con vitest)
│       ├── constants.ts          # Límites y etiquetas
│       ├── format.ts             # formatUsdt / fechas
│       ├── types.ts              # Tipos compartidos con el backend
│       ├── supabase.ts           # Cliente browser (anon key, solo lectura pública)
│       └── server/               # auth (Bearer+roles), http (ApiError/parseBody),
│                                 # rpc (llamadas RPC), supabase (service_role),
│                                 # rate-limit, audit, references, mappers
└── src/lib/__tests__/            # vitest: odds y security
```

---

## 7. Guía para Futuros Desarrollos o Asistentes de IA

1. **No modifiques la lógica de saldos en el Frontend ni en los route handlers.** Cualquier cambio en movimientos de dinero se implementa en `schema.sql` (SECURITY DEFINER) y se expone vía `src/lib/server/rpc.ts`. El frontend solo muestra resultados.
2. **Preserva la verificación de raw body** en `src/app/api/webhooks/binance/route.ts`: nunca `request.json()` antes de verificar la firma; siempre `request.text()`.
3. **Preserva la separación de roles:** ningún endpoint financiero puede ser accesible para `MODERATOR`. Si añdes datos al admin, revisa `requireRole('ADMIN')` y `fn_admin_overview`.
4. **Toda acción de staff debe dejar rastro en `audit_logs`** (helper `src/lib/server/audit.ts`).
5. **Mantén la identidad visual:** `#090a0f` / `#11141c`, bordes 1px, mono tabular. No reintroducir glassmorfismo.
6. **Pruebas:** `npm test` (vitest) cubre el motor de cuotas y los esquemas Zod. Si tocas `odds.ts` o `security.ts`, añade/actualiza pruebas. Lint: `npm run lint`; tipos: `npx tsc --noEmit`.
7. **No existen datos de prueba ni accesos de demo.** Para desarrollar contra datos reales usa Supabase local o un proyecto de desarrollo con las mismas RPCs; nunca simules respuestas en el cliente.
8. **Variables de entorno obligatorias** (ver `.env.example`): Supabase (URL + anon + service_role) y Binance Pay (API key/secret, CERT_SN/PUBLIC_KEY opcional). `NEXT_PUBLIC_APP_URL` debe coincidir con las URLs autorizadas en Supabase Auth y el webhook del Merchant Portal.
