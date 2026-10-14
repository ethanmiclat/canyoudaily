import { describe, expect, it } from 'vitest';
import { buildShareText } from './share';

describe('buildShareText', () => {
  it('uses the standard header, result lines, then the link', () => {
    expect(
      buildShareText({
        gameName: 'Can You Survive',
        puzzleNumber: 12,
        lines: ['🟩🟩🟥 2 of 3 rounds'],
        url: 'https://example.com/survive',
      }),
    ).toBe('Can You Survive #12\n🟩🟩🟥 2 of 3 rounds\nhttps://example.com/survive');
  });
});
