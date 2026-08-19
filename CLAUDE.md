# CLAUDE.md

> 이 문서는 Claude가 **새 세션을 시작할 때마다** 이 프로젝트의 방향을 빠르게 파악하기 위한 것이다.
> 개요·목적·타겟·스택 등 핵심만 간략히 담고, 상세 규칙(품질 체크리스트·재시도 규칙·보고 형식 등)은
> Codex용 `AGENTS.md`와 `docs/`의 각 설계 문서에 위임한다. 아래 내용이 그 문서들과 일부 겹치더라도
> 그건 중복이 아니라 — 여기서는 "무엇을·왜"를, 그쪽에서는 "어떻게"를 다루는 역할 분리다.

## 프로젝트 개요

Yakudoc — 영-일 비즈니스 서류 변환 및 영업 사무 자동화 SaaS. 영문 비즈니스 문서를 주고받는
일본 현지 영업 담당자를 위한 생산성 유틸리티. AI 계약 리스크 요약 + 회신 메일 초안 생성이
핵심 기능이며, 업체 단위로 기록을 관리한다. 일본 IT 취업 시장 진출용 포트폴리오 프로젝트.

## 기술 스택

- 프론트엔드: React 19 (Vite, Tailwind CSS v4, shadcn/radix-ui, TanStack Query, React Router)
- 백엔드: Node.js (Express)
- 데이터베이스: PostgreSQL (`pg`)
- 인증: JWT (Access Token 메모리 / Refresh Token httpOnly 쿠키, `jsonwebtoken` + `bcrypt`)
- AI: 인터페이스로 추상화 — 개발은 Gemini Flash, 운영은 Anthropic/OpenAI로 교체 예정
- 배포: Docker (`docker-compose.yml` — db / backend / frontend 3-container)

## 실행 명령어

```bash
# backend/
npm run dev        # nodemon 개발 서버
npm start           # 프로덕션 실행
npm run migrate     # DB 마이그레이션 (backend/src/db/migrate.js, idempotent 단일 블록)
npm run seed         # 시드 데이터

# frontend/
npm run dev          # Vite 개발 서버
npm run build        # 빌드
npm run lint          # oxlint
npm run preview       # 빌드 결과 프리뷰

# 루트
docker compose up    # db + backend + frontend 전체 기동
```

## 코딩 컨벤션

- 백엔드는 `controllers/` → `routes/` → `services/` 레이어로 분리, AI 호출은 `services/aiService.js`에서
  인터페이스로 추상화(env로 구현체 전환). `services/ai/`는 비어있는 예약 폴더로, 현재 실사용되지 않음
- 프론트는 `pages/`(화면), `components/`(공용 위젯, `components/ui/`는 shadcn 생성분),
  `contexts/`(전역 상태), `lib/`(api 클라이언트·유틸)로 분리
- 백엔드 파일명은 camelCase(`aiService.js`), 프론트 컴포넌트/페이지 파일명은 PascalCase
  (`CompanyDetailPage.jsx`), `lib/`은 camelCase(`api.js`, `utils.js`)
- 보호 라우트는 `authenticate` 미들웨어, 관리자 전용은 `requireAdmin` 적용
- 모든 테이블에 `deleted_at` 적용, 삭제는 `DELETE` 대신 `deleted_at` 갱신(순수 연결/불변 로그
  테이블은 예외이며 예외 근거를 문서에 명시)

## 프로젝트 구조

- `backend/src/controllers/` — 라우트 핸들러
- `backend/src/routes/` — 라우트 정의
- `backend/src/services/` — AI 서비스 등 외부 연동 추상화
- `backend/src/middleware/` — 인증 등 미들웨어
- `backend/src/db/` — `migrate.js`(단일 idempotent 블록), `seed.js`, `pool.js`
- `frontend/src/pages/` — 화면 단위 컴포넌트
- `frontend/src/components/` — 공용 위젯 (`ui/`는 shadcn)
- `frontend/src/contexts/` — 전역 상태(Auth 등)
- `frontend/src/lib/` — API 클라이언트, 유틸
- `docs/` — 설계 문서 (아래 참조)

## 인프라/구성 규칙

- `docker-compose.yml`에서 backend는 db가 완전히 준비된 후 시작되도록 `depends_on` +
  `healthcheck`를 반드시 포함할 것

## 상세 문서 참조

- MVP 확정 설계(DB/API/화면/인증): `docs/yakudoc_architecture.md`
- 고도화 설계 명세: `docs/yakudoc_advanced_spec.md`
- 작업 하네스 규칙(원본): `docs/yakudoc_harness.md`
- Codex 작업 프롬프트 규격: `docs/yakudoc_prompt_template.md`
- Codex용 상세 지침(품질 체크리스트·재시도·보고 형식): `AGENTS.md`

## 하지 말아야 할 것

- 설계 문서에 명시되지 않은 테이블 / 컬럼 / 엔드포인트 / 역할 / 화면을 임의로 추가하지 말 것
- 예약 구조(`teams`, `users.team_id`, `records.owner_type`)가 있는데 새 구조를 임의로 만들지 말 것
- 업로드 문서/파싱 결과 원본을 저장하지 말 것 (결과 데이터만 보존 — 원본 미저장 원칙)
- AI 호출 실패 시 3회 이상 재시도하지 말 것 (최대 2회, 1초 간격)
- API 한도 초과(429) 시 재시도하지 말 것

---

## 작업 시작 전

`docs/` 아래의 **모든 파일**을 읽을 것. 파일이 추가/변경될 수 있으므로 목록을 가정하지 말고
매번 실제 디렉터리를 확인해 전부 읽을 것.

읽은 후 읽었음을 알리고 작업 지시를 기다릴 것.

## 내 역할

직접 코딩하지 않는다. Codex 작업 에이전트에게 넘길 **작업 프롬프트를 작성**하고, 그 결과를
**독립 검증**한다. (규격: `docs/yakudoc_prompt_template.md`)

작업 프롬프트는 **파일로 만들지 않는다.** 채팅에 코드블록으로 전문을 출력한다.
저장소에도, 임시 폴더에도 만들지 않는다.

## 지시 없이 하지 않을 것

아래는 사용자가 명시적으로 지시했을 때만 한다. 필요해 보인다는 판단만으로 하지 않는다.

- **파일 생성.** 임시 파일·스크래치 파일 포함.
- **설계 문서 수정.** 설계 변경이 필요하면 문안을 제시하고 지시를 기다린다.
- **메모리 저장.** 세션 메모리에 저장하지 않는다.

판단이 필요한 지점이 생기면 임의로 메우지 말고 **보고하고 확인받는다.**

## 커밋

커밋은 **내가 직접 실행**한다(사용자가 직접 하지 않는다). 단, **진행점마다 자동으로 커밋하지 않는다.**
사용자가 커밋하라고 지시하거나, 내가 타이밍을 물어 확인받은 뒤에만 커밋한다.

- 백엔드/프론트엔드는 커밋을 **나눠서** 한다.
- 저장소 스타일을 따른다: Conventional Commits, 영어, 소문자 명령형, 한 줄.
- `Co-Authored-By` 라인은 붙이지 않는다.
- 커밋한 뒤에는 **항상 곧바로 push 한다.** 커밋만 하고 남겨두지 않는다.

## 설계 변경 워크플로우

설계 자체가 바뀔 때는 **문서 → 마이그레이션 → 코드** 순서를 지킨다.
문서 수정안은 제시하고 지시를 받은 뒤에 반영한다.
