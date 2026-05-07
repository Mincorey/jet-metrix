import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../api/_lib/../_lib/db'
import { sendError } from '../../api/_lib/../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'POST') {
    try {
      const { login, password } = req.body
      const { count } = await supabase
        .from('Employees').select('*', { count: 'exact', head: true })
      if ((count ?? 0) > 0) return res.status(403).json({ error: 'Система уже настроена' })

      const dateStr = new Date().toLocaleDateString('ru-RU')
      const { error } = await supabase
        .from('Employees')
        .insert({ Date: dateStr, Name: login, Role: 'Администратор', Status: 'Active', Password: password })
      if (error) throw error

      console.log(`🚀 JetMetrix инициализирован. Первый администратор: ${login}`)
      return res.json({ success: true, message: 'Администратор успешно создан!' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
