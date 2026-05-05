export const VISIT_TEMPLATE = `1️⃣ Good News


2️⃣ Competitors' Insights


3️⃣ Display & Stock


4️⃣ What to Follow Up


5️⃣ Buzz Plan
`;

export function buildTemplateMessage(storeName: string): string {
  const date = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  return (
    `📋 *${storeName} — ${date}*\n\n` +
    `Copy, fill in each section, and send back\\. Attach photos to the same message\\.\n\n` +
    `\`\`\`\n${VISIT_TEMPLATE}\`\`\``
  );
}
