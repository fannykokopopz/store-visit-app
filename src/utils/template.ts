export const VISIT_TEMPLATE = `🌟 Good News


🔍 Competitors' Insights


📦 Display & Stock


✅ What to Follow Up


⚡ Buzz Plan


🎓 Training


`;

export function buildTemplateMessage(storeName: string): string {
  const date = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  return (
    `📋 *${storeName}*\n` +
    `📅 ${date}\n\n` +
    `Copy, fill in what you can, and send it back 💪\n` +
    `Photos? Attach them to the same message 📸\n\n` +
    `\`\`\`\n${VISIT_TEMPLATE}\`\`\``
  );
}
