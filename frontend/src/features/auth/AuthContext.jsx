import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AUTH_API_URL } from '../../shared/api.js';
import { STORAGE_KEYS, readJSON, writeJSON } from '../../shared/utils/storage.js';

const AuthContext = createContext(null);

const WELCOME_POINTS = 50;

function loadUsers() {
  return readJSON(STORAGE_KEYS.users, []);
}

function saveUsers(users) {
  writeJSON(STORAGE_KEYS.users, users);
}

function loadStoredSession() {
  const rememberedSession = readJSON(STORAGE_KEYS.session, null);
  if (rememberedSession?.userId && rememberedSession?.authToken) return rememberedSession;
  const temporarySession = readJSON(STORAGE_KEYS.session, null, sessionStorage);
  return temporarySession?.userId && temporarySession?.authToken ? temporarySession : null;
}

function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash: _hash, salt: _salt, ...rest } = user;
  return rest;
}

function localUserFromServer(serverUser, existingUser) {
  const user = existingUser
    ? { ...existingUser }
    : {
      address: '',
      emergencyName: '',
      emergencyPhone: '',
      avatar: '',
      points: WELCOME_POINTS,
    };
  delete user.passwordHash;
  delete user.salt;
  return {
    ...user,
    ...serverUser,
    id: existingUser?.id ?? serverUser.id,
  };
}

function loadAuthState() {
  const session = loadStoredSession();
  const user = session && loadUsers().find((item) => item.id === session.userId);
  return {
    currentUser: toPublicUser(user),
    authToken: user ? session.authToken : '',
  };
}

async function requestAuth(path, { token, ...options } = {}) {
  const response = await fetch(`${AUTH_API_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
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
  const { currentUser, authToken } = authState;

  const startSession = useCallback((user, remember, token) => {
    localStorage.removeItem(STORAGE_KEYS.session);
    sessionStorage.removeItem(STORAGE_KEYS.session);
    writeJSON(
      STORAGE_KEYS.session,
      { userId: user.id, authToken: token },
      remember ? localStorage : sessionStorage,
    );
    setAuthState({ currentUser: toPublicUser(user), authToken: token });
  }, []);

  const register = useCallback(
    async ({ firstName, lastName, email, phone, password }) => {
      const result = await requestAuth('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, phone, password, remember: true }),
      });
      const users = loadUsers();
      const normalizedEmail = result.user.email;
      const existingUser = users.find((user) => user.email === normalizedEmail);
      const user = localUserFromServer(result.user, existingUser);
      saveUsers([...users.filter((item) => item.id !== user.id), user]);
      startSession(user, true, result.token);
      return toPublicUser(user);
    },
    [startSession],
  );

  const login = useCallback(
    async (email, password, remember = true) => {
      const result = await requestAuth('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember }),
      });
      const users = loadUsers();
      const existingUser = users.find((user) => user.email === result.user.email);
      const user = localUserFromServer(result.user, existingUser);
      saveUsers([...users.filter((item) => item.id !== user.id), user]);
      startSession(user, remember, result.token);
      return toPublicUser(user);
    },
    [startSession],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.session);
    sessionStorage.removeItem(STORAGE_KEYS.session);
    setAuthState({ currentUser: null, authToken: '' });
  }, []);

  const updateProfile = useCallback(
    async (patch) => {
      if (!currentUser || !authToken) throw new Error('กรุณาเข้าสู่ระบบใหม่');
      const users = loadUsers();
      const email = patch.email?.trim().toLowerCase();
      if (email && users.some((user) => user.email === email && user.id !== currentUser.id)) {
        throw new Error('อีเมลนี้มีผู้ใช้อื่นใช้แล้ว');
      }

      const accountPatch = Object.fromEntries(
        ['firstName', 'lastName', 'email', 'phone']
          .filter((key) => patch[key] !== undefined)
          .map((key) => [key, patch[key]]),
      );
      if (Object.keys(accountPatch).length) {
        await requestAuth('/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          token: authToken,
          body: JSON.stringify(accountPatch),
        });
      }

      const next = users.map((user) =>
        user.id === currentUser.id ? { ...user, ...patch, ...(email ? { email } : {}) } : user,
      );
      saveUsers(next);
      setAuthState((state) => ({
        ...state,
        currentUser: toPublicUser(next.find((user) => user.id === currentUser.id)),
      }));
    },
    [authToken, currentUser],
  );

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      if (!currentUser || !authToken) throw new Error('กรุณาเข้าสู่ระบบใหม่');
      await requestAuth('/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        token: authToken,
        body: JSON.stringify({ currentPassword, newPassword }),
      });

    },
    [authToken, currentUser],
  );

  const value = useMemo(
    () => ({ currentUser, authToken, register, login, logout, updateProfile, changePassword }),
    [currentUser, authToken, register, login, logout, updateProfile, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
