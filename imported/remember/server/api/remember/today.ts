import { publicToday, runState } from '../../lib/game.js'
import { route, tokenFrom } from '../../lib/http.js'

/** Puzzle number, today's type, skin, rule and explainer, practice availability and attempt status. No content. */
export default route('GET', async (req, _res, day) => publicToday(day, await runState(tokenFrom(req), day)))
