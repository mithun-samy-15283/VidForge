'use client';

import Link from 'next/link';
import { CalendarDays, Mail, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { RequireAuth } from '@/components/RequireAuth';

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(date));
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      {(user) => (
        <main className="max-w-5xl mx-auto px-6 py-12">
          <section className="glass rounded-3xl p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500 to-purple-600 text-2xl font-extrabold shadow-xl shadow-purple-950/30">
                  {initials(user.email)}
                </div>
                <div>
                  <p className="text-sm text-gray-400">VidForge profile</p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight">Your account</h1>
                  <p className="mt-2 max-w-xl text-sm text-gray-400">
                    Manage your identity, plan, and saved workspace details for VidForge.
                  </p>
                </div>
              </div>
              <Link
                href="/settings"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-gray-100 hover:bg-white/10 transition"
              >
                <Settings className="h-4 w-4" />
                Account settings
              </Link>
            </div>
          </section>

          <section className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="glass rounded-2xl p-6">
              <Mail className="mb-4 h-6 w-6 text-pink-300" />
              <p className="text-sm text-gray-400">Email</p>
              <p className="mt-1 break-words font-semibold text-white">{user.email}</p>
            </div>
            <div className="glass rounded-2xl p-6">
              <CalendarDays className="mb-4 h-6 w-6 text-purple-300" />
              <p className="text-sm text-gray-400">Joined</p>
              <p className="mt-1 font-semibold text-white">{formatDate(user.createdAt)}</p>
            </div>
            <div className="glass rounded-2xl p-6">
              <ShieldCheck className="mb-4 h-6 w-6 text-emerald-300" />
              <p className="text-sm text-gray-400">Account status</p>
              <p className="mt-1 font-semibold text-white">Active</p>
            </div>
          </section>

          <section className="mt-6 glass rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <UserRound className="mt-1 h-5 w-5 text-pink-300" />
              <div>
                <h2 className="text-lg font-semibold">Basic profile</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  This profile is connected to your local VidForge auth account. More profile fields
                  can be added here later when the app moves from local file storage to a production database.
                </p>
              </div>
            </div>
          </section>
        </main>
      )}
    </RequireAuth>
  );
}
