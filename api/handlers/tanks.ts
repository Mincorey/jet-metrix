import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/db'
import { sendError } from '../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('Tanks_Directory').select('*')
        .order('Status').order('Name')
      if (error) throw error
      return res.json(data)
    } catch (error) {
      return sendError(res, 500, 'Ошибка получения справочника резервуаров')
    }
  }

  if (req.method === 'POST') {
    try {
      const { Name, Calibration, Category } = req.body
      const { data, error } = await supabase
        .from('Tanks_Directory')
        .insert({ Name, Calibration: JSON.stringify(Calibration), Status: 'active', Category: Category || 'tank' })
        .select().single()
      if (error) {
        if (error.code === '23505') return sendError(res, 400, 'Резервуар с таким именем уже существует')
        throw error
      }
      return res.json({ id: data.id, message: 'Резервуар успешно добавлен!' })
    } catch (error) {
      console.error('Error adding tank:', error)
      return sendError(res, 500, 'Ошибка при добавлении резервуара к справочнику')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}


