import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../../_lib/db'
import { sendError } from '../../../_lib/helpers'
import { sendTelegramMessage } from '../../../_lib/telegram'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      const { data } = await supabase
        .from('Settings').select('key, value')
        .in('key', ['telegram_bot_token', 'telegram_chat_ids'])
      const map: Record<string, string> = {}
      ;(data || []).forEach((r: any) => { map[r.key] = r.value })

      if (!map['telegram_bot_token']) return sendError(res, 400, 'Токен бота не настроен')
      let chatIds: string[] = []
      try { chatIds = JSON.parse(map['telegram_chat_ids'] || '[]') } catch { chatIds = [] }
      if (chatIds.length === 0) return sendError(res, 400, 'Список ID получателей пуст')

      const results = []
      for (const chatId of chatIds) {
        try {
          await sendTelegramMessage(map['telegram_bot_token'], chatId, '✅ Тестовое сообщение от системы JetMetrix успешно доставлено!')
          results.push({ chatId, success: true })
        } catch (err: any) {
          results.push({ chatId, success: false, error: err.message })
        }
      }

      const allSuccess = results.every(r => r.success)
      return res.json(allSuccess
        ? { message: 'Тестовые сообщения успешно отправлены всем получателям!' }
        : { message: 'Некоторые сообщения не удалось отправить', details: results }
      )
    } catch (error) {
      return sendError(res, 500, 'Ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
