'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Info,
  Plus,
  Search,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { AccountView } from '@/components/AccountView';
import { AdminDashboard } from '@/components/AdminDashboard';
import { BetSlip } from '@/components/BetSlip';
import { CreateMarketModal } from '@/components/CreateMarketModal';
import { DepositModal } from '@/components/DepositModal';
import { CancelMarketModal, ResolveMarketModal } from '@/components/MarketActions';
import { MarketCard } from '@/components/MarketCard';
import { ModerationPanel } from '@/components/ModerationPanel';
import { Header, MobileNav } from '@/components/Navigation';
import { EmptyState, ErrorBanner } from '@/components/ui';
import { WithdrawModal } from '@/components/WithdrawModal';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { formatUsdt } from '@/lib/format';
import type {
  AdminOverview,
  AppTab,
  BetRecord,
  MarketsResponse,
  MarketSummary,
  ToastItem,
  ToastType,
  TransactionRecord,
  UserProfile,
} from '@/lib/types';

type StatusFilter = 'PLAYING' | 'OPEN' | 'CLOSED' | 'RESOLVED' | 'ALL';

interface BetSlipState {
  marketId: string;
  option: string;
}

const statusFilters: Array<{ id: StatusFilter; label: string }> = [
  { id: 'PLAYING', label: 'En juego' },
  { id: 'OPEN', label: 'Abiertos' },
  { id: 'CLOSED', label: 'En curso' },
  { id: 'RESOLVED', label: 'Finalizados' },
];

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
  const [adminError, setAdminError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODOS');
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
      const response = await apiFetch<{ bets: BetRecord[] }>('/api/bets/mine');
      setBets(response.bets);
    } catch {
      // handled silently
    } finally {
      setBetsLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async (silent = false) => {
    if (!silent) setWalletLoading(true);
    try {
      const response = await apiFetch<{ transactions: TransactionRecord[] }>(
        '/api/transactions/mine'
      );
      setTransactions(response.transactions);
    } catch {
      // handled silently
    } finally {
      setWalletLoading(false);
    }
  }, []);

  const loadAdmin = useCallback(async (silent = false) => {
    if (!silent) setAdminLoading(true);
    try {
      const response = await apiFetch<{ overview: AdminOverview }>('/api/admin/overview');
      setAdminOverview(response.overview);
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

  // Handle return from Binance Pay
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const walletState = params.get('wallet');
    if (walletState !== 'deposit-success' && walletState !== 'deposit-cancelled') return;

    const timer = window.setTimeout(() => {
      if (walletState === 'deposit-success') {
        void refreshProfile();
        void loadTransactions(true);
      }
      showToast(
        walletState === 'deposit-success'
          ? 'Pago recibido. Tu saldo se acreditará en segundos.'
          : 'Recarga cancelada. No se realizó ningún cobro.',
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
  }, [showToast, refreshProfile, loadTransactions]);

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
          marketId: betSlip.marketId,
          selectedOption: betSlip.option,
          amount,
        }),
      });
      showToast(response.message || 'Apuesta confirmada con éxito', 'success');
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
    setBetSlip({ marketId: market.id, option });
  };

  const activeSlipMarket = useMemo(() => {
    if (!betSlip) return null;
    return markets.find((m) => m.id === betSlip.marketId) ?? null;
  }, [markets, betSlip]);

  const userActiveInMarket = useMemo(() => {
    if (!betSlip) return 0;
    return bets
      .filter((b) => b.marketId === betSlip.marketId && b.status === 'ACTIVE')
      .reduce((sum, b) => sum + (Number.parseFloat(b.amount) || 0), 0);
  }, [bets, betSlip]);

  // Dynamic active categories derived strictly from open/closed markets
  const activeCategories = useMemo(() => {
    const set = new Set<string>();
    for (const m of markets) {
      if (m.category && (m.status === 'OPEN' || m.status === 'CLOSED')) {
        set.add(m.category.toUpperCase().trim());
      }
    }
    return Array.from(set).sort();
  }, [markets]);

  // Filtered markets
  const filteredMarkets = useMemo(() => {
    const query = search.trim().toLowerCase();

    const statusMatch = (market: MarketSummary) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PLAYING') {
        return market.status === 'OPEN' || market.status === 'CLOSED';
      }
      return market.status === statusFilter;
    };

    const categoryMatch = (market: MarketSummary) => {
      if (categoryFilter === 'TODOS') return true;
      return market.category.toUpperCase().trim() === categoryFilter.toUpperCase().trim();
    };

    const searchMatch = (market: MarketSummary) => {
      if (!query) return true;
      return (
        market.title.toLowerCase().includes(query) ||
        market.creatorUsername.toLowerCase().includes(query) ||
        market.options.some((opt) => opt.toLowerCase().includes(query)) ||
        market.category.toLowerCase().includes(query)
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
        const diff = statusOrder[a.status] - statusOrder[b.status];
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [markets, search, statusFilter, categoryFilter]);

  const totalLivePool = useMemo(() => {
    return markets
      .filter((m) => m.status === 'OPEN' || m.status === 'CLOSED')
      .reduce((sum, m) => sum + (Number.parseFloat(m.totalPool) || 0), 0);
  }, [markets]);

  return (
    <div className="flex min-h-screen flex-col bg-[#090a0f] text-slate-100">
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

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-6 md:pb-12">
        {effectiveTab === 'EXPLORE' ? (
          <div className="space-y-6">
            {/* Barra de Filtros y Búsqueda */}
            <div className="space-y-3">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar evento, opción o creador..."
                    className="w-full rounded-xl border border-[#212633] bg-[#12151c] py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder-slate-500 focus:border-[#00f090] focus:outline-none"
                  />
                </div>

                {/* Filtro de Estado */}
                <div className="flex rounded-xl border border-[#212633] bg-[#12151c] p-1">
                  {statusFilters.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStatusFilter(f.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        statusFilter === f.id
                          ? 'bg-[#1e2536] text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Categorías Dinámicas (Chips) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('TODOS')}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    categoryFilter === 'TODOS'
                      ? 'border-[#00f090] bg-[#00f090]/15 text-[#00f090]'
                      : 'border-[#212633] bg-[#12151c] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  Todas las categorías
                </button>

                {activeCategories.map((cat) => {
                  const active = categoryFilter.toUpperCase() === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'border-[#00f090] bg-[#00f090]/15 text-[#00f090]'
                          : 'border-[#212633] bg-[#12151c] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {marketsError ? (
              <ErrorBanner message={marketsError} onRetry={() => void loadMarkets()} />
            ) : null}

            {/* Listado de Mercados */}
            {marketsLoading && markets.length === 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-64 animate-pulse rounded-xl border border-[#212633] bg-[#12151c]"
                  />
                ))}
              </div>
            ) : filteredMarkets.length === 0 ? (
              <EmptyState
                icon={<Trophy className="h-8 w-8 text-slate-600" />}
                title={markets.length === 0 ? 'No hay eventos disponibles' : 'Sin resultados'}
                description={
                  markets.length === 0
                    ? 'Sé el primero en crear una predicción entre amigos.'
                    : 'Prueba con otra palabra clave o selecciona otra categoría.'
                }
                action={
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 rounded-lg bg-[#00f090] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#00d681]"
                  >
                    <Plus className="h-4 w-4" /> Crear evento
                  </button>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredMarkets.map((market) => (
                  <MarketCard key={market.id} market={market} onSelectOption={openBetSlip} />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Pestaña: Mi Cuenta (Unificada) */}
        {effectiveTab === 'ACCOUNT' ? (
          <AccountView
            profile={profile}
            bets={bets}
            transactions={transactions}
            loadingBets={betsLoading}
            loadingWallet={walletLoading}
            onRefreshProfile={refreshProfile}
            onDeposit={() => setShowDeposit(true)}
            onWithdraw={() => setShowWithdraw(true)}
            onLogout={onLogout}
            showToast={showToast}
            onExplore={() => handleNavigate('EXPLORE')}
          />
        ) : null}

        {/* Pestaña: Moderación */}
        {effectiveTab === 'MODERATION' ? (
          <ModerationPanel
            markets={markets}
            loading={marketsLoading}
            error={marketsError}
            onRetry={() => void loadMarkets()}
            onResolve={(m) => setResolveMarket(m)}
            onCancel={(m) => setCancelMarket(m)}
            onChanged={handleResolutionChanged}
            showToast={showToast}
          />
        ) : null}

        {/* Pestaña: Finanzas / Admin */}
        {effectiveTab === 'ADMIN' && role === 'ADMIN' ? (
          <AdminDashboard
            overview={adminOverview}
            loading={adminLoading}
            error={adminError}
            currentUserId={profile.id}
            onRetry={() => void loadAdmin()}
            onChanged={handleResolutionChanged}
            showToast={showToast}
          />
        ) : null}
      </main>

      {/* Navegación móvil inferior */}
      <MobileNav
        activeTab={effectiveTab}
        onNavigate={handleNavigate}
        onCreate={() => setShowCreate(true)}
        role={role}
      />

      {/* Modales y Cupón de Apuesta */}
      {activeSlipMarket && betSlip ? (
        <BetSlip
          key={`${activeSlipMarket.id}:${betSlip.option}`}
          market={activeSlipMarket}
          option={betSlip.option}
          balance={Number.parseFloat(profile.balance) || 0}
          placing={placing}
          userActiveInMarket={userActiveInMarket}
          onClose={() => setBetSlip(null)}
          onConfirm={(amount) => void handlePlaceBet(amount)}
        />
      ) : null}

      {showCreate ? (
        <CreateMarketModal
          availableCategories={activeCategories}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            await Promise.allSettled([loadMarkets(true), refreshProfile()]);
          }}
          showToast={showToast}
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

      {/* Toast notifications */}
      {toasts.length > 0 ? (
        <div className="fixed bottom-20 right-4 z-50 flex max-w-sm flex-col gap-2 sm:bottom-4">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 text-xs shadow-xl backdrop-blur-md ${
                toast.type === 'success'
                  ? 'border-emerald-500/40 bg-[#0f1d16] text-emerald-200'
                  : toast.type === 'warn'
                    ? 'border-amber-500/40 bg-[#1f190e] text-amber-200'
                    : 'border-rose-500/40 bg-[#211115] text-rose-200'
              }`}
            >
              <div className="flex items-start gap-2">
                {toast.type === 'success' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00f090]" />
                ) : toast.type === 'warn' ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                ) : (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                )}
                <span className="font-medium leading-relaxed">{toast.message}</span>
              </div>
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
    </div>
  );
}
