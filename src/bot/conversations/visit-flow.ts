import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/auth.js';
import { getStoresForCM } from '../../db/queries/stores.js';
import { searchStoresByName, getStoreById } from '../../db/queries/stores.js';
import {
  createVisit,
  lockVisit,
  attachVisitSections,
  setVisitGrade,
  getLastVisitDatePerStore,
} from '../../db/queries/visits.js';
import { setVisitCMs } from '../../db/queries/visit-cms.js';
import { getStaffForStore, createStaff, attachTrainedStaffToVisit, type Staff } from '../../db/queries/staff.js';
import { getActivePlan, consumePlan } from '../../db/queries/visit-plans.js';
import { buildStorePicker, buildSearchResultsPicker, buildStoreContextMessage } from '../keyboards/store-picker.js';
import { buildTemplateMessage } from '../../utils/template.js';
import { parseTemplate, filledCount } from '../../utils/parse-template.js';
import { startPhotoCollection, handleIncomingPhoto } from '../photo-collection.js';
import { sendVisitDetails } from '../visit-details.js';
import { broadcastVisitLocked } from '../../notifications/visit-broadcast.js';
import { config } from '../../config.js';

function buildStaffPicker(staff: Staff[], selected: Set<string>): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < staff.length; i += 2) {
    const a = staff[i];
    const labelA = `${selected.has(a.id) ? '✓ ' : ''}${a.name}`;
    kb.text(labelA, `staff:${a.id}`);
    if (i + 1 < staff.length) {
      const b = staff[i + 1];
      const labelB = `${selected.has(b.id) ? '✓ ' : ''}${b.name}`;
      kb.text(labelB, `staff:${b.id}`);
    }
    kb.row();
  }
  kb.text('✅ Done', 'staff:done').text('+ Add new', 'staff:add');
  return kb;
}

function buildDoneKeyboard(visitId: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (config.broadcast.botUsername) {
    const deepLink =
      `https://t.me/${config.broadcast.botUsername}/${config.miniapp.shortName}` +
      `?startapp=visit_${visitId}`;
    kb.url('🔍 Open in mini-app', deepLink).row();
  }
  kb.text('✏️ Edit', `edit:${visitId}`).text('🗑️ Delete', `delete:${visitId}`);
  return kb;
}

type VisitConversation = Conversation<BotContext, BotContext>;

