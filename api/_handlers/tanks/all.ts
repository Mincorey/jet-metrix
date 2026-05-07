import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_lib/db.js'
import { sendError } from '../../_lib/helpers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase.from('Tanks_Directory').delete().neq('id', 0)
      if (error) throw error
      return res.json({ message: 'Справочник резервуаров очищен' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка при очистке справочника')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}


