'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Plus,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import type { GroupMemberItem, GroupSummary } from '@/lib/types';
import { Modal, Spinner } from './ui';

interface GroupsModalProps {
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
  onGroupsChanged?: () => void;
  onFilterGroup?: (groupId: string, groupName: string) => void;
  onCreateInGroup?: (groupId: string) => void;
}

export function GroupsModal({
  onClose,
  showToast,
  onGroupsChanged,
  onFilterGroup,
  onCreateInGroup,
}: GroupsModalProps) {
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
      onGroupsChanged?.();
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

      showToast(res.message || 'Solicitud enviada al creador', 'success');
      setJoinCode('');
      await loadGroups();
      setActiveTab('LIST');
      onGroupsChanged?.();
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
      onGroupsChanged?.();
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

  return (
    <Modal
      title="Grupos de Apuestas Privadas"
      subtitle="Crea tus propios círculos exclusivos o únete con código de invitación."
      icon={<Users className="h-5 w-5 text-[#00f090]" />}
      onClose={onClose}
      wide={true}
    >
      <div className="space-y-4">
        {/* Selector de pestañas */}
        <div className="flex rounded-xl border border-[#1e2330] bg-[#11141c] p-1 gap-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('LIST')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 rounded-lg transition ${
              activeTab === 'LIST'
                ? 'bg-[#181c26] text-white shadow-sm ring-1 ring-[#283042]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Mis Grupos ({groups.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CREATE')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 rounded-lg transition ${
              activeTab === 'CREATE'
                ? 'bg-[#181c26] text-white shadow-sm ring-1 ring-[#283042]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Crear Grupo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('JOIN')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 rounded-lg transition ${
              activeTab === 'JOIN'
                ? 'bg-[#181c26] text-white shadow-sm ring-1 ring-[#283042]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Unirme</span>
          </button>
        </div>

        {/* PESTAÑA 1: LISTA DE MIS GRUPOS */}
        {activeTab === 'LIST' ? (
          <div>
            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-2xl border border-[#1e2330] bg-[#11141c]"
                  />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#1e2330] p-6 text-center space-y-3">
                <Users className="mx-auto h-8 w-8 text-slate-500" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">No perteneces a ningún grupo aún</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Crea un grupo para tus amigos o solicita unirte con el código de invitación que te hayan compartido.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('CREATE')}
                    className="flex items-center gap-1.5 rounded-xl bg-[#00f090] px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-[#00d681]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Crear mi primer grupo
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('JOIN')}
                    className="flex items-center gap-1.5 rounded-xl border border-[#2d3447] bg-[#161a24] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-[#1e2330]"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Ingresar código
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((grp) => {
                  const isCreator = grp.userRole === 'CREATOR';
                  const isPending = grp.userStatus === 'PENDING';
                  const isManaging = managingGroupId === grp.id;

                  return (
                    <div
                      key={grp.id}
                      className="rounded-2xl border border-[#1e2330] bg-[#0e1118] p-3.5 sm:p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm sm:text-base truncate">
                              {grp.name}
                            </span>
                            {isCreator ? (
                              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                                CREADOR
                              </span>
                            ) : (
                              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                                MIEMBRO
                              </span>
                            )}
                            {isPending ? (
                              <span className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                <Clock className="h-3 w-3" /> Esperando aprobación
                              </span>
                            ) : null}
                          </div>
                          {grp.description ? (
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              {grp.description}
                            </p>
                          ) : null}
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>{grp.memberCount} miembros activos</span>
                            <span>·</span>
                            <span className="font-mono text-slate-400">Código: {grp.inviteCode}</span>
                          </div>
                        </div>

                        {/* Botones de acción del grupo */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onFilterGroup?.(grp.id, grp.name);
                              onClose();
                            }}
                            className="flex items-center gap-1 rounded-xl border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 active:scale-95 transition cursor-pointer"
                            title="Ver eventos de este grupo"
                          >
                            <TrendingUp className="h-3 w-3 text-sky-400" />
                            <span>Ver eventos</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              onCreateInGroup?.(grp.id);
                              onClose();
                            }}
                            className="flex items-center gap-1 rounded-xl border border-[#00f090]/30 bg-[#00f090]/10 px-2.5 py-1.5 text-xs font-semibold text-[#00f090] hover:bg-[#00f090]/20 active:scale-95 transition cursor-pointer"
                            title="Crear apuesta para este grupo"
                          >
                            <Plus className="h-3 w-3" />
                            <span>+ Apostar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => copyToClipboard(grp.inviteCode, 'Código del grupo', grp.id)}
                            className="flex items-center gap-1 rounded-xl border border-[#212633] bg-[#141822] px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white active:scale-95 transition"
                          >
                            {copiedId === grp.id ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3 text-[#00f090]" />
                            )}
                            <span className="sm:inline">{copiedId === grp.id ? '¡Copiado!' : 'Copiar'}</span>
                          </button>

                          {isCreator ? (
                            <button
                              type="button"
                              onClick={() => toggleManageMembers(grp.id)}
                              className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold active:scale-95 transition ${
                                isManaging
                                  ? 'border-[#00f090]/40 bg-[#00f090]/15 text-[#00f090]'
                                  : 'border-[#2d3447] bg-[#161a24] text-slate-200 hover:bg-[#1e2330]'
                              }`}
                            >
                              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                              <span>{isManaging ? 'Ocultar Miembros' : 'Miembros'}</span>
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* Panel desplegable de Miembros y Solicitudes */}
                      {isManaging ? (
                        <div className="pt-2 border-t border-[#1e2330] space-y-3">
                          <h5 className="text-xs font-bold text-slate-300 flex items-center justify-between">
                            <span>Solicitudes y Miembros del Grupo</span>
                            {loadingMembers ? <Spinner className="h-3 w-3" /> : null}
                          </h5>

                          {loadingMembers ? (
                            <div className="h-16 animate-pulse rounded-xl border border-[#1e2330] bg-[#141822]/60" />
                          ) : members.length === 0 ? (
                            <div className="text-xs text-slate-500 py-2">No hay otros miembros aún.</div>
                          ) : (
                            <div className="space-y-2">
                              {/* Solicitudes Pendientes */}
                              {members.some((m) => m.status === 'PENDING') ? (
                                <div className="space-y-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5">
                                  <span className="text-[11px] font-bold text-amber-400 block mb-1">
                                    Solicitudes por Aceptar
                                  </span>
                                  {members
                                    .filter((m) => m.status === 'PENDING')
                                    .map((pendingMem) => (
                                      <div
                                        key={pendingMem.id}
                                        className="flex items-center justify-between text-xs py-1"
                                      >
                                        <span className="font-semibold text-white">
                                          @{pendingMem.username}
                                        </span>
                                        <div className="flex gap-1.5">
                                          <button
                                            type="button"
                                            disabled={busyMemberId === pendingMem.userId}
                                            onClick={() =>
                                              handleMemberAction(grp.id, pendingMem.userId, 'APPROVE')
                                            }
                                            className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/25 active:scale-95 disabled:opacity-50"
                                          >
                                            <Check className="h-3 w-3" /> Aceptar
                                          </button>
                                          <button
                                            type="button"
                                            disabled={busyMemberId === pendingMem.userId}
                                            onClick={() =>
                                              handleMemberAction(grp.id, pendingMem.userId, 'REJECT')
                                            }
                                            className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-400 hover:bg-rose-500/25 active:scale-95 disabled:opacity-50"
                                          >
                                            <X className="h-3 w-3" /> Rechazar
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              ) : null}

                              {/* Miembros Aprobados */}
                              <div className="divide-y divide-[#1e2330]">
                                {members
                                  .filter((m) => m.status === 'APPROVED')
                                  .map((approvedMem) => (
                                    <div
                                      key={approvedMem.id}
                                      className="flex items-center justify-between py-1.5 text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#141822] text-[10px] font-bold text-[#00f090] border border-[#212633]">
                                          {approvedMem.username.slice(0, 2).toUpperCase()}
                                        </div>
                                        <span className="font-semibold text-slate-200">
                                          @{approvedMem.username}
                                        </span>
                                        {approvedMem.role === 'CREATOR' ? (
                                          <span className="text-[9px] font-bold text-amber-400">
                                            (Creador)
                                          </span>
                                        ) : null}
                                      </div>

                                      {approvedMem.role !== 'CREATOR' ? (
                                        <button
                                          type="button"
                                          disabled={busyMemberId === approvedMem.userId}
                                          onClick={() =>
                                            handleMemberAction(grp.id, approvedMem.userId, 'REMOVE')
                                          }
                                          className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-0.5 active:scale-95"
                                        >
                                          <UserX className="h-3 w-3" /> Expulsar
                                        </button>
                                      ) : null}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* PESTAÑA 2: CREAR GRUPO */}
        {activeTab === 'CREATE' ? (
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label htmlFor="group-name" className="block text-xs font-bold text-slate-300 mb-1">
                Nombre del Grupo *
              </label>
              <input
                id="group-name"
                type="text"
                required
                maxLength={60}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ej: Amigos de la Champions, Crypto Traders..."
                className="w-full rounded-xl border border-[#212633] bg-[#090a0f] px-3.5 py-2.5 text-base sm:text-xs text-white placeholder-slate-500 focus:border-[#00f090] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="group-desc" className="block text-xs font-bold text-slate-300 mb-1">
                Descripción (opcional)
              </label>
              <textarea
                id="group-desc"
                rows={3}
                maxLength={300}
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                placeholder="Ej: Solo apuestas y predicciones privadas de la liga entre amigos..."
                className="w-full rounded-xl border border-[#212633] bg-[#090a0f] px-3.5 py-2 text-base sm:text-xs text-white placeholder-slate-500 focus:border-[#00f090] focus:outline-none transition-colors"
              />
            </div>

            <div className="rounded-xl border border-[#1e2330] bg-[#141822]/60 p-3 text-xs text-slate-400 space-y-1">
              <span className="font-bold text-slate-300 block">Información importante:</span>
              <p>• Como creador, tú serás el único con permiso para aceptar o rechazar miembros.</p>
              <p>• Al crear el grupo, se te entregará un código único para invitar a tus amigos.</p>
            </div>

            <button
              type="submit"
              disabled={creating || !newGroupName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-xs font-bold text-slate-950 transition hover:bg-[#00d681] active:scale-[0.98] disabled:opacity-50 shadow-md shadow-[#00f090]/15"
            >
              {creating ? <Spinner className="h-4 w-4 text-black" /> : <Plus className="h-4 w-4 text-black" />}
              {creating ? 'Creando grupo...' : 'Crear Grupo'}
            </button>
          </form>
        ) : null}

        {/* PESTAÑA 3: UNIRSE CON CÓDIGO */}
        {activeTab === 'JOIN' ? (
          <form onSubmit={handleJoinGroup} className="space-y-4">
            <div>
              <label htmlFor="invite-code" className="block text-xs font-bold text-slate-300 mb-1">
                Código de Invitación del Grupo *
              </label>
              <input
                id="invite-code"
                type="text"
                required
                maxLength={16}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Ej: GRP-78X29A"
                className="w-full rounded-xl border border-[#212633] bg-[#090a0f] px-3.5 py-2.5 font-mono text-base sm:text-sm font-bold text-white uppercase placeholder-slate-500 focus:border-[#00f090] focus:outline-none transition-colors"
              />
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-slate-300 space-y-1">
              <span className="font-bold text-sky-400 block">¿Cómo funciona la unión?</span>
              <p>• Al ingresar el código, se enviará una solicitud al creador del grupo.</p>
              <p>• Una vez que el creador te apruebe, podrás ver y apostar en todos los mercados privados del grupo.</p>
            </div>

            <button
              type="submit"
              disabled={joining || !joinCode.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-xs font-bold text-slate-950 transition hover:bg-[#00d681] active:scale-[0.98] disabled:opacity-50 shadow-md shadow-[#00f090]/15"
            >
              {joining ? <Spinner className="h-4 w-4 text-black" /> : <UserPlus className="h-4 w-4 text-black" />}
              {joining ? 'Enviando solicitud...' : 'Solicitar Unirme al Grupo'}
            </button>
          </form>
        ) : null}
      </div>
    </Modal>
  );
}
