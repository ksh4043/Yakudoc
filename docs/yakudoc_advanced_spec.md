# Yakudoc — 고도화 설계 명세 (Advanced Spec)

> 이 문서는 `yakudoc_architecture.md`(MVP 확정 설계)의 **6장 「고도화 예정 기능」** 상세 명세를 담는다.
> MVP 확정 설계와 고도화(진행 중) 설계를 문서 단위로 분리하기 위해 별도로 관리하며,
> `architecture.md`는 6장에서 각 항목이 이 문서를 가리키도록만 링크한다.
> 여기서 새로 도입되는 역할·화면·테이블은 **MVP 본문(4-1 권한 등급, 4-2 화면 목록 등)을 수정하지 않고**
> 이 문서 안에서 자기완결적으로 기술한다.

---

## 0. 진행 원칙

### 0-1. 설계 변경 워크플로우
고도화는 **문서 → 마이그레이션 → 코드** 순서로 진행한다.

1. 이 문서에 기능 명세를 확정한다.
2. `backend/src/db/migrate.js`에 스키마 변경을 반영한다.
3. 컨트롤러 / 라우트 / 서비스 / 프론트를 구현한다.

설계와 다르게 구현해야 할 이유가 생기면 문서나 코드를 임의로 고치지 말고 **사용자에게 즉시
보고하고 의사를 확인한 뒤**, 확정된 방향으로 이 문서를 먼저 갱신하고 코드에 반영한다.

### 0-2. 예약 구조 활성화 우선
MVP 설계는 고도화를 위해 다음 구조를 **미리 예약**해 두었다. 새 구조를 임의로 만들기 전에
예약 구조를 먼저 활성화한다.

| 예약 항목 | 위치 | 활성화 기능 |
|-----------|------|-------------|
| `teams` 테이블 | migrate.js | 기능 1 (팀 공유) |
| `users.team_id` | users | 기능 1 |
| `records.owner_type` (`personal`/`team`) | records | 기능 1 |
| 히스토리 테이블(언급) | architecture 5-1 | 기능 4 |
| owner 이양(언급) | architecture 6장 | 기능 2 |

### 0-3. 마이그레이션 반영 방식
`migrate.js`는 버전 파일 방식이 아니라 **단일 idempotent SQL 블록**이다. 고도화 스키마도 이 블록에
누적 추가한다.

- 새 테이블: `CREATE TABLE IF NOT EXISTS ...`
- 기존 테이블 컬럼 추가: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
- 조건부 유니크: `CREATE UNIQUE INDEX IF NOT EXISTS ... WHERE deleted_at IS NULL`
- 기존 데이터가 있으면 `ADD COLUMN`에 `DEFAULT`를 주어 백필되게 하고, 필요 시 별도 `UPDATE`로 보정

각 기능 절의 **DB 변경** 항목에 migrate.js에 그대로 붙일 수 있는 DDL 스니펫을 제공한다.

### 0-4. 하위호환 · 공통 규칙
- 모든 테이블에 `deleted_at` 적용(순수 연결/불변 로그 테이블은 예외로 명시), 삭제는 `deleted_at` 갱신
- 공통 에러 응답 형식 `{ error: "..." }` 및 상태코드(400/401/403/404/409/500) 유지
- 보호 라우트에 `authenticate`, 관리자 전용에 `requireAdmin` 유지
- AI/외부 연동은 인터페이스로 추상화하고 env로 구현 전환(AIService 패턴 미러)
- **원본 미저장 원칙**(architecture 3장): 업로드 문서/파싱 결과 원본은 저장하지 않고 결과 데이터만 보존

---

## 1. 권한 등급 확장 (MVP 대비)

MVP는 전역 역할 `user` / `admin` 2단계다. 고도화는 여기에 **팀 단위 역할**을 더한다.

| 구분 | 역할 | 범위 | 설명 |
|------|------|------|------|
| 전역 | `admin` | 시스템 | 기존. 계정·팀 관리, 전체 인사이트 열람 |
| 전역 | `user` | 시스템 | 기존. 일반 사용자 |
| 팀 | `lead` | 소속 팀 | **업무 배정자**. 팀원을 업체 담당으로 배정 |
| 팀 | `member` | 소속 팀 | 팀 소속 일반 팀원 |

