import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import routes
import promptRoutes from './routes/prompts';
import authRoutes from './routes/auth';
import folderRoutes from './routes/folders';
import versionRoutes from './routes/versions';
import workflowRoutes from './routes/workflows';
import triggerRoutes from './routes/triggers';

// Load environment variables
dotenv.config();

// Initialize Prisma Client
export const prisma = new PrismaClient();

// Create Express app
export const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());

// Production-ready CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, origin?: boolean | string | RegExp | (boolean | string | RegExp)[]) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174', 
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL,
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    // Check exact match against allowed origins first
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    
    // In development, allow specific localhost patterns only
    if (process.env.NODE_ENV === 'development') {
      const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
      if (localhostPattern.test(origin)) {
        callback(null, true);
        return;
      }
    }
    
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.get('Origin') || 'none'}`);
  next();
});

// Migration endpoint (development only) - must be before protected routes
app.post('/api/migrate-versions', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: { message: 'Migration only available in development' } });
  }
  
  try {
    const { VersionService } = await import('./services/versionService');
    const { promptId } = req.body;
    
    await VersionService.migrateExistingVersions(promptId);
    
    res.json({ 
      message: 'Version migration completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ 
      error: { message: 'Migration failed' },
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api', versionRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/workflows', triggerRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({
    message: 'CORS is working!',
    origin: req.get('Origin'),
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: Error & { status?: number }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Route not found' } });
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await prisma.$connect();
    console.log('✅ Connected to database');

    // Initialize trigger service
    try {
      const { triggerService } = await import('./services/triggerService');
      await triggerService.initializeScheduledTriggers();
      console.log('✅ Trigger service initialized');
    } catch (error) {
      console.warn('⚠️  Warning: Failed to initialize trigger service:', error);
    }

    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  
  // Stop all scheduled triggers
  try {
    const { triggerService } = await import('./services/triggerService');
    await triggerService.stopAllScheduledTriggers();
    console.log('✅ Trigger service stopped');
  } catch (error) {
    console.warn('⚠️  Warning: Failed to stop trigger service:', error);
  }
  
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  
  // Stop all scheduled triggers
  try {
    const { triggerService } = await import('./services/triggerService');
    await triggerService.stopAllScheduledTriggers();
    console.log('✅ Trigger service stopped');
  } catch (error) {
    console.warn('⚠️  Warning: Failed to stop trigger service:', error);
  }
  
  await prisma.$disconnect();
  process.exit(0);
});

startServer();