-- =====================================================
-- PRODUCT QUERIES AND PERFORMANCE TESTING
-- =====================================================
-- Purpose: Sample queries and performance tests for the enhanced products schema
-- Performance targets: <100ms for filtered queries, <50ms for indexed lookups
-- =====================================================

-- =====================================================
-- BASIC PRODUCT QUERIES
-- =====================================================

-- 1. Get all active products with basic info
-- Expected: Fast scan with active index
-- Performance target: <50ms for 11K products
/*
SELECT
  id,
  ploomes_product_id,
  name,
  code,
  category,
  brand,
  base_price,
  stock_quantity
FROM products_enhanced
WHERE active = true
ORDER BY name
LIMIT 100;
*/

-- 2. Search products by name (full-text search)
-- Expected: Use gin index for fast text search
-- Performance target: <100ms
/*
SELECT
  id,
  name,
  code,
  category,
  brand,
  base_price,
  ts_rank(
    to_tsvector('portuguese', name || ' ' || COALESCE(code, '')),
    plainto_tsquery('portuguese', 'Atlas compressor')
  ) as relevance
FROM products_enhanced
WHERE
  active = true
  AND to_tsvector('portuguese', name || ' ' || COALESCE(code, '')) @@
      plainto_tsquery('portuguese', 'Atlas compressor')
ORDER BY relevance DESC, name
LIMIT 20;
*/

-- 3. Filter by category and brand (most common dashboard query)
-- Expected: Use composite index for fast filtering
-- Performance target: <50ms
/*
SELECT
  COUNT(*) as total_products,
  AVG(base_price) as avg_price,
  MIN(base_price) as min_price,
  MAX(base_price) as max_price
FROM products_enhanced
WHERE
  active = true
  AND category = 'Atlas Products'
  AND brand = 'Atlas';
*/

-- =====================================================
-- SERVICE-SPECIFIC QUERIES
-- =====================================================

-- 4. Get all CIA services with specifications
-- Expected: Join optimization with service type filtering
/*
SELECT
  p.name,
  p.code,
  p.base_price,
  ss.service_type,
  ss.duration_hours,
  ss.base_hourly_rate,
  ss.location_type
FROM products_enhanced p
JOIN service_specifications ss ON p.id = ss.product_id
WHERE
  p.active = true
  AND p.product_type = 'service'
  AND p.category = 'CIA Services'
ORDER BY ss.service_type, p.name;
*/

-- 5. Service pricing analysis
-- Expected: Aggregation with service type grouping
/*
SELECT
  ss.service_type,
  COUNT(*) as service_count,
  AVG(p.base_price) as avg_project_price,
  AVG(ss.base_hourly_rate) as avg_hourly_rate,
  AVG(ss.duration_hours) as avg_duration
FROM products_enhanced p
JOIN service_specifications ss ON p.id = ss.product_id
WHERE p.active = true
GROUP BY ss.service_type
ORDER BY service_count DESC;
*/

-- =====================================================
-- RENTAL-SPECIFIC QUERIES
-- =====================================================

-- 6. Available rental equipment
-- Expected: Rental availability filtering
/*
SELECT
  p.name,
  p.code,
  p.category,
  rs.total_units,
  rs.available_units,
  rs.daily_rate,
  rs.weekly_rate,
  rs.monthly_rate
FROM products_enhanced p
JOIN rental_specifications rs ON p.id = rs.product_id
WHERE
  p.active = true
  AND p.product_type = 'rental'
  AND rs.available_units > 0
ORDER BY p.category, p.name;
*/

-- 7. Rental utilization analysis
-- Expected: Aggregation with utilization calculations
/*
SELECT
  p.category,
  COUNT(*) as rental_products,
  SUM(rs.total_units) as total_units,
  SUM(rs.available_units) as available_units,
  SUM(rs.reserved_units) as reserved_units,
  ROUND(
    (SUM(rs.reserved_units)::NUMERIC / NULLIF(SUM(rs.total_units), 0)) * 100,
    2
  ) as utilization_percent
FROM products_enhanced p
JOIN rental_specifications rs ON p.id = rs.product_id
WHERE p.active = true
GROUP BY p.category
ORDER BY utilization_percent DESC;
*/

-- =====================================================
-- ADVANCED ANALYTICS QUERIES
-- =====================================================

-- 8. Product distribution by source system
-- Expected: Source system aggregation
/*
SELECT
  source_system,
  product_type,
  COUNT(*) as product_count,
  COUNT(*) FILTER (WHERE active = true) as active_count,
  ROUND(AVG(base_price), 2) as avg_price
FROM products_enhanced
GROUP BY source_system, product_type
ORDER BY source_system, product_type;
*/

