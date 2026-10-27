'use client';

import { useState } from 'react';
import { CalendarClock, Plus, Sparkles, Trash2 } from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import {
  MARKET_CATEGORIES,
  MARKET_CATEGORY_LABELS,
  MAX_MARKET_DAYS,
  MAX_OPTIONS,
  MIN_OPTIONS,
} from '@/lib/constants';
import { toDateTimeLocal } from '@/lib/format';
import type { MarketCategory } from '@/lib/types';
import { Modal, Spinner } from './ui';

interface CreateMarketResponse {
  success: boolean;
  message: string;
  market: {
    id: string;
    title: string;
    close_time: string;
    status: string;
  };
}

function defaultCloseTime(): string {
  return toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

export function CreateMarketModal({
  onClose,
  onCreated,
  showToast,
}: {
  onClose: () => void;
  onCreated: () => Promise<void> | void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [resolutionSource, setResolutionSource] = useState('');
  const [category, setCategory] = useState<MarketCategory>('CAMPUS');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [closeTime, setCloseTime] = useState(defaultCloseTime);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateOption = (index: number, value: string) => {
    setOptions((current) => current.map((option, i) => (i === index ? value : option)));
  };

  const addOption = () => {
    setOptions((current) => (current.length >= MAX_OPTIONS ? current : [...current, '']));
  };

  const removeOption = (index: number) => {
    setOptions((current) =>
      current.length <= MIN_OPTIONS ? current : current.filter((_, i) => i !== index)
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    if (title.trim().length < 5) {
      setError('El título debe tener al menos 5 caracteres.');
      return;
    }
    if (cleanOptions.length < MIN_OPTIONS) {
      setError('Necesitas al menos 2 opciones con texto.');
      return;
    }
    if (new Set(cleanOptions.map((option) => option.toLocaleLowerCase('es'))).size !== cleanOptions.length) {
      setError('Las opciones no pueden repetirse.');
      return;
    }

    const closeDate = new Date(closeTime);
    if (Number.isNaN(closeDate.getTime())) {
      setError('Selecciona una fecha de cierre válida.');
      return;
    }
    if (closeDate.getTime() < Date.now() + 60_000) {
      setError('La fecha de cierre debe estar al menos 1 minuto en el futuro.');
      return;
    }
    if (closeDate.getTime() > Date.now() + MAX_MARKET_DAYS * 86_400_000) {
      setError(`La fecha de cierre no puede superar ${MAX_MARKET_DAYS} días.`);
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch<CreateMarketResponse>('/api/markets/create', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          resolutionSource: resolutionSource.trim() || undefined,
          category,
          options: cleanOptions,
          closeTime: closeDate.toISOString(),
        }),
      });

      showToast(response.message || 'Mercado creado con éxito', 'success');
      await onCreated();
      onClose();
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Crear mercado"
      subtitle="Define la pregunta, las opciones y cuándo se cierra. El creador recibe el 30% si gana una opción sin apuestas."
      icon={<Sparkles className="h-4 w-4 text-[#00f090]" />}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="market-title" className="mb-1 block text-[11px] font-bold text-slate-300">
            Pregunta del mercado
          </label>
          <input
            id="market-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder="¿Quién gana el clásico universitario?"
            className="w-full rounded border border-[#222736] bg-[#090a0f] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="market-category"
              className="mb-1 block text-[11px] font-bold text-slate-300"
            >
              Categoría
            </label>
            <select
              id="market-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as MarketCategory)}
              className="w-full rounded border border-[#222736] bg-[#090a0f] px-3 py-2 text-sm text-white focus:border-[#00f090] focus:outline-none"
            >
              {MARKET_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {MARKET_CATEGORY_LABELS[item]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="market-close"
              className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-300"
            >
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> Inicio del evento (Cierre de apuestas)
              </span>
              <span className="font-normal text-[10px] text-slate-500">Hora local (UTC-4)</span>
            </label>
            <input
              id="market-close"
              type="datetime-local"
              value={closeTime}
              onChange={(event) => setCloseTime(event.target.value)}
              className="w-full rounded border border-[#222736] bg-[#090a0f] px-3 py-2 text-sm text-white focus:border-[#00f090] focus:outline-none"
            />
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Las apuestas cierran al comenzar el evento para evitar ventajas por juego en curso (anti court-siding).
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="market-description"
            className="mb-1 block text-[11px] font-bold text-slate-300"
          >
            Descripción <span className="font-normal text-slate-500">(opcional)</span>
          </label>
          <textarea
            id="market-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Contexto y condiciones para validar el resultado."
            className="w-full resize-none rounded border border-[#222736] bg-[#090a0f] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-300">
                Opciones ({MIN_OPTIONS}-{MAX_OPTIONS})
              </span>
              <span className="block text-[9px] text-slate-500">
                En deportes que admiten empate (ej. fútbol), añade la opción &quot;Empate&quot;.
              </span>
            </div>
            <button
              type="button"
              onClick={addOption}
              disabled={options.length >= MAX_OPTIONS}
              className="flex items-center gap-1 rounded border border-[#2d3447] bg-[#161a24] px-2 py-1 text-[10px] font-bold text-slate-200 transition hover:bg-[#1e2330] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> Añadir opción
            </button>
          </div>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center font-mono text-[10px] text-slate-500">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={option}
                  onChange={(event) => updateOption(index, event.target.value)}
                  maxLength={50}
                  placeholder={index === 0 ? 'Equipo A' : index === 1 ? 'Equipo B' : 'Otra opción'}
                  aria-label={`Opción ${index + 1}`}
                  className="w-full rounded border border-[#222736] bg-[#090a0f] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= MIN_OPTIONS}
                  className="shrink-0 rounded border border-[#2d3447] bg-[#161a24] p-2 text-slate-400 transition hover:border-[#f43f5e]/40 hover:text-[#f43f5e] disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Eliminar opción ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="market-source"
            className="mb-1 block text-[11px] font-bold text-slate-300"
          >
            Fuente de resolución <span className="font-normal text-slate-500">(opcional)</span>
          </label>
          <input
            id="market-source"
            type="text"
            value={resolutionSource}
            onChange={(event) => setResolutionSource(event.target.value)}
            maxLength={300}
            placeholder="Ej: marcador oficial de la liga, cuenta de Instagram del evento…"
            className="w-full rounded border border-[#222736] bg-[#090a0f] px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
          />
        </div>

        {error ? (
          <div className="rounded border border-[#f43f5e]/35 bg-[#1f1113] px-3 py-2 text-[11px] leading-relaxed text-[#fda4af]">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded bg-[#00f090] py-2.5 text-xs font-bold text-black transition hover:bg-[#00d681] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Spinner /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Creando mercado…' : 'Publicar mercado'}
        </button>
      </form>
    </Modal>
  );
}
