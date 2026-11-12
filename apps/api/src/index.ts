import './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import videoRouter from './routes/video';
import jobRouter from './routes/jobs';
import healthRouter from './routes/health';
import authRouter from './routes/auth';

const app = express();
const PORT = parseInt(process.env.PORT || process.env.API_PORT || '4000', 10);
const allowedOrigins = getAllowedOrigins();
const corsOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => {
  if (!origin || allowedOrigins.some((allowed) => originMatches(origin, allowed))) {
    callback(null, true);
    return;
  }
  callback(new Error(`Origin ${origin} is not allowed by CORS`));
};

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(rateLimiter);

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/video', videoRouter);
app.use('/api/jobs', jobRouter);

app.use(errorHandler);

const httpServer = createServer(app);
export const io = new SocketIO(httpServer, {
  cors: { origin: corsOrigin, credentials: true }
});

io.on('connection', (socket) => {
  logger.info({ id: socket.id }, 'socket connected');
  socket.on('subscribe:job', (jobId: string) => socket.join(`job:${jobId}`));
});

httpServer.listen(PORT, () => {
  logger.info(`🚀 API listening on http://localhost:${PORT}`);
});

function getAllowedOrigins() {
  const configured = process.env.WEB_URL
    ?.split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (configured?.length) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('WEB_URL is required in production');
  }
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

function originMatches(origin: string, allowed: string) {
  if (!allowed.includes('*')) return origin === allowed;
  const pattern = allowed
    .split('*')
    .map(escapeRegExp)
    .join('[^.]+');
  return new RegExp(`^${pattern}$`, 'i').test(origin);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
