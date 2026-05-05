export const VISIT_TEMPLATE = `1. GOOD NEWS
-

2. COMPETITORS' INSIGHTS
-

3. DISPLAY & STOCK
-

4. WHAT TO FOLLOW UP
-

5. BUZZ PLAN
-`;

export function buildTemplateMessage(storeName: string): string {
  const date = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  return (
    `📋 *${storeName} — ${date}*\n\n` +
    `Copy, fill in, and send back\\. Attach photos to the same message\\.\n\n` +
    `\`\`\`\n${VISIT_TEMPLATE}\n\`\`\``
  );
}
