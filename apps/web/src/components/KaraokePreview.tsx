'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  RotateCcw,
  Music,
  Film,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { JobState } from '@/hooks/useJobPoller';

interface KaraokePreviewProps {
  job: JobState;
  className?: string;
}

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function KaraokePreview({ job, className }: KaraokePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const streamUrl = `/api/jobs/${job.id}/stream`;
  const downloadUrl = `/api/jobs/${job.id}/file`;

  // Auto-hide controls after inactivity
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    if (playing) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    scheduleHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [playing, scheduleHide]);

  // Video events
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) {
      setBuffered(v.buffered.end(v.buffered.length - 1));
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setVideoReady(true);
    setVideoError(false);
  }, []);

  const handleError = useCallback(() => {
    setVideoError(true);
    setVideoReady(false);
  }, []);

  const handleEnded = useCallback(() => {
    setPlaying(false);
  }, []);

  // Controls
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    setVolume(val);
    if (val === 0) {
      v.muted = true;
      setMuted(true);
    } else if (v.muted) {
      v.muted = false;
      setMuted(false);
    }
  }, []);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
  }, []);

  const skip = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'ArrowLeft':
          skip(-5);
          break;
        case 'ArrowRight':
          skip(5);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, toggleMute, toggleFullscreen, skip]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const separationMethod = job.returnvalue?.separationMethod;
  const transcriptionMethod = job.returnvalue?.transcriptionMethod;

  return (
    <div className={cn('animate-fadeIn', className)}>
      {/* Preview header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
          <Music className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-lg">Your Karaoke is Ready</h3>
          <p className="text-sm text-gray-400">Preview and download below</p>
        </div>
      </div>

      {/* Video player container */}
      <div
        ref={containerRef}
        className="relative group rounded-2xl overflow-hidden bg-black/80 border border-white/10 shadow-2xl shadow-purple-500/10"
        onMouseMove={scheduleHide}
        onMouseLeave={() => playing && setShowControls(false)}
      >
        {/* Loading skeleton */}
        {!videoReady && !videoError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              <p className="text-sm text-gray-400">Loading preview…</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {videoError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
            <div className="text-center space-y-3 px-6">
              <Film className="w-12 h-12 text-gray-500 mx-auto" />
              <p className="text-gray-300 font-medium">Unable to load preview</p>
              <p className="text-sm text-gray-500">
                The video format may not be supported by your browser.
              </p>
              <a
                href={downloadUrl}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 font-medium text-sm hover:opacity-90 transition"
              >
                <Download className="w-4 h-4" />
                Download instead
              </a>
            </div>
          </div>
        )}

        {/* Video element */}
        <video
          ref={videoRef}
          src={streamUrl}
          preload="metadata"
          className="w-full aspect-video bg-black cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleError}
          onEnded={handleEnded}
          playsInline
        />

        {/* Play overlay (center icon when paused) */}
        {videoReady && !playing && (
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/20"
            onClick={togglePlay}
          >
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center transition-transform hover:scale-110">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </div>
        )}

        {/* Bottom controls overlay */}
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-10 pb-3 px-4 transition-opacity duration-300',
            showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="relative h-1.5 rounded-full bg-white/15 cursor-pointer group/bar mb-3 hover:h-2.5 transition-all"
            onClick={seek}
          >
            {/* Buffered */}
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-white/15"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* Progress */}
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500 transition-[width] duration-150"
              style={{ width: `${progressPct}%` }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity"
              style={{ left: `${progressPct}%` }}
            />
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              title={playing ? 'Pause (k)' : 'Play (k)'}
            >
              {playing ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>

            {/* Skip back/forward */}
            <button
              onClick={() => skip(-5)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              title="Back 5s (←)"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => skip(5)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              title="Forward 5s (→)"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Time */}
            <span className="text-xs text-gray-300 tabular-nums font-mono select-none">
              {formatTime(currentTime)}
              <span className="text-gray-500 mx-1">/</span>
              {formatTime(duration)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
                title={muted ? 'Unmute (m)' : 'Mute (m)'}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-purple-500 cursor-pointer opacity-0 group-hover/vol:opacity-100"
              />
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              title="Fullscreen (f)"
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Below-player info bar */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* Method badges */}
        {separationMethod && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium">
            <Music className="w-3 h-3" />
            Vocal separation: {separationMethod}
          </span>
        )}
        {transcriptionMethod && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium">
            <Film className="w-3 h-3" />
            Lyrics: {transcriptionMethod}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <a
          href={downloadUrl}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 font-medium text-sm hover:opacity-90 transition shadow-lg shadow-green-500/20"
        >
          <Download className="w-4 h-4" />
          Download MP4
        </a>
      </div>

      {/* Info notices */}
      {job.returnvalue?.mock && (
        <div className="mt-4 glass rounded-xl p-4 border border-yellow-500/20 bg-yellow-500/5">
          <p className="text-sm text-yellow-400">
            ⚡ <strong>Demo mode:</strong> Generated with mock AI — lyrics are placeholder
            text and vocals are not actually separated.
          </p>
        </div>
      )}

      {!job.returnvalue?.mock && separationMethod === 'ffmpeg' && (
        <div className="mt-4 glass rounded-xl p-4 border border-blue-500/20 bg-blue-500/5">
          <p className="text-sm text-blue-400">
            🎵 <strong>FFmpeg vocal separation</strong> — center-channel extraction used.
            For studio-quality results, install Demucs (ML-based).
          </p>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <span><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">Space</kbd> Play/Pause</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">→</kbd> Seek ±5s</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">M</kbd> Mute</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">F</kbd> Fullscreen</span>
      </div>
    </div>
  );
}
