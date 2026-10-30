'use client';

import { useEffect, useState } from 'react';
import {
  CalendarClock,
  Globe,
  Lock,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { MAX_MARKET_DAYS, MAX_OPTIONS, MIN_OPTIONS } from '@/lib/constants';
import { toDateTimeLocal } from '@/lib/format';
import type { CreateMarketResponse, GroupSummary, MarketVisibility } from '@/lib/types';
import { Modal, Spinner } from './ui';

export function CreateMarketModal({
  availableCategories = [],
  onClose,
  onCreated,
  showToast,
  onOpenGroups,
  initialGroupId,
}: {
  availableCategories?: string[];
  onClose: () => void;
  onCreated: () => Promise<void> | void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
  onOpenGroups?: () => void;
  initialGroupId?: string;
}) {
  const defaultCloseTime = () => {
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return toDateTimeLocal(next);
  };

  // Default suggested chips if no markets are open yet
  const categoryChips =
    availableCategories.length > 0
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

  // Audience & Visibility
  const [visibility, setVisibility] = useState<MarketVisibility>(
    initialGroupId ? 'GROUP' : 'PUBLIC'
  );
  const [groupId, setGroupId] = useState<string>(initialGroupId || '');
  const [accessCode, setAccessCode] = useState<string>('');
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchGroups = async () => {
      setLoadingGroups(true);
      try {
        const res = await apiFetch<{ groups: GroupSummary[] }>('/api/groups');
        if (active) {
          const approved = res.groups.filter((g) => g.userStatus === 'APPROVED');
          setGroups(approved);
          if (approved.length > 0) {
            setGroupId(approved[0].id);
          }
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoadingGroups(false);
      }
    };
    void fetchGroups();
    return () => {
      active = false;
    };
  }, []);

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

    if (visibility === 'GROUP' && !groupId) {
      setError('Debes pertenecer a un grupo y seleccionarlo para publicar una apuesta de grupo.');
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
          visibility,
          groupId: visibility === 'GROUP' ? groupId : undefined,
          accessCode:
            visibility === 'PRIVATE_CODE' && accessCode.trim()
              ? accessCode.trim().toUpperCase()
              : undefined,
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
    <Modal title="Crear nuevo evento" onClose={onClose} wide={true}>
      <form onSubmit={submit} className="space-y-4">
        {/* Selector de Audiencia / Visibilidad */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-300">
            ¿Quién puede ver y apostar en este evento?
          </label>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#1e2330] bg-[#11141c] p-1 text-xs font-semibold">
            {/* Opción 1: Pública */}
            <button
              type="button"
              onClick={() => setVisibility('PUBLIC')}
              className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg transition active:scale-95 cursor-pointer ${
                visibility === 'PUBLIC'
                  ? 'bg-[#00f090] text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#161a24]'
              }`}
            >
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Pública</span>
            </button>

            {/* Opción 2: Grupo Privado */}
            <button
              type="button"
              onClick={() => setVisibility('GROUP')}
              className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg transition active:scale-95 cursor-pointer ${
                visibility === 'GROUP'
                  ? 'bg-sky-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#161a24]'
              }`}
            >
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Grupo</span>
            </button>

            {/* Opción 3: Privada por Código */}
            <button
              type="button"
              onClick={() => setVisibility('PRIVATE_CODE')}
              className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg transition active:scale-95 cursor-pointer ${
                visibility === 'PRIVATE_CODE'
                  ? 'bg-purple-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#161a24]'
              }`}
            >
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Con Código</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            {visibility === 'PUBLIC' && 'Visible para todos los apostadores en el feed.'}
            {visibility === 'GROUP' && 'Visible únicamente para los miembros del grupo seleccionado.'}
            {visibility === 'PRIVATE_CODE' && 'Solo accesible mediante código secreto o link directo.'}
          </p>

          {/* Subpanel de Grupo */}
          {visibility === 'GROUP' ? (
            <div className="mt-2.5 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 space-y-2">
              <label htmlFor="group-select" className="block text-xs font-bold text-sky-300">
                Selecciona el grupo destino:
              </label>
              {loadingGroups ? (
                <div className="h-9 animate-pulse rounded-lg bg-[#141822]" />
              ) : groups.length === 0 ? (
                <div className="space-y-2 rounded-xl border border-dashed border-sky-500/30 bg-[#0c0d12]/60 p-3 text-xs text-slate-400">
                  <p className="font-semibold text-amber-400">
                    No perteneces a ningún grupo aprobado todavía.
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Crea un grupo para tus amigos o únete con un código de invitación para desbloquear apuestas privadas de grupo.
                  </p>
                  {onOpenGroups ? (
                    <button
                      type="button"
                      onClick={onOpenGroups}
                      className="flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-sky-300 active:scale-95 cursor-pointer"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>Crear o unirse a un grupo</span>
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <select
                    id="group-select"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full rounded-lg border border-[#212633] bg-[#0c0d12] px-3 py-2.5 text-base sm:text-xs font-semibold text-white focus:border-sky-400 focus:outline-none cursor-pointer"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.memberCount} miembros)
                      </option>
                    ))}
                  </select>
                  {onOpenGroups ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={onOpenGroups}
                        className="text-[11px] font-semibold text-sky-400 hover:underline cursor-pointer"
                      >
                        + Gestionar mis grupos
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {/* Subpanel de Código Privado */}
          {visibility === 'PRIVATE_CODE' ? (
            <div className="mt-2.5 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
              <label htmlFor="custom-code" className="block text-xs font-bold text-purple-300">
                Código secreto de acceso (opcional):
              </label>
              <input
                id="custom-code"
                type="text"
                maxLength={16}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="Ej: FINAL2026 (o deja en blanco para generar uno aleatorio)"
                className="w-full rounded-lg border border-[#212633] bg-[#0c0d12] px-3 py-2.5 font-mono text-base sm:text-xs font-bold text-white uppercase focus:border-purple-400 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400">
                Al crear el evento se generará un enlace directo que podrás compartir con tus amigos para que puedan apostar.
              </p>
            </div>
          ) : null}
        </div>

        {/* Título */}
        <div>
          <label htmlFor="market-title" className="mb-1 block text-xs font-bold text-slate-300">
            Título o pregunta *
          </label>
          <input
            id="market-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            className="w-full rounded-lg border border-[#2d3447] bg-[#0c0d12] px-3 py-2.5 text-base sm:text-sm text-white focus:border-[#00f090] focus:outline-none"
            placeholder="Ej: ¿Quién gana el clásico universitario?"
          />
        </div>

        {/* Categoría Dinámica */}
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-300">
            Categoría *
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
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
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
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
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
              className="mt-2 w-full rounded-lg border border-[#00f090]/50 bg-[#0c0d12] px-3 py-2.5 text-base sm:text-xs font-bold text-white focus:border-[#00f090] focus:outline-none"
              placeholder="Escribe el nombre de la categoría (Ej: POLÍTICA, FIESTA...)"
            />
          ) : null}
        </div>

        {/* Opciones */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">
              Opciones de resultado *
            </label>
            {options.length < MAX_OPTIONS ? (
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-1 text-xs font-semibold text-[#00f090] hover:underline active:scale-95"
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
                  className="flex-1 rounded-lg border border-[#2d3447] bg-[#0c0d12] px-3 py-2.5 text-base sm:text-xs text-white focus:border-[#00f090] focus:outline-none"
                  placeholder={`Opción ${i + 1}`}
                  required
                />
                {options.length > MIN_OPTIONS ? (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="p-2 text-slate-500 transition hover:text-red-400 active:scale-95"
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
            Fecha y hora de inicio (Cierre de apuestas) *
          </label>
          <input
            id="market-close"
            type="datetime-local"
            value={closeTime}
            onChange={(e) => setCloseTime(e.target.value)}
            className="w-full rounded-lg border border-[#2d3447] bg-[#0c0d12] px-3 py-2.5 text-base sm:text-xs text-white focus:border-[#00f090] focus:outline-none"
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
            className="w-full rounded-lg border border-[#2d3447] bg-[#0c0d12] px-3 py-2.5 text-base sm:text-xs text-white focus:border-[#00f090] focus:outline-none"
            placeholder="Condiciones específicas para certificar el ganador..."
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400">
            {error}
          </div>
        ) : null}

        {/* Botón de Publicación Sticky al pie del modal */}
        <div className="sticky -bottom-5 sm:-bottom-6 -mx-5 sm:-mx-6 px-5 sm:px-6 py-3.5 bg-[#0c0d12]/95 backdrop-blur-md border-t border-[#1e2330] mt-5 z-10">
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681] active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-[#00f090]/15"
          >
            {loading ? <Spinner className="h-4 w-4 text-black" /> : null}
            {loading ? 'Publicando…' : 'Publicar evento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
