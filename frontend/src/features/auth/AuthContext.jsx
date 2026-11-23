import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS, newId, readJSON, writeJSON } from '../../shared/utils/storage.js';
import { hashPassword, verifyPassword } from './password.js';
import { ROLES, homePathForRole, normalizeRole } from './roles.js';

const AuthContext = createContext(null);

const WELCOME_POINTS = 50;

const SEED_ADMIN = {
  email: 'admin@petcare.local',
  password: 'Admin1234',
  firstName: 'Admin',
  lastName: 'PetCare',
  phone: '0200000000',
};

const usersListeners = new Set();

function notifyUsers() {
  usersListeners.forEach((l) => l());
}

export function subscribeUsers(listener) {
  usersListeners.add(listener);
  const onStorage = (e) => {
    if (e.key === STORAGE_KEYS.users) listener();
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

function saveUsers(users) {
  writeJSON(STORAGE_KEYS.users, users);
  notifyUsers();
}

/** Migrate legacy users + ensure seed admin exists. */
async function ensureUsersBootstrapped() {
  let users = loadUsersRaw();
  let changed = false;

  users = users.map((u) => {
    if (u.role) return u;
    changed = true;
    return { ...u, role: ROLES.owner };
  });

  const adminEmail = SEED_ADMIN.email;
  if (!users.some((u) => u.email === adminEmail)) {
    const salt = newId();
    users.push({
      id: newId(),
      firstName: SEED_ADMIN.firstName,
      lastName: SEED_ADMIN.lastName,
      email: adminEmail,
      phone: SEED_ADMIN.phone,
      address: '',
      emergencyName: '',
      emergencyPhone: '',
      avatar: '',
      points: 0,
      role: ROLES.admin,
      vehicle: '',
      active: true,
      createdAt: new Date().toISOString(),
      salt,
      passwordHash: await hashPassword(SEED_ADMIN.password, salt),
    });
    changed = true;
  }

  if (changed) saveUsers(users);
  return users;
}

let bootPromise = null;
function bootUsers() {
  if (!bootPromise) bootPromise = ensureUsersBootstrapped();
  return bootPromise;
}

function loadUsers() {
  return loadUsersRaw().map((u) => ({ ...u, role: normalizeRole(u.role) }));
}

function loadSessionUserId() {
  return (
    readJSON(STORAGE_KEYS.session, null)?.userId ??
    readJSON(STORAGE_KEYS.session, null, sessionStorage)?.userId ??
    null
  );
}

function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash: _hash, salt: _salt, ...rest } = user;
  return { ...rest, role: normalizeRole(rest.role) };
}

function findCurrentUser() {
  const id = loadSessionUserId();
  return id ? loadUsers().find((u) => u.id === id) ?? null : null;
}

