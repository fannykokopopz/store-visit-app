import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/auth.js';
import { getStoresForUser, Store } from '../../db/queries/stores.js';
import { createVisit, getStoreVisitStats } from '../../db/queries/visits.js';
import { uploadVisitPhoto } from '../../db/queries/photos.js';
import {
  getStaffForStore,
  getAllStaffForStore,
  getActiveTrainingModules,
  addStaffToStore,
  logTraining,
  updateStaffName,
  updateStaffType,
  setStaffActiveAtStore,
  Staff,
} from '../../db/queries/staff.js';
import { buildStorePicker } from '../keyboards/store-picker.js';
import { config } from '../../config.js';

type VisitConversation = Conversation<BotContext, BotContext>;

export async function visitFlow(conversation: VisitConversation, ctx: BotContext): Promise<void> {
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

  // Step 1: Pick a store
  const stores = await conversation.external(() => getStoresForUser(user.id));
  if (stores.length === 0) {
    await ctx.reply("Looks like you don't have any stores assigned yet. Check with your manager!");
    return;
  }

  await ctx.reply('Hey! Which store are you at? 🏪', {
    reply_markup: buildStorePicker(stores),
  });

  const storeCallback = await conversation.waitForCallbackQuery(/^(store:|cancel$)/);

  if (storeCallback.callbackQuery.data === 'cancel') {
    await storeCallback.answerCallbackQuery('Cancelled');
    await ctx.reply('No worries, cancelled!');
    return;
  }

  const storeId = storeCallback.callbackQuery.data!.replace('store:', '');
  const store = stores.find((s: Store) => s.id === storeId);
  if (!store) {
    await storeCallback.answerCallbackQuery('Store not found');
    return;
  }

  await storeCallback.answerCallbackQuery();

  // Step 2: Show store stats + template
  const stats = await conversation.external(() => getStoreVisitStats(storeId, user.id));

  let contextMsg = `*${store.name}*\n\n`;
  if (stats.daysSinceLastVisit !== null) {
    const daysLabel = stats.daysSinceLastVisit === 0 ? 'Today' : stats.daysSinceLastVisit === 1 ? '1 day ago' : `${stats.daysSinceLastVisit} days ago`;
    contextMsg += `📅 Last visit: ${daysLabel}\n`;
  } else {
    contextMsg += `📅 First visit — nice!\n`;
  }
  contextMsg += `🔄 ${stats.visitsThisMonth} visit${stats.visitsThisMonth === 1 ? '' : 's'} this month\n`;
  contextMsg += `👥 ${stats.staffCount} staff on record\n`;
  contextMsg += `📋 ${stats.trainingsThisQuarter} training${stats.trainingsThisQuarter === 1 ? '' : 's'} this quarter`;

  await ctx.reply(contextMsg, { parse_mode: 'Markdown' });

  await ctx.reply(
    `1️⃣ Good News\n\n\n` +
    `2️⃣ Competitors' Insights\n\n\n` +
    `3️⃣ Display & Stock\n\n\n` +
    `4️⃣ What to Follow Up\n\n\n` +
    `5️⃣ Buzz Plan`,
  );

  await ctx.reply("Copy the template above and fill it in — skip anything that doesn't apply. You can send photos anytime too, before or after your notes.");

  // Step 3: Collect notes + photos
  const photoFileIds: string[] = [];
  let visitNotes = '';
  let collecting = true;

  while (collecting) {
    const response = await conversation.wait();

    if (response.message?.text === '/cancel') {
      await ctx.reply('No worries, cancelled!');
      return;
    }

    if (response.message?.text) {
      visitNotes += (visitNotes ? '\n\n' : '') + response.message.text;
      await ctx.reply(
        `Nice, got your notes! 📝 Add photos if you have any, or hit *Done* when you're ready.`,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('Done — save visit ✅', 'visit:done'),
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
        `Got it — ${photoFileIds.length} photo(s) so far! 📸 Send more, add your notes, or hit *Done*.`,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('Done — save visit ✅', 'visit:done'),
        },
      );
    } else if (response.callbackQuery?.data === 'visit:done') {
      await response.answerCallbackQuery();
      collecting = false;
    } else {
      await ctx.reply("Just send your notes as text or drop some photos — whatever order works for you! Hit Done when you're finished.", {
        reply_markup: new InlineKeyboard().text('Done — save visit ✅', 'visit:done'),
      });
    }
  }

  if (!visitNotes && photoFileIds.length === 0) {
    await ctx.reply("Hmm, nothing came through. Use /visit to try again when you're ready!");
    return;
  }

  // Step 4: Save visit
  await ctx.reply('Saving everything... ⏳');

  const visit = await conversation.external(() =>
    createVisit({
      store_id: storeId,
      user_id: user.id,
      visit_notes: visitNotes || null,
    }),
  );

  if (!visit) {
    await ctx.reply("Something went wrong on my end. Try /visit again — sorry about that!");
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
      await ctx.reply(`Heads up — only ${uploaded}/${photoFileIds.length} photos made it through. The rest had issues.`);
    }
  }

  // Step 5: Confirmation + optional add-ons
  await ctx.reply(
    `✅ *Visit logged — ${store.name}*\n` +
    `📅 ${new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}\n` +
    (visitNotes ? '📝 Notes saved\n' : '') +
    (photoFileIds.length > 0 ? `📸 ${photoFileIds.length} photo(s)\n` : '') +
    `\nAnything else while you're here?`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('📋 Log training', 'addon:training').row()
        .text('👥 Update staff', 'addon:staff').row()
        .text("I'm done!", 'addon:done'),
    },
  );

  // Step 6: Optional add-on loop
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
    } else if (choice === 'addon:staff') {
      await handleStaffAddon(conversation, ctx, storeId);
      await showAddonMenu(ctx);
    } else if (addonResponse.message?.text === '/cancel') {
      addingMore = false;
    } else {
      await showAddonMenu(ctx);
    }
  }

  await ctx.reply("You're all set! 🎉 Need to tweak anything later? Just use /editvisit.");
}

