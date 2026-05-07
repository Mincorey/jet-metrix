import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../db'
import { sendError } from '../helpers'
import { sendTelegramNotification } from '../telegram'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('Fuel_Reception_Auto').select('*').order('id', { ascending: false })
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
        .from('Fuel_Reception_Auto')
        .insert({
          Date: d.Date, Name: d.Name, Gos_Number: d.Gos_Number,
          Tank_Name: d.Tank_Name, Counter_Before: d.Counter_Before,
          Counter_After: d.Counter_After, Density: d.Density,
          Temperature: d.Temperature, Volume: d.Volume, Mass: d.Mass,
          Timestamp: Date.now(),
        })
        .select().single()
      if (error) throw error

      await sendTelegramNotification(
        `🚛 <b>Прием из АЦ</b>\nГос. номер: ${d.Gos_Number}\nРезервуар: ${d.Tank_Name}\nОбъем: ${d.Volume} л. (${d.Mass} кг)\nИсполнитель: ${d.Name}`
      )
      return res.json({ id: data.id, message: 'Прием топлива из АЦ успешно сохранен!' })
    } catch (error) {
      console.error('Error saving auto fuel reception:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
