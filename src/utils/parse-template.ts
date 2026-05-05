export interface ParsedSections {
  goodNews: string | null;
  competitors: string | null;
  displayStock: string | null;
  followUp: string | null;
  buzzPlan: string | null;
}

const SECTION_PATTERNS: Array<{ key: keyof ParsedSections; re: RegExp }> = [
  { key: 'goodNews',    re: /(?:1️⃣|1\.)\s+Good News\s*\n([\s\S]*?)(?=\n\s*(?:2️⃣|2\.)|$)/i },
  { key: 'competitors', re: /(?:2️⃣|2\.)\s+Competitors['']?\s*Insights?\s*\n([\s\S]*?)(?=\n\s*(?:3️⃣|3\.)|$)/i },
  { key: 'displayStock',re: /(?:3️⃣|3\.)\s+Display\s*[&+]\s*Stock\s*\n([\s\S]*?)(?=\n\s*(?:4️⃣|4\.)|$)/i },
  { key: 'followUp',    re: /(?:4️⃣|4\.)\s+What\s+to\s+Follow\s+Up\s*\n([\s\S]*?)(?=\n\s*(?:5️⃣|5\.)|$)/i },
  { key: 'buzzPlan',    re: /(?:5️⃣|5\.)\s+Buzz\s+Plan\s*\n([\s\S]*?)$/i },
];

export function parseTemplate(text: string): ParsedSections {
  const sections: ParsedSections = {
    goodNews: null, competitors: null,
    displayStock: null, followUp: null, buzzPlan: null,
  };

  for (const { key, re } of SECTION_PATTERNS) {
    const match = text.match(re);
    if (match?.[1]) {
      const content = match[1]
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && l !== '-')
        .join('\n')
        .trim();
      if (content) sections[key] = content;
    }
  }

  return sections;
}

export function filledCount(sections: ParsedSections): number {
  return Object.values(sections).filter(Boolean).length;
}

export function sectionsPreview(sections: ParsedSections): string {
  const defs = [
    { key: 'goodNews',    emoji: '1️⃣' },
    { key: 'competitors', emoji: '2️⃣' },
    { key: 'displayStock',emoji: '3️⃣' },
    { key: 'followUp',    emoji: '4️⃣' },
    { key: 'buzzPlan',    emoji: '5️⃣' },
  ] as const;

  return defs.map(({ key, emoji }) => {
    const val = sections[key];
    if (!val) return `${emoji} —`;
    const flat = val.replace(/\n/g, ' ');
    return `${emoji} ${flat.length > 70 ? flat.slice(0, 67) + '...' : flat}`;
  }).join('\n');
}
