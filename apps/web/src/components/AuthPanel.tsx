'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Settings, UserRound } from 'lucide-react';
import { AuthUser, AUTH_CHANGED_EVENT, clearAuthToken, getAuthToken, getCurrentUser } from '@/lib/auth';

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function AuthPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const token = getAuthToken();
      if (!token) {
        setUser(null);
        setReady(true);
        return;
      }

      try {
        const currentUser = await getCurrentUser(token);
        if (!active) return;
        setUser(currentUser);
      } catch {
        clearAuthToken();
        if (!active) return;
        setUser(null);
      } finally {
        if (active) setReady(true);
      }
    }

    loadUser();
    window.addEventListener(AUTH_CHANGED_EVENT, loadUser);
    window.addEventListener('storage', loadUser);

    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, loadUser);
      window.removeEventListener('storage', loadUser);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 py-1.5 pl-1.5 pr-3 text-left hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-purple-500/70"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-xs font-bold">
          {getInitials(user.email)}
        </span>
        <span className="hidden max-w-[190px] truncate text-sm text-gray-200 md:block">{user.email}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-white/15 bg-[#130a18]/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-sm font-bold">
                {getInitials(user.email)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">Signed in</p>
                <p className="truncate text-xs text-gray-400">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="p-2">
            <Link
              href="/profile"
              role="menuitem"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition"
            >
              <UserRound className="h-4 w-4 text-pink-300" />
              Profile
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition"
            >
              <Settings className="h-4 w-4 text-purple-300" />
              Settings
            </Link>
            <button
              role="menuitem"
              onClick={() => {
                clearAuthToken();
                setUser(null);
                router.push('/');
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-rose-200 hover:bg-rose-500/10 transition"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
