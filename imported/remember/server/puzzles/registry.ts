/**
 * The puzzle registry: one line per type. The order here is the build order from plan section 5.1.
 * A new type starts with `enabled: false` in its manifest and passes `npm run puzzle:check -- <id>` before it is
 * switched on. The client finds Play components by folder name, so this file is the only one to edit.
 */
import type { Manifest, PuzzleModule } from './types.js'
import { paced } from './pacing.js'
import sequence from './sequence/index.js'
import grid from './grid/index.js'
import missing from './missing/index.js'
import pairs from './pairs/index.js'
import spot from './spot/index.js'
import orderup from './orderup/index.js'
import cipher from './cipher/index.js'
import nametags from './nametags/index.js'
import mines from './mines/index.js'
import shell from './shell/index.js'
import location from './location/index.js'
import oddback from './oddback/index.js'
import reorder from './reorder/index.js'
import constellation from './constellation/index.js'
import colormatch from './colormatch/index.js'
import numberspan from './numberspan/index.js'
import echo from './echo/index.js'
import nback from './nback/index.js'
import pixel from './pixel/index.js'
import room from './room/index.js'
import seating from './seating/index.js'
import jigsaw from './jigsaw/index.js'
import dots from './dots/index.js'
import trail from './trail/index.js'
import laser from './laser/index.js'
import witness from './witness/index.js'
import face from './face/index.js'
import cube from './cube/index.js'
import scene from './scene/index.js'

export const PUZZLES: PuzzleModule[] = [
  sequence, grid, missing, pairs, spot,
  orderup, cipher, nametags, mines, shell,
  location, oddback, reorder, constellation, colormatch, numberspan,
  // Medium and feature types, in debut order (plan section 5.1, step 4).
  echo, pixel, dots, trail, witness, seating, laser, room, jigsaw, nback,
  face, cube, scene,
].map(paced)

export const MANIFESTS: Manifest[] = PUZZLES.map((p) => p.manifest)

const byId = new Map(PUZZLES.map((p) => [p.manifest.id, p]))
export const getPuzzle = (id: string): PuzzleModule | undefined => byId.get(id)
