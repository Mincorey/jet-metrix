import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/db'
import { sendError } from '../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('Tech_Lines').select('*').order('Name')
      if (error) throw error
      return res.json(data)
    } catch (error) {
      return sendError(res, 500, 'Ошибка получения списка Тех. Линий')
    }
  }

  if (req.method === 'POST') {
    try {
      const { Name, Volume } = req.body
      const { data, error } = await supabase
        .from('Tech_Lines').insert({ Name, Volume }).select().single()
      if (error) {
        if (error.code === '23505') return sendError(res, 400, 'Тех. линия с таким именем уже существует')
        throw error
      }
      return res.json({ id: data.id, message: 'Тех. линия успешно добавлена!' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка при добавлении Тех. линии')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
