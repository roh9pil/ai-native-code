/**
 * Mock JWT Authentication Middleware
 * Enforces valid Bearer token on every request.
 */
export function mockAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization token',
      },
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization token',
      },
    });
  }

  // Support Mock JWT (either base64 JSON payload or direct identifier string)
  let userId = 'developer-1';

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      userId = payload.sub || payload.username || payload.id || userId;
    } else if (token !== 'test-token' && token !== 'valid-token') {
      // Use token as username directly if it's not a generic test keyword
      userId = token;
    }
  } catch {
    // If JWT decoding fails, fallback to using raw token or default
    userId = token || 'developer-1';
  }

  req.user = { id: userId, username: userId };
  next();
}
