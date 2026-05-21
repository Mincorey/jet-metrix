import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_lib/db.js'
import { sendError } from '../../_lib/helpers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      const { id } = req.body
      const { error } = await supabase
        .from('Workdays')
        .update({ Workday_Status: 'Deleted' })
        .eq('id', id)
      if (error) throw error
      console.log(`🗑️ Смена #${id} помечена как удалённая.`)
      return res.json({ message: 'Смена успешно удалена' })
    } catch (error) {
      console.error('Error deleting workday:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }
  return sendError(res, 405, 'Method not allowed')
}
