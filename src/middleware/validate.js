/**
 * Strict Schema Validation Middleware
 * Rejects unknown fields and validates input types & constraints.
 */

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DISALLOWED_CLIENT_FIELDS = ['id', 'author', 'createdAt', 'updatedAt'];

/**
 * Validate UUID in request params
 */
export function validatePostIdParam(req, res, next) {
  const { id } = req.params;
  if (!id || !UUID_V4_REGEX.test(id)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid post ID format. Must be a valid UUID v4.',
        details: [{ field: 'id', message: 'Must be a valid UUID v4' }],
      },
    });
  }
  next();
}

/**
 * Validate Create Post Request Body
 */
export function validateCreatePost(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request body must be a JSON object',
        details: [],
      },
    });
  }

  const details = [];
  const allowedFields = ['title', 'body', 'tags'];
  const keys = Object.keys(body);

  // Check for disallowed fields or unknown fields
  for (const key of keys) {
    if (DISALLOWED_CLIENT_FIELDS.includes(key)) {
      details.push({
        field: key,
        message: `Field '${key}' is read-only and cannot be set by client`,
      });
    } else if (!allowedFields.includes(key)) {
      details.push({
        field: key,
        message: `Unknown field '${key}' is not allowed`,
      });
    }
  }

  // title validation
  if (body.title === undefined || body.title === null) {
    details.push({ field: 'title', message: 'title is required' });
  } else if (typeof body.title !== 'string') {
    details.push({ field: 'title', message: 'title must be a string' });
  } else {
    const trimmedTitle = body.title.trim();
    if (trimmedTitle.length === 0 || trimmedTitle.length > 120) {
      details.push({
        field: 'title',
        message: 'title must be between 1 and 120 characters',
      });
    }
  }

  // body validation
  if (body.body === undefined || body.body === null) {
    details.push({ field: 'body', message: 'body is required' });
  } else if (typeof body.body !== 'string') {
    details.push({ field: 'body', message: 'body must be a string' });
  } else if (body.body.length === 0 || body.body.length > 50000) {
    details.push({
      field: 'body',
      message: 'body must be between 1 and 50,000 characters',
    });
  }

  // tags validation
  if (body.tags !== undefined && body.tags !== null) {
    if (!Array.isArray(body.tags)) {
      details.push({ field: 'tags', message: 'tags must be an array of strings' });
    } else if (body.tags.length > 10) {
      details.push({ field: 'tags', message: 'tags cannot exceed 10 items' });
    } else {
      for (let i = 0; i < body.tags.length; i++) {
        const tag = body.tags[i];
        if (typeof tag !== 'string' || tag.length === 0 || tag.length > 30) {
          details.push({
            field: `tags[${i}]`,
            message: 'each tag must be a non-empty string of at most 30 characters',
          });
        }
      }
    }
  }

  if (details.length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
      },
    });
  }

  // Normalize defaults
  req.body.title = req.body.title.trim();
  req.body.tags = req.body.tags || [];
  next();
}

/**
 * Validate Update Post Request Body
 */
export function validateUpdatePost(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request body must be a JSON object',
        details: [],
      },
    });
  }

  const details = [];
  const allowedFields = ['title', 'body', 'tags'];
  const keys = Object.keys(body);

  if (keys.length === 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'At least one field (title, body, tags) must be provided for update',
        details: [],
      },
    });
  }

  // Check for disallowed fields or unknown fields
  for (const key of keys) {
    if (DISALLOWED_CLIENT_FIELDS.includes(key)) {
      details.push({
        field: key,
        message: `Field '${key}' is read-only and cannot be updated by client`,
      });
    } else if (!allowedFields.includes(key)) {
      details.push({
        field: key,
        message: `Unknown field '${key}' is not allowed`,
      });
    }
  }

  // title validation (optional for update)
  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      details.push({ field: 'title', message: 'title must be a string' });
    } else {
      const trimmedTitle = body.title.trim();
      if (trimmedTitle.length === 0 || trimmedTitle.length > 120) {
        details.push({
          field: 'title',
          message: 'title must be between 1 and 120 characters',
        });
      }
    }
  }

  // body validation (optional for update)
  if (body.body !== undefined) {
    if (typeof body.body !== 'string') {
      details.push({ field: 'body', message: 'body must be a string' });
    } else if (body.body.length === 0 || body.body.length > 50000) {
      details.push({
        field: 'body',
        message: 'body must be between 1 and 50,000 characters',
      });
    }
  }

  // tags validation (optional for update)
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      details.push({ field: 'tags', message: 'tags must be an array of strings' });
    } else if (body.tags.length > 10) {
      details.push({ field: 'tags', message: 'tags cannot exceed 10 items' });
    } else {
      for (let i = 0; i < body.tags.length; i++) {
        const tag = body.tags[i];
        if (typeof tag !== 'string' || tag.length === 0 || tag.length > 30) {
          details.push({
            field: `tags[${i}]`,
            message: 'each tag must be a non-empty string of at most 30 characters',
          });
        }
      }
    }
  }

  if (details.length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
      },
    });
  }

  if (req.body.title) {
    req.body.title = req.body.title.trim();
  }
  next();
}
