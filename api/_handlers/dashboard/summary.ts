import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_lib/db.js'
import { sendError } from '../../_lib/helpers.js'

function parseRuDate(dStr: string): number {
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
    const ts = new Date(year, month, day, hour, minute).getTime()
    return isNaN(ts) ? 0 : ts
  }
  return 0
}

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'GET') {
    try {
      const { period } = req.query
      const now = new Date()
      let periodStartTs = 0
      let periodEndTs = now.getTime()

      if (period === 'today') {
        const d = new Date(); d.setHours(0, 0, 0, 0); periodStartTs = d.getTime()
      } else if (period === 'yesterday') {
        const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); periodStartTs = d.getTime()
        const e = new Date(d); e.setHours(23, 59, 59, 999); periodEndTs = e.getTime()
      } else if (period === 'week') {
        const d = new Date(); d.setDate(d.getDate() - 7); periodStartTs = d.getTime()
      } else if (period === 'month') {
        const d = new Date(); d.setMonth(d.getMonth() - 1); periodStartTs = d.getTime()
      } else if (period === 'year') {
        const d = new Date(); d.setFullYear(d.getFullYear() - 1); periodStartTs = d.getTime()
      }

      const [tanksDir, tanksData, receptions, autoReceptions, tzaDispense, vsDispense, measurements] = await Promise.all([
        supabase.from('Tanks_Directory').select('Name, Calibration, Status').eq('Category', 'tank'),
        supabase.from('Daily_Measurements').select('Tank_Name, Average_Level, Mass, Volume').order('id', { ascending: false }),
        supabase.from('Fuel_Reception').select('Date, Mass, Volume'),
        supabase.from('Fuel_Reception_Auto').select('Date, Mass, Volume'),
        supabase.from('Fuel_Dispensing_TZA').select('Date, Mass, Volume'),
        supabase.from('Fuel_Dispensing_VS').select('Date, Mass, Volume'),
        supabase.from('Daily_Measurements').select('Date, Density'),
      ])

      const totalTanks = (tanksDir.data || []).length
      const activeTanks = (tanksDir.data || []).filter((t: any) => t.Status === 'active').length

      const maxCapMap: Record<string, number> = {}
      ;(tanksDir.data || []).forEach((t: any) => {
        try {
          const cal = JSON.parse(t.Calibration || '[]')
          const maxVol = Array.isArray(cal) && cal.length > 0 ? Math.max(...cal.map((r: any) => Number(r.volume) || 0)) : 0
          maxCapMap[t.Name] = Math.ceil(maxVol / 1000) * 1000
        } catch { }
      })

      const latestByTank: Record<string, any> = {}
      for (const row of (tanksData.data || [])) {
        if (!latestByTank[row.Tank_Name]) latestByTank[row.Tank_Name] = row
      }

      let totalFuelKg = 0, totalFuelL = 0
      const tanksBalances = Object.values(latestByTank).map((tank: any) => {
        let fillColor = '#10b981'
        if (tank.Tank_Name.includes('РГС-50')) {
          if (tank.Average_Level <= 120) fillColor = '#ef4444'
          else if (tank.Average_Level >= 2250) fillColor = '#f59e0b'
        } else if (tank.Tank_Name.includes('РГС-100')) {
          if (tank.Average_Level <= 200) fillColor = '#ef4444'
          else if (tank.Average_Level >= 3150) fillColor = '#f59e0b'
        }
        totalFuelKg += tank.Mass || 0
        totalFuelL += tank.Volume || 0
        const maxCapacity = maxCapMap[tank.Tank_Name] || (tank.Tank_Name.includes('РГС-100') ? 109000 : 55000)
        return { name: tank.Tank_Name, mass: tank.Mass || 0, volume: tank.Volume || 0, fillColor, maxCapacity }
      })

      let receivedKg = 0, receivedL = 0, dispensedKg = 0, dispensedL = 0
      const dynamicsMap: Record<string, any> = {}
      const densityMap: Record<string, any> = {}

      const processRecords = (rows: any[], type: 'received' | 'dispensedTZA' | 'dispensedVS') => {
        ;(rows || []).forEach(r => {
          const ts = parseRuDate(r.Date)
          if (ts < periodStartTs || ts > periodEndTs) return
          const shortDate = r.Date.substring(0, 5)
          if (!dynamicsMap[shortDate]) dynamicsMap[shortDate] = { date: shortDate, timestamp: ts, received: 0, dispensedTZA: 0, dispensedVS: 0 }
          if (type === 'received') { receivedKg += r.Mass || 0; receivedL += r.Volume || 0; dynamicsMap[shortDate].received += r.Mass || 0 }
          if (type === 'dispensedTZA') { dispensedKg += r.Mass || 0; dispensedL += r.Volume || 0; dynamicsMap[shortDate].dispensedTZA += r.Mass || 0 }
          if (type === 'dispensedVS') { dispensedKg += r.Mass || 0; dispensedL += r.Volume || 0; dynamicsMap[shortDate].dispensedVS += r.Mass || 0 }
        })
      }

      processRecords(receptions.data || [], 'received')
      processRecords(autoReceptions.data || [], 'received')
      processRecords(tzaDispense.data || [], 'dispensedTZA')
      processRecords(vsDispense.data || [], 'dispensedVS')

      ;(measurements.data || []).forEach(r => {
        const ts = parseRuDate(r.Date)
        if (ts < periodStartTs || ts > periodEndTs) return
        if (!r.Density || r.Density <= 0) return
        let density = r.Density
        while (density > 2) {
          density /= 10
        }
        const shortDate = r.Date.substring(0, 5)
        if (!densityMap[shortDate]) densityMap[shortDate] = { date: shortDate, timestamp: ts, sum: 0, count: 0 }
        densityMap[shortDate].sum += density
        densityMap[shortDate].count += 1
      })

      const turnoverDynamics = Object.values(dynamicsMap).sort((a, b) => a.timestamp - b.timestamp)
      const densityDynamics = Object.values(densityMap)
        .map(d => ({ date: d.date, timestamp: d.timestamp, density: Number((d.sum / d.count).toFixed(4)) }))
        .sort((a, b) => a.timestamp - b.timestamp)

      return res.json({
        kpi: {
          totalFuelKg: Math.round(totalFuelKg), totalFuelL: Math.round(totalFuelL),
          receivedKg: Math.round(receivedKg), receivedL: Math.round(receivedL), receivedTrend: 0,
          dispensedKg: Math.round(dispensedKg), dispensedL: Math.round(dispensedL), dispensedTrend: 0,
          activeTanks, totalTanks,
        },
        charts: { tanksBalances, turnoverDynamics, densityDynamics },
      })
    } catch (error) {
      console.error('Dashboard summary error:', error)
      return sendError(res, 500, 'Внутренняя ошибка сервера')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}


