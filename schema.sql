CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    category TEXT NOT NULL DEFAULT 'GENERAL' CONSTRAINT markets_category_valid CHECK (char_length(trim(category)) BETWEEN 2 AND 30),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bets_market_id ON public.bets(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON public.bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_market_option ON public.bets(market_id, selected_option);
CREATE INDEX IF NOT EXISTS idx_bets_status ON public.bets(status);
CREATE INDEX IF NOT EXISTS idx_markets_status ON public.markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_close_time ON public.markets(close_time);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON public.transactions(type, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

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
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now());

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_binance_uid ON public.users(binance_uid) WHERE binance_uid IS NOT NULL AND binance_uid != '1048652397';

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
ALTER TABLE public.markets ADD CONSTRAINT markets_category_valid CHECK (char_length(trim(category)) BETWEEN 2 AND 30);
ALTER TABLE public.markets ADD CONSTRAINT markets_options_shape CHECK (
    jsonb_typeof(options) = 'array'
    AND jsonb_array_length(options) BETWEEN 2 AND 10
);
ALTER TABLE public.markets ADD CONSTRAINT markets_status_valid CHECK (status IN ('OPEN', 'CLOSED', 'RESOLVED', 'CANCELLED'));
ALTER TABLE public.markets ADD CONSTRAINT markets_pool_non_negative CHECK (total_pool >= 0);

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

CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_base TEXT;
    v_username TEXT;
    v_suffix TEXT;
    v_attempt INTEGER := 0;
BEGIN
    v_base := lower(regexp_replace(split_part(COALESCE(NEW.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
    v_base := left(v_base, 20);

    IF char_length(v_base) < 3 THEN
        v_base := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
    END IF;

    v_username := v_base;

    LOOP
        BEGIN
            INSERT INTO public.users (id, username, email)
            VALUES (NEW.id, v_username, COALESCE(NULLIF(NEW.email, ''), NEW.id::text || '@users.local'))
            ON CONFLICT (id) DO NOTHING;
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            v_attempt := v_attempt + 1;
            v_suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
            v_username := left(v_base, 15) || '_' || v_suffix;
            IF v_attempt > 5 THEN
                v_username := 'u_' || substr(replace(NEW.id::text, '-', ''), 1, 12);
                INSERT INTO public.users (id, username, email)
                VALUES (NEW.id, v_username, COALESCE(NULLIF(NEW.email, ''), NEW.id::text || '@users.local'))
                ON CONFLICT (id) DO NOTHING;
                EXIT;
            END IF;
        END;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.users WHERE id = auth.uid() AND is_banned = FALSE;
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
    v_user RECORD;
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

    SELECT * INTO v_user
    FROM public.users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario no encontrado';
    END IF;

    IF v_user.is_banned THEN
        RAISE EXCEPTION 'Cuenta suspendida';
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

    IF abs(v_tx.amount - p_gross_amount) > 0.05 THEN
        RAISE EXCEPTION 'El monto del webhook no coincide con la orden';
    END IF;

    v_admin_id := public.fn_house_admin_id();

    IF v_admin_id IS NULL THEN
        v_fee_amount := 0;
    ELSE
        v_fee_amount := ROUND(p_gross_amount * 0.015, 2);
    END IF;

    v_net_amount := p_gross_amount - v_fee_amount;

    UPDATE public.transactions
    SET status = 'COMPLETED',
        amount = v_net_amount,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'gross_amount', p_gross_amount,
            'fee_amount', v_fee_amount,
            'net_amount', v_net_amount,
            'fee_rate', 0.015,
            'credited_at', timezone('utc', now())
        ),
        updated_at = timezone('utc', now())
    WHERE id = v_tx.id;

    IF v_fee_amount > 0 AND v_admin_id IS NOT NULL THEN
        UPDATE public.users
        SET balance = balance + v_fee_amount,
            updated_at = timezone('utc', now())
        WHERE id = v_admin_id;

        INSERT INTO public.transactions (user_id, type, amount, status, metadata)
        VALUES (
            v_admin_id,
            'FEE_DEPOSIT',
            v_fee_amount,
            'COMPLETED',
            jsonb_build_object(
                'deposit_tx_id', v_tx.id,
                'source_user_id', p_user_id,
                'gross_amount', p_gross_amount,
                'fee_rate', 0.015
            )
        );
    END IF;

    UPDATE public.users
    SET balance = balance + v_net_amount,
        updated_at = timezone('utc', now())
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'gross_amount', p_gross_amount,
        'fee_amount', v_fee_amount,
        'net_amount', v_net_amount
    );
END;
$$;

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
    v_caller_banned BOOLEAN;
    v_admin_id UUID;
    v_total_winning_pool NUMERIC(18, 4) := 0;
    v_winner_count INTEGER := 0;
    v_processed_winners INTEGER := 0;
    v_bet RECORD;
    v_user_payout NUMERIC(18, 4);
    v_remaining_pool NUMERIC(18, 4);
    v_distributable_pool NUMERIC(18, 4);
    v_house_surplus NUMERIC(18, 4) := 0;
    v_creator_cut NUMERIC(18, 4) := 0;
    v_house_cut NUMERIC(18, 4) := 0;
    v_loser_count INTEGER := 0;
BEGIN
    SELECT role, is_banned INTO v_caller_role, v_caller_banned FROM public.users WHERE id = p_caller_id;
    IF v_caller_banned THEN
        RAISE EXCEPTION 'Cuenta suspendida';
    END IF;
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

    IF v_caller_role = 'MODERATOR' THEN
        IF v_market.creator_id = p_caller_id THEN
            RAISE EXCEPTION 'Conflicto de interés: no puedes certificar un mercado que creaste.';
        END IF;
        IF EXISTS (SELECT 1 FROM public.bets WHERE market_id = p_market_id AND user_id = p_caller_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Conflicto de interés: no puedes certificar un mercado donde tienes apuestas activas.';
        END IF;
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

    IF v_winner_count = 0 THEN
        UPDATE public.bets
        SET status = 'LOST'
        WHERE market_id = p_market_id AND status = 'ACTIVE';

        GET DIAGNOSTICS v_loser_count = ROW_COUNT;

        IF v_admin_id IS NULL THEN
            RAISE EXCEPTION 'No hay un administrador activo para recibir el pozo';
        END IF;

        IF v_market.creator_id IS NOT NULL AND v_market.creator_id <> v_admin_id THEN
            v_creator_cut := ROUND(v_market.total_pool * 0.30, 2);
            v_house_cut := v_market.total_pool - v_creator_cut;

            IF v_creator_cut > 0 THEN
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
            END IF;
        ELSE
            v_house_cut := v_market.total_pool;
        END IF;

        IF v_house_cut > 0 THEN
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
        END IF;

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

    IF v_admin_id IS NOT NULL AND v_market.total_pool > (v_total_winning_pool * 20.0000) THEN
        v_distributable_pool := ROUND(v_total_winning_pool * 20.0000, 2);
        v_house_surplus := v_market.total_pool - v_distributable_pool;
    ELSE
        v_distributable_pool := v_market.total_pool;
        v_house_surplus := 0;
    END IF;

    v_remaining_pool := v_distributable_pool;

    FOR v_bet IN
        SELECT *
        FROM public.bets
        WHERE market_id = p_market_id AND status = 'ACTIVE'
        ORDER BY user_id ASC, created_at ASC, id ASC
    LOOP
        IF v_bet.selected_option = p_winning_option THEN
            v_processed_winners := v_processed_winners + 1;

            IF v_processed_winners = v_winner_count THEN
                v_user_payout := v_remaining_pool;
            ELSE
                v_user_payout := ROUND(
                    (v_bet.amount / v_total_winning_pool) * v_distributable_pool,
                    2
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

    IF v_house_surplus > 0 AND v_admin_id IS NOT NULL THEN
        IF v_market.creator_id IS NOT NULL AND v_market.creator_id <> v_admin_id THEN
            v_creator_cut := ROUND(v_house_surplus * 0.30, 2);
            v_house_cut := v_house_surplus - v_creator_cut;

            IF v_creator_cut > 0 THEN
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
                        'note', '30% del excedente de 20x por ser el creador'
                    )
                );
            END IF;
        ELSE
            v_house_cut := v_house_surplus;
        END IF;

        IF v_house_cut > 0 THEN
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
                jsonb_build_object(
                    'market_id', p_market_id,
                    'note', 'Excedente del tope de multiplicador (20x)'
                )
            );
        END IF;
    END IF;

    UPDATE public.markets
    SET status = 'RESOLVED',
        winning_option = p_winning_option,
        resolved_by = p_caller_id
    WHERE id = p_market_id;

    RETURN jsonb_build_object(
        'success', true,
        'case', 'RESOLVED_WITH_WINNERS',
        'winning_pool', v_total_winning_pool,
        'distributable_pool', v_distributable_pool,
        'house_surplus', v_house_surplus,
        'creator_cut', v_creator_cut,
        'house_cut', v_house_cut,
        'winners', v_winner_count
    );
END;
$$;

DROP FUNCTION IF EXISTS public.fn_close_market(UUID, UUID);

CREATE OR REPLACE FUNCTION public.fn_close_market(p_market_id UUID, p_caller_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_banned BOOLEAN;
    v_status TEXT;
BEGIN
    SELECT role, is_banned INTO v_role, v_banned FROM public.users WHERE id = p_caller_id;
    IF v_banned THEN
        RAISE EXCEPTION 'Cuenta suspendida';
    END IF;
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
    v_banned BOOLEAN;
    v_market RECORD;
    v_bet RECORD;
    v_refunded_total NUMERIC(18, 4) := 0;
    v_refunded_count INTEGER := 0;
BEGIN
    SELECT role, is_banned INTO v_role, v_banned FROM public.users WHERE id = p_caller_id;
    IF v_banned THEN
        RAISE EXCEPTION 'Cuenta suspendida';
    END IF;
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

    IF v_role = 'MODERATOR' THEN
        IF v_market.creator_id = p_caller_id THEN
            RAISE EXCEPTION 'Conflicto de interés: no puedes cancelar un mercado que creaste.';
        END IF;
        IF EXISTS (SELECT 1 FROM public.bets WHERE market_id = p_market_id AND user_id = p_caller_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Conflicto de interés: no puedes cancelar un mercado donde tienes apuestas activas.';
        END IF;
    END IF;

    IF v_market.status NOT IN ('OPEN', 'CLOSED') THEN
        RAISE EXCEPTION 'El mercado no se puede cancelar en su estado actual';
    END IF;

    FOR v_bet IN
        SELECT * FROM public.bets
        WHERE market_id = p_market_id AND status = 'ACTIVE'
        ORDER BY user_id ASC, id ASC
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

DROP FUNCTION IF EXISTS public.fn_start_withdrawal(UUID, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.fn_start_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.fn_start_withdrawal(
    p_user_id UUID,
    p_amount NUMERIC(18, 4),
    p_destination TEXT,
    p_request_id TEXT,
    p_method TEXT DEFAULT 'BINANCE_PAY'
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
    v_method TEXT := UPPER(COALESCE(p_method, 'BINANCE_PAY'));
    v_is_admin_self BOOLEAN := FALSE;
    v_tx_status TEXT := 'PENDING';
    v_tx_metadata JSONB;
BEGIN
    IF p_amount IS NULL OR p_amount < 0.0100 OR p_amount > 10000.0000 THEN
        RAISE EXCEPTION 'El retiro debe estar entre 0.01 y 10000.00 USDT';
    END IF;

    SELECT * INTO v_user
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario no encontrado';
    END IF;

    IF v_user.is_banned THEN
        RAISE EXCEPTION 'Tu cuenta está suspendida. No puedes realizar retiros.';
    END IF;

    IF v_method = 'BINANCE_PAY' THEN
        IF p_destination IS NULL OR p_destination !~ '^[0-9]{8,10}$' THEN
            RAISE EXCEPTION 'Binance UID inválido (debe contener entre 8 y 10 dígitos)';
        END IF;

        IF p_destination = '1048652397' THEN
            IF v_user.email NOT IN ('rem.dev2509@gmail.com', 'eduardo20052509@gmail.com') AND v_user.role <> 'ADMIN' THEN
                RAISE EXCEPTION 'No puedes utilizar el Binance ID de la administración como destino de retiro';
            END IF;
            v_is_admin_self := TRUE;
            v_tx_status := 'COMPLETED';
        END IF;
    ELSIF v_method = 'BEP20' THEN
        IF p_destination IS NULL OR p_destination !~ '^0x[a-fA-F0-9]{40}$' THEN
            RAISE EXCEPTION 'Dirección BEP-20 inválida (debe ser formato 0x de 42 caracteres)';
        END IF;
    ELSE
        RAISE EXCEPTION 'Método de retiro inválido';
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
            'remaining_balance', v_new_balance,
            'is_admin_self', v_is_admin_self
        );
    END IF;

    IF v_user.balance < p_amount THEN
        RAISE EXCEPTION 'Saldo insuficiente';
    END IF;

    UPDATE public.users
    SET balance = balance - p_amount,
        binance_uid = CASE WHEN v_method = 'BINANCE_PAY' THEN p_destination ELSE binance_uid END,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    SELECT balance INTO v_new_balance FROM public.users WHERE id = p_user_id;

    IF v_is_admin_self THEN
        v_tx_metadata := jsonb_build_object(
            'method', 'BINANCE_PAY',
            'destination', p_destination,
            'binance_uid', p_destination,
            'is_admin_self_withdrawal', true,
            'request_id', p_request_id,
            'completed_at', timezone('utc'::text, now()),
            'note', 'Retiro contable inmediato de la administración. Fondos ya disponibles en la cuenta de Binance.'
        );
    ELSE
        v_tx_metadata := jsonb_build_object(
            'method', v_method,
            'destination', p_destination,
            'binance_uid', CASE WHEN v_method = 'BINANCE_PAY' THEN p_destination ELSE NULL END,
            'bep20_address', CASE WHEN v_method = 'BEP20' THEN p_destination ELSE NULL END,
            'request_id', p_request_id,
            'disbursed_at', null
        );
    END IF;

    INSERT INTO public.transactions (user_id, type, amount, status, reference_id, metadata)
    VALUES (
        p_user_id,
        'WITHDRAW',
        p_amount,
        v_tx_status,
        p_request_id,
        v_tx_metadata
    );

    RETURN jsonb_build_object(
        'success', true,
        'remaining_balance', v_new_balance,
        'is_admin_self', v_is_admin_self
    );
END;
$$;

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
    v_admin_banned BOOLEAN;
    v_target RECORD;
    v_new_role TEXT;
    v_new_banned BOOLEAN;
    v_active_admins INTEGER;
BEGIN
    SELECT role, is_banned INTO v_admin_role, v_admin_banned FROM public.users WHERE id = p_admin_id FOR UPDATE;
    IF v_admin_banned THEN
        RAISE EXCEPTION 'Cuenta suspendida';
    END IF;
    IF v_admin_role IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    PERFORM 1 FROM public.users WHERE role = 'ADMIN' FOR UPDATE;

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

DROP FUNCTION IF EXISTS public.fn_admin_overview(UUID);

CREATE OR REPLACE FUNCTION public.fn_admin_overview(p_caller_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_banned BOOLEAN;
    v_total_user_balances NUMERIC(18, 4);
    v_active_pools NUMERIC(18, 4);
    v_pending_withdrawals NUMERIC(18, 4);
    v_stats JSONB;
BEGIN
    SELECT role, is_banned INTO v_role, v_banned FROM public.users WHERE id = p_caller_id;
    IF v_banned THEN
        RAISE EXCEPTION 'Cuenta suspendida';
    END IF;
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

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.markets TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

REVOKE ALL ON FUNCTION public.fn_credit_deposit(UUID, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_place_bet(UUID, UUID, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_resolve_market(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_house_admin_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_close_market(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_cancel_market(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_start_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
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
REVOKE ALL ON FUNCTION public.fn_start_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_refund_withdrawal(UUID, NUMERIC, TEXT, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_admin_update_user(UUID, UUID, TEXT, BOOLEAN) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_admin_overview(UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_fail_deposit(TEXT, TEXT) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_credit_deposit(UUID, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_place_bet(UUID, UUID, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_resolve_market(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_close_market(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_cancel_market(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_start_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_refund_withdrawal(UUID, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_admin_update_user(UUID, UUID, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_admin_overview(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_fail_deposit(TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.fn_current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_current_user_role() TO authenticated;

REVOKE ALL ON public.market_option_pools FROM PUBLIC;
REVOKE ALL ON public.market_option_pools FROM anon, authenticated;
GRANT SELECT ON public.market_option_pools TO service_role;

REVOKE ALL ON FUNCTION public.fn_handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_set_updated_at() FROM PUBLIC;
-- =========================================================================
-- MIGRATION: GRUPOS Y APUESTAS PRIVADAS
-- =========================================================================

-- 1. Tabla groups
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL CONSTRAINT groups_name_length CHECK (char_length(trim(name)) BETWEEN 2 AND 60),
    description TEXT,
    creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    invite_code VARCHAR(16) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_groups_creator_id ON public.groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON public.groups(invite_code);

-- 2. Tabla group_members
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'MEMBER' CONSTRAINT group_members_role_valid CHECK (role IN ('CREATOR', 'ADMIN', 'MEMBER')),
    status TEXT NOT NULL DEFAULT 'PENDING' CONSTRAINT group_members_status_valid CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT group_members_unique_user UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_user ON public.group_members(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_status ON public.group_members(user_id, status);

-- 3. Ampliación de markets
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'markets' AND column_name = 'visibility'
    ) THEN
        ALTER TABLE public.markets ADD COLUMN visibility TEXT NOT NULL DEFAULT 'PUBLIC' 
            CONSTRAINT markets_visibility_valid CHECK (visibility IN ('PUBLIC', 'GROUP', 'PRIVATE_CODE'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'markets' AND column_name = 'group_id'
    ) THEN
        ALTER TABLE public.markets ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'markets' AND column_name = 'access_code'
    ) THEN
        ALTER TABLE public.markets ADD COLUMN access_code VARCHAR(16);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_markets_visibility ON public.markets(visibility);
CREATE INDEX IF NOT EXISTS idx_markets_group_id ON public.markets(group_id);
CREATE INDEX IF NOT EXISTS idx_markets_access_code ON public.markets(access_code);

-- 4. Función atómica para crear un grupo
CREATE OR REPLACE FUNCTION public.fn_create_group(
    p_creator_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_group_id UUID;
    v_invite_code TEXT;
    v_clean_name TEXT;
    v_group RECORD;
BEGIN
    v_clean_name := trim(p_name);
    IF char_length(v_clean_name) < 2 OR char_length(v_clean_name) > 60 THEN
        RAISE EXCEPTION 'El nombre del grupo debe tener entre 2 y 60 caracteres';
    END IF;

    -- Generar código único aleatorio tipo GRP-XXXXXX
    v_invite_code := 'GRP-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    WHILE EXISTS (SELECT 1 FROM public.groups WHERE invite_code = v_invite_code) LOOP
        v_invite_code := 'GRP-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    END LOOP;

    INSERT INTO public.groups (name, description, creator_id, invite_code)
    VALUES (v_clean_name, p_description, p_creator_id, v_invite_code)
    RETURNING * INTO v_group;

    -- El creador es miembro automático APROBADO
    INSERT INTO public.group_members (group_id, user_id, role, status, approved_at, approved_by)
    VALUES (v_group.id, p_creator_id, 'CREATOR', 'APPROVED', timezone('utc'::text, now()), p_creator_id);

    RETURN jsonb_build_object(
        'success', true,
        'group', jsonb_build_object(
            'id', v_group.id,
            'name', v_group.name,
            'description', v_group.description,
            'creatorId', v_group.creator_id,
            'inviteCode', v_group.invite_code,
            'createdAt', v_group.created_at
        )
    );
END;
$$;

-- 5. Función para solicitar unirse a un grupo
CREATE OR REPLACE FUNCTION public.fn_request_join_group(
    p_user_id UUID,
    p_invite_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_group RECORD;
    v_existing RECORD;
    v_clean_code TEXT;
BEGIN
    v_clean_code := upper(trim(p_invite_code));
    SELECT * INTO v_group
    FROM public.groups
    WHERE upper(invite_code) = v_clean_code AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Código de grupo inválido o grupo no encontrado';
    END IF;

    SELECT * INTO v_existing
    FROM public.group_members
    WHERE group_id = v_group.id AND user_id = p_user_id;

    IF FOUND THEN
        IF v_existing.status = 'APPROVED' THEN
            RETURN jsonb_build_object('success', true, 'status', 'APPROVED', 'message', 'Ya eres miembro de este grupo', 'group', row_to_json(v_group));
        ELSIF v_existing.status = 'PENDING' THEN
            RETURN jsonb_build_object('success', true, 'status', 'PENDING', 'message', 'Tu solicitud ya está en espera de aprobación por el creador', 'group', row_to_json(v_group));
        ELSE
            -- Reactivar solicitud si fue rechazada antes
            UPDATE public.group_members
            SET status = 'PENDING', requested_at = timezone('utc'::text, now()), approved_at = NULL, approved_by = NULL
            WHERE id = v_existing.id;
            RETURN jsonb_build_object('success', true, 'status', 'PENDING', 'message', 'Solicitud reenviada al creador del grupo', 'group', row_to_json(v_group));
        END IF;
    END IF;

    INSERT INTO public.group_members (group_id, user_id, role, status)
    VALUES (v_group.id, p_user_id, 'MEMBER', 'PENDING');

    RETURN jsonb_build_object(
        'success', true,
        'status', 'PENDING',
        'message', 'Solicitud enviada al creador del grupo',
        'group', jsonb_build_object(
            'id', v_group.id,
            'name', v_group.name,
            'description', v_group.description,
            'inviteCode', v_group.invite_code
        )
    );
END;
$$;

-- 6. Función para que el creador apruebe/rechace miembros
CREATE OR REPLACE FUNCTION public.fn_manage_group_member(
    p_admin_user_id UUID,
    p_group_id UUID,
    p_target_user_id UUID,
    p_action TEXT -- 'APPROVE', 'REJECT', 'REMOVE'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_user_role TEXT;
BEGIN
    -- Verificar si es el creador del grupo o admin global
    SELECT role INTO v_user_role FROM public.users WHERE id = p_admin_user_id;

    SELECT EXISTS (
        SELECT 1 FROM public.groups WHERE id = p_group_id AND creator_id = p_admin_user_id
    ) INTO v_is_admin;

    IF NOT v_is_admin AND v_user_role <> 'ADMIN' THEN
        RAISE EXCEPTION 'Sólo el creador del grupo puede gestionar miembros';
    END IF;

    IF p_action = 'APPROVE' THEN
        UPDATE public.group_members
        SET status = 'APPROVED', approved_at = timezone('utc'::text, now()), approved_by = p_admin_user_id
        WHERE group_id = p_group_id AND user_id = p_target_user_id;
    ELSIF p_action = 'REJECT' THEN
        UPDATE public.group_members
        SET status = 'REJECTED'
        WHERE group_id = p_group_id AND user_id = p_target_user_id;
    ELSIF p_action = 'REMOVE' THEN
        DELETE FROM public.group_members
        WHERE group_id = p_group_id AND user_id = p_target_user_id AND role <> 'CREATOR';
    ELSE
        RAISE EXCEPTION 'Acción inválida. Usa APPROVE, REJECT o REMOVE';
    END IF;

    RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$;

-- 7. Actualizar fn_place_bet para validar permisos en mercados GROUP y PRIVATE_CODE
CREATE OR REPLACE FUNCTION public.fn_place_bet(
    p_user_id UUID,
    p_market_id UUID,
    p_option TEXT,
    p_amount NUMERIC(18, 4),
    p_access_code TEXT DEFAULT NULL
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

    -- Validar VISIBILIDAD DE GRUPO
    IF v_market.visibility = 'GROUP' AND v_market.group_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_id = v_market.group_id
              AND user_id = p_user_id
              AND status = 'APPROVED'
        ) THEN
            RAISE EXCEPTION 'Esta apuesta es privada para miembros aprobados del grupo';
        END IF;
    END IF;

    -- Validar VISIBILIDAD POR CÓDIGO
    IF v_market.visibility = 'PRIVATE_CODE' AND v_market.access_code IS NOT NULL THEN
        -- Si el usuario ya tiene una apuesta previa en este mercado, se considera autorizado
        IF NOT EXISTS (
            SELECT 1 FROM public.bets WHERE market_id = p_market_id AND user_id = p_user_id
        ) THEN
            IF p_access_code IS NULL OR upper(trim(p_access_code)) <> upper(trim(v_market.access_code)) THEN
                RAISE EXCEPTION 'Código de acceso privado incorrecto o requerido';
            END IF;
        END IF;
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

    SELECT COALESCE(SUM(amount), 0) INTO v_user_market_total
    FROM public.bets
    WHERE market_id = p_market_id
      AND user_id = p_user_id
      AND status = 'ACTIVE';

    IF v_user_market_total + p_amount > 150.0000 THEN
        RAISE EXCEPTION 'Tope de 150 USDT apostados por usuario en este mercado (ya llevas %s)', v_user_market_total;
    END IF;

    v_new_balance := v_user.balance - p_amount;

    UPDATE public.users
    SET balance = v_new_balance
    WHERE id = p_user_id;

    UPDATE public.markets
    SET total_pool = total_pool + p_amount
    WHERE id = p_market_id;

    INSERT INTO public.bets (
        market_id,
        user_id,
        selected_option,
        amount,
        status
    )
    VALUES (
        p_market_id,
        p_user_id,
        p_option,
        p_amount,
        'ACTIVE'
    )
    RETURNING id INTO v_bet_id;

    INSERT INTO public.transactions (
        user_id,
        type,
        amount,
        status,
        metadata
    )
    VALUES (
        p_user_id,
        'BET',
        p_amount,
        'COMPLETED',
        jsonb_build_object(
            'betId', v_bet_id,
            'marketId', p_market_id,
            'option', p_option,
            'marketTitle', v_market.title
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'betId', v_bet_id,
        'newBalance', v_new_balance,
        'totalPool', v_market.total_pool + p_amount
    );
END;
$$;

-- RLS y permisos
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.groups TO service_role;
GRANT SELECT, INSERT ON TABLE public.groups TO authenticated;
GRANT SELECT ON TABLE public.groups TO anon;

GRANT ALL ON TABLE public.group_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_members TO authenticated;
GRANT SELECT ON TABLE public.group_members TO anon;

-- Políticas de groups
DROP POLICY IF EXISTS groups_read_policy ON public.groups;
CREATE POLICY groups_read_policy ON public.groups
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS groups_insert_policy ON public.groups;
CREATE POLICY groups_insert_policy ON public.groups
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = creator_id);

-- Políticas de group_members
DROP POLICY IF EXISTS group_members_read_policy ON public.group_members;
CREATE POLICY group_members_read_policy ON public.group_members
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS group_members_all_service ON public.group_members;
CREATE POLICY group_members_all_service ON public.group_members
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
