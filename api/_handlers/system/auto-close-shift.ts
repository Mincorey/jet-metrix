import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_lib/db.js'
import { sendError } from '../../_lib/helpers.js'
import { sendTelegramNotification } from '../../_lib/telegram.js'

function sumField(rows: any[], field: string): number {
  return (rows || []).reduce((acc, r) => acc + (r[field] || 0), 0)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Для Cron Jobs поддерживаем GET или POST
  if (req.method === 'GET' || req.method === 'POST') {
    try {
      console.log('Running auto-close-shift Cron job...');

      // Находим открытые смены
      const { data: openWorkdays, error: findError } = await supabase
        .from('Workdays')
        .select('*')
        .eq('Workday_Status', 'Open');

      if (findError) throw findError;

      if (!openWorkdays || openWorkdays.length === 0) {
        console.log('No open shifts found.');
        return res.json({ message: 'Нет открытых смен для закрытия' });
      }

      const closedShifts = [];

      for (const workday of openWorkdays) {
        const id = workday.id;

        const [recRows, recAutoRows, transferRows, tzaRows, vsRows] = await Promise.all([
          supabase.from('Fuel_Reception').select('Volume, Mass').eq('Workday_ID', id),
          supabase.from('Fuel_Reception_Auto').select('Volume, Mass').eq('Workday_ID', id),
          supabase.from('In_warehouse').select('Volume, Mass').eq('Workday_ID', id),
          supabase.from('Fuel_Dispensing_TZA').select('Volume, Mass').eq('Workday_ID', id),
          supabase.from('Fuel_Dispensing_VS').select('Volume, Mass').eq('Workday_ID', id),
        ]);

        const rec = { vol: sumField(recRows.data || [], 'Volume'), mass: sumField(recRows.data || [], 'Mass') }
        const recAuto = { vol: sumField(recAutoRows.data || [], 'Volume'), mass: sumField(recAutoRows.data || [], 'Mass') }
        const transfer = { vol: sumField(transferRows.data || [], 'Volume'), mass: sumField(transferRows.data || [], 'Mass') }
        const tza = { vol: sumField(tzaRows.data || [], 'Volume'), mass: sumField(tzaRows.data || [], 'Mass') }
        const vs = { vol: sumField(vsRows.data || [], 'Volume'), mass: sumField(vsRows.data || [], 'Mass') }

        const totalRecVol = rec.vol + recAuto.vol + transfer.vol
        const totalRecMass = rec.mass + recAuto.mass + transfer.mass

        const { error: updateError } = await supabase.from('Workdays').update({
          Fuel_Received_L: totalRecVol,
          Fuel_Received_KG: totalRecMass,
          Fuel_Issued_TZA_L: tza.vol,
          Fuel_Issued_TZA_KG: tza.mass,
          Fuel_Issued_VS_L: vs.vol,
          Fuel_Issued_VS_KG: vs.mass,
          Workday_Status: 'Closed',
        }).eq('id', id)

        if (updateError) throw updateError;

        await sendTelegramNotification(
          `🤖 <b>Автоматическое закрытие смены (03:00)</b>\nДата: ${workday.Date}\nСотрудник: ${workday.Name}\n\n📈 <b>Итоги смены:</b>\nПринято: ${Math.round(totalRecVol)} л. / ${Math.round(totalRecMass)} кг.\nВыдано в ТЗА: ${Math.round(tza.vol)} л. / ${Math.round(tza.mass)} кг.\nВыдано в ВС: ${Math.round(vs.vol)} л. / ${Math.round(vs.mass)} кг.`
        )

        console.log(`🔒 Смена #${id} закрыта автоматически.`);
        closedShifts.push({ id, name: workday.Name, date: workday.Date });
      }

      return res.json({ message: 'Смены успешно закрыты', closedShifts });
    } catch (error) {
      console.error('Error in auto-close-shift Cron:', error);
      return sendError(res, 500, 'Внутренняя ошибка сервера автозакрытия смен')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
