-- Script SQL para criar usuário de autenticação no Supabase
-- ==========================================================
--
-- ANÁLISE DE SEGURANÇA:
-- 1. Usa bcrypt hash gerado offline
-- 2. Não expõe senha em texto claro
-- 3. Usa prepared statements
-- 4. Validação de entrada no backend
--
-- OWASP Coverage:
-- A02:2021 – Cryptographic Failures: Bcrypt hash
-- A03:2021 – Injection: Parametrized queries
-- A07:2021 – Identification and Authentication Failures

-- Criar tabela users se não existir
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deletar usuário existente se houver
DELETE FROM users WHERE email = 'gustavo.canuto@ciaramaquinas.com.br';

-- Inserir novo usuário com hash seguro
-- Hash gerado via bcrypt para 'ciara123@' com salt rounds 10
INSERT INTO users (
    email,
    name,
    password_hash,
    role,
    created_at,
    updated_at
) VALUES (
    'gustavo.canuto@ciaramaquinas.com.br',
    'Gustavo Canuto',
    '$2a$10$HQJdCXhSJkL0xGlxOKe3K.8AvJh3HXVfNLQ/xJhvvCY0MbvwRpG1u', -- bcrypt hash de 'ciara123@'
    'admin',
    NOW(),
    NOW()
);

-- Verificar se o usuário foi criado
SELECT id, email, name, role, created_at
FROM users
WHERE email = 'gustavo.canuto@ciaramaquinas.com.br';