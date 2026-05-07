import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../db'
import { sendError } from '../helpers'
import { sendTelegramNotification } from '../telegram'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('Daily_Measurements').select('*').order('id', { ascending: false })
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
        .from('Daily_Measurements')
        .insert({
          Workday_ID: d.Workday_ID, Date: d.Date, Name: d.Name,
          Tank_Name: d.Tank_Name, Level_1: d.Level_1, Level_2: d.Level_2,
          Level_3: d.Level_3, Average_Level: d.Average_Level,
          Density: d.Density, Temperature: d.Temperature,
          Volume: d.Volume, Mass: d.Mass,
        })
        .select().single()
      if (error) throw error

      await sendTelegramNotification(
        `📏 <b>Замер резервуара (РГС)</b>\nРезервуар: ${d.Tank_Name}\nУровень средний: ${d.Average_Level} мм\nОбъем: ${d.Volume} л. (${d.Mass} кг)\nПлотность: ${d.Density} г/см. куб.\nИсполнитель: ${d.Name}`
      )
      return res.json({ id: data.id, message: 'Замер успешно сохранен!' })
    } catch (error) {
      console.error('Error saving daily measurement:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