- 전역 역할(`users.role`)과 팀 역할(`users.team_role`)은 **직교**한다. 전역 `user`이면서 팀 `lead`일 수 있다.
- `admin`은 모든 팀의 배정 권한을 겸한다.
- "팀장 그 이상 직급(부서장 등)"의 다단계 직급은 향후 확장 예약으로 두고, 1차 고도화는 `member`/`lead` 2단계만 구현한다.

### 접근 판정 요약

| 동작 | 허용 대상 |
|------|-----------|
| 업체 접근(조회/기록) | 업체 owner · 활성 `company_members` · admin |
| 업체 owner 이양 | 현재 owner **전용** (기능 1 이후 해당 팀 `lead` 추가). admin 불가 — 4-1 참조 |
| 업무 배정/해제 | 해당 팀 `lead` · admin |
| 팀 CRUD / 팀원 배치 / 역할 변경 | admin |
| 개인(personal) 기록 열람 | 작성자(created_by) · 업체 owner · admin |
| 팀(team) 기록 열람 | 업체 접근 권한자 전원 |
| 인사이트 리포트 | admin (팀 범위는 해당 팀 `lead`) |

---

## 2. 화면 목록 확장 (MVP 대비)

MVP 6개 화면(architecture 4-2)에 다음을 **추가**한다.

| # | 화면명 | 접근 권한 | 관련 기능 |
|---|--------|-----------|-----------|
| 7 | 업무 배정 페이지 | 팀 `lead` / admin | 기능 1 |
| 8 | 팀 관리 | admin | 기능 1 |
| 9 | 인사이트 대시보드 | admin / 팀 `lead` | 기능 4 |

기존 화면 확장:
- **업체 상세**: owner 이양 액션(기능 2), 변경 이력 섹션(기능 4-히스토리), 기록의 개인/팀 공유 표시(기능 1)
- **계정 설정**(신규 소화면 또는 기존 확장): LINE 연동 상태/버튼(기능 6)

---

## 3. 기능 1 — 팀 / 부서 단위 공유 + 업무 배정

### 3-1. 개요
팀 내에서 한 업체를 여러 담당자가 협업해야 할 때, **업무 배정자(`lead`)** 가 팀원을 업체 담당으로
배정한다. 배정된 팀원은 해당 업체와 팀 공유 기록에 접근할 수 있다.

- 팀 소속: `users.team_id` (1인 1팀). 팀 내 역할: `users.team_role`(`member`/`lead`).
- 배정 실체: 기존 `company_members` 행으로 표현하되, 배정자가 만든 행은 `assigned_by`에 배정자 id를 남겨
  MVP의 owner 직접 초대(`assigned_by IS NULL`)와 구분한다.
- 기록 공유 범위: `records.owner_type`으로 구분.
  - `personal`: 작성자 · 업체 owner · admin만 열람
  - `team`: 업체 접근 권한자 전원 열람(팀 공유)

### 3-2. DB 변경

```sql
-- users: 팀 역할 추가 (team_id는 이미 예약되어 있음, 여기서 활성 사용)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS team_role VARCHAR(10) NOT NULL DEFAULT 'member'
    CHECK (team_role IN ('member', 'lead'));

-- company_members: 배정자 추적 컬럼
ALTER TABLE company_members
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id);
```

- `teams` 테이블과 `records.owner_type`은 이미 존재하므로 스키마 변경 없이 **의미를 활성화**한다.
- 기존 `company_members` 행의 `assigned_by`는 NULL(= owner 초대)로 유지되어 하위호환.
- `records.owner_type`은 기본값 `personal`이 이미 걸려 있어 기존 기록은 그대로 개인 기록으로 취급된다.

### 3-3. API 명세

#### 팀 관리 (admin 전용)

**GET /api/teams**
```
Response 200
{ teams: [ { id, name, member_count, lead_count, created_at } ] }
```

**POST /api/teams**
```
Request  { name: string }
Response 201  { id, name }
```

