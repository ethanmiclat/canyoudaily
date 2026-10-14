import { practice } from '../../lib/game.js'
import { body, limitIp, route, tokenFrom } from '../../lib/http.js'

/**
 * `{ skip?: boolean }`. Returns a practice instance (a fresh random seed, easier and shorter, unscored) and marks
 * practice used, or marks it skipped. Either way it is gone for the day.
 */
export default route('POST', async (req, _res, day) => {
  await limitIp(req, 'practice', 20)
  return practice(tokenFrom(req), day, body(req).skip === true)
})
