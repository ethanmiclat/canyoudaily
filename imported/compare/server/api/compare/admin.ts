import crypto from 'node:crypto'
import { GameError } from '../../lib/game.js'
import { queryString, route } from '../../lib/http.js'
import { getStore } from '../../lib/store.js'

/** Exports for review.py and calibrate.py. Needs the ADMIN_TOKEN env var, sent as x-admin-token. */
export default route('GET', async (req) => {
  const expected = process.env.ADMIN_TOKEN
  const given = req.headers['x-admin-token']
  if (!expected || typeof given !== 'string' || given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    throw new GameError(403, 'Forbidden.')
  }
  const store = getStore()
  const what = queryString(req, 'what')
  if (what === 'reports') return { items: await store.list('reports') }
  if (what === 'log') {
    const dates = (queryString(req, 'dates') ?? '').split(',').filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 400)
    const items = []
    for (const d of dates) items.push(...(await store.list(`log:${d}`)))
    return { items }
  }
  throw new GameError(400, 'what must be reports or log')
})
