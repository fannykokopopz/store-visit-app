import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string): string | undefined {
  return process.env[key] || undefined;
}

export const config = {
  telegram: {
    botToken: required('TELEGRAM_BOT_TOKEN'),
    webhookSecret: required('TELEGRAM_WEBHOOK_SECRET'),
  },
  supabase: {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  },
  webhook: {
    domain: required('WEBHOOK_DOMAIN'),
    port: parseInt(process.env.PORT || '3000', 10),
  },
  anthropic: {
    apiKey: optional('ANTHROPIC_API_KEY'),
  },
  resend: {
    apiKey: optional('RESEND_API_KEY'),
  },
} as const;
