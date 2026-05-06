import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../lib/db'
import { sendError } from '../../lib/helpers'

const KEYS = ['telegram_bot_name', 'telegram_bot_token', 'telegram_is_active', 'telegram_chat_ids']

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data } = await supabase.from('Settings').select('key, value').in('key', KEYS)
      const result: Record<string, any> = {
        telegram_bot_name: '', telegram_bot_token: '',
        telegram_is_active: false, telegram_chat_ids: [],
      }
      ;(data || []).forEach((r: any) => {
        if (r.key === 'telegram_is_active') result[r.key] = r.value === 'true'
        else if (r.key === 'telegram_chat_ids') {
          try { result[r.key] = JSON.parse(r.value) } catch { result[r.key] = [] }
        } else result[r.key] = r.value
      })
      return res.json(result)
    } catch (error) {
      return sendError(res, 500, 'Ошибка сервера')
    }
  }

  if (req.method === 'POST') {
    try {
      const { telegram_bot_name, telegram_bot_token, telegram_is_active, telegram_chat_ids } = req.body
      const upserts = [
        { key: 'telegram_bot_name', value: telegram_bot_name },
        { key: 'telegram_bot_token', value: telegram_bot_token },
        { key: 'telegram_is_active', value: String(telegram_is_active) },
        { key: 'telegram_chat_ids', value: JSON.stringify(telegram_chat_ids) },
      ]
      const { error } = await supabase.from('Settings').upsert(upserts, { onConflict: 'key' })
      if (error) throw error
      return res.json({ message: 'Настройки Telegram успешно сохранены!' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
