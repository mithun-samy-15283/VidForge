'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';
import { AuthUser, clearAuthToken, getAuthToken, getCurrentUser } from '@/lib/auth';

interface RequireAuthProps {
  children: (user: AuthUser) => ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = getAuthToken();

    if (!token) {
      setLoading(false);
      return;
    }

    getCurrentUser(token)
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
      })
      .catch(() => {
        clearAuthToken();
        if (!active) return;
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-14">
        <div className="glass rounded-2xl p-7">
          <p className="text-sm text-gray-400">Loading your account…</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-md mx-auto px-6 py-14">
        <div className="glass rounded-2xl p-7 text-center">
          <h1 className="text-2xl font-bold mb-2">Sign in required</h1>
          <p className="text-sm text-gray-400 mb-6">You need to sign in before viewing this page.</p>
          <Link
            href="/signin"
            className="inline-flex rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return <>{children(user)}</>;
}
