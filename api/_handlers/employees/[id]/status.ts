import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../../_lib/db.js'
import { sendError } from '../../../_lib/helpers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query

  if (req.method === 'PUT') {
    try {
      const { status } = req.body
      const archiveDate = status === 'Archived' ? new Date().toLocaleDateString('ru-RU') : ''
      const { error } = await supabase
        .from('Employees')
        .update({ Status: status, Archive_Date: archiveDate })
        .eq('id', id)
      if (error) throw error
      return res.json({ message: 'Статус успешно обновлен!' })
    } catch (error) {
      console.error('Error updating employee status:', error)
      return sendError(res, 500, 'Ошибка при обновлении статуса')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
