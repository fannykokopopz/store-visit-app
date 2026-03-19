// ============================================================
// TC Acoustic Store Intelligence — Alerts & Digest
// File: alerts_digest.gs
// Weekly AM digest + at-risk Telegram alerts
// ============================================================

// ── At-risk alert — fires immediately when a store goes at-risk ───────────────
function triggerAtRiskAlert(storeName, cmName, analysis) {
  const props = PropertiesService.getScriptProperties().getProperties();
  const alertChatId = props.ALERT_TELEGRAM_ID;

  if (!alertChatId) return;

  const msg =
    `🔴 *AT-RISK ALERT*\n\n` +
    `*${storeName}*\n` +
    `CM: ${cmName} · Just logged\n\n` +
    `💡 ${analysis.key_insight}\n\n` +
    `*Action required:* ${analysis.recommended_action}\n\n` +
    (analysis.competitor_threats.length
      ? `⚡ *Competitor:* ${analysis.competitor_threats[0]}\n`
      : '') +
    (analysis.stock_status === 'red'
      ? `📦 *Stock critical:* ${analysis.stock_summary}\n`
      : '') +
    `\n_View dashboard for full details._`;

  sendMessage(alertChatId, msg);
}

// ── Weekly AM digest — runs every Monday 9am SGT ──────────────────────────────
// Schedule this in Apps Script: Triggers > Add trigger > weeklyDigest > Time-based > Week timer > Monday > 9am
function weeklyDigest() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const amEmail = props.AM_EMAIL_SG;
  const alertChatId = props.ALERT_TELEGRAM_ID;

  const analyses = getAllLatestAnalyses();
  if (!analyses || analyses.length === 0) return;

  // Sort by priority
  analyses.sort((a, b) => {
    const order = { 'at-risk': 0, 'watch': 1, 'healthy': 2, 'strong': 3 };
    return (order[a.overall_health] ?? 1) - (order[b.overall_health] ?? 1);
  });

  const atRisk = analyses.filter(a => a.overall_health === 'at-risk');
  const stale = analyses.filter(a => a.days_ago > 7);
  const brightSpots = analyses.filter(a => a.momentum === 'up' && ['healthy','strong'].includes(a.overall_health));

  // Generate AI narrative
  const narrative = generateWeeklyDigest(analyses, 'Singapore');

  // Send email to AM
  if (amEmail) {
    sendWeeklyEmail(amEmail, analyses, atRisk, stale, brightSpots, narrative);
  }

  // Send Telegram summary to AM
  if (alertChatId) {
    sendWeeklyTelegram(alertChatId, analyses, atRisk, stale, narrative);
  }
}

