import { Router } from 'express';
import { postRepository } from '../models/post.js';
import { auditLogger } from '../middleware/audit.js';
import {
  validateCreatePost,
  validateUpdatePost,
  validatePostIdParam,
} from '../middleware/validate.js';

export const postsRouter = Router();

/**
 * POST /api/posts
 * Create a new post
 */
postsRouter.post('/', validateCreatePost, (req, res) => {
  const { title, body, tags } = req.body;
  const author = req.user.id;

  const post = postRepository.create({ title, body, tags, author });
  auditLogger.log('CREATE_POST', post.id, author, { title: post.title });

  res.setHeader('Location', `/api/posts/${post.id}`);
  return res.status(201).json(post);
});

/**
 * GET /api/posts
 * List posts with pagination and filtering
 */
postsRouter.get('/', (req, res) => {
  let page = 1;
  let limit = 10;

  if (req.query.page !== undefined) {
    page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'page parameter must be an integer greater than or equal to 1',
          details: [{ field: 'page', message: 'Must be >= 1' }],
        },
      });
    }
  }

  if (req.query.limit !== undefined) {
    limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 50) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'limit parameter must be an integer between 1 and 50',
          details: [{ field: 'limit', message: 'Must be between 1 and 50' }],
        },
      });
    }
  }

  const { tag, author } = req.query;
  const result = postRepository.findAll({ page, limit, tag, author });

  return res.status(200).json(result);
});

/**
 * GET /api/posts/:id
 * Retrieve a specific post
 */
postsRouter.get('/:id', validatePostIdParam, (req, res) => {
  const post = postRepository.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Post with ID '${req.params.id}' not found`,
        details: [],
      },
    });
  }

  return res.status(200).json(post);
});

/**
 * PUT /api/posts/:id
 * Update a specific post (owner only)
 */
postsRouter.put('/:id', validatePostIdParam, validateUpdatePost, (req, res) => {
  const post = postRepository.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Post with ID '${req.params.id}' not found`,
        details: [],
      },
    });
  }

  // Ownership check
  if (post.author !== req.user.id) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to modify this post',
        details: [],
      },
    });
  }

  const updated = postRepository.update(req.params.id, req.body);
  auditLogger.log('UPDATE_POST', updated.id, req.user.id, {
    modifiedFields: Object.keys(req.body),
  });

  return res.status(200).json(updated);
});

/**
 * DELETE /api/posts/:id
 * Delete a specific post (owner only)
 */
postsRouter.delete('/:id', validatePostIdParam, (req, res) => {
  const post = postRepository.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Post with ID '${req.params.id}' not found`,
        details: [],
      },
    });
  }

  // Ownership check
  if (post.author !== req.user.id) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to delete this post',
        details: [],
      },
    });
  }

  postRepository.delete(req.params.id);
  auditLogger.log('DELETE_POST', req.params.id, req.user.id);

  return res.status(204).send();
});
