# 🎬 VidForge

All-in-one video downloader & AI enhancement platform.
Download videos from any URL, then transform them with karaoke maker, auto subtitles, background removal, upscaling, and more.

## ✨ Features

- 🔽 **Multi-platform downloader** (YouTube, Vimeo, Twitter, TikTok, Instagram)
- 🎤 **Karaoke Maker** — vocal removal + auto-synced lyrics
- 📝 **Auto Subtitles** via Whisper AI
- 🎨 **Background Remover** for videos
- ⬆️ **AI Upscaling** (Real-ESRGAN)
- ✂️ **Trim, Merge, Convert, GIF Maker**
- 🔊 **Audio extraction & noise reduction**
- 🔐 **Email auth** with JWT sign up / sign in

## 🏗️ Architecture

```
apps/
  web/         → Next.js 14 frontend
  api/         → Node.js + Express backend
services/
  ai-engine/   → Python (Whisper, Demucs, Real-ESRGAN)
packages/
  shared/      → Shared TypeScript types
docker/        → Docker configs
```

## 🚀 Quick Start

### 1. Install system deps
```bash
# Ubuntu / WSL
sudo apt update
sudo apt install -y ffmpeg python3-pip
pip3 install yt-dlp
```

### 2. Install project deps
```bash
npm install
cd services/ai-engine && pip install -r requirements.txt
```

### 3. Setup env
```bash
cp .env.example .env
```

### 4. Run with Docker (recommended)
```bash
docker-compose -f docker/docker-compose.yml up -d
npm run dev
```

Open: http://localhost:3000

## Render demo deployment

The repository includes a Render Blueprint at [`render.yaml`](./render.yaml). It creates:

- `vidforge-web`: the public Next.js web service.
- `vidforge-api`: a private Docker service with FFmpeg, yt-dlp support, a generated JWT secret, and a 1 GB persistent disk for users and generated files.
- `vidforge-ai`: a private lightweight Docker service running FastAPI with `MOCK_AI=true`.

The web service proxies `/api/*` over Render's private network. The API uploads source media to the AI service and copies the rendered result back to its persistent disk, so the services do not rely on a shared filesystem.

### One-click Blueprint

1. Push this repository to GitHub.
2. Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/mithun-samy-15283/VidForge).
3. Connect GitHub if Render prompts you, select the repository, and approve the Blueprint.
4. Review the service names and paid resources, then click **Apply**.
5. Wait for all three health checks to pass, then open the `vidforge-web` URL shown by Render.

The Blueprint uses a free web service and two Starter private services; the API disk and private services are paid Render resources. Render generates `JWT_SECRET` automatically. Do not replace it after users have signed in unless you intend to invalidate existing tokens.

### Manual Render setup

Create the services in the same Render region and use these settings:

| Service | Type/runtime | Build or Dockerfile | Start command |
|---|---|---|---|
| `vidforge-web` | Web / Node | `npm ci && npm run build:web` | `npm --workspace apps/web run start -- -p $PORT` |
| `vidforge-api` | Private / Docker | `apps/api/Dockerfile` with repository-root Docker context | Dockerfile `CMD` |
| `vidforge-ai` | Private / Docker | `services/ai-engine/Dockerfile` with repository-root Docker context | Dockerfile `CMD` |

Configure the following environment and storage:

1. On `vidforge-web`, set `API_URL` from `vidforge-api`'s **hostport** service property and set `NODE_ENV=production`.
2. On `vidforge-api`, set `AI_ENGINE_URL` from `vidforge-ai`'s **hostport** service property, generate a secret value for `JWT_SECRET`, set `JWT_EXPIRES_IN=7d`, and set `STORAGE_DIR=/var/data/vidforge`.
3. Attach a 1 GB persistent disk to `vidforge-api` at `/var/data/vidforge`.
4. On `vidforge-ai`, set `MOCK_AI=true` and `AI_OUTPUT_DIR=/tmp/vidforge-ai-output`.
5. Use `/` as the public web service health-check path. Render private services (`pserv`) do not accept `healthCheckPath`; the API and AI services still expose `/api/health` and `/health` for internal diagnostics.

Render injects `PORT`; both backend services bind to it automatically. Values populated from Render's `hostport` property intentionally omit a URL scheme, and VidForge normalizes them to private `http://` service URLs.

### Mock-mode limitations

`MOCK_AI=true` avoids installing Whisper, Demucs, PyTorch, Torchaudio, and AI-side FFmpeg. It returns an unchanged copy of the downloaded source as a fast, playable demo result; it does **not** remove vocals, transcribe lyrics, or burn karaoke subtitles into the video. The AI service stores only temporary processing files and loses them on restart after the API has copied completed output to its disk.

The demo queue is in memory because the Blueprint does not provision Redis. Active jobs and job status are lost if the API restarts or redeploys, although completed files and registered users remain on the API disk. Add Render Key Value/Redis and set `REDIS_URL` for durable queue state before treating this as production.

## 🔐 Auth Endpoints

- `POST /api/auth/signup` → create user and return JWT
- `POST /api/auth/signin` → authenticate and return JWT
- `GET /api/auth/me` → fetch current user (`Authorization: Bearer <token>`)

## 📁 Project Structure

See `docs/ARCHITECTURE.md` for the full breakdown.

## ⚖️ Legal

This tool is intended for downloading content you own or content licensed for download. Users are responsible for complying with the terms of service of source platforms.
