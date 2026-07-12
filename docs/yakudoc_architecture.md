# Yakudoc — 프로젝트 아키텍처 설계 문서

## 1. 프로젝트 개요

**프로젝트명**: Yakudoc  
**부제**: 영-일 비즈니스 서류 변환 및 영업 사무 자동화 SaaS  
**목적**: 영문 비즈니스 문서를 주고받아야 하는 일본 현지 영업 담당자를 위한 생산성 유틸리티
**포트폴리오 목적**: 일본 IT 취업 시장 진출용

---

## 2. 핵심 기능 (MVP 범위)

- 거래처(업체) 등록 및 관리
- 영문 비즈니스 문서(텍스트 / 파일 / 이미지) 입력
- AI 계약 리스크 요약 (전체 내용 요약 + 주의 포인트 추출)
- 회신 메일 초안 자동 생성 (영문 / 일문 분석 전 선택)
- 결과는 원인→결과 흐름의 세로 스크롤 단일 페이지로 출력
- 분석 기록을 업체 단위로 저장 및 관리
- 업체 단위 협업 (company_members)

---

## 3. 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React |
| 백엔드 | Node.js |
| 데이터베이스 | PostgreSQL |
| AI | 외부 API (Anthropic / OpenAI 엔터프라이즈 플랜) |
| 배포 테스트 | Docker |
| 타겟 플랫폼 | Windows 앱 우선, 이후 모바일 확장 |

**AI 보안 방침**:  
외부 API 사용 시 엔터프라이즈 플랜의 "학습 데이터 미활용" 조건 및 TLS 암호화 적용.  
업로드 문서는 처리 후 즉시 파기. 입력 원본은 저장하지 않으며 결과 데이터만 보존.

---

## 4. 화면 구성 및 흐름

### 4-1. 권한 등급

- **일반**: 업체 관리, 문서 분석, 기록 관리
- **관리자**: 일반 기능 전체 + 담당자 계정 관리

### 4-2. 화면 목록

| # | 화면명 | 접근 권한 | 설명 |
|---|--------|-----------|------|
| 1 | 로그인 | 전체 | 이메일 + 비밀번호 |
| 2 | 업체 목록 (메인) | 일반 / 관리자 | 등록 업체 리스트, 업체 추가 |
| 3 | 업체 상세 | 일반 / 관리자 | 업체 정보 + 메인 기능 입력 + 기록 목록 |
| 4 | 결과 화면 | 일반 / 관리자 | 요약 → 리스크 → 메일 초안 (세로 스크롤) |
| 5 | 기록 상세 | 일반 / 관리자 | 이전 결과 재열람 |
| 6 | 계정 관리 | 관리자 전용 | 사용자 목록, 등급 변경, 계정 생성 / 비활성화 |

### 4-3. 화면 흐름

```
로그인
  ├── [일반] 업체 목록 → 업체 상세 → (언어 선택) → 결과 화면
  │                  └── 기록 상세 (이전 결과 재열람)
  └── [관리자] 업체 목록 + 계정 관리
```

### 4-4. 입력 타입

| 타입 | 설명 |
|------|------|
| 텍스트 | 메일 본문, 계약서 텍스트 직접 붙여넣기 |
| 파일 | .doc / .docx / .pdf |
| 이미지 | 계약서 스캔 이미지 등 기타 이미지 파일 |

### 4-5. 결과 화면 레이아웃

세로 스크롤 단일 페이지, 탭 없음.

```
[① 문서 전체 요약]
        ↓
[② 주의해야 할 포인트 2~3개]
        ↓
[③ 메일 초안 — 분석 전 선택한 언어(영문 or 일문)로 출력]
```

---

## 5. DB 설계

### 5-1. 설계 원칙

