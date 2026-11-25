/** Shared backend config */
export const config = {
  port: Number(process.env.PORT) || 3001,
  sqliteFile: process.env.SQLITE_FILE || 'petcare-transport.sqlite',
};
