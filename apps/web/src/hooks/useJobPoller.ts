'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

export interface JobState {
  id: string;
  name: string;
  state: 'active' | 'completed' | 'failed' | 'waiting' | 'delayed';
  progress: number;
  label: string;
  data: any;
  returnvalue: any;
  failedReason: string | null;
}

interface UseJobPollerOptions {
  /** Polling interval in ms (default 1500) */
  interval?: number;
  /** Automatically start polling when jobId changes (default true) */
  autoStart?: boolean;
}

export function useJobPoller(opts: UseJobPollerOptions = {}) {
  const { interval = 1500, autoStart = true } = opts;
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const poll = useCallback(async (id: string) => {
    try {
      const { data } = await api.get(`/api/jobs/${id}`);
      setJob(data);
      setError(null);
      if (data.state === 'completed' || data.state === 'failed') {
        stop();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to poll job';
      setError(msg);
    }
  }, [stop]);

  const start = useCallback((id: string) => {
    stop();
    setJobId(id);
    setJob(null);
    setError(null);
    setIsPolling(true);
    // Immediate first poll
    poll(id);
    timerRef.current = setInterval(() => poll(id), interval);
  }, [stop, poll, interval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  const reset = useCallback(() => {
    stop();
    setJobId(null);
    setJob(null);
    setError(null);
  }, [stop]);

  return {
    jobId,
    job,
    error,
    isPolling,
    start,
    stop,
    reset,
  };
}
