'use client';

import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Modal, Spinner } from '@/components/ui';

interface AccessCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (code: string) => Promise<boolean>;
}

export function AccessCodeModal({ isOpen, onClose, onUnlock }: AccessCodeModalProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError('Por favor ingresa un código.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const success = await onUnlock(cleanCode);
      if (success) {
        setCode('');
        onClose();
      } else {
        setError(`No encontramos ninguna apuesta privada activa con el código "${cleanCode}". Verifica que esté bien escrito.`);
      }
    } catch {
      setError('Ocurrió un error al verificar el código. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Acceso a Apuesta Privada"
      subtitle="Ingresa el código secreto para ver y participar en el evento"
      icon={
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
          <KeyRound className="h-5 w-5" />
        </div>
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="access-code-input" className="block text-xs font-bold text-slate-300 mb-1.5">
            Código de la apuesta *
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-purple-400" />
            <input
              id="access-code-input"
              type="text"
              autoFocus
              required
              maxLength={32}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              placeholder="EJ: AMIGOS2026 O VIP"
              className="w-full rounded-xl border border-[#212633] bg-[#090a0f] py-3 pl-10 pr-4 font-mono text-sm font-bold tracking-wider text-white uppercase placeholder-slate-500 focus:border-purple-400 focus:outline-none transition-colors"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Pega o escribe el código que te compartió el creador de la apuesta.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        ) : null}

        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 text-xs text-slate-300 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-purple-300">
            <ShieldCheck className="h-4 w-4 text-purple-400 shrink-0" />
            <span>¿Cómo funciona?</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Las apuestas privadas solo son visibles para quienes tengan la clave. Al desbloquearla, aparecerá en tu lista de eventos para que puedas seleccionar tu opción y apostar.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-[#212633] bg-[#141822] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#1a202c] transition active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !code.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-purple-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-purple-400 active:scale-95 disabled:opacity-50 shadow-md shadow-purple-500/20 cursor-pointer"
          >
            {submitting ? <Spinner className="h-4 w-4 text-black" /> : <KeyRound className="h-4 w-4 text-black" />}
            {submitting ? 'Verificando...' : 'Desbloquear Apuesta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
