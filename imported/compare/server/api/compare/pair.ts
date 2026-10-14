import { GameError, servePair, withRun } from '../../lib/game.js'
import { limitIp, queryString, route, tokenFrom } from '../../lib/http.js'

/** Serve pair n (question, names, ids, side order) and start its clock. Only the next unanswered pair. */
export default route('GET', async (req, _res, date) => {
  await limitIp(req, 'pair', 60)
  const index = Number(queryString(req, 'index'))
  if (!Number.isInteger(index) || index < 0) throw new GameError(400, 'Bad index.')
  return withRun(tokenFrom(req), date, (run) => servePair(run, index))
})
