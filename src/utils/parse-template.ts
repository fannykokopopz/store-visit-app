export interface ParsedSections {
  goodNews: string | null;
  competitors: string | null;
  displayStock: string | null;
  followUp: string | null;
  buzzPlan: string | null;
}

const SECTION_HEADERS: Array<{ key: keyof ParsedSections; pattern: RegExp }> = [
  { key: 'goodNews',     pattern: /(?:^|\n)[ \t]*(?:1️⃣|1\.)[ \t]+Good\s+News\b[^\n]*/i },
  { key: 'competitors',  pattern: /(?:^|\n)[ \t]*(?:2️⃣|2\.)[ \t]+Competitors['']?[ \t]*Insights?\b[^\n]*/i },
  { key: 'displayStock', pattern: /(?:^|\n)[ \t]*(?:3️⃣|3\.)[ \t]+Display[ \t]*[&+][ \t]*Stock\b[^\n]*/i },
  { key: 'followUp',     pattern: /(?:^|\n)[ \t]*(?:4️⃣|4\.)[ \t]+What[ \t]+to[ \t]+Follow[ \t]+Up\b[^\n]*/i },
  { key: 'buzzPlan',     pattern: /(?:^|\n)[ \t]*(?:5️⃣|5\.)[ \t]+Buzz[ \t]+Plan\b[^\n]*/i },
];

export function parseTemplate(text: string): ParsedSections {
  const sections: ParsedSections = {
    goodNews: null, competitors: null,
    displayStock: null, followUp: null, buzzPlan: null,
  };

  const markers: Array<{ key: keyof ParsedSections; contentStart: number; headerStart: number }> = [];
  for (const { key, pattern } of SECTION_HEADERS) {
    const m = text.match(pattern);
    if (!m || m.index === undefined) continue;
    markers.push({
      key,
      headerStart: m.index,
      contentStart: m.index + m[0].length,
    });
  }

  markers.sort((a, b) => a.headerStart - b.headerStart);

  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].contentStart;
    const end = markers[i + 1]?.headerStart ?? text.length;
    if (end <= start) continue;
    const raw = text.slice(start, end);
    const content = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && l !== '-')
      .join('\n')
      .trim();
    if (content) sections[markers[i].key] = content;
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
