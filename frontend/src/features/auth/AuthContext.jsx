import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { STORAGE_KEYS, newId, readJSON, writeJSON } from '../../shared/utils/storage.js';
import { hashPassword, verifyPassword } from './password.js';

const AuthContext = createContext(null);

const WELCOME_POINTS = 50;

function loadUsers() {
  return readJSON(STORAGE_KEYS.users, []);
}

function saveUsers(users) {
  writeJSON(STORAGE_KEYS.users, users);
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
  return rest;
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

  const startSession = useCallback((user, remember) => {
    localStorage.removeItem(STORAGE_KEYS.session);
    sessionStorage.removeItem(STORAGE_KEYS.session);
    writeJSON(STORAGE_KEYS.session, { userId: user.id }, remember ? localStorage : sessionStorage);
    setCurrentUser(toPublicUser(user));
  }, []);

  const register = useCallback(
    async ({ firstName, lastName, email, phone, password }) => {
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
        createdAt: new Date().toISOString(),
        salt,
        passwordHash: await hashPassword(password, salt),
      };
      saveUsers([...users, user]);
      startSession(user, true);
      return toPublicUser(user);
    },
    [startSession],
  );

  const login = useCallback(
    async (email, password, remember = true) => {
      const user = loadUsers().find((u) => u.email === email.trim().toLowerCase());
      if (!user || !(await verifyPassword(password, user.salt, user.passwordHash))) {
        throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
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
      const next = users.map((u) =>
        u.id === currentUser.id ? { ...u, ...patch, ...(email ? { email } : {}) } : u,
      );
      saveUsers(next);
      setCurrentUser(toPublicUser(next.find((u) => u.id === currentUser.id)));
    },
    [currentUser],
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

  const value = useMemo(
    () => ({ currentUser, register, login, logout, updateProfile, changePassword }),
    [currentUser, register, login, logout, updateProfile, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
