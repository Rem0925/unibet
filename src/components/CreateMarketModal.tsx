'use client';

import { useState } from 'react';
import { CalendarClock, Plus, Trash2, X } from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { MAX_MARKET_DAYS, MAX_OPTIONS, MIN_OPTIONS } from '@/lib/constants';
import { toDateTimeLocal } from '@/lib/format';
import type { CreateMarketResponse } from '@/lib/types';
import { Modal, Spinner } from './ui';

export function CreateMarketModal({
  availableCategories = [],
  onClose,
  onCreated,
  showToast,
}: {
  availableCategories?: string[];
  onClose: () => void;
  onCreated: () => Promise<void> | void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
}) {
  const defaultCloseTime = () => {
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return toDateTimeLocal(next);
  };

  // Default suggested chips if no markets are open yet
  const categoryChips = availableCategories.length > 0
    ? availableCategories
    : ['FÚTBOL', 'BÉISBOL', 'CAMPUS', 'GAMING'];

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categoryChips[0] ?? 'GENERAL');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [closeTime, setCloseTime] = useState(defaultCloseTime);
  const [description, setDescription] = useState('');
  const [resolutionSource, setResolutionSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateOption = (index: number, value: string) => {
    setOptions((current) => current.map((opt, i) => (i === index ? value : opt)));
  };

  const addOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions((current) => [...current, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > MIN_OPTIONS) {
      setOptions((current) => current.filter((_, i) => i !== index));
    }
  };

  const effectiveCategory = (isCustomCategory ? customCategoryInput : category).trim().toUpperCase();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (title.trim().length < 5) {
      setError('El título del evento debe tener al menos 5 caracteres.');
      return;
    }

    if (effectiveCategory.length < 2) {
      setError('Escribe o selecciona una categoría para el evento.');
      return;
    }

    const cleanOptions = options.map((opt) => opt.trim()).filter((opt) => opt.length > 0);
    if (cleanOptions.length < MIN_OPTIONS) {
      setError(`Debes incluir al menos ${MIN_OPTIONS} opciones de resultado.`);
      return;
    }

    if (new Set(cleanOptions.map((opt) => opt.toLowerCase())).size !== cleanOptions.length) {
      setError('Las opciones no pueden estar duplicadas.');
      return;
    }

    const closeDate = new Date(closeTime);
    if (Number.isNaN(closeDate.getTime())) {
      setError('Fecha de cierre inválida.');
      return;
    }
    if (closeDate.getTime() < Date.now() + 60_000) {
      setError('La fecha de cierre debe estar al menos 1 minuto en el futuro.');
      return;
    }
    if (closeDate.getTime() > Date.now() + MAX_MARKET_DAYS * 86_400_000) {
      setError(`La fecha no puede superar los ${MAX_MARKET_DAYS} días.`);
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch<CreateMarketResponse>('/api/markets/create', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          category: effectiveCategory,
          options: cleanOptions,
          closeTime: closeDate.toISOString(),
          description: description.trim() || undefined,
          resolutionSource: resolutionSource.trim() || undefined,
        }),
      });

      showToast(response.message || 'Evento creado con éxito', 'success');
      await onCreated();
      onClose();
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Crear nuevo evento" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {/* Título */}
        <div>
          <label htmlFor="market-title" className="mb-1 block text-xs font-bold text-slate-300">
            Título o pregunta
          </label>
          <input
            id="market-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            className="w-full rounded-lg border border-[#2d3447] bg-[#0c0d12] px-3 py-2 text-sm text-white focus:border-[#00f090] focus:outline-none"
            placeholder="Ej: ¿Quién gana el clásico universitario?"
          />
        </div>

        {/* Categoría Dinámica */}
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-300">
            Categoría
          </label>
          <div className="flex flex-wrap gap-1.5">
            {categoryChips.map((cat) => {
              const active = !isCustomCategory && category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat);
                    setIsCustomCategory(false);
                  }}
                  className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? 'border-[#00f090] bg-[#00f090]/15 text-[#00f090]'
                      : 'border-[#2d3447] bg-[#141822] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setIsCustomCategory(true)}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                isCustomCategory
                  ? 'border-[#00f090] bg-[#00f090]/15 text-[#00f090]'
                  : 'border-[#2d3447] bg-[#141822] text-slate-300 hover:border-slate-500'
              }`}
            >
              + Personalizada
            </button>
          </div>

          {isCustomCategory ? (
            <input
              type="text"
              value={customCategoryInput}
              onChange={(e) => setCustomCategoryInput(e.target.value.toUpperCase())}
              maxLength={30}
              autoFocus
              className="mt-2 w-full rounded-lg border border-[#00f090]/50 bg-[#0c0d12] px-3 py-2 text-xs font-bold text-white focus:border-[#00f090] focus:outline-none"
              placeholder="Escribe el nombre de la categoría (Ej: POLÍTICA, FIESTA...)"
            />
          ) : null}
        </div>

        {/* Opciones */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">
              Opciones de resultado
            </label>
            {options.length < MAX_OPTIONS ? (
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-1 text-xs font-semibold text-[#00f090] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar opción
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  maxLength={50}
                  className="flex-1 rounded-lg border border-[#2d3447] bg-[#0c0d12] px-3 py-2 text-xs text-white focus:border-[#00f090] focus:outline-none"
                  placeholder={`Opción ${i + 1}`}
                  required
                />
                {options.length > MIN_OPTIONS ? (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="p-1.5 text-slate-500 transition hover:text-red-400"
                    aria-label="Eliminar opción"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Cierre de apuestas */}
        <div>
          <label htmlFor="market-close" className="mb-1 block text-xs font-bold text-slate-300">
            Fecha y hora de inicio (Cierre de apuestas)
          </label>
          <input
            id="market-close"
            type="datetime-local"
            value={closeTime}
            onChange={(e) => setCloseTime(e.target.value)}
            className="w-full rounded-lg border border-[#2d3447] bg-[#0c0d12] px-3 py-2 text-xs text-white focus:border-[#00f090] focus:outline-none"
            required
          />
        </div>

        {/* Detalles opcionales */}
        <div>
          <label htmlFor="market-desc" className="mb-1 block text-xs font-bold text-slate-300">
            Detalles o condiciones (opcional)
          </label>
          <input
            id="market-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            className="w-full rounded-lg border border-[#2d3447] bg-[#0c0d12] px-3 py-2 text-xs text-white focus:border-[#00f090] focus:outline-none"
            placeholder="Condiciones específicas para certificar el ganador..."
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00f090] py-2.5 text-sm font-bold text-black transition hover:bg-[#00d681] disabled:opacity-50"
        >
          {loading ? <Spinner className="h-4 w-4" /> : null}
          {loading ? 'Publicando…' : 'Publicar evento'}
        </button>
      </form>
    </Modal>
  );
}
