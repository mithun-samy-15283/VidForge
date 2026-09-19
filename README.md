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

## 🔐 Auth Endpoints

- `POST /api/auth/signup` → create user and return JWT
- `POST /api/auth/signin` → authenticate and return JWT
- `GET /api/auth/me` → fetch current user (`Authorization: Bearer <token>`)

## 📁 Project Structure

See `docs/ARCHITECTURE.md` for the full breakdown.

## ⚖️ Legal

This tool is intended for downloading content you own or content licensed for download. Users are responsible for complying with the terms of service of source platforms.
