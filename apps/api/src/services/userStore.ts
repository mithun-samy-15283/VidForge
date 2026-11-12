import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseError, Pool } from 'pg';

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

const USERS_FILE = resolveStoragePath('users.json');
const databaseUrl = process.env.DATABASE_URL?.trim();
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
let schemaPromise: Promise<void> | null = null;

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date | string;
}

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
    return parsed.filter((value): value is StoredUser => {
      if (!isRecord(value)) return false;
      return Boolean(
        typeof value.id === 'string' &&
          typeof value.email === 'string' &&
          typeof value.passwordHash === 'string' &&
          typeof value.createdAt === 'string'
      );
    });
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
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
  if (pool) {
    await ensureDatabaseSchema();
    const result = await pool.query<UserRow>(
      `SELECT id, email, password_hash, created_at
       FROM vidforge_users
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail],
    );
    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  const users = await readUsers();
  return users.find((u) => u.email === normalizedEmail) ?? null;
}

export async function createUser(email: string, passwordHash: string): Promise<StoredUser> {
  const normalizedEmail = email.trim().toLowerCase();
  if (pool) {
    await ensureDatabaseSchema();
    const user: StoredUser = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    try {
      const result = await pool.query<UserRow>(
        `INSERT INTO vidforge_users (id, email, password_hash, created_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, password_hash, created_at`,
        [user.id, user.email, user.passwordHash, user.createdAt],
      );
      return mapUserRow(result.rows[0]);
    } catch (error: unknown) {
      if (error instanceof DatabaseError && error.code === '23505') {
        throw createConflictError();
      }
      throw error;
    }
  }

  const users = await readUsers();
  const existing = users.find((u) => u.email === normalizedEmail);

  if (existing) {
    throw createConflictError();
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

async function ensureDatabaseSchema() {
  if (!pool) return;
  schemaPromise ??= pool.query(`
    CREATE TABLE IF NOT EXISTS vidforge_users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).then(() => undefined);
  return schemaPromise;
}

function mapUserRow(row: UserRow): StoredUser {
  const createdAt = row.created_at instanceof Date
    ? row.created_at.toISOString()
    : new Date(row.created_at).toISOString();
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt,
  };
}

function createConflictError() {
  return Object.assign(new Error('Email is already registered'), { status: 409 });
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
