# Spec: Developer Blog Post Management API
Based on: intent/001-initial-blog-intent.md
Status: Ready for Implementation
Author: Platform Team / API Governance

---

## 1. Overview & Objectives

본 명세서는 개발자가 마크다운(Markdown) 기반의 기술 블로그 게시글을 작성, 조회, 수정, 삭제할 수 있는 RESTful API의 기술 사양을 정의합니다.

### 핵심 목표 및 거버넌스 원칙
1. **엄격한 스키마 거버넌스 (Strict Schema Governance)**:
   - 모든 요청 본문(Request Body) 및 쿼리 파라미터는 명시된 스키마에 따라 유효성 검증을 거쳐야 합니다.
   - 스키마에 정의되지 않은 알 수 없는 필드(Unknown / Extra Properties)는 자동으로 거부(`400 Bad Request`)됩니다.
2. **보안 기준 준수 (Security Baseline)**:
   - `CLAUDE.md` 및 `secure-api-review` 가이드라인에 따라 모든 엔드포인트는 Mock JWT 인증 헤더(`Authorization: Bearer <token>`) 검증을 통과해야 합니다.
   - 비인가 요청은 즉시 `401 Unauthorized`로 차단됩니다.
3. **상태 변경 감사 로깅 (Audit Logging)**:
   - 생성, 수정, 삭제 등 상태를 변경하는 모든 요청은 감사 로그(Audit Log)를 남겨야 합니다.

---

## 2. Domain Data Model: `Post`

### 2.1 Post Schema Definition

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String (UUID v4) | Auto-generated, Read-only | 게시글의 고유 식별자 |
| `title` | String | Required, Min 1, Max 120 chars, Trimmed | 게시글 제목 |
| `body` | String | Required, Min 1, Max 50,000 chars (Markdown) | 게시글 마크다운 본문 |
| `tags` | Array of String | Optional (Default: `[]`), Max 10 items | 태그 목록. 각 태그는 영숫자/하이픈/소문자, 1~30자 |
| `author` | String | Auto-assigned from Auth Token, Read-only | 게시글 작성자 식별자 |
| `createdAt` | String (ISO 8601) | Auto-generated, UTC, Read-only | 생성 시각 (예: `2026-09-07T13:24:00.000Z`) |
| `updatedAt` | String (ISO 8601) | Auto-generated, UTC, Read-only | 최종 수정 시각 |

### 2.2 Strict Input Rules
- 클라이언트는 요청 바디(`body`)에 `id`, `author`, `createdAt`, `updatedAt` 필드를 포함할 수 없습니다. 포함 시 `400 Bad Request`로 거부됩니다.
- 추가적인 미정의 필드가 존재할 경우 즉시 유효성 검증 오류를 반환합니다 (`additionalProperties: false`).

---

## 3. Authentication & Authorization

### 3.1 Mock JWT Authentication
- 모든 API 요청은 HTTP 헤더에 유효한 Bearer 토큰을 포함해야 합니다.
  ```http
  Authorization: Bearer <mock-jwt-token>
  ```
- 토큰 페이로드에는 사용자 식별 정보(`sub` 또는 `username`)가 포함되어야 하며, 게시글 생성 시 `author` 필드로 자동 매핑됩니다.
- 토큰이 누락되거나 유효하지 않은 경우:
  - HTTP Status: `401 Unauthorized`
  - Body: 에러 규격에 따른 응답

### 3.2 Authorization (Ownership Check)
- 게시글 수정(`PUT`) 및 삭제(`DELETE`)는 해당 게시글의 작성자(`author`)만 수행할 수 있습니다.
- 작성자가 일치하지 않는 경우:
  - HTTP Status: `403 Forbidden`

---

## 4. API Endpoints Specification

### 4.1 POST `/api/posts` — 게시글 생성

새로운 기술 블로그 게시글을 생성합니다.

