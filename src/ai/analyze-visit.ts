import Anthropic from '@anthropic-ai/sdk';
import { ParsedSections } from '../utils/parse-template.js';
import { config } from '../config.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: config.anthropic.apiKey });
  return client;
}

export interface VisitAnalysis {
  key_insight: string;
  recommended_action: string;
  overall_health: 'healthy' | 'watch' | 'at-risk' | 'strong';
}

const SYSTEM_PROMPT = `You analyze store visit notes from channel managers at TC Acoustic, a consumer electronics brand.
Extract a concise analysis from the 5-section visit report. Return ONLY valid JSON.`;

export async function analyzeVisit(
  storeName: string,
  sections: ParsedSections,
): Promise<VisitAnalysis | null> {
  if (!config.anthropic.apiKey) return null;

  const notesText = [
    sections.goodNews ? `GOOD NEWS:\n${sections.goodNews}` : null,
    sections.competitors ? `COMPETITORS:\n${sections.competitors}` : null,
    sections.displayStock ? `DISPLAY & STOCK:\n${sections.displayStock}` : null,
    sections.followUp ? `FOLLOW UP:\n${sections.followUp}` : null,
    sections.buzzPlan ? `BUZZ PLAN:\n${sections.buzzPlan}` : null,
  ].filter(Boolean).join('\n\n');

  if (!notesText) return null;

  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Store: ${storeName}\n\n${notesText}\n\nReturn JSON: { "key_insight": "...", "recommended_action": "...", "overall_health": "healthy|watch|at-risk|strong" }`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    return {
      key_insight: parsed.key_insight ?? '',
      recommended_action: parsed.recommended_action ?? '',
      overall_health: parsed.overall_health ?? 'watch',
    };
  } catch (err) {
    console.error('analyzeVisit error:', err);
    return null;
  }
}
