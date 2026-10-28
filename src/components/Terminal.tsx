'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { AccountView, type AccountSubTab } from '@/components/AccountView';
import { AdminDashboard } from '@/components/AdminDashboard';
import { BetSlip } from '@/components/BetSlip';
import { CreateMarketModal } from '@/components/CreateMarketModal';
import { DepositModal } from '@/components/DepositModal';
import { CancelMarketModal, ResolveMarketModal } from '@/components/MarketActions';
import { MarketCard } from '@/components/MarketCard';
import { ModerationPanel } from '@/components/ModerationPanel';
import { Header, MobileNav } from '@/components/Navigation';
import { EmptyState, ErrorBanner, Spinner } from '@/components/ui';
import { WithdrawModal } from '@/components/WithdrawModal';
import { useNow } from '@/hooks/useNow';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { formatShortDate, formatUsdt, timeUntil } from '@/lib/format';
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
type SortOption = 'POOL' | 'CLOSING_SOON' | 'POPULAR';

interface BetSlipState {
  marketId: string;
  option: string;
}

const statusFilters: Array<{ id: StatusFilter; label: string }> = [
  { id: 'PLAYING', label: 'En juego' },
  { id: 'OPEN', label: 'Abiertos' },
  { id: 'CLOSED', label: 'En curso' },
  { id: 'RESOLVED', label: 'Finalizados' },
  { id: 'ALL', label: 'Todos' },
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
  const [accountSubTab, setAccountSubTab] = useState<AccountSubTab>('BETS');
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
  const [sortBy, setSortBy] = useState<SortOption>('POOL');

  const [betSlip, setBetSlip] = useState<BetSlipState | null>(null);
  const [placing, setPlacing] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [resolveMarket, setResolveMarket] = useState<MarketSummary | null>(null);
  const [cancelMarket, setCancelMarket] = useState<MarketSummary | null>(null);

  const role = profile.role;
  const now = useNow();

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

  const handleNavigate = (tab: AppTab, subTab?: AccountSubTab) => {
    setActiveTab(tab);
    if (subTab) {
      setAccountSubTab(subTab);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlaceBet = async (amount: number) => {
    if (!betSlip) return;
    setPlacing(true);
    try {
      const response = await apiFetch<{ success: boolean; message: string }>('/api/bets/place', {
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

  const activeBetsList = useMemo(() => {
    return bets.filter((b) => b.status === 'ACTIVE');
  }, [bets]);

  // Dynamic active categories derived strictly from open/closed markets with counts
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of markets) {
      if (m.category && (m.status === 'OPEN' || m.status === 'CLOSED')) {
        const cat = m.category.toUpperCase().trim();
        counts[cat] = (counts[cat] ?? 0) + 1;
      }
    }
    return counts;
  }, [markets]);

  const activeCategories = useMemo(() => {
    return Object.keys(categoryStats).sort();
  }, [categoryStats]);

  // Evento Destacado (Mayor pozo abierto)
  const featuredMarket = useMemo(() => {
    const candidates = markets.filter(
      (m) => m.status === 'OPEN' && new Date(m.closeTime).getTime() > now
    );
    if (candidates.length === 0) return null;
    return candidates.sort(
      (a, b) => Number.parseFloat(b.totalPool) - Number.parseFloat(a.totalPool)
    )[0];
  }, [markets, now]);

  // Filtered and sorted markets
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

    const list = markets.filter(
      (market) => statusMatch(market) && categoryMatch(market) && searchMatch(market)
    );

    return list.sort((a, b) => {
      if (sortBy === 'POOL') {
        return Number.parseFloat(b.totalPool) - Number.parseFloat(a.totalPool);
      }
      if (sortBy === 'CLOSING_SOON') {
        return new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime();
      }
      if (sortBy === 'POPULAR') {
        return b.betCount - a.betCount;
      }
      return 0;
    });
  }, [markets, search, statusFilter, categoryFilter, sortBy]);

  const playingCount = useMemo(
    () => markets.filter((m) => m.status === 'OPEN' || m.status === 'CLOSED').length,
    [markets]
  );
  const resolvedCount = useMemo(
    () => markets.filter((m) => m.status === 'RESOLVED').length,
    [markets]
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#07080c] font-sans text-slate-100">
      {/* Barra de Navegación Superior (Sin pestaña 'Mi Cuenta', con avatar dropdown y saldo) */}
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
          <div className="flex items-start gap-6">
            {/* ======================================================== */}
            {/* COLUMNA IZQUIERDA: Rail Deportivo & Categorías (Desktop) */}
            {/* ======================================================== */}
            <aside className="hidden xl:flex w-60 shrink-0 flex-col gap-4 sticky top-20 self-start">
              {/* Navegación rápida de eventos */}
              <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-3.5 shadow-sm">
                <span className="mb-2.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Eventos
                </span>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('ALL');
                      setCategoryFilter('TODOS');
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      statusFilter === 'ALL' && categoryFilter === 'TODOS'
                        ? 'bg-[#181c26] text-[#00f090] ring-1 ring-[#00f090]/30'
                        : 'text-slate-300 hover:bg-[#141822] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-[#00f090]" />
                      <span>Todos los eventos</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">{markets.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('PLAYING');
                      setCategoryFilter('TODOS');
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      statusFilter === 'PLAYING' && categoryFilter === 'TODOS'
                        ? 'bg-[#181c26] text-[#00f090] ring-1 ring-[#00f090]/30'
                        : 'text-slate-300 hover:bg-[#141822] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-amber-400" />
                      <span>En juego</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">{playingCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('RESOLVED');
                      setCategoryFilter('TODOS');
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      statusFilter === 'RESOLVED' && categoryFilter === 'TODOS'
                        ? 'bg-[#181c26] text-[#00f090] ring-1 ring-[#00f090]/30'
                        : 'text-slate-300 hover:bg-[#141822] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sky-400" />
                      <span>Finalizados</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">{resolvedCount}</span>
                  </button>
                </div>
              </div>

              {/* Categorías Dinámicas en uso */}
              <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-3.5 shadow-sm">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Categorías en vivo
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="text-[10px] font-bold text-[#00f090] hover:underline"
                  >
                    + Nueva
                  </button>
                </div>

                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('TODOS')}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      categoryFilter === 'TODOS'
                        ? 'bg-[#00f090]/15 text-[#00f090] ring-1 ring-[#00f090]/30'
                        : 'text-slate-300 hover:bg-[#141822] hover:text-white'
                    }`}
                  >
                    <span>Todas</span>
                    <span className="font-mono text-[10px] text-slate-500">{playingCount}</span>
                  </button>

                  {activeCategories.length === 0 ? (
                    <div className="py-2 text-center text-xs text-slate-500">
                      Sin categorías activas
                    </div>
                  ) : (
                    activeCategories.map((cat) => {
                      const isSelected = categoryFilter.toUpperCase() === cat;
                      const count = categoryStats[cat] ?? 0;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                            isSelected
                              ? 'bg-[#00f090]/15 text-[#00f090] ring-1 ring-[#00f090]/30'
                              : 'text-slate-300 hover:bg-[#141822] hover:text-white'
                          }`}
                        >
                          <span className="truncate">{cat}</span>
                          <span className="font-mono text-[10px] text-slate-500">{count}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Widget Resumen de Billetera & Apuestas */}
              <div className="rounded-2xl border border-[#1e2330] bg-[#141822]/70 p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Tu saldo disponible</span>
                  <Wallet className="h-4 w-4 text-[#00f090]" />
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-white">
                  ${formatUsdt(profile.balance)}{' '}
                  <span className="text-xs font-normal text-slate-400">USDT</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeposit(true)}
                    className="flex items-center justify-center gap-1 rounded-xl bg-[#00f090] py-2 text-xs font-bold text-slate-950 transition hover:bg-[#00d681]"
                  >
                    <ArrowDownLeft className="h-3.5 w-3.5" /> Recargar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWithdraw(true)}
                    className="flex items-center justify-center gap-1 rounded-xl border border-[#2d3447] bg-[#1c2230] py-2 text-xs font-bold text-white transition hover:bg-[#252c3e]"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" /> Retirar
                  </button>
                </div>

                <div className="mt-3.5 border-t border-[#1e2330] pt-3 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Apuestas activas:</span>
                    <strong className="font-mono text-[#00f090]">{activeBetsList.length}</strong>
                  </div>
                  {activeBetsList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleNavigate('ACCOUNT', 'BETS')}
                      className="mt-2 w-full text-center text-[11px] font-bold text-[#00f090] hover:underline"
                    >
                      Ver mis apuestas en curso →
                    </button>
                  )}
                </div>
              </div>
            </aside>

            {/* ======================================================== */}
            {/* COLUMNA CENTRAL: Feed Principal de Mercados              */}
            {/* ======================================================== */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* Banner: Evento Destacado / Match of the Day (si existe mercado abierto) */}
              {featuredMarket && !search && categoryFilter === 'TODOS' && (
                <div className="relative overflow-hidden rounded-3xl border border-[#00f090]/30 bg-gradient-to-br from-[#00f090]/15 via-[#0c0d12] to-[#141822] p-5 sm:p-6 shadow-2xl shadow-[#00f090]/5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 rounded-full bg-[#00f090] px-3 py-1 text-xs font-bold text-slate-950 shadow-md">
                        <Flame className="h-3.5 w-3.5 fill-current" /> DESTACADO DE HOY
                      </span>
                      <span className="rounded-full border border-[#212633] bg-[#141822] px-2.5 py-0.5 text-[11px] font-semibold text-slate-300 uppercase">
                        {featuredMarket.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Cierra en {timeUntil(featuredMarket.closeTime, now)}</span>
                    </div>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                    {featuredMarket.title}
                  </h2>
                  {featuredMarket.description && (
                    <p className="mt-1 text-xs text-slate-400 max-w-xl line-clamp-1">
                      {featuredMarket.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-4 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500">Pozo Acumulado:</span>{' '}
                      <strong className="font-mono text-base font-bold text-[#00f090]">
                        ${formatUsdt(featuredMarket.totalPool)} USDT
                      </strong>
                    </div>
                    <div className="text-slate-500">·</div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Users className="h-3.5 w-3.5 text-slate-500" />
                      <span>{featuredMarket.betCount} tickets</span>
                    </div>
                  </div>

                  {/* Cuotas de apuesta directa del destacado */}
                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    {featuredMarket.options.map((opt) => {
                      const odds = featuredMarket.odds.optionsOdds[opt];
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => openBetSlip(featuredMarket, opt)}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0c0d12]/90 p-3 text-left transition hover:border-[#00f090] hover:bg-[#141822] hover:shadow-lg"
                        >
                          <span className="text-xs font-bold text-white truncate pr-2">{opt}</span>
                          <span className="font-mono text-xs font-bold text-[#00f090] bg-[#00f090]/10 px-2.5 py-1 rounded-xl">
                            {odds?.multiplier ?? '1.00x'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Barra de Filtros y Búsqueda */}
              <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-3 sm:p-4 shadow-sm space-y-3">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  {/* Búsqueda */}
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar eventos, opciones o creador..."
                      className="w-full rounded-xl border border-[#212633] bg-[#141822] py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder-slate-500 focus:border-[#00f090] focus:outline-none"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-3 text-slate-400 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filtro de Estado */}
                  <div className="flex rounded-xl border border-[#212633] bg-[#141822] p-1">
                    {statusFilters.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStatusFilter(f.id)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                          statusFilter === f.id
                            ? 'bg-[#00f090] text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Ordenamiento */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="rounded-xl border border-[#212633] bg-[#141822] px-3 py-2.5 text-xs font-semibold text-slate-200 focus:border-[#00f090] focus:outline-none cursor-pointer"
                  >
                    <option value="POOL">Mayor Pozo</option>
                    <option value="CLOSING_SOON">Cierre Próximo</option>
                    <option value="POPULAR">Más Apuestas</option>
                  </select>
                </div>

                {/* Categorías en Carrusel Horizontal (Visible en tablets y móviles) */}
                <div className="flex xl:hidden items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('TODOS')}
                    className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      categoryFilter === 'TODOS'
                        ? 'border-[#00f090] bg-[#00f090]/15 text-[#00f090]'
                        : 'border-[#212633] bg-[#141822] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    Todas ({playingCount})
                  </button>

                  {activeCategories.map((cat) => {
                    const isSelected = categoryFilter.toUpperCase() === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          isSelected
                            ? 'border-[#00f090] bg-[#00f090]/15 text-[#00f090]'
                            : 'border-[#212633] bg-[#141822] text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {cat} ({categoryStats[cat]})
                      </button>
                    );
                  })}
                </div>
              </div>

              {marketsError ? (
                <ErrorBanner message={marketsError} onRetry={() => void loadMarkets()} />
              ) : null}

              {/* Grid de Mercados */}
              {marketsLoading && markets.length === 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-64 animate-pulse rounded-2xl border border-[#212633] bg-[#0c0d12]"
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
                      className="flex items-center gap-2 rounded-xl bg-[#00f090] px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-[#00d681]"
                    >
                      <Plus className="h-4 w-4" /> Crear evento
                    </button>
                  }
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredMarkets.map((market) => (
                    <MarketCard key={market.id} market={market} onSelectOption={openBetSlip} />
                  ))}
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* COLUMNA DERECHA: Boleto de Apuestas Docked (Desktop)     */}
            {/* ======================================================== */}
            <aside className="hidden lg:block w-80 shrink-0 sticky top-20 self-start space-y-4">
              {activeSlipMarket && betSlip ? (
                <BetSlip
                  key={`${activeSlipMarket.id}:${betSlip.option}`}
                  market={activeSlipMarket}
                  option={betSlip.option}
                  balance={Number.parseFloat(profile.balance) || 0}
                  placing={placing}
                  userActiveInMarket={userActiveInMarket}
                  inline={true}
                  onClose={() => setBetSlip(null)}
                  onConfirm={(amount) => void handlePlaceBet(amount)}
                />
              ) : (
                <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-5 shadow-sm text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#141822] text-[#00f090]">
                    <Ticket className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Boleto de Apuesta</h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Haz clic en cualquier cuota de los mercados para armar tu boleto de apuesta.
                  </p>
                </div>
              )}

              {/* Tus Apuestas en Juego en la columna derecha */}
              <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Tus Apuestas Activas</span>
                  <span className="rounded-full bg-[#00f090]/15 px-2 py-0.5 text-[10px] font-bold text-[#00f090]">
                    {activeBetsList.length}
                  </span>
                </div>

                {activeBetsList.length === 0 ? (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    No tienes apuestas en curso en este momento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeBetsList.slice(0, 3).map((bet) => (
                      <div
                        key={bet.id}
                        className="rounded-xl border border-[#1e2330] bg-[#141822] p-2.5 text-xs space-y-1"
                      >
                        <div className="truncate font-semibold text-white">{bet.marketTitle}</div>
                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                          <span>Opción: <strong className="text-white">{bet.selectedOption}</strong></span>
                          <span className="font-mono text-[#00f090]">${formatUsdt(bet.amount)} USDT</span>
                        </div>
                      </div>
                    ))}
                    {activeBetsList.length > 3 && (
                      <button
                        type="button"
                        onClick={() => handleNavigate('ACCOUNT', 'BETS')}
                        className="block w-full text-center text-[11px] font-bold text-[#00f090] hover:underline pt-1"
                      >
                        Ver las {activeBetsList.length} apuestas →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>
        ) : null}

        {/* ======================================================== */}
        {/* PESTAÑA: Mi Cuenta (Unificada)                          */}
        {/* ======================================================== */}
        {effectiveTab === 'ACCOUNT' ? (
          <AccountView
            profile={profile}
            bets={bets}
            transactions={transactions}
            loadingBets={betsLoading}
            loadingWallet={walletLoading}
            initialSubTab={accountSubTab}
            onRefreshProfile={refreshProfile}
            onDeposit={() => setShowDeposit(true)}
            onWithdraw={() => setShowWithdraw(true)}
            onLogout={onLogout}
            showToast={showToast}
            onExplore={() => handleNavigate('EXPLORE')}
          />
        ) : null}

        {/* ======================================================== */}
        {/* PESTAÑA: Moderación                                      */}
        {/* ======================================================== */}
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

        {/* ======================================================== */}
        {/* PESTAÑA: Finanzas / Admin                                */}
        {/* ======================================================== */}
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

      {/* Floating BetSlip para móviles cuando se selecciona una opción */}
      {activeSlipMarket && betSlip ? (
        <div className="lg:hidden">
          <BetSlip
            key={`mobile:${activeSlipMarket.id}:${betSlip.option}`}
            market={activeSlipMarket}
            option={betSlip.option}
            balance={Number.parseFloat(profile.balance) || 0}
            placing={placing}
            userActiveInMarket={userActiveInMarket}
            inline={false}
            onClose={() => setBetSlip(null)}
            onConfirm={(amount) => void handlePlaceBet(amount)}
          />
        </div>
      ) : null}

      {/* Modales */}
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

      {/* Notificaciones flotantes (Toast) */}
      {toasts.length > 0 ? (
        <div className="fixed bottom-20 right-4 z-50 flex max-w-sm flex-col gap-2 sm:bottom-4">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-start justify-between gap-3 rounded-2xl border p-3.5 text-xs shadow-2xl backdrop-blur-md ${
                toast.type === 'success'
                  ? 'border-emerald-500/40 bg-[#0c1a13] text-emerald-200'
                  : toast.type === 'warn'
                    ? 'border-amber-500/40 bg-[#1c160a] text-amber-200'
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
                <span className="font-semibold leading-relaxed">{toast.message}</span>
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
