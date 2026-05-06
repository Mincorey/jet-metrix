import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../lib/db'
import { sendError } from '../lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('Monthly_Inventory').select('*').order('id', { ascending: false })
      if (error) throw error
      const formatted = (data || []).map((r: any) => ({
        ...r,
        Details: JSON.parse(r.Details || '[]'),
      }))
      return res.json(formatted)
    } catch (error) {
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  if (req.method === 'POST') {
    try {
      const d = req.body
      const { data, error } = await supabase
        .from('Monthly_Inventory')
        .insert({
          Date: d.Date, Name: d.Name,
          Total_Volume: d.Total_Volume, Total_Mass: d.Total_Mass,
          Details: JSON.stringify(d.Details || []),
        })
        .select().single()
      if (error) throw error
      return res.json({ id: data.id, message: 'Инвентаризация успешно сохранена!' })
    } catch (error) {
      console.error('Error saving inventory:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
