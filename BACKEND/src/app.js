import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import chatRoutes from './routes/chatRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';

// Import production services
import rateLimiter from './middleware/rateLimiter.js';
import AnalyticsService from './services/AnalyticsService.js';
import CacheService from './services/CacheService.js';
import selfPingService from './services/SelfPingService.js';

// Initialize Express app
const app = express();

// CORS configuration - Allow multiple origins
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://veterinary-chatbot.vercel.app',
      process.env.FRONTEND_URL
    ];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // For now, allow all origins to avoid CORS issues
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
};

// Middleware - Order matters!

// 1. Apply rate limiting FIRST (before any processing)
app.use(rateLimiter.middleware());

// 2. Track analytics for ALL requests
app.use((req, res, next) => {
  const startTime = Date.now();

  // Track session start
  if (req.body?.sessionId) {
    AnalyticsService.trackSession(req.body.sessionId, 'start');
  }

  // Track response time when request finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    AnalyticsService.trackResponseTime(req.path, duration, {
      method: req.method,
      statusCode: res.statusCode
    });
  });

  next();
});

// 3. CORS configuration
app.use(cors(corsOptions));

// 4. Body parsing
app.use(express.json({ limit: '1mb' })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check endpoint with detailed stats
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    message: 'Veterinary Chatbot API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    analytics: AnalyticsService.getStatistics(),
    cache: CacheService.getStatistics(),
    selfPing: selfPingService.getStatistics()
  };
  res.json(health);
});

// Analytics endpoint for monitoring
app.get('/api/analytics', (req, res) => {
  const report = AnalyticsService.generateReport();
  res.json(report);
});

// Metrics endpoint for Prometheus/Grafana
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(AnalyticsService.exportMetrics('prometheus'));
});

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/appointments', appointmentRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

export default app;