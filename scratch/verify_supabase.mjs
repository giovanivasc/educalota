import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lvcqsdfhzlfdpspewpsc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Y3FzZGZoemxmZHBzcGV3cHNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDI4MjAsImV4cCI6MjA4MjM3ODgyMH0._7ltMS7Dumpjv3bxy46LPd-gzdvqPgGpAXj7y9QiBXU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyConnection() {
  console.log('Verificante conexão com Supabase...');
  try {
    const { data, error } = await supabase.from('students').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('Erro ao conectar ao Supabase:', error.message);
      process.exit(1);
    }
    console.log('Conexão bem-sucedida!');
    console.log('Chaves verificadas e funcionando corretamente.');
  } catch (err) {
    console.error('Exceção ao tentar conectar:', err.message);
    process.exit(1);
  }
}

verifyConnection();
