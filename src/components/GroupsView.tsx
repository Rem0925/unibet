'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Plus,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import type { GroupMemberItem, GroupSummary } from '@/lib/types';
import { Spinner } from './ui';

interface GroupsViewProps {
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
  onExplore: () => void;
  onFilterGroup: (groupId: string, groupName: string) => void;
  onCreateInGroup: (groupId: string) => void;
}

export function GroupsView({
  showToast,
  onExplore,
  onFilterGroup,
  onCreateInGroup,
}: GroupsViewProps) {
  const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE' | 'JOIN'>('LIST');
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Managing members of a specific group
  const [managingGroupId, setManagingGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMemberItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ groups: GroupSummary[] }>('/api/groups');
      setGroups(res.groups);
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newGroupName.trim().length < 2) {
      showToast('El nombre del grupo debe tener al menos 2 caracteres', 'warn');
      return;
    }

    setCreating(true);
    try {
      const res = await apiFetch<{ success: boolean; group: GroupSummary }>('/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || undefined,
        }),
      });

      showToast(`¡Grupo "${res.group.name}" creado con éxito!`, 'success');
      setNewGroupName('');
      setNewGroupDesc('');
      await loadGroups();
      setActiveTab('LIST');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (cleanCode.length < 3) {
      showToast('Introduce un código de invitación válido', 'warn');
      return;
    }

    setJoining(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        status: string;
        message: string;
        group: { name: string };
      }>('/api/groups/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: cleanCode }),
      });

      showToast(res.message || 'Solicitud enviada al creador del grupo', 'success');
      setJoinCode('');
      await loadGroups();
      setActiveTab('LIST');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setJoining(false);
    }
  };

  const loadMembers = async (groupId: string) => {
    setLoadingMembers(true);
    try {
      const res = await apiFetch<{ members: GroupMemberItem[]; isCreator: boolean }>(
        `/api/groups/${groupId}/members`
      );
      setMembers(res.members);
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setLoadingMembers(false);
    }
  };

  const toggleManageMembers = (groupId: string) => {
    if (managingGroupId === groupId) {
      setManagingGroupId(null);
      setMembers([]);
    } else {
      setManagingGroupId(groupId);
      void loadMembers(groupId);
    }
  };

  const handleMemberAction = async (
    groupId: string,
    targetUserId: string,
    action: 'APPROVE' | 'REJECT' | 'REMOVE'
  ) => {
    setBusyMemberId(targetUserId);
    try {
      await apiFetch(`/api/groups/${groupId}/members`, {
        method: 'PATCH',
        body: JSON.stringify({ targetUserId, action }),
      });

      showToast(
        action === 'APPROVE'
          ? 'Miembro aprobado en el grupo'
          : action === 'REJECT'
            ? 'Solicitud rechazada'
            : 'Miembro retirado del grupo',
        'success'
      );
      await loadMembers(groupId);
      await loadGroups();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusyMemberId(null);
    }
  };

  const copyToClipboard = async (text: string, label: string, groupId?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (groupId) {
        setCopiedId(groupId);
        setTimeout(() => setCopiedId(null), 1800);
      }
      showToast(`${label} copiado al portapapeles`, 'success');
    } catch {
      showToast(`No se pudo copiar ${label}`, 'warn');
    }
  };

  const totalPendingRequests = groups.reduce(
    (acc, g) => (g.userRole === 'CREATOR' ? acc + (g.pendingCount || 0) : acc),
    0
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Barra de cabecera con botón de retorno */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onExplore}
          className="flex items-center gap-2 rounded-xl border border-[#1e2330] bg-[#11141c] px-3.5 py-2 text-xs font-semibold text-slate-300 hover:border-[#00f090]/40 hover:bg-[#161a24] hover:text-white transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-[#00f090]" />
          <span>Volver a Mercados</span>
        </button>

        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Comunidad
        </span>
      </div>

      {/* Cabecera centrada y equilibrada */}
      <div className="rounded-3xl border border-[#1e2330] bg-[#0c0d12] p-6 text-center space-y-3 shadow-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00f090]/10 text-[#00f090] ring-1 ring-[#00f090]/30">
          <Users className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Comunidad & Grupos Privados
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Crea grupos exclusivos con tus amigos o únete con un código de invitación para apostar en privado.
          </p>
        </div>

        {/* Indicadores centrados */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <div className="rounded-xl border border-[#1e2330] bg-[#141822] px-3.5 py-1.5 text-xs text-slate-300 font-semibold">
            Tus Grupos: <strong className="text-white ml-1">{groups.length}</strong>
          </div>
          {totalPendingRequests > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs text-amber-300 font-semibold">
              Pendientes: <strong className="text-amber-400 ml-1">{totalPendingRequests}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Selector de subpestañas centrado */}
      <div className="flex rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-1.5 gap-1.5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('LIST')}
          className={`flex flex-1 items-center justify-center gap-2 py-2.5 rounded-xl transition cursor-pointer active:scale-95 ${
            activeTab === 'LIST'
              ? 'bg-[#181c26] text-white shadow-sm ring-1 ring-[#283042]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="h-4 w-4 text-[#00f090]" />
          <span>Mis Grupos ({groups.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CREATE')}
          className={`flex flex-1 items-center justify-center gap-2 py-2.5 rounded-xl transition cursor-pointer active:scale-95 ${
            activeTab === 'CREATE'
              ? 'bg-[#181c26] text-white shadow-sm ring-1 ring-[#283042]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Plus className="h-4 w-4 text-[#00f090]" />
          <span>Crear Grupo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('JOIN')}
          className={`flex flex-1 items-center justify-center gap-2 py-2.5 rounded-xl transition cursor-pointer active:scale-95 ${
            activeTab === 'JOIN'
              ? 'bg-[#181c26] text-white shadow-sm ring-1 ring-[#283042]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserPlus className="h-4 w-4 text-[#00f090]" />
          <span>Unirme con Código</span>
        </button>
      </div>

      {/* CONTENIDO SEGÚN SUBPESTAÑA */}

      {/* 1. LISTA DE MIS GRUPOS */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl border border-[#1e2330] bg-[#11141c]"
                />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#1e2330] bg-[#0c0d12] p-8 sm:p-12 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#141822] text-[#00f090] ring-1 ring-[#1e2330]">
                <Users className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">No perteneces a ningún grupo aún</h3>
                <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Crea tu propio grupo para apostar en privado con amigos o ingresa el código de
                  invitación que te hayan compartido.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('CREATE')}
                  className="flex items-center gap-2 rounded-xl bg-[#00f090] px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-[#00d681] active:scale-95 cursor-pointer shadow-lg shadow-[#00f090]/20"
                >
                  <Plus className="h-4 w-4" /> Crear mi primer grupo
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('JOIN')}
                  className="flex items-center gap-2 rounded-xl border border-[#2d3447] bg-[#161a24] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-[#1e2330] active:scale-95 transition cursor-pointer"
                >
                  <UserPlus className="h-4 w-4 text-[#00f090]" /> Ingresar código
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((grp) => {
                const isCreator = grp.userRole === 'CREATOR';
                const isPending = grp.userStatus === 'PENDING';
                const isManaging = managingGroupId === grp.id;

                return (
                  <div
                    key={grp.id}
                    className="rounded-3xl border border-[#1e2330] bg-[#0c0d12] p-5 sm:p-6 transition hover:border-slate-700 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Información principal */}
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="font-bold text-white text-base sm:text-lg truncate">
                            {grp.name}
                          </h3>
                          {isCreator ? (
                            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                              CREADOR
                            </span>
                          ) : (
                            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              MIEMBRO
                            </span>
                          )}
                          {isPending ? (
                            <span className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              <Clock className="h-3 w-3" /> Esperando aprobación
                            </span>
                          ) : null}
                        </div>

                        {grp.description ? (
                          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            {grp.description}
                          </p>
                        ) : null}

                        {/* Metadatos y Código */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Users className="h-3.5 w-3.5 text-slate-500" />
                            <strong className="text-white">{grp.memberCount}</strong> miembros activos
                          </span>
                          <span className="text-slate-600">·</span>
                          <div className="flex items-center gap-2 rounded-lg border border-[#1e2330] bg-[#141822] px-2.5 py-1">
                            <span className="text-[11px] text-slate-500">Código:</span>
                            <span className="font-mono font-bold text-emerald-400 tracking-wider">
                              {grp.inviteCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(grp.inviteCode, 'Código del grupo', grp.id)}
                              className="ml-1 text-slate-400 hover:text-white transition cursor-pointer"
                              title="Copiar código"
                            >
                              {copiedId === grp.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onFilterGroup(grp.id, grp.name)}
                          className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 active:scale-95 transition cursor-pointer"
                        >
                          <TrendingUp className="h-3.5 w-3.5 text-sky-400" />
                          <span>Ver Mercados</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onCreateInGroup(grp.id)}
                          className="flex items-center gap-1.5 rounded-xl border border-[#00f090]/30 bg-[#00f090]/10 px-3 py-2 text-xs font-semibold text-[#00f090] hover:bg-[#00f090]/20 active:scale-95 transition cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Crear Apuesta</span>
                        </button>

                        {isCreator ? (
                          <button
                            type="button"
                            onClick={() => toggleManageMembers(grp.id)}
                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold active:scale-95 transition cursor-pointer ${
                              isManaging
                                ? 'border-[#00f090]/40 bg-[#00f090]/15 text-[#00f090]'
                                : 'border-[#2d3447] bg-[#161a24] text-slate-200 hover:bg-[#1e2330]'
                            }`}
                          >
                            <ShieldCheck className="h-4 w-4 text-amber-400" />
                            <span>
                              {isManaging
                                ? 'Ocultar Miembros'
                                : grp.pendingCount && grp.pendingCount > 0
                                  ? `Gestionar (${grp.pendingCount})`
                                  : 'Miembros'}
                            </span>
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Desplegable de gestión de miembros para el creador */}
                    {isManaging && (
                      <div className="pt-4 border-t border-[#1e2330] space-y-3 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                            <span>Miembros y Solicitudes Pendientes</span>
                            {loadingMembers ? <Spinner className="h-3 w-3" /> : null}
                          </h4>
                          <span className="text-[11px] text-slate-500">
                            Solo tú como creador puedes autorizar o remover participantes
                          </span>
                        </div>

                        {loadingMembers ? (
                          <div className="h-20 animate-pulse rounded-2xl border border-[#1e2330] bg-[#141822]/60" />
                        ) : members.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-[#1e2330] p-4 text-center text-xs text-slate-500">
                            No hay miembros registrados aún
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {members.map((m) => {
                              const isTargetPending = m.status === 'PENDING';
                              const isTargetCreator = m.role === 'CREATOR';
                              const isBusy = busyMemberId === m.userId;

                              return (
                                <div
                                  key={m.userId}
                                  className="flex items-center justify-between rounded-xl border border-[#1e2330] bg-[#141822]/80 px-3.5 py-2.5 text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-slate-300">
                                      {m.username.slice(0, 1).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-white truncate">
                                          @{m.username}
                                        </span>
                                        {isTargetCreator ? (
                                          <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-bold text-amber-400">
                                            Creador
                                          </span>
                                        ) : isTargetPending ? (
                                          <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-bold text-amber-300">
                                            Pendiente
                                          </span>
                                        ) : (
                                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400">
                                            Activo
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {!isTargetCreator && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {isTargetPending ? (
                                        <>
                                          <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() =>
                                              handleMemberAction(grp.id, m.userId, 'APPROVE')
                                            }
                                            className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/30 transition cursor-pointer"
                                          >
                                            <UserCheck className="h-3 w-3" />
                                            <span>Aprobar</span>
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() =>
                                              handleMemberAction(grp.id, m.userId, 'REJECT')
                                            }
                                            className="flex items-center gap-1 rounded-lg bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-400 hover:bg-rose-500/30 transition cursor-pointer"
                                          >
                                            <UserX className="h-3 w-3" />
                                            <span>Rechazar</span>
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          onClick={() =>
                                            handleMemberAction(grp.id, m.userId, 'REMOVE')
                                          }
                                          className="text-[11px] text-slate-500 hover:text-rose-400 transition cursor-pointer"
                                        >
                                          Remover
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. CREAR UN GRUPO (Formulario centrado y equilibrado) */}
      {activeTab === 'CREATE' && (
        <div className="rounded-3xl border border-[#1e2330] bg-[#0c0d12] p-6 sm:p-8 space-y-6 shadow-md">
          <div className="border-b border-[#1e2330] pb-4 text-center">
            <h3 className="text-base sm:text-lg font-bold text-white">
              Crear un Nuevo Círculo de Apuestas
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Como creador, tendrás control exclusivo sobre los miembros que ingresen y las apuestas del grupo.
            </p>
          </div>

          <form onSubmit={handleCreateGroup} className="space-y-4 max-w-md mx-auto">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-slate-300 block">
                Nombre del grupo o círculo *
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ej. Champions League Los Panas, Oficina VIP..."
                maxLength={50}
                required
                className="w-full rounded-xl border border-[#1e2330] bg-[#12151d] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#00f090] focus:outline-none transition"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-slate-300 block">
                Descripción (opcional)
              </label>
              <textarea
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                placeholder="Reglas del grupo, temática o notas para los integrantes..."
                rows={3}
                maxLength={200}
                className="w-full rounded-xl border border-[#1e2330] bg-[#12151d] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#00f090] focus:outline-none transition resize-none"
              />
            </div>

            <div className="rounded-2xl border border-[#1e2330] bg-[#141822]/60 p-4 text-xs text-slate-400 space-y-1 text-left">
              <div className="font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#00f090]" />
                <span>Privacidad Garantizada</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Al crear el grupo se generará un código de invitación único para compartir con tus amigos.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 rounded-xl bg-[#00f090] px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-[#00d681] active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-[#00f090]/20"
              >
                {creating ? <Spinner className="h-3.5 w-3.5 text-black" /> : <Plus className="h-3.5 w-3.5" />}
                <span>{creating ? 'Creando grupo...' : 'Crear Grupo Ahora'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('LIST')}
                className="rounded-xl border border-[#1e2330] px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. UNIRME CON CÓDIGO (Formulario centrado y equilibrado) */}
      {activeTab === 'JOIN' && (
        <div className="rounded-3xl border border-[#1e2330] bg-[#0c0d12] p-6 sm:p-8 space-y-6 shadow-md text-center">
          <div className="border-b border-[#1e2330] pb-4">
            <h3 className="text-base sm:text-lg font-bold text-white">
              Unirme a un Círculo Privado
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Ingresa el código que te compartió el creador del grupo para solicitar tu acceso.
            </p>
          </div>

          <form onSubmit={handleJoinGroup} className="space-y-4 max-w-sm mx-auto">
            <div className="space-y-2 text-center">
              <label className="text-xs font-semibold text-slate-300 block">
                Código de invitación del grupo
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="EJ: GRP-XYZ123"
                required
                className="w-full text-center rounded-xl border border-[#1e2330] bg-[#12151d] px-4 py-3 font-mono text-base uppercase text-white tracking-widest placeholder-slate-600 focus:border-[#00f090] focus:outline-none transition shadow-inner"
              />
            </div>

            <div className="rounded-2xl border border-[#1e2330] bg-[#141822]/60 p-4 text-xs text-slate-400 space-y-1 text-center">
              <div className="font-semibold text-white flex items-center justify-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <span>Proceso de Aprobación</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Al enviar el código, el creador recibirá tu solicitud y podrás apostar en cuanto te apruebe.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="submit"
                disabled={joining}
                className="flex items-center gap-2 rounded-xl bg-[#00f090] px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-[#00d681] active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-[#00f090]/20"
              >
                {joining ? <Spinner className="h-3.5 w-3.5 text-black" /> : <UserPlus className="h-3.5 w-3.5" />}
                <span>{joining ? 'Enviando solicitud...' : 'Unirme al Grupo'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('LIST')}
                className="rounded-xl border border-[#1e2330] px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
