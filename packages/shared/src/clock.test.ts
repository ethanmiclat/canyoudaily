import { describe, expect, it } from 'vitest';
import { addDays, dateKey, daysBetween, formatCountdown, nextReset, puzzleNumber, secondsToReset, startOfDay } from './clock';

describe('dateKey', () => {
  it('uses Chicago, not UTC', () => {
    // 2026-10-12 03:30 UTC is 2026-10-11 22:30 CDT
    expect(dateKey(new Date('2026-10-12T03:30:00Z'))).toBe('2026-10-11');
    expect(dateKey(new Date('2026-10-12T05:00:00Z'))).toBe('2026-10-12');
  });

  it('handles winter (CST, UTC-6)', () => {
    expect(dateKey(new Date('2026-01-15T05:59:59Z'))).toBe('2026-01-14');
    expect(dateKey(new Date('2026-01-15T06:00:00Z'))).toBe('2026-01-15');
  });
});

describe('startOfDay / nextReset', () => {
  it('finds midnight in summer and winter', () => {
    expect(startOfDay('2026-07-01').toISOString()).toBe('2026-07-01T05:00:00.000Z');
    expect(startOfDay('2026-12-01').toISOString()).toBe('2026-12-01T06:00:00.000Z');
  });

  it('handles DST change days (23h and 25h days)', () => {
    // Spring forward 2026-03-08, fall back 2026-11-01
    expect(startOfDay('2026-03-08').toISOString()).toBe('2026-03-08T06:00:00.000Z');
    expect(startOfDay('2026-03-09').toISOString()).toBe('2026-03-09T05:00:00.000Z');
    expect(startOfDay('2026-11-01').toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect(startOfDay('2026-11-02').toISOString()).toBe('2026-11-02T06:00:00.000Z');

    const spring = new Date('2026-03-08T07:00:00Z'); // 01:00 CST
    expect(secondsToReset(spring)).toBe(22 * 3600);
    const fall = new Date('2026-11-01T06:00:00Z'); // 01:00 CDT
    expect(secondsToReset(fall)).toBe(24 * 3600);
  });

  it('counts down to the next midnight', () => {
    const now = new Date('2026-10-12T04:59:30Z'); // 23:59:30 CDT
    expect(nextReset(now).toISOString()).toBe('2026-10-12T05:00:00.000Z');
    expect(secondsToReset(now)).toBe(30);
  });
});

describe('date math', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('numbers puzzles from the launch date', () => {
    expect(puzzleNumber('2026-11-01', '2026-11-01')).toBe(1);
    expect(puzzleNumber('2026-11-01', '2026-11-30')).toBe(30);
    expect(puzzleNumber('2026-11-01', '2026-10-31')).toBe(0);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('formats countdowns', () => {
    expect(formatCountdown(3661)).toBe('01:01:01');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });

  it('rejects malformed keys', () => {
    expect(() => addDays('2026-1-1', 1)).toThrow();
  });
});
