import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_lib/db.js'
import { sendError } from '../../_lib/helpers.js'
import { sendTelegramNotification } from '../../_lib/telegram.js'

const OPERATION_NAMES: Record<string, string> = {
  reception: 'Прием топлива',
  reception_auto: 'Прием из АЦ',
  dispense_tza: 'Выдача в ТЗА',
  dispense_vs: 'Выдача в ВС',
  measurement: 'Замер резервуара',
  train: 'Замер цистерны',
  in_warehouse: 'Перекачка',
}

const FIELD_NAMES: Record<string, string> = {
  Tank_Name: 'Резервуар',
  TZA: 'ТЗА',
  Control_Number: 'Контрольный талон',
  Passport_Number: 'Паспорт №',
  Passport_Date: 'Дата паспорта',
  Counter_Before: 'Счетчик ДО',
  Counter_After: 'Счетчик ПОСЛЕ',
  Density: 'Плотность (г/см³)',
  Volume: 'Объем (л)',
  Mass: 'Масса (кг)',
  Gos_Number: 'Гос. номер АЦ',
  Level_1: 'Замер 1 (мм)',
  Level_2: 'Замер 2 (мм)',
  Level_3: 'Замер 3 (мм)',
  Average_Level: 'Средний уровень (мм)',
  Temperature: 'Температура (°C)',
  Type: 'Тип вагона',
  Number: 'Номер вагона',
}

const formatValue = (val: any) => {
  if (val === null || val === undefined) return '';
  return String(val);
}

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
      const { operationType, id, data, action } = req.body
      const table = TABLE_MAP[operationType]
      if (!table) return sendError(res, 400, 'Неизвестный тип операции')

      // Get the full old record first for diff and notifications
      const { data: oldRecord } = await supabase.from(table).select('*').eq('id', id).single()
      if (!oldRecord) return sendError(res, 404, 'Операция не найдена')

      if (operationType === 'dispense_tza' || operationType === 'dispense_vs') {

        if (oldRecord?.TZA) {
          const { data: tza } = await supabase
            .from('TZA_Directory').select('Current_Volume')
            .eq('Name', oldRecord.TZA).eq('Is_Monitoring', 1).single()

          if (tza) {
            let deltaVolume = 0;
            if (action === 'delete') {
              deltaVolume = -(oldRecord.Volume || 0);
            } else {
              deltaVolume = (data?.Volume || 0) - (oldRecord.Volume || 0);
            }
            const adjustment = operationType === 'dispense_tza' ? deltaVolume : -deltaVolume;

            await supabase
              .from('TZA_Directory')
              .update({ Current_Volume: (tza.Current_Volume || 0) + adjustment })
              .eq('Name', oldRecord.TZA).eq('Is_Monitoring', 1)
          }
        }
      }

      const opName = OPERATION_NAMES[operationType] || 'Неизвестная операция';
      const employeeName = oldRecord.Name || 'Неизвестно';
      const opDate = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

      if (action === 'delete') {
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (error) throw error
        
        let deletedDataStr = '';
        const fieldsToIgnore = ['id', 'Workday_ID', 'Name', 'Date', 'Timestamp'];
        for (const [key, val] of Object.entries(oldRecord)) {
          if (fieldsToIgnore.includes(key)) continue;
          if (val === null || val === undefined || val === '') continue;
          const label = FIELD_NAMES[key] || key;
          deletedDataStr += `${label}: ${val}\n`;
        }

        const msg = `🚨 <b>ВНИМАНИЕ: УДАЛЕНИЕ ОПЕРАЦИИ!</b>\n🗑 <b>${opName}</b>\n\n👤 <b>Исполнитель (Смена):</b> ${employeeName}\n🕒 <b>Время удаления:</b> ${opDate}\n\n❌ <b>УДАЛЕННЫЕ ДАННЫЕ:</b>\n${deletedDataStr}`;
        await sendTelegramNotification(msg);

        return res.json({ success: true, message: 'Операция успешно удалена' })
      } else {
        const { error } = await supabase.from(table).update(data).eq('id', id)
        if (error) throw error

        let oldDataStr = '';
        let newDataStr = '';
        const fieldsToIgnore = ['id', 'Workday_ID', 'Name', 'Date', 'Timestamp'];
        
        let identifierStr = '';
        if (oldRecord.Tank_Name) identifierStr += `Резервуар: ${oldRecord.Tank_Name}\n`;
        else if (oldRecord.TZA) identifierStr += `ТЗА: ${oldRecord.TZA}\n`;
        else if (oldRecord.Number) identifierStr += `Вагон: ${oldRecord.Number}\n`;

        for (const key of Object.keys(data)) {
          if (fieldsToIgnore.includes(key)) continue;
          const oldVal = formatValue(oldRecord[key]);
          const newVal = formatValue(data[key]);
          if (oldVal !== newVal) {
            const label = FIELD_NAMES[key] || key;
            oldDataStr += `${label}: ${oldVal}\n`;
            newDataStr += `${label}: ${newVal}\n`;
          }
        }

        if (oldDataStr && newDataStr) {
          const msg = `⚠️ <b>ВНИМАНИЕ: ИЗМЕНЕНИЕ ОПЕРАЦИИ!</b>\n✏️ <b>${opName}</b>\n\n👤 <b>Исполнитель (Смена):</b> ${employeeName}\n🕒 <b>Время изменения:</b> ${opDate}\n\n${identifierStr}\n📝 <b>БЫЛО:</b>\n${oldDataStr}\n✅ <b>СТАЛО:</b>\n${newDataStr}`;
          await sendTelegramNotification(msg);
        }

        return res.json({ success: true, message: 'Операция успешно обновлена' })
      }
    } catch (error) {
      console.error('Edit operation error:', error)
      return sendError(res, 500, 'Ошибка сервера при редактировании')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}


