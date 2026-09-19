'use client';
import { useState, useCallback } from 'react';
import {
  Music,
  Link as LinkIcon,
  Loader2,
  Film,
  AudioWaveform,
  Mic2,
  Wand2,
  RotateCcw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useJobPoller } from '@/hooks/useJobPoller';
import { JobProgress } from '@/components/JobProgress';
import { KaraokePreview } from '@/components/KaraokePreview';

const STEPS = [
  { icon: Film, label: 'Download source video' },
  { icon: AudioWaveform, label: 'Extract audio track' },
  { icon: Mic2, label: 'Separate vocals & instrumental' },
  { icon: Wand2, label: 'Transcribe & sync lyrics' },
  { icon: Music, label: 'Render karaoke video' },
];

export default function KaraokePage() {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { job, error: pollError, start, reset } = useJobPoller({ interval: 2000 });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!url.trim()) return;

      setSubmitting(true);
      setSubmitError('');

      try {
        const { data } = await api.post('/api/video/karaoke', { url: url.trim() });
        start(data.jobId);
      } catch (err: any) {
        setSubmitError(
          err?.response?.data?.error ||
            err?.response?.data?.details?.formErrors?.join(', ') ||
            'Failed to start karaoke job',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [url, start],
  );

  const handleReset = useCallback(() => {
    setUrl('');
    setSubmitError('');
    reset();
  }, [reset]);

  const isProcessing = !!job && job.state !== 'completed' && job.state !== 'failed';

  // Determine which pipeline step is active based on progress label
  function getActiveStep(): number {
    if (!job) return -1;
    const label = (job.label || '').toLowerCase();
    if (label.includes('done') || label.includes('finaliz')) return 5;
    if (label.includes('render') || label.includes('mux')) return 4;
    if (label.includes('transcrib') || label.includes('subtitle') || label.includes('lyric'))
      return 3;
    if (
      label.includes('separat') ||
      label.includes('vocal') ||
      label.includes('demucs')
    )
      return 2;
    if (label.includes('extract')) return 1;
    if (label.includes('download') || label.includes('fetch') || label.includes('source'))
      return 0;
    if (label.includes('starting') || label.includes('ai')) return 1;
    // Fallback based on progress percentage
    if (job.progress >= 85) return 4;
    if (job.progress >= 55) return 3;
    if (job.progress >= 15) return 2;
    if (job.progress >= 10) return 1;
    if (job.progress > 0) return 0;
    return -1;
  }

  const activeStep = getActiveStep();

  return (
    <main className="min-h-screen">
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-20">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium mb-4">
            <Music className="w-4 h-4" />
            AI Karaoke Maker
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Turn any video into{' '}
            <span className="gradient-text">karaoke</span>
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Paste a music video URL — we&apos;ll separate vocals from instrumental,
            transcribe lyrics with word-level timing, and render a karaoke video
            with synced highlighting.
          </p>
        </div>

        {/* URL Input */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-2 flex gap-2 mb-6">
          <div className="flex-1 flex items-center gap-3 px-4">
            <LinkIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isProcessing}
              placeholder="Paste a YouTube, Vimeo, or TikTok URL..."
              className="flex-1 bg-transparent outline-none placeholder-gray-500 disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || isProcessing || !url.trim()}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 font-medium disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Starting...
              </>
            ) : (
              <>
                <Music className="w-4 h-4" /> Make Karaoke
              </>
            )}
          </button>
        </form>

        {submitError && (
          <p className="text-red-400 text-sm mb-4 text-center">{submitError}</p>
        )}

        {/* Pipeline Steps */}
        {job && (
          <div className="glass rounded-2xl p-6 mb-6">
            <p className="text-sm font-medium text-gray-300 mb-4">Pipeline progress</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {STEPS.map((step, i) => {
                const done = activeStep > i || job.state === 'completed';
                const current =
                  activeStep === i && job.state !== 'completed' && job.state !== 'failed';
                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-300 ${
                      done
                        ? 'bg-green-500/10 border border-green-500/20'
                        : current
                          ? 'bg-purple-500/10 border border-purple-500/30 scale-[1.02]'
                          : 'bg-white/5 border border-white/5'
                    }`}
                  >
                    <div className={`relative ${current ? 'animate-pulse' : ''}`}>
                      <step.icon
                        className={`w-6 h-6 ${
                          done
                            ? 'text-green-400'
                            : current
                              ? 'text-purple-400'
                              : 'text-gray-600'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-xs text-center font-medium ${
                        done
                          ? 'text-green-400'
                          : current
                            ? 'text-purple-300'
                            : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Job Progress — only show while processing or on error */}
        {job && job.state !== 'completed' && (
          <JobProgress
            job={job}
            error={pollError}
            onReset={handleReset}
          />
        )}

        {/* Poll error without active job */}
        {!job && pollError && (
          <div className="glass rounded-2xl p-6">
            <p className="text-sm text-red-400">{pollError}</p>
            <button
              onClick={handleReset}
              className="mt-3 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium transition"
            >
              Start over
            </button>
          </div>
        )}

        {/* Karaoke Preview — full player when completed */}
        {job?.state === 'completed' && (
          <div className="space-y-4">
            <KaraokePreview job={job} />
            <div className="flex justify-center">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium transition"
              >
                <RotateCcw className="w-4 h-4" />
                Create another karaoke
              </button>
            </div>
          </div>
        )}

        {/* How it works */}
        {!job && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-center mb-6">How it works</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {STEPS.map((step, i) => (
                <div key={i} className="glass rounded-xl p-5 text-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-3">
                    <step.icon className="w-5 h-5 text-pink-400" />
                  </div>
                  <p className="text-sm font-medium mb-1">Step {i + 1}</p>
                  <p className="text-xs text-gray-400">{step.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 glass rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-3">What you get</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>
                    <strong className="text-gray-300">Instrumental track</strong> — vocals
                    removed, music preserved
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>
                    <strong className="text-gray-300">Synced lyrics</strong> — words
                    highlighted exactly on beat
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>
                    <strong className="text-gray-300">Ready-to-play MP4</strong> — video
                    with burnt-in karaoke subtitles
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
