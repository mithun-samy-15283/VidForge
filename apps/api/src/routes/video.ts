import { Router } from 'express';
import { z } from 'zod';
import { getVideoInfo } from '../services/ytdlp';
import { videoQueue } from '../jobs/queue';

const r = Router();

const urlSchema = z.object({
  url: z.string().url().refine(
    (u) => /(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|twitter\.com|x\.com|instagram\.com|facebook\.com)/i.test(u),
    { message: 'Unsupported platform' }
  )
});

// GET video metadata
r.post('/info', async (req, res, next) => {
  try {
    const { url } = urlSchema.parse(req.body);
    const info = await getVideoInfo(url);
    res.json(info);
  } catch (e) { next(e); }
});

// Queue download job
r.post('/download', async (req, res, next) => {
  try {
    const { url, formatId } = z.object({
      url: z.string().url(),
      formatId: z.string()
    }).parse(req.body);
    const job = await videoQueue.add('download', { url, formatId });
    res.json({ jobId: job.id });
  } catch (e) { next(e); }
});

// Karaoke generation
r.post('/karaoke', async (req, res, next) => {
  try {
    const { url } = z.object({ url: z.string().url() }).parse(req.body);
    const job = await videoQueue.add('karaoke', { url });
    res.json({ jobId: job.id });
  } catch (e) { next(e); }
});

// Subtitle generation
r.post('/subtitles', async (req, res, next) => {
  try {
    const { url, language } = z.object({
      url: z.string().url(),
      language: z.string().optional()
    }).parse(req.body);
    const job = await videoQueue.add('subtitles', { url, language });
    res.json({ jobId: job.id });
  } catch (e) { next(e); }
});

export default r;
