const HEALTH_EMOJI: Record<string, string> = {
  'at-risk': '🔴',
  'watch': '🟡',
  'healthy': '🟢',
  'strong': '💚',
};

const MOMENTUM_EMOJI: Record<string, string> = {
  'up': '📈',
  'flat': '➡️',
  'down': '📉',
};

export function healthEmoji(health: string | null): string {
  return health ? (HEALTH_EMOJI[health] || '⚪') : '⚪';
}

export function momentumEmoji(momentum: string | null): string {
  return momentum ? (MOMENTUM_EMOJI[momentum] || '➡️') : '➡️';
}

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function daysSinceLabel(dateStr: string | null): string {
  const days = daysSince(dateStr);
  if (days === null) return 'No visits yet';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function categoriesFilled(visit: {
  relationship_notes: string | null;
  training_notes: string | null;
  experience_notes: string | null;
  creative_notes: string | null;
}): string[] {
  const filled: string[] = [];
  if (visit.relationship_notes) filled.push('R');
  if (visit.training_notes) filled.push('T');
  if (visit.experience_notes) filled.push('E');
  if (visit.creative_notes) filled.push('C');
  return filled;
}
