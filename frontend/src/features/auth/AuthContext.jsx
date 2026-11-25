import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AUTH_API_URL } from '../../shared/api.js';
import { STORAGE_KEYS, newId, readJSON, writeJSON } from '../../shared/utils/storage.js';
import { hashPassword, needsPasswordRehash, verifyPassword } from './password.js';
import { ROLES, homePathForRole, normalizeRole } from './roles.js';
import { API_BASE } from '../pet-owner/api.js';
import { STAFF_SESSION_EXPIRED, clearStaffSession, readStaffSession, saveStaffSession } from './staffSession.js';

const AuthContext = createContext(null);
const WELCOME_POINTS = 50;
const DEMO_DRIVER_ID = 'driver-seed';
const DEMO_OWNER_ID = 'owner-seed';

const SEED_ADMIN = {
  email: 'admin@petcare.local',
  password: 'Admin1234',
  firstName: 'Admin',
  lastName: 'PetCare',
  phone: '0200000000',
};

const SEED_OWNER = {
  id: DEMO_OWNER_ID,
  email: 'owner@petcare.local',
  password: 'Owner1234',
  firstName: 'มานี',
  lastName: 'รักสัตว์',
  phone: '0810001111',
};

const SEED_DRIVER = {
  id: DEMO_DRIVER_ID,
  email: 'driver@petcare.local',
  password: '1234',
  firstName: 'สมชาย',
  lastName: 'คนขับ',
  phone: '0890001122',
  vehicle: 'รถตู้',
  plateNumber: 'สก 1234',
  licenseNumber: 'DL-88001234',
  licenseExpiry: '2028-12-31',
};

const SEED_ACCOUNTANT = {
  email: 'accountant@petcare.local',
  password: 'Account1234',
  firstName: 'ฝ่าย',
  lastName: 'บัญชี',
  phone: '0200000001',
};

const SEED_FINANCE = {
  id: 'finance-seed',
  email: 'finance@petcare.local',
  password: 'Finance1234',
  firstName: 'กานต์',
  lastName: 'การเงิน',
  phone: '0211112222',
};

const usersListeners = new Set();

function notifyUsers() {
  usersListeners.forEach((listener) => listener());
}

export function subscribeUsers(listener) {
  usersListeners.add(listener);
  const onStorage = (event) => {
    if (event.key === STORAGE_KEYS.users) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    usersListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function loadUsersRaw() {
  return readJSON(STORAGE_KEYS.users, []);
}

function loadUsers() {
  return loadUsersRaw().map((user) => ({ ...user, role: normalizeRole(user.role) }));
}

function saveUsers(users) {
  writeJSON(STORAGE_KEYS.users, users);
  notifyUsers();
}

function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash: _hash, salt: _salt, ...rest } = user;
  return { ...rest, role: normalizeRole(rest.role) };
}

async function upsertSeedUser(users, seed, role) {
  const existing = users.find((user) => user.email === seed.email || (seed.id && user.id === seed.id));
  const salt = newId();
  const passwordHash = await hashPassword(seed.password, salt);
  const base = {
    id: seed.id || existing?.id || newId(),
    firstName: seed.firstName,
    lastName: seed.lastName,
    email: seed.email,
    phone: seed.phone || '',
    address: existing?.address || '',
    emergencyName: existing?.emergencyName || '',
    emergencyPhone: existing?.emergencyPhone || '',
    avatar: existing?.avatar || '',
    points: existing?.points ?? (role === ROLES.owner ? WELCOME_POINTS : 0),
    role,
    vehicle: seed.vehicle || existing?.vehicle || '',
    plateNumber: seed.plateNumber || existing?.plateNumber || '',
    licenseNumber: seed.licenseNumber || existing?.licenseNumber || '',
    licenseExpiry: seed.licenseExpiry || existing?.licenseExpiry || '',
    active: true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    salt,
    passwordHash,
  };

  if (!existing) {
    users.push(base);
    return true;
  }

  const passwordOk = await verifyPassword(seed.password, existing.salt, existing.passwordHash);
  const needsSync =
    existing.id !== base.id
    || existing.role !== role
    || existing.active === false
    || !passwordOk
    || needsPasswordRehash(existing.passwordHash);
  if (!needsSync) return false;

  const index = users.findIndex((user) => user.id === existing.id || user.email === seed.email);
  if (index >= 0) users[index] = { ...existing, ...base };
  return true;
}

