import { publicRun, publicToday, startOrResume } from '../../lib/game.js'
import { limitIp, route, setTokenCookie, tokenFrom } from '../../lib/http.js'

/** Start or resume today's run. One run per token per day; refreshing resumes it and the live pair's clock keeps running. */
export default route('POST', async (req, res, date) => {
  await limitIp(req, 'run', 30)
  const { token, run } = await startOrResume(tokenFrom(req), date)
  setTokenCookie(req, res, token)
  return { token, today: publicToday(date), run: publicRun(run) }
})
