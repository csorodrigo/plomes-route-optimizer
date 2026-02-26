-- 1. Renomear role existente para novo esquema
UPDATE users
SET role = 'usuario_padrao'
WHERE role = 'usuario';

-- 2. Adicionar campo de vínculo com Ploomes na tabela de usuários
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ploomes_person_id INTEGER;

-- 3. Adicionar person_id na tabela de sales (para filtrar clientes por vendedor)
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS person_id INTEGER;

