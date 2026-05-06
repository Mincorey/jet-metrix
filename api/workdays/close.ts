import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/db'
import { withCors, sendError } from '../_lib/helpers'
import { sendTelegramNotification } from '../_lib/telegram'

function sumField(rows: any[], field: string): number {
  return (rows || []).reduce((acc, r) => acc + (r[field] || 0), 0)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (withCors(req, res)) return

  if (req.method === 'POST') {
    try {
      const { id } = req.body

      const { data: workday } = await supabase
        .from('Workdays').select('Name, Date').eq('id', id).single()

      const [recRows, recAutoRows, transferRows, tzaRows, vsRows] = await Promise.all([
        supabase.from('Fuel_Reception').select('Volume, Mass').eq('Workday_ID', id),
        supabase.from('Fuel_Reception_Auto').select('Volume, Mass, Date')
          .eq('Date', workday?.Date ?? ''),
        supabase.from('In_warehouse').select('Volume, Mass').eq('Workday_ID', id),
        supabase.from('Fuel_Dispensing_TZA').select('Volume, Mass').eq('Workday_ID', id),
        supabase.from('Fuel_Dispensing_VS').select('Volume, Mass').eq('Workday_ID', id),
      ])

      const rec = { vol: sumField(recRows.data, 'Volume'), mass: sumField(recRows.data, 'Mass') }
      const recAuto = { vol: sumField(recAutoRows.data, 'Volume'), mass: sumField(recAutoRows.data, 'Mass') }
      const transfer = { vol: sumField(transferRows.data, 'Volume'), mass: sumField(transferRows.data, 'Mass') }
      const tza = { vol: sumField(tzaRows.data, 'Volume'), mass: sumField(tzaRows.data, 'Mass') }
      const vs = { vol: sumField(vsRows.data, 'Volume'), mass: sumField(vsRows.data, 'Mass') }

      const totalRecVol = rec.vol + recAuto.vol + transfer.vol
      const totalRecMass = rec.mass + recAuto.mass + transfer.mass

      const { error } = await supabase.from('Workdays').update({
        Fuel_Received_L: totalRecVol,
        Fuel_Received_KG: totalRecMass,
        Fuel_Issued_TZA_L: tza.vol,
        Fuel_Issued_TZA_KG: tza.mass,
        Fuel_Issued_VS_L: vs.vol,
        Fuel_Issued_VS_KG: vs.mass,
        Workday_Status: 'Closed',
      }).eq('id', id)
      if (error) throw error

      await sendTelegramNotification(
        `📊 <b>Смена закрыта</b>\nДата: ${workday?.Date}\nСотрудник: ${workday?.Name}\n\n📈 <b>Итоги смены:</b>\nПринято: ${rec.vol} л.\nВыдано в ТЗА: ${tza.vol} л.\nВыдано в ВС: ${vs.vol} л.`
      )

      console.log(`🔒 Смена #${id} закрыта.`)
      return res.json({ message: 'Смена успешно закрыта' })
    } catch (error) {
      console.error('Error closing workday:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
