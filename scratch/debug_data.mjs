import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lvcqsdfhzlfdpspewpsc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Y3FzZGZoemxmZHBzcGV3cHNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDI4MjAsImV4cCI6MjA4MjM3ODgyMH0._7ltMS7Dumpjv3bxy46LPd-gzdvqPgGpAXj7y9QiBXU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const tables = ['students', 'schools', 'classes', 'staff', 'allotments'];
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`Error fetching count for ${table}:`, error.message);
    } else {
      console.log(`${table}: ${count} rows`);
    }
  }
}

check();
