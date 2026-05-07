import type { VercelRequest, VercelResponse } from '@vercel/node'

export function withCors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}

export function sendError(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message })
}
