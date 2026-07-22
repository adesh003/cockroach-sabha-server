import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './config/db.js';
import apiRoutes from './routes/apiRoutes.js';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Express Server running on port ${PORT}`);
});
