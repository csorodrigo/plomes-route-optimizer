
-- Verify products were updated
SELECT
  COUNT(*) as total_com_produtos,
  COUNT(DISTINCT customer_id) as clientes_unicos
FROM sales
WHERE products IS NOT NULL
  AND jsonb_array_length(products) > 0;
