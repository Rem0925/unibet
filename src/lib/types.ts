export type AppTab =
  | 'EXPLORE'
  | 'BETS'
  | 'WALLET'
  | 'GROUPS'
  | 'PROFILE'
  | 'ACCOUNT'
  | 'MODERATION'
  | 'ADMIN';

export type Role = 'ADMIN' | 'MODERATOR' | 'USER';

export type MarketCategory = string;

export type MarketStatus = 'OPEN' | 'CLOSED' | 'RESOLVED' | 'CANCELLED';

export type BetStatus = 'ACTIVE' | 'WON' | 'LOST' | 'REFUNDED';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'BET_PLACED'
  | 'BET_WON'
  | 'FEE_DEPOSIT'
  | 'HOUSE_WIN'
  | 'CREATOR_WIN'
  | 'REFUND';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  binanceUid: string | null;
  balance: string;
  role: Role;
  isBanned: boolean;
  createdAt: string;
}

export interface OptionOdds {
  pool: string;
  percentage: string;
  multiplier: string;
  profitPercentage?: string;
  hasBets?: boolean;
}

export interface MarketOdds {
  totalPool: string;
  netPrizePool: string;
  optionsOdds: Record<string, OptionOdds>;
}

export type MarketVisibility = 'PUBLIC' | 'GROUP' | 'PRIVATE_CODE';

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  creatorId: string;
  creatorUsername?: string;
  inviteCode: string;
  memberCount: number;
  pendingCount?: number;
  userRole?: 'CREATOR' | 'ADMIN' | 'MEMBER';
  userStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface GroupMemberItem {
  id: string;
  groupId: string;
  userId: string;
  username: string;
  role: 'CREATOR' | 'ADMIN' | 'MEMBER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  approvedAt: string | null;
}

export interface MarketSummary {
  id: string;
  creatorId: string;
  creatorUsername: string;
  title: string;
  description: string | null;
  resolutionSource: string | null;
  category: MarketCategory;
  visibility: MarketVisibility;
  groupId: string | null;
  groupName: string | null;
  accessCode: string | null;
  options: string[];
  closeTime: string;
  status: MarketStatus;
  winningOption: string | null;
  cancelledReason: string | null;
  isOfficial: boolean;
  totalPool: string;
  optionPools: Record<string, string>;
  optionBetCounts: Record<string, number>;
  betCount: number;
  createdAt: string;
  odds: MarketOdds;
}

export interface BetRecord {
  id: string;
  marketId: string;
  marketTitle: string;
  marketStatus: MarketStatus;
  winningOption: string | null;
  closeTime: string;
  selectedOption: string;
  amount: string;
  payoutAmount: string;
  status: BetStatus;
  createdAt: string;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  username: string;
  type: TransactionType;
  amount: string;
  status: TransactionStatus;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalUserBalances: string;
  activePools: string;
  pendingWithdrawals: string;
  houseFees: string;
  houseWins: string;
  creatorWins: string;
  totalDeposits: string;
  openMarkets: number;
  totalMarkets: number;
  activeBets: number;
  expectedBinanceBalance: string;
}

export interface PendingWithdrawal {
  id: string;
  referenceId: string;
  userId: string;
  username: string;
  binanceUid: string | null;
  amount: string;
  createdAt: string;
  method?: 'BINANCE_PAY' | 'BEP20';
  destination?: string | null;
  netPayout?: string;
  networkFee?: string;
}

export interface PendingDeposit {
  id: string;
  referenceId: string;
  userId: string;
  username: string;
  amount: string;
  createdAt: string;
  submittedTxId?: string | null;
  userConfirmedPayment?: boolean;
}

export interface AuditLogRecord {
  id: string;
  actorId: string | null;
  actorUsername: string | null;
  action: string;
  targetUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminOverview {
  stats: AdminStats;
  users: UserProfile[];
  transactions: TransactionRecord[];
  pendingWithdrawals: PendingWithdrawal[];
  pendingDeposits: PendingDeposit[];
  auditLogs: AuditLogRecord[];
}

export interface MarketsResponse {
  markets: MarketSummary[];
  serverTime: string;
}

export interface MeResponse {
  profile: UserProfile;
}

export interface BetsResponse {
  bets: BetRecord[];
}

export interface TransactionsResponse {
  transactions: TransactionRecord[];
}

export interface DepositOrderResponse {
  success: true;
  tradeNo: string;
  adminPayId?: string | null;
  amount?: number;
  userBinanceUid?: string | null;
  checkoutUrl: string | null;
  qrcodeLink: string | null;
  universalUrl: string | null;
  expireTime: number | null;
}

export interface BscFeeResponse {
  coin: string;
  network: string;
  withdrawFee: number;
  withdrawMin: number;
  withdrawMax: number;
  withdrawEnable: boolean;
  isLive: boolean;
  cachedAt: number;
}

export interface WithdrawResponse {
  success: boolean;
  status: 'COMPLETED' | 'PENDING';
  message: string;
  remainingBalance: string;
  method?: 'BINANCE_PAY' | 'BEP20';
  payoutAmount?: string;
  networkFee?: string;
  binanceWithdrawId?: string | null;
}

export type ToastType = 'success' | 'warn' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

export interface CreateMarketResponse {
  success: boolean;
  message?: string;
  market: {
    id: string;
    title: string;
    closeTime: string;
    status: MarketStatus;
  };
}
