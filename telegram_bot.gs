// ============================================================
// TC Acoustic Store Intelligence — Telegram Bot Handler
// File: telegram_bot.gs
// Receives Telegram messages, routes to correct handler
// ============================================================

// ── Script Properties (set these in Apps Script > Project Settings) ──────────
// TELEGRAM_TOKEN       — from @BotFather
// ANTHROPIC_API_KEY    — from console.anthropic.com
// SHEET_ID             — Google Sheets ID (from URL)
// GITHUB_TOKEN         — GitHub personal access token
// GITHUB_REPO          — e.g. "fannykokopopz/store-intel"
// AM_EMAIL_SG          — AM email for SG digest
// ALERT_TELEGRAM_ID    — Telegram chat ID of AM (for at-risk alerts)

// ── Debug log (persists across executions so you can read it after a Telegram run) ──
function dbg(msg) {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty('DEBUG_LOG') || '';
  const line = new Date().toISOString() + ' ' + msg;
  props.setProperty('DEBUG_LOG', (existing + '\n' + line).slice(-4000));
  Logger.log(msg);
}
function readDebugLog() {
  Logger.log(PropertiesService.getScriptProperties().getProperty('DEBUG_LOG') || '(empty)');
}
function clearDebugLog() {
  PropertiesService.getScriptProperties().deleteProperty('DEBUG_LOG');
  Logger.log('cleared');
}

// ── Entry point — Telegram sends every message here ──────────────────────────
function doPost(e) {
  try {
    const update = JSON.parse(e.postData.contents);

    // Deduplicate — Telegram retries if we don't respond fast enough.
    // Use a short-duration lock (only around the cache check+write) so two
    // simultaneous doPost executions can't both see a cache miss for the same
    // update_id. We do NOT hold the lock during handleUpdate — that would block
    // the async processAsyncVisit trigger (Claude API call) from running.
    const cache = CacheService.getScriptCache();
    const dedupKey = 'upd_' + update.update_id;
    Logger.log('doPost: update_id=' + update.update_id);
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(5000);
      if (cache.get(dedupKey)) {
        Logger.log('Duplicate update_id ' + update.update_id + ' — skipping');
        return ContentService.createTextOutput('OK');
      }
      cache.put(dedupKey, '1', 600); // 10-min window covers all Telegram retry intervals
    } catch (lockErr) {
      Logger.log('Lock timeout for update ' + update.update_id + ' — dropping retry');
      return ContentService.createTextOutput('OK');
    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }

    // Ignore stale messages (queued overnight replays)
    const msgDate = update.message
      ? update.message.date
      : update.callback_query
        ? update.callback_query.message.date
        : null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (msgDate && (nowSec - msgDate) > 300) {
      Logger.log('Dropped stale update ' + update.update_id + ' (' + (nowSec - msgDate) + 's old)');
      return ContentService.createTextOutput('OK');
    }

    handleUpdate(update);
  } catch (err) {
    Logger.log('doPost error: ' + err.message + '\n' + err.stack);
  }
  return ContentService.createTextOutput('OK');
}

function handleUpdate(update) {
  // Handle regular messages
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = (msg.text || '').trim();
    Logger.log('handleUpdate: chatId=' + chatId + ' text="' + text + '"');

    try {
      // Route commands
      if (text === '/start') {
        handleStart(chatId, msg.from.first_name);
      } else if (text === '/visit') {
        handleVisitPrompt(chatId);
      } else if (text === '/mystores') {
        handleMyStores(chatId, userId);
      } else if (text === '/help') {
        handleHelp(chatId);
      } else if (text.startsWith('/cancel')) {
        cancelSession(chatId);
        sendMessage(chatId, '✅ Cancelled. Type /visit to start a new visit log.');
      } else {
        // Treat as visit note input — check if in a session
        handleFreeText(chatId, userId, msg.from.first_name, text);
      }
    } catch (err) {
      Logger.log('handleUpdate error for "' + text + '": ' + err.message + '\n' + err.stack);
      sendMessage(chatId, '⚠️ Something went wrong. Please try again or type /cancel to reset.');
    }
  }

  // Handle callback queries (button presses)
  if (update.callback_query) {
    try {
      handleCallback(update.callback_query);
    } catch (err) {
      Logger.log('handleCallback error: ' + err.message + '\n' + err.stack);
    }
  }
}

