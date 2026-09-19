import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createUser, findUserByEmail } from '../services/userStore';
import { signAuthToken } from '../utils/jwt';
import { requireAuth } from '../middleware/requireAuth';

const r = Router();

const authSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
});

r.post('/signup', async (req, res, next) => {
  try {
    const { email, password } = authSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser(email, passwordHash);
    const token = signAuthToken({ sub: user.id, email: user.email });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (e) {
    return next(e);
  }
});

r.post('/signin', async (req, res, next) => {
  try {
    const { email, password } = authSchema.parse(req.body);
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        error: 'No account found for this email',
        code: 'AUTH_USER_NOT_FOUND'
      });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({
        error: 'Incorrect password for this account',
        code: 'AUTH_INVALID_PASSWORD'
      });
    }

    const token = signAuthToken({ sub: user.id, email: user.email });
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (e) {
    return next(e);
  }
});

r.get('/me', requireAuth, async (_req, res) => {
  const auth = res.locals.auth as { sub: string; email: string };
  const user = await findUserByEmail(auth.email);

  if (!user || user.id !== auth.sub) {
    return res.status(401).json({ error: 'User no longer exists' });
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt
    }
  });
});

export default r;
