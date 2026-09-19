'use client';
import Link from 'next/link';
import { Download, Music, Sparkles, Scissors, Languages, Wand2 } from 'lucide-react';
import { UrlDownloader } from '@/components/UrlDownloader';

const FEATURES = [
  { icon: Music,    title: 'Karaoke Maker',    desc: 'AI vocal removal + synced lyrics overlay', href: '/karaoke' },
  { icon: Languages,title: 'Auto Subtitles',   desc: 'Whisper-powered transcription in 90+ languages', href: '/subtitles' },
  { icon: Sparkles, title: 'AI Upscaling',     desc: 'Boost video quality up to 4K with Real-ESRGAN' },
  { icon: Scissors, title: 'Trim & Merge',     desc: 'Cut, splice, and join clips with precision' },
  { icon: Wand2,    title: 'BG Remover',       desc: 'Remove video backgrounds in one click' },
  { icon: Download, title: 'Any Platform',     desc: 'YouTube, Vimeo, Twitter, TikTok, Instagram' }
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          Download. Enhance.<br/>
          <span className="gradient-text">Create magic.</span>
        </h1>
        <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
          Paste any video URL. Download in any quality. Then transform it into a karaoke,
          add subtitles, upscale, or remove the background — all powered by AI.
        </p>
        <UrlDownloader />
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need, in one place</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map((f) => {
            const inner = (
              <>
                <f.icon className="w-8 h-8 text-pink-400 mb-3" />
                <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
                <p className="text-gray-400 text-sm">{f.desc}</p>
              </>
            );
            return (f as any).href ? (
              <Link key={f.title} href={(f as any).href} className="glass rounded-2xl p-6 hover:scale-[1.02] transition block">
                {inner}
              </Link>
            ) : (
              <div key={f.title} className="glass rounded-2xl p-6 hover:scale-[1.02] transition">
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-gray-500">
        <p>VidForge © {new Date().getFullYear()} — Use responsibly. Respect copyright.</p>
      </footer>
    </main>
  );
}