-- 9. Brand performance analysis
-- Expected: Multi-level aggregation with brand metrics
/*
SELECT
  brand,
  COUNT(*) as total_products,
  COUNT(*) FILTER (WHERE active = true) as active_products,
  COUNT(*) FILTER (WHERE available_for_sale = true AND active = true) as sellable_products,
  ROUND(AVG(base_price) FILTER (WHERE active = true), 2) as avg_price,
  SUM(stock_quantity) FILTER (WHERE active = true) as total_stock
FROM products_enhanced
WHERE brand IS NOT NULL
GROUP BY brand
ORDER BY total_products DESC;
*/

-- 10. Complex search with multiple filters
-- Expected: Combined index usage for complex filtering
/*
SELECT
  p.id,
  p.name,
  p.code,
  p.brand,
  p.base_price,
  CASE
    WHEN p.product_type = 'service' THEN ss.service_type
    WHEN p.product_type = 'rental' THEN 'rental_' || COALESCE(rs.available_units::TEXT, '0')
    ELSE 'standard'
  END as type_info
FROM products_enhanced p
LEFT JOIN service_specifications ss ON p.id = ss.product_id AND p.product_type = 'service'
LEFT JOIN rental_specifications rs ON p.id = rs.product_id AND p.product_type = 'rental'
WHERE
  p.active = true
  AND p.base_price BETWEEN 100 AND 1000
  AND (
    p.brand IN ('Atlas', 'Ingersoll')
    OR p.category LIKE '%CIA%'
  )
ORDER BY p.base_price DESC
LIMIT 50;
*/

-- =====================================================
-- MATERIALIZED VIEW QUERIES
-- =====================================================

-- 11. Dashboard summary using materialized views
-- Expected: Near-instant response from pre-computed data
/*
SELECT
  'Products' as category,
  product_type,
  category as subcategory,
  total_products,
  active_products,
  avg_price
FROM product_summary_by_category
WHERE total_products > 10
ORDER BY total_products DESC;
*/

-- 12. Service utilization dashboard
-- Expected: Fast aggregated service data
/*
SELECT
  service_type,
  total_services,
  active_services,
  ROUND(avg_hourly_rate, 2) as avg_hourly_rate,
  ROUND(avg_duration_hours, 1) as avg_duration_hours
FROM service_summary
ORDER BY total_services DESC;
*/

-- 13. Rental availability dashboard
-- Expected: Real-time rental metrics
/*
SELECT
  category,
  brand,
  total_rental_products,
  total_units,
  available_units,
  ROUND(
    (available_units::NUMERIC / NULLIF(total_units, 0)) * 100,
    1
  ) as availability_percent,
  ROUND(avg_daily_rate, 2) as avg_daily_rate
FROM rental_availability_summary
ORDER BY total_units DESC;
*/

-- =====================================================
-- SYNC AND MAINTENANCE QUERIES
-- =====================================================

-- 14. Sync performance monitoring
-- Expected: Fast sync log analysis
/*
SELECT
  sync_type,
  status,
  AVG(duration_seconds) as avg_duration,
  AVG(records_per_second) as avg_speed,
  COUNT(*) as sync_count,
  MAX(completed_at) as last_sync
FROM product_sync_logs
WHERE started_at >= NOW() - INTERVAL '7 days'
GROUP BY sync_type, status
ORDER BY sync_type, status;
*/

-- 15. Products needing sync (stale data detection)
-- Expected: Sync version and timestamp analysis
/*
SELECT
  product_type,
  COUNT(*) as stale_count,
  MIN(last_sync_at) as oldest_sync,
  MAX(last_sync_at) as newest_sync
FROM products_enhanced
WHERE
  last_sync_at < NOW() - INTERVAL '24 hours'
  OR sync_version < 2
GROUP BY product_type
ORDER BY stale_count DESC;
*/

-- =====================================================
-- PERFORMANCE TESTING QUERIES
-- =====================================================

-- Test 1: Index effectiveness on large dataset
-- Should use idx_products_enhanced_brand_active
/*
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM products_enhanced
WHERE active = true AND brand = 'Atlas';
*/

-- Test 2: Full-text search performance
-- Should use idx_products_enhanced_name_search
/*
EXPLAIN (ANALYZE, BUFFERS)
SELECT name, code FROM products_enhanced
WHERE to_tsvector('portuguese', name) @@ plainto_tsquery('portuguese', 'compressor')
LIMIT 10;
*/

-- Test 3: Complex join performance
-- Should use join indexes efficiently
/*
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.name, ss.service_type, rs.daily_rate
FROM products_enhanced p
LEFT JOIN service_specifications ss ON p.id = ss.product_id
LEFT JOIN rental_specifications rs ON p.id = rs.product_id
WHERE p.active = true
LIMIT 100;
*/

