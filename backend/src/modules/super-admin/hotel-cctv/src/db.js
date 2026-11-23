const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

let database;

function openDatabase(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  database = new DatabaseSync(filePath);
  database.exec('PRAGMA foreign_keys = ON');
  return database;
}

function getDb() {
  if (!database) throw new Error('database is not ready');
  return database;
}

function query(sql, params = []) {
  const statement = getDb().prepare(sql);
  if (/^\s*(select|with|pragma)\b/i.test(sql)) {
    return [statement.all(...params)];
  }
  const result = statement.run(...params);
  return [{
    insertId: Number(result.lastInsertRowid || 0),
    affectedRows: Number(result.changes || 0),
  }];
}

function transaction(fn) {
  const db = getDb();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { openDatabase, getDb, query, transaction };
