import { GameError, resultFor } from '../../lib/game.js'
import { route, tokenFrom } from '../../lib/http.js'
import { getStore } from '../../lib/store.js'
import type { Run } from '../../lib/game.js'

/** Final score, share text and every reveal. */
export default route('GET', async (req, _res, date) => {
  const token = tokenFrom(req)
  const run = token ? await getStore().getJson<Run>(`run:${date}:${token}`) : null
  if (!run) throw new GameError(404, 'No run for today.')
  return resultFor(run)
})
