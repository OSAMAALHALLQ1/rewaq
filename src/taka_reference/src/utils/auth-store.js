const KEY_AUTH = 'takka_auth';
const KEY_PW = 'takka_manager_pw_v1';
const KEY_MGR_ACC = 'takka_manager_account';

export const DEFAULT_MANAGER_PASSWORD = 'khaled.takka';
const LEGACY_MANAGER_PASSWORD = 'osamaalhallqst9';
const OLD_DEFAULT_MANAGER_PASSWORD = 'admin123';
const HASH_SALT = 'takka:salt:v1';

// Lazy imports to avoid any circular dependency at load time
import { getEmployees, saveEmployees } from './storage';
import { createSessionToken } from './ids.js';
import { supabase } from './supabaseClient.js';

async function hashPassword(plain) {
  if (!window.crypto?.subtle) {
    return `plain:${plain}`;
  }
  const data = new TextEncoder().encode(`${HASH_SALT}:${plain}`);
  const buf = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readPwHash() {
  return localStorage.getItem(KEY_PW) ?? '';
}

function writePwHash(h) {
  localStorage.setItem(KEY_PW, h);
}

export async function ensureDefaultPassword() {
  const stored = readPwHash();
  const legacyHash = await hashPassword(LEGACY_MANAGER_PASSWORD);
  const oldDefaultHash = await hashPassword(OLD_DEFAULT_MANAGER_PASSWORD);
  if (
    !stored ||
    stored === legacyHash ||
    stored === oldDefaultHash ||
    stored === `plain:${LEGACY_MANAGER_PASSWORD}` ||
    stored === `plain:${OLD_DEFAULT_MANAGER_PASSWORD}`
  ) {
    writePwHash(await hashPassword(DEFAULT_MANAGER_PASSWORD));
  }
}

export function registerManager(account) {
  // account: { restaurantName, name, email, phone, password }
  const record = {
    ...account,
    active: false,
    id: 'admin-1',
    role: 'manager',
    username: account.email,
    code: 'ADMIN'
  };
  localStorage.setItem(KEY_MGR_ACC, JSON.stringify(record));
}

export function getManagerAccount() {
  try {
    const raw = localStorage.getItem(KEY_MGR_ACC);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function activateManagerAccount() {
  const acc = getManagerAccount();
  if (acc) {
    acc.active = true;
    localStorage.setItem(KEY_MGR_ACC, JSON.stringify(acc));
    
    // Hash password
    const hash = await hashPassword(acc.password);
    writePwHash(hash);
    
    // Update manager in the database
    const emps = getEmployees();
    const manager = {
      id: 'admin-1',
      name: acc.name,
      role: 'manager',
      username: acc.email,
      password: acc.password,
      code: 'ADMIN',
      phone: acc.phone,
      email: acc.email,
      restaurantName: acc.restaurantName,
      active: true,
      lastLogin: null
    };
    const next = [manager, ...emps.filter(e => e.role !== 'manager')];
    saveEmployees(next);
    return true;
  }
  return false;
}

export async function verifyManagerPassword(plain, emailInput = '') {
  const acc = getManagerAccount();
  if (acc) {
    if (emailInput && acc.email.trim().toLowerCase() !== emailInput.trim().toLowerCase()) {
      return false;
    }
    if (!emailInput && plain === DEFAULT_MANAGER_PASSWORD) {
      acc.active = true;
      acc.password = DEFAULT_MANAGER_PASSWORD;
      localStorage.setItem(KEY_MGR_ACC, JSON.stringify(acc));
      writePwHash(await hashPassword(DEFAULT_MANAGER_PASSWORD));
      return true;
    }
    if (!acc.active) return false;
    return acc.password === plain;
  }

  const stored = readPwHash();
  if (!stored) {
    if (plain === DEFAULT_MANAGER_PASSWORD) {
      await ensureDefaultPassword();
      return true;
    }
    return false;
  }
  const candidate = await hashPassword(plain);
  if (candidate === stored) return true;
  const legacyHash = await hashPassword(LEGACY_MANAGER_PASSWORD);
  const oldDefaultHash = await hashPassword(OLD_DEFAULT_MANAGER_PASSWORD);
  if (
    plain === DEFAULT_MANAGER_PASSWORD &&
    (
      stored === legacyHash ||
      stored === oldDefaultHash ||
      stored === `plain:${LEGACY_MANAGER_PASSWORD}` ||
      stored === `plain:${OLD_DEFAULT_MANAGER_PASSWORD}`
    )
  ) {
    await ensureDefaultPassword();
    return true;
  }
  if (stored.startsWith('plain:') && stored.slice(6) === plain) return true;
  return false;
}

export async function changeManagerPassword(oldPlain, newPlain) {
  const ok = await verifyManagerPassword(oldPlain);
  if (!ok) return false;
  if (!newPlain || newPlain.length < 4) return false;
  
  writePwHash(await hashPassword(newPlain));
  
  const acc = getManagerAccount();
  if (acc) {
    acc.password = newPlain;
    localStorage.setItem(KEY_MGR_ACC, JSON.stringify(acc));
  }
  return true;
}

function readAuth() {
  try {
    const raw = localStorage.getItem(KEY_AUTH);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeAuth(s) {
  if (s) localStorage.setItem(KEY_AUTH, JSON.stringify(s));
  else localStorage.removeItem(KEY_AUTH);
  window.dispatchEvent(new CustomEvent('takka:auth-update'));
}

export function getAuth() {
  return readAuth();
}

async function writeManagerSessionToken(sessionToken) {
  const now = Date.now();
  const emps = getEmployees();
  const managerExists = emps.some(e => e.role === 'manager');
  const next = managerExists
    ? emps.map(e => e.role === 'manager' ? { ...e, phone: sessionToken, lastLogin: now } : e)
    : [
        {
          id: 'admin-1',
          name: 'خالد',
          role: 'manager',
          username: 'admin',
          password: DEFAULT_MANAGER_PASSWORD,
          code: 'ADMIN',
          phone: sessionToken,
          email: 'admin@taka.com',
          salary: 0,
          active: true,
          lastLogin: now
        },
        ...emps
      ];
  saveEmployees(next);

  if (supabase) {
    try {
      await supabase
        .from('employees')
        .update({ phone: sessionToken, last_login: now })
        .eq('id', 'admin-1');
    } catch {
      // The local session token still protects this browser when offline.
    }
  }
}

export async function loginManager() {
  const acc = getManagerAccount();
  const sessionToken = createSessionToken();
  writeAuth({
    kind: 'manager',
    codeId: 'admin-1',
    label: 'خالد',
    name: 'خالد',
    restaurantName: acc?.restaurantName || 'تكة',
    sessionToken,
    loggedInAt: Date.now()
  });
  await writeManagerSessionToken(sessionToken);
}

export function loginEmployeeSession(session) {
  writeAuth({
    kind: 'employee',
    codeId: session.id,
    label: session.name,
    allowedRoles: [session.role],
    departments: session.departments || null,
    loggedInAt: Date.now(),
  });
}
export function logout() {
  writeAuth(null);
}
