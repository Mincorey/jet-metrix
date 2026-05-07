import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_lib/db'
import { sendError } from '../../_lib/helpers'
import { sendTelegramNotification } from '../../_lib/telegram'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('In_warehouse').select('*').order('id', { ascending: false })
      if (error) throw error
      return res.json(data)
    } catch (error) {
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  if (req.method === 'POST') {
    try {
      const { Workday_ID, Date: opDate, Name, From_Tank, To_Tank, Counter_Before, Counter_After, Density, Temperature, Volume, Mass } = req.body
      const { data, error } = await supabase
        .from('In_warehouse')
        .insert({ Workday_ID, Date: opDate, Name, From_Tank, To_Tank, Counter_Before, Counter_After, Density, Temperature, Volume, Mass, Timestamp: Date.now() })
        .select().single()
      if (error) throw error

      await sendTelegramNotification(
        `🔄 <b>Внутрискладская перекачка</b>\nИз: ${From_Tank}\nВ: ${To_Tank}\nОбъем: ${Volume} л. (${Mass} кг)\nИсполнитель: ${Name}`
      )
      return res.json({ success: true, id: data.id })
    } catch (error) {
      console.error('In-warehouse transfer error:', error)
      return sendError(res, 500, 'Ошибка при сохранении перекачки')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
