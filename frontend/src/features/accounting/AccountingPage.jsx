import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StaffWorkspace from '../../shared/layouts/StaffWorkspace.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { PAY_KIND, PAY_KIND_LABEL, PAY_STATUS, usePayments } from '../payments/store.js';
import { useTransport } from '../pet-transport/useTransport.js';
import { fileToResizedDataUrl, newId } from '../../shared/utils/storage.js';
import {
  listBankAccounts,
  listLedgerRows,
  parseAccountsCsv,
  parseLedgerCsv,
  saveBankAccounts,
  saveLedgerRows,
} from './bankAccounts.js';
import {
  EXPENSE_CATEGORY,
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_STATUS,
  EXPENSE_STATUS_LABEL,
  createExpenseClaim,
  listExpenseClaims,
  removeExpenseClaim,
  updateExpenseClaim,
} from './expenseClaims.js';
import '../payments/payment.css';

const KINDS = Object.values(PAY_KIND);

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function baht(value) {
  return `฿${Number(value || 0).toLocaleString('th-TH')}`;
}

function dayKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDay(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day));
  }
  return formatWhen(value);
}

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function transportAmount(booking) {
  const amount = Number(booking.finalQuote?.total ?? booking.quote?.total ?? booking.estimatedQuote?.total);
  return Number.isFinite(amount) ? amount : 0;
}

