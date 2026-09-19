import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { videoQueue } from '../jobs/queue';

const r = Router();

r.get('/:id', async (req, res) => {
  const job: any = await videoQueue.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const state = await job.getState();

  // BullMQ stores progress as object via updateProgress({percent,label}); in-memory uses scalar
  let progress = 0;
  let label: string = job.progressLabel || '';
  if (typeof job.progress === 'number') {
    progress = job.progress;
  } else if (job.progress && typeof job.progress === 'object') {
    progress = job.progress.percent ?? 0;
    label = job.progress.label ?? label;
  }

  res.json({
    id: job.id,
    name: job.name,
    state,
    progress,
    label,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  });
});

/**
 * Stream the rendered output file to the client.
 * Only completed jobs that produced a `file` field can be downloaded.
 */
r.get('/:id/file', async (req, res) => {
  const job: any = await videoQueue.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const state = await job.getState();
  if (state !== 'completed') return res.status(409).json({ error: 'Job not completed', state });

  const file = job.returnvalue?.file;
  if (!file || !fs.existsSync(file)) {
    return res.status(404).json({ error: 'Output file not found', file });
  }

  const filename = path.basename(file);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'video/mp4');
  fs.createReadStream(file).pipe(res);
});

/**
 * Stream the output file inline for browser preview (video/audio player).
 * Supports HTTP Range requests for seeking within the media.
 */
r.get('/:id/stream', async (req, res) => {
  const job: any = await videoQueue.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const state = await job.getState();
  if (state !== 'completed') return res.status(409).json({ error: 'Job not completed', state });

  const file = job.returnvalue?.file;
  if (!file || !fs.existsSync(file)) {
    return res.status(404).json({ error: 'Output file not found', file });
  }

  const stat = fs.statSync(file);
  const fileSize = stat.size;
  const ext = path.extname(file).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
  };
  const contentType = mimeMap[ext] || 'application/octet-stream';

  // Handle Range requests for seeking
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${path.basename(file)}"`,
      'Cache-Control': 'public, max-age=3600',
    });
    fs.createReadStream(file).pipe(res);
  }
});

export default r;
