import dotenv from 'dotenv';
import { resolve } from 'node:path';
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

dotenv.config({ path: resolve(process.cwd(), '.env'), override: true });
dotenv.config({ path: resolve(process.cwd(), '../../.env'), override: true });

const app = express();
const PORT = parseInt(process.env.API_PORT || '4000', 10);

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.WEB_URL || '*', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(rateLimiter);

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/video', videoRouter);
app.use('/api/jobs', jobRouter);

app.use(errorHandler);

const httpServer = createServer(app);
export const io = new SocketIO(httpServer, {
  cors: { origin: process.env.WEB_URL || '*' }
});

io.on('connection', (socket) => {
  logger.info({ id: socket.id }, 'socket connected');
  socket.on('subscribe:job', (jobId: string) => socket.join(`job:${jobId}`));
});

httpServer.listen(PORT, () => {
  logger.info(`🚀 API listening on http://localhost:${PORT}`);
});
