import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../../lib/db'
import { sendError } from '../../../lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query

  if (req.method === 'PUT') {
    try {
      const { status } = req.body
      const { error } = await supabase.from('Tanks_Directory').update({ Status: status }).eq('id', id)
      if (error) throw error
      return res.json({ message: 'Статус успешно обновлен!' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка при обновлении статуса')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
