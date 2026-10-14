import { reportPair, withRun } from '../../lib/game.js'
import { body, limitIp, route, tokenFrom } from '../../lib/http.js'

/** Flag a played pair as wrong or unclear. Logged for review (scripts/review.py reports). */
export default route('POST', async (req, _res, date) => {
  await limitIp(req, 'report', 10)
  const b = body(req)
  return withRun(tokenFrom(req), date, (run) => reportPair(run, b.pairId, b.reason, b.note))
})
