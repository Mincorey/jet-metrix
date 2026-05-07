import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/db.js'
import { sendError } from '../_lib/helpers.js'
import { sendTelegramNotification } from '../_lib/telegram.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('Fuel_Reception').select('*').order('id', { ascending: false })
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
        .from('Fuel_Reception')
        .insert({
          Workday_ID: d.Workday_ID, Date: d.Date, Name: d.Name,
          Tank_Name: d.Tank_Name, Counter_Before: d.Counter_Before,
          Counter_After: d.Counter_After, Density: d.Density,
          Volume: d.Volume, Mass: d.Mass, Timestamp: Date.now(),
        })
        .select().single()
      if (error) throw error

      await sendTelegramNotification(
        `📥 <b>Прием топлива</b>\nРезервуар: ${d.Tank_Name}\nОбъем: ${d.Volume} л. (${d.Mass} кг)\nПлотность: ${d.Density} г/см. куб.\nИсполнитель: ${d.Name}`
      )
      return res.json({ id: data.id, message: 'Прием топлива успешно сохранен!' })
    } catch (error) {
      console.error('Error saving fuel reception:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}


