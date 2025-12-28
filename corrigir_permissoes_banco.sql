-- SCRIPT DE CORREÇÃO TOTAL DE PERMISSÕES (RLS)
-- Rode este script no SQL Editor do Supabase para corrigir o erro de exclusão.

-- 1. Forçar atualização do seu usuário para ADMIN
UPDATE auth.users
SET raw_user_meta_data = 
  jsonb_build_object(
    'role', 'ADMIN',
    'permissions', jsonb_build_array('dashboard', 'schools', 'staff', 'students', 'allotment', 'admin')
  )
WHERE email = 'giovani@semedcastanhal.pa.gov.br';

-- 2. Liberar acesso total na tabela de TURMAS (classes)
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao Total Classes" ON classes;

CREATE POLICY "Permissao Total Classes"
ON classes
FOR ALL
USING (true) -- Permite que qualquer usuário logado mexa, para testar. Depois pode restringir.
WITH CHECK (true);

-- 3. Liberar acesso total na tabela de ESTUDANTES (students)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao Total Students" ON students;

CREATE POLICY "Permissao Total Students"
ON students
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Liberar acesso total na tabela de LOTACOES (allotments)
ALTER TABLE allotments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao Total Allotments" ON allotments;

CREATE POLICY "Permissao Total Allotments"
ON allotments
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Liberar acesso total na tabela de ESCOLAS (schools)
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao Total Schools" ON schools;

CREATE POLICY "Permissao Total Schools"
ON schools
FOR ALL
USING (true)
WITH CHECK (true);
