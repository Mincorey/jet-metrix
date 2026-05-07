import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../lib/_lib/db'
import { sendError } from '../lib/_lib/helpers'
import { sendTelegramNotification } from '../lib/_lib/telegram'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('Fuel_Dispensing_TZA').select('*').order('id', { ascending: false })
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
        `🚚 <b>Выдача в ТЗА</b>\nТЗА: ${d.TZA}\nИз резервуара: ${d.Tank_Name}\nОбъем: ${d.Volume} л. (${d.Mass} кг)\nПлотность: ${d.Density} г/см. куб.\nИсполнитель: ${d.Name}`
      )
      return res.json({ id: data.id, message: 'Выдача в ТЗА успешно сохранена!' })
    } catch (error) {
      console.error('Error saving TZA dispensing:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}