// ── /start ────────────────────────────────────────────────────────────────────
function handleStart(chatId, firstName) {
  const name = firstName || 'there';
  const msg =
    `👋 Hi ${name}! Welcome to TC Store Visit App.\n\n` +
    `I help you log store visits quickly so your team always has fresh insights.\n\n` +
    `*Commands:*\n` +
    `/visit — Log a store visit (takes ~2 min)\n` +
    `/mystores — See your store portfolio health\n` +
    `/help — How to write good visit notes\n\n` +
    `Type /visit to get started.`;
  sendMessage(chatId, msg);
}

// ── /help ─────────────────────────────────────────────────────────────────────
function handleHelp(chatId) {
  const msg =
    `📝 *How to write a good visit note*\n\n` +
    `Just write naturally after /visit — I'll extract the signals.\n\n` +
    `*Good examples:*\n` +
    `_"Spoke to James. Last week was slow, only 2 Sonos sold. Bose promoter was in store doing demo. Trained Yuan on Arc Ultra. Need to follow up on TV display."_\n\n` +
    `_"Store quiet today. Era 100 and Ace both low on stock. Staff excited about IT Show promo. KC confirmed space for April activation."_\n\n` +
    `*I'll automatically extract:*\n` +
    `📦 Stock health\n` +
    `📈 Sales momentum\n` +
    `⚡ Competitor activity\n` +
    `📚 Training gaps\n` +
    `🔑 Key insight for the AM\n\n` +
    `No special format needed — just tell me what you saw.`;
  sendMessage(chatId, msg);
}

// ── /visit — start a guided visit log session ─────────────────────────────────
function handleVisitPrompt(chatId) {
  Logger.log('handleVisitPrompt: chatId=' + chatId);
  // Don't restart if CM is already writing notes
  const existing = getSession(chatId);
  if (existing && existing.step === 'awaiting_notes') {
    sendMessage(chatId,
      `📝 You're already logging *${existing.store}*.\n\nJust send your visit notes now, or type /cancel to start over.`
    );
    return;
  }

  dbg('handleVisitPrompt: calling getStoreListForChat');
  const assignedStores = getStoreListForChat(chatId);
  dbg('handleVisitPrompt: assignedStores=' + JSON.stringify(assignedStores));
  const stores = assignedStores || getDefaultStoreList();
  dbg('handleVisitPrompt: stores.length=' + stores.length);

  setSession(chatId, { step: 'awaiting_store', stores: stores });

  const displayStores = assignedStores ? stores : stores.slice(0, 20);
  const buttons = displayStores.map(s => [{
    text: s,
    callback_data: 'store:' + s.substring(0, 58)
  }]);
  dbg('handleVisitPrompt: buttons.length=' + buttons.length + ', calling sendMessageWithButtons');
  const hint = assignedStores
    ? `📍 Which store did you visit?\n\nSelect below or type the store name:`
    : `📍 Which store did you visit?\n\nSelect below or type the store name.`;

  sendMessageWithButtons(chatId, hint, buttons);
  dbg('handleVisitPrompt: done');
}

// ── Handle free text input based on session state ─────────────────────────────
function handleFreeText(chatId, userId, firstName, text) {
  const session = getSession(chatId);

  if (!session) {
    // No active session — prompt to start
    sendMessage(chatId,
      `Type /visit to log a store visit, or /help to see what I can do.`
    );
    return;
  }

  if (session.step === 'awaiting_store') {
    // User typed a store name instead of clicking button
    session.store = text;
    session.step = 'awaiting_notes';
    setSession(chatId, session);
    sendMessage(chatId,
      `✅ *${text}*\n\n` +
      `Now tell me about the visit. Include anything useful:\n` +
      `• How were sales / foot traffic?\n` +
      `• Any stock issues?\n` +
      `• Competitors doing anything?\n` +
      `• Who did you train?\n` +
      `• Any follow-ups needed?\n\n` +
      `Just write it naturally — no special format needed.`
    );
    return;
  }

  if (session.step === 'awaiting_notes') {
    session.notes = text;
    session.cm_name = firstName;
    session.user_id = userId;
    clearSession(chatId);

    sendMessage(chatId, `🔍 Analysing your visit notes...`);

    // Process synchronously — Claude Haiku responds in ~3s, well within
    // the 30-second doPost limit. Async triggers require script.scriptapp
    // OAuth scope which is unreliable in web app deployments.
    processVisitNote(chatId, session);
    return;
  }
}

