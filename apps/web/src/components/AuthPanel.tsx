'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthUser, clearAuthToken, getAuthToken, getCurrentUser } from '@/lib/auth';

export function AuthPanel() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    const token = getAuthToken();
    if (!token) {
      setReady(true);
      return;
    }

    getCurrentUser(token)
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
      })
      .catch(() => {
        clearAuthToken();
      })
      .finally(() => {
        if (!active) return;
        setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return <div className="text-sm text-gray-400">Checking session…</div>;
  }

  if (!user) {
    return (
      <div className="flex gap-3">
        <Link href="/signin" className="px-4 py-2 text-sm hover:text-pink-400 transition">
          Sign in
        </Link>
        <Link
          href="/signup"
          className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 transition"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-300 hidden md:inline">{user.email}</span>
      <button
        onClick={() => {
          clearAuthToken();
          setUser(null);
        }}
        className="px-4 py-2 text-sm rounded-lg border border-white/15 hover:bg-white/5 transition"
      >
        Sign out
      </button>
    </div>
  );
}
