import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../api/_lib/db'
import { sendError } from '../../api/_lib/helpers'

const OPERATION_TABLES = [
  { table: 'Fuel_Reception', type: 'reception' },
  { table: 'Fuel_Reception_Auto', type: 'reception_auto' },
  { table: 'Fuel_Dispensing_TZA', type: 'dispense_tza' },
  { table: 'Fuel_Dispensing_VS', type: 'dispense_vs' },
  { table: 'Daily_Measurements', type: 'measurement' },
  { table: 'Trains', type: 'train' },
  { table: 'In_warehouse', type: 'in_warehouse' },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { workdayId } = req.query

  if (req.method === 'GET') {
    try {
      const results = await Promise.all(
        OPERATION_TABLES.map(({ table, type }) =>
          supabase.from(table).select('*').eq('Workday_ID', workdayId)
            .order('Timestamp', { ascending: false }).order('id', { ascending: false })
            .limit(1)
            .then(({ data }) => data?.[0] ? { ...data[0], operationType: type } : null)
        )
      )

      let latestOp: any = null
      for (const op of results) {
        if (!op) continue
        if (!latestOp) { latestOp = op; continue }
        if ((op.Timestamp && op.Timestamp > latestOp.Timestamp) || (!latestOp.Timestamp && op.id > latestOp.id)) {
          latestOp = op
        }
      }

      return res.json(latestOp || { error: 'Операции не найдены' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