- **Method**: `POST`
- **Path**: `/api/posts`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "title": "Introduction to AI-Native Development",
    "body": "# Introduction\nAI-native development transforms how software is planned, specified, and built.",
    "tags": ["ai", "architecture", "nodejs"]
  }
  ```
- **Validation Rules**:
  - `title`: 필수, 문자열, 길이 1~120
  - `body`: 필수, 문자열(Markdown), 길이 1~50000
  - `tags`: 선택, 문자열 배열, 최대 10개, 각 원소 길이 1~30
  - 알 수 없는 필드 허용 안 됨 (`additionalProperties: false`)
- **Responses**:
  - `201 Created`
    - Header: `Location: /api/posts/:id`
    - Body: 생성된 `Post` 객체 전체
  - `400 Bad Request`: 필수 필드 누락, 유효성 검증 실패, 알 수 없는 필드 존재
  - `401 Unauthorized`: 인증 토큰 누락 또는 유효하지 않음
- **Audit Log**:
  - 이벤트: `CREATE_POST`
  - 기록 항목: `postId`, `author`, `timestamp`, `title`

---

### 4.2 GET `/api/posts` — 게시글 목록 조회 (페이지네이션 & 필터링)

게시글 목록을 페이지네이션 및 필터 조건으로 조회합니다.

- **Method**: `GET`
- **Path**: `/api/posts`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Query Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `page` | Integer | Optional | `1` | 조회할 페이지 번호 (최소 1) |
  | `limit` | Integer | Optional | `10` | 페이지당 항목 수 (최소 1, 최대 50) |
  | `tag` | String | Optional | - | 특정 태그가 포함된 게시글만 필터링 |
  | `author` | String | Optional | - | 특정 작성자가 작성한 게시글만 필터링 |
- **Responses**:
  - `200 OK`
    - Body:
      ```json
      {
        "data": [
          {
            "id": "c1f8a97c-9b1b-4f51-b842-124b17e8b61a",
            "title": "Introduction to AI-Native Development",
            "body": "# Introduction\nAI-native development...",
            "tags": ["ai", "architecture", "nodejs"],
            "author": "developer-1",
            "createdAt": "2026-09-07T13:24:00.000Z",
            "updatedAt": "2026-09-07T13:24:00.000Z"
          }
        ],
        "pagination": {
          "page": 1,
          "limit": 10,
          "total": 1,
          "totalPages": 1
        }
      }
      ```
  - `400 Bad Request`: `page` 또는 `limit`이 유효하지 않은 범위인 경우
  - `401 Unauthorized`: 인증 토큰 누락 또는 유효하지 않음

---

### 4.3 GET `/api/posts/:id` — 특정 게시글 상세 조회

게시글 고유 ID로 단일 게시글의 상세 정보를 조회합니다.

- **Method**: `GET`
- **Path**: `/api/posts/:id`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: String (UUID v4 형식)
- **Responses**:
  - `200 OK`
    - Body: `Post` 객체 전체
  - `400 Bad Request`: `id`가 유효한 UUID 형식이 아님
  - `401 Unauthorized`: 인증 토큰 누락 또는 유효하지 않음
  - `404 Not Found`: 해당 `id`의 게시글을 찾을 수 없음

---

### 4.4 PUT `/api/posts/:id` — 특정 게시글 수정 (CRUD 완성도)

기존 게시글의 제목, 본문, 태그를 수정합니다.

- **Method**: `PUT`
- **Path**: `/api/posts/:id`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: String (UUID v4 형식)
- **Request Body**:
  ```json
  {
    "title": "Updated Title",
    "body": "Updated markdown content...",
    "tags": ["ai", "architecture", "v2"]
  }
  ```
- **Validation Rules**:
  - `title`, `body`, `tags` 중 최소 1개 이상 제공 필요
  - 알 수 없는 필드 거부
- **Responses**:
  - `200 OK`
    - Body: 수정 완료된 `Post` 객체 (`updatedAt` 갱신)
  - `400 Bad Request`: 스키마 유효성 검증 실패
  - `401 Unauthorized`: 인증 실패
  - `403 Forbidden`: 게시글 작성자가 아닌 사용자가 수정을 시도함
  - `404 Not Found`: 해당 `id`의 게시글이 존재하지 않음
- **Audit Log**:
  - 이벤트: `UPDATE_POST`
  - 기록 항목: `postId`, `author`, `timestamp`, `modifiedFields`

---

### 4.5 DELETE `/api/posts/:id` — 특정 게시글 삭제

게시글 고유 ID로 게시글을 삭제합니다.

- **Method**: `DELETE`
- **Path**: `/api/posts/:id`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: String (UUID v4 형식)
- **Responses**:
  - `204 No Content`
  - `400 Bad Request`: `id`가 유효한 UUID 형식이 아님
  - `401 Unauthorized`: 인증 실패
  - `403 Forbidden`: 게시글 작성자가 아닌 사용자가 삭제를 시도함
  - `404 Not Found`: 해당 `id`의 게시글이 존재하지 않음
- **Audit Log**:
  - 이벤트: `DELETE_POST`
  - 기록 항목: `postId`, `author`, `timestamp`

---

## 5. Standard Error Response Format

모든 오류 응답은 일관된 JSON 스키마를 따릅니다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "title",
        "message": "title must not be empty and at most 120 characters"
      }
    ]
  }
}
```

