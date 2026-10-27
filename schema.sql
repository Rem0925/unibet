-- ====================================================================
-- UniBet — Esquema blindado para apuestas pari-mutuel (USDT / Binance Pay)
-- Reglas financieras:
--   1. Comisión del 1.5% cobrada al RECARGAR (0% dentro de las apuestas).
--   2. El 100% del pozo se reparte entre los ganadores, con un TOPE DE
--      MULTIPLICADOR de 20x: si el pozo pagaría más de 20x, el excedente
--      va íntegro a la casa (HOUSE_WIN).
--   3. Si gana una opción sin apuestas: 70% Casa + 30% creador.
-- La casa es UNA sola cuenta: la primera ADMIN activa creada
-- (fn_house_admin_id); toda recaudación va ahí, nunca repartida.
-- ====================================================================
-- Ejecutar este archivo completo en el SQL Editor de Supabase. Es
-- idempotente: se puede volver a ejecutar para actualizar funciones,
-- políticas y triggers sin perder datos, y también actualiza de forma
-- segura una base de datos creada con una versión anterior del esquema
-- (sección "MIGRACIÓN SEGURA PARA BASES DE DATOS ANTIGUAS").
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- TABLAS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL CONSTRAINT users_username_format CHECK (char_length(username) BETWEEN 3 AND 30),
    email TEXT UNIQUE NOT NULL,
    binance_uid TEXT CONSTRAINT users_binance_uid_format CHECK (binance_uid IS NULL OR binance_uid ~ '^[0-9]{8,10}$'),
    balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CONSTRAINT users_balance_non_negative CHECK (balance >= 0),
    role TEXT NOT NULL DEFAULT 'USER' CONSTRAINT users_role_valid CHECK (role IN ('ADMIN', 'MODERATOR', 'USER')),
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES public.users(id),
    title TEXT NOT NULL CONSTRAINT markets_title_length CHECK (char_length(title) BETWEEN 5 AND 255),
    description TEXT,
    resolution_source TEXT,
    category TEXT NOT NULL DEFAULT 'CAMPUS' CONSTRAINT markets_category_valid CHECK (category IN ('FUTBOL', 'BEISBOL', 'CAMPUS', 'GAMING', 'OTRO')),
    options JSONB NOT NULL CONSTRAINT markets_options_shape CHECK (
        jsonb_typeof(options) = 'array'
        AND jsonb_array_length(options) BETWEEN 2 AND 10
    ),
    close_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CONSTRAINT markets_status_valid CHECK (status IN ('OPEN', 'CLOSED', 'RESOLVED', 'CANCELLED')),
    winning_option TEXT,
    resolved_by UUID CONSTRAINT markets_resolved_by_fk REFERENCES public.users(id) ON DELETE SET NULL,
    cancelled_reason TEXT,
    total_pool NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CONSTRAINT markets_pool_non_negative CHECK (total_pool >= 0),
    is_official BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.bets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id UUID NOT NULL REFERENCES public.markets(id),
    user_id UUID NOT NULL REFERENCES public.users(id),
    selected_option TEXT NOT NULL,
    amount NUMERIC(18, 4) NOT NULL CONSTRAINT bets_amount_range CHECK (amount >= 0.5 AND amount <= 500),
    payout_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CONSTRAINT bets_payout_non_negative CHECK (payout_amount >= 0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CONSTRAINT bets_status_valid CHECK (status IN ('ACTIVE', 'WON', 'LOST', 'REFUNDED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    type TEXT NOT NULL CONSTRAINT transactions_type_valid CHECK (type IN ('DEPOSIT', 'WITHDRAW', 'BET_PLACED', 'BET_WON', 'FEE_DEPOSIT', 'HOUSE_WIN', 'CREATOR_WIN', 'REFUND')),
    amount NUMERIC(18, 4) NOT NULL CONSTRAINT transactions_amount_positive CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CONSTRAINT transactions_status_valid CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    reference_id TEXT UNIQUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- ÍNDICES
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_bets_market_id ON public.bets(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON public.bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_market_option ON public.bets(market_id, selected_option);
CREATE INDEX IF NOT EXISTS idx_bets_status ON public.bets(status);
CREATE INDEX IF NOT EXISTS idx_markets_status ON public.markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_close_time ON public.markets(close_time);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON public.transactions(type, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ====================================================================
-- MIGRACIÓN SEGURA PARA BASES DE DATOS ANTIGUAS
-- CREATE TABLE IF NOT EXISTS no modifica tablas que ya existen con una
-- versión previa del esquema. Esta sección añade las columnas que falten,
-- reemplaza los CHECK heredados (nombres autogenerados) por las reglas
-- actuales y garantiza la unicidad esencial. Todo es idempotente y no
-- toca datos existentes. Si algún dato legado viola una regla nueva, la
-- migración fallará con un mensaje claro: corrige esas filas y vuelve a
-- ejecutar el script.
-- ====================================================================

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS binance_uid TEXT,
    ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'USER',
    ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.markets
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS resolution_source TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'CAMPUS',
    ADD COLUMN IF NOT EXISTS winning_option TEXT,
    ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
    ADD COLUMN IF NOT EXISTS total_pool NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.bets
    ADD COLUMN IF NOT EXISTS payout_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS reference_id TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- CHECKs heredados (nombres autogenerados por versiones anteriores) y
-- versiones previas de las restricciones con nombre estable.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_username_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_binance_uid_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_balance_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_username_format;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_binance_uid_format;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_balance_non_negative;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_valid;
ALTER TABLE public.users ADD CONSTRAINT users_username_format CHECK (char_length(username) BETWEEN 3 AND 30);
ALTER TABLE public.users ADD CONSTRAINT users_binance_uid_format CHECK (binance_uid IS NULL OR binance_uid ~ '^[0-9]{8,10}$');
ALTER TABLE public.users ADD CONSTRAINT users_balance_non_negative CHECK (balance >= 0);
ALTER TABLE public.users ADD CONSTRAINT users_role_valid CHECK (role IN ('ADMIN', 'MODERATOR', 'USER'));

ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_title_check;
ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_category_check;
ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_options_check;
ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_status_check;
ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_total_pool_check;
ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_title_length;
ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_category_valid;
ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_options_shape;
ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_status_valid;
ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_pool_non_negative;
ALTER TABLE public.markets ADD CONSTRAINT markets_title_length CHECK (char_length(title) BETWEEN 5 AND 255);
ALTER TABLE public.markets ADD CONSTRAINT markets_category_valid CHECK (category IN ('FUTBOL', 'BEISBOL', 'CAMPUS', 'GAMING', 'OTRO'));
ALTER TABLE public.markets ADD CONSTRAINT markets_options_shape CHECK (
    jsonb_typeof(options) = 'array'
    AND jsonb_array_length(options) BETWEEN 2 AND 10
);
ALTER TABLE public.markets ADD CONSTRAINT markets_status_valid CHECK (status IN ('OPEN', 'CLOSED', 'RESOLVED', 'CANCELLED'));
ALTER TABLE public.markets ADD CONSTRAINT markets_pool_non_negative CHECK (total_pool >= 0);

-- Si resolved_by ya existía sin clave foránea, se añade una vez.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.markets'::regclass
          AND contype = 'f'
          AND confrelid = 'public.users'::regclass
          AND pg_get_constraintdef(oid) LIKE '%(resolved_by)%'
    ) THEN
        ALTER TABLE public.markets
            ADD CONSTRAINT markets_resolved_by_fk FOREIGN KEY (resolved_by)
            REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_amount_check;
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_payout_amount_check;
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_status_check;
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_amount_range;
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_payout_non_negative;
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_status_valid;
ALTER TABLE public.bets ADD CONSTRAINT bets_amount_range CHECK (amount >= 0.5 AND amount <= 500);
ALTER TABLE public.bets ADD CONSTRAINT bets_payout_non_negative CHECK (payout_amount >= 0);
ALTER TABLE public.bets ADD CONSTRAINT bets_status_valid CHECK (status IN ('ACTIVE', 'WON', 'LOST', 'REFUNDED'));

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_amount_check;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_amount_positive;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_valid;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_valid;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_valid CHECK (type IN ('DEPOSIT', 'WITHDRAW', 'BET_PLACED', 'BET_WON', 'FEE_DEPOSIT', 'HOUSE_WIN', 'CREATOR_WIN', 'REFUND'));
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_valid CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED'));

-- Unicidad esencial: si una tabla antigua no tiene índice único en
-- reference_id, la idempotencia de depósitos/retiros no estaría garantizada.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'transactions'
          AND indexdef ILIKE '%unique%'
          AND indexdef ILIKE '%reference_id%'
    ) THEN
        CREATE UNIQUE INDEX idx_transactions_reference_id ON public.transactions (reference_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'users'
          AND indexdef ILIKE '%unique%'
          AND indexdef ILIKE '%username%'
    ) THEN
        CREATE UNIQUE INDEX idx_users_username ON public.users (username);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'users'
          AND indexdef ILIKE '%unique%'
          AND indexdef ILIKE '%email%'
    ) THEN
        CREATE UNIQUE INDEX idx_users_email ON public.users (email);
    END IF;
END $$;

-- ====================================================================
-- TRIGGERS
-- ====================================================================

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Crea el perfil público automáticamente cuando Supabase registra un usuario.
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_base TEXT;
    v_username TEXT;
    v_attempt INTEGER := 0;
BEGIN
    v_base := lower(regexp_replace(split_part(COALESCE(NEW.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
    v_base := left(v_base, 24);

    IF char_length(v_base) < 3 THEN
        v_base := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
    END IF;

    v_username := v_base;

    WHILE EXISTS (SELECT 1 FROM public.users WHERE username = v_username) LOOP
        v_attempt := v_attempt + 1;
        v_username := left(v_base, 20) || '_' || v_attempt::text;
    END LOOP;

    INSERT INTO public.users (id, username, email)
    VALUES (NEW.id, v_username, COALESCE(NULLIF(NEW.email, ''), NEW.id::text || '@users.local'))
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

-- ====================================================================
-- ROW LEVEL SECURITY
-- Los route handlers usan service_role y autorizan explícitamente. Estas
-- políticas son una segunda barrera para cualquier acceso directo con la
-- clave anónima.
-- ====================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper SECURITY DEFINER: evita la recursión infinita que produciría
-- consultar public.users desde una política de public.users.
CREATE OR REPLACE FUNCTION public.fn_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON public.users;
DROP POLICY IF EXISTS "Admins ven todos los perfiles" ON public.users;

CREATE POLICY "users_select_own"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "users_select_admin"
ON public.users FOR SELECT TO authenticated
USING (public.fn_current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "markets_read" ON public.markets;
DROP POLICY IF EXISTS "Lectura pública de mercados" ON public.markets;

CREATE POLICY "markets_read"
ON public.markets FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "bets_select_own" ON public.bets;
DROP POLICY IF EXISTS "bets_select_admin" ON public.bets;
DROP POLICY IF EXISTS "Lectura pública de apuestas" ON public.bets;

CREATE POLICY "bets_select_own"
ON public.bets FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "bets_select_admin"
ON public.bets FOR SELECT TO authenticated
USING (public.fn_current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_admin" ON public.transactions;
DROP POLICY IF EXISTS "Usuarios ven sus transacciones" ON public.transactions;
DROP POLICY IF EXISTS "Admins ven todas las transacciones" ON public.transactions;

CREATE POLICY "transactions_select_own"
ON public.transactions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "transactions_select_admin"
ON public.transactions FOR SELECT TO authenticated
USING (public.fn_current_user_role() = 'ADMIN');

-- audit_logs no tiene políticas: solo service_role puede leer/escribir.

-- ====================================================================
-- VISTA AGREGADA DE POZOS
-- No expone tickets individuales al cliente.
-- ====================================================================

DROP VIEW IF EXISTS public.market_option_pools;

CREATE VIEW public.market_option_pools AS
SELECT
    b.market_id,
    b.selected_option,
    COALESCE(SUM(b.amount) FILTER (WHERE b.status <> 'REFUNDED'), 0) AS pool,
    COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'ACTIVE'), 0) AS active_pool,
    COUNT(*) FILTER (WHERE b.status = 'ACTIVE')::INTEGER AS active_bet_count,
    COUNT(*) FILTER (WHERE b.status <> 'REFUNDED')::INTEGER AS bet_count
FROM public.bets b
GROUP BY b.market_id, b.selected_option;

-- ====================================================================
-- PROCEDIMIENTOS ALMACENADOS
-- ====================================================================

-- 0. Cuenta única de la casa: SIEMPRE la primera cuenta ADMIN activa creada.
--    Toda la recaudación de la casa (comisión del 1.5%, excedente del tope
--    de multiplicador, pozo huérfano) va a ESA única cuenta; nunca se
--    reparte entre los demás administradores. La función es interna de las
--    demás RPCs de dinero.
CREATE OR REPLACE FUNCTION public.fn_house_admin_id()
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT id
    FROM public.users
    WHERE role = 'ADMIN' AND is_banned = FALSE
    ORDER BY created_at ASC
    LIMIT 1;
$$;

-- 1. Acreditar depósito de Binance Pay (1.5% de comisión de entrada).
--    La transacción PENDING creada por /api/wallet/deposit es la fuente de
--    verdad del usuario y del monto; el webhook no puede inventar una orden.
DROP FUNCTION IF EXISTS public.fn_credit_deposit(UUID, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.fn_credit_deposit(
    p_user_id UUID,
    p_gross_amount NUMERIC(18, 4),
    p_reference_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tx RECORD;
    v_admin_id UUID;
    v_fee_amount NUMERIC(18, 4) := 0;
    v_net_amount NUMERIC(18, 4);
BEGIN
    IF p_gross_amount IS NULL OR p_gross_amount <= 0 THEN
        RAISE EXCEPTION 'Monto de depósito inválido';
    END IF;

    IF p_reference_id IS NULL OR char_length(trim(p_reference_id)) < 6 THEN
        RAISE EXCEPTION 'Referencia de depósito inválida';
    END IF;

    SELECT * INTO v_tx
    FROM public.transactions
    WHERE reference_id = p_reference_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe una orden de depósito pendiente para esta referencia';
    END IF;

    IF v_tx.type <> 'DEPOSIT' THEN
        RAISE EXCEPTION 'La transacción no es un depósito';
    END IF;

    IF v_tx.user_id <> p_user_id THEN
        RAISE EXCEPTION 'El usuario del webhook no coincide con la orden';
    END IF;

    IF v_tx.status = 'COMPLETED' THEN
        RETURN jsonb_build_object('success', true, 'already_processed', true);
    END IF;

    IF v_tx.status <> 'PENDING' THEN
        RAISE EXCEPTION 'La orden de depósito no está pendiente';
    END IF;

    -- Tolerancia de 5 centavos por redondeos del proveedor.
    IF abs(v_tx.amount - p_gross_amount) > 0.05 THEN
        RAISE EXCEPTION 'El monto del webhook no coincide con la orden';
    END IF;

    -- Cuenta única de la casa (la primera ADMIN activa): toda la comisión
    -- va a esa sola cuenta, nunca repartida entre administradores.
    v_admin_id := public.fn_house_admin_id();

    IF v_admin_id IS NULL THEN
        -- Sin administrador configurado, se acredita el 100% para no perder
        -- fondos del usuario. El fee se activa al crear el primer admin.
        v_fee_amount := 0;
    ELSE
        -- 1.5%: cubre costos de operación sin castigar al usuario. Si algún
        -- día cambia, ajustar también DEPOSIT_FEE_RATE en src/lib/constants.ts.
        v_fee_amount := ROUND(p_gross_amount * 0.015, 4);
    END IF;

    v_net_amount := p_gross_amount - v_fee_amount;

    UPDATE public.users
    SET balance = balance + v_net_amount,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario no encontrado';
    END IF;

    UPDATE public.transactions
    SET amount = v_net_amount,
        status = 'COMPLETED',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'gross_deposit', p_gross_amount,
            'fee_deducted', v_fee_amount,
            'credited_at', timezone('utc'::text, now())
        )
    WHERE id = v_tx.id;

    IF v_fee_amount > 0 AND v_admin_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.transactions WHERE reference_id = 'FEE_' || p_reference_id
        ) THEN
            UPDATE public.users
            SET balance = balance + v_fee_amount,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_admin_id;

            INSERT INTO public.transactions (user_id, type, amount, status, reference_id, metadata)
            VALUES (
                v_admin_id,
                'FEE_DEPOSIT',
                v_fee_amount,
                'COMPLETED',
                'FEE_' || p_reference_id,
                jsonb_build_object('source_user', p_user_id, 'deposit_reference', p_reference_id)
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'credited_amount', v_net_amount,
        'fee_amount', v_fee_amount
    );
END;
$$;

-- 2. Realizar apuesta atómicamente (0% comisiones dentro del mercado).
DROP FUNCTION IF EXISTS public.fn_place_bet(UUID, UUID, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.fn_place_bet(
    p_user_id UUID,
    p_market_id UUID,
    p_option TEXT,
    p_amount NUMERIC(18, 4)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_market RECORD;
    v_user RECORD;
    v_bet_id UUID;
    v_new_balance NUMERIC(18, 4);
    v_user_market_total NUMERIC(18, 4);
BEGIN
    IF p_amount IS NULL OR p_amount < 0.5000 OR p_amount > 500.0000 THEN
        RAISE EXCEPTION 'El monto debe estar entre 0.50 y 500.00 USDT';
    END IF;

    IF p_option IS NULL OR char_length(trim(p_option)) = 0 THEN
        RAISE EXCEPTION 'Debes seleccionar una opción';
    END IF;

    -- Bloqueo en el mismo orden que la liquidación (mercado -> usuario)
    -- para evitar deadlocks.
    SELECT * INTO v_market
    FROM public.markets
    WHERE id = p_market_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mercado no encontrado';
    END IF;

    IF v_market.status <> 'OPEN' THEN
        RAISE EXCEPTION 'El mercado no está abierto';
    END IF;

    IF v_market.close_time <= timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'El tiempo para apostar ya expiró';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_market.options) AS elem(value)
        WHERE elem.value = p_option
    ) THEN
        RAISE EXCEPTION 'La opción seleccionada no existe en este mercado';
    END IF;

    SELECT * INTO v_user
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario no encontrado';
    END IF;

    IF v_user.is_banned THEN
        RAISE EXCEPTION 'Esta cuenta se encuentra suspendida';
    END IF;

    IF v_user.balance < p_amount THEN
        RAISE EXCEPTION 'Saldo insuficiente en tu billetera';
    END IF;

    -- Tope por usuario y mercado: evita que una sola cuenta distorsione las
    -- cuotas con volumen desproporcionado. Las filas del usuario ya están
    -- bloqueadas (FOR UPDATE), por lo que dos apuestas concurrentes del
    -- mismo usuario se serializan y la suma es confiable.
    SELECT COALESCE(SUM(amount), 0) INTO v_user_market_total
    FROM public.bets
    WHERE market_id = p_market_id
      AND user_id = p_user_id
      AND status = 'ACTIVE';

    IF v_user_market_total + p_amount > 150.0000 THEN
        RAISE EXCEPTION 'Tope de 150 USDT apostados por usuario en este mercado (ya llevas %s)', v_user_market_total;
    END IF;

    UPDATE public.users
    SET balance = balance - p_amount,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    INSERT INTO public.bets (market_id, user_id, selected_option, amount, status)
    VALUES (p_market_id, p_user_id, p_option, p_amount, 'ACTIVE')
    RETURNING id INTO v_bet_id;

    UPDATE public.markets
    SET total_pool = total_pool + p_amount
    WHERE id = p_market_id;

    INSERT INTO public.transactions (user_id, type, amount, status, metadata)
    VALUES (
        p_user_id,
        'BET_PLACED',
        p_amount,
        'COMPLETED',
        jsonb_build_object('market_id', p_market_id, 'bet_id', v_bet_id, 'option', p_option)
    );

    SELECT balance INTO v_new_balance FROM public.users WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'bet_id', v_bet_id,
        'new_balance', v_new_balance
    );
END;
$$;

-- 3. Liquidación de mercado.
--    Caso normal: 100% del pozo a los ganadores.
--    Batacazo huérfano: 70% Casa + 30% creador (100% Casa si creó el admin).
DROP FUNCTION IF EXISTS public.fn_resolve_market(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.fn_resolve_market(
    p_market_id UUID,
    p_winning_option TEXT,
    p_caller_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_market RECORD;
    v_caller_role TEXT;
    v_admin_id UUID;
    v_total_winning_pool NUMERIC(18, 4) := 0;
    v_winner_count INTEGER := 0;
    v_processed_winners INTEGER := 0;
    v_bet RECORD;
    v_user_payout NUMERIC(18, 4);
    v_remaining_pool NUMERIC(18, 4);
    v_payout_multiplier NUMERIC(18, 4);
    v_distributable_pool NUMERIC(18, 4);
    v_house_surplus NUMERIC(18, 4) := 0;
    v_creator_cut NUMERIC(18, 4) := 0;
    v_house_cut NUMERIC(18, 4) := 0;
    v_loser_count INTEGER := 0;
BEGIN
    SELECT role INTO v_caller_role FROM public.users WHERE id = p_caller_id;
    IF v_caller_role NOT IN ('ADMIN', 'MODERATOR') THEN
        RAISE EXCEPTION 'Solo administradores o moderadores pueden certificar el ganador';
    END IF;

    SELECT * INTO v_market
    FROM public.markets
    WHERE id = p_market_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mercado no encontrado';
    END IF;

    IF v_market.status NOT IN ('OPEN', 'CLOSED') THEN
        RAISE EXCEPTION 'El mercado no se puede liquidar en su estado actual';
    END IF;

    IF p_winning_option IS NULL OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_market.options) AS elem(value)
        WHERE elem.value = p_winning_option
    ) THEN
        RAISE EXCEPTION 'La opción ganadora no existe en este mercado';
    END IF;

    -- Cuenta única de la casa (la primera ADMIN activa): pozo huérfano y
    -- excedente del tope de multiplicador van a esa sola cuenta.
    v_admin_id := public.fn_house_admin_id();

    IF v_market.total_pool = 0 THEN
        UPDATE public.markets
        SET status = 'RESOLVED',
            winning_option = p_winning_option,
            resolved_by = p_caller_id
        WHERE id = p_market_id;

        RETURN jsonb_build_object('success', true, 'case', 'EMPTY_MARKET', 'distributed', 0);
    END IF;

    SELECT COALESCE(SUM(amount), 0), COUNT(*)::INTEGER
    INTO v_total_winning_pool, v_winner_count
    FROM public.bets
    WHERE market_id = p_market_id
      AND selected_option = p_winning_option
      AND status = 'ACTIVE';

    -- ================================================================
    -- NADIE APOSTÓ A LA OPCIÓN GANADORA
    -- ================================================================
    IF v_winner_count = 0 THEN
        UPDATE public.bets
        SET status = 'LOST'
        WHERE market_id = p_market_id AND status = 'ACTIVE';

        GET DIAGNOSTICS v_loser_count = ROW_COUNT;

        IF v_admin_id IS NULL THEN
            RAISE EXCEPTION 'No hay un administrador activo para recibir el pozo';
        END IF;

        IF v_market.creator_id <> v_admin_id THEN
            v_creator_cut := ROUND(v_market.total_pool * 0.30, 4);
            v_house_cut := v_market.total_pool - v_creator_cut;

            UPDATE public.users
            SET balance = balance + v_creator_cut,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_market.creator_id;

            INSERT INTO public.transactions (user_id, type, amount, status, metadata)
            VALUES (
                v_market.creator_id,
                'CREATOR_WIN',
                v_creator_cut,
                'COMPLETED',
                jsonb_build_object(
                    'market_id', p_market_id,
                    'note', '30% por crear un mercado donde nadie acertó'
                )
            );
        ELSE
            v_house_cut := v_market.total_pool;
        END IF;

        UPDATE public.users
        SET balance = balance + v_house_cut,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_admin_id;

        INSERT INTO public.transactions (user_id, type, amount, status, metadata)
        VALUES (
            v_admin_id,
            'HOUSE_WIN',
            v_house_cut,
            'COMPLETED',
            jsonb_build_object('market_id', p_market_id, 'note', 'Pozo donde nadie acertó')
        );

        UPDATE public.markets
        SET status = 'RESOLVED',
            winning_option = p_winning_option,
            resolved_by = p_caller_id
        WHERE id = p_market_id;

        RETURN jsonb_build_object(
            'success', true,
            'case', 'NO_WINNERS',
            'house_cut', v_house_cut,
            'creator_cut', v_creator_cut,
            'losing_bets', v_loser_count
        );
    END IF;

    -- ================================================================
    -- CASO NORMAL: HAY GANADORES
    -- Multiplicador con TOPE de 20x: si el pozo crudo pagaría más que el
    -- tope, el excedente va íntegro a la casa (HOUSE_WIN). Sin admin
    -- activo no hay casa que reciba el excedente, así que se liquida sin
    -- tope para no perder fondos de los ganadores (misma política que la
    -- comisión de recarga). El último ganador recibe el remanente exacto
    -- del pool distribuible, sin polvo por redondeo.
    -- ================================================================
    IF v_admin_id IS NULL THEN
        v_payout_multiplier := v_market.total_pool / v_total_winning_pool;
    ELSE
        v_payout_multiplier := LEAST(v_market.total_pool / v_total_winning_pool, 20.0000);
    END IF;

    v_distributable_pool := LEAST(
        ROUND(v_total_winning_pool * v_payout_multiplier, 4),
        v_market.total_pool
    );
    v_house_surplus := ROUND(v_market.total_pool - v_distributable_pool, 4);

    -- Polvo de redondeo (< 1 centavo) mejor para los ganadores que como
    -- transacción fantasma para la casa.
    IF v_house_surplus < 0.01 THEN
        v_distributable_pool := v_market.total_pool;
        v_house_surplus := 0;
    END IF;

    v_remaining_pool := v_distributable_pool;

    FOR v_bet IN
        SELECT *
        FROM public.bets
        WHERE market_id = p_market_id AND status = 'ACTIVE'
        ORDER BY created_at ASC, id ASC
    LOOP
        IF v_bet.selected_option = p_winning_option THEN
            v_processed_winners := v_processed_winners + 1;

            IF v_processed_winners = v_winner_count THEN
                v_user_payout := v_remaining_pool;
            ELSE
                v_user_payout := ROUND(
                    (v_bet.amount / v_total_winning_pool) * v_distributable_pool,
                    4
                );
                IF v_user_payout > v_remaining_pool THEN
                    v_user_payout := v_remaining_pool;
                END IF;
                v_remaining_pool := v_remaining_pool - v_user_payout;
            END IF;

            UPDATE public.users
            SET balance = balance + v_user_payout,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_bet.user_id;

            UPDATE public.bets
            SET status = 'WON', payout_amount = v_user_payout
            WHERE id = v_bet.id;

            INSERT INTO public.transactions (user_id, type, amount, status, metadata)
            VALUES (
                v_bet.user_id,
                'BET_WON',
                v_user_payout,
                'COMPLETED',
                jsonb_build_object(
                    'market_id', p_market_id,
                    'bet_id', v_bet.id,
                    'option', p_winning_option
                )
            );
        ELSE
            UPDATE public.bets
            SET status = 'LOST'
            WHERE id = v_bet.id;
        END IF;
    END LOOP;

    -- Excedente del tope de multiplicador: el resto del pozo se lo queda
    -- la casa (el primer admin activo), tal como el usuario pidió.
    IF v_house_surplus > 0 AND v_admin_id IS NOT NULL THEN
        UPDATE public.users
        SET balance = balance + v_house_surplus,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_admin_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Administrador de la casa no encontrado';
        END IF;

        INSERT INTO public.transactions (user_id, type, amount, status, metadata)
        VALUES (
            v_admin_id,
            'HOUSE_WIN',
            v_house_surplus,
            'COMPLETED',
            jsonb_build_object(
                'market_id', p_market_id,
                'note', 'Excedente del tope de multiplicador (20x)',
                'winning_pool', v_total_winning_pool,
                'raw_multiplier', ROUND(v_market.total_pool / v_total_winning_pool, 4)
            )
        );
    END IF;

    UPDATE public.markets
    SET status = 'RESOLVED',
        winning_option = p_winning_option,
        resolved_by = p_caller_id
    WHERE id = p_market_id;

    RETURN jsonb_build_object(
        'success', true,
        'case', 'WINNERS_PAID',
        'winning_bets', v_winner_count,
        'distributed', v_distributable_pool,
        'house_surplus', v_house_surplus
    );
END;
$$;

-- 4. Cerrar mercado (dejar de aceptar apuestas).
DROP FUNCTION IF EXISTS public.fn_close_market(UUID, UUID);

CREATE OR REPLACE FUNCTION public.fn_close_market(p_market_id UUID, p_caller_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_status TEXT;
BEGIN
    SELECT role INTO v_role FROM public.users WHERE id = p_caller_id;
    IF v_role NOT IN ('ADMIN', 'MODERATOR') THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    SELECT status INTO v_status
    FROM public.markets
    WHERE id = p_market_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mercado no encontrado';
    END IF;

    IF v_status <> 'OPEN' THEN
        RAISE EXCEPTION 'Solo se pueden cerrar mercados abiertos';
    END IF;

    UPDATE public.markets SET status = 'CLOSED' WHERE id = p_market_id;

    RETURN jsonb_build_object('success', true, 'status', 'CLOSED');
END;
$$;

-- 5. Cancelar mercado con reembolso del 100%.
DROP FUNCTION IF EXISTS public.fn_cancel_market(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.fn_cancel_market(
    p_market_id UUID,
    p_caller_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_market RECORD;
    v_bet RECORD;
    v_refunded_total NUMERIC(18, 4) := 0;
    v_refunded_count INTEGER := 0;
BEGIN
    SELECT role INTO v_role FROM public.users WHERE id = p_caller_id;
    IF v_role NOT IN ('ADMIN', 'MODERATOR') THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'El motivo de cancelación es obligatorio';
    END IF;

    SELECT * INTO v_market
    FROM public.markets
    WHERE id = p_market_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mercado no encontrado';
    END IF;

    IF v_market.status NOT IN ('OPEN', 'CLOSED') THEN
        RAISE EXCEPTION 'El mercado no se puede cancelar en su estado actual';
    END IF;

    FOR v_bet IN
        SELECT * FROM public.bets
        WHERE market_id = p_market_id AND status = 'ACTIVE'
        FOR UPDATE
    LOOP
        UPDATE public.users
        SET balance = balance + v_bet.amount,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_bet.user_id;

        UPDATE public.bets
        SET status = 'REFUNDED', payout_amount = v_bet.amount
        WHERE id = v_bet.id;

        INSERT INTO public.transactions (user_id, type, amount, status, metadata)
        VALUES (
            v_bet.user_id,
            'REFUND',
            v_bet.amount,
            'COMPLETED',
            jsonb_build_object('market_id', p_market_id, 'bet_id', v_bet.id, 'reason', p_reason)
        );

        v_refunded_total := v_refunded_total + v_bet.amount;
        v_refunded_count := v_refunded_count + 1;
    END LOOP;

    UPDATE public.markets
    SET status = 'CANCELLED',
        cancelled_reason = p_reason,
        resolved_by = p_caller_id,
        winning_option = NULL
    WHERE id = p_market_id;

    RETURN jsonb_build_object(
        'success', true,
        'refunded_total', v_refunded_total,
        'refunded_bets', v_refunded_count
    );
END;
$$;

-- 6. Iniciar retiro: descuenta el saldo de forma atómica antes de Binance.
DROP FUNCTION IF EXISTS public.fn_start_withdrawal(UUID, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.fn_start_withdrawal(
    p_user_id UUID,
    p_amount NUMERIC(18, 4),
    p_binance_uid TEXT,
    p_request_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_existing RECORD;
    v_new_balance NUMERIC(18, 4);
BEGIN
    IF p_amount IS NULL OR p_amount < 1.0000 OR p_amount > 200.0000 THEN
        RAISE EXCEPTION 'El retiro debe estar entre 1.00 y 200.00 USDT';
    END IF;

    IF p_binance_uid IS NULL OR p_binance_uid !~ '^[0-9]{8,10}$' THEN
        RAISE EXCEPTION 'Binance UID inválido';
    END IF;

    IF p_request_id IS NULL OR char_length(trim(p_request_id)) < 6 THEN
        RAISE EXCEPTION 'Referencia de retiro inválida';
    END IF;

    SELECT * INTO v_existing
    FROM public.transactions
    WHERE reference_id = p_request_id
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.user_id <> p_user_id OR v_existing.type <> 'WITHDRAW' THEN
            RAISE EXCEPTION 'Referencia de retiro ya utilizada';
        END IF;

        SELECT balance INTO v_new_balance FROM public.users WHERE id = p_user_id;
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'remaining_balance', v_new_balance
        );
    END IF;

    SELECT * INTO v_user
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario no encontrado';
    END IF;

    IF v_user.balance < p_amount THEN
        RAISE EXCEPTION 'Saldo insuficiente';
    END IF;

    UPDATE public.users
    SET balance = balance - p_amount,
        binance_uid = p_binance_uid,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    INSERT INTO public.transactions (user_id, type, amount, status, reference_id, metadata)
    VALUES (
        p_user_id,
        'WITHDRAW',
        p_amount,
        'PENDING',
        p_request_id,
        jsonb_build_object('target_uid', p_binance_uid, 'requested_at', timezone('utc'::text, now()))
    );

    SELECT balance INTO v_new_balance FROM public.users WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'remaining_balance', v_new_balance
    );
END;
$$;

-- 7. Reembolsar un retiro fallido SIN cobrar comisión.
DROP FUNCTION IF EXISTS public.fn_refund_withdrawal(UUID, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.fn_refund_withdrawal(
    p_user_id UUID,
    p_amount NUMERIC(18, 4),
    p_reference_id TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tx RECORD;
    v_new_balance NUMERIC(18, 4);
    v_refund_reference TEXT;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Monto de reembolso inválido';
    END IF;

    SELECT * INTO v_tx
    FROM public.transactions
    WHERE reference_id = p_reference_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el retiro indicado';
    END IF;

    IF v_tx.type <> 'WITHDRAW' THEN
        RAISE EXCEPTION 'La transacción no es un retiro';
    END IF;

    IF v_tx.user_id <> p_user_id THEN
        RAISE EXCEPTION 'El usuario no coincide con el retiro';
    END IF;

    IF v_tx.status = 'FAILED' THEN
        SELECT balance INTO v_new_balance FROM public.users WHERE id = p_user_id;
        RETURN jsonb_build_object(
            'success', true,
            'already_refunded', true,
            'new_balance', v_new_balance
        );
    END IF;

    IF v_tx.status = 'COMPLETED' THEN
        RAISE EXCEPTION 'El retiro ya fue completado; no se puede reembolsar automáticamente';
    END IF;

    IF v_tx.amount <> p_amount THEN
        RAISE EXCEPTION 'El monto del reembolso no coincide con el retiro';
    END IF;

    UPDATE public.users
    SET balance = balance + p_amount,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario no encontrado';
    END IF;

    UPDATE public.transactions
    SET status = 'FAILED',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'failure_reason', COALESCE(p_reason, 'Retiro rechazado por Binance Pay'),
            'failed_at', timezone('utc'::text, now())
        )
    WHERE id = v_tx.id;

    v_refund_reference := 'REF_' || p_reference_id;

    IF NOT EXISTS (
        SELECT 1 FROM public.transactions WHERE reference_id = v_refund_reference
    ) THEN
        INSERT INTO public.transactions (user_id, type, amount, status, reference_id, metadata)
        VALUES (
            p_user_id,
            'REFUND',
            p_amount,
            'COMPLETED',
            v_refund_reference,
            jsonb_build_object('withdraw_reference', p_reference_id, 'reason', p_reason)
        );
    END IF;

    SELECT balance INTO v_new_balance FROM public.users WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'refunded_amount', p_amount,
        'new_balance', v_new_balance
    );
END;
$$;

-- 8. Actualización de usuarios por un administrador.
DROP FUNCTION IF EXISTS public.fn_admin_update_user(UUID, UUID, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.fn_admin_update_user(
    p_admin_id UUID,
    p_user_id UUID,
    p_role TEXT,
    p_is_banned BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin_role TEXT;
    v_target RECORD;
    v_new_role TEXT;
    v_new_banned BOOLEAN;
    v_active_admins INTEGER;
BEGIN
    SELECT role INTO v_admin_role FROM public.users WHERE id = p_admin_id;
    IF v_admin_role IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    SELECT * INTO v_target
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario no encontrado';
    END IF;

    v_new_role := COALESCE(p_role, v_target.role);
    v_new_banned := COALESCE(p_is_banned, v_target.is_banned);

    IF v_new_role NOT IN ('ADMIN', 'MODERATOR', 'USER') THEN
        RAISE EXCEPTION 'Rol inválido';
    END IF;

    IF p_user_id = p_admin_id AND v_new_role <> 'ADMIN' THEN
        RAISE EXCEPTION 'No puedes quitarte el rol de administrador';
    END IF;

    IF p_user_id = p_admin_id AND v_new_banned THEN
        RAISE EXCEPTION 'No puedes suspender tu propia cuenta';
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_active_admins
    FROM public.users
    WHERE role = 'ADMIN' AND is_banned = FALSE;

    IF v_target.role = 'ADMIN'
       AND v_target.is_banned = FALSE
       AND (v_new_role <> 'ADMIN' OR v_new_banned)
       AND v_active_admins <= 1 THEN
        RAISE EXCEPTION 'Debe existir al menos un administrador activo';
    END IF;

    UPDATE public.users
    SET role = v_new_role,
        is_banned = v_new_banned,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user', jsonb_build_object(
            'id', p_user_id,
            'role', v_new_role,
            'is_banned', v_new_banned
        )
    );
END;
$$;

-- 9. Métricas financieras del panel de administración.
DROP FUNCTION IF EXISTS public.fn_admin_overview(UUID);

CREATE OR REPLACE FUNCTION public.fn_admin_overview(p_caller_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_total_user_balances NUMERIC(18, 4);
    v_active_pools NUMERIC(18, 4);
    v_pending_withdrawals NUMERIC(18, 4);
    v_stats JSONB;
BEGIN
    SELECT role INTO v_role FROM public.users WHERE id = p_caller_id;
    IF v_role IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    SELECT COALESCE(SUM(balance), 0) INTO v_total_user_balances FROM public.users;
    SELECT COALESCE(SUM(total_pool), 0) INTO v_active_pools
    FROM public.markets WHERE status IN ('OPEN', 'CLOSED');
    SELECT COALESCE(SUM(amount), 0) INTO v_pending_withdrawals
    FROM public.transactions WHERE type = 'WITHDRAW' AND status = 'PENDING';

    SELECT jsonb_build_object(
        'total_users', (SELECT COUNT(*)::INTEGER FROM public.users),
        'total_user_balances', v_total_user_balances,
        'active_pools', v_active_pools,
        'pending_withdrawals', v_pending_withdrawals,
        'house_fees', (
            SELECT COALESCE(SUM(amount), 0) FROM public.transactions
            WHERE type = 'FEE_DEPOSIT' AND status = 'COMPLETED'
        ),
        'house_wins', (
            SELECT COALESCE(SUM(amount), 0) FROM public.transactions
            WHERE type = 'HOUSE_WIN' AND status = 'COMPLETED'
        ),
        'creator_wins', (
            SELECT COALESCE(SUM(amount), 0) FROM public.transactions
            WHERE type = 'CREATOR_WIN' AND status = 'COMPLETED'
        ),
        'total_deposits', (
            SELECT COALESCE(SUM(amount), 0) FROM public.transactions
            WHERE type = 'DEPOSIT' AND status = 'COMPLETED'
        ),
        'open_markets', (
            SELECT COUNT(*)::INTEGER FROM public.markets WHERE status IN ('OPEN', 'CLOSED')
        ),
        'total_markets', (SELECT COUNT(*)::INTEGER FROM public.markets),
        'active_bets', (
            SELECT COUNT(*)::INTEGER FROM public.bets WHERE status = 'ACTIVE'
        ),
        'expected_binance_balance', v_total_user_balances + v_active_pools + v_pending_withdrawals
    ) INTO v_stats;

    RETURN v_stats;
END;
$$;

-- 10. Marcar un depósito como fallido durante la reconciliación del panel
--     admin (Binance confirmó que la orden se cerró sin pago).
DROP FUNCTION IF EXISTS public.fn_fail_deposit(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.fn_fail_deposit(
    p_reference_id TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tx RECORD;
BEGIN
    IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Motivo obligatorio para marcar el depósito como fallido';
    END IF;

    SELECT * INTO v_tx
    FROM public.transactions
    WHERE reference_id = p_reference_id AND type = 'DEPOSIT'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe un depósito con esa referencia';
    END IF;

    IF v_tx.status = 'FAILED' THEN
        RETURN jsonb_build_object('success', true, 'already_failed', true);
    END IF;

    IF v_tx.status = 'COMPLETED' THEN
        RAISE EXCEPTION 'El depósito ya fue acreditado; no se puede marcar como fallido';
    END IF;

    UPDATE public.transactions
    SET status = 'FAILED',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'failed_at', timezone('utc'::text, now()),
            'failure_reason', left(trim(p_reason), 300)
        )
    WHERE id = v_tx.id;

    RETURN jsonb_build_object('success', true, 'marked_failed', true);
END;
$$;

-- ====================================================================
-- PERMISOS
-- Las RPC mueven dinero. Por defecto PostgreSQL las expone a PUBLIC,
-- así que se revocan explícitamente para anon/authenticated y solo
-- service_role (usado por los route handlers) puede ejecutarlas.
-- ====================================================================

REVOKE ALL ON FUNCTION public.fn_credit_deposit(UUID, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_place_bet(UUID, UUID, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_resolve_market(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_house_admin_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_close_market(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_cancel_market(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_start_withdrawal(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_refund_withdrawal(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_admin_update_user(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_admin_overview(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_fail_deposit(TEXT, TEXT) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.fn_credit_deposit(UUID, NUMERIC, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_place_bet(UUID, UUID, TEXT, NUMERIC) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_resolve_market(UUID, TEXT, UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_house_admin_id() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_close_market(UUID, UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_cancel_market(UUID, UUID, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_start_withdrawal(UUID, NUMERIC, TEXT, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_refund_withdrawal(UUID, NUMERIC, TEXT, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_admin_update_user(UUID, UUID, TEXT, BOOLEAN) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_admin_overview(UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_fail_deposit(TEXT, TEXT) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_credit_deposit(UUID, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_place_bet(UUID, UUID, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_resolve_market(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_close_market(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_cancel_market(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_start_withdrawal(UUID, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_refund_withdrawal(UUID, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_admin_update_user(UUID, UUID, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_admin_overview(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_fail_deposit(TEXT, TEXT) TO service_role;

-- La función de rol se usa en las políticas RLS de usuarios autenticados.
REVOKE ALL ON FUNCTION public.fn_current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_current_user_role() TO authenticated;

REVOKE ALL ON public.market_option_pools FROM PUBLIC;
REVOKE ALL ON public.market_option_pools FROM anon, authenticated;
GRANT SELECT ON public.market_option_pools TO service_role;

-- El trigger se ejecuta con los privilegios del owner; no necesita grants.
REVOKE ALL ON FUNCTION public.fn_handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_set_updated_at() FROM PUBLIC;

-- ====================================================================
-- NOTAS DE OPERACIÓN
-- ====================================================================
-- 1. Después de ejecutar este script, asigna el primer ADMIN manualmente:
--      UPDATE public.users SET role = 'ADMIN' WHERE email = 'tu-correo@gmail.com';
-- 2. La clave SUPABASE_SERVICE_ROLE_KEY nunca debe llegar al navegador.
-- 3. /api/webhooks/binance valida RSA-SHA256 con el certificado de Binance
--    correspondiente a Binancepay-Certificate-SN y es idempotente.
-- 4. Los retiros que quedan PENDING por errores de red se reconcilian desde
--    el panel admin (reembolsar o marcar completado). Los depósitos cuyo
--    webhook se perdió se consultan contra Binance (order/query) desde el
--    panel admin y se acreditan con fn_credit_deposit o se marcan FAILED
--    con fn_fail_deposit.
-- 5. Tope por usuario/mercado: máximo 150 USDT activos por persona en un
--    mismo mercado (fn_place_bet). Ajusta ese valor si el círculo crece.
-- 6. Tope de multiplicador: 20x máximo al liquidar (fn_resolve_market).
--    El excedente va a la casa como HOUSE_WIN. Para cambiarlo, ajusta el
--    literal 20.0000 en fn_resolve_market y PAYOUT_MULTIPLIER_CAP en
--    src/lib/constants.ts (deben coincidir).
-- 7. Comisión de recarga: 1.5% (fn_credit_deposit). Para cambiarla, ajusta
--    el literal 0.015 y DEPOSIT_FEE_RATE en src/lib/constants.ts.
-- 8. La casa es UNA sola cuenta: la primera ADMIN activa creada
--    (fn_house_admin_id). Toda la recaudación (comisión 1.5%, excedente del
--    tope 20x, pozo huérfano) va a esa única cuenta, nunca repartida entre
--    admins. No anuncies este reparto en la interfaz de usuarios normales.
-- ====================================================================
