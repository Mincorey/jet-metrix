import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_lib/db.ts'
import { sendError } from '../../_lib/helpers.ts'

const TABLE_MAP: Record<string, string> = {
  reception: 'Fuel_Reception',
  reception_auto: 'Fuel_Reception_Auto',
  dispense_tza: 'Fuel_Dispensing_TZA',
  dispense_vs: 'Fuel_Dispensing_VS',
  measurement: 'Daily_Measurements',
  train: 'Trains',
  in_warehouse: 'In_warehouse',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'POST') {
    try {
      const { operationType, id, data } = req.body
      const table = TABLE_MAP[operationType]
      if (!table) return sendError(res, 400, 'Неизвестный тип операции')

      if (operationType === 'dispense_tza' || operationType === 'dispense_vs') {
        const { data: oldRecord } = await supabase
          .from(table).select('Volume, TZA').eq('id', id).single()

        if (oldRecord?.TZA) {
          const { data: tza } = await supabase
            .from('TZA_Directory').select('Current_Volume')
            .eq('Name', oldRecord.TZA).eq('Is_Monitoring', 1).single()

          if (tza) {
            const deltaVolume = (data.Volume || 0) - (oldRecord.Volume || 0)
            const adjustment = operationType === 'dispense_tza' ? deltaVolume : -deltaVolume
            await supabase
              .from('TZA_Directory')
              .update({ Current_Volume: (tza.Current_Volume || 0) + adjustment })
              .eq('Name', oldRecord.TZA).eq('Is_Monitoring', 1)
          }
        }
      }

      const { error } = await supabase.from(table).update(data).eq('id', id)
      if (error) throw error

      return res.json({ success: true, message: 'Операция успешно обновлена' })
    } catch (error) {
      console.error('Edit operation error:', error)
      return sendError(res, 500, 'Ошибка сервера при редактировании')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
