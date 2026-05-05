interface EditSession {
  visitId: string;
  storeName: string;
}

// Tracks CMs who tapped ✏️ Edit — waiting for them to resend updated template.
const editSessions = new Map<number, EditSession>();

export function startEditSession(telegramId: number, visitId: string, storeName: string): void {
  editSessions.set(telegramId, { visitId, storeName });
}

export function isEditing(telegramId: number): boolean {
  return editSessions.has(telegramId);
}

export function getEditSession(telegramId: number): EditSession | undefined {
  return editSessions.get(telegramId);
}

export function clearEditSession(telegramId: number): void {
  editSessions.delete(telegramId);
}
