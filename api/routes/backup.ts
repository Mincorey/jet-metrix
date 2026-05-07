import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../__lib/db'
import { sendError } from '../__lib/helpers'

const TABLES = [
  'Employees', 'Workdays', 'Fuel_Reception', 'Fuel_Reception_Auto',
  'Fuel_Dispensing_TZA', 'Fuel_Dispensing_VS', 'Trains', 'Daily_Measurements',
  'Monthly_Inventory', 'Tanks_Directory', 'TZA_Directory', 'Tech_Lines',
  'Settings', 'In_warehouse',
]

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const backup: Record<string, any[]> = {}
      for (const table of TABLES) {
        const { data } = await supabase.from(table).select('*').order('id' as any)
        backup[table] = data || []
      }

      const dateStr = new Date().toISOString().split('T')[0]
      res.setHeader('Content-Disposition', `attachment; filename="jetmetrix_backup_${dateStr}.json"`)
      res.setHeader('Content-Type', 'application/json')
      return res.send(JSON.stringify(backup, null, 2))
    } catch (error) {
      console.error('Backup error:', error)
      return sendError(res, 500, 'Ошибка при создании бэкапа')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
