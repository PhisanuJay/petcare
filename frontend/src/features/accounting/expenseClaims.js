import { readJSON, writeJSON, newId } from '../../shared/utils/storage.js';

const KEY = 'petcare_expense_claims';

export const EXPENSE_CATEGORY = {
  supplies: 'supplies',
  travel: 'travel',
  utilities: 'utilities',
  maintenance: 'maintenance',
  other: 'other',
};

export const EXPENSE_CATEGORY_LABEL = {
  supplies: 'วัสดุ/อุปกรณ์',
  travel: 'ค่าเดินทาง',
  utilities: 'สาธารณูปโภค',
  maintenance: 'ซ่อมบำรุง',
  other: 'อื่นๆ',
};

export const EXPENSE_STATUS = {
  recorded: 'recorded',
  paid: 'paid',
  cancelled: 'cancelled',
};

export const EXPENSE_STATUS_LABEL = {
  recorded: 'บันทึกแล้ว',
  paid: 'จ่ายแล้ว',
  cancelled: 'ยกเลิก',
};

/** @typedef {{
 *  id: string,
 *  date: string,
 *  category: string,
 *  title: string,
 *  amount: number,
 *  payee: string,
 *  method: 'cash'|'transfer',
 *  accountId?: string,
 *  note?: string,
 *  receipt?: string,
 *  status: string,
 *  createdAt: string,
 *  createdBy?: string,
 * }} ExpenseClaim */

export function listExpenseClaims() {
  return readJSON(KEY, [])
    .filter((row) => row && row.id)
    .sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
}

export function saveExpenseClaims(rows) {
  writeJSON(KEY, rows);
  return rows;
}

export function createExpenseClaim(payload) {
  const rows = listExpenseClaims();
  const amount = Number(payload.amount);
  const next = {
    id: newId('exp'),
    date: payload.date || new Date().toISOString().slice(0, 10),
    category: payload.category || EXPENSE_CATEGORY.other,
    title: String(payload.title || '').trim(),
    amount: Number.isFinite(amount) ? amount : 0,
    payee: String(payload.payee || '').trim(),
    method: payload.method === 'transfer' ? 'transfer' : 'cash',
    accountId: payload.accountId || '',
    note: String(payload.note || '').trim(),
    receipt: payload.receipt || '',
    status: EXPENSE_STATUS.paid,
    createdAt: new Date().toISOString(),
    createdBy: payload.createdBy || '',
  };
  const saved = saveExpenseClaims([next, ...rows]);
  return saved[0];
}

export function updateExpenseClaim(id, patch) {
  const rows = listExpenseClaims();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) throw new Error('ไม่พบรายการเบิก');
  rows[index] = { ...rows[index], ...patch, id: rows[index].id };
  saveExpenseClaims(rows);
  return rows[index];
}

export function removeExpenseClaim(id) {
  const next = listExpenseClaims().filter((row) => row.id !== id);
  saveExpenseClaims(next);
  return next;
}
