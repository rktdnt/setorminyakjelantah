import { Pool } from 'pg';

const connectionString =
  process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('Set SUPABASE_DB_URL or DATABASE_URL to connect to the Supabase database.');
}

const pool = new Pool({
  connectionString,
  ssl:
    process.env.PGSSLMODE === 'disable' || process.env.NODE_ENV === 'development'
      ? undefined
      : { rejectUnauthorized: false },
});

let transactionClient = null;

function normalizeSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function isSelectLike(sql) {
  return /^(SELECT|WITH|SHOW|EXPLAIN|VALUES)\b/i.test(sql.trim());
}

function buildResultHeader(result) {
  return {
    command: result.command,
    rowCount: result.rowCount ?? 0,
    oid: result.oid ?? 0,
    insertId: result.rows?.[0]?.penukaran_id ?? result.rows?.[0]?.user_id ?? 0,
    affectedRows: result.rowCount ?? 0,
    warningStatus: 0,
  };
}

async function getClient() {
  if (transactionClient) {
    return transactionClient;
  }

  return pool;
}

async function execute(sql, params = []) {
  const client = await getClient();
  const result = await client.query(normalizeSql(sql), params);

  if (isSelectLike(sql)) {
    return [result.rows, undefined];
  }

  if (result.rows.length > 0) {
    return [result.rows, buildResultHeader(result)];
  }

  return [buildResultHeader(result), undefined];
}

async function beginTransaction() {
  if (transactionClient) {
    throw new Error('Transaction already started.');
  }

  transactionClient = await pool.connect();
  await transactionClient.query('BEGIN');
}

async function commit() {
  if (!transactionClient) {
    return;
  }

  try {
    await transactionClient.query('COMMIT');
  } finally {
    transactionClient.release();
    transactionClient = null;
  }
}

async function rollback() {
  if (!transactionClient) {
    return;
  }

  try {
    await transactionClient.query('ROLLBACK');
  } finally {
    transactionClient.release();
    transactionClient = null;
  }
}

export const db = {
  execute,
  query: execute,
  beginTransaction,
  commit,
  rollback,
};