async function showAddonMenu(ctx: BotContext): Promise<void> {
  await ctx.reply('Anything else?', {
    reply_markup: new InlineKeyboard()
      .text('📋 Log training', 'addon:training').row()
      .text('👥 Update staff', 'addon:staff').row()
      .text("I'm done!", 'addon:done'),
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
    await ctx.reply("No training modules set up yet — check with your manager.");
    return;
  }

  // Pick staff
  const staffKb = new InlineKeyboard();
  for (const s of staff) {
    staffKb.text(s.name, `tstaff:${s.id}`).row();
  }
  staffKb.text('+ Add someone new', 'tstaff:new').row();
  staffKb.text('← Back', 'tstaff:cancel').row();

  await ctx.reply('Who did you train today?', { reply_markup: staffKb });

  const staffResponse = await conversation.wait();
  const staffData = staffResponse.callbackQuery?.data;
  if (staffResponse.callbackQuery) await staffResponse.answerCallbackQuery();

  if (!staffData?.startsWith('tstaff:') || staffData === 'tstaff:cancel') return;

  let selectedStaff: Staff | null = null;

  if (staffData === 'tstaff:new') {
    await ctx.reply("What's their name?");
    const nameCtx = await conversation.wait();
    const name = nameCtx.message?.text;
    if (!name || name === '/cancel') return;

    selectedStaff = await conversation.external(() => addStaffToStore(name, storeId));
    if (!selectedStaff) {
      await ctx.reply("Couldn't add them — try again later.");
      return;
    }
    await ctx.reply(`Added ${name}! 👍`);
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
  moduleKb.text('✅ Done', 'tmod:done').row();

  await ctx.reply(`What did you train *${selectedStaff.name}* on? Tap each one, then hit Done.`, {
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
        await ctx.reply(`Logged: ${selectedStaff!.name} → ${mod.name} ✓\nTap more or hit Done.`, {
          reply_markup: moduleKb,
        });
      }
    }
  }

  if (loggedModules.length > 0) {
    await ctx.reply(`Training logged for ${selectedStaff.name} — ${loggedModules.length} module(s). Nice! 💪`);
  }
}

const STAFF_TYPE_LABELS: Record<string, string> = {
  staff: 'Staff',
  other_brand: 'Other Brand',
  part_timer: 'Part Timer',
};

async function handleStaffAddon(
  conversation: VisitConversation,
  ctx: BotContext,
  storeId: string,
): Promise<void> {
  const staff = await conversation.external(() => getAllStaffForStore(storeId));

  const kb = new InlineKeyboard();
  for (const s of staff) {
    const label = s.still_working
      ? `${s.name} (${STAFF_TYPE_LABELS[s.staff_type]})`
      : `${s.name} — left`;
    kb.text(label, `sm:${s.id}`).row();
  }
  kb.text('+ Add someone new', 'sm:new').row();
  kb.text('← Back', 'sm:cancel').row();

  await ctx.reply("Here's who's at this store:", { reply_markup: kb });

  const pick = await conversation.wait();
  const data = pick.callbackQuery?.data;
  if (pick.callbackQuery) await pick.answerCallbackQuery();

  if (!data?.startsWith('sm:') || data === 'sm:cancel') return;

  if (data === 'sm:new') {
    await addNewStaff(conversation, ctx, storeId);
    return;
  }

  const staffId = data.replace('sm:', '');
  const member = staff.find(s => s.id === staffId);
  if (!member) return;

  await editStaffMember(conversation, ctx, storeId, member);
}

async function addNewStaff(
  conversation: VisitConversation,
  ctx: BotContext,
  storeId: string,
): Promise<void> {
  await ctx.reply("What's their name?");
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

async function editStaffMember(
  conversation: VisitConversation,
  ctx: BotContext,
  storeId: string,
  member: Staff & { still_working: boolean },
): Promise<void> {
  const kb = new InlineKeyboard()
    .text('✏️ Edit name', 'sedit:name').row()
    .text('🔄 Change type', 'sedit:type').row()
    .text(member.still_working ? '👋 Mark as left' : '🔙 Mark as still working', 'sedit:active').row()
    .text('← Back', 'sedit:cancel');

  await ctx.reply(
    `*${member.name}*\n` +
    `Type: ${STAFF_TYPE_LABELS[member.staff_type]}\n` +
    `Status: ${member.still_working ? '✅ Active' : '👋 Left'}\n\n` +
    `What would you like to change?`,
    { parse_mode: 'Markdown', reply_markup: kb },
  );

  const action = await conversation.wait();
  const choice = action.callbackQuery?.data;
  if (action.callbackQuery) await action.answerCallbackQuery();

  if (choice === 'sedit:name') {
    await ctx.reply(`Current name: ${member.name}\nWhat should it be instead?`);
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
  } else if (choice === 'sedit:active') {
    const newActive = !member.still_working;
    const ok = await conversation.external(() => setStaffActiveAtStore(member.id, storeId, newActive));
    await ctx.reply(ok
      ? `Got it — ${member.name} marked as ${newActive ? 'still working ✅' : 'left 👋'}.`
      : "Hmm, that didn't work. Try again.");
  }
}