-- Test 4: Aggregation performance on partitioned table
-- Should use partition elimination
/*
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  product_type,
  COUNT(*),
  AVG(base_price)
FROM products_enhanced
WHERE active = true
GROUP BY product_type;
*/

-- =====================================================
-- DATA QUALITY QUERIES
-- =====================================================

-- 16. Missing or invalid data detection
/*
SELECT
  'Missing Names' as issue,
  COUNT(*) as count
FROM products_enhanced
WHERE name IS NULL OR TRIM(name) = ''

UNION ALL

SELECT
  'Missing Codes' as issue,
  COUNT(*) as count
FROM products_enhanced
WHERE code IS NULL OR TRIM(code) = ''

UNION ALL

SELECT
  'Invalid Prices' as issue,
  COUNT(*) as count
FROM products_enhanced
WHERE base_price < 0

UNION ALL

SELECT
  'Missing Categories' as issue,
  COUNT(*) as count
FROM products_enhanced
WHERE category IS NULL AND active = true;
*/

-- 17. Duplicate detection
/*
SELECT
  code,
  COUNT(*) as duplicate_count,
  STRING_AGG(name, '; ') as names
FROM products_enhanced
WHERE code IS NOT NULL AND active = true
GROUP BY code
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
*/

-- =====================================================
-- MAINTENANCE COMMANDS
-- =====================================================

-- Refresh all materialized views
-- SELECT refresh_product_materialized_views();

-- Update table statistics for better query planning
-- ANALYZE products_enhanced;
-- ANALYZE service_specifications;
-- ANALYZE rental_specifications;

-- Check partition statistics
/*
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE tablename LIKE 'products_enhanced%'
ORDER BY tablename, attname;
*/

-- Monitor index usage
/*
SELECT
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename LIKE 'products_enhanced%'
ORDER BY idx_tup_read DESC;
*/

-- =====================================================
-- BUSINESS LOGIC EXAMPLES
-- =====================================================

-- 18. Product recommendation based on category
/*
WITH category_stats AS (
  SELECT
    category,
    AVG(base_price) as avg_category_price,
    STDDEV(base_price) as price_stddev
  FROM products_enhanced
  WHERE active = true AND base_price > 0
  GROUP BY category
)
SELECT
  p.name,
  p.code,
  p.base_price,
  cs.avg_category_price,
  CASE
    WHEN p.base_price < cs.avg_category_price - cs.price_stddev THEN 'Budget Option'
    WHEN p.base_price > cs.avg_category_price + cs.price_stddev THEN 'Premium Option'
    ELSE 'Standard Option'
  END as price_tier
FROM products_enhanced p
JOIN category_stats cs ON p.category = cs.category
WHERE p.active = true AND p.category = 'Atlas Products'
ORDER BY p.base_price;
*/

-- 19. Cross-sell opportunities (products often bought together)
-- This would require sales history data, showing structure for future implementation
/*
-- WITH product_combinations AS (
--   SELECT
--     s1.product_id as product1,
--     s2.product_id as product2,
--     COUNT(*) as frequency
--   FROM sales_products s1
--   JOIN sales_products s2 ON s1.sale_id = s2.sale_id AND s1.product_id != s2.product_id
--   GROUP BY s1.product_id, s2.product_id
--   HAVING COUNT(*) >= 3
-- )
-- SELECT
--   p1.name as main_product,
--   p2.name as recommended_product,
--   pc.frequency as times_bought_together
-- FROM product_combinations pc
-- JOIN products_enhanced p1 ON pc.product1 = p1.id
-- JOIN products_enhanced p2 ON pc.product2 = p2.id
-- WHERE p1.id = $1 -- Input: specific product ID
-- ORDER BY pc.frequency DESC
-- LIMIT 5;
*/

COMMENT ON SCHEMA public IS 'Product queries and performance tests for 11K+ product optimization';

-- =====================================================
-- QUERY PERFORMANCE BENCHMARKS
-- =====================================================

-- Expected performance targets for 11,793 products:
-- 1. Simple filtered queries: <50ms
-- 2. Full-text search: <100ms
-- 3. Complex joins with aggregation: <200ms
-- 4. Materialized view queries: <10ms
-- 5. Sync operations: 100+ products/second

-- Key indexes that should be used:
-- - idx_products_enhanced_active (for active filtering)
-- - idx_products_enhanced_brand_active (for brand filtering)
-- - idx_products_enhanced_category_active (for category filtering)
-- - idx_products_enhanced_name_search (for text search)
-- - idx_products_enhanced_type_active (for product type filtering)

-- Partition benefits:
-- - Parallel query execution across 4 partitions
-- - Better cache utilization for large scans
-- - Improved maintenance operations (VACUUM, ANALYZE)
-- - Partition elimination for hash-based queries