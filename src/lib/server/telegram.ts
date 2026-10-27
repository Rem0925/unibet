/**
 * Módulo de Notificaciones para Telegram Bot (Opcional)
 * Si TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no están configurados,
 * el módulo se desactiva silenciosamente sin romper ninguna petición.
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return false; // Modo silencioso si no está configurado
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      console.warn('[telegram] Error enviando mensaje a Telegram:', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[telegram] Error de red enviando a Telegram:', err);
    return false;
  }
}

export async function notifyNewMarket(params: {
  title: string;
  creator: string;
  category: string;
  options: string[];
  closeTime: string;
}) {
  const optionsText = params.options.map((opt, i) => `  ${i + 1}. <b>${opt}</b>`).join('\n');
  const message = `🔥 <b>¡Nueva Apuesta en UniBet!</b>\n\n` +
    `📌 <b>${params.title}</b>\n` +
    `🏷️ Categoría: <code>${params.category}</code>\n` +
    `👤 Creador: @${params.creator}\n\n` +
    `🎯 <b>Opciones disponibles:</b>\n${optionsText}\n\n` +
    `⏳ <i>¡Entra a la app a meterle dinero al pozo!</i>`;

  return sendTelegramMessage(message);
}

export async function notifyMarketResolved(params: {
  title: string;
  winner: string;
  totalPool: number;
}) {
  const message = `🏆 <b>¡Mercado Liquidado en UniBet!</b>\n\n` +
    `📌 <b>${params.title}</b>\n` +
    `✅ <b>Resultado Ganador:</b> <code>${params.winner}</code>\n` +
    `💰 <b>Pozo Total Repartido:</b> $${params.totalPool.toFixed(2)} USDT\n\n` +
    `🎉 <i>¡Felicitaciones a los que acertaron el pronóstico!</i>`;

  return sendTelegramMessage(message);
}

export async function notifyMarketCancelled(params: {
  title: string;
  reason: string;
}) {
  const message = `⚠️ <b>Mercado Cancelado en UniBet</b>\n\n` +
    `📌 <b>${params.title}</b>\n` +
    `🛑 Motivo: <i>${params.reason}</i>\n\n` +
    `🔄 <b>Se ha reembolsado el 100% del dinero apostado a cada amigo sin comisiones.</b>`;

  return sendTelegramMessage(message);
}
