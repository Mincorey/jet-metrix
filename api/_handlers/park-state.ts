import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/db.js'
import { sendError } from '../_lib/helpers.js'

function sum(rows: any[] | null, field: string): number {
  return (rows || []).reduce((acc, r) => acc + (r[field] || 0), 0)
}

function parseRuDateTime(dStr: string | null | undefined): number {
  if (!dStr) return 0
  const parts = dStr.split(' ')
  const datePart = parts[0].split('.')
  const timePart = parts[1] ? parts[1].split(':') : ['00', '00']
  if (datePart.length === 3) {
    const year = parseInt(datePart[2], 10)
    const month = parseInt(datePart[1], 10) - 1
    const day = parseInt(datePart[0], 10)
    const hour = parseInt(timePart[0], 10)
    const minute = parseInt(timePart[1], 10)
    return new Date(year, month, day, hour, minute).getTime()
  }
  return 0
}

export async function getParkStateData() {
  const { data: tanks } = await supabase
    .from('Tanks_Directory')
    .select('Name, Calibration')
    .eq('Category', 'tank')
    .eq('Status', 'active')

  const results = await Promise.all((tanks || []).map(async (tank) => {
    const { data: lastMeasArr } = await supabase
      .from('Daily_Measurements')
      .select('id, Workday_ID, Volume, Mass, Density, Temperature, Date, Timestamp')
      .eq('Tank_Name', tank.Name)
      .order('id', { ascending: false })
      .limit(1)

    const lastMeas = lastMeasArr?.[0] ?? null
    const baseVolume = lastMeas?.Volume ?? 0
    const baseMass = lastMeas?.Mass ?? 0
    const lastMeasTime = lastMeas?.Timestamp || parseRuDateTime(lastMeas?.Date)

    const [recRows, transferInRows, transferOutRows, dispenseTzaRows, recAutoRows] = await Promise.all([
      supabase.from('Fuel_Reception').select('Volume, Mass').eq('Tank_Name', tank.Name).gt('Timestamp', lastMeasTime),
      supabase.from('In_warehouse').select('Volume, Mass').eq('To_Tank', tank.Name).gt('Timestamp', lastMeasTime),
      supabase.from('In_warehouse').select('Volume, Mass').eq('From_Tank', tank.Name).gt('Timestamp', lastMeasTime),
      supabase.from('Fuel_Dispensing_TZA').select('Volume, Mass').eq('Tank_Name', tank.Name).gt('Timestamp', lastMeasTime),
      supabase.from('Fuel_Reception_Auto').select('Volume, Mass').eq('Tank_Name', tank.Name).gt('Timestamp', lastMeasTime),
    ])

    const totalAdded = sum(recRows.data, 'Volume') + sum(recAutoRows.data, 'Volume') + sum(transferInRows.data, 'Volume')
    const totalMassAdded = sum(recRows.data, 'Mass') + sum(recAutoRows.data, 'Mass') + sum(transferInRows.data, 'Mass')
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

  return results
}

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const results = await getParkStateData()
      return res.json(results)
    } catch (error) {
      console.error('Park-state error:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}


