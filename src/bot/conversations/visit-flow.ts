import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/auth.js';
import { getStoresForCM } from '../../db/queries/stores.js';
import { searchStoresByName, getStoreById } from '../../db/queries/stores.js';
import { createVisit, lockVisit, attachVisitSections, getLastVisitDatePerStore } from '../../db/queries/visits.js';
import { getStaffForStore, createStaff, attachStaffToVisit } from '../../db/queries/staff.js';
import { getActivePlan, consumePlan } from '../../db/queries/visit-plans.js';
import { uploadVisitPhoto } from '../../db/queries/photos.js';
import { buildStorePicker, buildSearchResultsPicker, buildStaffPicker } from '../keyboards/store-picker.js';
import { buildTemplateMessage } from '../../utils/template.js';
import { parseTemplate, filledCount, sectionsPreview } from '../../utils/parse-template.js';
import { config } from '../../config.js';

type VisitConversation = Conversation<BotContext, BotContext>;

export async function visitFlow(conversation: VisitConversation, ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // ── Step 1: Store selection ────────────────────────────────────────────────

  const [stores, lastVisits] = await conversation.external(async () => {
    const s = await getStoresForCM(telegramId);
    const lv = await getLastVisitDatePerStore(telegramId);
    return [s, lv] as const;
  });

  if (stores.length === 0) {
    await ctx.reply("You don't have any stores assigned. Contact your admin.");
    return;
  }

  await ctx.reply('Which store did you visit?', {
    reply_markup: buildStorePicker(stores, lastVisits),
  });

  let storeId = '';
  let storeName = '';

  storeLoop: while (true) {
    const response = await conversation.waitForCallbackQuery(
      /^(store:|search:|cancel$)/,
    );

    const data = response.callbackQuery.data;

    if (data === 'cancel') {
      await response.answerCallbackQuery();
      await ctx.reply('Visit cancelled.');
      return;
    }

    if (data === 'search:stores') {
      await response.answerCallbackQuery();
      await ctx.reply('Type part of the store name:');

      while (true) {
        const searchMsg = await conversation.wait();

        if (searchMsg.message?.text === '/cancel') {
          await ctx.reply('Visit cancelled.');
          return;
        }

        const term = searchMsg.message?.text?.trim();
        if (!term) continue;

        const results = await conversation.external(() =>
          searchStoresByName('SG', term),
        );

        if (results.length === 0) {
          await ctx.reply('No stores found. Try a different name.', {
            reply_markup: new InlineKeyboard()
              .text('← Back to my stores', 'search:back').row()
              .text('Cancel', 'cancel'),
          });
        } else {
          await ctx.reply('Select a store:', {
            reply_markup: buildSearchResultsPicker(results),
          });
        }

        const pick = await conversation.waitForCallbackQuery(/^(store:|search:back|cancel$)/);

        if (pick.callbackQuery.data === 'cancel') {
          await pick.answerCallbackQuery();
          await ctx.reply('Visit cancelled.');
          return;
        }

        if (pick.callbackQuery.data === 'search:back') {
          await pick.answerCallbackQuery();
          await ctx.reply('Which store did you visit?', {
            reply_markup: buildStorePicker(stores, lastVisits),
          });
          continue storeLoop;
        }

        storeId = pick.callbackQuery.data.replace('store:', '');
        const found = await conversation.external(() => getStoreById(storeId));
        if (!found) continue;
        storeName = found.name;
        await pick.answerCallbackQuery();
        break storeLoop;
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
      await response.answerCallbackQuery();
      break;
    }
  }

  // ── Show active plan if any ────────────────────────────────────────────────

  const plan = await conversation.external(() => getActivePlan(telegramId, storeId));
  if (plan) {
    let planMsg = `📋 *Your plan for ${storeName}:*\n`;
    if (plan.buzz_plan) planMsg += `💡 ${plan.buzz_plan}\n`;
    if (plan.notes) planMsg += `📝 ${plan.notes}`;
    await ctx.reply(planMsg.trim(), { parse_mode: 'Markdown' });
  }

  // ── Step 2: Template submission (text only) ────────────────────────────────

  await ctx.reply(
    buildTemplateMessage(storeName),
    { parse_mode: 'MarkdownV2' },
  );
  await ctx.reply('Fill in the template and send it back\\. Type /cancel to abort\\.', {
    parse_mode: 'MarkdownV2',
  });

  let templateText: string | null = null;
  let confirmed = false;

  while (!confirmed) {
    templateText = null;

    submissionLoop: while (true) {
      const msg = await conversation.wait();

      if (msg.message?.text === '/cancel') {
        await ctx.reply('Visit cancelled.');
        return;
      }

      const text = msg.message?.caption ?? msg.message?.text ?? null;

      if (!text) {
        await ctx.reply('Please send your filled template as text. Type /cancel to abort.');
        continue;
      }

      templateText = text;
      break submissionLoop;
    }

    const sections = parseTemplate(templateText ?? '');
    const filled = filledCount(sections);
    const preview = sectionsPreview(sections);

    let confirmMsg = `*Here's what I received for ${storeName}:*\n\n${preview}`;
    if (filled === 0) confirmMsg += '\n\n⚠️ No sections detected — check the template format.';

    const lockKb = new InlineKeyboard()
      .text('✅ Lock & add photos', 'lock:confirm').row()
      .text('🔄 Resend', 'lock:resend').row()
      .text('❌ Cancel', 'lock:cancel');

    await ctx.reply(confirmMsg, { parse_mode: 'Markdown', reply_markup: lockKb });

    const action = await conversation.waitForCallbackQuery(/^lock:/);
    await action.answerCallbackQuery();

    if (action.callbackQuery.data === 'lock:cancel') {
      await ctx.reply('Visit cancelled.');
      return;
    }
    if (action.callbackQuery.data === 'lock:resend') {
      await ctx.reply('OK — send your notes again:');
      continue;
    }
    if (action.callbackQuery.data === 'lock:confirm') {
      confirmed = true;
    }
  }

  // ── Save visit ─────────────────────────────────────────────────────────────

  const sections = parseTemplate(templateText ?? '');

  const visit = await conversation.external(() =>
    createVisit({ store_id: storeId, cm_telegram_id: telegramId }),
  );

  if (!visit) {
    await ctx.reply('Something went wrong saving your visit. Please try /visit again.');
    return;
  }

  await conversation.external(() => attachVisitSections(visit.id, sections));
  await conversation.external(() => lockVisit(visit.id));
  if (plan) await conversation.external(() => consumePlan(plan.id));

  // ── Step 3: Photo upload ───────────────────────────────────────────────────
  // CMs send photos one by one (or as an album — each photo = one update).
  // Tap Done to finish. The Done button is what breaks the loop cleanly.

  const doneKb = new InlineKeyboard().text('Done — no more photos', 'photos:done');
  await ctx.reply(
    '📸 *Send your photos now* — up to 6, album or one by one\\.\nTap *Done* when finished\\.',
    { parse_mode: 'MarkdownV2', reply_markup: doneKb },
  );

  let uploaded = 0;
  photoLoop: while (uploaded < 6) {
    const photoMsg = await conversation.wait();

    if (photoMsg.callbackQuery?.data === 'photos:done') {
      await photoMsg.answerCallbackQuery();
      break photoLoop;
    }

    if (photoMsg.message?.text === '/cancel') {
      break photoLoop;
    }

    if (photoMsg.message?.photo) {
      const p = photoMsg.message.photo;
      const fileId = p[p.length - 1].file_id;

      try {
        const file = await ctx.api.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
        const response = await fetch(fileUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        const result = await conversation.external(() =>
          uploadVisitPhoto(visit.id, buffer, storeId),
        );
        if (result) {
          uploaded++;
          if (uploaded < 6) {
            await ctx.reply(
              `✅ Photo ${uploaded} saved. Send more or tap Done.`,
              { reply_markup: new InlineKeyboard().text('Done — no more photos', 'photos:done') },
            );
          } else {
            await ctx.reply('✅ Photo 6 saved — that\'s the max, moving on.');
            break photoLoop;
          }
        } else {
          await ctx.reply('⚠️ Photo failed, try again.', {
            reply_markup: new InlineKeyboard().text('Done — no more photos', 'photos:done'),
          });
        }
      } catch (err) {
        console.error('Photo upload failed:', err);
        await ctx.reply('⚠️ Upload error, try again.', {
          reply_markup: new InlineKeyboard().text('Done — no more photos', 'photos:done'),
        });
      }
    }
  }

  // ── Step 4: Optional staff logging ────────────────────────────────────────

  const staffList = await conversation.external(() => getStaffForStore(storeId));
  const selectedStaffIds = new Set<string>();

  if (staffList.length > 0) {
    await ctx.reply(
      'Who was working today? (optional)',
      { reply_markup: buildStaffPicker(staffList, selectedStaffIds) },
    );

    staffLoop: while (true) {
      const staffAction = await conversation.waitForCallbackQuery(/^staff:/);
      await staffAction.answerCallbackQuery();
      const d = staffAction.callbackQuery.data;

      if (d === 'staff:done') break staffLoop;

      if (d.startsWith('staff:toggle:')) {
        const sid = d.replace('staff:toggle:', '');
        if (selectedStaffIds.has(sid)) selectedStaffIds.delete(sid);
        else selectedStaffIds.add(sid);
        await staffAction.editMessageReplyMarkup({
          reply_markup: buildStaffPicker(staffList, selectedStaffIds),
        });
        continue;
      }

      if (d === 'staff:add') {
        await ctx.reply("What's their name?");
        const nameMsg = await conversation.wait();
        const name = nameMsg.message?.text?.trim();
        if (!name) continue;

        await ctx.reply("What's their role? (e.g. Sales Associate, Store Manager)");
        const roleMsg = await conversation.wait();
        const role = roleMsg.message?.text?.trim() || null;

        const newStaff = await conversation.external(() =>
          createStaff({ name, role: role ?? undefined, store_id: storeId }),
        );

        if (newStaff) {
          staffList.push(newStaff);
          selectedStaffIds.add(newStaff.id);
          await ctx.reply(`Added ${name} ✅`, {
            reply_markup: buildStaffPicker(staffList, selectedStaffIds),
          });
        }
      }
    }

    if (selectedStaffIds.size > 0) {
      await conversation.external(() =>
        attachStaffToVisit(visit.id, Array.from(selectedStaffIds)),
      );
    }
  }

  // ── Final confirmation ─────────────────────────────────────────────────────

  const staffNames = staffList
    .filter(s => selectedStaffIds.has(s.id))
    .map(s => s.name)
    .join(', ');

  await ctx.reply(
    `✅ *Visit locked — ${storeName}*\n` +
    `📅 ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}\n` +
    `📝 ${filledCount(sections)}/5 sections filled\n` +
    `📸 ${uploaded} photo(s)` +
    (staffNames ? `\n👥 ${staffNames}` : ''),
    { parse_mode: 'Markdown' },
  );
}
