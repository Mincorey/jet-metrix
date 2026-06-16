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
  const { workdayId, limit } = req.query
  const limitVal = limit ? parseInt(limit as string) : 1

  if (req.method === 'GET') {
    try {
      const results = await Promise.all(
        OPERATION_TABLES.map(({ table, type }) => {
          return supabase
            .from(table)
            .select('*')
            .eq('Workday_ID', workdayId)
            .order('id', { ascending: false })
            .limit(limitVal)
            .then(({ data, error }) => {
              if (error) {
                console.error(`Error querying ${table}:`, error.message);
                return [];
              }
              return (data || []).map(op => ({ ...op, operationType: type }));
            });
        })
      )

      const parseDate = (dateStr: string) => {
        if (!dateStr) return 0;
        const parts = dateStr.split(' ');
        if (parts.length !== 2) {
          const dParts = dateStr.split('.');
          if (dParts.length === 3) {
            return new Date(Number(dParts[2]), Number(dParts[1]) - 1, Number(dParts[0])).getTime();
          }
          return 0;
        }
        const [d, m, y] = parts[0].split('.');
        const [hr, min] = parts[1].split(':');
        return new Date(Number(y), Number(m)-1, Number(d), Number(hr), Number(min)).getTime();
      }

      const allOps = results.flat();
      allOps.sort((a, b) => {
        const timeA = a.Timestamp || parseDate(a.Date) || a.id;
        const timeB = b.Timestamp || parseDate(b.Date) || b.id;
        return timeB - timeA;
      });

      if (limitVal === 1) {
        return res.json(allOps[0] || { error: 'Операции не найдены' });
      }

      return res.json(allOps.slice(0, limitVal));
    } catch (error) {
      console.error('operations/last error:', error)
      return sendError(res, 500, 'Ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
