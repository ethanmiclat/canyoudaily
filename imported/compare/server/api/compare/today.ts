import { publicToday } from '../../lib/game.js'
import { route } from '../../lib/http.js'

/** Puzzle number, date, number of pairs and time limit. No pair data. */
export default route('GET', async (_req, _res, date) => publicToday(date))
