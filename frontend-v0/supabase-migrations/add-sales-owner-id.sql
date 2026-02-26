-- Adiciona owner_id em sales para vincular negócios ao usuário (OwnerId) do Ploomes
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS owner_id INTEGER;

