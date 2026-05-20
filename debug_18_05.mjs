import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zjmwnprjxowljawtpdxz.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbXducHJqeG93bGphd3RwZHh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA1OTkwOSwiZXhwIjoyMDkzNjM1OTA5fQ.Ulia_PsIqLaVnYY-gGwp_idMp5NjuLHYbV-6PQxiTZs';

const supabase = createClient(supabaseUrl, serviceRoleKey);

(async () => {
  console.log('🔍 АНАЛИЗ ПРОБЛЕМЫ ЗА 18.05.2026\n');
  
  const { data: workdays } = await supabase
    .from('Workdays')
    .select('*')
    .like('Date', '18.05.2026%')
    .order('id', { ascending: false });
  
  console.log(`1️⃣ Workdays за 18.05.2026: ${workdays.length} записей`);
  workdays.forEach(wd => {
    console.log(`   ID: ${wd.id}, Status: ${wd.Workday_Status}, TZA: ${wd.Fuel_Issued_TZA_L}л, VS: ${wd.Fuel_Issued_VS_L}л`);
  });
  
  const { data: allTza } = await supabase.from('Fuel_Dispensing_TZA').select('*').like('Date', '18.05.2026%');
  const { data: allVs } = await supabase.from('Fuel_Dispensing_VS').select('*').like('Date', '18.05.2026%');
  
  console.log(`\n2️⃣ Операции за 18.05.2026:`);
  console.log(`   TZA: ${allTza.length} записей`);
  allTza.forEach(op => console.log(`     - Workday_ID: ${op.Workday_ID}, Vol: ${op.Volume}л`));
  console.log(`   VS: ${allVs.length} записей`);
  allVs.forEach(op => console.log(`     - Workday_ID: ${op.Workday_ID}, Vol: ${op.Volume}л`));
  
  process.exit(0);
})().catch(err => { console.error('Error:', err); process.exit(1); });
