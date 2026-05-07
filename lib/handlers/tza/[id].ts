import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_lib/db'
import { sendError } from '../../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query

  if (req.method === 'PUT') {
    try {
      const { Name, Volume } = req.body
      const { error } = await supabase.from('TZA_Directory').update({ Name, Volume }).eq('id', id)
      if (error) {
        if (error.code === '23505') return sendError(res, 400, 'ТЗА с таким именем уже существует')
        throw error
      }
      return res.json({ message: 'Данные ТЗА успешно обновлены!' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка при обновлении ТЗА')
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase.from('TZA_Directory').delete().eq('id', id)
      if (error) throw error
      return res.json({ message: 'ТЗА удален' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка при удалении ТЗА')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
