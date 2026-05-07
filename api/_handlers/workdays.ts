import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/db.js'
import { sendError } from '../_lib/helpers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('Workdays').select('*').order('id', { ascending: false })
      if (error) throw error
      return res.json(data)
    } catch (error) {
      console.error('Error fetching workdays:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}


