import { AsyncLocalStorage } from 'node:async_hooks';
import sql from 'mssql';
import { config } from '../config/index.js';

let poolPromise = null;
const txStore = new AsyncLocalStorage();

function buildConfig() {
  const { server, database, user, password, encrypt, trustServerCertificate } = config.mssql;
  if (!password) {
    throw new Error('MSSQL_PASSWORD is required (see backend/.env.example)');
  }
  return {
    server,
    database,
    user,
    password,
    options: {
      encrypt,
      trustServerCertificate,
      enableArithAbort: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

/** Convert `?` placeholders to `@p0`, `@p1`, ... for tedious. */
export function toNamedParams(sqlText, params = []) {
  let index = 0;
  const values = {};
  const text = sqlText.replace(/\?/g, () => {
    const key = `p${index}`;
    values[key] = params[index];
    index += 1;
    return `@${key}`;
  });
  if (index !== params.length) {
    throw new Error(`SQL param count mismatch: expected ${index}, got ${params.length}`);
  }
  return { text, values };
}

function bindRequest(request, values) {
  for (const [key, value] of Object.entries(values)) {
    request.input(key, value === undefined ? null : value);
  }
  return request;
}

export async function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(buildConfig())
      .connect()
      .catch((error) => {
        poolPromise = null;
        throw error;
      });
  }
  return poolPromise;
}

async function runOn(executor, sqlText, params = []) {
  const { text, values } = toNamedParams(sqlText, params);
  const request = executor.request ? executor.request() : new sql.Request(executor);
  bindRequest(request, values);
  return request.query(text);
}

export async function queryAll(sqlText, params = []) {
  const tx = txStore.getStore();
  if (tx) {
    const result = await runOn(tx, sqlText, params);
    return result.recordset || [];
  }
  const pool = await getPool();
  const result = await runOn(pool, sqlText, params);
  return result.recordset || [];
}

export async function queryOne(sqlText, params = []) {
  const rows = await queryAll(sqlText, params);
  return rows[0] ?? null;
}

export async function run(sqlText, params = []) {
  const tx = txStore.getStore();
  if (tx) {
    const result = await runOn(tx, sqlText, params);
    return { insertId: 0, changes: Number(result.rowsAffected?.[0] || 0) };
  }
  const pool = await getPool();
  const result = await runOn(pool, sqlText, params);
  return { insertId: 0, changes: Number(result.rowsAffected?.[0] || 0) };
}

/** Run multiple statements (schema). No `?` params. */
export async function exec(sqlText) {
  const pool = await getPool();
  await pool.request().batch(sqlText);
}

export async function transaction(fn) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await txStore.run(tx, () => fn());
    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      /* ignore */
    }
    throw error;
  }
}

export function newId(prefix = '') {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}${id}` : id;
}

export async function closePool() {
  if (!poolPromise) return;
  const pool = await poolPromise;
  await pool.close();
  poolPromise = null;
}

export function connectionLabel() {
  const { server, database } = config.mssql;
  return `${server} / ${database}`;
}

export { sql };
