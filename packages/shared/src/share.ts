// Share card builder. Every game uses the same header so results read as one series.

export type ShareInput = {
  gameName: string; // "Can You Survive"
  puzzleNumber: number;
  lines: string[]; // game-specific result lines (squares must carry text too)
  url: string; // link to the specific game page
};

export function shareHeader(gameName: string, puzzleNumber: number): string {
  return `${gameName} #${puzzleNumber}`;
}

export function buildShareText({ gameName, puzzleNumber, lines, url }: ShareInput): string {
  return [shareHeader(gameName, puzzleNumber), ...lines, url].filter((l) => l !== '').join('\n');
}

/** Share via the native sheet when available, otherwise copy. Returns what happened. */
export async function shareResult(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (typeof navigator !== 'undefined' && navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