- **소프트 딜리트**: 모든 테이블에 `deleted_at` 컬럼 적용. 실제 삭제 없이 null 여부로 활성/삭제 구분
- **사용자 상태 관리**: `users.status` 로 활성 / 비활성 / 정지 구분 (퇴사, 휴직 등 대응)
- **확장성 예약**: `users.team_id`, `records.owner_type` 등 고도화 시 활성화할 컬럼 미리 확보
- **결과 타입 분리**: `record_results` 를 별도 테이블로 분리해 결과 타입 추가 시 유연하게 확장
- **태그 정규화**: `tags` + `record_tags` 중간 테이블로 분리해 태그 추가/삭제/변경에 유연하게 대응
- **태그 유니크 제약**: `tags(user_id, name)`은 소프트 딜리트를 고려한 조건부 유니크 인덱스(`WHERE deleted_at IS NULL`)로 활성 태그 간 이름 중복 방지. `record_tags(record_id, tag_id)`는 `deleted_at` 컬럼이 없는 순수 연결 테이블이므로 조건 없는 유니크 인덱스로 중복 연결 방지
- **히스토리 테이블**: 회사명 등 중요 정보 변경 이력은 고도화 시 추가 예정

### 5-2. 테이블 정의

#### users
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | 사용자 고유 ID |
| email | string | 로그인 이메일 |
| password_hash | string | 암호화된 비밀번호 |
| name | string | 담당자 이름 |
| role | enum | 일반 / 관리자 |
| status | enum | active / inactive / suspended |
| team_id | uuid | 팀 소속 (고도화 시 활성화, 현재 null 허용) |
| created_at | timestamp | 생성일 |
| deleted_at | timestamp | 소프트 딜리트 |

#### teams
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | 팀 고유 ID |
| name | string | 팀명 |
| created_at | timestamp | 생성일 |
| deleted_at | timestamp | 소프트 딜리트 |

> 고도화 시 활성화. 현재는 구조만 예약.

#### companies
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | 업체 고유 ID |
| owner_id | uuid FK → users.id | 등록한 담당자 |
| name | string | 업체명 |
| industry | string | 업종 |
| country | string | 국가 |
| memo | string | 메모 |
| created_at | timestamp | 생성일 |
| deleted_at | timestamp | 소프트 딜리트 |

#### company_members
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | 고유 ID |
| company_id | uuid FK → companies.id | 대상 업체 |
| user_id | uuid FK → users.id | 협업 멤버 |
| permission | enum | 읽기 전용 / 편집 가능 |
| joined_at | timestamp | 참여일 |
| deleted_at | timestamp | 소프트 딜리트 |

#### records
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | 기록 고유 ID |
| company_id | uuid FK → companies.id | 귀속 업체 |
| created_by | uuid FK → users.id | 분석 요청자 |
| input_type | enum | text / file / image (데이터 활용 BM용) |
| language | enum | en / ja |
| owner_type | enum | personal / team (고도화 시 활성화, 현재 personal 고정) |
| status | enum | processing / done / failed |
| created_at | timestamp | 생성일 |
| deleted_at | timestamp | 소프트 딜리트 |

#### record_results
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | 고유 ID |
| record_id | uuid FK → records.id | 귀속 기록 |
| result_type | enum | summary / risk / mail_draft |
| content | text | 결과 본문 |
| created_at | timestamp | 생성일 |
| deleted_at | timestamp | 소프트 딜리트 |

#### tags
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | 태그 고유 ID |
| user_id | uuid FK → users.id | 태그 생성자 |
| name | string | 태그명 |
| created_at | timestamp | 생성일 |
| deleted_at | timestamp | 소프트 딜리트 |

#### record_tags
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | 고유 ID |
| record_id | uuid FK → records.id | 대상 기록 |
| tag_id | uuid FK → tags.id | 연결 태그 |
| created_at | timestamp | 연결일 |

### 5-3. 관계 요약

```
teams ──< users ──< companies ──< records ──< record_results
                  └──< company_members        └──< record_tags ──> tags
```

---

## 6. 고도화 예정 기능 (MVP 이후)

- 라인(LINE) 연동
- PDF / Word 문서 파싱 (레이아웃 유지 변환)
- 팀 / 부서 단위 공유 기록 관리
- 회사명 등 주요 정보 변경 이력 (히스토리 테이블)
- 데이터 활용 BM (input_type 집계 기반 인사이트 리포트 등)
- 업체 owner 변경 기능 (담당자 퇴사/이직 시 owner 권한 이양)

