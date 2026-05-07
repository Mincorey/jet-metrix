import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../../_lib/db'
import { sendError } from '../../../_lib/helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const tankName = req.query.tankName as string
      const { data } = await supabase
        .from('Daily_Measurements')
        .select('Density')
        .eq('Tank_Name', tankName)
        .order('id', { ascending: false })
        .limit(1)
        .single()
      return res.json(data || { Density: '' })
    } catch (error) {
      return res.json({ Density: '' })
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
