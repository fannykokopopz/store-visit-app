import 'dotenv/config';
import { Bot } from 'grammy';

const token = process.env.TELEGRAM_BOT_TOKEN;
const domain = process.env.WEBHOOK_DOMAIN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !domain || !secret) {
  console.error('Missing TELEGRAM_BOT_TOKEN, WEBHOOK_DOMAIN, or TELEGRAM_WEBHOOK_SECRET');
  process.exit(1);
}

const bot = new Bot(token);
const url = `${domain}/webhook/${secret}`;

const info = await bot.api.setWebhook(url);
console.log(`Webhook set to ${url}:`, info);

const webhook = await bot.api.getWebhookInfo();
console.log('Current webhook info:', webhook);
