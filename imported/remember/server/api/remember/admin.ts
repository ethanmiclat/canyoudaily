import { GameError } from '../../lib/game.js'
import { queryString, route } from '../../lib/http.js'
import { getStore } from '../../lib/store.js'
import { PUZZLES } from '../../puzzles/registry.js'

/** Score exports for scripts/calibrate.ts. Needs `Authorization: Bearer $ADMIN_TOKEN`. */
export default route('GET', async (req) => {
  const token = process.env.ADMIN_TOKEN
  if (!token || req.headers.authorization !== `Bearer ${token}`) throw new GameError(401, 'Unauthorized')
  if (queryString(req, 'kind') !== 'scores') throw new GameError(400, 'kind=scores')
  const store = getStore()
  const scores: Record<string, unknown[]> = {}
  for (const p of PUZZLES) scores[p.manifest.id] = await store.list(`scores:${p.manifest.id}`)
  return { scores }
})
