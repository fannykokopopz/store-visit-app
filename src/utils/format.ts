export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function daysSinceLabel(dateStr: string | null): string {
  const days = daysSince(dateStr);
  if (days === null) return 'No visits yet';
  if (days === 0) return 'Visited today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function sectionsFilled(visit: {
  good_news: string | null;
  competitors: string | null;
  display_stock: string | null;
  follow_up: string | null;
  buzz_plan: string | null;
}): string[] {
  const filled: string[] = [];
  if (visit.good_news) filled.push('Good News');
  if (visit.competitors) filled.push('Competitors');
  if (visit.display_stock) filled.push('Display & Stock');
  if (visit.follow_up) filled.push('Follow Up');
  if (visit.buzz_plan) filled.push('Buzz Plan');
  return filled;
}
