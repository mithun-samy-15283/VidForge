'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthApiError, setAuthToken, signin } from '@/lib/auth';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showSignupHelp, setShowSignupHelp] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setShowSignupHelp(false);
    setLoading(true);
    try {
      const result = await signin(email, password);
      setAuthToken(result.token);
      router.push('/');
      router.refresh();
    } catch (err: any) {
      const authError = err as AuthApiError;

      if (authError.code === 'AUTH_USER_NOT_FOUND') {
        setError(`No account found for ${email.trim().toLowerCase()}.`);
        setShowSignupHelp(true);
      } else if (authError.code === 'AUTH_INVALID_PASSWORD') {
        setError('That password is incorrect for this account.');
      } else if (authError.code === 'VALIDATION_ERROR') {
        const emailError = authError.fieldErrors?.email?.[0];
        const passwordError = authError.fieldErrors?.password?.[0];
        setError(emailError || passwordError || 'Please enter a valid email and password.');
      } else {
        setError(authError.message || 'Sign in failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-6 py-14">
      <div className="glass rounded-2xl p-7 animate-scaleIn">
        <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
        <p className="text-sm text-gray-400 mb-6">Sign in to continue using VidForge.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm text-gray-300 block mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/15 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm text-gray-300 block mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/15 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {error ? (
            <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              <p>{error}</p>
              {showSignupHelp ? (
                <p className="mt-1">
                  New here?{' '}
                  <Link href="/signup" className="text-rose-200 underline hover:text-white">
                    Create your account
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-sm text-gray-400 mt-5">
          No account yet?{' '}
          <Link href="/signup" className="text-pink-400 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
