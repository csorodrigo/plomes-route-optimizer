-- Corrigir tipo de dados da tabela customers
-- Os IDs do Ploome são strings, não números

-- Primeiro, vamos alterar a tabela customers
ALTER TABLE customers
ALTER COLUMN id TYPE VARCHAR(50);

-- Comentário
COMMENT ON COLUMN customers.id IS 'ID do cliente (pode ser string do Ploome)';