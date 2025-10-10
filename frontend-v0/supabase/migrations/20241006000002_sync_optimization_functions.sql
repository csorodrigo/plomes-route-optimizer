-- =====================================================
-- SYNC OPTIMIZATION FUNCTIONS
-- =====================================================
-- Purpose: Advanced sync functions for efficient product synchronization
-- Features: Batch processing, conflict resolution, performance monitoring
-- =====================================================

-- =====================================================
-- BATCH SYNC FUNCTION
-- =====================================================
-- Efficiently process large batches of products with conflict resolution

CREATE OR REPLACE FUNCTION sync_products_batch(
  products_data JSONB,
  sync_id TEXT DEFAULT NULL,
  dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE (
  operation TEXT,
  product_id TEXT,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  product_record JSONB;
  existing_product RECORD;
  new_product_id BIGINT;
  operation_type TEXT;
  sync_log_id TEXT;
BEGIN
  -- Generate sync ID if not provided
  sync_log_id := COALESCE(sync_id, 'batch_' || extract(epoch from now())::bigint || '_' || random()::text);

  -- Log batch start
  IF NOT dry_run THEN
    INSERT INTO product_sync_logs (sync_id, sync_type, sync_scope, status, batch_size)
    VALUES (sync_log_id, 'batch', 'products', 'running', jsonb_array_length(products_data));
  END IF;

  -- Process each product in the batch
  FOR product_record IN SELECT * FROM jsonb_array_elements(products_data)
  LOOP
    BEGIN
      -- Check if product exists
      SELECT *
      INTO existing_product
      FROM products_enhanced
      WHERE ploomes_product_id = (product_record->>'ploomes_product_id');

      IF FOUND THEN
        operation_type := 'update';

        -- Only update if source data is newer
        IF (product_record->>'source_updated_at')::timestamptz > existing_product.source_updated_at
           OR existing_product.source_updated_at IS NULL THEN

          IF NOT dry_run THEN
            UPDATE products_enhanced
            SET
              external_id = product_record->>'external_id',
              name = product_record->>'name',
              code = product_record->>'code',
              description = product_record->>'description',
              product_type = product_record->>'product_type',
              category = product_record->>'category',
              brand = product_record->>'brand',
              base_price = (product_record->>'base_price')::numeric,
              cost_price = (product_record->>'cost_price')::numeric,
              currency = COALESCE(product_record->>'currency', 'BRL'),
              weight = (product_record->>'weight')::numeric,
              dimensions = (product_record->>'dimensions')::jsonb,
              ncm_code = product_record->>'ncm_code',
              stock_quantity = (product_record->>'stock_quantity')::integer,
              unit_of_measure = COALESCE(product_record->>'unit_of_measure', 'UN'),
              active = COALESCE((product_record->>'active')::boolean, true),
              available_for_sale = COALESCE((product_record->>'available_for_sale')::boolean, true),
              source_system = COALESCE(product_record->>'source_system', 'ploomes'),
              source_created_at = (product_record->>'source_created_at')::timestamptz,
              source_updated_at = (product_record->>'source_updated_at')::timestamptz,
              sync_version = existing_product.sync_version + 1,
              last_sync_at = timezone('utc', now()),
              tags = CASE
                WHEN product_record ? 'tags' THEN
                  ARRAY(SELECT jsonb_array_elements_text(product_record->'tags'))
                ELSE existing_product.tags
              END,
              custom_fields = COALESCE((product_record->>'custom_fields')::jsonb, existing_product.custom_fields)
            WHERE id = existing_product.id;
          END IF;

          RETURN QUERY SELECT operation_type, product_record->>'ploomes_product_id', true, NULL::TEXT;
        ELSE
          RETURN QUERY SELECT 'skipped'::TEXT, product_record->>'ploomes_product_id', true, 'Data not newer'::TEXT;
        END IF;

      ELSE
        operation_type := 'create';

        IF NOT dry_run THEN
          INSERT INTO products_enhanced (
            ploomes_product_id, external_id, name, code, description,
            product_type, category, brand, base_price, cost_price, currency,
            weight, dimensions, ncm_code, stock_quantity, unit_of_measure,
            active, available_for_sale, source_system, source_created_at, source_updated_at,
            tags, custom_fields
          )
          VALUES (
            product_record->>'ploomes_product_id',
            product_record->>'external_id',
            product_record->>'name',
            product_record->>'code',
            product_record->>'description',
            COALESCE(product_record->>'product_type', 'product'),
            product_record->>'category',
            product_record->>'brand',
            COALESCE((product_record->>'base_price')::numeric, 0),
            (product_record->>'cost_price')::numeric,
            COALESCE(product_record->>'currency', 'BRL'),
            (product_record->>'weight')::numeric,
            (product_record->>'dimensions')::jsonb,
            product_record->>'ncm_code',
            COALESCE((product_record->>'stock_quantity')::integer, 0),
            COALESCE(product_record->>'unit_of_measure', 'UN'),
            COALESCE((product_record->>'active')::boolean, true),
            COALESCE((product_record->>'available_for_sale')::boolean, true),
            COALESCE(product_record->>'source_system', 'ploomes'),
            (product_record->>'source_created_at')::timestamptz,
            (product_record->>'source_updated_at')::timestamptz,
            CASE
              WHEN product_record ? 'tags' THEN
                ARRAY(SELECT jsonb_array_elements_text(product_record->'tags'))
              ELSE NULL
            END,
            (product_record->>'custom_fields')::jsonb
          )
          RETURNING id INTO new_product_id;
        END IF;

        RETURN QUERY SELECT operation_type, product_record->>'ploomes_product_id', true, NULL::TEXT;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT operation_type, product_record->>'ploomes_product_id', false, SQLERRM;
    END;
  END LOOP;

  -- Update sync log
  IF NOT dry_run THEN
    UPDATE product_sync_logs
    SET
      status = 'completed',
      completed_at = timezone('utc', now()),
      processed_records = jsonb_array_length(products_data)
    WHERE sync_id = sync_log_id;
  END IF;

END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INCREMENTAL SYNC FUNCTION
-- =====================================================
-- Identify products that need syncing based on timestamps

CREATE OR REPLACE FUNCTION get_products_for_incremental_sync(
  since_timestamp TIMESTAMPTZ DEFAULT NULL,
  batch_size INTEGER DEFAULT 1000
)
RETURNS TABLE (
  ploomes_product_id TEXT,
  last_sync_at TIMESTAMPTZ,
  sync_version INTEGER,
  sync_priority INTEGER
) AS $$
DECLARE
  default_since TIMESTAMPTZ;
BEGIN
  -- Default to last successful sync or 6 hours ago
  default_since := COALESCE(
    since_timestamp,
    (SELECT MAX(completed_at) FROM product_sync_logs WHERE status = 'completed'),
    timezone('utc', now()) - INTERVAL '6 hours'
  );

  RETURN QUERY
  SELECT
    p.ploomes_product_id,
    p.last_sync_at,
    p.sync_version,
    CASE
      WHEN p.last_sync_at IS NULL THEN 1 -- Never synced
      WHEN p.last_sync_at < default_since THEN 2 -- Stale
      WHEN p.sync_version < 2 THEN 3 -- Low version
      ELSE 4 -- Recent
    END as sync_priority
  FROM products_enhanced p
  WHERE
    p.last_sync_at < default_since
    OR p.last_sync_at IS NULL
    OR p.sync_version < 2
  ORDER BY
    CASE
      WHEN p.last_sync_at IS NULL THEN 1
      WHEN p.last_sync_at < default_since THEN 2
      WHEN p.sync_version < 2 THEN 3
      ELSE 4
    END,
    p.last_sync_at NULLS FIRST
  LIMIT batch_size;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- CONFLICT RESOLUTION FUNCTION
-- =====================================================
-- Handle conflicts when multiple systems update the same product

CREATE OR REPLACE FUNCTION resolve_product_conflicts(
  ploomes_product_id_param TEXT,
  local_data JSONB,
  remote_data JSONB,
  resolution_strategy TEXT DEFAULT 'remote_wins'
)
RETURNS JSONB AS $$
DECLARE
  resolved_data JSONB;
  local_timestamp TIMESTAMPTZ;
  remote_timestamp TIMESTAMPTZ;
BEGIN
  -- Extract timestamps for comparison
  local_timestamp := (local_data->>'source_updated_at')::timestamptz;
  remote_timestamp := (remote_data->>'source_updated_at')::timestamptz;

  CASE resolution_strategy
    WHEN 'remote_wins' THEN
      resolved_data := remote_data;

    WHEN 'local_wins' THEN
      resolved_data := local_data;

    WHEN 'latest_timestamp' THEN
      IF remote_timestamp > local_timestamp THEN
        resolved_data := remote_data;
      ELSE
        resolved_data := local_data;
      END IF;

    WHEN 'merge' THEN
      -- Merge strategy: prefer remote for most fields, keep local for specific fields
      resolved_data := remote_data;

      -- Keep local sync metadata
      resolved_data := jsonb_set(resolved_data, '{sync_version}', local_data->'sync_version');
      resolved_data := jsonb_set(resolved_data, '{last_sync_at}', local_data->'last_sync_at');

      -- Merge custom fields
      IF local_data ? 'custom_fields' AND remote_data ? 'custom_fields' THEN
        resolved_data := jsonb_set(
          resolved_data,
          '{custom_fields}',
          (local_data->'custom_fields') || (remote_data->'custom_fields')
        );
      END IF;

    ELSE
      -- Default to remote wins
      resolved_data := remote_data;
  END CASE;

  -- Always update sync metadata
  resolved_data := jsonb_set(resolved_data, '{last_sync_at}', to_jsonb(timezone('utc', now())));
  resolved_data := jsonb_set(
    resolved_data,
    '{sync_version}',
    to_jsonb(COALESCE((local_data->>'sync_version')::integer, 0) + 1)
  );

  RETURN resolved_data;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERFORMANCE MONITORING FUNCTIONS
-- =====================================================

-- Monitor sync performance and identify bottlenecks
CREATE OR REPLACE FUNCTION get_sync_performance_metrics(
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  metric_name TEXT,
  metric_value NUMERIC,
  metric_unit TEXT,
  time_period TEXT
) AS $$
BEGIN
  RETURN QUERY

  -- Average sync duration
  SELECT
    'avg_sync_duration'::TEXT,
    ROUND(AVG(duration_seconds), 2),
    'seconds'::TEXT,
    format('%s days', days_back)::TEXT
  FROM product_sync_logs
  WHERE
    started_at >= timezone('utc', now()) - (days_back || ' days')::interval
    AND status = 'completed'

  UNION ALL

  -- Average records per second
  SELECT
    'avg_records_per_second'::TEXT,
    ROUND(AVG(records_per_second), 2),
    'records/sec'::TEXT,
    format('%s days', days_back)::TEXT
  FROM product_sync_logs
  WHERE
    started_at >= timezone('utc', now()) - (days_back || ' days')::interval
    AND status = 'completed'
    AND records_per_second IS NOT NULL

  UNION ALL

  -- Success rate
  SELECT
    'success_rate'::TEXT,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)) * 100,
      2
    ),
    'percent'::TEXT,
    format('%s days', days_back)::TEXT
  FROM product_sync_logs
  WHERE started_at >= timezone('utc', now()) - (days_back || ' days')::interval

  UNION ALL

  -- Total syncs
  SELECT
    'total_syncs'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT,
    format('%s days', days_back)::TEXT
  FROM product_sync_logs
  WHERE started_at >= timezone('utc', now()) - (days_back || ' days')::interval;

