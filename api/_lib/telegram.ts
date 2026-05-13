import { supabase } from './db.js'

export async function sendTelegramNotification(message: string): Promise<void> {
  try {
    const { data: rows } = await supabase
      .from('Settings')
      .select('key, value')
      .in('key', ['telegram_is_active', 'telegram_bot_token', 'telegram_chat_ids'])

    if (!rows) return
    const map: Record<string, string> = {}
    rows.forEach((r: { key: string; value: string }) => { map[r.key] = r.value })

    if (map['telegram_is_active'] !== 'true') return
    if (!map['telegram_bot_token'] || !map['telegram_chat_ids']) return

    const token = map['telegram_bot_token']
    const chatIds: string[] = JSON.parse(map['telegram_chat_ids'])

    for (const chatId of chatIds) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error(`Telegram API Error for chat ${chatId}:`, err.description || res.status)
      }
    }
  } catch (e) {
    console.error('Telegram notification error:', e)
  }
}

export async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  })
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.description || `Telegram API Error ${res.status}`)
  }
}
