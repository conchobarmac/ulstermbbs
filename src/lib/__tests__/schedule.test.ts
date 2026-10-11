import { describe, expect, it } from 'vitest';
import { MAX_DAYS, describeDue, dueDate, isDue, nextInterval } from '../schedule';

describe('nextInterval', () => {
  it('first grades after learning', () => {
    expect([0, 1, 2, 3].map((g) => nextInterval(g, 0))).toEqual([1, 3, 5, 7]);
  });
  it('repeated Solid grows the gap', () => {
    const gaps: number[] = [];
    let d = 0;
    for (let i = 0; i < 6; i++) gaps.push((d = nextInterval(3, d)));
    expect(gaps).toEqual([7, 18, 45, 113, 180, 180]);
  });
  it('Mostly grows more slowly', () => {
    expect(nextInterval(2, 20)).toBe(30);
  });
  it('Blank or Partial resets', () => {
    expect(nextInterval(0, 100)).toBe(1);
    expect(nextInterval(1, 100)).toBe(3);
  });
  it('caps at MAX_DAYS and rejects bad grades', () => {
    expect(nextInterval(3, 1000)).toBe(MAX_DAYS);
    expect(() => nextInterval(4, 0)).toThrow();
  });
});

describe('due dates', () => {
  const now = new Date(2026, 9, 11, 21, 30); // 11 Oct 2026, 21:30 local
  it('is midnight local time N days later', () => {
    const d = dueDate(1, now);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 12, 0, 0]);
  });
  it('becomes due at midnight', () => {
    const due = dueDate(1, now).toISOString();
    expect(isDue(due, now)).toBe(false);
    expect(isDue(due, new Date(2026, 9, 12, 0, 0, 1))).toBe(true);
    expect(isDue(null, now)).toBe(false);
  });
  it('describes', () => {
    expect(describeDue(dueDate(1, now).toISOString(), now)).toBe('tomorrow');
    expect(describeDue(dueDate(5, now).toISOString(), now)).toBe('in 5 days');
    expect(describeDue(dueDate(-2, now).toISOString(), now)).toBe('2 days overdue');
  });
});
