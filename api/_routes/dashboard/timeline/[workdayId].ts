import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../../_lib/db'
import { sendError } from '../../../_lib/helpers'

function extractTime(dateStr: string | null): string {
  if (!dateStr) return '12:00'
  const m = String(dateStr).match(/([0-9]{2}:[0-9]{2})/)
  return m ? m[1] : '12:00'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { workdayId } = req.query

  if (req.method === 'GET') {
    try {
      const { data: workday } = await supabase
        .from('Workdays').select('Date').eq('id', workdayId).single()
      if (!workday?.Date) return res.json([])

      const datePrefix = String(workday.Date).substring(0, 10)
      const pattern = `${datePrefix}%`

      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        supabase.from('Fuel_Reception').select('*').like('Date', pattern),
        supabase.from('Fuel_Reception_Auto').select('*').like('Date', pattern),
        supabase.from('Fuel_Dispensing_TZA').select('*').like('Date', pattern),
        supabase.from('Fuel_Dispensing_VS').select('*').like('Date', pattern),
        supabase.from('Daily_Measurements').select('*').like('Date', pattern),
        supabase.from('Trains').select('*').like('Date', pattern),
      ])

      const sources = [
        { rows: r1.data, type: 'reception', title: 'Внутренний прием', detailsFn: (r: any) => `${r.Tank_Name} • ${r.Mass} кг` },
        { rows: r2.data, type: 'reception', title: 'Прием из АЦ', detailsFn: (r: any) => `АЦ ${r.Gos_Number} • ${r.Mass} кг` },
        { rows: r3.data, type: 'tza', title: 'Заправка ТЗА', detailsFn: (r: any) => `${r.TZA} • ${r.Mass} кг` },
        { rows: r4.data, type: 'vs', title: 'Выдача в ВС', detailsFn: (r: any) => `ТЗА ${r.TZA} • ${r.Mass} кг` },
        { rows: r5.data, type: 'measurement', title: 'Замер РГС', detailsFn: (r: any) => `${r.Tank_Name} • ${r.Mass} кг` },
        { rows: r6.data, type: 'reception', title: 'Приход вагона', detailsFn: (r: any) => `№${r.Number} • ${r.Mass} кг` },
      ]

      let idCounter = 0
      const items: any[] = []
      for (const src of sources) {
        for (const r of (src.rows || [])) {
          items.push({
            id: ++idCounter,
            time: extractTime(r.Date),
            type: src.type,
            title: src.title,
            details: src.detailsFn(r),
          })
        }
      }

      items.sort((a, b) => a.time.localeCompare(b.time))
      return res.json(items)
    } catch (error) {
      console.error('Timeline error:', error)
      return res.json([])
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