// ── Send weekly email ─────────────────────────────────────────────────────────
function sendWeeklyEmail(email, analyses, atRisk, stale, brightSpots, narrative) {
  const week = getISOWeek(new Date());
  const subject = `TC Store Visit App — Weekly Digest W${week}`;

  let body = `<div style="font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;color:#1D1D1F;">`;

  // Header
  body += `<div style="background:#1D1D1F;padding:20px 24px;border-radius:12px 12px 0 0;">
    <h2 style="color:white;margin:0;font-size:18px;font-weight:600;">TC Store Visit App — SG</h2>
    <p style="color:#6E6E73;margin:4px 0 0;font-size:12px;">Week ${week} · ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</p>
  </div>`;

  // Stats bar
  const atRiskCount = atRisk.length;
  const watchCount = analyses.filter(a => a.overall_health === 'watch').length;
  const healthyCount = analyses.filter(a => ['healthy','strong'].includes(a.overall_health)).length;

  body += `<div style="background:#F5F5F7;padding:16px 24px;display:flex;gap:20px;">
    <div><span style="font-size:24px;font-weight:600;color:#FF3B30;">${atRiskCount}</span><br><span style="font-size:11px;color:#6E6E73;">At risk</span></div>
    <div><span style="font-size:24px;font-weight:600;color:#FF9500;">${watchCount}</span><br><span style="font-size:11px;color:#6E6E73;">Watch</span></div>
    <div><span style="font-size:24px;font-weight:600;color:#34C759;">${healthyCount}</span><br><span style="font-size:11px;color:#6E6E73;">Healthy</span></div>
    <div><span style="font-size:24px;font-weight:600;color:#6E6E73;">${stale.length}</span><br><span style="font-size:11px;color:#6E6E73;">Not visited 7d+</span></div>
  </div>`;

  // AI narrative
  if (narrative) {
    body += `<div style="padding:20px 24px;background:white;border-bottom:0.5px solid #F2F2F7;">
      <h3 style="font-size:13px;font-weight:600;color:#6E6E73;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px;">This week's brief</h3>
      <p style="font-size:14px;line-height:1.6;margin:0;white-space:pre-line;">${narrative}</p>
    </div>`;
  }

  // At-risk stores
  if (atRisk.length > 0) {
    body += `<div style="padding:20px 24px;background:white;">
      <h3 style="font-size:13px;font-weight:600;color:#FF3B30;margin:0 0 12px;">🔴 Needs immediate attention</h3>`;
    atRisk.forEach(s => {
      body += `<div style="background:#FEF2F2;border-radius:8px;padding:12px 14px;margin-bottom:8px;">
        <strong style="font-size:13px;">${s.store_name}</strong>
        <div style="font-size:12px;color:#6E6E73;margin:2px 0;">CM: ${s.cm_name} · Last visit: ${s.days_ago === 0 ? 'today' : s.days_ago + 'd ago'}</div>
        <div style="font-size:13px;margin:6px 0 4px;">${s.key_insight}</div>
        <div style="font-size:12px;color:#991B1B;font-weight:500;">→ ${s.recommended_action}</div>
      </div>`;
    });
    body += `</div>`;
  }

  // Stale stores
  if (stale.length > 0) {
    body += `<div style="padding:20px 24px;background:white;border-top:0.5px solid #F2F2F7;">
      <h3 style="font-size:13px;font-weight:600;color:#FF9500;margin:0 0 12px;">⏰ Not visited this week</h3>`;
    stale.slice(0, 6).forEach(s => {
      body += `<div style="font-size:13px;padding:6px 0;border-bottom:0.5px solid #F5F5F7;display:flex;justify-content:space-between;">
        <span>${s.store_name}</span>
        <span style="color:#6E6E73;">${s.days_ago}d ago · ${s.cm_name}</span>
      </div>`;
    });
    if (stale.length > 6) {
      body += `<div style="font-size:12px;color:#6E6E73;margin-top:6px;">+${stale.length - 6} more</div>`;
    }
    body += `</div>`;
  }

  // Bright spots
  if (brightSpots.length > 0) {
    body += `<div style="padding:20px 24px;background:white;border-top:0.5px solid #F2F2F7;">
      <h3 style="font-size:13px;font-weight:600;color:#34C759;margin:0 0 12px;">📈 Bright spots this week</h3>`;
    brightSpots.slice(0, 3).forEach(s => {
      body += `<div style="background:#F0FDF4;border-radius:8px;padding:10px 12px;margin-bottom:6px;">
        <strong style="font-size:13px;">${s.store_name}</strong>
        <div style="font-size:12px;color:#065F46;margin-top:3px;">${s.key_insight}</div>
      </div>`;
    });
    body += `</div>`;
  }

  // Footer
  const dashboardUrl = `https://${PropertiesService.getScriptProperties().getProperty('GITHUB_REPO').split('/')[0]}.github.io/${PropertiesService.getScriptProperties().getProperty('GITHUB_REPO').split('/')[1]}/`;
  body += `<div style="padding:16px 24px;background:#F5F5F7;border-radius:0 0 12px 12px;text-align:center;">
    <a href="${dashboardUrl}" style="font-size:13px;color:#007AFF;text-decoration:none;font-weight:500;">Open full dashboard →</a>
  </div>`;

  body += `</div>`;

  GmailApp.sendEmail(email, subject, '', { htmlBody: body });
}

// ── Send weekly Telegram summary to AM ────────────────────────────────────────
function sendWeeklyTelegram(chatId, analyses, atRisk, stale, narrative) {
  const week = getISOWeek(new Date());
  let msg = `📊 *Week ${week} TC Store Visit App — SG*\n\n`;

  if (atRisk.length > 0) {
    msg += `🔴 *At risk (${atRisk.length}):*\n`;
    atRisk.forEach(s => {
      msg += `• ${s.store_name} — ${s.recommended_action}\n`;
    });
    msg += '\n';
  }

  if (stale.length > 0) {
    msg += `⏰ *Not visited this week (${stale.length}):*\n`;
    stale.slice(0, 4).forEach(s => msg += `• ${s.store_name} (${s.cm_name})\n`);
    if (stale.length > 4) msg += `• ...and ${stale.length - 4} more\n`;
    msg += '\n';
  }

  msg += `_Full dashboard in email or tap /mystores_`;
  sendMessage(chatId, msg);
}
