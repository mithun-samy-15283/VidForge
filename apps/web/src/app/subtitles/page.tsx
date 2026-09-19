'use client';
import { useState, useCallback } from 'react';
import { Languages, Link as LinkIcon, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useJobPoller } from '@/hooks/useJobPoller';
import { JobProgress } from '@/components/JobProgress';

const LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
];

export default function SubtitlesPage() {
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState('auto');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { job, error: pollError, start, reset } = useJobPoller({ interval: 1500 });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const { data } = await api.post('/api/video/subtitles', {
        url: url.trim(),
        language: language === 'auto' ? undefined : language,
      });
      start(data.jobId);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || 'Failed to start subtitle job');
    } finally {
      setSubmitting(false);
    }
  }, [url, language, start]);

  const handleDownload = useCallback(() => {
    if (!job?.id) return;
    window.open(`/api/jobs/${job.id}/file`, '_blank');
  }, [job]);

  const handleReset = useCallback(() => {
    setUrl('');
    setSubmitError('');
    reset();
  }, [reset]);

  const isProcessing = !!job && job.state !== 'completed' && job.state !== 'failed';

  return (
    <main className="min-h-screen">
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-20">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4">
            <Languages className="w-4 h-4" />
            AI Auto Subtitles
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Auto-generate{' '}
            <span className="gradient-text">subtitles</span>
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Powered by OpenAI Whisper. Transcribe any video in 90+ languages with
            word-level accuracy. Coming soon!
          </p>
        </div>

        {/* URL Input */}
        <form onSubmit={handleSubmit} className="space-y-3 mb-6">
          <div className="glass rounded-2xl p-2 flex gap-2">
            <div className="flex-1 flex items-center gap-3 px-4">
              <LinkIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isProcessing}
                placeholder="Paste a video URL..."
                className="flex-1 bg-transparent outline-none placeholder-gray-500 disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || isProcessing || !url.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 font-medium disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
              ) : (
                <><Languages className="w-4 h-4" /> Generate</>
              )}
            </button>
          </div>

          {/* Language picker */}
          <div className="flex items-center gap-3 px-1">
            <label className="text-sm text-gray-400">Language:</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isProcessing}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500/50 disabled:opacity-50"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-gray-900">
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </form>

        {submitError && (
          <p className="text-red-400 text-sm mb-4 text-center">{submitError}</p>
        )}

        {/* Job Progress */}
        <JobProgress
          job={job}
          error={pollError}
          onDownload={handleDownload}
          onReset={handleReset}
        />

        {/* Placeholder notice */}
        {!job && (
          <div className="mt-8 glass rounded-xl p-6 border border-yellow-500/20 bg-yellow-500/5 text-center">
            <p className="text-sm text-yellow-400">
              🚧 <strong>Coming soon:</strong> The subtitle pipeline backend is a placeholder.
              Karaoke generation is fully functional — try it from the{' '}
              <a href="/karaoke" className="underline hover:text-yellow-300">Karaoke</a> page!
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
