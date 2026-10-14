import { describe, expect, it } from 'vitest';
import { dailySecret, memoryStore, rateLimit, runTokenFrom, signPayload, startOrResumeRun, verifyPayload } from './index';

describe('server helpers', () => {
  it('derives stable, distinct daily secrets', async () => {
    const a = await dailySecret('master', 'survive', '2026-10-12');
    expect(a).toBe(await dailySecret('master', 'survive', '2026-10-12'));
    expect(a).not.toBe(await dailySecret('master', 'survive', '2026-10-13'));
    expect(a).not.toBe(await dailySecret('master', 'compare', '2026-10-12'));
  });

  it('signs and verifies payloads', async () => {
    const sig = await signPayload('s', 'answer:3');
    expect(await verifyPayload('s', 'answer:3', sig)).toBe(true);
    expect(await verifyPayload('s', 'answer:4', sig)).toBe(false);
  });

  it('rate limits per bucket', async () => {
    const store = memoryStore();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(store, 'ip:1', 3, 60));
    expect(results).toEqual([true, true, true, false]);
    expect(await rateLimit(store, 'ip:2', 3, 60)).toBe(true);
  });

  it('reads the run token from cookie or header and rejects junk', () => {
    const tok = '123e4567-e89b-12d3-a456-426614174000';
    expect(runTokenFrom(new Request('http://x', { headers: { cookie: `a=1; cy_run=${tok}` } }))).toBe(tok);
    expect(runTokenFrom(new Request('http://x', { headers: { 'x-run-token': tok } }))).toBe(tok);
    expect(runTokenFrom(new Request('http://x', { headers: { cookie: 'cy_run=<script>' } }))).toBeNull();
  });

  it('resumes the same run within a day', async () => {
    const store = memoryStore();
    const a = await startOrResumeRun(store, 'survive', 'tok12345', '2026-10-12', () => ({ round: 0 }));
    const b = await startOrResumeRun(store, 'survive', 'tok12345', '2026-10-12', () => ({ round: 99 }));
    expect(b).toEqual(a);
  });
});