### 공통 에러 코드 목록
- `VALIDATION_ERROR` (HTTP 400): 요청 바디, 쿼리, 파라미터 유효성 검증 실패 또는 알 수 없는 필드 존재
- `UNAUTHORIZED` (HTTP 401): 인증 헤더 부재 또는 유효하지 않은 토큰
- `FORBIDDEN` (HTTP 403): 리소스에 대한 수정/삭제 권한 없음 (작성자 불일치)
- `NOT_FOUND` (HTTP 404): 요청한 리소스를 찾을 수 없음
- `INTERNAL_SERVER_ERROR` (HTTP 500): 서버 내부 처리 오류

---

## 6. Audit Logging Format

상태를 변경하는 모든 요청(`POST`, `PUT`, `DELETE`)에 대해 표준화된 감사 로그를 출력합니다.

```json
{
  "audit": {
    "action": "CREATE_POST",
    "resourceId": "c1f8a97c-9b1b-4f51-b842-124b17e8b61a",
    "actor": "developer-1",
    "timestamp": "2026-09-07T13:24:00.000Z",
    "status": "SUCCESS"
  }
}
```

---

## 7. Acceptance Criteria (Verification Test Scenarios)

구현 후 `tests/integration/posts.test.js`에서 검증해야 할 핵심 테스트 시나리오입니다.

1. **Authentication Gate**:
   - `Authorization` 헤더 없이 `GET /api/posts` 호출 시 `401 Unauthorized`를 반환해야 한다.
2. **Create Post & Schema Governance**:
   - 올바른 `title`, `body`, `tags`로 `POST /api/posts` 요청 시 `201 Created`와 생성된 `Post`를 반환하고, `author`는 토큰 사용자로 지정되어야 한다.
   - 스키마에 없는 불필요한 필드(예: `extraField: "hack"`)를 포함해 전송할 경우 `400 Bad Request`로 거부되어야 한다.
   - 클라이언트가 `id`나 `author`를 임의로 지정해 생성하려 할 경우 `400 Bad Request`로 거부되어야 한다.
3. **List & Pagination**:
   - `GET /api/posts?page=1&limit=2` 호출 시 페이징 메타데이터(`total`, `page`, `limit`, `totalPages`)와 게시글 목록을 정상 반환해야 한다.
   - `tag` 쿼리 파라미터로 필터링 시 해당 태그를 포함한 게시글만 반환해야 한다.
4. **Retrieve by ID**:
   - 유효한 ID로 `GET /api/posts/:id` 호출 시 단일 게시글 정보를 반환해야 한다.
   - 존재하지 않는 ID로 호출 시 `404 Not Found`를 반환해야 한다.
5. **Authorization on Update & Delete**:
   - 작성자가 아닌 다른 사용자 토큰으로 `PUT /api/posts/:id` 또는 `DELETE /api/posts/:id` 호출 시 `403 Forbidden`을 반환해야 한다.
   - 작성자 본인 토큰으로 `DELETE /api/posts/:id` 호출 시 `204 No Content`를 반환하고, 이후 동일 ID 조회 시 `404 Not Found`가 반환되어야 한다.
6. **Audit Trail**:
   - `POST`, `PUT`, `DELETE` 성공 시 표준 감사 로그 이벤트가 기록되어야 한다.