END;
$$ LANGUAGE plpgsql STABLE;

-- Identify products with sync issues
CREATE OR REPLACE FUNCTION get_products_with_sync_issues()
RETURNS TABLE (
  issue_type TEXT,
  ploomes_product_id TEXT,
  product_name TEXT,
  last_sync_at TIMESTAMPTZ,
  sync_version INTEGER,
  issue_description TEXT
) AS $$
BEGIN
  RETURN QUERY

  -- Products never synced
  SELECT
    'never_synced'::TEXT,
    p.ploomes_product_id,
    p.name,
    p.last_sync_at,
    p.sync_version,
    'Product has never been synced successfully'::TEXT
  FROM products_enhanced p
  WHERE p.last_sync_at IS NULL

  UNION ALL

  -- Products with stale sync (>24 hours)
  SELECT
    'stale_sync'::TEXT,
    p.ploomes_product_id,
    p.name,
    p.last_sync_at,
    p.sync_version,
    format('Last sync was %s hours ago',
           ROUND(EXTRACT(EPOCH FROM (timezone('utc', now()) - p.last_sync_at)) / 3600, 1))
  FROM products_enhanced p
  WHERE
    p.last_sync_at IS NOT NULL
    AND p.last_sync_at < timezone('utc', now()) - INTERVAL '24 hours'

  UNION ALL

  -- Products with low sync version
  SELECT
    'low_version'::TEXT,
    p.ploomes_product_id,
    p.name,
    p.last_sync_at,
    p.sync_version,
    format('Sync version is only %s (expected >= 2)', p.sync_version)
  FROM products_enhanced p
  WHERE p.sync_version < 2

  ORDER BY issue_type, last_sync_at NULLS FIRST;

