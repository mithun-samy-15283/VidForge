'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
const USERS_TABLE = 'VidForgeUsers';
const AUTH_EXPIRES_IN = '7d';
const JOB_EXPIRES_IN = '15m';

app.disable('x-powered-by');
app.use(cors);
app.use(express.json({ limit: '64kb' }));

const authSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const urlSchema = z.object({
  url: z.string().url().refine(
    (value) =>
      /(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|twitter\.com|x\.com|instagram\.com|facebook\.com)/i.test(
        value,
      ),
    { message: 'Unsupported platform' },
  ),
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vidforge-catalyst-mock',
    environment: 'Development',
    ts: Date.now(),
  });
});

app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const { email, password } = authSchema.parse(req.body);
    const catalystApp = catalyst.initialize(req, { scope: 'admin' });
    const existing = await findUserByEmail(catalystApp, email);

    if (existing) {
      return res.status(409).json({
        error: 'An account already exists for this email',
        code: 'AUTH_EMAIL_EXISTS',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await catalystApp.datastore().table(USERS_TABLE).insertRow({
      email,
      password_hash: passwordHash,
    });
    const user = toPublicUser(inserted);

    return res.status(201).json({
      token: signAuthToken(user),
      user,
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/signin', async (req, res, next) => {
  try {
    const { email, password } = authSchema.parse(req.body);
    const catalystApp = catalyst.initialize(req, { scope: 'admin' });
    const userRow = await findUserByEmail(catalystApp, email);

    if (!userRow) {
      return res.status(404).json({
        error: 'No account found for this email',
        code: 'AUTH_USER_NOT_FOUND',
      });
    }

    const passwordOk = await bcrypt.compare(password, userRow.password_hash);
    if (!passwordOk) {
      return res.status(401).json({
        error: 'Incorrect password for this account',
        code: 'AUTH_INVALID_PASSWORD',
      });
    }

    const user = toPublicUser(userRow);
    return res.json({
      token: signAuthToken(user),
      user,
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const catalystApp = catalyst.initialize(req, { scope: 'admin' });
    const userRow = await findUserByEmail(catalystApp, res.locals.auth.email);

    if (!userRow || String(userRow.ROWID) !== res.locals.auth.sub) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    return res.json({ user: toPublicUser(userRow) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/video/info', async (req, res, next) => {
  try {
    const { url } = urlSchema.parse(req.body);
    const parsedUrl = new URL(url);
    const source = parsedUrl.hostname.replace(/^www\./, '');
    const title = `Catalyst mock preview from ${source}`;

    return res.json({
      title,
      thumbnail: createThumbnailDataUrl(title),
      duration: 184,
      mock: true,
      formats: [
        {
          format_id: 'mock-720p',
          ext: 'mp4',
          resolution: '1280x720',
          filesize: 18 * 1024 * 1024,
          label: 'Catalyst demo',
        },
        {
          format_id: 'mock-audio',
          ext: 'mp3',
          resolution: 'audio',
          filesize: 4 * 1024 * 1024,
          label: 'Mock audio',
        },
      ],
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/video/download', requireAuth, createJob('download'));
app.post('/api/video/karaoke', requireAuth, createJob('karaoke'));
app.post('/api/video/subtitles', requireAuth, createJob('subtitles'));

app.get('/api/jobs/:id', requireAuth, (req, res) => {
  try {
    const job = verifyJobToken(req.params.id);
    if (job.userId !== res.locals.auth.sub) {
      return res.status(403).json({ error: 'This job belongs to another account' });
    }

    return res.json(getJobState(req.params.id, job));
  } catch {
    return res.status(404).json({ error: 'Job not found or expired' });
  }
});

app.get('/api/jobs/:id/file', requireAuth, (req, res) => {
  try {
    const job = verifyJobToken(req.params.id);
    if (job.userId !== res.locals.auth.sub) {
      return res.status(403).json({ error: 'This job belongs to another account' });
    }

    const state = getJobState(req.params.id, job);
    if (state.state !== 'completed') {
      return res.status(409).json({ error: 'Job not completed', state: state.state });
    }

    const filename = `vidforge-${job.type}-mock.svg`;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(createMockArtifact(job));
  } catch {
    return res.status(404).json({ error: 'Job not found or expired' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Please correct the highlighted fields',
      code: 'VALIDATION_ERROR',
      details: error.flatten(),
    });
  }

  if (isDuplicateError(error)) {
    return res.status(409).json({
      error: 'An account already exists for this email',
      code: 'AUTH_EMAIL_EXISTS',
    });
  }

  return res.status(500).json({ error: 'Unexpected server error' });
});

function cors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-VidForge-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(origin && !isAllowedOrigin(origin) ? 403 : 204).end();
  }
  return next();
}

function isAllowedOrigin(origin) {
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      (protocol === 'http:' && ['localhost', '127.0.0.1'].includes(hostname)) ||
      (protocol === 'https:' &&
        (hostname.endsWith('.onslate.com') ||
          hostname.endsWith('.onslate.in') ||
          hostname.endsWith('.catalystserverless.in')))
    );
  } catch {
    return false;
  }
}

function createJob(type) {
  return (req, res, next) => {
    try {
      const { url } = urlSchema.parse(req.body);
      const now = Date.now();
      const job = {
        type,
        url,
        userId: res.locals.auth.sub,
        createdAt: now,
        language: req.body.language || 'auto',
        formatId: req.body.formatId || 'mock-720p',
      };
      return res.status(202).json({ jobId: signJobToken(job) });
    } catch (error) {
      return next(error);
    }
  };
}

function getJobState(id, job) {
  const age = Math.max(0, Date.now() - job.createdAt);
  let state = 'active';
  let progress = 12;
  let label = 'Preparing Catalyst mock job';

  if (age >= 3500) {
    state = 'completed';
    progress = 100;
    label = 'Done (Catalyst mock demo)';
  } else if (age >= 2200) {
    progress = 78;
    label = job.type === 'karaoke' ? 'Mocking vocal separation' : 'Preparing mock output';
  } else if (age >= 900) {
    progress = 42;
    label = 'Validating source URL';
  }

  return {
    id,
    name: job.type,
    state,
    progress,
    label,
    data: { url: job.url, language: job.language, formatId: job.formatId },
    returnvalue:
      state === 'completed'
        ? {
            mock: true,
            fileName: `vidforge-${job.type}-mock.svg`,
            separationMethod: job.type === 'karaoke' ? 'Catalyst mock' : undefined,
            transcriptionMethod:
              job.type === 'karaoke' || job.type === 'subtitles'
                ? 'Catalyst mock'
                : undefined,
          }
        : null,
    failedReason: null,
  };
}

async function requireAuth(req, res, next) {
  const customToken = req.headers['x-vidforge-token'];
  const authorization = req.headers.authorization;
  const token =
    (typeof customToken === 'string' && customToken) ||
    (authorization && authorization.startsWith('Bearer ') ? authorization.slice(7) : null);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    res.locals.auth = jwt.verify(token, getJwtSecret(), {
      issuer: 'vidforge-catalyst',
      audience: 'vidforge-web',
    });
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

async function findUserByEmail(catalystApp, email) {
  const escapedEmail = email.replace(/'/g, "''");
  const rows = await catalystApp
    .zcql()
    .executeZCQLQuery(
      `SELECT ROWID, email, password_hash, CREATEDTIME FROM ${USERS_TABLE} WHERE email = '${escapedEmail}' LIMIT 0, 1`,
    );
  return rows[0] ? rows[0][USERS_TABLE] : null;
}

function toPublicUser(row) {
  return {
    id: String(row.ROWID),
    email: row.email,
    createdAt: normalizeCatalystDate(row.CREATEDTIME),
  };
}

function normalizeCatalystDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function signAuthToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    getJwtSecret(),
    {
      expiresIn: AUTH_EXPIRES_IN,
      issuer: 'vidforge-catalyst',
      audience: 'vidforge-web',
    },
  );
}

function signJobToken(job) {
  return jwt.sign(job, getJwtSecret(), {
    expiresIn: JOB_EXPIRES_IN,
    issuer: 'vidforge-catalyst',
    audience: 'vidforge-job',
  });
}

function verifyJobToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    issuer: 'vidforge-catalyst',
    audience: 'vidforge-job',
  });
}

function getJwtSecret() {
  const secret = process.env.VIDFORGE_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('VIDFORGE_JWT_SECRET must be configured with at least 32 characters');
  }
  return secret;
}

function createThumbnailDataUrl(title) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#ec4899"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="640" height="360" fill="#120817"/><rect x="20" y="20" width="600" height="320" rx="28" fill="url(#g)" opacity=".8"/><text x="320" y="165" text-anchor="middle" fill="white" font-family="sans-serif" font-size="32" font-weight="700">VidForge</text><text x="320" y="215" text-anchor="middle" fill="white" font-family="sans-serif" font-size="18">${escapeXml(title)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createMockArtifact(job) {
  const title = `VidForge ${job.type} mock result`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#ec4899"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="1280" height="720" fill="#100713"/><rect x="60" y="60" width="1160" height="600" rx="42" fill="url(#g)" opacity=".85"/><text x="640" y="300" text-anchor="middle" fill="white" font-family="sans-serif" font-size="54" font-weight="700">${escapeXml(title)}</text><text x="640" y="380" text-anchor="middle" fill="white" font-family="sans-serif" font-size="28">Development-only Slate + Functions demo</text><text x="640" y="440" text-anchor="middle" fill="white" font-family="sans-serif" font-size="22">${escapeXml(job.url)}</text></svg>`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isDuplicateError(error) {
  const text = `${error?.message || ''} ${JSON.stringify(error || {})}`;
  return /duplicate|unique|already exists/i.test(text);
}

module.exports = app;
