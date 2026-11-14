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

## Zoho Catalyst Development demo

The recommended lightweight deployment is now:

```
Catalyst Slate (apps/web)
  └── Catalyst Advanced I/O function (functions/vidforge_api)
        ├── Catalyst Data Store users
        └── signed, stateless mock media jobs
```

The deployed Development demo preserves the downloader, karaoke, subtitles,
signup, signin, profile, and settings flows without deploying the Python AI
engine, Redis, Postgres, or AppSail. Mock jobs report progress and return a small
SVG artifact; they do not download media, remove vocals, transcribe speech, or
burn captions.

### Authoritative Development context

| Resource | Value |
|---|---|
| Organization | `Mithun` (`60070227695`, India DC) |
| Project | `Project-Rainfall` (`38904000000012039`) |
| Slate app | `vidforge-web` (`10853000000032001`) |
| AIO function | `vidforge_api` (`38904000000224001`) |
| User table | `VidForgeUsers` (`38904000000222001`) |
| CORS domain | `vidforge-web-uybblyds.onslate.in` (`38904000000214006`) |
| Slate URL | https://vidforge-web-uybblyds.onslate.in |
| Function URL | https://project-rainfall-60070227695.development.catalystserverless.in/server/vidforge_api/ |

### Local Catalyst integration

Install dependencies, then run the complete Catalyst wrapper rather than
`next dev`:

```bash
npm install
VIDFORGE_JWT_SECRET="$(openssl rand -hex 32)" \
NEXT_PUBLIC_FUNCTION_BASE_URL="http://localhost:3000/server/vidforge_api" \
catalyst serve
```

The CLI prints the actual local Slate and function URLs. Authentication depends
on the Catalyst wrapper and the Development Data Store. The function owns all
table access, stores bcrypt hashes, and accepts app sessions through the custom
`X-VidForge-Token` header so Catalyst does not interpret them as platform OAuth
tokens.

### Development deployment

The workspace is linked by CLI-generated `.catalystrc` and `catalyst.json`.
Do not recreate either file manually.

```bash
catalyst deploy --only functions:vidforge_api -ni
catalyst deploy slate vidforge-web -ni
```

Before deploying the function, configure a random `VIDFORGE_JWT_SECRET` of at
least 32 characters in the function's Development environment. Never expose it
through a `NEXT_PUBLIC_*` variable or commit it. The public function origin is
compiled into Slate through `apps/web/.env.production`.

The Slate hostname must also be registered as a Catalyst Development CORS
domain. If the Slate hostname changes, update the CORS resource and
`functions/vidforge_api/index.js`, then redeploy the function.

### Cost and free-tier caveats

This mock architecture is likely to remain within Catalyst's free allowance for
light demo traffic because it uses one small function, one Slate app, and one
two-column Data Store table. Catalyst quotas and pricing can change, and builds,
bandwidth, function invocations, execution time, and Data Store usage all count
independently. The mock artifact is intentionally tiny; real media processing
or storage would require a separate cost and architecture review.

### Production promotion

Production is intentionally not configured or deployed. Promote only after:

1. Recreating or migrating the `VidForgeUsers` schema in Production.
2. Setting a new Production-only `VIDFORGE_JWT_SECRET`; never reuse Development.
3. Deploying the function and verifying health, signup, signin, jobs, and files.
4. Building Slate with the Production function origin.
5. Registering the Production Slate hostname in Production CORS settings.
6. Re-running the complete cross-origin flow before directing users to it.

The legacy Express, Docker, Render, Vercel, Supabase, and Python files remain in
the repository for non-Catalyst or full-processing experiments, but they are not
part of this Catalyst mock deployment.

## 🔐 Auth Endpoints

- `POST /api/auth/signup` → create user and return JWT
- `POST /api/auth/signin` → authenticate and return JWT
- `GET /api/auth/me` → fetch current user (`X-VidForge-Token: <token>`)

## 📁 Project Structure

See `docs/ARCHITECTURE.md` for the full breakdown.

## ⚖️ Legal

This tool is intended for downloading content you own or content licensed for download. Users are responsible for complying with the terms of service of source platforms.
