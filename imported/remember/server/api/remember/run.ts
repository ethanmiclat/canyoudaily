import { publicRun, publicToday, runState, startOrResume } from '../../lib/game.js'
import { limitIp, route, setTokenCookie, tokenFrom } from '../../lib/http.js'

/** Start or resume today's run. One real attempt per token per day; a refresh resumes it with the clock running. */
export default route('POST', async (req, res, day) => {
  await limitIp(req, 'run', 30)
  await runState(tokenFrom(req), day) // closes a round whose clock ran out while the player was away
  const { token, run } = await startOrResume(tokenFrom(req), day)
  setTokenCookie(req, res, token)
  return { token, today: publicToday(day, run), run: publicRun(run) }
})
