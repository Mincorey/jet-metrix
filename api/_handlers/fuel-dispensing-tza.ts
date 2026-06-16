import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/db.js'
import { sendError } from '../_lib/helpers.js'
import { sendTelegramNotification } from '../_lib/telegram.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      let query = supabase.from('Fuel_Dispensing_TZA').select('*')
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
      const d = req.body
      const { data, error } = await supabase
        .from('Fuel_Dispensing_TZA')
        .insert({
          Workday_ID: d.Workday_ID, Date: d.Date, Name: d.Name,
          TZA: d.TZA, Tank_Name: d.Tank_Name,
          Counter_Before: d.Counter_Before, Counter_After: d.Counter_After,
          Density: d.Density, Volume: d.Volume, Mass: d.Mass,
          Timestamp: Date.now(),
        })
        .select().single()
      if (error) throw error

      const { data: tza } = await supabase
        .from('TZA_Directory')
        .select('Current_Volume')
        .eq('Name', d.TZA)
        .eq('Is_Monitoring', 1)
        .single()
      if (tza) {
        await supabase
          .from('TZA_Directory')
          .update({ Current_Volume: (tza.Current_Volume || 0) + (d.Volume || 0) })
          .eq('Name', d.TZA)
          .eq('Is_Monitoring', 1)
      }

      await sendTelegramNotification(
        `🚚 <b>Выдача в ТЗА</b>\nТЗА: ${d.TZA}\nИз резервуара: ${d.Tank_Name}\nОбъем: ${Math.round(d.Volume || 0)} л. (${Math.round(d.Mass || 0)} кг)\nПлотность: ${d.Density} г/см. куб.\nИсполнитель: ${d.Name}`
      )
      return res.json({ id: data.id, message: 'Выдача в ТЗА успешно сохранена!' })
    } catch (error) {
      console.error('Error saving TZA dispensing:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}


