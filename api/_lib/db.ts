import { createClient } from '@supabase/supabase-js'

// supabase-js expects the bare project URL (https://<ref>.supabase.co).
// Defensively strip a trailing slash and any '/rest/v1' segment some users
// paste from the Supabase REST API URL.
function normalizeSupabaseUrl(raw: string): string {
  return raw
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '')
}

const rawUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseUrl = normalizeSupabaseUrl(rawUrl)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseKey)
