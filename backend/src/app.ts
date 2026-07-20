import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AppError, sendError } from './utils/errors';
import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import productRoutes from './routes/products';
import challanRoutes from './routes/challans';
import dashboardRoutes from './routes/dashboard';

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) || true,
    credentials: true,
  })
);
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Mini ERP + CRM API',
    health: '/health',
    apiBase: '/api',
    endpoints: [
      'POST /api/auth/login',
      'GET /api/auth/me',
      'GET /api/customers',
      'GET /api/products',
      'GET /api/challans',
      'GET /api/dashboard',
    ],
  });
});

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Mini ERP + CRM API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((_req, _res, next) => {
  next(new AppError(404, 'Route not found'));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  sendError(res, err);
});

export default app;
