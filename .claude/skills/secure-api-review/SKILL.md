---
name: secure-api-review
description: Apply the API security standard. Use whenever creating or modifying an external-facing endpoint.
---
# Secure API review

When you create or change an API endpoint:
1. Authentication: every endpoint requires valid headers or token.
2. Input validation: validate request bodies against schema and reject unknown fields.
3. Audit: state-changing endpoints emit audit logs.