**PATCH /api/teams/:id**
```
Request  { name: string }
Response 200  { id, name }
```

**DELETE /api/teams/:id** — 소프트 딜리트
```
Response 200  { message: "팀이 삭제되었습니다" }
```
> 삭제 시 소속 사용자의 `team_id`는 NULL로 정리한다(같은 트랜잭션).

**GET /api/teams/:id/members**
```
Response 200
{ members: [ { user_id, name, email, team_role: "member" | "lead" } ] }
```

**POST /api/teams/:id/members** — 사용자를 팀에 편성
```
Request  { user_id: string, team_role?: "member" | "lead" }   // 기본 member
Response 201  { team_id, user_id, team_role }
Response 409  { error: "이미 다른 팀에 소속된 사용자입니다" }
```

**PATCH /api/teams/:id/members/:userId** — 팀 역할 변경(lead 지정/해제)
```
Request  { team_role: "member" | "lead" }
Response 200  { user_id, team_role }
```

**DELETE /api/teams/:id/members/:userId** — 팀에서 제외(team_id NULL, team_role member로 초기화)
```
Response 200  { message: "팀에서 제외되었습니다" }
```

#### 업무 배정 (팀 lead / admin)

**GET /api/teams/:id/board** — 배정 페이지용 집계
```
Response 200
{
  team: { id, name },
  members: [ { user_id, name, team_role } ],
  companies: [
    { id, name, assignees: [ { user_id, name, permission: "read" | "edit" } ] }
  ]
}
```
> `companies`는 해당 팀원이 owner인 업체 집합(= 팀 범위 업체)이다.

**POST /api/companies/:id/assignees** — 팀원을 업체 담당으로 배정
```
Request  { user_id: string, permission: "read" | "edit" }
Response 201  { company_id, user_id, permission, assigned_by }
Response 403  { error: "권한이 없습니다" }        // lead/admin 아님, 또는 다른 팀 업체
Response 404  { error: "존재하지 않는 사용자입니다" }
```
> `company_members`에 `assigned_by = 요청자` 로 INSERT. 이미 활성 배정이면 `permission`만 갱신.

**DELETE /api/companies/:id/assignees/:userId** — 배정 해제(소프트 딜리트)
```
Response 200  { message: "배정이 해제되었습니다" }
```

### 3-4. 접근제어 확장
기존 `checkCompanyAccess`(owner OR 활성 company_member)는 배정 = company_members 이므로 그대로 동작한다.
추가로 **기록 열람 시 owner_type 분기**를 적용한다.

- `getRecord` / `listRecords`: `owner_type = 'personal'` 인 기록은 `created_by = 요청자` 또는 업체 owner 또는 admin만 반환. `owner_type = 'team'` 인 기록은 업체 접근 권한자 전원에게 반환.
- 배정/해제 권한: 요청자가 대상 업체 owner의 팀에서 `team_role = 'lead'` 이거나 admin일 때만 허용.

### 3-5. 화면 — 업무 배정 페이지 (#7)
- 접근: 팀 `lead` / admin
- 구성: 좌측 팀원 목록, 우측 팀 범위 업체 목록. 업체별 담당 팀원 배정/해제(권한 read/edit 선택).
- `GET /api/teams/:id/board`로 초기 로드, 배정/해제는 assignees API 호출 후 부분 갱신.

### 3-6. 화면 — 팀 관리 (#8)
- 접근: admin
- 팀 CRUD, 사용자 편성, `lead` 지정/해제.

### 3-7. 흐름
```
admin: 팀 생성 → 팀원 편성 → lead 지정
         ↓
lead: 업무 배정 페이지 → 팀원을 업체 담당으로 배정
         ↓
배정된 팀원: 해당 업체 접근 · 팀(team) 공유 기록 열람
```

---

## 4. 기능 2 — 업체 owner(담당자) 이양

### 4-1. 개요
담당자 퇴사/이직 시 업체의 owner 권한을 다른 사용자에게 이양한다. 기존 owner는 접근이 끊기지 않도록
편집 권한 멤버로 전환한다(선택). 이양 이력은 기능 3(변경 이력)에 기록한다.

