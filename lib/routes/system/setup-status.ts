import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../api/_lib/../_lib/db'
import { sendError } from '../../api/_lib/../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { count, error } = await supabase
        .from('Employees').select('*', { count: 'exact', head: true })
      if (error) throw error
      return res.json({ isConfigured: (count ?? 0) > 0 })
    } catch (error) {
      return sendError(res, 500, 'Ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
