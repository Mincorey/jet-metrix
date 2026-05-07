import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/db'
import { sendError } from '../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('Employees').select('*').order('id')
      if (error) throw error
      return res.json(data)
    } catch (error) {
      console.error('Error fetching employees:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  if (req.method === 'POST') {
    try {
      const { Name, Role, Password } = req.body
      const dateStr = new Date().toLocaleDateString('ru-RU')
      const { data, error } = await supabase
        .from('Employees')
        .insert({ Date: dateStr, Name, Role, Status: 'Active', Password: Password || '' })
        .select()
        .single()
      if (error) throw error
      return res.json({ id: data.id, message: 'Сотрудник успешно добавлен!' })
    } catch (error) {
      console.error('Error creating employee:', error)
      return sendError(res, 500, 'Ошибка при сохранении в БД')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
