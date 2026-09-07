# Intent: Developer Blog Post Management API
Author: Product Owner. Status: draft.

## Problem
Developers want to manage and share short technical posts via a simple REST API, but current tools lack strict schema governance.

## Proposed outcome
Provide a robust CRUD REST API for blog posts supporting Markdown content, title, tags, and author validation.

## Affected users and systems
Developers, API consumers, blog-api service.

## Constraints
No unauthenticated posts. Existing mock auth middleware only.
