import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('students').select('*, classes(*, schools(name))').limit(1);
  console.log('Sample student:', JSON.stringify(data, null, 2));
}
run();
