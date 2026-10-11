// How grades turn into review dates. Edit the numbers here to change the schedule.
//
//   0 Blank   → back in 1 day
//   1 Partial → back in 3 days
//   2 Mostly  → previous gap × 1.5 (at least 5 days)
//   3 Solid   → previous gap × 2.5 (at least 7 days)
//
// Gaps are capped at MAX_DAYS. A question is "due" from midnight (your local time)
// on its due day, so anything due "tomorrow" appears as soon as tomorrow starts.

export const MAX_DAYS = 180;

export const GRADES = [
  { value: 0, label: 'Blank', hint: "Didn't know it", key: '0' },
  { value: 1, label: 'Partial', hint: 'Some of it, with gaps', key: '1' },
  { value: 2, label: 'Mostly', hint: 'Nearly all, small slips', key: '2' },
  { value: 3, label: 'Solid', hint: 'All of it, confidently', key: '3' },
] as const;

export function nextInterval(grade: number, previousDays: number): number {
  const prev = Math.max(0, previousDays || 0);
  let days: number;
  switch (grade) {
    case 0:
      days = 1;
      break;
    case 1:
      days = 3;
      break;
    case 2:
      days = Math.max(5, Math.round(prev * 1.5));
      break;
    case 3:
      days = Math.max(7, Math.round(prev * 2.5));
      break;
    default:
      throw new Error(`Invalid grade ${grade}`);
  }
  return Math.min(MAX_DAYS, days);
}

/** Midnight (local time) `days` days after `now`. */
export function dueDate(days: number, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

export function isDue(dueAt: string | null, now: Date = new Date()): boolean {
  return dueAt !== null && new Date(dueAt).getTime() <= now.getTime();
}

/** "today", "tomorrow", "in 5 days", "3 days ago" */
export function describeDue(dueAt: string | null, now: Date = new Date()): string {
  if (!dueAt) return '';
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(dueAt).getTime() - start.getTime()) / 86_400_000);
  if (diff <= 0) return diff === 0 ? 'today' : `${-diff} day${diff === -1 ? '' : 's'} overdue`;
  if (diff === 1) return 'tomorrow';
  return `in ${diff} days`;
}
