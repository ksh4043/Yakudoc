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

추후 작성 예정