export async function visitFlow(conversation: VisitConversation, ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // ── Store pick (entry) ─────────────────────────────────────────────────────

  const [stores, lastVisits] = await conversation.external(async () => {
    const s = await getStoresForCM(telegramId);
    const lv = await getLastVisitDatePerStore(telegramId);
    return [s, lv] as const;
  });

  if (stores.length === 0) {
    await ctx.reply("No stores assigned yet — ask your manager to set this up 🙏");
    return;
  }

  // Merged: store context + "which store?" in one message
  let page = 0;
  await ctx.reply(
    `${buildStoreContextMessage(stores, lastVisits)}\n\nWhich store did you visit?\n_/cancel to stop_`,
    {
      parse_mode: 'Markdown',
      reply_markup: buildStorePicker(stores, lastVisits, page),
    },
  );

  let storeId = '';
  let storeName = '';

  storeLoop: while (true) {
    const update = await conversation.wait();

    if (update.message?.text === '/cancel') {
      await ctx.reply("No worries — come back whenever you're ready 👋");
      return;
    }

    if (!update.callbackQuery) continue;

    const data = update.callbackQuery.data ?? '';

    if (data === 'cancel') {
      await update.answerCallbackQuery();
      await ctx.reply("No worries — come back whenever you're ready 👋");
      return;
    }

    if (data.startsWith('page:')) {
      page = parseInt(data.replace('page:', ''), 10);
      await update.answerCallbackQuery();
      await update.editMessageReplyMarkup({
        reply_markup: buildStorePicker(stores, lastVisits, page),
      });
      continue;
    }

    if (data === 'search:stores') {
      await update.answerCallbackQuery();
      await ctx.reply('Type part of the store name:');

      while (true) {
        const searchMsg = await conversation.wait();
        if (searchMsg.message?.text === '/cancel') {
          await ctx.reply("No worries — come back whenever you're ready 👋");
          return;
        }

        const term = searchMsg.message?.text?.trim();
        if (!term) continue;

        const market = ctx.user?.market ?? 'SG';
        const results = await conversation.external(() => searchStoresByName(market, term));

        if (results.length === 0) {
          await ctx.reply("No stores found — try a different search term.", {
            reply_markup: new InlineKeyboard()
              .text('← Back to my stores', 'search:back').row()
              .text('Cancel', 'cancel'),
          });
        } else {
          await ctx.reply('Pick a store:', {
            reply_markup: buildSearchResultsPicker(results),
          });
        }

        const pick = await conversation.wait();

        if (pick.message?.text === '/cancel') {
          await ctx.reply("No worries — come back whenever you're ready 👋");
          return;
        }
        if (!pick.callbackQuery) continue;

        const pickData = pick.callbackQuery.data ?? '';

        if (pickData === 'cancel') {
          await pick.answerCallbackQuery();
          await ctx.reply("No worries — come back whenever you're ready 👋");
          return;
        }
        if (pickData === 'search:back') {
          await pick.answerCallbackQuery();
          await ctx.reply('Which store did you visit?', {
            reply_markup: buildStorePicker(stores, lastVisits, page),
          });
          continue storeLoop;
        }

        if (pickData.startsWith('store:')) {
          storeId = pickData.replace('store:', '');
          const found = await conversation.external(() => getStoreById(storeId));
          if (!found) continue;
          storeName = found.name;
          await pick.answerCallbackQuery();
          break storeLoop;
        }
      }
    }

    if (data.startsWith('store:')) {
      storeId = data.replace('store:', '');
      const found = stores.find(s => s.id === storeId);
      if (found) {
        storeName = found.name;
      } else {
        const fetched = await conversation.external(() => getStoreById(storeId));
        if (!fetched) continue;
        storeName = fetched.name;
      }
      await update.answerCallbackQuery();
      break;
    }
  }

  // ── Consume active plan if any (silent) ───────────────────────────────────

  const plan = await conversation.external(() => getActivePlan(telegramId, storeId));

  // ── Step 1/3: Notes (template + paste) ─────────────────────────────────────

  await ctx.reply(
    `📝 *Step 1 of 3 — Notes*\n\n` + buildTemplateMessage(storeName),
    { parse_mode: 'MarkdownV2' },
  );

  // Buffer photos that arrive during template step. Once we start photo
  // collection (after createVisit), new photos forward straight to it.
  const albumPhotoFileIds: string[] = [];
  let templateText: string | null = null;

  while (true) {
    const msg = await conversation.wait();

    // Handle "View full last visit" / "View visit" inline.
    if (msg.callbackQuery) {
      const data = msg.callbackQuery.data ?? '';
      if (data.startsWith('viewlast:') || data.startsWith('viewvisit:')) {
        const visitId = data.replace(/^view(last|visit):/, '');
        await msg.answerCallbackQuery();
        await sendVisitDetails(msg, visitId);
      } else {
        await msg.answerCallbackQuery().catch(() => {});
      }
      continue;
    }

    if (msg.message?.text === '/cancel') {
      await ctx.reply('No worries — visit cancelled.');
      return;
    }

    const text = msg.message?.caption ?? msg.message?.text ?? null;
    if (!text) {
      if (msg.message?.photo) {
        const p = msg.message.photo;
        if (albumPhotoFileIds.length < 6) {
          albumPhotoFileIds.push(p[p.length - 1].file_id);
        }
        continue;
      }
      await ctx.reply("Send the filled template as a text message. /cancel to stop.");
      continue;
    }

    if (msg.message?.photo) {
      const p = msg.message.photo;
      if (albumPhotoFileIds.length < 6) {
        albumPhotoFileIds.push(p[p.length - 1].file_id);
      }
    }

    templateText = text;
    break;
  }

  const sections = parseTemplate(templateText);
  const filled = filledCount(sections);

  // ── Create visit early so photos can upload during the rest of the flow ───

  const visit = await conversation.external(async () => {
    const v = await createVisit({
      store_id: storeId,
      cm_telegram_id: telegramId,
      grade: null,
      grade_comments: null,
    });
    if (!v) return null;
    await attachVisitSections(v.id, sections);
    await setVisitCMs(v.id, telegramId, []);
    return v;
  });

  if (!visit) {
    await ctx.reply("Something went wrong — give /visit another try 🙏");
    return;
  }

  // Kick off photo upload in parallel. Stragglers arriving via
  // bot.on('message:photo') after the conversation exits land here too.
  await conversation.external(() => {
    startPhotoCollection(telegramId, visit.id, storeId, storeName, filled, albumPhotoFileIds);
  });

  // ── Step 2/3: Grade (tap → edit msg to ask for comment) ───────────────────

  const gradeMsg = await ctx.reply(
    `📊 *Step 2 of 3 — Grade this store*\n\n` +
    `1️⃣ Great store — hitting all 3 areas\n` +
    `   _(Allies / Displays / Sales)_\n\n` +
    `2️⃣ Good store — hitting 2 areas\n\n` +
    `3️⃣ Needs improvement`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('1', 'grade:1')
        .text('2', 'grade:2')
        .text('3', 'grade:3'),
    },
  );

  let grade: 1 | 2 | 3 | null = null;
  while (grade === null) {
    const upd = await conversation.wait();

    if (upd.message?.text === '/cancel') {
      await ctx.reply('No worries — visit cancelled.');
      return;
    }

    if (upd.message?.photo) {
      const p = upd.message.photo;
      const fileId = p[p.length - 1].file_id;
      await conversation.external(() => handleIncomingPhoto(telegramId, fileId));
      continue;
    }

    if (upd.callbackQuery) {
      const data = upd.callbackQuery.data ?? '';
      const m = data.match(/^grade:([1-3])$/);
      if (m) {
        grade = Number(m[1]) as 1 | 2 | 3;
        await upd.answerCallbackQuery(`Grade ${grade} ✓`);
      } else {
        await upd.answerCallbackQuery().catch(() => {});
      }
      continue;
    }

    if (upd.message?.text) {
      await ctx.reply('Tap a grade button: 1, 2, or 3. /cancel to stop.');
    }
  }

  // Edit the grade message in-place to show the chosen grade + comment prompt
  await ctx.api.editMessageText(
    gradeMsg.chat.id,
    gradeMsg.message_id,
    `📊 *Grade ${grade} ✓*\n\nAny comments on this grade? Type them, or tap Skip.`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('Skip', 'grade:skip-comments'),
    },
  ).catch(() => {});

  let gradeComments: string | null = null;
  let commentsDone = false;
  while (!commentsDone) {
    const upd = await conversation.wait();

    if (upd.message?.text === '/cancel') {
      await ctx.reply('No worries — visit cancelled.');
      return;
    }

    if (upd.message?.photo) {
      const p = upd.message.photo;
      const fileId = p[p.length - 1].file_id;
      await conversation.external(() => handleIncomingPhoto(telegramId, fileId));
      continue;
    }

    if (upd.callbackQuery) {
      if (upd.callbackQuery.data === 'grade:skip-comments') {
        await upd.answerCallbackQuery('Skipped');
        commentsDone = true;
        break;
      }
      await upd.answerCallbackQuery().catch(() => {});
      continue;
    }

    const text = upd.message?.text ?? upd.message?.caption ?? null;
    if (text) {
      gradeComments = text;
      commentsDone = true;
      break;
    }
  }

  // ── Step 3/3: Training (tag staff only — products go in mini-app) ─────────

  const trainedStaffIds: string[] = [];

  await ctx.reply(
    `🎓 *Step 3 of 3 — Train anyone today?*\n\n` +
    `Tag who you trained. Add product details in the mini-app after.`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('Yes', 'training:yes').text('Skip', 'training:no'),
    },
  );

  let trainingChoice: 'yes' | 'no' | null = null;
  while (trainingChoice === null) {
    const upd = await conversation.wait();

    if (upd.message?.text === '/cancel') {
      await ctx.reply('No worries — visit cancelled.');
      return;
    }
    if (upd.message?.photo) {
      const p = upd.message.photo;
      const fileId = p[p.length - 1].file_id;
      await conversation.external(() => handleIncomingPhoto(telegramId, fileId));
      continue;
    }
    if (upd.callbackQuery) {
      const data = upd.callbackQuery.data ?? '';
      if (data === 'training:yes') { trainingChoice = 'yes'; await upd.answerCallbackQuery(); }
      else if (data === 'training:no') { trainingChoice = 'no'; await upd.answerCallbackQuery('Skipped'); }
      else await upd.answerCallbackQuery().catch(() => {});
    }
  }

  if (trainingChoice === 'yes') {
    let staffList: Staff[] = await conversation.external(() => getStaffForStore(storeId));
    const tagged = new Set<string>();

    const pickerMsg = await ctx.reply(
      'Tap staff you trained, then ✅ Done. Use + Add new if a staff member is missing.',
      { reply_markup: buildStaffPicker(staffList, tagged) },
    );

    staffPickerLoop: while (true) {
      const upd = await conversation.wait();

      if (upd.message?.text === '/cancel') {
        await ctx.reply('No worries — visit cancelled.');
        return;
      }
      if (upd.message?.photo) {
        const p = upd.message.photo;
        const fileId = p[p.length - 1].file_id;
        await conversation.external(() => handleIncomingPhoto(telegramId, fileId));
        continue;
      }
      if (!upd.callbackQuery) continue;

      const data = upd.callbackQuery.data ?? '';

      if (data === 'staff:done') {
        await upd.answerCallbackQuery(`${tagged.size} tagged`);
        break staffPickerLoop;
      }

      if (data === 'staff:add') {
        await upd.answerCallbackQuery();
        await ctx.reply('Name of the new staff member?');
        const nameUpd = await conversation.wait();
        if (nameUpd.message?.text === '/cancel') {
          await ctx.reply('No worries — visit cancelled.');
          return;
        }
        const name = nameUpd.message?.text?.trim();
        if (!name) {
          await ctx.reply('No name received — back to the picker.');
        } else {
          const fresh = await conversation.external(() => createStaff({ name, store_id: storeId }));
          if (fresh) {
            staffList = [...staffList, fresh].sort((a, b) => a.name.localeCompare(b.name));
            tagged.add(fresh.id);
          }
        }
        await ctx.api.editMessageReplyMarkup(pickerMsg.chat.id, pickerMsg.message_id, {
          reply_markup: buildStaffPicker(staffList, tagged),
        }).catch(() => {});
        continue;
      }

      const m = data.match(/^staff:([0-9a-f-]{36})$/i);
      if (m) {
        const sid = m[1];
        if (tagged.has(sid)) tagged.delete(sid);
        else tagged.add(sid);
        await upd.answerCallbackQuery();
        await ctx.api.editMessageReplyMarkup(pickerMsg.chat.id, pickerMsg.message_id, {
          reply_markup: buildStaffPicker(staffList, tagged),
        });
        continue;
      }

      await upd.answerCallbackQuery().catch(() => {});
    }

    trainedStaffIds.push(...tagged);
  }

  // ── Finalize: grade, training, lock ────────────────────────────────────────

  await conversation.external(async () => {
    if (grade !== null) await setVisitGrade(visit.id, grade, gradeComments);
    if (trainedStaffIds.length > 0) {
      await attachTrainedStaffToVisit(
        visit.id,
        trainedStaffIds.map((staff_id) => ({ staff_id, products: '' })),
      );
    }
    await lockVisit(visit.id);
    if (plan) await consumePlan(plan.id);
    // Broadcast to group chat after lock. Photos may still be uploading; the
    // deep-linked visit page will pick them up as their DB rows insert.
    await broadcastVisitLocked(visit.id, ctx.api).catch(() => {});
  });

  // ── Unified Done message ──────────────────────────────────────────────────

  const trainedLine = trainedStaffIds.length > 0
    ? ` · ${trainedStaffIds.length} staff trained`
    : '';
  const photoLine = albumPhotoFileIds.length > 0
    ? `\n\n📸 _Photos saving in background_`
    : '';

  await ctx.reply(
    `🎉 *${storeName}* logged ✓\n` +
    `Grade ${grade}${trainedLine}` +
    photoLine,
    {
      parse_mode: 'Markdown',
      reply_markup: buildDoneKeyboard(visit.id),
    },
  );
}
