# Development Roadmap

## ✅ Phase 0 — Scaffolding (DONE)
- [x] Monorepo structure
- [x] Frontend skeleton (Next.js + Tailwind)
- [x] Backend skeleton (Express + BullMQ)
- [x] AI service skeleton (FastAPI)
- [x] Docker compose for Postgres/Redis

## 🚧 Phase 1 — MVP Downloader (Week 1)
- [ ] `npm install` and verify build
- [ ] Implement `/api/video/info` end-to-end
- [ ] Implement `/api/video/download` with progress
- [ ] WebSocket progress events
- [ ] Download history (Postgres + Prisma)

## Phase 2 — Karaoke Maker (Week 2-3)
- [ ] Connect API → AI service via HTTP
- [ ] Test Demucs with real songs
- [ ] Whisper word-level timestamps
- [ ] ASS karaoke effect generator (with \k tags)
- [ ] Preview UI with synced lyrics

## Phase 3 — Auth & Storage (Week 4)
- [ ] User registration/login (JWT)
- [ ] S3/R2 integration for output files
- [ ] Auto-cleanup cron job
- [ ] Free tier rate limits

## Phase 4 — Enhancement Tools (Week 5-6)
- [ ] Auto subtitles (already in AI service)
- [ ] Trim/cut UI
- [ ] Format conversion
- [ ] GIF maker
- [ ] Background remover (RVM/MediaPipe)

## Phase 5 — Monetization (Week 7)
- [ ] Stripe subscriptions
- [ ] Pro tier gating
- [ ] Usage analytics

## Phase 6 — Launch
- [ ] SEO optimization
- [ ] Landing page polish
- [ ] Beta testing
- [ ] Public launch + marketing
