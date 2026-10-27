'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Search,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { AdminDashboard } from '@/components/AdminDashboard';
import { BetSlip } from '@/components/BetSlip';
import { CreateMarketModal } from '@/components/CreateMarketModal';
import { DepositModal } from '@/components/DepositModal';
import { CancelMarketModal, ResolveMarketModal } from '@/components/MarketActions';
import { MarketCard } from '@/components/MarketCard';
import { MobileNav, Header } from '@/components/Navigation';
import { ModerationPanel } from '@/components/ModerationPanel';
import { MyBets } from '@/components/MyBets';
import { EmptyState, ErrorBanner } from '@/components/ui';
import { WalletView } from '@/components/WalletView';
import { WithdrawModal } from '@/components/WithdrawModal';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { MARKET_CATEGORIES, MARKET_CATEGORY_LABELS } from '@/lib/constants';
import { formatUsdt } from '@/lib/format';
import type {
  AdminOverview,
  AppTab,
  BetsResponse,
  BetRecord,
  MarketCategory,
  MarketsResponse,
  MarketSummary,
  TransactionRecord,
  TransactionsResponse,
  UserProfile,
} from '@/lib/types';

type StatusFilter = 'PLAYING' | 'OPEN' | 'CLOSED' | 'RESOLVED' | 'CANCELLED' | 'ALL';
type CategoryFilter = 'TODOS' | MarketCategory;
type ToastType = 'success' | 'warn' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface BetSlipState {
  market: MarketSummary;
  option: string;
}

const statusFilters: Array<{ id: StatusFilter; label: string }> = [
  { id: 'PLAYING', label: 'EN JUEGO' },
  { id: 'OPEN', label: 'ABIERTOS' },
  { id: 'CLOSED', label: 'EN CURSO' },
  { id: 'RESOLVED', label: 'FINALIZADOS' },
  { id: 'CANCELLED', label: 'CANCELADOS' },
  { id: 'ALL', label: 'TODOS' },
];

const toastStyles: Record<ToastType, string> = {
  success: 'border-[#00f090]/40 bg-[#121f18] text-[#00f090]',
  warn: 'border-[#f59e0b]/40 bg-[#181511] text-[#fbbf24]',
  error: 'border-[#f43f5e]/40 bg-[#1f1113] text-[#fda4af]',
};