**이양 권한은 현재 owner 전용이다.** `admin`은 사용자 조직상의 상급자가 아니라 **앱을 운영·관리하는
역할**이므로 업체 담당자 이양이라는 업무 행위에 관여하지 않는다. 조직상 상급자에 해당하는 권한은
기능 1에서 도입되는 **팀 `lead`(업무 배정자)** 이며, 이양 권한의 `lead` 분기는 **기능 1에서 추가한다**
(구현 권장 순서 10장 유지를 위해 이번 기능 2 범위에서는 owner 전용으로 구현한다).

> **알려진 공백**: 기능 1 도입 전까지, owner가 이양하지 않은 채 계정이 비활성화되면 해당 업체를
> 이양할 수단이 없다. 기능 1에서 `lead` 분기가 추가되면 해소된다.

### 4-2. DB 변경
전용 테이블 없음. `companies.owner_id` 갱신 + `company_history`(기능 3)에 로그. 기존 owner를
멤버로 남길 경우 `company_members`에 INSERT.

> `company_members`에는 `(company_id, user_id) WHERE deleted_at IS NULL` 조건부 유니크 인덱스
> (`company_members_unique_active`)가 있다. 기존 owner에게 이미 활성 멤버 행이 있을 수 있으므로
> INSERT는 **upsert**로 처리해 활성 행이 있으면 `permission`만 `edit`으로 갱신한다
> (3-3 배정 API의 "이미 활성 배정이면 permission만 갱신"과 동일한 취지).

### 4-3. API 명세

**GET /api/companies/:id/transfer-candidates** — 이양 대상 후보 목록
```
Response 200  { users: [ { id, name } ] }
Response 403  { error: "권한이 없습니다" }            // 해당 업체 owner 아님
Response 404  { error: "존재하지 않는 리소스입니다" }  // 업체 없음/삭제됨
```
- 권한: 해당 업체 owner. (기능 1에서 팀 `lead` 분기 추가)
- 대상: `status = 'active' AND deleted_at IS NULL` 인 사용자 중 현재 owner 제외.
- **최소 필드 원칙**: `id`, `name`만 반환한다. 이메일·역할 등은 노출하지 않는다
  (`GET /api/users`는 admin 전용을 유지하며, 이 엔드포인트가 그 우회로가 되지 않게 한다).
- 기능 1 도입 후 후보 범위를 팀 단위(`users.team_id`)로 좁히는 것은 그 시점에 재검토한다.

**POST /api/companies/:id/transfer-owner**
```
Request  { new_owner_id: string, keep_as_member?: boolean }   // keep_as_member 기본 true
Response 200  { id, owner_id }
Response 400  { error: "잘못된 요청입니다" }          // 자기 자신에게 이양 등
Response 403  { error: "권한이 없습니다" }            // 현재 owner 아님(admin 포함)
Response 404  { error: "존재하지 않는 사용자입니다" }  // new_owner 없음/비활성
```
- 권한: 현재 owner **전용**. admin도 403이다(4-1 참조). 팀 `lead` 분기는 기능 1에서 추가.
- 트랜잭션: `owner_id` 갱신 → (keep_as_member면 기존 owner를 `company_members` edit로 upsert) → `company_history`에 `field='owner_id'` 이력 INSERT.

### 4-4. 화면
업체 상세에 "담당자 이양" 액션(현재 owner에게만 노출). 대상 사용자 선택 → 확인 모달.
후보 목록은 `GET /api/companies/:id/transfer-candidates`로 조회한다.

### 4-5. 흐름
```
현재 owner → 업체 상세 "담당자 이양" → 후보 조회 → new_owner 선택
   → owner_id 변경 + (기존 owner 멤버 전환) + 이력 기록
```

---

## 5. 기능 3 — 주요 정보 변경 이력 (히스토리 테이블)

### 5-1. 개요
업체의 주요 정보(회사명 등) 변경 이력을 append-only로 기록한다. `PATCH /api/companies/:id`,
owner 이양(기능 2) 시 변경된 필드마다 이력을 남긴다.

