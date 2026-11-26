import { readJSON, writeJSON, newId } from '../../shared/utils/storage.js';

const ACCOUNTS_KEY = 'petcare_bank_accounts';
const LEDGER_KEY = 'petcare_bank_ledger';

/** @typedef {{ id: string, bankName: string, accountName: string, accountNumber: string, note?: string }} BankAccount */
/** @typedef {{ id: string, accountId: string, date: string, description: string, amount: number, balance?: number|null, raw?: string }} LedgerRow */

export function listBankAccounts() {
  return readJSON(ACCOUNTS_KEY, []).filter((row) => row && row.id);
}

export function saveBankAccounts(rows) {
  writeJSON(ACCOUNTS_KEY, rows);
  return rows;
}

export function listLedgerRows(accountId = '') {
  const all = readJSON(LEDGER_KEY, []).filter((row) => row && row.id);
  if (!accountId) return all;
  return all.filter((row) => row.accountId === accountId);
}

export function saveLedgerRows(rows) {
  writeJSON(LEDGER_KEY, rows);
  return rows;
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function parseCsvText(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvLine);
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function moneyCell(value) {
  const cleaned = String(value || '')
    .replace(/[฿,\s]/g, '')
    .replace(/\((.+)\)/, '-$1');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * CSV บัญชีธนาคาร — คอลัมน์ที่ยอมรับ:
 * bankName/ธนาคาร, accountName/ชื่อบัญชี, accountNumber/เลขบัญชี, note/หมายเหตุ
 */
export function parseAccountsCsv(text) {
  const rows = parseCsvText(text);
  if (!rows.length) return [];
  const header = rows[0].map(normalizeHeader);
  const hasHeader = header.some((h) => (
    h.includes('bank') || h.includes('account') || h.includes('ธนาคาร') || h.includes('บัญชี') || h.includes('เลข')
  ));
  const body = hasHeader ? rows.slice(1) : rows;
  const idx = (names) => names.map((n) => header.indexOf(normalizeHeader(n))).find((i) => i >= 0) ?? -1;
  const bankIdx = hasHeader ? idx(['bankname', 'bank', 'ธนาคาร']) : 0;
  const nameIdx = hasHeader ? idx(['accountname', 'name', 'ชื่อบัญชี', 'ชื่อ']) : 1;
  const numberIdx = hasHeader ? idx(['accountnumber', 'number', 'เลขบัญชี', 'เลขที่บัญชี']) : 2;
  const noteIdx = hasHeader ? idx(['note', 'หมายเหตุ']) : 3;

  return body
    .map((cells) => {
      const bankName = String(cells[bankIdx] || '').trim();
      const accountName = String(cells[nameIdx] || '').trim();
      const accountNumber = String(cells[numberIdx] || '').replace(/\s+/g, '').trim();
      const note = noteIdx >= 0 ? String(cells[noteIdx] || '').trim() : '';
      if (!bankName && !accountName && !accountNumber) return null;
      return {
        id: newId(),
        bankName: bankName || 'ไม่ระบุธนาคาร',
        accountName: accountName || 'ไม่ระบุชื่อบัญชี',
        accountNumber: accountNumber || '—',
        note,
      };
    })
    .filter(Boolean);
}

/**
 * CSV statement — คอลัมน์ที่ยอมรับ:
 * date/วันที่, description/รายการ, amount/จำนวนเงิน, balance/คงเหลือ
 */
export function parseLedgerCsv(text, accountId) {
  const rows = parseCsvText(text);
  if (!rows.length) return [];
  const header = rows[0].map(normalizeHeader);
  const hasHeader = header.some((h) => (
    h.includes('date') || h.includes('amount') || h.includes('วันที่') || h.includes('จำนวน')
  ));
  const body = hasHeader ? rows.slice(1) : rows;
  const idx = (names) => names.map((n) => header.indexOf(normalizeHeader(n))).find((i) => i >= 0) ?? -1;
  const dateIdx = hasHeader ? idx(['date', 'วันที่', 'วัน']) : 0;
  const descIdx = hasHeader ? idx(['description', 'detail', 'รายการ', 'รายละเอียด']) : 1;
  const amountIdx = hasHeader ? idx(['amount', 'จำนวนเงิน', 'ยอด', 'debit', 'credit']) : 2;
  const balanceIdx = hasHeader ? idx(['balance', 'คงเหลือ']) : 3;

  return body
    .map((cells) => {
      const date = String(cells[dateIdx] || '').trim();
      const description = String(cells[descIdx] || '').trim();
      const amount = moneyCell(cells[amountIdx]);
      const balanceRaw = balanceIdx >= 0 ? cells[balanceIdx] : '';
      const balance = balanceRaw === '' || balanceRaw == null ? null : moneyCell(balanceRaw);
      if (!date && !description && !amount) return null;
      return {
        id: newId(),
        accountId,
        date,
        description: description || 'รายการจาก CSV',
        amount,
        balance,
        raw: cells.join(','),
      };
    })
    .filter(Boolean);
}
