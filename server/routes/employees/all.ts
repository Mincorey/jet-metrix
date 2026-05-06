import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../lib/db'
import { sendError } from '../../lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase.from('Employees').delete().neq('id', 0)
      if (error) throw error
      return res.json({ message: 'База сотрудников очищена' })
    } catch (error) {
      console.error('Error clearing employees:', error)
      return sendError(res, 500, 'Ошибка при очистке сотрудников')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
