import { submitTrial } from '../../../lib/game.js'
import { body, limitIp, route, tokenFrom } from '../../../lib/http.js'

/** `{ index, answer }`. Scored on the server against the key; late answers count as a timeout. Returns the key. */
export default route('POST', async (req, _res, day) => {
  await limitIp(req, 'trial', 120)
  const b = body(req)
  return submitTrial(tokenFrom(req), day, Number(b.index), b.answer ?? null)
})