// ── Handle button callbacks ───────────────────────────────────────────────────
function handleCallback(cbq) {
  const chatId = cbq.message.chat.id;
  const data = cbq.data;

  // Acknowledge the button press
  answerCallbackQuery(cbq.id);

  if (data.startsWith('store:')) {
    const storeKey = data.replace('store:', '');
    const session = getSession(chatId) || {};
    // Resolve full store name from session (callback_data may be truncated to 58 chars)
    const fullName = (session.stores || []).find(s => s.startsWith(storeKey)) || storeKey;
    const storeName = fullName;
    session.store = storeName;
    session.step = 'awaiting_notes';
    setSession(chatId, session);

    sendMessage(chatId,
      `✅ *${storeName}*\n\n` +
      `Now tell me about the visit — sales, stock, competitors, training, follow-ups.\n` +
      `Just write naturally, I'll handle the rest.`
    );
  }
}

// ── /mystores — CM views their own store portfolio ────────────────────────────
function handleMyStores(chatId, userId) {
  const stores = getMyStoresSummary(chatId);
  if (!stores || stores.length === 0) {
    sendMessage(chatId, `No stores found for your account yet.`);
    return;
  }

  let msg = `🏪 *Your Store Portfolio*\n\n`;
  stores.forEach(s => {
    const health = { 'at-risk': '🔴', 'watch': '🟡', 'healthy': '🟢', 'strong': '🟢' }[s.health] || '⚪';
    const mom = { 'up': '↑', 'flat': '→', 'down': '↓' }[s.momentum] || '→';
    const days = s.days_ago > 0 ? `${s.days_ago}d ago` : 'today';
    msg += `${health} *${s.store}*\n`;
    msg += `   ${mom} ${s.key_insight}\n`;
    msg += `   Last visit: ${days}\n\n`;
  });

  msg += `_Type /visit to log a new visit._`;
  sendMessage(chatId, msg);
}

// ── Process visit note end-to-end ─────────────────────────────────────────────
function processVisitNote(chatId, session) {
  try {
    // 1. Analyse with Claude
    const analysis = analyseVisitNote(session.store, session.notes, session.cm_name, 'SG');

    if (!analysis) {
      // Analysis failed — still save the raw notes so the visit isn't lost
      const timestamp = new Date().toISOString();
      writeVisitToSheet({
        timestamp: timestamp,
        cm_name: session.cm_name,
        user_id: session.user_id,
        country: 'SG',
        store_name: session.store,
        raw_notes: session.notes,
        overall_health: 'watch',
        stock_status: 'amber',
        stock_summary: '(analysis unavailable)',
        stock_skus_at_risk: [],
        momentum: 'flat',
        momentum_summary: '(analysis unavailable)',
        competitor_level: 'none',
        competitor_threats: [],
        training_urgency: 'none',
        training_gaps: [],
        follow_ups: [],
        key_insight: '(analysis unavailable — check logs)',
        recommended_action: '(analysis unavailable)',
        staff_relationship: 'warm',
        visit_quality: 'standard'
      });
      sendMessage(chatId,
        `📝 *Visit notes saved — ${session.store}*\n\n` +
        `⚠️ AI analysis failed (check Apps Script logs for the error).\n` +
        `Your raw notes are in the sheet. Contact your admin to reprocess.`
      );
      return;
    }

    // 2. Write to Sheets
    const timestamp = new Date().toISOString();
    writeVisitToSheet({
      timestamp: timestamp,
      cm_name: session.cm_name,
      user_id: session.user_id,
      country: 'SG',
      store_name: session.store,
      raw_notes: session.notes,
      ...analysis
    });

    // 3. Send confirmation back to CM
    const health = { 'at-risk': '🔴', 'watch': '🟡', 'healthy': '🟢', 'strong': '🟢' }[analysis.overall_health] || '⚪';
    const mom = { 'up': '📈', 'flat': '→', 'down': '📉' }[analysis.momentum] || '→';

    let reply = `✅ *Visit logged — ${session.store}*\n\n`;
    reply += `${health} *${analysis.overall_health.toUpperCase()}*  ${mom} ${analysis.momentum.toUpperCase()}\n\n`;
    reply += `💡 *Key insight:* ${analysis.key_insight}\n\n`;

    if (analysis.stock_status === 'red') {
      reply += `⚠️ *Stock alert:* ${analysis.stock_summary}\n`;
    }
    if (analysis.competitor_level === 'high') {
      reply += `⚡ *Competitor flag:* ${analysis.competitor_threats[0] || ''}\n`;
    }
    if (analysis.training_urgency === 'high') {
      reply += `📚 *Training needed:* ${analysis.training_gaps[0] || ''}\n`;
    }

    reply += `\n_Your AM will see this in the dashboard._`;
    sendMessage(chatId, reply);

    // 4. Fire at-risk alert to AM if needed
    if (analysis.overall_health === 'at-risk') {
      triggerAtRiskAlert(session.store, session.cm_name, analysis);
    }

    // 5. Trigger dashboard rebuild (async — won't block the response)
    triggerDashboardRebuild();

  } catch (err) {
    Logger.log('processVisitNote error: ' + err.message);
    sendMessage(chatId, `⚠️ Something went wrong processing your note. Please try again or contact your manager.`);
  }
}

