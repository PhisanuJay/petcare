import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AUTH_API_URL } from '../../shared/api.js';
import { STORAGE_KEYS, readJSON, writeJSON } from '../../shared/utils/storage.js';
import { ROLES, homePathForRole, normalizeRole } from './roles.js';
import { API_BASE } from '../pet-owner/api.js';
import { STAFF_SESSION_EXPIRED, clearStaffSession, readStaffSession, saveStaffSession } from './staffSession.js';

const AuthContext = createContext(null);
const WELCOME_POINTS = 50;

/** Hint credentials — accounts are seeded in dbo.users. */
export const DEMO_OWNER_LOGIN = { email: 'owner@petcare.local', password: 'Owner1234' };
export const DEMO_ADMIN_LOGIN = { email: 'admin@petcare.local', password: 'Admin1234' };
export const DEMO_DRIVER_LOGIN = { email: 'driver@petcare.local', password: '1234' };
export const DEMO_ACCOUNTANT_LOGIN = { email: 'accountant@petcare.local', password: 'Account1234' };
export const DEMO_SUPER_ADMIN_LOGIN = { email: 'superadmin@petcare.local', password: '1234' };
export const DEMO_FIND_HOME_LOGIN = { email: 'findhome@petcare.local', password: 'FindHome1234' };
export const DEMO_ADOPTION_STAFF_LOGIN = { email: 'adoption@petcare.local', password: 'Adoption1234' };

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

function cachePublicUser(serverUser) {
  const users = loadUsers();
  const existing = users.find((user) => user.id === serverUser.id || user.email === serverUser.email);
  const nextUser = {
    ...(existing || {}),
    ...serverUser,
    role: normalizeRole(serverUser.role),
    points: serverUser.points ?? existing?.points ?? (serverUser.role === ROLES.owner ? WELCOME_POINTS : 0),
  };
  delete nextUser.passwordHash;
  delete nextUser.salt;
  saveUsers([...users.filter((item) => item.id !== nextUser.id && item.email !== nextUser.email), nextUser]);
  return nextUser;
}

export async function listLocalOwnerAccounts() {
  try {
    const response = await fetch(`${AUTH_API_URL}/owners`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(body.owners)) {
      return body.owners.sort((left, right) => left.displayName.localeCompare(right.displayName, 'th'));
    }
  } catch {
    /* fall through to local cache */
  }
  return loadUsers()
    .filter((user) => user.role === ROLES.owner && user.active !== false)
    .map((user) => ({
      id: user.id,
      email: user.email,
      displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      isActive: true,
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName, 'th'));
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
      points: serverUser.role === ROLES.owner ? WELCOME_POINTS : 0,
    };
  delete localFields.passwordHash;
  delete localFields.salt;
  return {
    ...localFields,
    ...serverUser,
    id: existingUser?.id ?? serverUser.id,
    role: normalizeRole(serverUser.role || existingUser?.role || ROLES.owner),
  };
}

async function requestAccountantSession(email, password) {
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
  if (body.staff?.role !== ROLES.accountant) {
    throw new Error('บัญชีนี้ไม่มีสิทธิ์ตรวจสอบการชำระเงิน');
  }
  return body;
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
  const [remoteDrivers, setRemoteDrivers] = useState([]);
  const { currentUser, authToken } = authState;
  const [currentStaff, setCurrentStaff] = useState(() => readStaffSession()?.staff ?? null);

  useEffect(() => {
    const onExpired = () => setCurrentStaff(null);
    window.addEventListener(STAFF_SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(STAFF_SESSION_EXPIRED, onExpired);
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.role !== ROLES.admin || !authToken) {
      setRemoteDrivers([]);
      return undefined;
    }
    let cancelled = false;
    requestAuth('/drivers', { token: authToken })
      .then((result) => {
        if (cancelled) return;
        const list = Array.isArray(result.drivers) ? result.drivers.map(toPublicUser) : [];
        list.forEach((driver) => cachePublicUser(driver));
        setRemoteDrivers(list);
      })
      .catch(() => {
        if (!cancelled) setRemoteDrivers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken, currentUser]);

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
    const result = await requestAuth('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, phone, password, remember: true }),
    });
    const user = cachePublicUser(localUserFromServer(result.user));
    bumpUsers();
    clearStaffSession();
    setCurrentStaff(null);
    startSession(user, true, result.token);
    return toPublicUser(user);
  }, [bumpUsers, setCurrentStaff, startSession]);

  const login = useCallback(async (email, password, remember = true) => {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await requestAuth('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password, remember }),
    });
    const user = cachePublicUser(localUserFromServer(result.user));
    bumpUsers();

    if (normalizeRole(user.role) === ROLES.accountant) {
      const staffSession = await requestAccountantSession(normalizedEmail, password);
      saveStaffSession({ token: staffSession.token, staff: staffSession.staff }, remember);
      setCurrentStaff(staffSession.staff);
    } else {
      clearStaffSession();
      setCurrentStaff(null);
    }

    startSession(user, remember, result.token);
    return toPublicUser(user);
  }, [bumpUsers, setCurrentStaff, startSession]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.session);
    sessionStorage.removeItem(STORAGE_KEYS.session);
    clearStaffSession();
    setCurrentStaff(null);
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
    if (!authToken) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    await requestAuth('/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      token: authToken,
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }, [authToken, currentUser]);

  const createDriver = useCallback(async ({ firstName, lastName, email, phone, password, vehicle }) => {
    if (!currentUser || currentUser.role !== ROLES.admin) {
      throw new Error('เฉพาะแอดมินเท่านั้นที่สร้างบัญชีคนขับได้');
    }
    if (!authToken) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    const result = await requestAuth('/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      token: authToken,
      body: JSON.stringify({ firstName, lastName, email, phone, password, vehicle }),
    });
    const user = cachePublicUser(localUserFromServer(result.user));
    setRemoteDrivers((prev) => {
      const next = [...prev.filter((item) => item.id !== user.id), toPublicUser(user)];
      return next.sort((left, right) => left.firstName.localeCompare(right.firstName, 'th'));
    });
    bumpUsers();
    return toPublicUser(user);
  }, [authToken, bumpUsers, currentUser]);

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
    if (remoteDrivers.length) {
      return [...remoteDrivers].sort((left, right) => left.firstName.localeCompare(right.firstName, 'th'));
    }
    void usersVersion;
    return loadUsers()
      .filter((user) => user.role === ROLES.driver)
      .map(toPublicUser)
      .sort((left, right) => left.firstName.localeCompare(right.firstName, 'th'));
  }, [remoteDrivers, usersVersion]);

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
