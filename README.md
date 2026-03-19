# TC Acoustic Store Intelligence — Setup Guide
## Telegram Bot + Google Apps Script + Claude API

**What this builds:** A Telegram bot that lets channel managers log store visits in 2 minutes. Claude analyses each note and updates a live dashboard on GitHub Pages. AMs get weekly email digests and instant at-risk alerts.

---

## What you need before starting

- A Google account (personal or team)
- An Anthropic API key → console.anthropic.com
- A GitHub account (you already have one: fannykokopopz)
- A Telegram account

**Estimated setup time: 45–60 minutes**
**Monthly cost: ~$20–30 (Anthropic API usage)**

---

## Step 1 — Create the Telegram Bot (5 min)

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Name it: `TC Acoustic Store Intel`
4. Username: `TCAcousticStoreBot` (or any available name ending in `bot`)
5. BotFather gives you a **token** — save it. Looks like: `7234567890:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Step 2 — Create the Google Sheet (5 min)

1. Go to **sheets.google.com** → Create a new blank spreadsheet
2. Name it: `TC Acoustic Store Intelligence`
3. Copy the **Sheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
4. Save the Sheet ID

---

## Step 3 — Set up Google Apps Script (15 min)

1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete the default `Code.gs` file
3. Create 5 new files (click **+** next to Files):
   - `telegram_bot.gs`
   - `claude_analyser.gs`
   - `sheets_writer.gs`
   - `dashboard_builder.gs`
   - `alerts_digest.gs`
4. Paste the contents of each `.gs` file from this package into the corresponding Apps Script file
5. **Save** (Cmd+S)

---

## Step 4 — Set Script Properties (10 min)

In Apps Script: **Project Settings (⚙️) → Script Properties → Add property**

Add all of these:

| Property | Value | Where to get it |
|---|---|---|
| `TELEGRAM_TOKEN` | Your bot token from Step 1 | BotFather |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | console.anthropic.com |
| `SHEET_ID` | Your Sheet ID from Step 2 | Google Sheets URL |
| `GITHUB_TOKEN` | GitHub personal access token | github.com/settings/tokens (repo scope) |
| `GITHUB_REPO` | `fannykokopopz/store-intel` | Your GitHub repo |
| `AM_EMAIL_SG` | AM's email address | Your team |
| `ALERT_TELEGRAM_ID` | AM's Telegram chat ID | See note below |

**To get the AM's Telegram chat ID:**
1. Have the AM message @userinfobot on Telegram
2. It replies with their chat ID (a number like `123456789`)

---

## Step 5 — Deploy as Web App (5 min)

1. In Apps Script, click **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Click **Deploy**
6. Copy the **Web App URL** — looks like: `https://script.google.com/macros/s/AKfycb.../exec`
7. Add this to Script Properties as `WEB_APP_URL`

---

## Step 6 — Register the Telegram Webhook (2 min)

1. In Apps Script, open `telegram_bot.gs`
2. Find the `registerWebhook` function
3. Click **Run** (▶️)
4. Check the logs — should say `{"ok":true,...}`

This connects Telegram to your Apps Script. Every message to your bot now triggers `doPost`.

---

## Step 7 — Initialise the Spreadsheet (2 min)

1. Open `sheets_writer.gs`
2. Find the `setupSpreadsheet` function
3. Click **Run** (▶️)
4. Check your Google Sheet — it should now have 4 tabs: Visit Log, Store Master, CM Roster, Latest Analysis
5. The Store Master tab will be pre-populated with all SG stores

---

## Step 8 — Set Up CM Roster (10 min)

1. Open the **CM Roster** tab in your Google Sheet
2. Add a row for each CM with their stores:

| Telegram Chat ID | CM Name | Store Name | Country | Active |
|---|---|---|---|---|
| 123456789 | Johnathan Tan | Harvey Norman @ West Gate | SG | Yes |
| 123456789 | Johnathan Tan | Harvey Norman @ Parkway Parade | SG | Yes |
| 987654321 | Sinclair Tan | Sprint-Cass @ T2 (#02-186) | SG | Yes |

**To get a CM's Telegram chat ID:** Have them message your bot (`/start`), then check Apps Script execution logs — the chat ID appears there.

---

## Step 9 — Set Up Weekly Digest Trigger (3 min)

1. In Apps Script, click **Triggers (⏰)**
2. Click **Add Trigger**
3. Function: `weeklyDigest`
4. Event source: **Time-driven**
5. Type: **Week timer**
6. Day: **Monday**
7. Time: **9am to 10am**
8. Save

---

## Step 10 — Test it (5 min)

1. Open Telegram and find your bot
2. Send `/start` — should get a welcome message
3. Send `/visit` — should see store selection buttons
4. Select a store and type a visit note
5. Should get back an analysis with key insight
6. Check your Google Sheet — Visit Log and Latest Analysis tabs should have a new row
7. Check GitHub — index.html should have been updated

---

## Adding a new market (MY, TH, HK)

1. In `telegram_bot.gs`, change `'SG'` to the new market code where `processVisitNote` is called
2. Add stores to the Store Master tab
3. Add CMs to the CM Roster tab
4. Duplicate `AM_EMAIL_SG` and `ALERT_TELEGRAM_ID` as `AM_EMAIL_MY` etc.

For a multi-market v2, we recommend migrating to the hosted web app (Option 2) at this point.

---

## Troubleshooting

**Bot not responding:** Check that `registerWebhook` ran successfully and the Web App URL is correct in Script Properties.

**Analysis returning null:** Check your `ANTHROPIC_API_KEY` is correct in Script Properties.

**Dashboard not updating:** Check `GITHUB_TOKEN` has `repo` scope and `GITHUB_REPO` format is `username/repo-name`.

**CM gets "no stores assigned":** Add their Telegram Chat ID and stores to the CM Roster tab.

---

## Cost estimate (SG, ~25 stores, weekly cadence)

| Item | Cost |
|---|---|
| Claude API (Haiku, ~50 visits/week) | ~$2–5/month |
| Google Apps Script | Free |
| GitHub Pages | Free |
| Telegram Bot | Free |
| **Total** | **~$5/month** |

Claude Haiku is used for real-time visit analysis (fast, cheap). Claude Haiku is also used for weekly digest generation. Total API cost is minimal at this scale.

---

## File summary

| File | What it does |
|---|---|
| `telegram_bot.gs` | Receives Telegram messages, manages conversation sessions, routes commands |
| `claude_analyser.gs` | Calls Claude API to extract signals from visit notes |
| `sheets_writer.gs` | Reads/writes all data to Google Sheets |
| `dashboard_builder.gs` | Generates dashboard HTML and publishes to GitHub Pages |
| `alerts_digest.gs` | Sends at-risk Telegram alerts and Monday AM email digests |
