import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { count: countClasses } = await supabase.from('classes').select('*', { count: 'exact', head: true });
  console.log('Total Classes:', countClasses);
  const { count: countStaff } = await supabase.from('staff').select('*', { count: 'exact', head: true });
  console.log('Total Staff:', countStaff);
  
  const { data, error } = await supabase.from('allotments').select('*, classes(shift, series, section), staff(name, contract_type, role, hours_total)').limit(1);
  console.log('Sample allotment with relations:', JSON.stringify(data, null, 2));
}
run();
