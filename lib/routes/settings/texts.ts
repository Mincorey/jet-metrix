import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../api/_lib/../_lib/db'
import { sendError } from '../../api/_lib/../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data } = await supabase
        .from('Settings').select('key, value')
        .in('key', ['service_name', 'facility_name'])
      const result = {
        service_name: 'Система Автоматизации СГСМ',
        facility_name: 'Международный Аэропорт "Сухум"',
      }
      ;(data || []).forEach((r: any) => { result[r.key as keyof typeof result] = r.value })
      return res.json(result)
    } catch (error) {
      return sendError(res, 500, 'Ошибка сервера')
    }
  }

  if (req.method === 'POST') {
    try {
      const { service_name, facility_name } = req.body
      const upserts = []
      if (service_name !== undefined) upserts.push({ key: 'service_name', value: service_name })
      if (facility_name !== undefined) upserts.push({ key: 'facility_name', value: facility_name })
      if (upserts.length > 0) {
        const { error } = await supabase.from('Settings').upsert(upserts, { onConflict: 'key' })
        if (error) throw error
      }
      return res.json({ message: 'Названия успешно сохранены!' })
    } catch (error) {
      return sendError(res, 500, 'Ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