export function Terminal({
  profile,
  refreshProfile,
  onLogout,
}: {
  profile: UserProfile;
  refreshProfile: () => Promise<UserProfile>;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<AppTab>('EXPLORE');
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [betsLoading, setBetsLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(true);
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [betsError, setBetsError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('TODOS');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PLAYING');

  const [betSlip, setBetSlip] = useState<BetSlipState | null>(null);
  const [placing, setPlacing] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [resolveMarket, setResolveMarket] = useState<MarketSummary | null>(null);
  const [cancelMarket, setCancelMarket] = useState<MarketSummary | null>(null);

  const role = profile.role;

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const loadMarkets = useCallback(async (silent = false) => {
    if (!silent) setMarketsLoading(true);
    try {
      const response = await apiFetch<MarketsResponse>('/api/markets');
      setMarkets(response.markets);
      setLastUpdated(new Date());
      setMarketsError(null);
    } catch (loadError) {
      setMarketsError(errorMessage(loadError));
    } finally {
      setMarketsLoading(false);
    }
  }, []);

  const loadBets = useCallback(async (silent = false) => {
    if (!silent) setBetsLoading(true);
    try {
      const response = await apiFetch<BetsResponse>('/api/bets/mine');
      setBets(response.bets);
      setBetsError(null);
    } catch (loadError) {
      setBetsError(errorMessage(loadError));
    } finally {
      setBetsLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async (silent = false) => {
    if (!silent) setWalletLoading(true);
    try {
      const response = await apiFetch<TransactionsResponse>('/api/transactions/mine');
      setTransactions(response.transactions);
      setWalletError(null);
    } catch (loadError) {
      setWalletError(errorMessage(loadError));
    } finally {
      setWalletLoading(false);
    }
  }, []);

  const loadAdmin = useCallback(async (silent = false) => {
    if (!silent) setAdminLoading(true);
    try {
      const response = await apiFetch<AdminOverview>('/api/admin/overview');
      setAdminOverview(response);
      setAdminError(null);
    } catch (loadError) {
      setAdminError(errorMessage(loadError));
    } finally {
      setAdminLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMarkets(true);
      void loadBets(true);
      void loadTransactions(true);
      if (role === 'ADMIN') void loadAdmin(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [role, loadMarkets, loadBets, loadTransactions, loadAdmin]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadMarkets(true);
      void loadBets(true);
      void loadTransactions(true);
      void refreshProfile().catch(() => {});
      if (role === 'ADMIN') void loadAdmin(true);
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [role, loadMarkets, loadBets, loadTransactions, loadAdmin, refreshProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const walletState = params.get('wallet');
    if (walletState !== 'deposit-success' && walletState !== 'deposit-cancelled') return;

    const timer = window.setTimeout(() => {
      showToast(
        walletState === 'deposit-success'
          ? 'Pago recibido. La acreditación automática puede tardar unos segundos.'
          : 'Orden de recarga cancelada. No se realizó ningún cargo.',
        walletState === 'deposit-success' ? 'success' : 'warn'
      );
    }, 0);

    params.delete('wallet');
    const nextQuery = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
    );

    return () => window.clearTimeout(timer);
  }, [showToast]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      refreshProfile(),
      loadMarkets(true),
      loadBets(true),
      loadTransactions(true),
      ...(role === 'ADMIN' ? [loadAdmin(true)] : []),
    ]);
    setRefreshing(false);
  }, [refreshProfile, loadMarkets, loadBets, loadTransactions, loadAdmin, role]);

  const effectiveTab: AppTab =
    role === 'ADMIN'
      ? activeTab
      : role === 'MODERATOR'
        ? activeTab === 'ADMIN'
          ? 'MODERATION'
          : activeTab
        : activeTab === 'ADMIN' || activeTab === 'MODERATION'
          ? 'EXPLORE'
          : activeTab;

  const handleNavigate = (tab: AppTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlaceBet = async (amount: number) => {
    if (!betSlip) return;
    setPlacing(true);
    try {
      const response = await apiFetch<{ message: string }>('/api/bets/place', {
        method: 'POST',
        body: JSON.stringify({
          marketId: betSlip.market.id,
          selectedOption: betSlip.option,
          amount,
        }),
      });
      showToast(response.message || 'Apuesta registrada con éxito', 'success');
      setBetSlip(null);
      await Promise.allSettled([
        refreshProfile(),
        loadMarkets(true),
        loadBets(true),
        loadTransactions(true),
      ]);
    } catch (betError) {
      showToast(errorMessage(betError), 'error');
    } finally {
      setPlacing(false);
    }
  };

  const handleResolutionChanged = async () => {
    await Promise.allSettled([
      refreshProfile(),
      loadMarkets(true),
      loadBets(true),
      loadTransactions(true),
      ...(role === 'ADMIN' ? [loadAdmin(true)] : []),
    ]);
  };

  const openBetSlip = (market: MarketSummary, option: string) => {
    setBetSlip({ market, option });
  };

  const userActiveInMarket = useMemo(() => {
    if (!betSlip) return 0;
    return bets
      .filter((b) => b.marketId === betSlip.market.id && b.status === 'ACTIVE')
      .reduce((sum, b) => sum + (Number.parseFloat(b.amount) || 0), 0);
  }, [bets, betSlip]);

  const filteredMarkets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');

    const statusMatch = (market: MarketSummary) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PLAYING') {
        return market.status === 'OPEN' || market.status === 'CLOSED';
      }
      return market.status === statusFilter;
    };

    const categoryMatch = (market: MarketSummary) =>
      categoryFilter === 'TODOS' || market.category === categoryFilter;

    const searchMatch = (market: MarketSummary) => {
      if (!query) return true;
      return (
        market.title.toLocaleLowerCase('es').includes(query) ||
        (market.description ?? '').toLocaleLowerCase('es').includes(query) ||
        market.creatorUsername.toLocaleLowerCase('es').includes(query) ||
        market.options.some((option) => option.toLocaleLowerCase('es').includes(query))
      );
    };

    const statusOrder: Record<MarketSummary['status'], number> = {
      OPEN: 0,
      CLOSED: 1,
      RESOLVED: 2,
      CANCELLED: 3,
    };

    return markets
      .filter((market) => statusMatch(market) && categoryMatch(market) && searchMatch(market))
      .sort((a, b) => {
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [markets, search, statusFilter, categoryFilter]);

  const activePool = useMemo(
    () =>
      markets
        .filter((market) => market.status === 'OPEN' || market.status === 'CLOSED')
        .reduce((sum, market) => sum + (Number.parseFloat(market.totalPool) || 0), 0),
    [markets]
  );

  const openCount = useMemo(
    () => markets.filter((market) => market.status === 'OPEN').length,
    [markets]
  );

  const activeBets = useMemo(() => bets.filter((bet) => bet.status === 'ACTIVE'), [bets]);
  const activeBetsAmount = useMemo(
    () => activeBets.reduce((sum, bet) => sum + (Number.parseFloat(bet.amount) || 0), 0),
    [activeBets]
  );

  const recentBets = useMemo(() => bets.slice(0, 3), [bets]);
  const isStaff = role === 'ADMIN' || role === 'MODERATOR';

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        profile={profile}
        activeTab={effectiveTab}
        onNavigate={handleNavigate}
        onDeposit={() => setShowDeposit(true)}
        onWithdraw={() => setShowWithdraw(true)}
        onCreate={() => setShowCreate(true)}
        onLogout={onLogout}
        onRefresh={() => void refreshAll()}
        refreshing={refreshing}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-5 md:pb-8">
        {effectiveTab === 'EXPLORE' ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="min-w-0 space-y-4">
              <section className="rounded-lg border border-[#1e2330] bg-[#11141c] p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#00f090]">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00f090] opacity-50" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00f090]" />
                      </span>
                      Mercados en vivo
                    </div>
                    <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
                      Apuesta contra el pozo, no contra la casa
                    </h1>
                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
                      Cada opción acumula su propio pozo. Al cerrar el mercado, el 100% del
                      dinero se reparte entre quienes acertaron.
                    </p>
                  </div>
                  <div className="shrink-0 rounded border border-[#1d222e] bg-[#0c0e14] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wide text-slate-500">
                    <span className="text-[#00f090]">●</span> En vivo
                    <span className="mx-1.5 text-slate-700">|</span>
                    {lastUpdated ? lastUpdated.toLocaleTimeString('es-VE') : '—'}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <HeroStat label="Mercados abiertos" value={String(openCount)} />
                  <HeroStat
                    label="Pozo en juego"
                    value={`$${formatUsdt(activePool)}`}
                    tone="text-[#00f090]"
                  />
                  <HeroStat
                    label="Tus apuestas activas"
                    value={`$${formatUsdt(activeBetsAmount)}`}
                    hint={`${activeBets.length} tickets`}
                  />
                  <HeroStat
                    label="Comisión de entrada"
                    value="1.5%"
                    hint="Solo al recargar"
                    tone="text-[#fbbf24]"
                  />
                </div>
              </section>

              <div className="space-y-2.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar mercado, opción o creador…"
                      className="w-full rounded border border-[#222736] bg-[#11141c] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
                    />
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(event) =>
                      setCategoryFilter(event.target.value as CategoryFilter)
                    }
                    aria-label="Filtrar por categoría"
                    className="rounded border border-[#222736] bg-[#11141c] px-2.5 py-2 font-mono text-[11px] font-bold text-slate-200 focus:border-[#00f090] focus:outline-none"
                  >
                    <option value="TODOS">TODAS LAS CATEGORÍAS</option>
                    {MARKET_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {MARKET_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-1">
                  {statusFilters.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setStatusFilter(filter.id)}
                      className={`rounded border px-2.5 py-1 font-mono text-[10px] font-bold transition ${
                        statusFilter === filter.id
                          ? 'border-[#00f090]/40 bg-[#121f18] text-[#00f090]'
                          : 'border-[#222736] bg-[#11141c] text-slate-400 hover:text-white'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {marketsError ? (
                <ErrorBanner message={marketsError} onRetry={() => void loadMarkets()} />
              ) : null}

              {marketsLoading && markets.length === 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {[0, 1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-80 animate-pulse rounded-lg border border-[#1e2330] bg-[#11141c]"
                    />
                  ))}
                </div>
              ) : filteredMarkets.length === 0 ? (
                <EmptyState
                  icon={<Trophy className="h-6 w-6" />}
                  title={markets.length === 0 ? 'Todavía no hay mercados' : 'Sin resultados'}
                  description={
                    markets.length === 0
                      ? 'Sé el primero en crear una predicción para tu grupo. Define el cierre y las opciones.'
                      : 'Cambia la búsqueda o los filtros para ver otros mercados.'
                  }
                  action={
                    <button
                      type="button"
                      onClick={() => setShowCreate(true)}
                      className="flex items-center gap-1.5 rounded bg-[#00f090] px-3 py-1.5 text-xs font-bold text-black transition hover:bg-[#00d681]"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Crear mercado
                    </button>
                  }
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredMarkets.map((market) => (
                    <MarketCard key={market.id} market={market} onSelectOption={openBetSlip} />
                  ))}
                </div>
              )}
            </div>

            <aside className="hidden space-y-3 xl:block">
              <section className="rounded-lg border border-[#1e2330] bg-[#11141c] p-3">
                <h2 className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-white">
                  <Info className="h-3.5 w-3.5 text-[#00f090]" /> Reglas del pozo
                </h2>
                <ul className="mt-2 space-y-2 font-mono text-[10px] leading-relaxed text-slate-400">
                  <li className="flex gap-1.5">
                    <span className="text-[#00f090]">01</span>
                    El 100% del pozo va a los ganadores. No hay comisión dentro de los mercados.
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-[#00f090]">02</span>
                    La comisión del 1.5% se cobra una sola vez al recargar USDT.
                  </li>
                  <li className="flex gap-1.5">
                    <span className="text-[#f59e0b]">03</span>
                    Si gana una opción que nadie apostó, el creador del mercado recibe una parte
                    del pozo.
                  </li>
                </ul>
              </section>

              <section className="rounded-lg border border-[#1e2330] bg-[#11141c] p-3">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-white">
                    <Clock className="h-3.5 w-3.5 text-[#00f090]" /> Tus últimos tickets
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleNavigate('MY_BETS')}
                    className="font-mono text-[9px] font-bold text-[#00f090] hover:underline"
                  >
                    VER TODOS
                  </button>
                </div>
                {recentBets.length === 0 ? (
                  <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-500">
                    Aún no tienes tickets. Elige una opción de un mercado para empezar.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {recentBets.map((bet) => (
                      <div
                        key={bet.id}
                        className="rounded border border-[#1d222e] bg-[#0c0e14] px-2 py-1.5"
                      >
                        <div className="truncate text-[10px] font-bold text-slate-200">
                          {bet.marketTitle}
                        </div>
                        <div className="mt-0.5 flex justify-between font-mono text-[9px] text-slate-500">
                          <span className="text-[#00f090]">{bet.selectedOption}</span>
                          <span>${formatUsdt(bet.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded border border-[#f59e0b]/20 bg-[#181511] p-3 font-mono text-[9px] leading-relaxed text-[#fbbf24]">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                El saldo es USDT real. Apuesta solo lo que estés dispuesto a perder.
              </section>
            </aside>
          </div>
        ) : null}

        {effectiveTab === 'MY_BETS' ? (
          <MyBets
            bets={bets}
            loading={betsLoading}
            error={betsError}
            onRetry={() => void loadBets()}
            onExplore={() => handleNavigate('EXPLORE')}
          />
        ) : null}

        {effectiveTab === 'WALLET' ? (
          <WalletView
            profile={profile}
            transactions={transactions}
            loading={walletLoading}
            error={walletError}
            onRetry={() => void loadTransactions()}
            onDeposit={() => setShowDeposit(true)}
            onWithdraw={() => setShowWithdraw(true)}
            onRefreshProfile={refreshProfile}
          />
        ) : null}

        {effectiveTab === 'MODERATION' && isStaff ? (
          <ModerationPanel
            markets={markets}
            loading={marketsLoading}
            error={marketsError}
            onRetry={() => void loadMarkets()}
            onResolve={(market) => setResolveMarket(market)}
            onCancel={(market) => setCancelMarket(market)}
            onChanged={handleResolutionChanged}
            showToast={showToast}
          />
        ) : null}

        {effectiveTab === 'ADMIN' && role === 'ADMIN' ? (
          <AdminDashboard
            overview={adminOverview}
            currentUserId={profile.id}
            loading={adminLoading}
            error={adminError}
            onRetry={() => void loadAdmin()}
            onChanged={handleResolutionChanged}
            showToast={showToast}
          />
        ) : null}
      </main>

      <MobileNav
        profile={profile}
        activeTab={effectiveTab}
        onNavigate={handleNavigate}
        onCreate={() => setShowCreate(true)}
      />

      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[70] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-4">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded border px-3 py-2 font-mono text-[11px] shadow-lg ${toastStyles[toast.type]}`}
              role="status"
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span className="flex-1 leading-relaxed">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 opacity-60 transition hover:opacity-100"
                aria-label="Cerrar notificación"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {betSlip ? (
        <BetSlip
          key={`${betSlip.market.id}:${betSlip.option}`}
          market={betSlip.market}
          option={betSlip.option}
          balance={Number.parseFloat(profile.balance) || 0}
          placing={placing}
          userActiveInMarket={userActiveInMarket}
          onClose={() => setBetSlip(null)}
          onConfirm={(amount) => void handlePlaceBet(amount)}
        />
      ) : null}

      {showDeposit ? (
        <DepositModal
          profile={profile}
          onClose={() => setShowDeposit(false)}
          onRefreshProfile={refreshProfile}
          showToast={showToast}
        />
      ) : null}

      {showWithdraw ? (
        <WithdrawModal
          profile={profile}
          onClose={() => setShowWithdraw(false)}
          onRefreshProfile={refreshProfile}
          showToast={showToast}
        />
      ) : null}

      {showCreate ? (
        <CreateMarketModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            await loadMarkets();
            await loadTransactions(true);
          }}
          showToast={showToast}
        />
      ) : null}

      {resolveMarket ? (
        <ResolveMarketModal
          market={resolveMarket}
          onClose={() => setResolveMarket(null)}
          onDone={handleResolutionChanged}
          showToast={showToast}
        />
      ) : null}

      {cancelMarket ? (
        <CancelMarketModal
          market={cancelMarket}
          onClose={() => setCancelMarket(null)}
          onDone={handleResolutionChanged}
          showToast={showToast}
        />
      ) : null}
    </div>
  );
}

function HeroStat({
  label,
  value,
  hint,
  tone = 'text-white',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded border border-[#1d222e] bg-[#0c0e14] px-2.5 py-2">
      <div className="font-mono text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${tone}`}>{value}</div>
      {hint ? <div className="font-mono text-[9px] text-slate-600">{hint}</div> : null}
    </div>
  );
}
