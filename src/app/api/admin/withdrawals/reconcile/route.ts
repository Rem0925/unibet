import { NextResponse, type NextRequest } from 'next/server';
import { ReconcileWithdrawalSchema } from '@/lib/security';
import { logAudit } from '@/lib/server/audit';
import { requireRole } from '@/lib/server/auth';
import { ApiError, jsonError, parseBody } from '@/lib/server/http';
import { metadataRecord } from '@/lib/server/mappers';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';

interface WithdrawalRow {
  id: string;
  user_id: string;
  amount: string | number;
  status: string;
  reference_id: string;
  metadata: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireRole(request, ['ADMIN']);
    enforceRateLimit(`admin-reconcile:${profile.id}`, 30, 60_000);

    const { referenceId, action, note } = await parseBody(request, ReconcileWithdrawalSchema);
    const supabase = getServiceSupabase();

    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('id, user_id, amount, status, reference_id, metadata')
      .eq('reference_id', referenceId)
      .eq('type', 'WITHDRAW')
      .maybeSingle();

    if (txError) {
      console.error('[admin] Error buscando retiro:', txError);
      throw new Error('No se pudo leer el retiro');
    }

    const tx = txData as WithdrawalRow | null;
    if (!tx) {
      throw new ApiError('Retiro no encontrado', 404, 'WITHDRAW_NOT_FOUND');
    }

    const metadata = metadataRecord(tx.metadata);

    if (action === 'complete') {
      if (tx.status === 'COMPLETED') {
        return NextResponse.json({ success: true, message: 'El retiro ya estaba completado.' });
      }
      if (tx.status === 'FAILED') {
        throw new ApiError(
          'Este retiro ya fue reembolsado; no se puede marcar como completado.',
          409,
          'WITHDRAW_ALREADY_REFUNDED'
        );
      }

      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'COMPLETED',
          metadata: {
            ...metadata,
            reconciled_by: profile.id,
            reconciled_at: new Date().toISOString(),
            reconciliation_note: note ?? null,
          },
        })
        .eq('id', tx.id)
        .eq('status', 'PENDING');

      if (updateError) {
        console.error('[admin] Error marcando retiro completado:', updateError);
        throw new Error('No se pudo marcar el retiro como completado');
      }

      await logAudit({
        actorId: profile.id,
        action: 'WITHDRAW_MARKED_COMPLETED',
        targetUserId: tx.user_id,
        metadata: { referenceId, amount: tx.amount, note },
      });

      return NextResponse.json({ success: true, message: 'Retiro marcado como completado.' });
    }

    if (tx.status === 'FAILED') {
      return NextResponse.json({ success: true, message: 'El retiro ya estaba reembolsado.' });
    }
    if (tx.status === 'COMPLETED') {
      throw new ApiError(
        'Este retiro ya fue completado; no se puede reembolsar.',
        409,
        'WITHDRAW_ALREADY_COMPLETED'
      );
    }

    const { error: refundError } = await supabase.rpc('fn_refund_withdrawal', {
      p_user_id: tx.user_id,
      p_amount: Number(tx.amount),
      p_reference_id: referenceId,
      p_reason: note ?? 'Reembolso manual por revisión de administración',
    });

    if (refundError) {
      throwRpcError(refundError, 'No se pudo reembolsar el retiro');
    }

    await logAudit({
      actorId: profile.id,
      action: 'WITHDRAW_REFUNDED_MANUALLY',
      targetUserId: tx.user_id,
      metadata: { referenceId, amount: tx.amount, note },
    });

    return NextResponse.json({ success: true, message: 'Retiro reembolsado al usuario.' });
  } catch (error) {
    return jsonError(error);
  }
}