---

## 7. 비즈니스 모델 (참고)

| 플랜 | 내용 |
|------|------|
| 기본 구독 | 월 $29 / 문서 20건 |
| 종량제 | 할당량 초과 시 건당 추가 크레딧 |
| 엔터프라이즈 | 보안 강화 옵션, 고단가 |

---

## 8. 포트폴리오 스토리라인 (면접용)

> 일본은 아날로그 감성을 중시하지만, 기업 디지털화는 불가피한 흐름입니다.  
> 그 과도기에서 영문 비즈니스 문서 처리의 업무 부담을 줄여주는 도구가 필요하다고 판단했습니다.  
> 기존 번역 툴(DeepL 등)이 단순 번역에 그치는 반면, Yakudoc은 리스크 요약과 메일 초안 생성까지  
> 영업 워크플로우 전체를 커버하는 것을 목표로 합니다.

---

## 9. 인증 설계 (JWT)

### 방식
- **Access Token**: 메모리(변수)에 저장, 만료 15분~1시간
- **Refresh Token**: httpOnly 쿠키에 저장, 만료 7~30일
- **Refresh Token Rotation**: 재발급 시마다 새 토큰으로 교체 (탈취 시 1회 사용 후 무효화)
- **HTTPS 강제**: 배포 환경에서 필수 적용

### 흐름
```
로그인 → Access Token (메모리) + Refresh Token (httpOnly 쿠키) 발급
         ↓
Access Token 만료 → /api/auth/refresh 로 재발급
         ↓
로그아웃 → Refresh Token 무효화
```

---

## 10. API 설계

### Auth

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/auth/login` | 로그인, Access Token + Refresh Token 발급 |
| POST | `/api/auth/refresh` | Refresh Token으로 Access Token 재발급 |
| POST | `/api/auth/logout` | Refresh Token 무효화 |

### Users (관리자 전용)

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/users` | 전체 사용자 목록 조회 |
| POST | `/api/users` | 계정 생성 |
| PATCH | `/api/users/:id` | 등급 / 상태 변경 |
| DELETE | `/api/users/:id` | 계정 비활성화 (소프트 딜리트) |

### Companies

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/companies` | 내 업체 목록 조회 |
| POST | `/api/companies` | 업체 등록 |
| GET | `/api/companies/:id` | 업체 상세 조회 |
| PATCH | `/api/companies/:id` | 업체 정보 수정 |
| DELETE | `/api/companies/:id` | 업체 삭제 (소프트 딜리트) |
| POST | `/api/companies/:id/members` | 협업 멤버 초대 |
| DELETE | `/api/companies/:id/members/:userId` | 협업 멤버 제거 |

### Records

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/companies/:id/records` | 업체별 기록 목록 조회 |
| POST | `/api/companies/:id/records` | 분석 요청 → 즉시 record_id + status 반환 |
| GET | `/api/records/:id` | 기록 상세 + 결과 조회 (폴링용) |
| DELETE | `/api/records/:id` | 기록 삭제 (소프트 딜리트) |
| POST | `/api/records/:id/tags` | 태그 연결 |
| DELETE | `/api/records/:id/tags/:tagId` | 태그 연결 해제 |

### Tags

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/tags` | 내 태그 목록 조회 |
| POST | `/api/tags` | 태그 생성 |
| PATCH | `/api/tags/:id` | 태그명 수정 |
| DELETE | `/api/tags/:id` | 태그 삭제 (소프트 딜리트) |

### 분석 요청 흐름 (비동기 구조)

```
POST /api/companies/:id/records
  → 즉시 응답: { record_id, status: "processing" }

GET /api/records/:id  (폴링)
  → status: "processing" → 프론트에서 재요청
  → status: "done"       → 결과 데이터 포함 반환
  → status: "failed"     → 에러 메시지 반환
