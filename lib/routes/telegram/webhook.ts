import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../api/_lib/../_lib/db'
import { sendError } from '../../api/_lib/../_lib/helpers'
import { sendTelegramMessage } from '../../api/_lib/../_lib/telegram'

async function getTelegramSettings() {
  const { data } = await supabase
    .from('Settings').select('key, value')
    .in('key', ['telegram_bot_token', 'telegram_chat_ids'])
  const map: Record<string, string> = {}
  ;(data || []).forEach((r: any) => { map[r.key] = r.value })
  return {
    token: map['telegram_bot_token'] ?? '',
    chatIds: (() => { try { return JSON.parse(map['telegram_chat_ids'] || '[]') } catch { return [] } })() as string[],
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'POST') {
    try {
      const body = req.body
      const message = body?.message
      if (!message?.text) return res.status(200).json({ ok: true })

      const { token, chatIds } = await getTelegramSettings()
      if (!token) return res.status(200).json({ ok: true })

      const chatId = String(message.chat.id)
      if (!chatIds.map(String).includes(chatId)) return res.status(200).json({ ok: true })

      const command = (message.text || '').split(' ')[0].replace('/', '').split('@')[0]

      if (command === 'help') {
        await sendTelegramMessage(token, chatId,
          '📊 <b>Список доступных команд:</b>\n/stock — Текущие остатки на складе и ТЗА\n/shift — Данные по открытой смене'
        )
      } else if (command === 'shift') {
        const { data: workdays } = await supabase
          .from('Workdays').select('*').eq('Workday_Status', 'Open')
          .order('id', { ascending: false }).limit(1)
        const workday = workdays?.[0]
        if (!workday) {
          await sendTelegramMessage(token, chatId, 'На данный момент нет открытых смен.')
        } else {
          const recL = workday.Fuel_Received_L || 0
          const vsL = workday.Fuel_Issued_VS_L || 0
          await sendTelegramMessage(token, chatId,
            `👨‍🔧 Сейчас работает: <b>${workday.Name}</b>\n📥 Принято: ${recL.toLocaleString('ru-RU')} л.\n✈️ Выдано в ВС: ${vsL.toLocaleString('ru-RU')} л.`
          )
        }
      } else if (command === 'stock') {
        const [tanksRes, tzaRes] = await Promise.all([
          fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/park-state`),
          supabase.from('TZA_Directory').select('*').eq('Is_Monitoring', 1),
        ])
        const tanks: any[] = tanksRes.ok ? await tanksRes.json() : []
        const tzas = tzaRes.data || []

        let rgs50L = 0, rgs50KG = 0, rgs100L = 0, rgs100KG = 0
        let rgs50Text = '<b>Группа РГС-50:</b>\n'
        let rgs100Text = '<b>Группа РГС-100:</b>\n'

        tanks.forEach(t => {
          const is50 = t.name.includes('50')
          const p = (t.density || 0).toFixed(3)
          const line = `🔹 ${t.name}: ${t.volume.toLocaleString('ru-RU')} л. | ${t.mass.toLocaleString('ru-RU')} кг. | p: ${p}\n`
          if (is50) { rgs50L += t.volume; rgs50KG += t.mass; rgs50Text += line }
          else { rgs100L += t.volume; rgs100KG += t.mass; rgs100Text += line }
        })

        rgs50Text += `<i>Итого РГС-50: ${rgs50L.toLocaleString('ru-RU')} л. | ${rgs50KG.toLocaleString('ru-RU')} кг.</i>\n\n`
        rgs100Text += `<i>Итого РГС-100: ${rgs100L.toLocaleString('ru-RU')} л. | ${rgs100KG.toLocaleString('ru-RU')} кг.</i>\n\n`

        const totalL = rgs50L + rgs100L
        const totalKG = rgs50KG + rgs100KG

        let tzaText = '🚛 <b>ТЗА В РАБОТЕ:</b>\n'
        if (tzas.length === 0) { tzaText += 'Нет активных ТЗА.\n' }
        tzas.forEach((t: any) => {
          tzaText += `🔸 ${t.Name}: ${(t.Current_Volume || 0).toLocaleString('ru-RU')} л. (из ${t.Volume || 0} л.)\n`
        })

        await sendTelegramMessage(token, chatId,
          `🛢 <b>ТЕКУЩИЕ ОСТАТКИ НА СКЛАДЕ:</b>\n\n${rgs50Text}${rgs100Text}📊 <b>ИТОГО ПО СКЛАДУ:</b>\n<b>${totalL.toLocaleString('ru-RU')} л. | ${totalKG.toLocaleString('ru-RU')} кг.</b>\n\n${tzaText}`
        )
      }

      return res.status(200).json({ ok: true })
    } catch (error) {
      console.error('Telegram webhook error:', error)
      return res.status(200).json({ ok: true })
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
