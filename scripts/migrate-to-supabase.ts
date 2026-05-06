/**
 * One-time migration script: SQLite (sgsm.db) → Supabase PostgreSQL
 *
 * Prerequisites:
 *   - better-sqlite3 must be installed (it's in node_modules if you haven't run npm install yet)
 *   - Create .env file with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Run the schema first: supabase/schema.sql in Supabase SQL Editor
 *
 * Run: npx tsx scripts/migrate-to-supabase.ts
 */

import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const dbPath = path.join(__dirname, '..', 'sgsm.db')
const db = new Database(dbPath, { readonly: true })

const TABLES = [
  'Settings',
  'Employees',
  'Tanks_Directory',
  'TZA_Directory',
  'Tech_Lines',
  'Workdays',
  'Fuel_Reception',
  'Fuel_Reception_Auto',
  'Fuel_Dispensing_TZA',
  'Fuel_Dispensing_VS',
  'Trains',
  'Daily_Measurements',
  'Monthly_Inventory',
  'In_warehouse',
]

const BATCH_SIZE = 100

async function migrateTable(tableName: string): Promise<void> {
  let rows: any[]
  try {
    rows = db.prepare(`SELECT * FROM "${tableName}"`).all()
  } catch (e) {
    console.warn(`⚠️  Table ${tableName} not found in SQLite, skipping`)
    return
  }

  if (rows.length === 0) {
    console.log(`   ${tableName}: 0 rows (empty, skipping)`)
    return
  }

  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from(tableName).insert(batch)
    if (error) {
      console.error(`❌ Error inserting batch into ${tableName}:`, error.message)
      console.error('   First row in batch:', JSON.stringify(batch[0]))
      throw error
    }
    inserted += batch.length
  }

  console.log(`✅ ${tableName}: ${inserted} rows migrated`)
}

async function main() {
  console.log('🚀 Starting migration from sgsm.db → Supabase\n')
  console.log(`   DB file: ${dbPath}`)
  console.log(`   Supabase: ${SUPABASE_URL}\n`)

  for (const table of TABLES) {
    await migrateTable(table)
  }

  db.close()
  console.log('\n🎉 Migration complete!')
  console.log('\nNext steps:')
  console.log('  1. Verify row counts in Supabase Dashboard → Table Editor')
  console.log('  2. Run: npm install')
  console.log('  3. Run: vercel dev  (to test locally)')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
