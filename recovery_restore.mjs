import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zjmwnprjxowljawtpdxz.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbXducHJqeG93bGphd3RwZHh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA1OTkwOSwiZXhwIjoyMDkzNjM1OTA5fQ.Ulia_PsIqLaVnYY-gGwp_idMp5NjuLHYbV-6PQxiTZs';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function restoreData() {
  console.log('🔧 ЭТАП 2-3: ВОССТАНОВЛЕНИЕ ОПЕРАЦИЙ');
  console.log('='.repeat(60));

  // Получить все потерянные операции
  const { data: tzaOrphaned } = await supabase
    .from('Fuel_Dispensing_TZA')
    .select('*')
    .in('Workday_ID', [2, 6, 14, 21, 29, 36, 44])
    .order('Date', { ascending: false });

  const { data: vsOrphaned } = await supabase
    .from('Fuel_Dispensing_VS')
    .select('*')
    .in('Workday_ID', [2, 14, 21, 29, 43])
    .order('Date', { ascending: false });

  // Для каждой операции найти правильный Workday_ID
  const affectedWorkdayIds = new Set();

  console.log('\n📝 Восстановление операций ТЗА...');
  if (tzaOrphaned && tzaOrphaned.length > 0) {
    for (const op of tzaOrphaned) {
      const dateFormatted = op.Date.split(' ')[0]; // Extract date part

      // Найти Workday с этой датой и статусом Closed
      const { data: correctWorkday } = await supabase
        .from('Workdays')
        .select('id')
        .eq('Date', dateFormatted)
        .eq('Workday_Status', 'Closed')
        .limit(1);

      if (correctWorkday && correctWorkday.length > 0) {
        const correctId = correctWorkday[0].id;
        console.log(`   ✅ Op ${op.id}: ${op.Date} -> Workday #${correctId} (было #${op.Workday_ID})`);

        // Update operation
        const { error } = await supabase
          .from('Fuel_Dispensing_TZA')
          .update({ Workday_ID: correctId })
          .eq('id', op.id);

        if (error) {
          console.error(`   ❌ Ошибка при обновлении: ${error.message}`);
        } else {
          affectedWorkdayIds.add(correctId);
          affectedWorkdayIds.add(op.Workday_ID);
        }
      } else {
        console.log(`   ⚠️  Op ${op.id}: ${op.Date} -> Workday не найден`);
      }
    }
  }

  console.log('\n📝 Восстановление операций ВС...');
  if (vsOrphaned && vsOrphaned.length > 0) {
    for (const op of vsOrphaned) {
      const dateFormatted = op.Date.split(' ')[0]; // Extract date part

      // Найти Workday с этой датой и статусом Closed
      const { data: correctWorkday } = await supabase
        .from('Workdays')
        .select('id')
        .eq('Date', dateFormatted)
        .eq('Workday_Status', 'Closed')
        .limit(1);

      if (correctWorkday && correctWorkday.length > 0) {
        const correctId = correctWorkday[0].id;
        console.log(`   ✅ Op ${op.id}: ${op.Date} -> Workday #${correctId} (было #${op.Workday_ID})`);

        // Update operation
        const { error } = await supabase
          .from('Fuel_Dispensing_VS')
          .update({ Workday_ID: correctId })
          .eq('id', op.id);

        if (error) {
          console.error(`   ❌ Ошибка при обновлении: ${error.message}`);
        } else {
          affectedWorkdayIds.add(correctId);
          affectedWorkdayIds.add(op.Workday_ID);
        }
      } else {
        console.log(`   ⚠️  Op ${op.id}: ${op.Date} -> Workday не найден`);
      }
    }
  }

  // ЭТАП 4: Пересчитать агрегаты для затронутых смен
  console.log('\n' + '='.repeat(60));
  console.log('🔢 ЭТАП 4: ПЕРЕСЧИСЛЕНИЕ АГРЕГАТОВ');
  console.log('Затронутые Workday:', Array.from(affectedWorkdayIds).join(', '));

  for (const workdayId of affectedWorkdayIds) {
    // Получить все операции для этого Workday
    const { data: tzaOps } = await supabase
      .from('Fuel_Dispensing_TZA')
      .select('Volume, Mass')
      .eq('Workday_ID', workdayId);

    const { data: vsOps } = await supabase
      .from('Fuel_Dispensing_VS')
      .select('Volume, Mass')
      .eq('Workday_ID', workdayId);

    const tzaVolume = (tzaOps || []).reduce((sum, op) => sum + (op.Volume || 0), 0);
    const tzaMass = (tzaOps || []).reduce((sum, op) => sum + (op.Mass || 0), 0);
    const vsVolume = (vsOps || []).reduce((sum, op) => sum + (op.Volume || 0), 0);
    const vsMass = (vsOps || []).reduce((sum, op) => sum + (op.Mass || 0), 0);

    console.log(`\n   Workday #${workdayId}:`);
    console.log(`     TZA: ${tzaVolume}л, ${tzaMass}кг`);
    console.log(`     VS: ${vsVolume}л, ${vsMass}кг`);

    // Update Workdays with new aggregates
    const { error } = await supabase
      .from('Workdays')
      .update({
        Fuel_Issued_TZA_L: tzaVolume,
        Fuel_Issued_TZA_KG: tzaMass,
        Fuel_Issued_VS_L: vsVolume,
        Fuel_Issued_VS_KG: vsMass
      })
      .eq('id', workdayId);

    if (error) {
      console.error(`     ❌ Ошибка при обновлении агрегатов: ${error.message}`);
    } else {
      console.log(`     ✅ Агрегаты обновлены`);
    }
  }

  // ЭТАП 5: Проверка результатов
  console.log('\n' + '='.repeat(60));
  console.log('✅ ЭТАП 5: ПРОВЕРКА РЕЗУЛЬТАТОВ');

  for (const workdayId of affectedWorkdayIds) {
    const { data: workday } = await supabase
      .from('Workdays')
      .select('id, Date, Name, Workday_Status, Fuel_Issued_TZA_L, Fuel_Issued_TZA_KG, Fuel_Issued_VS_L, Fuel_Issued_VS_KG')
      .eq('id', workdayId)
      .single();

    if (workday) {
      console.log(`\n📊 Workday #${workday.id} (${workday.Date})`);
      console.log(`   Name: ${workday.Name}`);
      console.log(`   Status: ${workday.Workday_Status}`);
      console.log(`   TZA: ${workday.Fuel_Issued_TZA_L}л, ${workday.Fuel_Issued_TZA_KG}кг`);
      console.log(`   VS: ${workday.Fuel_Issued_VS_L}л, ${workday.Fuel_Issued_VS_KG}кг`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Восстановление завершено!');
}

restoreData().catch(console.error);
