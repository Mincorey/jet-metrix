import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../../_lib/db.js'
import { sendError } from '../../../_lib/helpers.js'

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
        OPERATION_TABLES.map(({ table, type }) => {
          return supabase
            .from(table)
            .select('*')
            .eq('Workday_ID', workdayId)
            .order('id', { ascending: false })
            .limit(1)
            .then(({ data, error }) => {
              if (error) {
                console.error(`Error querying ${table}:`, error.message);
                return null;
              }
              const op = data?.[0];
              return op ? { ...op, operationType: type } : null;
            });
        })
      )

      const parseDate = (dateStr: string) => {
        if (!dateStr) return 0;
        // 13.05.2026 11:52
        const parts = dateStr.split(' ');
        if (parts.length !== 2) return 0;
        const [d, m, y] = parts[0].split('.');
        const [hr, min] = parts[1].split(':');
        return new Date(Number(y), Number(m)-1, Number(d), Number(hr), Number(min)).getTime();
      }

      let latestOp: any = null
      for (const op of results) {
        if (!op) continue
        if (!latestOp) { latestOp = op; continue }
        
        const opTime = op.Timestamp || parseDate(op.Date) || op.id;
        const latestTime = latestOp.Timestamp || parseDate(latestOp.Date) || latestOp.id;

        if (opTime > latestTime) {
          latestOp = op
        }
      }

      return res.json(latestOp || { error: 'Операции не найдены' })
    } catch (error) {
      console.error('operations/last error:', error)
      return sendError(res, 500, 'Ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
