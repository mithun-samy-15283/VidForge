import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import fs from 'fs';
import { logger } from '../utils/logger';
import { processDownload, processKaraoke, processSubtitles, ProgressFn } from './processors';

const STORAGE = process.env.STORAGE_DIR || './storage';
fs.mkdirSync(STORAGE, { recursive: true });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * In-memory fallback when Redis is unavailable.
 * Lets the API run end-to-end for local dev without docker/redis.
 * NOT for production — jobs are lost on restart and not concurrent-safe.
 */
class InMemoryQueue {
  private jobs = new Map<string, any>();
  private counter = 0;

  async add(name: string, data: any) {
    const id = String(++this.counter);
    const job: any = {
      id,
      name,
      data,
      state: 'active',
      progress: 0,
      progressLabel: '',
      returnvalue: null,
      failedReason: null,
      timestamp: Date.now(),
    };
    this.jobs.set(id, job);
    setImmediate(() => this.process(job));
    return job;
  }

  private async process(job: any) {
    const progress: ProgressFn = async (p: number, label?: string) => {
      job.progress = p;
      if (label) job.progressLabel = label;
    };
    try {
      let result: any;
      switch (job.name) {
        case 'download':  result = await processDownload(job.id, job.data, progress); break;
        case 'karaoke':   result = await processKaraoke(job.id, job.data, progress); break;
        case 'subtitles': result = await processSubtitles(job.id, job.data, progress); break;
        default: throw new Error(`Unknown job: ${job.name}`);
      }
      job.returnvalue = result;
      job.state = 'completed';
      logger.info({ jobId: job.id, name: job.name }, 'completed (in-memory)');
    } catch (e: any) {
      job.state = 'failed';
      job.failedReason = e.message;
      logger.error({ jobId: job.id, err: e.message }, 'failed (in-memory)');
    }
  }

  async getJob(id: string) {
    const job = this.jobs.get(id);
    if (!job) return null;
    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      progressLabel: job.progressLabel,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      getState: async () => job.state,
    };
  }
}

let _queue: Queue | InMemoryQueue;
let _redisAvailable = false;

async function probeRedis(): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    probe.connect()
      .then(() => { probe.disconnect(); resolve(true); })
      .catch(() => { probe.disconnect(); resolve(false); });
  });
}

(async () => {
  _redisAvailable = await probeRedis();

  if (_redisAvailable) {
    const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    const q = new Queue('video', { connection });

    new Worker('video', async (job: Job) => {
      const progress: ProgressFn = async (p: number, label?: string) => {
        await job.updateProgress({ percent: p, label: label || '' });
      };
      switch (job.name) {
        case 'download':  return processDownload(job.id!, job.data, progress);
        case 'karaoke':   return processKaraoke(job.id!, job.data, progress);
        case 'subtitles': return processSubtitles(job.id!, job.data, progress);
        default: throw new Error(`Unknown job: ${job.name}`);
      }
    }, { connection, concurrency: 2 });

    const events = new QueueEvents('video', { connection });
    events.on('progress', ({ jobId, data }) => logger.debug({ jobId, data }, 'progress'));
    events.on('completed', ({ jobId }) => logger.info({ jobId }, 'completed'));
    events.on('failed', ({ jobId, failedReason }) => logger.error({ jobId, failedReason }, 'failed'));

    _queue = q;
    logger.info('✅ Redis connected — using BullMQ queue');
  } else {
    _queue = new InMemoryQueue();
    logger.warn('⚠️  Redis unavailable — using IN-MEMORY queue (dev only). Start Redis for production.');
  }
})();

export const videoQueue = {
  add: async (name: string, data: any) => {
    while (!_queue) await new Promise(r => setTimeout(r, 50));
    return _queue.add(name, data);
  },
  getJob: async (id: string) => {
    while (!_queue) await new Promise(r => setTimeout(r, 50));
    return _queue.getJob(id);
  },
};
