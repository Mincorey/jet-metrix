import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_lib/db.js'
import { sendError } from '../../_lib/helpers.js'

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
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed')
  }

  const { dates: datesParam } = req.query
  const dates = String(datesParam || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (dates.length === 0) {
    return res.json([])
  }

  try {
    const filterStr = dates.map(d => `Date.like.${d}%`).join(',')

    const results = await Promise.all(
      OPERATION_TABLES.map(({ table, type }) => {
        let query = supabase.from(table).select('*')
        if (filterStr) {
          query = query.or(filterStr)
        }

        return query.then(({ data, error }) => {
          if (error) {
            console.error(`Error querying ${table} by dates:`, error.message)
            return []
          }
          return (data || []).map(op => ({ ...op, operationType: type }))
        })
      })
    )

    const parseDate = (dateStr: string) => {
      if (!dateStr) return 0
      const parts = dateStr.split(' ')
      if (parts.length !== 2) {
        const dParts = dateStr.split('.')
        if (dParts.length === 3) {
          return new Date(Number(dParts[2]), Number(dParts[1]) - 1, Number(dParts[0])).getTime()
        }
        return 0
      }
      const [d, m, y] = parts[0].split('.')
      const [hr, min] = parts[1].split(':')
      return new Date(Number(y), Number(m) - 1, Number(d), Number(hr), Number(min)).getTime()
    }

    const allOps = results.flat()
    allOps.sort((a, b) => {
      const timeA = a.Timestamp || parseDate(a.Date) || a.id
      const timeB = b.Timestamp || parseDate(b.Date) || b.id
      return timeB - timeA
    })

    return res.json(allOps)
  } catch (error) {
    console.error('Error fetching operations by dates:', error)
    return sendError(res, 500, 'Ошибка получения операций по датам')
  }
}
