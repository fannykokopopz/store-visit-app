import express from 'express';
import { webhookCallback } from 'grammy';
import { config } from './config.js';
import { createBot } from './bot/bot.js';

const bot = createBot();
const app = express();

// Health check for Railway
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Telegram webhook
app.use(
  `/webhook/${config.telegram.webhookSecret}`,
  express.json(),
  webhookCallback(bot, 'express'),
);

// Start server and set webhook
app.listen(config.webhook.port, async () => {
  const webhookUrl = `${config.webhook.domain}/webhook/${config.telegram.webhookSecret}`;
  await bot.api.setWebhook(webhookUrl);
  console.log(`Bot server running on port ${config.webhook.port}`);
  console.log(`Webhook set to ${webhookUrl}`);
});
