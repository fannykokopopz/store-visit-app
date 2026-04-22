import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/auth.js';
import { getStoresForUser, Store } from '../../db/queries/stores.js';
import { createVisit, getLastVisitForStore } from '../../db/queries/visits.js';
import { uploadVisitPhoto } from '../../db/queries/photos.js';
import {
  getStaffForStore,
  getActiveTrainingModules,
  addStaffToStore,
  logTraining,
  logAlly,
  Staff,
} from '../../db/queries/staff.js';
import { buildStorePicker } from '../keyboards/store-picker.js';
import { daysSinceLabel } from '../../utils/format.js';
import { config } from '../../config.js';

type VisitConversation = Conversation<BotContext, BotContext>;

const VISIT_TEMPLATE =
  `Copy and fill in your store update:\n\n` +
  `1️⃣ Good News\n\n` +
  `2️⃣ Competitors' Insights\n\n` +
  `3️⃣ Display & Stock\n\n` +
  `4️⃣ What to Follow Up\n\n` +
  `5️⃣ Buzz Plan\n\n` +
  `Skip any section that doesn't apply. Send photos with your message if you have them.`;

export async function visitFlow(conversation: VisitConversation, ctx: BotContext): Promise<void> {
  const chatId = ctx.from?.id;
  if (!chatId) return;

  const user = await conversation.external(async () => {
    const { getUserByTelegramId } = await import('../../db/queries/users.js');
    return getUserByTelegramId(chatId);
  });

  if (!user) {
    await ctx.reply("You're not registered. Contact your manager to get set up.");
    return;
  }

  // Step 1: Pick a store
  const stores = await conversation.external(() => getStoresForUser(user.id));
  if (stores.length === 0) {
    await ctx.reply("You don't have any stores assigned. Contact your manager.");
    return;
  }

  await ctx.reply('Which store did you visit?', {
    reply_markup: buildStorePicker(stores),
  });

  const storeCallback = await conversation.waitForCallbackQuery(/^(store:|cancel$)/);

  if (storeCallback.callbackQuery.data === 'cancel') {
    await storeCallback.answerCallbackQuery('Cancelled');
    await ctx.reply('Visit cancelled.');
    return;
  }

  const storeId = storeCallback.callbackQuery.data!.replace('store:', '');
  const store = stores.find((s: Store) => s.id === storeId);
  if (!store) {
    await storeCallback.answerCallbackQuery('Store not found');
    return;
  }

  await storeCallback.answerCallbackQuery();

  // Step 2: Show last visit context + template
  const lastVisit = await conversation.external(() => getLastVisitForStore(storeId, user.id));

  let contextMsg = `*${store.name}*\n\n`;
  if (lastVisit) {
    const snippet = (lastVisit.visit_notes || lastVisit.raw_notes_combined || '').slice(0, 200);
    contextMsg += `📋 Last visit: ${daysSinceLabel(lastVisit.visit_date)}\n`;
    if (snippet) contextMsg += `_${snippet}${snippet.length >= 200 ? '...' : ''}_\n\n`;
    else contextMsg += '\n';
  } else {
    contextMsg += `No previous visits on record.\n\n`;
  }

  await ctx.reply(contextMsg, { parse_mode: 'Markdown' });

  await ctx.reply(
    `1️⃣ Good News\n\n` +
    `2️⃣ Competitors' Insights\n\n` +
    `3️⃣ Display & Stock\n\n` +
    `4️⃣ What to Follow Up\n\n` +
    `5️⃣ Buzz Plan`,
  );

  await ctx.reply('Copy the template above, fill it in, and send. Add photos too if you have them.');

  // Step 3: Collect notes + photos
  const photoFileIds: string[] = [];
  let visitNotes = '';
  let collecting = true;

  while (collecting) {
    const response = await conversation.wait();

    if (response.message?.text === '/cancel') {
      await ctx.reply('Visit cancelled.');
      return;
    }

    if (response.message?.text) {
      visitNotes += (visitNotes ? '\n\n' : '') + response.message.text;
      await ctx.reply(
        `Got your update. Send photos now, or tap *Done* to save.`,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('Done — save visit', 'visit:done'),
        },
      );
    } else if (response.message?.photo) {
      const photos = response.message.photo;
      const largest = photos[photos.length - 1];
      photoFileIds.push(largest.file_id);

      if (response.message.caption && !visitNotes) {
        visitNotes = response.message.caption;
      } else if (response.message.caption) {
        visitNotes += '\n\n' + response.message.caption;
      }

      await ctx.reply(
        `${photoFileIds.length} photo(s) received. Send more, or tap *Done*.`,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('Done — save visit', 'visit:done'),
        },
      );
    } else if (response.callbackQuery?.data === 'visit:done') {
      await response.answerCallbackQuery();
      collecting = false;
    } else {
      await ctx.reply('Send your update as text or photos. Tap Done when finished.', {
        reply_markup: new InlineKeyboard().text('Done — save visit', 'visit:done'),
      });
    }
  }

  if (!visitNotes && photoFileIds.length === 0) {
    await ctx.reply('No update provided. Visit not saved. Use /visit to try again.');
    return;
  }

  // Step 4: Save visit
  await ctx.reply('Saving your visit...');

  const visit = await conversation.external(() =>
    createVisit({
      store_id: storeId,
      user_id: user.id,
      visit_notes: visitNotes || null,
    }),
  );

  if (!visit) {
    await ctx.reply('Something went wrong saving your visit. Please try again with /visit.');
    return;
  }

  // Upload photos
  if (photoFileIds.length > 0) {
    let uploaded = 0;
    for (const fileId of photoFileIds) {
      try {
        const file = await ctx.api.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
        const res = await fetch(fileUrl);
        const buffer = Buffer.from(await res.arrayBuffer());
        const fileName = `${crypto.randomUUID()}.jpg`;

        await conversation.external(() =>
          uploadVisitPhoto(visit.id, buffer, fileName, user.market, storeId),
        );
        uploaded++;
      } catch (err) {
        console.error('Photo upload failed:', err);
      }
    }
    if (uploaded < photoFileIds.length) {
      await ctx.reply(`${uploaded}/${photoFileIds.length} photos uploaded. Some failed.`);
    }
  }

  // Step 5: Confirmation + optional add-ons
  await ctx.reply(
    `✅ *Visit logged — ${store.name}*\n` +
    `📅 ${new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}\n` +
    (visitNotes ? '📝 Notes saved\n' : '') +
    (photoFileIds.length > 0 ? `📸 ${photoFileIds.length} photo(s)\n` : '') +
    `\nWant to update anything else?`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('Log training', 'addon:training').row()
        .text('Log ally', 'addon:ally').row()
        .text('Done', 'addon:done'),
    },
  );

  // Step 6: Optional add-on loop (uses wait() to handle any input gracefully)
  let addingMore = true;
  while (addingMore) {
    const addonResponse = await conversation.wait();
    const choice = addonResponse.callbackQuery?.data;
    if (addonResponse.callbackQuery) await addonResponse.answerCallbackQuery();

    if (choice === 'addon:done') {
      addingMore = false;
    } else if (choice === 'addon:training') {
      await handleTrainingAddon(conversation, ctx, visit.id, storeId);
      await showAddonMenu(ctx);
    } else if (choice === 'addon:ally') {
      await handleAllyAddon(conversation, ctx, visit.id, storeId, user.id);
      await showAddonMenu(ctx);
    } else if (addonResponse.message?.text === '/cancel') {
      addingMore = false;
    } else {
      await showAddonMenu(ctx);
    }
  }

  await ctx.reply('All done! Use /editvisit to make changes later.');
}

