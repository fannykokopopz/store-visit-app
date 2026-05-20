import { Bot } from 'grammy';
import { config } from '../config.js';
import { getIntelligenceRecipients } from '../db/queries/intelligence.js';

// ─── Format conversion: dashboard markdown → Telegram-friendly text ──────────

/**
 * Convert the dashboard-friendly brief (with tables) to a Telegram-friendly
 * version (tables collapse into formatted bullets). Same data, mobile layout.
 */
export function formatBriefForTelegram(briefMarkdown: string): string {
  const lines = briefMarkdown.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Markdown table detection: header row | sep | body rows
    const looksLikeTableHeader =
      line.trim().startsWith('|') &&
      i + 1 < lines.length &&
      lines[i + 1].trim().match(/^\|[\s\-:|]+\|$/);

    if (looksLikeTableHeader) {
      const header = line
        .trim()
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      i += 2; // skip header + separator

      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i]
          .trim()
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean);
        const bullet = cells
          .map((cell, idx) => (idx === 0 ? `• <b>${cell}</b>` : cell))
          .join(' — ');
        out.push(bullet);
        i++;
      }
      continue;
    }

    out.push(line);
    i++;
  }

  return (
    out
      .join('\n')
      // Strip Markdown table separator if any survived
      .replace(/^\|[\s\-:|]+\|$/gm, '')
      // Convert h1/h2/h3 to bold
      .replace(/^#{1,3}\s+(.+)$/gm, '<b>$1</b>')
      // Convert **bold** to <b>
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      // Convert *italic* / _italic_ to <i> (best-effort)
      .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<i>$1</i>')
      // Escape stray < and > that aren't part of our tags
      .replace(/<(?!\/?(b|i|u|s|code|pre|a)\b)/g, '&lt;')
      // Collapse 3+ blank lines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

// ─── Sending ──────────────────────────────────────────────────────────────────

const TELEGRAM_MSG_LIMIT = 4096;

function chunkForTelegram(text: string): string[] {
  if (text.length <= TELEGRAM_MSG_LIMIT) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_MSG_LIMIT) {
      chunks.push(remaining);
      break;
    }
    // Break on a double newline near the limit if possible
    const slice = remaining.slice(0, TELEGRAM_MSG_LIMIT);
    const breakIdx = slice.lastIndexOf('\n\n');
    const cut = breakIdx > TELEGRAM_MSG_LIMIT * 0.6 ? breakIdx : TELEGRAM_MSG_LIMIT;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  return chunks;
}

export interface BroadcastResult {
  sent: number;
  failed: { telegram_id: number; error: string }[];
}

export async function broadcastIntelligenceBrief(
  briefMarkdown: string,
): Promise<BroadcastResult> {
  const recipients = await getIntelligenceRecipients();
  if (recipients.length === 0) {
    console.log('broadcastIntelligenceBrief: no recipients (is_intelligence_recipient=true on cms)');
    return { sent: 0, failed: [] };
  }

  const bot = new Bot(config.telegram.botToken);
  const formatted = formatBriefForTelegram(briefMarkdown);
  const chunks = chunkForTelegram(formatted);

  let sent = 0;
  const failed: { telegram_id: number; error: string }[] = [];

  for (const recipient of recipients) {
    try {
      for (const chunk of chunks) {
        await bot.api.sendMessage(recipient.telegram_id, chunk, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
      }
      sent++;
    } catch (err) {
      failed.push({
        telegram_id: recipient.telegram_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { sent, failed };
}
