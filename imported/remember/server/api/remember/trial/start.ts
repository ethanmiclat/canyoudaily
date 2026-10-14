import { startTrial } from '../../../lib/game.js'
import { body, limitIp, route, tokenFrom } from '../../../lib/http.js'

/** `{ index }`. Serves the study and test payloads of the next sub-trial (no answer key) and starts its clock. */
export default route('POST', async (req, _res, day) => {
  await limitIp(req, 'trial', 120)
  return startTrial(tokenFrom(req), day, Number(body(req).index))
})
