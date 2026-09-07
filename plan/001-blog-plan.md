# Plan: Developer Blog Post Management API
Based on: specs/001-blog-spec.md

## Files that change
- src/models/post.js (new)
- src/routes/posts.js (new)
- src/server.js (modify)
- tests/integration/posts.test.js (new)

## Order of work
1. Create Post model schema.
2. Implement posts routes with validation and auth.
3. Wire into server.js and add integration tests.