# VidForge — Architecture Deep Dive

## High-Level Flow

```
User → Next.js (web) → Express API (api) → BullMQ Queue → Worker
                                                            ├── yt-dlp  (download)
                                                            ├── ffmpeg  (transform)
                                                            ├── built-in mock demo
                                                            └── optional AI Engine (Python FastAPI)
                                                                     ├── Whisper
                                                                     └── Demucs
```

## Karaoke Maker — Step by Step

| # | Step | Tool | Output |
|---|------|------|--------|
| 1 | Download source video | yt-dlp | source.mp4 |
| 2 | Extract audio | ffmpeg | audio.wav |
| 3 | Split vocals/instrumental | Demucs | vocals.wav, no_vocals.wav |
| 4 | Transcribe vocals (word-level) | Whisper | segments.json |
| 5 | Generate karaoke ASS subs | custom | lyrics.ass |
| 6 | Mux: video + instrumental + ASS | ffmpeg | karaoke.mp4 |

## Why these choices?

- **yt-dlp**: most reliable extractor, supports 1000+ sites
- **BullMQ**: production-grade Redis queue, easy progress reporting
- **Demucs**: SOTA stem separation (better than Spleeter on modern music)
- **Whisper**: best-in-class transcription, 90+ languages, free
- **FastAPI**: clean async Python, perfect for ML serving
- **Next.js 14 App Router**: server components, streaming, SEO

The zero-cost public deployment uses Vercel for Next.js and one Render Free API
service with the built-in mock processor. Set `AI_ENGINE_URL` and
`MOCK_AI=false` only when running the Python AI engine separately for local
development or on external compute.

## Scaling notes

- AI Engine should run on GPU (RunPod, Lambda Labs, Modal)
- Use object storage (S3/R2) for outputs in production
- Add CDN for serving downloaded files
- Worker pool: separate fast queue (downloads) from slow queue (AI)
