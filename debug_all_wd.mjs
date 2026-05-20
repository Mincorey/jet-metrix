import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://zjmwnprjxowljawtpdxz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbXducHJqeG93bGphd3RwZHh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA1OTkwOSwiZXhwIjoyMDkzNjM1OTA5fQ.Ulia_PsIqLaVnYY-gGwp_idMp5NjuLHYbV-6PQxiTZs');

(async () => {
  const { data: wds } = await supabase.from('Workdays').select('*').order('id', { ascending: false }).limit(15);
  
  console.log('ПОСЛЕДНИЕ 15 WORKDAYS:\n');
  wds.forEach(wd => {
    const tza = wd.Fuel_Issued_TZA_L || 0;
    const vs = wd.Fuel_Issued_VS_L || 0;
    const status = wd.Workday_Status === 'Open' ? '🟢' : '🔴';
    console.log(`${status} ID: ${wd.id.toString().padStart(2)} | ${wd.Date} | ${wd.Name.slice(0, 15).padEnd(15)} | TZA: ${tza}л | VS: ${vs}л | Status: ${wd.Workday_Status}`);
  });
  
  // Найти ВСЕ операции TZA/VS и их Workday_ID
  console.log('\n\nВСЕ TZA ОПЕРАЦИИ И ИХ WORKDAY_ID:');
  const { data: tzaOps } = await supabase.from('Fuel_Dispensing_TZA').select('*').order('id', { ascending: false });
  
  const tzaByWorkday = {};
  tzaOps.forEach(op => {
    if (!tzaByWorkday[op.Workday_ID]) tzaByWorkday[op.Workday_ID] = 0;
    tzaByWorkday[op.Workday_ID] += op.Volume;
  });
  
  for (const wid in tzaByWorkday) {
    const wd = wds.find(w => w.id == wid);
    const hasValue = wd?.Fuel_Issued_TZA_L > 0;
    const status = hasValue ? '✅' : '❌';
    console.log(`${status} Workday_ID: ${wid} -> ${tzaByWorkday[wid].toFixed(2)}л (в Workdays: ${wd?.Fuel_Issued_TZA_L || 0}л)`);
  }
  
  console.log('\n\nВСЕ VS ОПЕРАЦИИ И ИХ WORKDAY_ID:');
  const { data: vsOps } = await supabase.from('Fuel_Dispensing_VS').select('*').order('id', { ascending: false });
  
  const vsByWorkday = {};
  vsOps.forEach(op => {
    if (!vsByWorkday[op.Workday_ID]) vsByWorkday[op.Workday_ID] = 0;
    vsByWorkday[op.Workday_ID] += op.Volume;
  });
  
  for (const wid in vsByWorkday) {
    const wd = wds.find(w => w.id == wid);
    const hasValue = wd?.Fuel_Issued_VS_L > 0;
    const status = hasValue ? '✅' : '❌';
    console.log(`${status} Workday_ID: ${wid} -> ${vsByWorkday[wid].toFixed(2)}л (в Workdays: ${wd?.Fuel_Issued_VS_L || 0}л)`);
  }
  
  process.exit(0);
})().catch(err => { console.error('Error:', err); process.exit(1); });