async function showAddonMenu(ctx: BotContext): Promise<void> {
  await ctx.reply('Anything else?', {
    reply_markup: new InlineKeyboard()
      .text('Log training', 'addon:training').row()
      .text('Log ally', 'addon:ally').row()
      .text('Done', 'addon:done'),
  });
}

async function handleTrainingAddon(
  conversation: VisitConversation,
  ctx: BotContext,
  visitId: string,
  storeId: string,
): Promise<void> {
  const staff = await conversation.external(() => getStaffForStore(storeId));
  const modules = await conversation.external(() => getActiveTrainingModules());

  if (modules.length === 0) {
    await ctx.reply('No training modules configured.');
    return;
  }

  // Pick staff
  const staffKb = new InlineKeyboard();
  for (const s of staff) {
    staffKb.text(s.name, `tstaff:${s.id}`).row();
  }
  staffKb.text('+ Add new staff', 'tstaff:new').row();
  staffKb.text('Back', 'tstaff:cancel').row();

  await ctx.reply('Who did you train?', { reply_markup: staffKb });

  const staffResponse = await conversation.wait();
  const staffData = staffResponse.callbackQuery?.data;
  if (staffResponse.callbackQuery) await staffResponse.answerCallbackQuery();

  if (!staffData?.startsWith('tstaff:') || staffData === 'tstaff:cancel') return;

  let selectedStaff: Staff | null = null;

  if (staffData === 'tstaff:new') {
    await ctx.reply("Type the staff member's name:");
    const nameCtx = await conversation.wait();
    const name = nameCtx.message?.text;
    if (!name || name === '/cancel') return;

    selectedStaff = await conversation.external(() => addStaffToStore(name, storeId));
    if (!selectedStaff) {
      await ctx.reply('Failed to add staff member.');
      return;
    }
    await ctx.reply(`Added ${name}.`);
  } else {
    const staffId = staffData.replace('tstaff:', '');
    selectedStaff = staff.find(s => s.id === staffId) || null;
  }

  if (!selectedStaff) return;

  // Pick module(s)
  const moduleKb = new InlineKeyboard();
  for (const m of modules) {
    moduleKb.text(m.name, `tmod:${m.id}`).row();
  }
  moduleKb.text('Done', 'tmod:done').row();

  await ctx.reply(`What did you train *${selectedStaff.name}* on? Tap each module, then Done.`, {
    parse_mode: 'Markdown',
    reply_markup: moduleKb,
  });

  const loggedModules: string[] = [];
  let pickingModules = true;

  while (pickingModules) {
    const modResponse = await conversation.wait();
    const modData = modResponse.callbackQuery?.data;
    if (modResponse.callbackQuery) await modResponse.answerCallbackQuery();

    if (!modData?.startsWith('tmod:') || modData === 'tmod:done') {
      pickingModules = false;
    } else {
      const moduleId = modData.replace('tmod:', '');
      const mod = modules.find(m => m.id === moduleId);
      if (mod && !loggedModules.includes(moduleId)) {
        await conversation.external(() => logTraining(visitId, selectedStaff!.id, moduleId));
        loggedModules.push(moduleId);
        await ctx.reply(`Logged: ${selectedStaff!.name} → ${mod.name}. Tap more or Done.`, {
          reply_markup: moduleKb,
        });
      }
    }
  }

  if (loggedModules.length > 0) {
    await ctx.reply(`Training logged for ${selectedStaff.name} (${loggedModules.length} module(s)).`);
  }
}

async function handleAllyAddon(
  conversation: VisitConversation,
  ctx: BotContext,
  visitId: string,
  storeId: string,
  cmId: string,
): Promise<void> {
  const staff = await conversation.external(() => getStaffForStore(storeId));

  if (staff.length === 0) {
    await ctx.reply('No staff on record for this store. Add them first via training log.');
    return;
  }

  const kb = new InlineKeyboard();
  for (const s of staff) {
    kb.text(s.name, `ally:${s.id}`).row();
  }
  kb.text('Back', 'ally:cancel').row();

  await ctx.reply('Which staff member qualified as an ally?', { reply_markup: kb });

  const response = await conversation.wait();
  const data = response.callbackQuery?.data;
  if (response.callbackQuery) await response.answerCallbackQuery();

  if (!data?.startsWith('ally:') || data === 'ally:cancel') return;

  const staffId = data.replace('ally:', '');
  const member = staff.find(s => s.id === staffId);
  if (!member) return;

  const success = await conversation.external(() => logAlly(visitId, staffId, cmId));

  if (success) {
    await ctx.reply(`${member.name} marked as ally this quarter.`);
  } else {
    await ctx.reply('Failed to log ally. Try again.');
  }
}
