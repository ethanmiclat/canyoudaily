// Pixel sprites copied from Can You Survive (web/src/components/PixelIcon.tsx) so the card draws them the same way.
const sprites = {
  skull: ['000111111110000', '001111111111000', '011111111111100', '011001110011100', '011001110011100', '011111011111100', '001110001110000', '000111111100000', '000101010100000'],
  heart: ['000111000111000', '001111101111100', '001111111111100', '001111111111100', '000111111111000', '000011111110000', '000001111100000', '000000111000000', '000000010000000'],
} as const;

export function Sprite({ name, size, className }: { name: keyof typeof sprites; size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true" className={className}>
      {sprites[name].flatMap((row, y) =>
        [...row].map((px, x) => (px === '1' ? <rect key={`${x}-${y}`} x={x} y={y + 3} width="1" height="1" /> : null)),
      )}
    </svg>
  );
}
