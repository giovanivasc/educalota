-- Script para conceder admin e resetar senha de Claudia Batista
-- Execute este script no SQL Editor do Supabase
-- Garante que a extensão pgcrypto está habilitada para gerar o hash da senha
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE auth.users
SET -- Define a nova senha hash (mgam0306)
    encrypted_password = crypt('mgam0306', gen_salt('bf')),
    -- Define permissões de Admin nos metadados do usuário
    raw_user_meta_data = jsonb_build_object(
        'name',
        COALESCE(raw_user_meta_data->>'name', 'Claudia Batista'),
        -- Mantém nome se existir ou define padrao
        'role',
        'ADMIN',
        'permissions',
        jsonb_build_array(
            'dashboard',
            'schools',
            'staff',
            'students',
            'allotment',
            'reports',
            'admin'
        )
    ),
    -- Sincroniza metadados do app
    raw_app_meta_data = jsonb_build_object(
        'provider',
        'email',
        'providers',
        jsonb_build_array('email'),
        'role',
        'ADMIN'
    ),
    updated_at = NOW()
WHERE email = 'claudia.batista@semedcastanhal.pa.gov.br';
-- Confirmação
SELECT email,
    raw_user_meta_data
FROM auth.users
WHERE email = 'claudia.batista@semedcastanhal.pa.gov.br';