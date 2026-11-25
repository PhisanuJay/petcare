/**
 * Pet-transport persistence — Microsoft SQL Server.
 * CCTV modules keep their own SQLite databases.
 */
export {
  closePool,
  connectionLabel,
  exec,
  getPool,
  newId,
  queryAll,
  queryOne,
  run,
  transaction,
} from '../../db/mssql.js';

export async function openDatabase() {
  const { getPool, connectionLabel } = await import('../../db/mssql.js');
  await getPool();
  return connectionLabel();
}
