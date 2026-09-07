# Plan: Developer Blog Post Management API
Based on:
- Intent: intent/001-initial-blog-intent.md
- Spec: specs/001-blog-spec.md
Status: Ready for Implementation
Author: AI-Native Engineering Team

---

## 1. Executive Summary & Intent Alignment

본 계획서는 [intent/001-initial-blog-intent.md](file:///Users/gookpilroh/dev/ai-native-blog-api/intent/001-initial-blog-intent.md)의 제품 의도와 [specs/001-blog-spec.md](file:///Users/gookpilroh/dev/ai-native-blog-api/specs/001-blog-spec.md)의 기술 사양을 기반으로 작성된 상세 구현 계획(Implementation Plan)입니다.

### 의도(Intent) 및 제약조건 반영
- **엄격한 스키마 거버넌스**: 마크다운 본문, 제목, 태그의 엄격한 유효성 검증 및 정의되지 않은 임의의 필드(`additionalProperties`) 자동 거부(`400 Bad Request`).
- **보안 및 인증 제약조건**: 모든 엔드포인트에 Mock JWT 인증 적용(`401 Unauthorized`), 비인가 요청 원천 차단.
- **작성자 소유권 및 거버넌스**: 토큰 기반 `author` 매핑, 타인 게시글 수정/삭제 시도시 `403 Forbidden` 차단.
- **감사 추적(Audit Trail)**: 상태 변경 요청(`POST`, `PUT`, `DELETE`)에 대한 표준 JSON 감사 로그 출력.
- **검증 에이전트 연계**: [.claude/agents/verifier.md](file:///Users/gookpilroh/dev/ai-native-blog-api/.claude/agents/verifier.md) 및 [REVIEW.md](file:///Users/gookpilroh/dev/ai-native-blog-api/REVIEW.md)의 요구사항에 부합하는 테스트 스위트 구축.

---

## 2. Target File Structure (구현 대상 파일 목록)

```
ai-native-blog-api/
├── package.json                            # [NEW] 의존성(express, supertest) 및 스크립트 정의
├── src/
│   ├── middleware/
│   │   ├── auth.js                         # [NEW] Mock JWT 인증 및 req.user 주입 미들웨어
│   │   ├── validate.js                     # [NEW] 스키마 검증 및 미정의 필드 차단 미들웨어
│   │   └── audit.js                        # [NEW] 상태 변경(POST/PUT/DELETE) 감사 로그 출력 유틸리티
│   ├── models/
│   │   └── post.js                         # [NEW] Post 엔티티 정의, UUID 생성, 인메모리 저장소
│   ├── routes/
│   │   └── posts.js                        # [NEW] /api/posts CRUD REST 라우트 핸들러
│   └── server.js                           # [NEW] Express 앱 인스턴스, 미들웨어/라우트 등록, 에러 핸들러
└── tests/
    └── integration/
        └── posts.test.js                   # [NEW] 스펙 인수 기준 검증을 위한 통합 테스트 스위트
```

---

## 3. Step-by-Step Order of Work (구현 단계별 상세 계획)

### Step 1: 프로젝트 기반 환경 및 패키지 설정 (`package.json`)
1. `package.json` 생성:
   - Node.js ES Modules 설정: `"type": "module"`
   - 프로덕션 의존성: `express`
   - 개발/테스트 의존성: `supertest`
   - 스크립트 정의:
     - `"start"`: `node src/server.js`
     - `"test"`: `node --test tests/integration/posts.test.js`
     - `"lint"`: `node --check src/**/*.js`
2. `npm install` 실행 및 의존성 트리 확보.

---

### Step 2: 보안 및 거버넌스 미들웨어 구현

#### 1) Mock JWT 인증 미들웨어 (`src/middleware/auth.js`)
- `CLAUDE.md` 규칙 ("Every endpoint requires authentication header check (mock JWT)") 준수.
- `Authorization` 헤더 파싱 (`Bearer <token>`):
  - 헤더 누락 또는 비정상 포맷 시: `401 Unauthorized` 반환
    ```json
    { "error": { "code": "UNAUTHORIZED", "message": "Missing or invalid authorization token" } }
    ```
  - 토큰 유효 시: 토큰 값에 따라 `req.user = { id: tokenUser }` 바인딩 (기본값: `developer-1`).

#### 2) 엄격한 스키마 검증 미들웨어 (`src/middleware/validate.js`)
- [secure-api-review](file:///Users/gookpilroh/dev/ai-native-blog-api/.claude/skills/secure-api-review/SKILL.md) ("reject unknown fields") 준수.
- 허용 키(`allowedFields`) 외의 속성이 요청 바디에 존재하면 즉시 `400 Bad Request` 거부:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Unknown fields are not allowed", "details": [...] } }
  ```
- 클라이언트 주입 금지 필드(`id`, `author`, `createdAt`, `updatedAt`) 명시적 차단.
- 필드별 검증:
  - `title`: 필수, 문자열, 1~120자, 공백 제거 후 빈 값 불가.
  - `body`: 필수, 문자열(Markdown), 1~50,000자.
  - `tags`: 선택(기본값 `[]`), 문자열 배열, 최대 10개, 각 태그 1~30자.

#### 3) 상태 변경 감사 로거 (`src/middleware/audit.js`)
- [secure-api-review](file:///Users/gookpilroh/dev/ai-native-blog-api/.claude/skills/secure-api-review/SKILL.md) ("state-changing endpoints emit audit logs") 준수.
- `POST`, `PUT`, `DELETE` 성공 시 표준 JSON 로그 기록:
  ```json
  {
    "audit": {
      "action": "CREATE_POST | UPDATE_POST | DELETE_POST",
      "resourceId": "<id>",
      "actor": "<req.user.id>",
      "timestamp": "<ISO-UTC>",
      "status": "SUCCESS"
    }
  }
  ```

---

### Step 3: Post 도메인 모델 및 저장소 (`src/models/post.js`)

1. **Post 데이터 구조**:
   - `id`: UUID v4 (`crypto.randomUUID()`)
   - `title`: String (Trimmed)
   - `body`: String (Markdown)
   - `tags`: String[]
   - `author`: String (`req.user.id`)
   - `createdAt`: ISO 8601 UTC
   - `updatedAt`: ISO 8601 UTC
2. **PostRepository 메서드**:
   - `create({ title, body, tags, author })`: 유효성 검증 후 레코드 추가
   - `findAll({ page, limit, tag, author })`: 페이지네이션 및 필터링 적용된 결과 반환
   - `findById(id)`: 단일 레코드 조회
   - `update(id, { title, body, tags })`: 필드 갱신 및 `updatedAt` 업데이트
   - `delete(id)`: 레코드 삭제
   - `clear()`: 테스트 격리용 초기화 함수

---

### Step 4: 라우트 핸들러 구현 (`src/routes/posts.js`)

1. **`POST /api/posts`**:
   - 스키마 유효성 검사 통과 후 게시글 생성
   - `author`는 인증된 사용자(`req.user.id`)로 자동 주입
   - 감사 로그(`CREATE_POST`) 출력
   - 응답: `201 Created`, `Location: /api/posts/:id`, 생성된 `Post` 본문
2. **`GET /api/posts`**:
   - `page`(기본 1), `limit`(기본 10), `tag`, `author` 파싱
   - 응답: `200 OK`, `{ data: [...], pagination: { page, limit, total, totalPages } }`
3. **`GET /api/posts/:id`**:
   - UUID 포맷 검증 (형식 불일치 시 `400 Bad Request`)
   - 존재하지 않을 경우 `404 Not Found`
   - 응답: `200 OK`, `Post` 본문
4. **`PUT /api/posts/:id`**:
   - 게시글 존재 여부 확인 후 작성자 권한 검증 (`post.author === req.user.id` 불일치 시 `403 Forbidden`)
   - 필드 갱신 및 감사 로그(`UPDATE_POST`) 출력 후 `200 OK` 응답
5. **`DELETE /api/posts/:id`**:
   - 게시글 존재 여부 확인 후 작성자 권한 검증 (`post.author === req.user.id` 불일치 시 `403 Forbidden`)
   - 삭제 처리 및 감사 로그(`DELETE_POST`) 출력 후 `204 No Content` 응답

---

### Step 5: 서버 진입점 및 글로벌 에러 처리 (`src/server.js`)

1. Express 앱 생성 및 `express.json()` 등록
2. 전역 또는 라우트 레벨에 Mock JWT 인증 미들웨어 장착
3. `/api/posts` 라우터 마운트
4. 404 Not Found 라우트 핸들러 등록
5. 글로벌 표준 에러 핸들러 구현 (`(err, req, res, next)`):
   - 일관된 에러 JSON 포맷 유지:
     ```json
     {
       "error": {
         "code": "VALIDATION_ERROR | NOT_FOUND | UNAUTHORIZED | FORBIDDEN | INTERNAL_SERVER_ERROR",
         "message": "...",
         "details": [...]
       }
     }
     ```

---

### Step 6: 통합 테스트 스위트 (`tests/integration/posts.test.js`)

스펙 문서의 8대 인수 기준(Acceptance Criteria)을 직접 검증하는 테스트 작성:
1. `Auth Gate`: Authorization 헤더 누락 시 401 반환 검증
2. `Create Post`: 정상 생성 시 201 및 Location 헤더, author 바인딩 검증
3. `Unknown Field Rejection`: 허용되지 않은 필드(`extraField`) 전송 시 400 거부 검증
4. `Disallowed Field Rejection`: 클라이언트가 임의로 `id`, `author` 주입 시도 시 400 거부 검증
5. `Pagination & Metadata`: 다건 생성 후 `page=1&limit=2` 페이징 메타데이터 일치 검증
6. `Tag Filtering`: 특정 태그 포함 게시글만 정상 조회되는지 검증
7. `Get Post by ID & 404`: 정상 조회(200) 및 없는 UUID 조회 시 404 검증
8. `Ownership Authorization & Desetion`: 타인 게시글 삭제 시 403, 본인 삭제 시 204 및 이후 404 검증

---

## 4. Verification & Review Matrix (품질 및 검증 기준)

구현 완료 후 다음 기준을 통해 검증을 수행합니다.

| 검증 단계 | 도구 / 기준 | 점검 항목 |
| :--- | :--- | :--- |
| **자동화 테스트** | `npm test` (`node --test`) | 통합 테스트 스위트 8개 시나리오 전원 통과 여부 |
| **보안 검토** | [.claude/skills/secure-api-review/SKILL.md](file:///Users/gookpilroh/dev/ai-native-blog-api/.claude/skills/secure-api-review/SKILL.md) | 인증(Auth), 스키마 검증(Validation), 감사 로그(Audit) 3대 원칙 준수 여부 |
| **코드 리뷰** | [REVIEW.md](file:///Users/gookpilroh/dev/ai-native-blog-api/REVIEW.md) | 3-Pass Review: Bugs, Security, Compliance (Spec/Plan 일치도) |
| **에이전트 검증** | [.claude/agents/verifier.md](file:///Users/gookpilroh/dev/ai-native-blog-api/.claude/agents/verifier.md) | 앱 실행 및 엔드포인트 동작 결과가 본 계획서와 일치하는지 보고 |