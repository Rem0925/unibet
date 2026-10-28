'use client';

import { useEffect, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

export function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-0 sm:p-4 font-sans text-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`my-0 sm:my-6 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-t-3xl sm:rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-5 sm:p-6 shadow-2xl shadow-black max-h-[92vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6`}
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#1e2330] pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              {icon}
              <span className="truncate">{title}</span>
            </div>
            {subtitle ? <p className="mt-1 text-xs text-slate-400 font-normal leading-relaxed">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-1.5 text-slate-400 transition hover:bg-[#1e2330] hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#00f090]"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#1e2330] bg-[#0c0d12]/50 px-6 py-12 text-center">
      <div className="mb-3.5 inline-flex rounded-xl border border-[#1e2330] bg-[#141822] p-3.5 text-[#00f090]">
        {icon}
      </div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 px-4 py-3 text-xs text-[#fda4af] sm:flex-row sm:items-center sm:justify-between">
      <span>{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-lg border border-[#f43f5e]/40 px-3 py-1 font-semibold text-[#f43f5e] transition hover:bg-[#f43f5e]/10"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-[#1e2330] bg-[#11141c]/60 p-5">
      <div className="mb-3 h-3 w-24 rounded bg-[#1c2130]" />
      <div className="mb-2 h-4 w-3/4 rounded bg-[#1c2130]" />
      <div className="mb-4 h-3 w-full rounded bg-[#171b26]" />
      <div className="space-y-2">
        <div className="h-9 w-full rounded-xl bg-[#171b26]" />
        <div className="h-9 w-full rounded-xl bg-[#171b26]" />
        <div className="h-9 w-full rounded-xl bg-[#171b26]" />
      </div>
    </div>
  );
}
