import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../../_lib/_lib/db'
import { sendError } from '../../../_lib/_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase.rpc('clear_operations')
      if (error) throw error
      return res.json({ success: true, message: 'Операционные базы данных успешно очищены' })
    } catch (error) {
      console.error('Error clearing operations DB:', error)
      return sendError(res, 500, 'Ошибка при очистке БД')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
