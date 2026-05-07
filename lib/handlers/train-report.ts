import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/db'
import { sendError } from '../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { startDate, endDate } = req.query
      let query = supabase.from('Trains').select('*').order('id', { ascending: false })

      if (startDate && endDate) {
        query = query.gte('Date', `${startDate} 00:00:00`).lte('Date', `${endDate} 23:59:59`)
      }

      const { data, error } = await query
      if (error) throw error
      return res.json(data)
    } catch (error) {
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
