import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/db.js'
import { sendError } from '../_lib/helpers.js'
import { sendTelegramNotification } from '../_lib/telegram.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('Trains').select('*').order('id', { ascending: false })
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
        .from('Trains')
        .insert({
          Workday_ID: d.Workday_ID, Date: d.Date, Name: d.Name, Number: d.Number, Type: d.Type,
          Level_1: d.Level_1, Level_2: d.Level_2, Level_3: d.Level_3,
          Average_Level: d.Average_Level, Density: d.Density,
          Temperature: d.Temperature, Volume: d.Volume, Mass: d.Mass,
          Density_20: d.Density_20, Timestamp: Date.now(),
        })
        .select().single()
      if (error) throw error

      const rawD20 = d.Density_20 != null ? Number(d.Density_20) : null;
      const formattedDensity20 = rawD20 != null
        ? (rawD20 > 2 ? (rawD20 / 1000).toFixed(4) : rawD20.toFixed(4)) + ' г/см³'
        : 'н/д';

      await sendTelegramNotification(
        `🚂 <b>Замер ЖД-цистерны</b>\nНомер вагона: ${d.Number}\nТип вагона: ${d.Type}\nУровень: ${d.Average_Level} мм\nОбъем: ${Math.round(d.Volume || 0)} л. (${Math.round(d.Mass || 0)} кг)\nПлотность: ${d.Density} г/см. куб.\nТемпература: ${d.Temperature != null ? d.Temperature + ' °C' : 'н/д'}\nПлотность при 20: ${formattedDensity20}\nИсполнитель: ${d.Name}`
      )
      return res.json({ id: data.id, message: 'Вагон успешно сохранен!' })
    } catch (error) {
      console.error('Error saving train:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}


