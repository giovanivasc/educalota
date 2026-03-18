-- ATUALIZAÇÃO DA FUNÇÃO GET_ALL_USERS NO SUPABASE
-- Copie e cole este código no SQL Editor do seu Dashboard Supabase (https://supabase.com/dashboard)
-- Essa atualização garante que o banco de dados extraia e envie o "Nome" (name) para a tela de quem agendar a avaliação.

CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  id uuid,
  email varchar,
  role text,
  permissions jsonb,
  name text
)
SECURITY DEFINER
AS $$
BEGIN
  -- Permite apenas que usuários logados executem
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado. Faça login no sistema.';
  END IF;

  RETURN QUERY
  SELECT
    au.id,
    au.email::varchar,
    (au.raw_user_meta_data->>'role')::text AS role,
    COALESCE(au.raw_user_meta_data->'permissions', '[]'::jsonb) AS permissions,
    (au.raw_user_meta_data->>'name')::text AS name
  FROM auth.users au
  ORDER BY au.email ASC;
END;
$$ LANGUAGE plpgsql;