async function ensureUsersBootstrapped() {
  let users = loadUsersRaw();
  let changed = false;

  users = users.map((user) => {
    if (user.role) return user;
    changed = true;
    return { ...user, role: ROLES.owner };
  });

  if (await upsertSeedUser(users, SEED_ADMIN, ROLES.admin)) changed = true;
  if (await upsertSeedUser(users, SEED_OWNER, ROLES.owner)) changed = true;
  if (await upsertSeedUser(users, SEED_DRIVER, ROLES.driver)) changed = true;
  if (await upsertSeedUser(users, SEED_ACCOUNTANT, ROLES.accountant)) changed = true;
  if (await upsertSeedUser(users, SEED_FINANCE, ROLES.finance)) changed = true;

  if (changed) saveUsers(users);
  return users;
}

let bootPromise = null;
function bootUsers() {
  if (!bootPromise) {
    bootPromise = ensureUsersBootstrapped().catch((error) => {
      bootPromise = null;
      throw error;
    });
  }
  return bootPromise;
}

function loadStoredSession() {
  const rememberedSession = readJSON(STORAGE_KEYS.session, null);
  if (rememberedSession?.userId) return rememberedSession;
  const temporarySession = readJSON(STORAGE_KEYS.session, null, sessionStorage);
  return temporarySession?.userId ? temporarySession : null;
}

function loadAuthState() {
  const session = loadStoredSession();
  const user = session && loadUsers().find((item) => item.id === session.userId);
  return {
    currentUser: toPublicUser(user),
    authToken: user ? session.authToken || '' : '',
  };
}

function localUserFromServer(serverUser, existingUser) {
  const localFields = existingUser
    ? { ...existingUser }
    : {
      address: '',
      emergencyName: '',
      emergencyPhone: '',
      avatar: '',
      points: WELCOME_POINTS,
    };
  delete localFields.passwordHash;
  delete localFields.salt;
  return {
    ...localFields,
    ...serverUser,
    id: existingUser?.id ?? serverUser.id,
    role: ROLES.owner,
  };
}

async function requestAuth(path, { token, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${AUTH_API_URL}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่');
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'ดำเนินการบัญชีไม่สำเร็จ');
  return result;
}

