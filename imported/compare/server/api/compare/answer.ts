import { answerPair, GameError, parseChoice, publicRun, withRun } from '../../lib/game.js'
import { body, limitIp, route, tokenFrom } from '../../lib/http.js'

/** Resolve the live pair: a, b, or none (timeout). Returns right/wrong, both values, the gap and a fun fact. */
export default route('POST', async (req, _res, date) => {
  await limitIp(req, 'answer', 60)
  const b = body(req)
  if (typeof b.index !== 'number') throw new GameError(400, 'Missing index.')
  const choice = parseChoice(b.choice)
  return withRun(tokenFrom(req), date, async (run) => ({ ...(await answerPair(run, b.index as number, choice)), run: publicRun(run) }))
})
