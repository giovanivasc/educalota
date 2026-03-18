-- ATUALIZAÇÃO UNIVERSAL DE BUSCA DE USUÁRIOS
-- Copie e cole este código no SQL Editor do Supabase para garantir que o sistema encontre o Nome dos servidores.

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  SELECT
    au.id,
    au.email::varchar,
    COALESCE(au.raw_user_meta_data->>'role', 'USER')::text AS role,
    COALESCE(au.raw_user_meta_data->'permissions', '[]'::jsonb) AS permissions,
    -- Busca por 'name', 'full_name' ou 'displayName' para garantir compatibilidade total
    COALESCE(
      au.raw_user_meta_data->>'name', 
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'displayName'
    )::text AS name
  FROM auth.users au
  ORDER BY au.email ASC;
END;
$$ LANGUAGE plpgsql;

-- ATUALIZAÇÃO DA FUNÇÃO DE EDIÇÃO
CREATE OR REPLACE FUNCTION update_user_access(
  target_user_id uuid, 
  new_role text, 
  new_permissions jsonb, 
  new_name text DEFAULT NULL
)
RETURNS void
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), 'USER') IN ('ADMIN', 'SUPERADMIN')) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', new_role,
      'permissions', new_permissions,
      'name', new_name,
      'full_name', new_name -- Grava nos dois para garantir retrocompatibilidade
    )
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql;
