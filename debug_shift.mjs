import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zjmwnprjxowljawtpdxz.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbXducHJqeG93bGphd3RwZHh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA1OTkwOSwiZXhwIjoyMDkzNjM1OTA5fQ.Ulia_PsIqLaVnYY-gGwp_idMp5NjuLHYbV-6PQxiTZs';

const supabase = createClient(supabaseUrl, serviceRoleKey);

(async () => {
  console.log('🔍 АНАЛИЗ ПРОБЛЕМЫ СМЕННОГО ОТЧЕТА 19.05.2026\n');
  
  // Получить workday за 19.05.2026
  console.log('1️⃣ Проверка Workdays за 19.05.2026:');
  const { data: workdays, error: wdError } = await supabase
    .from('Workdays')
    .select('*')
    .like('Date', '19.05.2026%')
    .order('id', { ascending: false });
  
  if (wdError) {
    console.log('❌ Ошибка:', wdError.message);
  } else {
    console.log('✅ Найдено записей:', workdays.length);
    if (!workdays || workdays.length === 0) {
      console.log('⚠️  Нет записей за 19.05.2026');
    }
    workdays.forEach(wd => {
      console.log(`\n   Workday ID: ${wd.id}`);
      console.log(`   Date: ${wd.Date}, Name: ${wd.Name}, Status: ${wd.Workday_Status}`);
      console.log(`   Fuel_Received: ${wd.Fuel_Received_L}л / ${wd.Fuel_Received_KG}кг`);
      console.log(`   Issued TZA: ${wd.Fuel_Issued_TZA_L}л / ${wd.Fuel_Issued_TZA_KG}кг`);
      console.log(`   Issued VS: ${wd.Fuel_Issued_VS_L}л / ${wd.Fuel_Issued_VS_KG}кг`);
    });
  }
  
  // Проверить где еще есть записи за эту дату
  console.log('\n\n2️⃣ ВСЕ операции за 19.05.2026 (независимо от Workday):\n');
  
  const { data: allTza } = await supabase
    .from('Fuel_Dispensing_TZA')
    .select('*')
    .like('Date', '19.05.2026%');
  
  const { data: allVs } = await supabase
    .from('Fuel_Dispensing_VS')
    .select('*')
    .like('Date', '19.05.2026%');
  
  const { data: allRec } = await supabase
    .from('Fuel_Reception')
    .select('*')
    .like('Date', '19.05.2026%');
  
  console.log(`TZA операции: ${allTza?.length || 0} записей`);
  let tzaVolume = 0, tzaMass = 0;
  allTza?.forEach(op => {
    tzaVolume += op.Volume || 0;
    tzaMass += op.Mass || 0;
    console.log(`  - ID: ${op.id}, Workday_ID: ${op.Workday_ID}, Date: ${op.Date}, Vol: ${op.Volume}л, Mass: ${op.Mass}кг`);
  });
  console.log(`  ИТОГО TZA: ${tzaVolume.toFixed(2)}л / ${tzaMass.toFixed(2)}кг`);
  
  console.log(`\nVS операции: ${allVs?.length || 0} записей`);
  let vsVolume = 0, vsMass = 0;
  allVs?.forEach(op => {
    vsVolume += op.Volume || 0;
    vsMass += op.Mass || 0;
    console.log(`  - ID: ${op.id}, Workday_ID: ${op.Workday_ID}, Date: ${op.Date}, Vol: ${op.Volume}л, Mass: ${op.Mass}кг`);
  });
  console.log(`  ИТОГО VS: ${vsVolume.toFixed(2)}л / ${vsMass.toFixed(2)}кг`);
  
  console.log(`\nReception операции: ${allRec?.length || 0} записей`);
  let recVolume = 0, recMass = 0;
  allRec?.forEach(op => {
    recVolume += op.Volume || 0;
    recMass += op.Mass || 0;
    console.log(`  - ID: ${op.id}, Workday_ID: ${op.Workday_ID}, Date: ${op.Date}, Vol: ${op.Volume}л, Mass: ${op.Mass}кг`);
  });
  console.log(`  ИТОГО Reception: ${recVolume.toFixed(2)}л / ${recMass.toFixed(2)}кг`);
  
  process.exit(0);
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