### 5-2. DB 변경

```sql
CREATE TABLE IF NOT EXISTS company_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id),
  changed_by  UUID        NOT NULL REFERENCES users(id),
  field       VARCHAR(30) NOT NULL
                          CHECK (field IN ('name', 'industry', 'country', 'memo', 'owner_id')),
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_history_company_idx
  ON company_history (company_id, created_at DESC);
```

> **`deleted_at` 예외**: `record_tags`와 마찬가지로 이력은 불변 append-only 로그이므로 `deleted_at`을
> 두지 않는다(architecture 5-1 태그 연결 테이블 예외와 동일한 취지). 논리 삭제 대상이 아니다.

### 5-3. API 명세

**GET /api/companies/:id/history**
```
Response 200
{
  history: [
    { field, old_value, new_value, changed_by, changed_by_name, created_at }
  ]
}
```
- 권한: 업체 접근 권한자.
- 이력 생성 자체는 별도 엔드포인트 없이 PATCH/이양 처리 내부(같은 트랜잭션)에서 수행.

### 5-4. 기록 로직
`PATCH /api/companies/:id` 처리 시 변경 전/후를 비교해 실제로 바뀐 필드만 `company_history`에 INSERT.
빈 변경(동일 값)은 기록하지 않는다.

### 5-5. 화면
업체 상세에 "변경 이력" 섹션(최신순). 필드명·이전값→새값·변경자·일시 표시.

---

## 6. 기능 4 — 데이터 활용 BM (인사이트 리포트)

### 6-1. 개요
`records.input_type`(text/file/image) 등 집계를 기반으로 사용 인사이트 리포트를 제공한다.
운영 데이터 활용 BM의 기반이며, 1차 고도화는 **온디맨드 집계**로 구현한다.

### 6-2. DB 변경
전용 테이블 없음(집계 쿼리로 처리). 대규모 확장 시 materialized view 또는 `insight_reports` 캐시
테이블 도입을 별도 예약으로 둔다.

### 6-3. API 명세 (admin, 팀 범위는 해당 lead)

**GET /api/analytics/overview**
```
Query   ?from=YYYY-MM-DD&to=YYYY-MM-DD&team_id=<uuid?>
Response 200
{
  range: { from, to },
  total: number,
  by_input_type: { text: number, file: number, image: number },
  by_language:   { en: number, ja: number },
  by_status:     { processing: number, done: number, failed: number },
  by_period:     [ { date: "YYYY-MM-DD", count: number } ]
}
```
- 권한: admin. `team_id` 지정 시 해당 팀 `lead`도 자기 팀 범위로 허용.
- 집계 대상: `deleted_at IS NULL` 기록. 기간 필터는 `created_at` 기준.

**GET /api/analytics/companies** (선택, 2차)
```
Query   ?from=&to=&team_id=
Response 200
{ companies: [ { company_id, name, record_count, by_input_type: {...} } ] }
```

### 6-4. 화면 — 인사이트 대시보드 (#9)
- 접근: admin / 팀 `lead`
- input_type·언어·상태 분포 차트, 기간별 추이. 기간/팀 필터.

---

## 7. 기능 5 — PDF / Word 문서 파싱 (레이아웃 유지 변환)

### 7-1. 개요
현재는 파일을 base64 inlineData로 AI에 그대로 전달한다. 고도화는 **파싱 레이어**를 두어 pdf/docx를
레이아웃을 보존한 텍스트로 변환한 뒤 AI에 전달한다. AIService와 동일하게 인터페이스로 추상화한다.

### 7-2. 서비스 추상화
```
DocumentParser (인터페이스)
  parse({ fileBuffer, mimeType }) -> { text, layout? }
  ├── PdfParser      (application/pdf)
  └── DocxParser     (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
```
- 디스패치: `mimeType`으로 구현체 선택. 지원하지 않는 타입은 기존 inlineData 경로 유지(이미지 등).
- env로 파서 제공자 전환 가능하도록 구성(예: 내장 라이브러리 vs 외부 파싱 API).

