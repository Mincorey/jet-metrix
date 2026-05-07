import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_lib/db'
import { sendError } from '../../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query

  if (req.method === 'PUT') {
    try {
      const { Name, Password } = req.body
      const { error } = await supabase
        .from('Employees')
        .update({ Name, Password: Password || '' })
        .eq('id', id)
      if (error) throw error
      return res.json({ message: 'Данные сотрудника успешно обновлены!' })
    } catch (error) {
      console.error('Error updating employee:', error)
      return sendError(res, 500, 'Ошибка при обновлении сотрудника')
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase.from('Employees').delete().eq('id', id)
      if (error) throw error
      return res.json({ message: 'Сотрудник успешно удален' })
    } catch (error) {
      console.error('Error deleting employee:', error)
      return sendError(res, 500, 'Ошибка при удалении сотрудника')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
