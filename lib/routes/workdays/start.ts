import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../api/_lib/../_lib/db'
import { sendError } from '../../api/_lib/../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'POST') {
    try {
      const { Date: shiftDate, Name } = req.body
      const { data, error } = await supabase
        .from('Workdays')
        .insert({ Date: shiftDate, Name, Workday_Status: 'Open' })
        .select()
        .single()
      if (error) throw error
      console.log(`✅ Открыта новая смена #${data.id} для ${Name}`)
      return res.json({ id: data.id, Date: shiftDate, Name })
    } catch (error) {
      console.error('Error starting workday:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