```

> `records` 테이블에 `status` 컬럼 추가 필요 (processing / done / failed)  
> 고도화 시 폴링을 웹소켓 또는 푸시 알림으로 교체 예정


---

## 11. API 명세

### 공통 에러 응답

```
Response 400  { error: "잘못된 요청입니다" }
Response 401  { error: "인증이 필요합니다" }
Response 403  { error: "권한이 없습니다" }
Response 404  { error: "존재하지 않는 리소스입니다" }
Response 500  { error: "서버 오류가 발생했습니다" }
```

---

### Auth

**POST /api/auth/login**
```
Request
{ email: string, password: string }

Response 200
{ access_token: string, user: { id: string, name: string, role: "user" | "admin" } }

Response 401
{ error: "이메일 또는 비밀번호가 올바르지 않습니다" }
```

**POST /api/auth/refresh**
```
Request
cookie: refresh_token (httpOnly, 자동 전송)

Response 200
{ access_token: string }

Response 401
{ error: "유효하지 않은 토큰입니다" }
```

**POST /api/auth/logout**
```
Request
cookie: refresh_token (httpOnly, 자동 전송)

Response 200
{ message: "로그아웃 되었습니다" }
```

---

### Users (관리자 전용)

**GET /api/users**
```
Response 200
{
  users: [
    { id: string, name: string, email: string, role: "user" | "admin",
      status: "active" | "inactive" | "suspended", created_at: string }
  ]
}
```

**POST /api/users**
```
Request
{ name: string, email: string, password: string, role: "user" | "admin" }

Response 201
{ id: string, name: string, email: string, role: "user" | "admin" }

Response 409
{ error: "이미 사용 중인 이메일입니다" }
```

**PATCH /api/users/:id**
```
Request
{ role?: "user" | "admin", status?: "active" | "inactive" | "suspended" }

Response 200
{ id: string, name: string, role: "user" | "admin", status: "active" | "inactive" | "suspended" }
```

**DELETE /api/users/:id**
```
Response 200
{ message: "계정이 비활성화되었습니다" }
```

---

### Companies

**GET /api/companies**
```
Response 200
{
  companies: [
    { id: string, name: string, industry: string, country: string,
      owner_id: string, created_at: string }
  ]
}
```

**POST /api/companies**
```
Request
{ name: string, industry: string, country: string, memo?: string }

Response 201
{ id: string, name: string, industry: string, country: string, memo: string | null }
```

**GET /api/companies/:id**
```
Response 200
{
  id: string, name: string, industry: string, country: string,
  memo: string | null, owner_id: string,
  members: [ { user_id: string, name: string, permission: "read" | "edit" } ],
  created_at: string
}
```

**PATCH /api/companies/:id**
```
Request
{ name?: string, industry?: string, country?: string, memo?: string }

Response 200
{ id: string, name: string, industry: string, country: string, memo: string | null }
```

**DELETE /api/companies/:id**
```
Response 200
{ message: "업체가 삭제되었습니다" }
```

**POST /api/companies/:id/members**
```
Request
{ user_id: string, permission: "read" | "edit" }

Response 201
{ company_id: string, user_id: string, permission: "read" | "edit" }

Response 404
{ error: "존재하지 않는 사용자입니다" }
```

**DELETE /api/companies/:id/members/:userId**
```
Response 200
{ message: "멤버가 제거되었습니다" }
```

---

### Records

**GET /api/companies/:id/records**
```
Response 200
{
  records: [
    { id: string, input_type: "text" | "file" | "image", language: "en" | "ja",
      status: "processing" | "done" | "failed",
      tags: [ { id: string, name: string } ], created_at: string }
  ]
}
```

**POST /api/companies/:id/records**
```
Request (multipart/form-data)
{
  input_type: "text" | "file" | "image",
  language: "en" | "ja",
  content?: string,   // input_type이 text일 때
  file?: File,        // input_type이 file / image일 때
  tag_ids?: string    // 콤마로 구분된 기존 tag id 목록 (선택), 예: "uuid1,uuid2"
}

