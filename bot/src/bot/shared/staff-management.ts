import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/auth.js';
import {
  getAllStaffForStore,
  addStaffToStore,
  updateStaffName,
  updateStaffType,
  setStaffActiveAtStore,
  transferStaff,
  getStaffStats,
  Staff,
} from '../../db/queries/staff.js';
import { getStoresForUser } from '../../db/queries/stores.js';

type StaffConversation = Conversation<BotContext, BotContext>;

export const STAFF_TYPE_LABELS: Record<string, string> = {
  staff: 'Staff',
  other_brand: 'Other Brand',
  part_timer: 'Part Timer',
};

export function formatStaffDetail(member: Staff & { still_working: boolean }): string {
  return (
    `*${member.name}*\n` +
    `Type: ${STAFF_TYPE_LABELS[member.staff_type]}\n` +
    `Status: ${member.still_working ? '✅ Active' : '👋 Left'}`
  );
}

export async function formatStaffStatsMessage(
  conversation: StaffConversation,
  staffId: string,
  member: Staff & { still_working: boolean },
): Promise<string> {
  const stats = await conversation.external(() => getStaffStats(staffId));

  let msg = formatStaffDetail(member) + '\n';

  msg += `\n📋 *Training*\n`;
  if (stats.trainingsCompleted === 0) {
    msg += `No trainings logged yet\n`;
  } else {
    msg += `${stats.trainingsCompleted} training${stats.trainingsCompleted === 1 ? '' : 's'} completed\n`;
    if (stats.lastTrainingDate) {
      msg += `Last: ${new Date(stats.lastTrainingDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}\n`;
    }
    if (stats.modulesTrainedOn.length > 0) {
      msg += `Modules: ${stats.modulesTrainedOn.join(', ')}\n`;
    }
  }

  if (stats.assignmentHistory.length > 0) {
    msg += `\n🏪 *Store History*\n`;
    for (const a of stats.assignmentHistory) {
      const start = new Date(a.started_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
      if (a.ended_at) {
        const end = new Date(a.ended_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
        msg += `${a.store_name}: ${start} → ${end}\n`;
      } else {
        msg += `${a.store_name}: ${start} → present\n`;
      }
    }
  }

  return msg;
}

export async function handleStaffList(
  conversation: StaffConversation,
  ctx: BotContext,
  storeId: string,
): Promise<void> {
  let showInactive = false;

  const loop = async (): Promise<void> => {
    const allStaff = await conversation.external(() => getAllStaffForStore(storeId));
    const active = allStaff.filter(s => s.still_working);
    const inactive = allStaff.filter(s => !s.still_working);
    const displayStaff = showInactive ? allStaff : active;

    if (displayStaff.length === 0 && !showInactive) {
      await ctx.reply(
        "No staff on record for this store yet.\n\nType *add* to add someone, or /cancel to go back.",
        { parse_mode: 'Markdown' },
      );
    } else {
      let msg = '👥 *Staff List*\n\n';
      for (let i = 0; i < displayStaff.length; i++) {
        const s = displayStaff[i];
        const typeLabel = STAFF_TYPE_LABELS[s.staff_type];
        if (s.still_working) {
          msg += `*${i + 1}.* ${s.name} — ${typeLabel}\n`;
        } else {
          msg += `*${i + 1}.* ${s.name} — _left_ (${typeLabel})\n`;
        }
      }

      if (!showInactive && inactive.length > 0) {
        msg += `\n_${inactive.length} inactive staff hidden_\n`;
        msg += `Type *show all* to see them\n`;
      }
      msg += `\nType a number to view details, *add* to add someone new, or /cancel to go back.`;
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    }

    const response = await conversation.wait();
    const text = response.message?.text?.trim();

    if (!text || text === '/cancel') return;

    if (text.toLowerCase() === 'add') {
      await addNewStaff(conversation, ctx, storeId);
      return loop();
    }

    if (text.toLowerCase() === 'show all') {
      showInactive = true;
      return loop();
    }

    const allStaffRefresh = await conversation.external(() => getAllStaffForStore(storeId));
    const display = showInactive ? allStaffRefresh : allStaffRefresh.filter(s => s.still_working);
    const num = parseInt(text.replace(/^\//, ''), 10);

    if (isNaN(num) || num < 1 || num > display.length) {
      await ctx.reply(`Hmm, pick a number between 1 and ${display.length}, type *add*, or /cancel.`, { parse_mode: 'Markdown' });
      return loop();
    }

    const member = display[num - 1];
    await handleStaffDetail(conversation, ctx, storeId, member);
    return loop();
  };

  await loop();
}

export async function handleStaffDetail(
  conversation: StaffConversation,
  ctx: BotContext,
  storeId: string,
  member: Staff & { still_working: boolean },
): Promise<void> {
  const statsMsg = await formatStaffStatsMessage(conversation, member.id, member);

  const kb = new InlineKeyboard()
    .text('✏️ Edit name', 'sedit:name').row()
    .text('🔄 Change type', 'sedit:type').row()
    .text('🏪 Transfer store', 'sedit:transfer').row()
    .text(member.still_working ? '👋 Mark as left' : '🔙 Mark as still working', 'sedit:active').row()
    .text('← Back', 'sedit:cancel');

  await ctx.reply(statsMsg + '\nWhat would you like to do?', {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });

  const action = await conversation.wait();
  const choice = action.callbackQuery?.data;
  if (action.callbackQuery) await action.answerCallbackQuery();

  if (!choice || choice === 'sedit:cancel') return;

  if (choice === 'sedit:name') {
    await ctx.reply(`Current name: ${member.name}\nWhat should it be instead? (or /cancel)`);
    const nameCtx = await conversation.wait();
    const newName = nameCtx.message?.text;
    if (!newName || newName === '/cancel') return;

    const ok = await conversation.external(() => updateStaffName(member.id, newName));
    await ctx.reply(ok ? `Done — renamed to ${newName}. ✓` : "Hmm, that didn't work. Try again.");
  } else if (choice === 'sedit:type') {
    const typeKb = new InlineKeyboard()
      .text('Staff', 'stype:staff')
      .text('Other Brand', 'stype:other_brand')
      .text('Part Timer', 'stype:part_timer');

    await ctx.reply(`Currently: ${STAFF_TYPE_LABELS[member.staff_type]}\nWhat should it be?`, {
      reply_markup: typeKb,
    });

    const typeCtx = await conversation.wait();
    const typeData = typeCtx.callbackQuery?.data;
    if (typeCtx.callbackQuery) await typeCtx.answerCallbackQuery();
    if (!typeData?.startsWith('stype:')) return;

    const newType = typeData.replace('stype:', '') as Staff['staff_type'];
    const ok = await conversation.external(() => updateStaffType(member.id, newType));
    await ctx.reply(ok ? `Updated to ${STAFF_TYPE_LABELS[newType]}. ✓` : "Hmm, that didn't work. Try again.");
  } else if (choice === 'sedit:transfer') {
    await handleTransfer(conversation, ctx, storeId, member);
  } else if (choice === 'sedit:active') {
    const newActive = !member.still_working;
    const ok = await conversation.external(() => setStaffActiveAtStore(member.id, storeId, newActive));
    await ctx.reply(ok
      ? `Got it — ${member.name} marked as ${newActive ? 'still working ✅' : 'left 👋'}.`
      : "Hmm, that didn't work. Try again.");
  }
}

async function handleTransfer(
  conversation: StaffConversation,
  ctx: BotContext,
  currentStoreId: string,
  member: Staff & { still_working: boolean },
): Promise<void> {
  const chatId = ctx.from?.id;
  if (!chatId) return;

  const user = await conversation.external(async () => {
    const { getUserByTelegramId } = await import('../../db/queries/users.js');
    return getUserByTelegramId(chatId);
  });
  if (!user) return;

  const stores = await conversation.external(() => getStoresForUser(user.id));
  const otherStores = stores.filter(s => s.id !== currentStoreId);

  if (otherStores.length === 0) {
    await ctx.reply("You only have one store assigned, so there's nowhere to transfer to.");
    return;
  }

  let msg = `Transfer *${member.name}* to which store?\n\n`;
  for (let i = 0; i < otherStores.length; i++) {
    msg += `*${i + 1}.* ${otherStores[i].name}\n`;
  }
  msg += '\nType a number, or /cancel.';
  await ctx.reply(msg, { parse_mode: 'Markdown' });

  const response = await conversation.wait();
  const text = response.message?.text?.trim();
  if (!text || text === '/cancel') return;

  const num = parseInt(text.replace(/^\//, ''), 10);
  if (isNaN(num) || num < 1 || num > otherStores.length) {
    await ctx.reply("Didn't catch that — cancelled the transfer.");
    return;
  }

  const targetStore = otherStores[num - 1];
  const ok = await conversation.external(() => transferStaff(member.id, currentStoreId, targetStore.id));
  await ctx.reply(ok
    ? `Done! ${member.name} transferred to ${targetStore.name}. ✓`
    : "Something went wrong with the transfer. Try again later.");
}

export async function addNewStaff(
  conversation: StaffConversation,
  ctx: BotContext,
  storeId: string,
): Promise<void> {
  await ctx.reply("What's their name? (or /cancel)");
  const nameCtx = await conversation.wait();
  const name = nameCtx.message?.text;
  if (!name || name === '/cancel') return;

  const typeKb = new InlineKeyboard()
    .text('Staff', 'stype:staff')
    .text('Other Brand', 'stype:other_brand')
    .text('Part Timer', 'stype:part_timer');

  await ctx.reply(`What type is *${name}*?`, {
    parse_mode: 'Markdown',
    reply_markup: typeKb,
  });

  const typeCtx = await conversation.wait();
  const typeData = typeCtx.callbackQuery?.data;
  if (typeCtx.callbackQuery) await typeCtx.answerCallbackQuery();
  if (!typeData?.startsWith('stype:')) return;

  const staffType = typeData.replace('stype:', '') as Staff['staff_type'];
  const added = await conversation.external(() => addStaffToStore(name, storeId, staffType));
  if (added) {
    await ctx.reply(`Added ${name} (${STAFF_TYPE_LABELS[staffType]})! 👍`);
  } else {
    await ctx.reply("Hmm, couldn't add them. Try again later.");
  }
}
