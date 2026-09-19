/**
 * Job processors — single source of truth for what each job *does*.
 * Both BullMQ workers and the in-memory queue delegate here.
 */
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { downloadVideo, getVideoInfo } from '../services/ytdlp';
import { logger } from '../utils/logger';

const STORAGE = path.resolve(process.env.STORAGE_DIR || './storage');
const AI_URL = process.env.AI_ENGINE_URL || 'http://localhost:5000';
const AI_POLL_INTERVAL_MS = 2000;
const AI_MAX_WAIT_MS = 30 * 60 * 1000; // 30 min hard cap

// Ensure storage dir exists
fs.mkdirSync(STORAGE, { recursive: true });

export interface ProgressFn {
  (percent: number, label?: string): Promise<void> | void;
}

/* -------------------------------------------------------------------------- */
/* download                                                                    */
/* -------------------------------------------------------------------------- */
export async function processDownload(
  jobId: string,
  data: { url: string; formatId?: string },
  progress: ProgressFn,
) {
  await progress(5, 'Starting download');
  const outTemplate = path.join(STORAGE, `${jobId}.%(ext)s`);
  const finalFile = await downloadVideo(data.url, data.formatId, outTemplate);
  await progress(100, 'Done');
  return { file: finalFile };
}

/* -------------------------------------------------------------------------- */
/* karaoke — full pipeline: download → AI service → return final mp4          */
/* -------------------------------------------------------------------------- */
export async function processKaraoke(
  jobId: string,
  data: { url: string; formatId?: string },
  progress: ProgressFn,
) {
  // Stage 1: download source video (0–25%)
  await progress(2, 'Downloading source video');
  const outTemplate = path.join(STORAGE, `${jobId}-src.%(ext)s`);

  let sourceFile: string;
  try {
    sourceFile = await downloadVideo(
      data.url,
      data.formatId || 'best[height<=720]',
      outTemplate,
    );
  } catch (err: any) {
    throw new Error(`Failed to download video: ${err.message}`);
  }

  const absSource = path.resolve(sourceFile);
  if (!fs.existsSync(absSource)) {
    throw new Error(`Downloaded file not found at ${absSource}`);
  }
  logger.info({ jobId, file: absSource, size: fs.statSync(absSource).size }, 'Source video ready');
  await progress(25, 'Source video downloaded');

  // Stage 2: kick off AI service job
  await progress(28, 'Starting AI pipeline');
  let aiJob;
  try {
    const resp = await axios.post(
      `${AI_URL}/karaoke`,
      {
        video_path: absSource,
        output_filename: `${jobId}-karaoke.mp4`,
      },
      { timeout: 15_000 },
    );
    aiJob = resp.data;
  } catch (err: any) {
    const detail = err.response?.data?.detail || err.message;
    throw new Error(`AI service unreachable at ${AI_URL}: ${detail}`);
  }

  logger.info({ jobId, aiJobId: aiJob.id }, 'AI karaoke job started');

  // Stage 3: poll AI service progress (28–98%)
  const startedAt = Date.now();
  let lastReported = 28;
  let consecutiveErrors = 0;

  while (true) {
    if (Date.now() - startedAt > AI_MAX_WAIT_MS) {
      throw new Error('AI job timed out after 30 minutes');
    }

    await sleep(AI_POLL_INTERVAL_MS);

    let status;
    try {
      const r = await axios.get(`${AI_URL}/jobs/${aiJob.id}`, { timeout: 10_000 });
      status = r.data;
      consecutiveErrors = 0;
    } catch (err: any) {
      consecutiveErrors++;
      logger.warn({ jobId, err: err.message, attempt: consecutiveErrors }, 'AI poll failed');
      if (consecutiveErrors > 10) {
        throw new Error(`Lost connection to AI service after ${consecutiveErrors} retries`);
      }
      continue;
    }

    // Map AI 0-100 into our 28-98 band
    const mapped = 28 + Math.floor(status.progress * 0.70);
    if (mapped > lastReported) {
      lastReported = mapped;
      await progress(mapped, status.label || 'Processing');
    }

    if (status.state === 'completed') {
      await progress(99, 'Finalizing');

      // Cleanup source file
      try {
        fs.unlinkSync(sourceFile);
      } catch {
        /* ignore */
      }

      await progress(100, 'Done');
      return {
        file: status.output,
        mock: status.mock,
        aiJobId: aiJob.id,
        separationMethod: status.separation_method,
        transcriptionMethod: status.transcription_method,
      };
    }

    if (status.state === 'failed') {
      throw new Error(`AI pipeline failed: ${status.error || 'unknown error'}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* subtitles — placeholder until /subtitles endpoint added on AI side          */
/* -------------------------------------------------------------------------- */
export async function processSubtitles(
  jobId: string,
  data: { url: string },
  progress: ProgressFn,
) {
  await progress(50, 'Subtitles pipeline not yet implemented');
  return { status: 'subtitles pipeline placeholder' };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
