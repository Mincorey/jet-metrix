import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../../_lib/_lib/db'
import { sendError } from '../../../_lib/_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data } = await supabase.from('Settings').select('value').eq('key', 'logo').single()
      return res.json({ logo: data?.value ?? null })
    } catch (error) {
      return sendError(res, 500, 'Ошибка сервера')
    }
  }

  if (req.method === 'POST') {
    try {
      const { logo } = req.body
      const { error } = await supabase
        .from('Settings')
        .upsert({ key: 'logo', value: logo }, { onConflict: 'key' })
      if (error) throw error
      return res.json({ message: 'Логотип успешно обновлен!' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
