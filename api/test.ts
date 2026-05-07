import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.json({ status: 'ok', message: 'API serverless function is working!', timestamp: new Date().toISOString() })
}
