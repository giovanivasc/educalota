import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data, error } = await supabase.from('evaluation_requests').select('*').limit(1);
if (data && data.length > 0) console.log(Object.keys(data[0]));
else console.log(error);
