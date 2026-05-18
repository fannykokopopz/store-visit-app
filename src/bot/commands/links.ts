import { BotContext, requireAuth } from '../middleware/auth.js';
import { CM } from '../../db/queries/cms.js';

const STORE_OBJECTIVE_URL =
  'https://docs.google.com/spreadsheets/d/1N3jwzfa8Z1PkH55rR2IqAqW1AOZ6P5YJ6Mw2xT-gOdk/edit?usp=drive_link';

const ASSET_VERIFICATION_URLS: Record<CM['market'], string> = {
  SG: 'https://docs.google.com/spreadsheets/d/1uXwbMcOMwWZNTt2tO1LNXhvMSfl0soXgYsC7HzAFYSw/edit?gid=107039806#gid=107039806',
  MY: 'https://docs.google.com/spreadsheets/d/155Piwe5JA1ANhIzC5-B2-DMBju_B10f61WdNiIlVrBY/edit?gid=107039806#gid=107039806',
  HK: 'https://docs.google.com/spreadsheets/d/1PWhDXBDmNhdmuh_pWJk1b1D7h93hbVmUNRJ2hQP6NFA/edit?gid=107039806#gid=107039806',
  TH: 'https://docs.google.com/spreadsheets/d/1MPo5vwBZ4nSpulBDg2JiaKK3APHAfdCX6wqyzq-ft54/edit?gid=107039806#gid=107039806',
};

export async function handleLinks(ctx: BotContext): Promise<void> {
  const user = requireAuth(ctx);
  if (!user) return;

  const assetUrl = ASSET_VERIFICATION_URLS[user.market];

  await ctx.reply(
    `📌 <b>Quick Links</b> — pin this message for easy access\n\n` +
    `📋 <b>Store Objective sheet</b>\n` +
    `${STORE_OBJECTIVE_URL}\n\n` +
    `✅ <b>Asset Verification form</b> (${user.market})\n` +
    `${assetUrl}`,
    { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
  );
}