export function memberTier(points = 0) {
  if (points >= 1000) return 'Gold';
  if (points >= 300) return 'Silver';
  return 'Bronze';
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => toPublicUser(findCurrentUser()));
  const [usersVersion, setUsersVersion] = useState(0);

  // Bootstrap seed admin once (async hash).
  useEffect(() => {
    let cancelled = false;
    bootUsers().then(() => {
      if (cancelled) return;
      setCurrentUser(toPublicUser(findCurrentUser()));
      setUsersVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const bumpUsers = useCallback(() => setUsersVersion((v) => v + 1), []);

  const startSession = useCallback((user, remember) => {
    localStorage.removeItem(STORAGE_KEYS.session);
    sessionStorage.removeItem(STORAGE_KEYS.session);
    writeJSON(STORAGE_KEYS.session, { userId: user.id }, remember ? localStorage : sessionStorage);
    setCurrentUser(toPublicUser(user));
  }, []);

  const register = useCallback(
    async ({ firstName, lastName, email, phone, password }) => {
      await bootUsers();
      const users = loadUsers();
      const normalizedEmail = email.trim().toLowerCase();
      if (users.some((u) => u.email === normalizedEmail)) {
        throw new Error('อีเมลนี้ถูกใช้สมัครแล้ว ลองเข้าสู่ระบบแทน');
      }
      const salt = newId();
      const user = {
        id: newId(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        address: '',
        emergencyName: '',
        emergencyPhone: '',
        avatar: '',
        points: WELCOME_POINTS,
        role: ROLES.owner,
        vehicle: '',
        active: true,
        createdAt: new Date().toISOString(),
        salt,
        passwordHash: await hashPassword(password, salt),
      };
      saveUsers([...users, user]);
      bumpUsers();
      startSession(user, true);
      return toPublicUser(user);
    },
    [startSession, bumpUsers],
  );

  const login = useCallback(
    async (email, password, remember = true) => {
      await bootUsers();
      const user = loadUsers().find((u) => u.email === email.trim().toLowerCase());
      if (!user || !(await verifyPassword(password, user.salt, user.passwordHash))) {
        throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }
      if (user.active === false) {
        throw new Error('บัญชีนี้ถูกระงับการใช้งาน ติดต่อแอดมิน');
      }
      startSession(user, remember);
      return toPublicUser(user);
    },
    [startSession],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.session);
    sessionStorage.removeItem(STORAGE_KEYS.session);
    setCurrentUser(null);
  }, []);

  const updateProfile = useCallback(
    (patch) => {
      if (!currentUser) throw new Error('กรุณาเข้าสู่ระบบ');
      const users = loadUsers();
      const email = patch.email?.trim().toLowerCase();
      if (email && users.some((u) => u.email === email && u.id !== currentUser.id)) {
        throw new Error('อีเมลนี้มีผู้ใช้อื่นใช้แล้ว');
      }
      // Owners cannot self-elevate role
      const { role: _role, ...safePatch } = patch;
      const next = users.map((u) =>
        u.id === currentUser.id ? { ...u, ...safePatch, ...(email ? { email } : {}) } : u,
      );
      saveUsers(next);
      bumpUsers();
      setCurrentUser(toPublicUser(next.find((u) => u.id === currentUser.id)));
    },
    [currentUser, bumpUsers],
  );

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      if (!currentUser) throw new Error('กรุณาเข้าสู่ระบบ');
      const users = loadUsers();
      const user = users.find((u) => u.id === currentUser.id);
      if (!(await verifyPassword(currentPassword, user.salt, user.passwordHash))) {
        throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
      }
      const salt = newId();
      const passwordHash = await hashPassword(newPassword, salt);
      saveUsers(users.map((u) => (u.id === user.id ? { ...u, salt, passwordHash } : u)));
    },
    [currentUser],
  );

  /** Admin-only: create a driver account (cannot self-register). */
  const createDriver = useCallback(
    async ({ firstName, lastName, email, phone, password, vehicle }) => {
      if (!currentUser || currentUser.role !== ROLES.admin) {
        throw new Error('เฉพาะแอดมินเท่านั้นที่สร้างบัญชีคนขับได้');
      }
      await bootUsers();
      const users = loadUsers();
      const normalizedEmail = email.trim().toLowerCase();
      if (users.some((u) => u.email === normalizedEmail)) {
        throw new Error('อีเมลนี้มีในระบบแล้ว');
      }
      if (!password || password.length < 8) {
        throw new Error('รหัสผ่านอย่างน้อย 8 ตัวอักษร');
      }
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
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
        salt,
        passwordHash: await hashPassword(password, salt),
      };
      saveUsers([...users, user]);
      bumpUsers();
      return toPublicUser(user);
    },
    [currentUser, bumpUsers],
  );

  const updateDriver = useCallback(
    (driverId, patch) => {
      if (!currentUser || currentUser.role !== ROLES.admin) {
        throw new Error('เฉพาะแอดมินเท่านั้น');
      }
      const users = loadUsers();
      const target = users.find((u) => u.id === driverId && u.role === ROLES.driver);
      if (!target) throw new Error('ไม่พบบัญชีคนขับ');
      const email = patch.email?.trim().toLowerCase();
      if (email && users.some((u) => u.email === email && u.id !== driverId)) {
        throw new Error('อีเมลนี้มีผู้ใช้อื่นใช้แล้ว');
      }
      const { role: _r, passwordHash: _p, salt: _s, ...safe } = patch;
      const next = users.map((u) =>
        u.id === driverId
          ? {
              ...u,
              ...safe,
              ...(email ? { email } : {}),
              ...(patch.vehicle != null ? { vehicle: String(patch.vehicle).trim() } : {}),
            }
          : u,
      );
      saveUsers(next);
      bumpUsers();
      return toPublicUser(next.find((u) => u.id === driverId));
    },
    [currentUser, bumpUsers],
  );

  const setDriverActive = useCallback(
    (driverId, active) => {
      if (!currentUser || currentUser.role !== ROLES.admin) {
        throw new Error('เฉพาะแอดมินเท่านั้น');
      }
      const users = loadUsers();
      if (!users.some((u) => u.id === driverId && u.role === ROLES.driver)) {
        throw new Error('ไม่พบบัญชีคนขับ');
      }
      saveUsers(users.map((u) => (u.id === driverId ? { ...u, active: !!active } : u)));
      bumpUsers();
    },
    [currentUser, bumpUsers],
  );

  const drivers = useMemo(() => {
    void usersVersion;
    return loadUsers()
      .filter((u) => u.role === ROLES.driver)
      .map(toPublicUser)
      .sort((a, b) => a.firstName.localeCompare(b.firstName, 'th'));
  }, [usersVersion]);

  const value = useMemo(
    () => ({
      currentUser,
      register,
      login,
      logout,
      updateProfile,
      changePassword,
      createDriver,
      updateDriver,
      setDriverActive,
      drivers,
      homePath: homePathForRole(currentUser?.role),
    }),
    [
      currentUser,
      register,
      login,
      logout,
      updateProfile,
      changePassword,
      createDriver,
      updateDriver,
      setDriverActive,
      drivers,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Demo seed credentials (shown on login for staff). */
export const DEMO_ADMIN_LOGIN = {
  email: SEED_ADMIN.email,
  password: SEED_ADMIN.password,
};
