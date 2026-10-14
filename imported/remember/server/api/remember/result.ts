import { result } from '../../lib/game.js'
import { route, tokenFrom } from '../../lib/http.js'

/** Final score, per-trial squares, share text and the review of every sub-trial. Only after the run is finished. */
export default route('GET', async (req, _res, day) => result(tokenFrom(req), day))
