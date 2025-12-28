-- ATUALIZAÇÃO DE PERMISSÕES DO USUÁRIO
-- Copie e cole este código no SQL Editor do seu Dashboard Supabase (https://supabase.com/dashboard)

-- 1. Conceder permissão total (Admin) e todas as funcionalidades nos metadados do usuário
UPDATE auth.users
SET raw_user_meta_data = 
  jsonb_build_object(
    'role', 'ADMIN',
    'permissions', jsonb_build_array('dashboard', 'schools', 'staff', 'students', 'allotment', 'admin')
  ),
  raw_app_meta_data = 
  jsonb_build_object(
    'role', 'ADMIN',
    'permissions', jsonb_build_array('dashboard', 'schools', 'staff', 'students', 'allotment', 'admin')
  )
WHERE email = 'giovani@semedcastanhal.pa.gov.br';

-- 2. Garantir que as tabelas tenham policies que permitam a deleção por Admins
-- (Este é um exemplo de correção genérica, caso suas policies não estejam verificando o role corretamente)

-- Exemplo para tabela de turmas (classes)
-- DROP POLICY IF EXISTS "Permitir delete para admins" ON classes;
-- CREATE POLICY "Permitir delete para admins" ON classes
-- FOR DELETE
-- TO authenticated
-- USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'ADMIN');

-- Mensagem de confirmação (opcional)
SELECT email, raw_user_meta_data, raw_app_meta_data FROM auth.users WHERE email = 'giovani@semedcastanhal.pa.gov.br';
