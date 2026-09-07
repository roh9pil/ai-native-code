import crypto from 'node:crypto';

/**
 * Post Repository (In-Memory Data Store)
 */
class PostRepository {
  constructor() {
    /** @type {Map<string, object>} */
    this.posts = new Map();
  }

  /**
   * Create a new post
   */
  create({ title, body, tags = [], author }) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const post = {
      id,
      title,
      body,
      tags: Array.isArray(tags) ? [...tags] : [],
      author,
      createdAt: now,
      updatedAt: now,
    };

    this.posts.set(id, post);
    return { ...post };
  }

  /**
   * Find a post by ID
   */
  findById(id) {
    const post = this.posts.get(id);
    return post ? { ...post } : null;
  }

  /**
   * Find all posts with pagination and filtering
   */
  findAll({ page = 1, limit = 10, tag, author } = {}) {
    let list = Array.from(this.posts.values());

    // Filter by tag
    if (tag) {
      list = list.filter((p) => Array.isArray(p.tags) && p.tags.includes(tag));
    }

    // Filter by author
    if (author) {
      list = list.filter((p) => p.author === author);
    }

    // Sort by createdAt descending (newest first)
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const data = list.slice(startIndex, startIndex + limit).map((p) => ({ ...p }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Update an existing post
   */
  update(id, updates) {
    const existing = this.posts.get(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();
    const updated = {
      ...existing,
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.body !== undefined ? { body: updates.body } : {}),
      ...(updates.tags !== undefined ? { tags: [...updates.tags] } : {}),
      updatedAt: now,
    };

    this.posts.set(id, updated);
    return { ...updated };
  }

  /**
   * Delete a post by ID
   */
  delete(id) {
    return this.posts.delete(id);
  }

  /**
   * Clear all posts (for tests)
   */
  clear() {
    this.posts.clear();
  }
}

export const postRepository = new PostRepository();
