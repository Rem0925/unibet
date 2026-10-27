export const BET_MIN = 0.5;
export const BET_MAX = 500;
export const BET_USER_MARKET_MAX = 150;
export const DEPOSIT_MIN = 1;
export const DEPOSIT_MAX = 1000;
export const WITHDRAW_MIN = 1;
export const WITHDRAW_MAX = 200;
export const DEPOSIT_FEE_RATE = 0.015;
export const PAYOUT_MULTIPLIER_CAP = 20;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 10;
export const MAX_MARKET_DAYS = 365;

export const MARKET_CATEGORIES = ['FUTBOL', 'BEISBOL', 'CAMPUS', 'GAMING', 'OTRO'] as const;

export const MARKET_CATEGORY_LABELS: Record<(typeof MARKET_CATEGORIES)[number], string> = {
  FUTBOL: 'FÚTBOL',
  BEISBOL: 'BÉISBOL',
  CAMPUS: 'UNIVERSIDAD',
  GAMING: 'GAMING',
  OTRO: 'OTRO',
};

export const ROLE_LABELS = {
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERADOR',
  USER: 'APOSTADOR',
} as const;