export function memberTier(points = 0) {
  if (points >= 1000) return 'Gold';
  if (points >= 300) return 'Silver';
  return 'Bronze';
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(loadAuthState);
  const [usersVersion, setUsersVersion] = useState(0);
  const { currentUser, authToken } = authState;
  const [currentStaff, setCurrentStaff] = useState(() => readStaffSession()?.staff ?? null);

  useEffect(() => {
    let cancelled = false;
    bootUsers().then(() => {
      if (cancelled) return;
      setAuthState(loadAuthState());
      setUsersVersion((version) => version + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => setCurrentStaff(null);
    window.addEventListener(STAFF_SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(STAFF_SESSION_EXPIRED, onExpired);
  }, []);

  const bumpUsers = useCallback(() => setUsersVersion((version) => version + 1), []);

  const startSession = useCallback((user, remember, token = '') => {
    localStorage.removeItem(STORAGE_KEYS.session);
    sessionStorage.removeItem(STORAGE_KEYS.session);
    writeJSON(
      STORAGE_KEYS.session,
      { userId: user.id, authToken: token },
      remember ? localStorage : sessionStorage,
    );
    setAuthState({ currentUser: toPublicUser(user), authToken: token });
  }, []);

  const register = useCallback(async ({ firstName, lastName, email, phone, password }) => {
    await bootUsers();
    const result = await requestAuth('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, phone, password, remember: true }),
    });
    const users = loadUsers();
    const existing = users.find((user) => user.email === result.user.email);
    const user = localUserFromServer(result.user, existing);
    saveUsers([...users.filter((item) => item.id !== user.id), user]);
    bumpUsers();
    startSession(user, true, result.token);
    return toPublicUser(user);
  }, [bumpUsers, startSession]);

  const login = useCallback(async (email, password, remember = true) => {
    await bootUsers();
    const normalizedEmail = email.trim().toLowerCase();
    const users = loadUsers();
    const localUser = users.find((user) => user.email === normalizedEmail);

    if (localUser?.salt && localUser?.passwordHash) {
      const passwordMatches = await verifyPassword(password, localUser.salt, localUser.passwordHash);
      if (passwordMatches) {
        if (localUser.active === false) throw new Error('บัญชีนี้ถูกระงับการใช้งาน ติดต่อแอดมิน');
        let user = localUser;
        if (needsPasswordRehash(localUser.passwordHash)) {
          const salt = newId();
          const passwordHash = await hashPassword(password, salt);
          user = { ...localUser, salt, passwordHash };
          saveUsers(users.map((item) => (item.id === user.id ? user : item)));
          bumpUsers();
        }
        startSession(user, remember);
        return toPublicUser(user);
      }
      throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const result = await requestAuth('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password, remember }),
    });
    const existing = users.find((user) => user.email === result.user.email);
    const user = localUserFromServer(result.user, existing);
    saveUsers([...users.filter((item) => item.id !== user.id), user]);
    bumpUsers();
    startSession(user, remember, result.token);
    return toPublicUser(user);
  }, [bumpUsers, startSession]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.session);
    sessionStorage.removeItem(STORAGE_KEYS.session);
    setAuthState({ currentUser: null, authToken: '' });
  }, []);

  const staffLogin = useCallback(async (email, password, remember = true) => {
    let response;
    try {
      response = await fetch(`${API_BASE}/api/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่');
    }
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    saveStaffSession({ token: body.token, staff: body.staff }, remember);
    setCurrentStaff(body.staff);
    return body.staff;
  }, []);

  const staffLogout = useCallback(() => {
    clearStaffSession();
    setCurrentStaff(null);
  }, []);

  const updateProfile = useCallback(async (patch) => {
    if (!currentUser) throw new Error('กรุณาเข้าสู่ระบบ');
    const users = loadUsers();
    const email = patch.email?.trim().toLowerCase();
    if (email && users.some((user) => user.email === email && user.id !== currentUser.id)) {
      throw new Error('อีเมลนี้มีผู้ใช้อื่นใช้แล้ว');
    }
    const { role: _role, ...safePatch } = patch;
    const accountPatch = Object.fromEntries(
      ['firstName', 'lastName', 'email', 'phone']
        .filter((key) => safePatch[key] !== undefined)
        .map((key) => [key, key === 'email' ? email : safePatch[key]]),
    );
    let serverUser = {};
    if (authToken && Object.keys(accountPatch).length) {
      const result = await requestAuth('/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        token: authToken,
        body: JSON.stringify(accountPatch),
      });
      serverUser = result.user;
    }
    const next = users.map((user) =>
      user.id === currentUser.id
        ? { ...user, ...safePatch, ...serverUser, ...(email ? { email } : {}) }
        : user,
    );
    saveUsers(next);
    bumpUsers();
    setAuthState((state) => ({
      ...state,
      currentUser: toPublicUser(next.find((user) => user.id === currentUser.id)),
    }));
  }, [authToken, bumpUsers, currentUser]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!currentUser) throw new Error('กรุณาเข้าสู่ระบบ');
    if (authToken) {
      await requestAuth('/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        token: authToken,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return;
    }

    const users = loadUsers();
    const user = users.find((item) => item.id === currentUser.id);
    if (!user || !(await verifyPassword(currentPassword, user.salt, user.passwordHash))) {
      throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }
    const salt = newId();
    const passwordHash = await hashPassword(newPassword, salt);
    saveUsers(users.map((item) => (item.id === user.id ? { ...item, salt, passwordHash } : item)));
    bumpUsers();
  }, [authToken, bumpUsers, currentUser]);

  const createDriver = useCallback(async ({ firstName, lastName, email, phone, password, vehicle }) => {
    if (!currentUser || currentUser.role !== ROLES.admin) {
      throw new Error('เฉพาะแอดมินเท่านั้นที่สร้างบัญชีคนขับได้');
    }
    await bootUsers();
    const users = loadUsers();
    const normalizedEmail = email.trim().toLowerCase();
    if (users.some((user) => user.email === normalizedEmail)) throw new Error('อีเมลนี้มีในระบบแล้ว');
    if (!password || password.length < 8) throw new Error('รหัสผ่านอย่างน้อย 8 ตัวอักษร');
    const salt = newId();
    const user = {
      id: newId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: (phone || '').trim(),
      address: '',
      emergencyName: '',
      emergencyPhone: '',
      avatar: '',
      points: 0,
      role: ROLES.driver,
      vehicle: (vehicle || '').trim(),
      plateNumber: '',
      licenseNumber: '',
      licenseExpiry: '',
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
      salt,
      passwordHash: await hashPassword(password, salt),
    };
    saveUsers([...users, user]);
    bumpUsers();
    return toPublicUser(user);
  }, [bumpUsers, currentUser]);

  const updateDriver = useCallback((driverId, patch) => {
    if (!currentUser || currentUser.role !== ROLES.admin) throw new Error('เฉพาะแอดมินเท่านั้น');
    const users = loadUsers();
    const target = users.find((user) => user.id === driverId && user.role === ROLES.driver);
    if (!target) throw new Error('ไม่พบบัญชีคนขับ');
    const email = patch.email?.trim().toLowerCase();
    if (email && users.some((user) => user.email === email && user.id !== driverId)) {
      throw new Error('อีเมลนี้มีผู้ใช้อื่นใช้แล้ว');
    }
    const { role: _role, passwordHash: _hash, salt: _salt, ...safePatch } = patch;
    const next = users.map((user) => user.id === driverId
      ? {
        ...user,
        ...safePatch,
        ...(email ? { email } : {}),
        ...(patch.vehicle != null ? { vehicle: String(patch.vehicle).trim() } : {}),
      }
      : user);
    saveUsers(next);
    bumpUsers();
    return toPublicUser(next.find((user) => user.id === driverId));
  }, [bumpUsers, currentUser]);

  const setDriverActive = useCallback((driverId, active) => {
    if (!currentUser || currentUser.role !== ROLES.admin) throw new Error('เฉพาะแอดมินเท่านั้น');
    const users = loadUsers();
    if (!users.some((user) => user.id === driverId && user.role === ROLES.driver)) {
      throw new Error('ไม่พบบัญชีคนขับ');
    }
    saveUsers(users.map((user) => (user.id === driverId ? { ...user, active: Boolean(active) } : user)));
    bumpUsers();
  }, [bumpUsers, currentUser]);

  const drivers = useMemo(() => {
    void usersVersion;
    return loadUsers()
      .filter((user) => user.role === ROLES.driver)
      .map(toPublicUser)
      .sort((left, right) => left.firstName.localeCompare(right.firstName, 'th'));
  }, [usersVersion]);

  const value = useMemo(() => ({
    currentUser,
    authToken,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
    currentStaff,
    staffLogin,
    staffLogout,
    createDriver,
    updateDriver,
    setDriverActive,
    drivers,
    homePath: homePathForRole(currentUser?.role),
  }), [
    currentUser,
    authToken,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
    currentStaff,
    staffLogin,
    staffLogout,
    createDriver,
    updateDriver,
    setDriverActive,
    drivers,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

export const DEMO_OWNER_LOGIN = { email: SEED_OWNER.email, password: SEED_OWNER.password };
export const DEMO_ADMIN_LOGIN = { email: SEED_ADMIN.email, password: SEED_ADMIN.password };
export const DEMO_DRIVER_LOGIN = { email: SEED_DRIVER.email, password: SEED_DRIVER.password };
export const DEMO_ACCOUNTANT_LOGIN = { email: SEED_ACCOUNTANT.email, password: SEED_ACCOUNTANT.password };
export const DEMO_FINANCE_LOGIN = { email: SEED_FINANCE.email, password: SEED_FINANCE.password };
