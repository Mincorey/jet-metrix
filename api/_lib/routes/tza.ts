import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../db'
import { sendError } from '../helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('TZA_Directory').select('*').order('Name')
      if (error) throw error
      return res.json(data)
    } catch (error) {
      return sendError(res, 500, 'Ошибка получения списка ТЗА')
    }
  }

  if (req.method === 'POST') {
    try {
      const { Name, Volume } = req.body
      const { data, error } = await supabase
        .from('TZA_Directory').insert({ Name, Volume }).select().single()
      if (error) {
        if (error.code === '23505') return sendError(res, 400, 'ТЗА с таким именем уже существует')
        throw error
      }
      return res.json({ id: data.id, message: 'ТЗА успешно добавлен!' })
    } catch (error) {
      console.error('Error adding TZA:', error)
      return sendError(res, 500, 'Ошибка при добавлении ТЗА')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
