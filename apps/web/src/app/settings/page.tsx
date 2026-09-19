'use client';

import { useRouter } from 'next/navigation';
import { Bell, Database, LogOut, Shield, UserCog } from 'lucide-react';
import { RequireAuth } from '@/components/RequireAuth';
import { clearAuthToken } from '@/lib/auth';

const SETTINGS = [
  {
    icon: Shield,
    title: 'Authentication',
    description: 'JWT session is active on this browser.',
    value: 'Signed in'
  },
  {
    icon: Database,
    title: 'Account storage',
    description: 'User accounts are currently stored in local development storage.',
    value: 'Local JSON'
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: 'Email notifications are not enabled yet.',
    value: 'Off'
  }
];

export default function SettingsPage() {
  const router = useRouter();

  return (
    <RequireAuth>
      {(user) => (
        <main className="max-w-4xl mx-auto px-6 py-12">
          <section className="glass rounded-3xl p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <UserCog className="h-6 w-6 text-pink-300" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-400">
                  Basic account settings for <span className="text-gray-200">{user.email}</span>.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 space-y-4">
            {SETTINGS.map((item) => (
              <div key={item.title} className="glass rounded-2xl p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                      <item.icon className="h-5 w-5 text-purple-300" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-white">{item.title}</h2>
                      <p className="mt-1 text-sm text-gray-400">{item.description}</p>
                    </div>
                  </div>
                  <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-200">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </section>

          <section className="mt-6 glass rounded-2xl p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-white">Account actions</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Sign out clears the local token from this browser.
                </p>
              </div>
              <button
                onClick={() => {
                  clearAuthToken();
                  router.push('/');
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/30 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10 transition"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </section>
        </main>
      )}
    </RequireAuth>
  );
}
