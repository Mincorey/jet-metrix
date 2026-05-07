import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_lib/db.ts'
import { sendError } from '../../_lib/helpers.ts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query

  if (req.method === 'PUT') {
    try {
      const { Name, Volume } = req.body
      const { error } = await supabase.from('Tech_Lines').update({ Name, Volume }).eq('id', id)
      if (error) {
        if (error.code === '23505') return sendError(res, 400, 'Тех. линия с таким именем уже существует')
        throw error
      }
      return res.json({ message: 'Данные Тех. линии успешно обновлены!' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка при обновлении Тех. линии')
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase.from('Tech_Lines').delete().eq('id', id)
      if (error) throw error
      return res.json({ message: 'Тех. линия удалена' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка при удалении Тех. линии')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