// ── Session management (using CacheService) ───────────────────────────────────
function setSession(chatId, data) {
  CacheService.getScriptCache().put(
    'session_' + chatId,
    JSON.stringify(data),
    600 // 10 minute expiry
  );
}

function getSession(chatId) {
  const raw = CacheService.getScriptCache().get('session_' + chatId);
  return raw ? JSON.parse(raw) : null;
}

function clearSession(chatId) {
  CacheService.getScriptCache().remove('session_' + chatId);
}

function cancelSession(chatId) {
  clearSession(chatId);
}

// ── Telegram API helpers ──────────────────────────────────────────────────────
function sendMessage(chatId, text) {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN');
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  // Try with Markdown first; fall back to plain text if Telegram rejects the
  // formatting (AI-generated content can contain unescaped * or _ characters
  // that cause a 400 and silently swallow the message).
  let resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown' }),
    muteHttpExceptions: true
  });

  if (resp.getResponseCode() !== 200) {
    Logger.log('sendMessage Markdown failed (' + resp.getResponseCode() + '), retrying plain: ' + resp.getContentText());
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: text }),
      muteHttpExceptions: true
    });
  }
}

function sendMessageWithButtons(chatId, text, buttons) {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN');
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  dbg('sendMessageWithButtons: chatId=' + chatId + ' buttons=' + buttons.length);

  let resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      text: text,
      reply_markup: { inline_keyboard: buttons }
    }),
    muteHttpExceptions: true
  });

  dbg('sendMessageWithButtons response: ' + resp.getResponseCode() + ' ' + resp.getContentText().substring(0, 300));

  if (resp.getResponseCode() !== 200) {
    dbg('sendMessageWithButtons failed, retrying plain text...');
    let resp2 = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: text }),
      muteHttpExceptions: true
    });
    dbg('sendMessageWithButtons fallback: ' + resp2.getResponseCode() + ' ' + resp2.getContentText().substring(0, 300));
  }
}

function answerCallbackQuery(callbackQueryId) {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN');
  UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ callback_query_id: callbackQueryId })
  });
}

// ── Register webhook with Telegram ───────────────────────────────────────────
// Run this ONCE manually after deploying the Apps Script as a web app
function registerWebhook() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const token = props.TELEGRAM_TOKEN;
  const webAppUrl = props.WEB_APP_URL; // Set this to your deployed Apps Script URL

  const response = UrlFetchApp.fetch(
    `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webAppUrl)}`
  );
  Logger.log(response.getContentText());
}

// ── Reset webhook — clears ALL pending queued messages ───────────────────────
// Run this manually whenever the bot has been spamming stale messages
function resetWebhook() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const token = props.TELEGRAM_TOKEN;
  const webAppUrl = props.WEB_APP_URL;

  // Delete first — drop_pending_updates=true wipes the entire backlog
  UrlFetchApp.fetch(
    `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`
  );

  // Re-register
  const res = UrlFetchApp.fetch(
    `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webAppUrl)}`
  );
  Logger.log('Webhook reset: ' + res.getContentText());
}
