/**
 * Shared art vocabularies. Legacy Unicode IDs are rendered with our original SVG illustration library,
 * invented names and procedural shapes. Nothing references another company's characters or branding.
 */

export const ITEM_SETS: Record<string, { label: string; items: string[] }> = {
  tray: { label: 'Things on a tray', items: ['🍎', '🔑', '✏️', '🕶️', '⏰', '📎', '🧦', '🎈', '🧸', '🍌', '🔦', '🪴', '📚', '🧲', '🎲', '🧩', '🥄', '📷', '🎧', '⚽', '🪥', '🧤', '🕯️', '🔔'] },
  animals: { label: 'Animals', items: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦉', '🐴', '🦄', '🐝', '🐢', '🐙', '🦀', '🐠', '🐳'] },
  pantry: { label: 'Food', items: ['🍇', '🍉', '🍋', '🍑', '🍒', '🍓', '🥝', '🍅', '🥥', '🥑', '🥕', '🌽', '🥦', '🍄', '🥐', '🥨', '🧀', '🥚', '🥞', '🍔', '🍟', '🍕', '🌮', '🍩', '🍪', '🧁', '🍫', '🍿'] },
  sports: { label: 'Sports kit', items: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '⛳', '🏹', '🎣', '🛹', '⛸️', '🎿', '🥌', '🛼', '🪁', '🏆', '🥇', '🎯', '🪀'] },
  travel: { label: 'Travel', items: ['🚗', '🚕', '🚌', '🚑', '🚒', '🚜', '🚲', '🛴', '🏍️', '🚂', '✈️', '🚀', '🛸', '🚁', '⛵', '🚤', '🛳️', '🗺️', '🧭', '🏕️', '🎡', '🎢', '🗽', '🏰'] },
  bugs: { label: 'Garden', items: ['🐛', '🦋', '🐌', '🐞', '🐜', '🪲', '🦗', '🕷️', '🌸', '🌻', '🌷', '🌹', '🌵', '🍀', '🍁', '🍂', '🌾', '🌲', '🌴', '🪺', '🌙', '⭐', '🌈', '❄️'] },
}

export const SUITS = ['♠', '♥', '♦', '♣'] as const
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
/** Card ids look like "Q♥". */
export const CARDS: string[] = SUITS.flatMap((s) => RANKS.map((r) => `${r}${s}`))

/** Invented, common-sounding first names, short enough for a phone tag. */
export const NAMES = [
  'Ada', 'Ben', 'Cleo', 'Dev', 'Esme', 'Finn', 'Gus', 'Hana', 'Ivo', 'June', 'Kai', 'Lena', 'Milo', 'Nia', 'Otto', 'Pia',
  'Quinn', 'Rosa', 'Sami', 'Tess', 'Uma', 'Vic', 'Wren', 'Yara', 'Zed', 'Bea', 'Cal', 'Dora', 'Eli', 'Flo', 'Hugo', 'Iris',
]

/** Color labels for the Name tags color skin. Each has a name so the label, not the hue, carries the answer. */
export const TAG_COLORS = [
  { name: 'Red', hex: '#d64545' }, { name: 'Orange', hex: '#e8862a' }, { name: 'Yellow', hex: '#e6c229' },
  { name: 'Green', hex: '#3f9a4b' }, { name: 'Teal', hex: '#22998f' }, { name: 'Blue', hex: '#3a6fd8' },
  { name: 'Purple', hex: '#8550c8' }, { name: 'Pink', hex: '#dd5c9e' }, { name: 'Brown', hex: '#8a5a3b' }, { name: 'Grey', hex: '#7c8088' },
]

/**
 * Colors paired with a fill pattern, so a color change is also a pattern change (never color alone).
 * Used by Spot the change and Grid/Sequence skins.
 */
export const SWATCHES = [
  { id: 'red', hex: '#d76571', pattern: 'solid' },
  { id: 'blue', hex: '#638ac2', pattern: 'stripes' },
  { id: 'yellow', hex: '#efc34c', pattern: 'dots' },
  { id: 'green', hex: '#67ad91', pattern: 'ring' },
  { id: 'purple', hex: '#8867d3', pattern: 'cross' },
  { id: 'orange', hex: '#da9850', pattern: 'half' },
] as const

export const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'heart', 'hexagon', 'drop'] as const
export type ShapeId = (typeof SHAPES)[number]

/** Our own glyph set for the Cipher. Rendered as SVG paths in web/src/play/Glyph.tsx. */
export const GLYPHS = ['sun', 'moon', 'wave', 'bolt', 'eye', 'key', 'leaf', 'crown', 'anchor', 'spiral', 'fork', 'tower'] as const
