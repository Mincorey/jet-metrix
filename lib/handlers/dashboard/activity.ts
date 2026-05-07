import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../../_lib/db'
import { sendError } from '../../../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const LIMIT = 10
      const [rec, recAuto, tza, vs] = await Promise.all([
        supabase.from('Fuel_Reception').select('Name, Tank_Name, Mass, Timestamp').order('id', { ascending: false }).limit(LIMIT),
        supabase.from('Fuel_Reception_Auto').select('Name, Tank_Name, Mass, Timestamp').order('id', { ascending: false }).limit(LIMIT),
        supabase.from('Fuel_Dispensing_TZA').select('Name, TZA, Tank_Name, Mass, Timestamp').order('id', { ascending: false }).limit(LIMIT),
        supabase.from('Fuel_Dispensing_VS').select('Name, Control_Number, Mass, Timestamp').order('id', { ascending: false }).limit(LIMIT),
      ])

      const combined = [
        ...(rec.data || []).map(r => ({ ...r, type: 'reception' })),
        ...(recAuto.data || []).map(r => ({ ...r, type: 'reception_auto' })),
        ...(tza.data || []).map(r => ({ ...r, type: 'dispense_tza' })),
        ...(vs.data || []).map(r => ({ ...r, type: 'dispense_vs' })),
      ]

      const sorted = combined
        .filter(r => r.Timestamp)
        .sort((a, b) => (b.Timestamp as number) - (a.Timestamp as number))
        .slice(0, 7)

      return res.json(sorted)
    } catch (error) {
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
