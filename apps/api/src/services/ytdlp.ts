import { execFile, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * Resolve the yt-dlp binary path.
 * Priority: YT_DLP_PATH env → ~/.local/bin/yt-dlp → system PATH fallback
 */
function getYtDlpPath(): string {
  if (process.env.YT_DLP_PATH) return process.env.YT_DLP_PATH;
  const localBin = path.join(
    process.env.HOME || '/home/workspace',
    '.local',
    'bin',
    'yt-dlp',
  );
  if (fs.existsSync(localBin)) return localBin;
  return 'yt-dlp'; // fallback to PATH
}

const YT_DLP = getYtDlpPath();

/**
 * Helper: run yt-dlp with given args and return stdout.
 * Used for quick metadata commands (not long downloads).
 */
function run(args: string[], timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      YT_DLP,
      args,
      { maxBuffer: 50 * 1024 * 1024, timeout: timeoutMs },
      (err, stdout, stderr) => {
        if (err) {
          const msg = stderr?.trim() || err.message;
          return reject(new Error(`yt-dlp failed: ${msg}`));
        }
        resolve(stdout);
      },
    );
  });
}

/**
 * Helper: run yt-dlp as a spawned process for long-running downloads.
 * No timeout — we rely on the caller's job-level timeout instead.
 */
function runDownload(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        const msg = stderr.trim() || `yt-dlp exited with code ${code}`;
        return reject(new Error(`yt-dlp download failed: ${msg}`));
      }
      resolve(stdout);
    });

    proc.on('error', (err) => {
      reject(new Error(`yt-dlp spawn error: ${err.message}`));
    });
  });
}

export async function getVideoInfo(url: string) {
  const raw = await run(
    [
      '--dump-single-json',
      '--no-warnings',
      '--no-check-certificates',
      '--prefer-free-formats',
      url,
    ],
    120_000, // 2-minute timeout for info extraction
  );

  const info: any = JSON.parse(raw);

  // Filter out storyboard-only entries (both vcodec and acodec are 'none')
  const allFormats = (info.formats || []).filter(
    (f: any) => f.vcodec !== 'none' || f.acodec !== 'none',
  );

  const formats = allFormats.map((f: any) => {
    const hasVideo = f.vcodec && f.vcodec !== 'none';
    const hasAudio = f.acodec && f.acodec !== 'none';
    let label = '';
    if (hasVideo && hasAudio) label = 'video+audio';
    else if (hasVideo) label = 'video only';
    else label = 'audio only';

    return {
      format_id: f.format_id,
      ext: f.ext,
      resolution: f.resolution || (f.height ? `${f.height}p` : 'audio'),
      filesize: f.filesize || f.filesize_approx,
      vcodec: f.vcodec,
      acodec: f.acodec,
      label,
    };
  });

  return {
    title: info.title,
    thumbnail: info.thumbnail,
    duration: info.duration,
    uploader: info.uploader,
    formats,
  };
}

/**
 * Download a video and return the absolute path to the final file.
 *
 * `outputTemplate` may include yt-dlp template placeholders like
 *   /storage/<jobId>.%(ext)s
 *
 * Uses spawn() instead of execFile() so there's no timeout on large downloads.
 */
export async function downloadVideo(
  url: string,
  formatId: string | undefined,
  outputTemplate: string,
): Promise<string> {
  // Build a robust format selector
  let fmt =
    formatId ||
    'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best';

  // Handle the karaoke "best[height<=720]" case with a robust fallback chain
  if (fmt.includes('height<=720')) {
    fmt = [
      'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]',
      'bestvideo[height<=720]+bestaudio',
      'best[height<=720]',
      'bestvideo[ext=mp4]+bestaudio[ext=m4a]',
      'best',
    ].join('/');
  }

  const args = [
    '-f',
    fmt,
    '-o',
    outputTemplate,
    '--no-warnings',
    '--no-check-certificates',
    '--merge-output-format',
    'mp4',
    '--no-playlist',
    '--retries',
    '3',
    '--fragment-retries',
    '3',
    url,
  ];

  logger.info({ binary: YT_DLP, args }, 'Starting yt-dlp download');
  await runDownload(args);

  // Resolve the actual file produced by yt-dlp
  const dir = path.dirname(outputTemplate);
  const baseTemplate = path.basename(outputTemplate); // e.g. "12-src.%(ext)s"
  const prefix = baseTemplate.replace(/\.%\(ext\)s$/, '.');
  const candidates = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && !f.endsWith('.part'))
    .map((f) => path.join(dir, f));

  if (candidates.length === 0) {
    throw new Error(
      `Download finished but no output file found for prefix "${prefix}" in ${dir}`,
    );
  }

  // Prefer .mp4 if multiple files exist
  candidates.sort((a, b) => {
    if (a.endsWith('.mp4') && !b.endsWith('.mp4')) return -1;
    if (b.endsWith('.mp4') && !a.endsWith('.mp4')) return 1;
    return 0;
  });

  const result = path.resolve(candidates[0]);
  const size = fs.statSync(result).size;
  logger.info({ file: result, size }, 'Download complete');

  return result;
}
