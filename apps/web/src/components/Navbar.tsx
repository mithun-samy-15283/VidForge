'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Download, Music, Languages } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AuthPanel } from '@/components/AuthPanel';

const NAV_LINKS = [
  { href: '/',          label: 'Download',  icon: Download },
  { href: '/karaoke',   label: 'Karaoke',   icon: Music },
  { href: '/subtitles', label: 'Subtitles', icon: Languages },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
      <div className="flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl">VidForge</span>
        </Link>

        {/* Page links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      <AuthPanel />
    </nav>
  );
}
