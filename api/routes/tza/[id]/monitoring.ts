import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../../_lib/db'
import { sendError } from '../../../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query

  if (req.method === 'PUT') {
    try {
      const { isMonitoring } = req.body
      const { data: tza } = await supabase.from('TZA_Directory').select('Volume').eq('id', id).single()
      const { error } = await supabase
        .from('TZA_Directory')
        .update({ Is_Monitoring: isMonitoring ? 1 : 0, Current_Volume: tza?.Volume ?? 0 })
        .eq('id', id)
      if (error) throw error
      return res.json({ message: 'Статус мониторинга обновлен!' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка при обновлении мониторинга ТЗА')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