Response 202
{ record_id: string, status: "processing" }

Response 400
{ error: "잘못된 요청입니다" }   // tag_ids 중 존재하지 않거나 본인 소유가 아닌 태그가 포함된 경우
```

**GET /api/records/:id**
```
Response 200 (processing 중)
{ id: string, company_id: string, status: "processing" }

Response 200 (완료)
{
  id: string, company_id: string, status: "done", language: "en" | "ja",
  results: [ { result_type: "summary" | "risk" | "mail_draft", content: string } ],
  tags: [ { id: string, name: string } ], created_at: string
}

Response 200 (실패)
{ id: string, company_id: string, status: "failed", error: "분석 중 오류가 발생했습니다" }
```

> `company_id`는 결과 화면에서 소속 업체 상세로 되돌아가기 위해 응답에 포함한다.

**DELETE /api/records/:id**
```
Response 200
{ message: "기록이 삭제되었습니다" }
```

---

### Tags

**GET /api/tags**
```
Response 200
{ tags: [ { id: string, name: string } ] }
```

**POST /api/tags**
```
Request
{ name: string }

Response 201
{ id: string, name: string }

Response 409
{ error: "이미 존재하는 태그입니다" }
```

**PATCH /api/tags/:id**
```
Request
{ name: string }

Response 200
{ id: string, name: string }
```

**DELETE /api/tags/:id**
```
Response 200
{ message: "태그가 삭제되었습니다" }
```

**POST /api/records/:id/tags**
```
Request
{ tag_id: string }

Response 201
{ record_id: string, tag_id: string }
```

**DELETE /api/records/:id/tags/:tagId**
```
Response 200
{ message: "태그 연결이 해제되었습니다" }
```

---

## 12. 시스템 아키텍처

### 전체 구성

```
[클라이언트 - React]
  - Access Token: 메모리(변수) 저장
  - Refresh Token: httpOnly 쿠키 저장
  - 대상 플랫폼: Windows 앱 우선, 이후 모바일 확장
        ↕ HTTPS / REST API
[백엔드 - Node.js]
  - Auth 미들웨어: 모든 요청에서 JWT 검증 및 권한 체크
  - AI 서비스 레이어: AI API 교체 가능하도록 추상화
  - Refresh Token 저장 및 Rotation 처리
        ↕ SQL
[DB - PostgreSQL]
        ↕ HTTPS
[외부 AI API]
  - 개발: Gemini Flash
  - 운영: Anthropic / OpenAI 엔터프라이즈로 교체 예정

전체를 Docker로 감싸서 배포 테스트
```

### Docker 컨테이너 구성

| 컨테이너 | 역할 |
|----------|------|
| frontend | React 빌드 결과물 서빙 |
| backend | Node.js API 서버 |
| db | PostgreSQL |

> `docker-compose.yml` 작성은 Cline에 위임. 위 세 컨테이너 구조로 구성 요청.

### AI 서비스 레이어 교체 전략

백엔드에서 AI 호출 부분을 인터페이스로 추상화하여, 환경변수로 사용할 서비스를 결정하는 구조.

```
AIService (인터페이스)
  ├── GeminiService     (개발용)
  └── AnthropicService  (운영용)
```

교체 시 환경변수만 변경하면 되며, 비즈니스 로직 수정 불필요.

### 분석 요청 흐름

```
① 사용자 입력 (텍스트 / 파일 / 이미지)
        ↓
② POST /api/companies/:id/records
   → record 생성, status: processing
   → 즉시 응답: { record_id, status: "processing" }
        ↓
③ 백엔드: AI API 비동기 호출 (Gemini Flash)
        ↓
④ 결과 저장: record_results 테이블, status: done
        ↓
⑤ 클라이언트: record_id 수신 후 2초 간격 폴링
   GET /api/records/:id
        ↓
⑥ status: "done" 확인 시 결과 화면 출력
   (요약 → 리스크 → 메일 초안, 세로 스크롤)
```

> 고도화 시 폴링을 웹소켓 또는 푸시 알림으로 교체 예정.
