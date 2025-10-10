import { env } from './env.server';
import { Pool } from 'pg';

/**
 * Direct PostgreSQL connection to Supabase
 * Bypasses @supabase/supabase-js authentication issues
 */

interface SupabaseResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number;
}

// PostgreSQL connection pool
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    // Extract project ref from Supabase URL
    const dbUrl = env.SUPABASE_URL.replace('https://', '');
    const projectRef = dbUrl.split('.')[0]; // yxwokryybudwygtemfmu

    // Supabase direct connection (port 5432) with transaction mode
    const connectionString = `postgresql://postgres.${projectRef}:${env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

async function supabaseQuery<T>(
  table: string,
  options: {
    select?: string;
    filter?: Record<string, any>;
    limit?: number;
    orderBy?: { column: string; ascending?: boolean };
    count?: 'exact' | 'planned' | 'estimated';
    single?: boolean;
  } = {}
): Promise<SupabaseResponse<T>> {
  const { select = '*', filter = {}, limit, orderBy, count, single } = options;

  try {
    const pool = getPool();

    // Build SQL query
    let sql = `SELECT ${select} FROM ${table}`;
    const params: any[] = [];
    let paramIndex = 1;

    // Apply filters
    const whereClauses: string[] = [];
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        whereClauses.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Apply order
    if (orderBy) {
      sql += ` ORDER BY ${orderBy.column} ${orderBy.ascending === false ? 'DESC' : 'ASC'}`;
    }

    // Apply limit
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    // Execute query
    const result = await pool.query(sql, params);

    // Get count if requested
    let resultCount: number | undefined;
    if (count) {
      let countSql = `SELECT COUNT(*) as count FROM ${table}`;
      if (whereClauses.length > 0) {
        countSql += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      const countResult = await pool.query(countSql, params);
      resultCount = parseInt(countResult.rows[0].count, 10);
    }

    return {
      data: (single ? result.rows[0] : result.rows) as T,
      error: null,
      count: resultCount,
    };
  } catch (error) {
    console.error('[supabase-server] Query error:', error);
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any).code,
      },
    };
  }
}

/**
 * Execute raw SQL query
 */
async function executeSQL<T>(query: string, params: any[] = []): Promise<SupabaseResponse<T>> {
  try {
    const pool = getPool();
    const result = await pool.query(query, params);

    return {
      data: result.rows as T,
      error: null,
    };
  } catch (error) {
    console.error('[supabase-server] SQL error:', error);
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any).code,
      },
    };
  }
}

export const supabaseServer = {
  // Simple query builder
  query: <T>(table: string, options?: Parameters<typeof supabaseQuery>[1]) =>
    supabaseQuery<T>(table, options),

  // Raw SQL execution
  sql: <T>(query: string, params?: any[]) => executeSQL<T>(query, params),
};

export function hasSupabase(): boolean {
  return !!(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY));
}
