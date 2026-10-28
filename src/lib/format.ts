const usdtFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactUsdtFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatUsdt(value: number | string | null | undefined): string {
  const number = typeof value === 'number' ? value : Number.parseFloat(value ?? '0');
  if (!Number.isFinite(number)) return '0.00';
  const floored = Math.floor(number * 100 + 1e-6) / 100;
  return usdtFormatter.format(floored);
}

export function formatUsdtCompact(value: number | string | null | undefined): string {
  const number = typeof value === 'number' ? value : Number.parseFloat(value ?? '0');
  if (!Number.isFinite(number)) return '0';
  const floored = Math.floor(number * 100 + 1e-6) / 100;
  return compactUsdtFormatter.format(floored);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function timeUntil(value: string, nowMs = Date.now()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const diff = date.getTime() - nowMs;
  if (diff <= 0) return 'Cerrado';

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `Cierra en ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Cierra en ${hours} h`;

  const days = Math.floor(hours / 24);
  return `Cierra en ${days} días`;
}

export function toDateTimeLocal(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function truncate(value: string, length = 18): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-VE').format(value);
}
