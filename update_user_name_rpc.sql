-- ATUALIZAÇÃO DA FUNÇÃO QUE EDITA OS DADOS DOS USUÁRIOS
-- Copie e cole este código no SQL Editor do seu Dashboard Supabase (https://supabase.com/dashboard)
-- Essa atualização garante que, ao editar um usuário existente no painel Admin, o novo Nome seja salvo definitivamente.

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
  -- Apenas administradores podem atualizar perfils (Opcional, segurança extra)
  IF NOT (COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), 'USER') IN ('ADMIN', 'SUPERADMIN')) THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem editar permissões.';
  END IF;

  -- Atualiza o registro no auth.users do Supabase
  IF new_name IS NOT NULL AND new_name <> '' THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
          jsonb_set(
            jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', to_jsonb(new_role)),
            '{permissions}', new_permissions
          ),
          '{name}', to_jsonb(new_name)
        )
    WHERE id = target_user_id;
  ELSE
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
          jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', to_jsonb(new_role)),
          '{permissions}', new_permissions
        )
    WHERE id = target_user_id;
  END IF;

END;
$$ LANGUAGE plpgsql;