### 7-3. 처리 흐름 변경
```
input_type = 'file' (pdf/docx)
   → DocumentParser.parse() → text
   → AIService.analyzeDocument({ inputType: 'text', content: text, ... })
```
- 파싱 실패 시 harness 규칙과 동일하게 최대 2회 재시도(1초 간격) 후 record `status='failed'`.

### 7-4. DB 변경 / 보안
- **DB 변경 없음.** 파싱 결과(원본 텍스트)는 **저장하지 않는다**(architecture 3장 원본 미저장 원칙).
  결과는 AI 분석 산출물(`record_results`)만 보존한다.

### 7-5. 화면
파일 업로드 UX 동일. 별도 신규 화면 없음.

---

## 8. 기능 6 — LINE 연동

### 8-1. 개요
일본 시장 주력 메신저인 LINE과 연동한다. 1차 고도화는 **분석 완료 알림(push)**, 2차는
**문서 수신(webhook)** 을 다룬다. NotificationService로 추상화한다.

### 8-2. DB 변경

```sql
CREATE TABLE IF NOT EXISTS line_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id),
  line_user_id  VARCHAR(64)  NOT NULL,
  linked_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS line_links_user_active
  ON line_links (user_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS line_links_line_user_active
  ON line_links (line_user_id) WHERE deleted_at IS NULL;
```

### 8-3. 환경변수
```
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
```

### 8-4. API 명세

**POST /api/line/link** — 계정 연동
```
Request  { line_user_id: string }
Response 201  { user_id, line_user_id }
Response 409  { error: "이미 연동된 계정입니다" }
```

**DELETE /api/line/link** — 연동 해제(소프트 딜리트)
```
Response 200  { message: "LINE 연동이 해제되었습니다" }
```

**POST /api/line/webhook** — (2차) 문서 수신, 공개 엔드포인트
```
- LINE 서명(X-Line-Signature) 검증 필수. 검증 실패 시 401.
- 텍스트/파일 메시지를 해당 사용자 컨텍스트의 record 생성으로 연결.
```

### 8-5. 알림 흐름
`processRecordAsync`에서 `status`가 `done`/`failed`로 확정된 뒤, 작성자에게 연동된 LINE이 있으면
`NotificationService.notify()`로 push 전송(분석 완료/실패 안내 + 결과 링크).

### 8-6. 보안
- webhook 서명 검증, 토큰은 env 관리.
- 원본 미저장 원칙 유지(수신 문서도 처리 후 파기).

---

## 9. 마이그레이션 종합 (migrate.js 반영 요약)

기능 순서와 무관하게, 아래 변경을 `migrate.js` 단일 블록에 누적 추가한다.

| 대상 | 변경 | 기능 |
|------|------|------|
| `users` | `ADD COLUMN team_role` (member/lead) | 1 |
| `company_members` | `ADD COLUMN assigned_by` | 1 |
| `company_history` | 신규 테이블 + 인덱스 | 5 |
| `line_links` | 신규 테이블 + 조건부 유니크 인덱스 2종 | 6 |
| `teams` / `users.team_id` / `records.owner_type` | 스키마 변경 없이 의미 활성화 | 1 |

> `company_history`, `line_links` 외 신규 테이블은 없다. `analytics`(기능 4)와 문서 파싱(기능 5)은
> 스키마 변경이 없다.

---

## 10. 구현 권장 순서

의존도가 낮고 기존 스키마 연장선인 것부터 진행한다.

1. **기능 2 (owner 이양)** — 스키마 변경 최소, 단독 완결
2. **기능 3 (변경 이력)** — 기능 2의 이력 연계, `company_history` 도입
3. **기능 1 (팀 공유 + 업무 배정)** — 예약 구조 활성화, 접근제어 확장(가장 큼)
4. **기능 4 (인사이트 리포트)** — 집계 전용, 스키마 무변경
5. **기능 5 (문서 파싱)** — 서비스 레이어 추가, 외부 의존
6. **기능 6 (LINE 연동)** — 외부 의존·webhook, 알림 먼저 / 수신 나중

> 순서는 권장이며, 실제 착수 범위는 진행 시점에 재확인한다.
