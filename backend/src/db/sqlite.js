/**
 * @deprecated PetCare app data now uses Microsoft SQL Server (`./mssql.js`).
 * Kept as a thin re-export so legacy imports keep working.
 * Super-admin CCTV still opens its own SQLite files directly.
 */
export {
  connectionLabel as dbPath,
  getPool,
  queryAll,
  queryOne,
  run,
  exec,
  transaction,
  newId,
  closePool,
} from './mssql.js';

/** @deprecated use getPool from mssql.js */
export async function getDb() {
  const { getPool } = await import('./mssql.js');
  return getPool();
}