END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- DATA INTEGRITY FUNCTIONS
-- =====================================================

-- Validate product data integrity
CREATE OR REPLACE FUNCTION validate_product_integrity()
RETURNS TABLE (
  validation_type TEXT,
  product_count INTEGER,
  severity TEXT,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY

  -- Missing required fields
  SELECT
    'missing_name'::TEXT,
    COUNT(*)::INTEGER,
    'error'::TEXT,
    'Products without names'::TEXT
  FROM products_enhanced
  WHERE name IS NULL OR TRIM(name) = ''

  UNION ALL

  SELECT
    'missing_ploomes_id'::TEXT,
    COUNT(*)::INTEGER,
    'critical'::TEXT,
    'Products without Ploomes ID'::TEXT
  FROM products_enhanced
  WHERE ploomes_product_id IS NULL OR TRIM(ploomes_product_id) = ''

  UNION ALL

  -- Data quality issues
  SELECT
    'negative_price'::TEXT,
    COUNT(*)::INTEGER,
    'warning'::TEXT,
    'Products with negative prices'::TEXT
  FROM products_enhanced
  WHERE base_price < 0

  UNION ALL

  SELECT
    'missing_category'::TEXT,
    COUNT(*)::INTEGER,
    'warning'::TEXT,
    'Active products without category'::TEXT
  FROM products_enhanced
  WHERE category IS NULL AND active = true

  UNION ALL

  -- Orphaned specifications
  SELECT
    'orphaned_service_specs'::TEXT,
    COUNT(*)::INTEGER,
    'error'::TEXT,
    'Service specs without matching products'::TEXT
  FROM service_specifications ss
  WHERE NOT EXISTS (
    SELECT 1 FROM products_enhanced p
    WHERE p.id = ss.product_id
  )

  UNION ALL

  SELECT
    'orphaned_rental_specs'::TEXT,
    COUNT(*)::INTEGER,
    'error'::TEXT,
    'Rental specs without matching products'::TEXT
  FROM rental_specifications rs
  WHERE NOT EXISTS (
    SELECT 1 FROM products_enhanced p
    WHERE p.id = rs.product_id
  );

END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- CLEANUP AND MAINTENANCE FUNCTIONS
-- =====================================================

-- Clean up old sync logs
CREATE OR REPLACE FUNCTION cleanup_old_sync_logs(
  days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM product_sync_logs
  WHERE
    started_at < timezone('utc', now()) - (days_to_keep || ' days')::interval
    AND status IN ('completed', 'failed');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optimize table maintenance
CREATE OR REPLACE FUNCTION optimize_product_tables()
RETURNS TEXT AS $$
DECLARE
  result_message TEXT := '';
BEGIN
  -- Analyze tables for better query planning
  ANALYZE products_enhanced;
  ANALYZE service_specifications;
  ANALYZE rental_specifications;
  ANALYZE product_sync_logs;

  result_message := result_message || 'Analyzed all product tables. ';

  -- Refresh materialized views
  REFRESH MATERIALIZED VIEW CONCURRENTLY product_summary_by_category;
  REFRESH MATERIALIZED VIEW CONCURRENTLY service_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY rental_availability_summary;

  result_message := result_message || 'Refreshed materialized views. ';

  -- Clean up old logs
  result_message := result_message || 'Cleaned up ' || cleanup_old_sync_logs(30) || ' old sync logs.';

  RETURN result_message;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GRANT PERMISSIONS FOR FUNCTIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION sync_products_batch TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_for_incremental_sync TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_product_conflicts TO authenticated;
GRANT EXECUTE ON FUNCTION get_sync_performance_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_with_sync_issues TO authenticated;
GRANT EXECUTE ON FUNCTION validate_product_integrity TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_sync_logs TO authenticated;
GRANT EXECUTE ON FUNCTION optimize_product_tables TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION sync_products_batch IS 'Batch sync function for efficient processing of multiple products with conflict resolution';
COMMENT ON FUNCTION get_products_for_incremental_sync IS 'Identifies products that need syncing for incremental sync operations';
COMMENT ON FUNCTION resolve_product_conflicts IS 'Handles conflicts when the same product is updated in multiple systems';
COMMENT ON FUNCTION get_sync_performance_metrics IS 'Provides performance metrics for sync operations monitoring';
COMMENT ON FUNCTION get_products_with_sync_issues IS 'Identifies products with sync problems for debugging';
COMMENT ON FUNCTION validate_product_integrity IS 'Validates data integrity across product tables';
COMMENT ON FUNCTION cleanup_old_sync_logs IS 'Removes old sync logs to maintain database performance';
COMMENT ON FUNCTION optimize_product_tables IS 'Performs maintenance operations on product tables for optimal performance';