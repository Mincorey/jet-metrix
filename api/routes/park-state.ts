import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../__lib/db'
import { sendError } from '../__lib/helpers'

function sum(rows: any[] | null, field: string): number {
  return (rows || []).reduce((acc, r) => acc + (r[field] || 0), 0)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { data: tanks } = await supabase
        .from('Tanks_Directory')
        .select('Name, Calibration')
        .eq('Category', 'tank')
        .eq('Status', 'active')

      const results = await Promise.all((tanks || []).map(async (tank) => {
        const { data: lastMeasArr } = await supabase
          .from('Daily_Measurements')
          .select('id, Workday_ID, Volume, Mass, Density, Temperature')
          .eq('Tank_Name', tank.Name)
          .order('id', { ascending: false })
          .limit(1)

        const lastMeas = lastMeasArr?.[0] ?? null
        const baseVolume = lastMeas?.Volume ?? 0
        const baseMass = lastMeas?.Mass ?? 0
        const workdayId = lastMeas?.Workday_ID ?? 0

        const [recRows, recAutoLastMeas, transferInRows, transferOutRows, dispenseTzaRows] = await Promise.all([
          supabase.from('Fuel_Reception').select('Volume, Mass').eq('Tank_Name', tank.Name).gte('Workday_ID', workdayId),
          supabase.from('Daily_Measurements').select('Date').eq('Tank_Name', tank.Name).order('id', { ascending: false }).limit(1),
          supabase.from('In_warehouse').select('Volume, Mass').eq('To_Tank', tank.Name).gte('Workday_ID', workdayId),
          supabase.from('In_warehouse').select('Volume, Mass').eq('From_Tank', tank.Name).gte('Workday_ID', workdayId),
          supabase.from('Fuel_Dispensing_TZA').select('Volume, Mass').eq('Tank_Name', tank.Name).gte('Workday_ID', workdayId),
        ])

        const lastMeasDate = recAutoLastMeas.data?.[0]?.Date ?? '00.00.0000'
        const { data: recAutoRows } = await supabase
          .from('Fuel_Reception_Auto')
          .select('Volume, Mass')
          .eq('Tank_Name', tank.Name)
          .gte('Date', lastMeasDate)

        const totalAdded = sum(recRows.data, 'Volume') + sum(recAutoRows, 'Volume') + sum(transferInRows.data, 'Volume')
        const totalMassAdded = sum(recRows.data, 'Mass') + sum(recAutoRows, 'Mass') + sum(transferInRows.data, 'Mass')
        const totalRemoved = sum(transferOutRows.data, 'Volume') + sum(dispenseTzaRows.data, 'Volume')
        const totalMassRemoved = sum(transferOutRows.data, 'Mass') + sum(dispenseTzaRows.data, 'Mass')

        const currentVolume = baseVolume + totalAdded - totalRemoved
        const currentMass = baseMass + totalMassAdded - totalMassRemoved

        const [densRows, tempRows] = await Promise.all([
          supabase.from('Daily_Measurements').select('Density').eq('Tank_Name', tank.Name).gt('Density', 0).order('id', { ascending: false }).limit(1),
          supabase.from('Daily_Measurements').select('Temperature').eq('Tank_Name', tank.Name).gt('Temperature', 0).order('id', { ascending: false }).limit(1),
        ])

        let maxVol = 0
        try {
          const cal = JSON.parse(tank.Calibration || '[]')
          if (Array.isArray(cal) && cal.length > 0) {
            maxVol = Math.max(...cal.map((r: any) => Number(r.volume) || 0))
          }
        } catch { }
        const maxCapacity = Math.ceil(maxVol / 1000) * 1000 || (tank.Name.includes('РГС-100') ? 100000 : 50000)

        return {
          name: tank.Name,
          volume: Math.round(currentVolume),
          mass: Math.round(currentMass),
          maxCapacity,
          density: densRows.data?.[0]?.Density ?? (lastMeas?.Density ?? 0),
          temperature: tempRows.data?.[0]?.Temperature ?? (lastMeas?.Temperature ?? 0),
        }
      }))

      return res.json(results)
    } catch (error) {
      console.error('Park-state error:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
