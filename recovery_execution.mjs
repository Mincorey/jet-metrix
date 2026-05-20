import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zjmwnprjxowljawtpdxz.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbXducHJqeG93bGphd3RwZHh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA1OTkwOSwiZXhwIjoyMDkzNjM1OTA5fQ.Ulia_PsIqLaVnYY-gGwp_idMp5NjuLHYbV-6PQxiTZs';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function runRecovery() {
  console.log('🚀 ЭТАП 1: ДИАГНОСТИКА - Проверка потерянных операций');
  console.log('='.repeat(60));

  // 1.1 Потерянные операции ТЗА
  const { data: tzaOrphaned, error: tzaError } = await supabase
    .from('Fuel_Dispensing_TZA')
    .select('*')
    .in('Workday_ID', [2, 6, 14, 21, 29, 36, 44])
    .order('Date', { ascending: false });

  if (tzaError) {
    console.error('❌ Ошибка при загрузке операций ТЗА:', tzaError);
  } else {
    console.log(`\n📊 Найдено потерянных операций ТЗА: ${tzaOrphaned?.length || 0}`);
    if (tzaOrphaned && tzaOrphaned.length > 0) {
      tzaOrphaned.forEach(op => {
        console.log(`   ID: ${op.id}, Date: ${op.Date}, Workday_ID: ${op.Workday_ID}, Volume: ${op.Volume}л, Mass: ${op.Mass}кг`);
      });
    }
  }

  // 1.2 Потерянные операции ВС
  const { data: vsOrphaned, error: vsError } = await supabase
    .from('Fuel_Dispensing_VS')
    .select('*')
    .in('Workday_ID', [2, 14, 21, 29, 43])
    .order('Date', { ascending: false });

  if (vsError) {
    console.error('❌ Ошибка при загрузке операций ВС:', vsError);
  } else {
    console.log(`\n📊 Найдено потерянных операций ВС: ${vsOrphaned?.length || 0}`);
    if (vsOrphaned && vsOrphaned.length > 0) {
      vsOrphaned.forEach(op => {
        console.log(`   ID: ${op.id}, Date: ${op.Date}, Workday_ID: ${op.Workday_ID}, Volume: ${op.Volume}л, Mass: ${op.Mass}кг`);
      });
    }
  }

  // 1.3 Проверить, существуют ли правильные Workday для этих дат
  console.log(`\n🔍 Проверка правильных Workday для этих дат...`);

  if (tzaOrphaned && tzaOrphaned.length > 0) {
    const dates = [...new Set(tzaOrphaned.map(op => op.Date))];

    for (const date of dates) {
      const { data: workdays } = await supabase
        .from('Workdays')
        .select('id, Date, Name, Workday_Status')
        .eq('Date', date)
        .order('id', { ascending: false });

      if (workdays && workdays.length > 0) {
        console.log(`\n   Date: ${date}`);
        workdays.forEach(w => {
          console.log(`     - Workday #${w.id}: ${w.Name} (${w.Workday_Status})`);
        });
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Диагностика завершена');
  console.log('\nРекомендация: Если найдены операции выше, выполните ЭТАП 3 для восстановления');
}

runRecovery().catch(console.error);
