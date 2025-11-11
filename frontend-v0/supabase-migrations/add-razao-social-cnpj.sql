-- ============================================================================
-- Migration: Adicionar campo razao_social à tabela customers
-- Data: 2025-11-11
-- Descrição: Adiciona campo para Razão Social (nome legal da empresa)
-- ============================================================================

-- Adicionar coluna razao_social se ainda não existir
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS razao_social TEXT;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.customers.razao_social IS 'Razão Social (nome legal) da empresa cliente';

-- Verificar que a coluna foi criada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customers'
  AND column_name IN ('razao_social', 'cnpj')
ORDER BY column_name;

-- ============================================================================
-- INSTRUÇÕES DE USO:
-- ============================================================================
--
-- 1. Acesse o painel do Supabase: https://supabase.com/dashboard
-- 2. Selecione seu projeto
-- 3. Vá em "SQL Editor" no menu lateral
-- 4. Cole este script SQL
-- 5. Clique em "Run" ou pressione Ctrl+Enter
--
-- OU via CLI:
--
-- supabase db push
--
-- ============================================================================
