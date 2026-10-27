import { getServiceSupabase } from './supabase';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const { error } = await getServiceSupabase()
    .from('audit_logs')
    .insert({
      actor_id: entry.actorId ?? null,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      metadata: entry.metadata ?? {},
    });

  if (error) {
    console.error('[audit] No se pudo escribir el registro de auditoría:', error.message, entry);
  }
}
