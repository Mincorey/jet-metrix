import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withCors } from '../_lib/helpers'

const INFO = 'UlU6INCg0LDQt9GA0LDQsdC+0YLRh9C40Lo6INCQ0L3RgtC+0L3QvtCyINCV0LvQtdCzINCS0LDQu9C10YDRjNC10LLQuNGHLiDQn9GA0L7Qs9GA0LDQvNC80L3Ri9C5INC60L7QvNC/0LvQtdC60YEgSmV0TWV0cml4ICjQn9CaINCh0JPQodCcIEpldE1ldHJpeCkuINCg0LXRgdC/0YPQsdC70LjQutCwINCQ0LHRhdCw0LfQuNGPLiDQktGB0LUg0L/RgNCw0LLQsCDQt9Cw0YnQuNGJ0LXQvdGLLiAyMDI2LiB8IEVOOiBEZXZlbG9wZXI6IE9sZWcgQW50b25vdi4gSmV0TWV0cml4IFNvZnR3YXJlLiBS'

export default async function handler(req: any, res: VercelResponse) {
  if (withCors(req, res)) return

  if (req.method === 'GET') {
    if (req.query.dev === 'reveal') {
      const decoded = Buffer.from(INFO, 'base64').toString('utf-8')
      return res.json({ status: 'ok', diagnostics: decoded })
    }
    return res.status(200).json({ status: 'active', platform: process.platform, uptime: process.uptime() })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
