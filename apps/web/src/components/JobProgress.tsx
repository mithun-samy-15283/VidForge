'use client';
import { CheckCircle2, XCircle, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { JobState } from '@/hooks/useJobPoller';

interface JobProgressProps {
  job: JobState | null;
  error?: string | null;
  onDownload?: () => void;
  onReset?: () => void;
  className?: string;
}

export function JobProgress({ job, error, onDownload, onReset, className }: JobProgressProps) {
  if (!job && !error) return null;

  const isCompleted = job?.state === 'completed';
  const isFailed = job?.state === 'failed';
  const isActive = job?.state === 'active' || job?.state === 'waiting' || job?.state === 'delayed';
  const progress = job?.progress ?? 0;
  const label = job?.label || (isActive ? 'Processing...' : '');

  return (
    <div className={cn('glass rounded-2xl p-6 space-y-4', className)}>
      {/* Status header */}
      <div className="flex items-center gap-3">
        {isActive && <Loader2 className="w-5 h-5 text-purple-400 animate-spin flex-shrink-0" />}
        {isCompleted && <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />}
        {(isFailed || error) && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            {isCompleted ? 'Complete!' : isFailed ? 'Failed' : error ? 'Error' : label}
          </p>
          {job?.id && (
            <p className="text-xs text-gray-500 mt-0.5">Job ID: {job.id}</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(isActive || isCompleted) && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{label}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 ease-out',
                isCompleted
                  ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                  : 'bg-gradient-to-r from-pink-500 to-purple-600'
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {(isFailed || error) && (
        <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          {job?.failedReason || error || 'An unknown error occurred'}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        {isCompleted && onDownload && (
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 font-medium text-sm hover:opacity-90 transition"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        )}
        {(isCompleted || isFailed || error) && onReset && (
          <button
            onClick={onReset}
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium transition"
          >
            Start over
          </button>
        )}
      </div>
    </div>
  );
}