export default function AccountingPage() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { all } = usePayments('accountant');
  const {
    bookings: transportBookings,
    loading: transportLoading,
    error: transportError,
  } = useTransport();
  const [tab, setTab] = useState('desk');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState('all');
  const [accounts, setAccounts] = useState(() => listBankAccounts());
  const [ledger, setLedger] = useState(() => listLedgerRows());
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accountForm, setAccountForm] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    note: '',
  });
  const [accountMsg, setAccountMsg] = useState('');
  const [accountError, setAccountError] = useState('');
  const [expenses, setExpenses] = useState(() => listExpenseClaims());
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: EXPENSE_CATEGORY.supplies,
    title: '',
    amount: '',
    payee: '',
    method: 'cash',
    accountId: '',
    note: '',
    receipt: '',
  });
  const [expenseMsg, setExpenseMsg] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const printedAt = formatWhen(new Date().toISOString());

  const paidTransport = transportBookings.filter(
    (booking) => booking.paymentStatus === 'paid' && booking.status !== 'cancelled',
  );
  const paidTransportIds = new Set(paidTransport.map((booking) => booking.id));
  const approvedPayments = all.filter(
    (row) => row.status === PAY_STATUS.approved
      && (row.kind !== PAY_KIND.transport || !paidTransportIds.has(row.refId)),
  );
  const approvedCount = approvedPayments.length + paidTransport.length;
  const approvedTotal = approvedPayments.reduce((sum, row) => sum + Number(row.deposit || 0), 0)
    + paidTransport.reduce((sum, booking) => sum + transportAmount(booking), 0);
  const incomeByKind = KINDS.map((id) => {
    const rows = approvedPayments.filter((row) => row.kind === id);
    const transportRows = id === PAY_KIND.transport ? paidTransport : [];
    return {
      id,
      count: rows.length + transportRows.length,
      sum: rows.reduce((total, row) => total + Number(row.deposit || 0), 0)
        + transportRows.reduce((total, booking) => total + transportAmount(booking), 0),
    };
  });
  const maxIncomeByKind = Math.max(0, ...incomeByKind.map((item) => item.sum));

  function inDateRange(value) {
    const key = dayKey(value);
    if (from && key < from) return false;
    if (to && key > to) return false;
    return true;
  }

  const inRangePayments = useMemo(() => approvedPayments.filter((row) => {
    if (!inDateRange(row.reviewedAt || row.submittedAt || row.createdAt)) return false;
    if (kind !== 'all' && row.kind !== kind) return false;
    return true;
  }), [approvedPayments, from, to, kind]);

  const inRangeTransport = useMemo(() => {
    if (kind !== 'all' && kind !== PAY_KIND.transport) return [];
    return paidTransport.filter((booking) => inDateRange(
      booking.paidAt || booking.updatedAt || booking.createdAt,
    ));
  }, [paidTransport, from, to, kind]);

  const inRange = useMemo(() => [
    ...inRangePayments.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      ownerName: row.ownerName || row.email,
      when: row.reviewedAt || row.submittedAt || row.createdAt,
      amount: Number(row.deposit || 0),
    })),
    ...inRangeTransport.map((booking) => ({
      id: `transport-${booking.id}`,
      kind: PAY_KIND.transport,
      title: booking.routeLabel || booking.petName || 'รับส่งสัตว์เลี้ยง',
      ownerName: booking.ownerName || booking.customerName || booking.email || '—',
      when: booking.paidAt || booking.updatedAt || booking.createdAt,
      amount: transportAmount(booking),
    })),
  ].sort((a, b) => String(b.when || '').localeCompare(String(a.when || ''))), [inRangePayments, inRangeTransport]);

  const showIncome = kind === 'all' || kind !== 'expense';
  const showExpense = kind === 'all' || kind === 'expense';

  const incomeRows = showIncome ? inRange : [];
  const income = incomeRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const inRangeExpenses = useMemo(() => {
    if (!showExpense) return [];
    return expenses
      .filter((row) => row.status !== EXPENSE_STATUS.cancelled)
      .filter((row) => inDateRange(row.date || row.createdAt))
      .map((row) => ({
        id: row.id,
        category: row.category,
        title: row.title,
        payee: row.payee || '—',
        when: row.date || row.createdAt,
        amount: Number(row.amount || 0),
        method: row.method,
      }));
  }, [expenses, from, to, showExpense]);

  const expense = inRangeExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const net = income - expense;

  const kinds = kind === 'all' || kind === 'expense' ? KINDS : [kind];
  const reportKinds = showIncome
    ? kinds.map((id) => {
      const rows = incomeRows.filter((row) => row.kind === id);
      return {
        id,
        type: 'รายรับ',
        label: PAY_KIND_LABEL[id],
        count: rows.length,
        sum: rows.reduce((total, row) => total + Number(row.amount || 0), 0),
      };
    })
    : [];

  const reportExpenseKinds = showExpense
    ? Object.values(EXPENSE_CATEGORY).map((id) => {
      const rows = inRangeExpenses.filter((row) => row.category === id);
      return {
        id,
        type: 'รายจ่าย',
        label: EXPENSE_CATEGORY_LABEL[id],
        count: rows.length,
        sum: rows.reduce((total, row) => total + Number(row.amount || 0), 0),
      };
    })
    : [];

  const reportLines = [
    ...incomeRows.map((row) => ({
      id: `in-${row.id}`,
      when: row.when,
      type: 'รายรับ',
      category: PAY_KIND_LABEL[row.kind],
      title: row.title,
      party: row.ownerName,
      income: Number(row.amount || 0),
      expense: 0,
    })),
    ...inRangeExpenses.map((row) => ({
      id: `out-${row.id}`,
      when: row.when,
      type: 'รายจ่าย',
      category: EXPENSE_CATEGORY_LABEL[row.category] || row.category,
      title: row.title,
      party: row.payee,
      income: 0,
      expense: Number(row.amount || 0),
    })),
  ].sort((a, b) => String(b.when || '').localeCompare(String(a.when || '')));

  const rangeLabel = `${from ? formatDay(from) : 'เริ่มต้น'} – ${to ? formatDay(to) : 'ปัจจุบัน'}`;

  const selectedAccount = accounts.find((item) => item.id === selectedAccountId) || accounts[0] || null;
  const activeAccountId = selectedAccount?.id || '';
  const accountLedger = useMemo(
    () => ledger.filter((row) => row.accountId === activeAccountId),
    [ledger, activeAccountId],
  );

  function addAccount(event) {
    event.preventDefault();
    setAccountError('');
    setAccountMsg('');
    const bankName = accountForm.bankName.trim();
    const accountName = accountForm.accountName.trim();
    const accountNumber = accountForm.accountNumber.trim();
    if (!bankName || !accountName || !accountNumber) {
      setAccountError('กรอกธนาคาร ชื่อบัญชี และเลขบัญชีให้ครบ');
      return;
    }
    const next = saveBankAccounts([
      ...accounts,
      {
        id: newId(),
        bankName,
        accountName,
        accountNumber,
        note: accountForm.note.trim(),
      },
    ]);
    setAccounts(next);
    setAccountForm({ bankName: '', accountName: '', accountNumber: '', note: '' });
    setAccountMsg('เพิ่มบัญชีแล้ว');
  }

  function removeAccount(id) {
    const next = saveBankAccounts(accounts.filter((item) => item.id !== id));
    setAccounts(next);
    const nextLedger = saveLedgerRows(ledger.filter((row) => row.accountId !== id));
    setLedger(nextLedger);
    if (selectedAccountId === id) setSelectedAccountId('');
  }

  async function onAccountsCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAccountError('');
    setAccountMsg('');
    try {
      const text = await file.text();
      const imported = parseAccountsCsv(text);
      if (!imported.length) {
        setAccountError('ไม่พบข้อมูลบัญชีในไฟล์ CSV');
        return;
      }
      const next = saveBankAccounts([...accounts, ...imported]);
      setAccounts(next);
      setAccountMsg(`โหลดบัญชีจาก CSV แล้ว ${imported.length} บัญชี`);
    } catch (error) {
      setAccountError(error.message || 'อ่านไฟล์ CSV ไม่สำเร็จ');
    }
  }

  async function onLedgerCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!activeAccountId) {
      setAccountError('เลือกบัญชีก่อนโหลดรายการเดินบัญชี');
      return;
    }
    setAccountError('');
    setAccountMsg('');
    try {
      const text = await file.text();
      const imported = parseLedgerCsv(text, activeAccountId);
      if (!imported.length) {
        setAccountError('ไม่พบรายการในไฟล์ CSV');
        return;
      }
      const next = saveLedgerRows([...ledger, ...imported]);
      setLedger(next);
      setAccountMsg(`โหลดรายการเดินบัญชีแล้ว ${imported.length} แถว`);
    } catch (error) {
      setAccountError(error.message || 'อ่านไฟล์ CSV ไม่สำเร็จ');
    }
  }

  const name = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'ฝ่ายบัญชี';

  async function onExpenseReceipt(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setExpenseError('');
    try {
      const receipt = await fileToResizedDataUrl(file, 960, 0.82);
      setExpenseForm((current) => ({ ...current, receipt }));
    } catch (error) {
      setExpenseError(error.message || 'อ่านรูปหลักฐานไม่สำเร็จ');
    }
  }

  function submitExpense(event) {
    event.preventDefault();
    setExpenseError('');
    setExpenseMsg('');
    const title = expenseForm.title.trim();
    const amount = Number(expenseForm.amount);
    if (!title) {
      setExpenseError('กรอกรายการที่เบิก');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError('จำนวนเงินต้องมากกว่า 0');
      return;
    }
    createExpenseClaim({
      ...expenseForm,
      title,
      amount,
      createdBy: name,
    });
    setExpenses(listExpenseClaims());
    setExpenseForm({
      date: new Date().toISOString().slice(0, 10),
      category: EXPENSE_CATEGORY.supplies,
      title: '',
      amount: '',
      payee: '',
      method: 'cash',
      accountId: '',
      note: '',
      receipt: '',
    });
    setExpenseMsg('บันทึกใบเบิกแล้ว');
  }

  function markExpensePaid(id) {
    updateExpenseClaim(id, { status: EXPENSE_STATUS.paid });
    setExpenses(listExpenseClaims());
  }

  function cancelExpense(id) {
    updateExpenseClaim(id, { status: EXPENSE_STATUS.cancelled });
    setExpenses(listExpenseClaims());
  }

  function deleteExpense(id) {
    setExpenses(removeExpenseClaim(id));
  }

  const expenseTotal = expenses
    .filter((row) => row.status !== EXPENSE_STATUS.cancelled)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const navItems = [
    { id: 'desk', label: 'ภาพรวม', icon: 'bi-speedometer2', active: tab === 'desk', onClick: () => setTab('desk') },
    {
      id: 'accounts',
      label: 'บัญชีธนาคาร',
      icon: 'bi-bank',
      active: tab === 'accounts',
      onClick: () => setTab('accounts'),
      badge: accounts.length || null,
    },
    {
      id: 'expenses',
      label: 'เบิกใช้จ่าย',
      icon: 'bi-wallet2',
      active: tab === 'expenses',
      onClick: () => setTab('expenses'),
      badge: expenses.filter((row) => row.status !== EXPENSE_STATUS.cancelled).length || null,
    },
    { id: 'report', label: 'รายงาน', icon: 'bi-bar-chart-line', active: tab === 'report', onClick: () => setTab('report') },
  ];
  const tabTitle = navItems.find((item) => item.active)?.label || 'ภาพรวม';

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <StaffWorkspace
      brandTitle="PetCare"
      brandSubtitle="ฝ่ายบัญชี"
      navItems={navItems}
      userName={name}
      userRoleLabel="Accountant"
      onLogout={handleLogout}
      kicker="Accounting"
      title={tabTitle}
    >
      <div className="acct-page acct-page--workspace">
        <main className="acct-main">
          {tab === 'desk' ? (
            <>
              <header className="acct-mast acct-overview-mast">
                <p>ฝ่ายบัญชี</p>
                <h1>ภาพรวมรายรับ</h1>
                <p>ยอดชำระที่ยืนยันอัตโนมัติแล้ว แยกตามประเภทบริการ</p>
              </header>
              {transportError ? <div className="acct-alert acct-alert--error" role="alert">{transportError}</div> : null}
              <div className="acct-stats acct-overview-stats">
                <div className="acct-stat acct-stat--featured">
                  <span>ยอดรับชำระแล้ว</span>
                  <strong>{transportLoading ? '—' : baht(approvedTotal)}</strong>
                  <small>{transportLoading ? 'กำลังโหลดข้อมูล' : `${approvedCount} รายการที่ยืนยันแล้ว`}</small>
                </div>
                <div className="acct-stat">
                  <span>บัญชีธนาคาร</span>
                  <strong>{accounts.length}</strong>
                  <small>โหลด CSV ได้ที่เมนูบัญชีธนาคาร</small>
                </div>
                <div className="acct-stat">
                  <span>ประเภทบริการ</span>
                  <strong>{incomeByKind.filter((item) => item.sum > 0).length}</strong>
                  <small>มีรายรับที่ยืนยันแล้ว</small>
                </div>
              </div>
              <div className="acct-dashboard-grid">
                <section className="acct-card acct-income-card" aria-labelledby="acct-income-title">
                  <header className="acct-dashboard-card-head">
                    <div>
                      <h2 id="acct-income-title">รายรับแยกตามประเภท</h2>
                      <p>รวมยอดที่ยืนยันอัตโนมัติแล้ว</p>
                    </div>
                    <strong>{transportLoading ? '—' : baht(approvedTotal)}</strong>
                  </header>
                  <div className="acct-income-list">
                    {incomeByKind.map((item) => {
                      const width = maxIncomeByKind > 0 ? (item.sum / maxIncomeByKind) * 100 : 0;
                      return (
                        <div className="acct-income-item" key={item.id}>
                          <div className="acct-income-item__head">
                            <span>{PAY_KIND_LABEL[item.id]}<small>{item.count} รายการ</small></span>
                            <strong>{baht(item.sum)}</strong>
                          </div>
                          <div className="acct-income-bar" aria-hidden="true">
                            <span style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!transportLoading && approvedCount === 0 ? (
                    <p className="acct-dashboard-empty">ยังไม่มีรายการรายรับ</p>
                  ) : null}
                </section>

                <section className="acct-card" aria-labelledby="acct-bank-preview">
                  <header className="acct-dashboard-card-head">
                    <div>
                      <h2 id="acct-bank-preview">บัญชีธนาคาร</h2>
                      <p>{accounts.length} บัญชี</p>
                    </div>
                    <button type="button" className="acct-text-action" onClick={() => setTab('accounts')}>
                      จัดการ / โหลด CSV
                    </button>
                  </header>
                  {accounts.length === 0 ? (
                    <p className="acct-dashboard-empty">ยังไม่มีบัญชี — เพิ่มเองหรือโหลดจาก CSV</p>
                  ) : (
                    <div className="acct-review-list">
                      {accounts.slice(0, 5).map((item) => (
                        <div className="acct-review-row" key={item.id}>
                          <span>
                            <strong>{item.accountName}</strong>
                            <small>{item.bankName} · {item.accountNumber}</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}

          {tab === 'accounts' ? (
            <>
              <header className="acct-mast">
                <h1>บัญชีธนาคาร</h1>
                <p>เพิ่มบัญชี หรือโหลดรายชื่อบัญชี / รายการเดินบัญชีจากไฟล์ CSV</p>
              </header>
              {accountError ? <div className="acct-alert acct-alert--error" role="alert">{accountError}</div> : null}
              {accountMsg ? <div className="acct-alert acct-alert--success" role="status">{accountMsg}</div> : null}

              <div className="acct-dashboard-grid">
                <section className="acct-card">
                  <h2>เพิ่มบัญชี</h2>
                  <form className="acct-account-form" onSubmit={addAccount}>
                    <label>
                      ธนาคาร
                      <input
                        className="form-control"
                        value={accountForm.bankName}
                        onChange={(event) => setAccountForm((prev) => ({ ...prev, bankName: event.target.value }))}
                        placeholder="เช่น กสิกรไทย"
                      />
                    </label>
                    <label>
                      ชื่อบัญชี
                      <input
                        className="form-control"
                        value={accountForm.accountName}
                        onChange={(event) => setAccountForm((prev) => ({ ...prev, accountName: event.target.value }))}
                        placeholder="ชื่อบัญชี"
                      />
                    </label>
                    <label>
                      เลขบัญชี
                      <input
                        className="form-control"
                        value={accountForm.accountNumber}
                        onChange={(event) => setAccountForm((prev) => ({ ...prev, accountNumber: event.target.value }))}
                        placeholder="xxx-x-xxxxx-x"
                      />
                    </label>
                    <label>
                      หมายเหตุ
                      <input
                        className="form-control"
                        value={accountForm.note}
                        onChange={(event) => setAccountForm((prev) => ({ ...prev, note: event.target.value }))}
                        placeholder="ไม่บังคับ"
                      />
                    </label>
                    <button type="submit" className="btn btn-sky">บันทึกบัญชี</button>
                  </form>
                  <div className="acct-csv-actions">
                    <label className="btn btn-soft acct-csv-btn">
                      โหลดบัญชีจาก CSV
                      <input type="file" accept=".csv,text/csv" hidden onChange={onAccountsCsv} />
                    </label>
                    <p className="small text-muted mb-0">
                      คอลัมน์แนะนำ: bankName, accountName, accountNumber, note
                    </p>
                  </div>
                </section>

                <section className="acct-card">
                  <h2>รายการบัญชี</h2>
                  {accounts.length === 0 ? (
                    <p className="acct-dashboard-empty">ยังไม่มีบัญชี</p>
                  ) : (
                    <div className="acct-account-list">
                      {accounts.map((item) => (
                        <article
                          key={item.id}
                          className={`acct-account-row${activeAccountId === item.id ? ' is-on' : ''}`}
                        >
                          <button type="button" className="acct-account-pick" onClick={() => setSelectedAccountId(item.id)}>
                            <strong>{item.accountName}</strong>
                            <small>{item.bankName} · {item.accountNumber}</small>
                            {item.note ? <small>{item.note}</small> : null}
                          </button>
                          <button type="button" className="btn btn-soft btn-sm" onClick={() => removeAccount(item.id)}>
                            ลบ
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <section className="acct-card">
                <header className="acct-dashboard-card-head">
                  <div>
                    <h2>รายการเดินบัญชี (CSV)</h2>
                    <p>
                      {selectedAccount
                        ? `${selectedAccount.bankName} · ${selectedAccount.accountName}`
                        : 'เลือกบัญชีด้านบนก่อน'}
                    </p>
                  </div>
                  <label className={`btn btn-sky acct-csv-btn${!activeAccountId ? ' disabled' : ''}`}>
                    โหลด CSV เดินบัญชี
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      hidden
                      disabled={!activeAccountId}
                      onChange={onLedgerCsv}
                    />
                  </label>
                </header>
                <p className="small text-muted">คอลัมน์แนะนำ: date, description, amount, balance</p>
                {accountLedger.length === 0 ? (
                  <p className="acct-dashboard-empty">ยังไม่มีรายการเดินบัญชีของบัญชีนี้</p>
                ) : (
                  <table className="acct-table">
                    <thead>
                      <tr>
                        <th>วันที่</th>
                        <th>รายการ</th>
                        <th>จำนวนเงิน</th>
                        <th>คงเหลือ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountLedger.map((row) => (
                        <tr key={row.id}>
                          <td>{row.date}</td>
                          <td>{row.description}</td>
                          <td>{money(row.amount)}</td>
                          <td>{row.balance == null ? '—' : money(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          ) : null}

          {tab === 'expenses' ? (
            <>
              <header className="acct-mast">
                <h1>เบิกใช้จ่าย</h1>
                <p>เขียนใบเบิกสำหรับใช้จ่ายของคลินิก/โรงแรม เก็บหลักฐานไว้ในระบบ</p>
              </header>
              {expenseError ? <div className="acct-alert acct-alert--error" role="alert">{expenseError}</div> : null}
              {expenseMsg ? <div className="acct-alert acct-alert--success" role="status">{expenseMsg}</div> : null}

              <div className="acct-stats acct-overview-stats">
                <div className="acct-stat acct-stat--featured">
                  <span>ยอดเบิกทั้งหมด</span>
                  <strong>{baht(expenseTotal)}</strong>
                  <small>{expenses.filter((row) => row.status !== EXPENSE_STATUS.cancelled).length} รายการ</small>
                </div>
              </div>

              <div className="acct-dashboard-grid">
                <section className="acct-card">
                  <h2>เขียนใบเบิก</h2>
                  <form className="acct-account-form" onSubmit={submitExpense}>
                    <label>
                      วันที่
                      <input
                        type="date"
                        className="form-control"
                        value={expenseForm.date}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, date: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      หมวด
                      <select
                        className="form-control"
                        value={expenseForm.category}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))}
                      >
                        {Object.values(EXPENSE_CATEGORY).map((id) => (
                          <option key={id} value={id}>{EXPENSE_CATEGORY_LABEL[id]}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      รายการ
                      <input
                        className="form-control"
                        value={expenseForm.title}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="เช่น ซื้อสำลี / ค่าน้ำมันรับส่ง"
                        required
                      />
                    </label>
                    <label>
                      จำนวนเงิน (บาท)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control"
                        value={expenseForm.amount}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      ผู้รับเงิน / ร้านค้า
                      <input
                        className="form-control"
                        value={expenseForm.payee}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, payee: event.target.value }))}
                        placeholder="ชื่อคนรับหรือร้าน"
                      />
                    </label>
                    <label>
                      วิธีจ่าย
                      <select
                        className="form-control"
                        value={expenseForm.method}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, method: event.target.value }))}
                      >
                        <option value="cash">เงินสด</option>
                        <option value="transfer">โอนบัญชี</option>
                      </select>
                    </label>
                    {expenseForm.method === 'transfer' ? (
                      <label>
                        บัญชีที่ใช้โอน
                        <select
                          className="form-control"
                          value={expenseForm.accountId}
                          onChange={(event) => setExpenseForm((current) => ({ ...current, accountId: event.target.value }))}
                        >
                          <option value="">ไม่ระบุ</option>
                          {accounts.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.bankName} · {item.accountNumber}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label>
                      หมายเหตุ
                      <input
                        className="form-control"
                        value={expenseForm.note}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, note: event.target.value }))}
                      />
                    </label>
                    <label className="pay-file">
                      <input type="file" accept="image/*" onChange={onExpenseReceipt} />
                      <span>{expenseForm.receipt ? 'เปลี่ยนรูปใบเสร็จ' : 'แนบใบเสร็จ / หลักฐาน'}</span>
                    </label>
                    {expenseForm.receipt ? (
                      <img className="pay-slip" src={expenseForm.receipt} alt="ตัวอย่างใบเสร็จ" />
                    ) : null}
                    <button type="submit" className="btn btn-sky">บันทึกใบเบิก</button>
                  </form>
                </section>

                <section className="acct-card">
                  <h2>รายการเบิก</h2>
                  {expenses.length === 0 ? (
                    <p className="acct-dashboard-empty">ยังไม่มีใบเบิก</p>
                  ) : (
                    <div className="acct-expense-list">
                      {expenses.map((row) => {
                        const account = accounts.find((item) => item.id === row.accountId);
                        return (
                          <article className={`acct-expense-card${row.status === EXPENSE_STATUS.cancelled ? ' is-cancelled' : ''}`} key={row.id}>
                            <header>
                              <div>
                                <span className="acct-chip">{EXPENSE_CATEGORY_LABEL[row.category] || row.category}</span>
                                <h3>{row.title}</h3>
                                <p>
                                  {formatDay(row.date)}
                                  {row.payee ? ` · ${row.payee}` : ''}
                                  {' · '}
                                  {row.method === 'transfer' ? 'โอน' : 'เงินสด'}
                                  {account ? ` · ${account.bankName}` : ''}
                                </p>
                              </div>
                              <strong>{baht(row.amount)}</strong>
                            </header>
                            {row.note ? <p className="acct-expense-note">{row.note}</p> : null}
                            {row.receipt ? <img className="pay-slip" src={row.receipt} alt={`ใบเสร็จ ${row.title}`} /> : null}
                            <footer>
                              <span className="acct-expense-status">{EXPENSE_STATUS_LABEL[row.status] || row.status}</span>
                              <div className="acct-expense-actions">
                                {row.status !== EXPENSE_STATUS.paid ? (
                                  <button type="button" className="btn btn-soft" onClick={() => markExpensePaid(row.id)}>
                                    ทำเครื่องหมายจ่ายแล้ว
                                  </button>
                                ) : null}
                                {row.status !== EXPENSE_STATUS.cancelled ? (
                                  <button type="button" className="btn btn-soft" onClick={() => cancelExpense(row.id)}>
                                    ยกเลิก
                                  </button>
                                ) : null}
                                <button type="button" className="btn btn-soft" onClick={() => deleteExpense(row.id)}>
                                  ลบ
                                </button>
                              </div>
                            </footer>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}

          {tab === 'report' ? (
            <>
              <div className="acct-filters no-print">
                <label>ตั้งแต่วัน<input type="date" className="form-control" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
                <label>ถึงวัน<input type="date" className="form-control" value={to} onChange={(event) => setTo(event.target.value)} /></label>
                <label>หมวด
                  <select className="form-control" value={kind} onChange={(event) => setKind(event.target.value)}>
                    <option value="all">ทั้งหมด</option>
                    {KINDS.map((id) => <option key={id} value={id}>{PAY_KIND_LABEL[id]}</option>)}
                    <option value="expense">รายจ่าย (เบิกใช้จ่าย)</option>
                  </select>
                </label>
                <button type="button" className="btn btn-sky" onClick={() => window.print()}>บันทึก PDF</button>
              </div>
              <section className="acct-card acct-report">
                <header className="acct-report-head">
                  <div className="acct-brand">
                    <span><i className="bi bi-balloon-heart-fill" /></span>
                    PetCare
                  </div>
                  <div>
                    <h2>รายงานรายรับรายจ่าย</h2>
                    <p>{rangeLabel}</p>
                    <p>ออกเอกสารเมื่อ {printedAt}</p>
                  </div>
                </header>
                <div className="acct-sum3">
                  <div><span>รายรับ</span><strong className="is-in">{money(income)}</strong></div>
                  <div><span>รายจ่าย</span><strong className="is-out">{money(expense)}</strong></div>
                  <div><span>คงเหลือสุทธิ</span><strong>{money(net)}</strong></div>
                </div>
                <h3>สรุปตามหมวด</h3>
                <table className="acct-table">
                  <thead>
                    <tr>
                      <th>ประเภท</th>
                      <th>หมวด</th>
                      <th>จำนวนรายการ</th>
                      <th>ยอดรวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...reportKinds, ...reportExpenseKinds].map((item) => (
                      <tr key={`${item.type}-${item.id}`}>
                        <td>{item.type}</td>
                        <td>{item.label}</td>
                        <td>{item.count}</td>
                        <td>{money(item.sum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3>รายละเอียด</h3>
                <table className="acct-table">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>ประเภท</th>
                      <th>หมวด</th>
                      <th>รายการ</th>
                      <th>คู่ค้า / ลูกค้า</th>
                      <th>รายรับ</th>
                      <th>รายจ่าย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportLines.map((row) => (
                      <tr key={row.id}>
                        <td>{/^\d{4}-\d{2}-\d{2}$/.test(String(row.when || '')) ? formatDay(row.when) : formatWhen(row.when)}</td>
                        <td>{row.type}</td>
                        <td>{row.category}</td>
                        <td>{row.title}</td>
                        <td>{row.party}</td>
                        <td>{money(row.income)}</td>
                        <td>{money(row.expense)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={5}>รวม</th>
                      <th>{money(income)}</th>
                      <th>{money(expense)}</th>
                    </tr>
                  </tfoot>
                </table>
                {reportLines.length === 0 ? <p>ไม่มีรายการในช่วงนี้</p> : null}
              </section>
            </>
          ) : null}
        </main>
      </div>
    </StaffWorkspace>
  );
}
