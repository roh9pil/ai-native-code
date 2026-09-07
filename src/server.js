import express from 'express';
import { mockAuth } from './middleware/auth.js';
import { postsRouter } from './routes/posts.js';

export const app = express();

// Parse JSON request bodies
app.use(express.json());

// Handle malformed JSON body errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON in request body',
        details: [{ message: err.message }],
      },
    });
  }
  next(err);
});

// Enforce Mock JWT authentication on all API routes
app.use('/api', mockAuth);

// Mount routes
app.use('/api/posts', postsRouter);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
      details: [],
    },
  });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  console.error('Unhandled Server Error:', err);

  res.status(status).json({
    error: {
      code,
      message: err.message || 'An unexpected error occurred',
      details: err.details || [],
    },
  });
});

const PORT = process.env.PORT || 3000;

// Start server if run directly (and not in test mode)
if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`AI-Native Blog API server listening on port ${PORT}`);
  });
}
