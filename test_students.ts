import { supabase } from './src/lib/supabase';
async function run() {
    const { data, error } = await supabase.from('students').select('*, classes(*, schools(name))').limit(1);
    console.log('Sample student:', JSON.stringify(data, null, 2), error);
}
run();
