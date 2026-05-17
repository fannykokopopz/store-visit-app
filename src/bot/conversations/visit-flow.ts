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
import { getActivePlan, consumePlan } from '../../db/queries/visit-plans.js';
import { buildStorePicker, buildSearchResultsPicker, buildStoreContextMessage } from '../keyboards/store-picker.js';
import { buildTemplateMessage } from '../../utils/template.js';
import { parseTemplate, filledCount } from '../../utils/parse-template.js';
import { startPhotoCollection, handleIncomingPhoto, awaitPhotoUpload } from '../photo-collection.js';
import { sendVisitDetails } from '../visit-details.js';
import { broadcastVisitLocked } from '../../notifications/visit-broadcast.js';
import { config } from '../../config.js';

function buildDoneKeyboard(visitId: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (config.broadcast.botUsername) {
    const base = `https://t.me/${config.broadcast.botUsername}/${config.miniapp.shortName}`;
    kb.url('🔍 Open in mini-app', `${base}?startapp=visit_${visitId}`).row();
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
    `📊 *Step 2 of 3 — Grade This Store*\n\n` +
    `1️⃣ Great Store — Hitting All 3 Areas\n` +
    `   _(Allies / Displays / Sales)_\n\n` +
    `2️⃣ Good Store — Hitting 2 Areas\n\n` +
    `3️⃣ Needs Improvement`,
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

  // Render the comment-stage message. Two modes:
  //   'idle'     → [Skip] [Change]              (default after grading)
  //   'changing' → [Back] [1] [2] [3]           (only after tapping Change)
  // Typing a comment always commits and ends, regardless of mode.
  async function renderGradeCommentPrompt(g: 1 | 2 | 3, mode: 'idle' | 'changing' = 'idle') {
    const text = mode === 'idle'
      ? `📊 *Grade ${g}* — Add a Comment?\n\nType a comment, or tap Skip. Tap Change to update the grade.`
      : `📊 *Grade ${g}* — Change Grade\n\nTap a new grade, or Back to keep Grade ${g}.`;
    const keyboard = mode === 'idle'
      ? new InlineKeyboard()
          .text('Skip', 'grade:skip-comments')
          .text('Change', 'grade:change')
      : new InlineKeyboard()
          .text('Back', 'grade:change-back')
          .text('1', 'grade:1').text('2', 'grade:2').text('3', 'grade:3');
    await ctx.api.editMessageText(
      gradeMsg.chat.id,
      gradeMsg.message_id,
      text,
      { parse_mode: 'Markdown', reply_markup: keyboard },
    ).catch(() => {});
  }
  let commentMode: 'idle' | 'changing' = 'idle';
  await renderGradeCommentPrompt(grade, commentMode);

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
      const data = upd.callbackQuery.data ?? '';
      if (data === 'grade:skip-comments') {
        await upd.answerCallbackQuery('Skipped');
        commentsDone = true;
        break;
      }
      if (data === 'grade:change') {
        commentMode = 'changing';
        await upd.answerCallbackQuery().catch(() => {});
        await renderGradeCommentPrompt(grade, commentMode);
        continue;
      }
      if (data === 'grade:change-back') {
        commentMode = 'idle';
        await upd.answerCallbackQuery().catch(() => {});
        await renderGradeCommentPrompt(grade, commentMode);
        continue;
      }
      const m = data.match(/^grade:([1-3])$/);
      if (m) {
        const newGrade = Number(m[1]) as 1 | 2 | 3;
        const changed = newGrade !== grade;
        grade = newGrade;
        commentMode = 'idle';
        await upd.answerCallbackQuery(changed ? `Grade ${grade} ✓` : `Grade ${grade}`).catch(() => {});
        await renderGradeCommentPrompt(grade, commentMode);
        continue;
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

  // ── Step 3/3: Training (Yes → mini-app prompt, Skip → straight to Done) ──

  await ctx.reply(
    `🎓 *Step 3 of 3 — Train Anyone Today?*\n\n` +
    `If yes, you'll log staff + product details in the mini-app — faster with the staff list and brand chips there.`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('Skip', 'training:no').text('Yes', 'training:yes'),
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

  // ── If user picked Yes, surface the training prompt BEFORE Done ──────────
  //
  // The prompt has two callback buttons (both finalize the visit) plus a URL
  // button that opens the mini-app. Whichever the user taps, we fall through
  // and finalize. The URL button doesn't fire a callback, so users who tap it
  // need to come back and tap one of the callback options to close out the
  // flow — the wording makes that clear.

  if (trainingChoice === 'yes' && config.broadcast.botUsername) {
    const deepLink =
      `https://t.me/${config.broadcast.botUsername}/${config.miniapp.shortName}` +
      `?startapp=visit_${visit.id}_training`;
    await ctx.reply(
      `🎓 *Log Training Details*\n\nTap *Open in Mini-App* to add them now, or *Add Later* if you'd rather do it from the visit page after.`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .url('📝 Open in Mini-App', deepLink).row()
          .text('Add Later', 'training:close').text("I've Added It", 'training:close'),
      },
    );

    let trainingDone = false;
    while (!trainingDone) {
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
      if (upd.callbackQuery?.data === 'training:close') {
        await upd.answerCallbackQuery();
        trainingDone = true;
        break;
      }
      if (upd.callbackQuery) await upd.answerCallbackQuery().catch(() => {});
    }
  }

  // ── Finalize: grade, lock, then wait for photo uploads ────────────────────

  const savedPhotos = await conversation.external(async () => {
    if (grade !== null) await setVisitGrade(visit.id, grade, gradeComments);
    await lockVisit(visit.id);
    if (plan) await consumePlan(plan.id);
    await broadcastVisitLocked(visit.id, ctx.api).catch(() => {});
    // Wait for photo debounce + uploads so the Done message can include the
    // final saved count instead of leaving the user with a "loading" feel.
    return await awaitPhotoUpload(visit.id);
  });

  // ── Unified Done message ──────────────────────────────────────────────────

  const photoLine = savedPhotos > 0
    ? `\n📸 ${savedPhotos} ${savedPhotos === 1 ? 'Photo' : 'Photos'} Saved`
    : '';

  await ctx.reply(
    `🎉 *${storeName}* Logged ✓\n` +
    `Grade ${grade}` +
    photoLine,
    {
      parse_mode: 'Markdown',
      reply_markup: buildDoneKeyboard(visit.id),
    },
  );
}
