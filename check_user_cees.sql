-- 1. Verificar se o usuário existe e suas permissões atuais
SELECT id,
    email,
    role,
    raw_app_meta_data,
    -- Aqui geralmente ficam as roles (ADMIN, DIRETOR, etc)
    raw_user_meta_data,
    created_at,
    last_sign_in_at
FROM auth.users
WHERE email = 'cees@cees.com';
-- 2. Se o usuário existir e você quiser garantir que ele tenha TODAS as permissões (Role: ADMIN), execute:
-- CUIDADO: Isso sobrescreve os metadados de app do usuário.
UPDATE auth.users
SET raw_app_meta_data = jsonb_build_object(
        'provider',
        'email',
        'providers',
        ARRAY ['email'],
        'role',
        'ADMIN',
        'permissions',
        ARRAY ['all']
    )
WHERE email = 'cees@cees.com';
-- 3. Se o usuário NÃO existir e você quiser criá-lo via SQL (Opcional - geralmente cria-se pelo painel ou app):
-- INSERT INTO auth.users ... (é complexo criar manualmente por causa da criptografia de senha, melhor usar o painel 'Authentication' > 'Add User')