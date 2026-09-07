import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../src/server.js';
import { postRepository } from '../../src/models/post.js';
import { auditLogger } from '../../src/middleware/audit.js';

const AUTH_USER_1 = 'Bearer developer-1';
const AUTH_USER_2 = 'Bearer developer-2';

describe('Developer Blog Post Management API Integration Tests', () => {
  beforeEach(() => {
    postRepository.clear();
    auditLogger.clear();
  });

  describe('1. Authentication Gate', () => {
    test('rejects unauthenticated request to GET /api/posts with 401', async () => {
      const res = await request(app).get('/api/posts');

      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
      assert.match(res.body.error.message, /Missing or invalid authorization token/i);
    });

    test('rejects request with invalid Authorization format with 401', async () => {
      const res = await request(app)
        .get('/api/posts')
        .set('Authorization', 'Basic invalidcredentials');

      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });
  });

  describe('2. Create Post & Strict Schema Governance', () => {
    test('creates a post successfully with 201 and Location header', async () => {
      const payload = {
        title: 'Introduction to AI-Native Architecture',
        body: '# AI-Native\nDeveloping software with AI agents.',
        tags: ['ai', 'architecture', 'nodejs'],
      };

      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', AUTH_USER_1)
        .send(payload);

      assert.equal(res.status, 201);
      assert.ok(res.body.id);
      assert.equal(res.body.title, payload.title);
      assert.equal(res.body.body, payload.body);
      assert.deepEqual(res.body.tags, payload.tags);
      assert.equal(res.body.author, 'developer-1');
      assert.ok(res.body.createdAt);
      assert.ok(res.body.updatedAt);
      assert.equal(res.headers.location, `/api/posts/${res.body.id}`);
    });

    test('rejects unknown fields with 400 VALIDATION_ERROR', async () => {
      const payload = {
        title: 'Valid Title',
        body: 'Valid Markdown body content',
        extraField: 'hacker_data',
      };

      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', AUTH_USER_1)
        .send(payload);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      const hasUnknownFieldError = res.body.error.details.some((d) =>
        d.message.includes('extraField')
      );
      assert.ok(hasUnknownFieldError);
    });

    test('rejects client injection of read-only fields (id, author) with 400', async () => {
      const payload = {
        id: '11111111-1111-1111-1111-111111111111',
        author: 'admin',
        title: 'Injected Post',
        body: 'Testing client injection',
      };

      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', AUTH_USER_1)
        .send(payload);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    test('rejects invalid title and body constraints with 400', async () => {
      const resEmpty = await request(app)
        .post('/api/posts')
        .set('Authorization', AUTH_USER_1)
        .send({ title: '   ', body: '' });

      assert.equal(resEmpty.status, 400);
      assert.equal(resEmpty.body.error.code, 'VALIDATION_ERROR');
    });
  });

  describe('3. List Posts & Pagination & Filtering', () => {
    test('returns paginated list with correct metadata', async () => {
      // Seed 3 posts
      postRepository.create({
        title: 'Post 1',
        body: 'Body 1',
        tags: ['js'],
        author: 'developer-1',
      });
      postRepository.create({
        title: 'Post 2',
        body: 'Body 2',
        tags: ['ai'],
        author: 'developer-1',
      });
      postRepository.create({
        title: 'Post 3',
        body: 'Body 3',
        tags: ['ai', 'js'],
        author: 'developer-1',
      });

      const res = await request(app)
        .get('/api/posts?page=1&limit=2')
        .set('Authorization', AUTH_USER_1);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 2);
      assert.equal(res.body.pagination.total, 3);
      assert.equal(res.body.pagination.page, 1);
      assert.equal(res.body.pagination.limit, 2);
      assert.equal(res.body.pagination.totalPages, 2);
    });

    test('filters posts by tag correctly', async () => {
      postRepository.create({
        title: 'AI Guide',
        body: 'Content',
        tags: ['ai'],
        author: 'developer-1',
      });
      postRepository.create({
        title: 'CSS Guide',
        body: 'Content',
        tags: ['css'],
        author: 'developer-1',
      });

      const res = await request(app)
        .get('/api/posts?tag=ai')
        .set('Authorization', AUTH_USER_1);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].title, 'AI Guide');
    });
  });

  describe('4. Retrieve Post by ID', () => {
    test('retrieves an existing post by valid UUID', async () => {
      const created = postRepository.create({
        title: 'Target Post',
        body: 'Content here',
        tags: ['test'],
        author: 'developer-1',
      });

      const res = await request(app)
        .get(`/api/posts/${created.id}`)
        .set('Authorization', AUTH_USER_1);

      assert.equal(res.status, 200);
      assert.equal(res.body.id, created.id);
      assert.equal(res.body.title, 'Target Post');
    });

    test('returns 404 for non-existent UUID', async () => {
      const nonExistentUuid = '00000000-0000-4000-8000-000000000000';
      const res = await request(app)
        .get(`/api/posts/${nonExistentUuid}`)
        .set('Authorization', AUTH_USER_1);

      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    test('returns 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/posts/not-a-valid-uuid')
        .set('Authorization', AUTH_USER_1);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });
  });

  describe('5. Ownership Authorization, Update & Deletion', () => {
    test('forbids modifying another users post with 403 FORBIDDEN', async () => {
      const post = postRepository.create({
        title: 'User 1 Post',
        body: 'Initial content',
        tags: ['v1'],
        author: 'developer-1',
      });

      // Developer 2 tries to update Developer 1's post
      const res = await request(app)
        .put(`/api/posts/${post.id}`)
        .set('Authorization', AUTH_USER_2)
        .send({ title: 'Hacked Title' });

      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    test('allows author to update post with 200 and refreshes updatedAt', async () => {
      const post = postRepository.create({
        title: 'Author Post',
        body: 'Initial content',
        tags: ['v1'],
        author: 'developer-1',
      });

      const res = await request(app)
        .put(`/api/posts/${post.id}`)
        .set('Authorization', AUTH_USER_1)
        .send({ title: 'Updated Title' });

      assert.equal(res.status, 200);
      assert.equal(res.body.title, 'Updated Title');
      assert.ok(new Date(res.body.updatedAt).getTime() >= new Date(post.createdAt).getTime());
    });

    test('forbids deleting another users post with 403 FORBIDDEN', async () => {
      const post = postRepository.create({
        title: 'User 1 Post',
        body: 'Initial content',
        tags: ['v1'],
        author: 'developer-1',
      });

      // Developer 2 tries to delete Developer 1's post
      const res = await request(app)
        .delete(`/api/posts/${post.id}`)
        .set('Authorization', AUTH_USER_2);

      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    test('allows author to delete post with 204 and post is no longer found', async () => {
      const post = postRepository.create({
        title: 'Post to be deleted',
        body: 'Temporary content',
        tags: ['temp'],
        author: 'developer-1',
      });

      const delRes = await request(app)
        .delete(`/api/posts/${post.id}`)
        .set('Authorization', AUTH_USER_1);

      assert.equal(delRes.status, 204);

      // Verify it's gone
      const getRes = await request(app)
        .get(`/api/posts/${post.id}`)
        .set('Authorization', AUTH_USER_1);

      assert.equal(getRes.status, 404);
    });
  });

  describe('6. Audit Logging', () => {
    test('records audit logs for CREATE, UPDATE, and DELETE operations', async () => {
      // 1. Create
      const createRes = await request(app)
        .post('/api/posts')
        .set('Authorization', AUTH_USER_1)
        .send({
          title: 'Audited Post',
          body: 'Markdown content for audit test',
          tags: ['audit'],
        });
      const postId = createRes.body.id;

      // 2. Update
      await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', AUTH_USER_1)
        .send({ title: 'Audited Post Updated' });

      // 3. Delete
      await request(app).delete(`/api/posts/${postId}`).set('Authorization', AUTH_USER_1);

      const logs = auditLogger.getLogs();
      assert.equal(logs.length, 3);

      assert.equal(logs[0].audit.action, 'CREATE_POST');
      assert.equal(logs[0].audit.resourceId, postId);
      assert.equal(logs[0].audit.actor, 'developer-1');
      assert.equal(logs[0].audit.status, 'SUCCESS');

      assert.equal(logs[1].audit.action, 'UPDATE_POST');
      assert.equal(logs[1].audit.resourceId, postId);

      assert.equal(logs[2].audit.action, 'DELETE_POST');
      assert.equal(logs[2].audit.resourceId, postId);
    });
  });
});
