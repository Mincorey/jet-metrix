import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../api/_lib/db'
import { sendError } from '../../api/_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('Daily_Measurements').select('*').order('id', { ascending: false })
      if (error) throw error

      const latestByTank: Record<string, any> = {}
      for (const row of (data || [])) {
        if (!latestByTank[row.Tank_Name]) {
          latestByTank[row.Tank_Name] = row
        }
      }

      const result = Object.values(latestByTank).sort((a: any, b: any) =>
        a.Tank_Name.localeCompare(b.Tank_Name)
      )
      return res.json(result)
    } catch (error) {
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
