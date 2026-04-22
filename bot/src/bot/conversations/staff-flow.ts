import { Conversation } from '@grammyjs/conversations';
import { BotContext } from '../middleware/auth.js';
import { getAllStaffForUser, StaffWithStore } from '../../db/queries/staff.js';
import { handleStaffDetail, addNewStaff, STAFF_TYPE_LABELS } from '../shared/staff-management.js';
import { getStoresForUser } from '../../db/queries/stores.js';
import { InlineKeyboard } from 'grammy';

type StaffConversation = Conversation<BotContext, BotContext>;

export async function staffFlow(conversation: StaffConversation, ctx: BotContext): Promise<void> {
  const chatId = ctx.from?.id;
  if (!chatId) return;

  const user = await conversation.external(async () => {
    const { getUserByTelegramId } = await import('../../db/queries/users.js');
    return getUserByTelegramId(chatId);
  });

  if (!user) {
    await ctx.reply("Hmm, I don't have you in the system yet. Check with your manager to get set up!");
    return;
  }

  await showStaffList(conversation, ctx, user.id, false);
}

async function showStaffList(
  conversation: StaffConversation,
  ctx: BotContext,
  userId: string,
  showInactive: boolean,
): Promise<void> {
  const allStaff = await conversation.external(() => getAllStaffForUser(userId));
  const active = allStaff.filter(s => s.still_working);
  const inactive = allStaff.filter(s => !s.still_working);
  const displayStaff = showInactive ? allStaff : active;

  if (displayStaff.length === 0 && !showInactive) {
    await ctx.reply(
      "No staff on record yet across your stores.\n\nType *add* to add someone, or /cancel to go back.",
      { parse_mode: 'Markdown' },
    );
  } else {
    const grouped = new Map<string, StaffWithStore[]>();
    for (const s of displayStaff) {
      const list = grouped.get(s.store_name) || [];
      list.push(s);
      grouped.set(s.store_name, list);
    }

    let msg = '👥 *All Staff*\n';
    let index = 1;
    const indexMap: StaffWithStore[] = [];

    for (const [storeName, members] of grouped) {
      msg += `\n🏪 *${storeName}*\n`;
      for (const m of members) {
        const typeLabel = STAFF_TYPE_LABELS[m.staff_type];
        if (m.still_working) {
          msg += `*${index}.* ${m.name} — ${typeLabel}\n`;
        } else {
          msg += `*${index}.* ${m.name} — _left_ (${typeLabel})\n`;
        }
        indexMap.push(m);
        index++;
      }
    }

    if (!showInactive && inactive.length > 0) {
      msg += `\n_${inactive.length} inactive staff hidden_\n`;
      msg += `Type *show all* to see them\n`;
    }
    msg += `\nType a number to view details, *add* to add someone new, or /cancel.`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  const response = await conversation.wait();
  const text = response.message?.text?.trim();

  if (!text || text === '/cancel') return;

  if (text.toLowerCase() === 'show all') {
    return showStaffList(conversation, ctx, userId, true);
  }

  if (text.toLowerCase() === 'add') {
    await pickStoreAndAddStaff(conversation, ctx, userId);
    return showStaffList(conversation, ctx, userId, showInactive);
  }

  const allStaffRefresh = await conversation.external(() => getAllStaffForUser(userId));
  const display = showInactive ? allStaffRefresh : allStaffRefresh.filter(s => s.still_working);

  const grouped = new Map<string, StaffWithStore[]>();
  for (const s of display) {
    const list = grouped.get(s.store_name) || [];
    list.push(s);
    grouped.set(s.store_name, list);
  }
  const flatList: StaffWithStore[] = [];
  for (const members of grouped.values()) {
    flatList.push(...members);
  }

  const num = parseInt(text.replace(/^\//, ''), 10);
  if (isNaN(num) || num < 1 || num > flatList.length) {
    await ctx.reply(`Pick a number between 1 and ${flatList.length}, type *add*, or /cancel.`, { parse_mode: 'Markdown' });
    return showStaffList(conversation, ctx, userId, showInactive);
  }

  const member = flatList[num - 1];
  await handleStaffDetail(conversation, ctx, member.store_id, member);
  return showStaffList(conversation, ctx, userId, showInactive);
}

async function pickStoreAndAddStaff(
  conversation: StaffConversation,
  ctx: BotContext,
  userId: string,
): Promise<void> {
  const stores = await conversation.external(() => getStoresForUser(userId));

  if (stores.length === 1) {
    await addNewStaff(conversation, ctx, stores[0].id);
    return;
  }

  let msg = 'Which store are they at?\n\n';
  for (let i = 0; i < stores.length; i++) {
    msg += `*${i + 1}.* ${stores[i].name}\n`;
  }
  msg += '\nType a number, or /cancel.';
  await ctx.reply(msg, { parse_mode: 'Markdown' });

  const response = await conversation.wait();
  const text = response.message?.text?.trim();
  if (!text || text === '/cancel') return;

  const num = parseInt(text.replace(/^\//, ''), 10);
  if (isNaN(num) || num < 1 || num > stores.length) {
    await ctx.reply("Didn't catch that — cancelled.");
    return;
  }

  await addNewStaff(conversation, ctx, stores[num - 1].id);
}
