import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

const USERS_FILE = resolveStoragePath('users.json');

function resolveStoragePath(fileName: string) {
  const storageDir = process.env.STORAGE_DIR || './storage';
  const basePath = isAbsolute(storageDir)
    ? storageDir
    : resolve(process.cwd(), storageDir);
  return resolve(basePath, fileName);
}

async function readUsers(): Promise<StoredUser[]> {
  try {
    const raw = await readFile(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u): u is StoredUser => {
      return Boolean(
        u &&
          typeof u === 'object' &&
          typeof (u as StoredUser).id === 'string' &&
          typeof (u as StoredUser).email === 'string' &&
          typeof (u as StoredUser).passwordHash === 'string' &&
          typeof (u as StoredUser).createdAt === 'string'
      );
    });
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeUsers(users: StoredUser[]) {
  await mkdir(dirname(USERS_FILE), { recursive: true });
  const tmpPath = `${USERS_FILE}.tmp`;
  await writeFile(tmpPath, JSON.stringify(users, null, 2), 'utf8');
  await rename(tmpPath, USERS_FILE);
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const users = await readUsers();
  return users.find((u) => u.email === normalizedEmail) ?? null;
}

export async function createUser(email: string, passwordHash: string): Promise<StoredUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const users = await readUsers();
  const existing = users.find((u) => u.email === normalizedEmail);

  if (existing) {
    const err = new Error('Email is already registered');
    (err as any).status = 409;
    throw err;
  }

  const user: StoredUser = {
    id: randomUUID(),
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  await writeUsers(users);
  return user;
}
