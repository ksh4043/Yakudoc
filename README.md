# Yakudoc

영-일 비즈니스 서류 변환 및 영업 사무 자동화 SaaS

## 프로젝트 개요

영문 비즈니스 문서를 주고받아야 하는 일본 현지 영업 담당자를 위한 생산성 SaaS.
영문 문서를 입력하면 AI가 계약 리스크를 요약하고 회신 메일 초안을 자동 생성합니다.

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React |
| Backend | Node.js / Express |
| Database | PostgreSQL |
| AI | Gemini Flash (개발) / Anthropic 엔터프라이즈 (운영 예정) |
| 배포 | Docker |

## 주요 기능

- 거래처(업체) 등록 및 관리
- 영문 비즈니스 문서 분석 (텍스트 / 파일 / 이미지)
- AI 계약 리스크 요약
- 회신 메일 초안 자동 생성 (영문 / 일문)
- 분석 기록 업체 단위 관리
- 업체 단위 협업 기능

## 실행 방법

Docker Compose로 frontend(nginx) / backend / db 3개 컨테이너를 한 번에 기동합니다.

### 사전 준비

루트의 `.env.example`을 `.env`로 복사한 뒤 값을 채웁니다.

```bash
cp .env.example .env
```

| 키 | 설명 |
|----|------|
| `JWT_SECRET` | 임의의 긴 랜덤 문자열 |
| `JWT_REFRESH_SECRET` | 임의의 긴 랜덤 문자열 (위와 다른 값) |
| `GEMINI_API_KEY` | Google AI Studio에서 발급한 Gemini API 키 |
| `AI_PROVIDER` | 사용할 AI 제공자 (기본값 `gemini`) |

> `.env`는 `.gitignore`에 포함되어 있어 커밋되지 않습니다.

### 기동

```bash
docker compose up -d --build
```

- 접속: 프론트엔드 `http://localhost:8080` (nginx가 `/api` 요청을 backend로 프록시)
- 최초 기동 시 backend가 DB 마이그레이션을 자동 실행합니다 (멱등, 재실행 안전).

### 종료

```bash
docker compose down       # 컨테이너 중지·삭제
docker compose down -v    # DB 볼륨까지 삭제 (데이터 초기화)
```

## 아키텍처

### 컨테이너 구성 (same-origin 리버스 프록시)

```
[호스트 :8080] → frontend(nginx) ──/api, /health──> backend(:3000) ──> db(postgres:5432)
                     └── React 빌드 결과물(dist) 정적 서빙
```

- 단일 진입점은 프론트엔드 nginx(`:8080`). React 정적 자산을 서빙하고, `/api`·`/health`
  요청만 backend 컨테이너로 프록시한다.
- 브라우저 입장에서 프론트와 API가 동일 출처(same-origin)이므로 CORS·쿠키 이슈가 없다.
- `docker compose`로 frontend / backend / db 3컨테이너를 함께 기동하며, backend는
  `depends_on` + `healthcheck`로 db가 준비된 뒤에 시작한다.

### AI 서비스 레이어 추상화

AI 호출부를 `AIService` 인터페이스로 추상화하고, 환경변수 `AI_PROVIDER`로 구현체를 결정한다.

```
AIService (인터페이스)
  ├── GeminiService     (개발용, 현재 기본값)
  └── AnthropicService  (운영용, 교체 예정)
```

제공자 교체 시 환경변수만 변경하면 되며 비즈니스 로직은 수정하지 않는다.
AI 호출 실패 시 최대 2회 재시도 후에도 실패하면 해당 record의 status를 `failed`로 저장한다.

### 비동기 분석 흐름

```
POST /api/companies/:id/records  → record 생성(status: processing), 즉시 record_id 반환(202)
        ↓ (backend가 백그라운드로 AI 호출)
GET /api/records/:id  ← 클라이언트가 2초 간격 폴링
        ↓
status: processing → done 전이 시 결과(요약 → 리스크 → 메일 초안) 반환
```

### JWT 인증

- **Access Token**: 클라이언트 메모리(변수)에 저장, 만료 시 `/api/auth/refresh`로 재발급.
- **Refresh Token**: httpOnly 쿠키에 저장(JS 접근 불가), 만료 7일.
- **Rotation**: 재발급 때마다 새 Refresh Token으로 교체해 탈취 토큰의 재사용을 무효화한다.
- 모든 보호 라우트는 Auth 미들웨어에서 JWT를 검증하며, 관리자 전용 엔드포인트는 추가로 권한을 확인한다.