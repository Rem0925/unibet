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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 font-mono text-xs sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`my-6 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-lg border border-[#222736] bg-[#11141c] p-5 shadow-2xl`}
      >
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-[#1e2330] pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white">
              {icon}
              {title}
            </div>
            {subtitle ? <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 transition hover:bg-[#1a1f2b] hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#00f090]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#252b3b] bg-[#0e1118] px-6 py-12 text-center">
      <div className="mb-3 rounded-md border border-[#252b3b] bg-[#141822] p-3 text-[#00f090]">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-slate-400">{description}</p>
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
    <div className="flex flex-col gap-2 rounded-md border border-[#f43f5e]/40 bg-[#1f1113] px-3 py-2 text-[11px] text-[#fda4af] sm:flex-row sm:items-center sm:justify-between">
      <span>{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded border border-[#f43f5e]/40 px-2 py-1 font-bold text-[#f43f5e] transition hover:bg-[#f43f5e]/10"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-[#1e2330] bg-[#11141c] p-4">
      <div className="mb-3 h-3 w-24 rounded bg-[#1c2130]" />
      <div className="mb-2 h-4 w-3/4 rounded bg-[#1c2130]" />
      <div className="mb-4 h-3 w-full rounded bg-[#171b26]" />
      <div className="space-y-2">
        <div className="h-9 w-full rounded bg-[#171b26]" />
        <div className="h-9 w-full rounded bg-[#171b26]" />
        <div className="h-9 w-full rounded bg-[#171b26]" />
      </div>
    </div>
  );
}
