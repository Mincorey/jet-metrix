import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/db.js'
import { sendError } from '../_lib/helpers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('Monthly_Inventory').select('*').order('id', { ascending: false })
      if (error) throw error
      const formatted = (data || []).map((r: any) => ({
        ...r,
        Details: JSON.parse(r.Details || '[]'),
      }))
      return res.json(formatted)
    } catch (error) {
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  if (req.method === 'POST') {
    try {
      const d = req.body
      const { data, error } = await supabase
        .from('Monthly_Inventory')
        .insert({
          Date: d.Date, Name: d.Name,
          Total_Volume: d.Total_Volume, Total_Mass: d.Total_Mass,
          Details: JSON.stringify(d.Details || []),
        })
        .select().single()
      if (error) throw error

      const details = d.Details || [];
      if (Array.isArray(details) && details.length > 0) {
        const measurementsToInsert = details.map((r: any) => ({
          Workday_ID: d.Workday_ID || null,
          Date: r.date || d.Date,
          Name: d.Name || 'Старший авиатехник',
          Tank_Name: r.Tank_name || r.Tank_Name,
          Level_1: Number(r.Level_1 || 0),
          Level_2: Number(r.Level_2 || 0),
          Level_3: Number(r.Level_3 || 0),
          Average_Level: Number(r.Average_Level || 0),
          Density: Number(r.Density || 0),
          Temperature: Number(r.Temperature || 0),
          Volume: Number(r.Volume || 0),
          Mass: Number(r.Mass || 0),
          Timestamp: Date.now()
        }));

        const { error: measError } = await supabase
          .from('Daily_Measurements')
          .insert(measurementsToInsert);

        if (measError) {
          console.error('Error auto-inserting measurements from inventory:', measError);
        } else {
          console.log(`Auto-inserted ${measurementsToInsert.length} measurements from inventory.`);
        }
      }

      return res.json({ id: data.id, message: 'Инвентаризация успешно сохранена!' })
    } catch (error) {
      console.error('Error saving inventory:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}


