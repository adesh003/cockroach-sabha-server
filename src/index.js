import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { logger, prisma, memoryStore, safeDb } from './config/db.js';
import apiRoutes from './routes/apiRoutes.js';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// API logging middleware for request and unique visitor tracking
app.use((req, res, next) => {
  // Only track actual API calls, ignore healthchecks and metrics fetch endpoint
  if (!req.path.startsWith('/api') || req.path === '/api/admin/stats') {
    return next();
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

  res.on('finish', async () => {
    const logData = {
      method: req.method,
      path: req.path,
      ipHash,
      status: res.statusCode,
    };

    try {
      await safeDb(
        () => prisma.apiLog.create({ data: logData }),
        () => {
          memoryStore.apiLogs.push({
            id: 'log-' + Date.now() + '-' + Math.random(),
            ...logData,
            timestamp: new Date(),
          });
        }
      );
    } catch (err) {
      // Avoid breaking requests on logger failures
    }
  });

  next();
});

// Root Health Check Route for Render / Browsers
app.get('/', (req, res) => {
  res.json({
    status: 'ACTIVE',
    app: 'Cockroach SABHA Server API',
    tagline: 'Survive. Speak. Repeat.',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Express Server running on port ${PORT}`);
});
