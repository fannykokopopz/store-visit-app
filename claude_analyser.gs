// ============================================================
// TC Acoustic Store Intelligence — Claude Analyser
// File: claude_analyser.gs
// Calls Claude API to extract structured signals from visit notes
// ============================================================

const ANALYSIS_SYSTEM_PROMPT = `You are a retail intelligence analyst for TC Acoustic, a distributor of Sonos, Marshall, and Bowers & Wilkins in Singapore.

A Channel Manager has just submitted a store visit note. Extract structured signals and return ONLY valid JSON with no markdown or preamble.

Return exactly this structure:
{
  "overall_health": "at-risk" | "watch" | "healthy" | "strong",
  "stock_status": "red" | "amber" | "green",
  "stock_summary": "1 sentence",
  "stock_skus_at_risk": ["SKU name", ...],
  "momentum": "up" | "flat" | "down",
  "momentum_summary": "1 sentence",
  "competitor_threats": ["observation 1", ...],
  "competitor_level": "none" | "low" | "high",
  "training_gaps": ["gap 1", ...],
  "training_urgency": "none" | "low" | "high",
  "follow_ups": ["follow-up item 1", ...],
  "key_insight": "The single most important thing the AM needs to know (1 sentence, specific and actionable)",
  "recommended_action": "The #1 action the AM should take (1 sentence)",
  "staff_relationship": "cold" | "warm" | "strong",
  "visit_quality": "minimal" | "standard" | "thorough"
}

Rules:
- stock red = any SKU at 0 or critically low; amber = some SKUs low; green = healthy
- momentum up = positive sales mentions, staff enthusiasm, promos working; down = slow sales, staff pushing competitors
- competitor_threats = only concrete observations (new fixtures, in-store promos, staff recommending rival brands)
- training_gaps = specific product knowledge gaps or missed demo opportunities
- follow_ups = specific action items the CM mentioned needing to follow up on
- visit_quality: minimal = barely any info; standard = decent notes; thorough = rich detail
- If a field has no evidence, return [] or "none" — never invent signals`;

// ── Diagnostic: test full visit note analysis ────────────────────────────────
function testAnalysis() {
  const result = analyseVisitNote(
    'Challenger @ ION',
    'Spoke to Henry. Store quiet, 30% foot traffic. Sold 3 Era 100s last week, Arc Ultra slow (1 unit). Era 300 display dusty. Bose promoter doing demos near our section. Trained Yuan on Arc Ultra Trueplay. Need to follow up on second Era 300 demo unit — current one has a crack.',
    'Fanny',
    'SG'
  );
  Logger.log(JSON.stringify(result, null, 2));
}

// ── Diagnostic: test Claude API key and connectivity ─────────────────────────
function testClaudeApi() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) { Logger.log('ERROR: ANTHROPIC_API_KEY not set'); return; }
  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }),
    muteHttpExceptions: true
  });
  Logger.log('Status: ' + response.getResponseCode());
  Logger.log('Body: ' + response.getContentText().substring(0, 300));
}

// ── Main analysis function ────────────────────────────────────────────────────
function analyseVisitNote(storeName, notes, cmName, country) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');

  const userPrompt =
    `Store: ${storeName}\n` +
    `Country: ${country}\n` +
    `CM: ${cmName}\n` +
    `Visit date: ${new Date().toLocaleDateString('en-GB')}\n\n` +
    `Visit notes:\n${notes}`;

  try {
    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Fast and cheap for real-time analysis
        max_tokens: 600,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      }),
      muteHttpExceptions: true
    });

    const data = JSON.parse(response.getContentText());

    if (data.error) {
      Logger.log('Claude API error (HTTP ' + response.getResponseCode() + '): ' + JSON.stringify(data.error));
      return null;
    }
    if (!data.content || !data.content[0]) {
      Logger.log('Claude API unexpected response: ' + response.getContentText().substring(0, 500));
      return null;
    }

    let raw = data.content[0].text.trim();

    // Strip markdown fences if present
    if (raw.startsWith('```')) {
      raw = raw.split('```')[1];
      if (raw.startsWith('json')) raw = raw.slice(4);
    }

    return JSON.parse(raw.trim());

  } catch (err) {
    Logger.log('analyseVisitNote error: ' + err.message);
    return null;
  }
}

// ── Generate weekly AM digest narrative ──────────────────────────────────────
function generateWeeklyDigest(storeSummaries, market) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');

  const storeData = storeSummaries.map(s =>
    `${s.store_name} (${s.overall_health}): ${s.key_insight}`
  ).join('\n');

  const prompt =
    `You are writing a weekly store intelligence digest for TC Acoustic's Account Manager in ${market}.\n\n` +
    `Here is the current state of their ${storeSummaries.length} stores:\n\n${storeData}\n\n` +
    `Write a brief, punchy weekly digest (max 200 words) covering:\n` +
    `1. Top 2-3 stores needing immediate attention this week (with specific actions)\n` +
    `2. One bright spot or win to acknowledge\n` +
    `3. One market pattern worth noting\n\n` +
    `Be direct and specific. No fluff. Format as plain text suitable for email.`;

  try {
    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      }),
      muteHttpExceptions: true
    });

    const data = JSON.parse(response.getContentText());
    if (data.error) {
      Logger.log('generateWeeklyDigest Claude API error: ' + JSON.stringify(data.error));
      return null;
    }
    if (!data.content || !data.content[0]) {
      Logger.log('generateWeeklyDigest unexpected response: ' + response.getContentText().substring(0, 300));
      return null;
    }
    return data.content[0].text.trim();

  } catch (err) {
    Logger.log('generateWeeklyDigest error: ' + err.message);
    return null;
  }
}
