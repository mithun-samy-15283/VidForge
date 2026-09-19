import jwt, { SignOptions } from 'jsonwebtoken';

export interface AuthTokenClaims {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

export function signAuthToken(payload: { sub: string; email: string }) {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

export function verifyAuthToken(token: string): AuthTokenClaims {
  const decoded = jwt.verify(token, getJwtSecret());
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid auth token');
  }
  if (typeof decoded.sub !== 'string' || typeof decoded.email !== 'string') {
    throw new Error('Invalid auth token payload');
  }
  return decoded as AuthTokenClaims;
}
