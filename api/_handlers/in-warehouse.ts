import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/db.js'
import { sendError } from '../_lib/helpers.js'
import { sendTelegramNotification } from '../_lib/telegram.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      let query = supabase.from('In_warehouse').select('*')
      const datesParam = req.query.dates as string
      if (datesParam) {
        const dates = datesParam.split(',').filter(Boolean)
        if (dates.length > 0) {
          const filterStr = dates.map(d => `Date.like.${d}%`).join(',')
          query = query.or(filterStr)
        }
      }
      const { data, error } = await query.order('id', { ascending: false })
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
        `🔄 <b>Внутрискладская перекачка</b>\nИз: ${From_Tank}\nВ: ${To_Tank}\nОбъем: ${Math.round(Volume || 0)} л. (${Math.round(Mass || 0)} кг)\nИсполнитель: ${Name}`
      )
      return res.json({ success: true, id: data.id })
    } catch (error) {
      console.error('In-warehouse transfer error:', error)
      return sendError(res, 500, 'Ошибка при сохранении перекачки')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}


