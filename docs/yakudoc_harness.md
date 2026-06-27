# Yakudoc — Cline 작업 하네스 가이드

## 1. 에이전트 오작동 방지 규칙

### 설계 준수
- 작업 시작 전 반드시 `yakudoc_architecture.md`를 읽고 설계를 따를 것
- 문서에 명시되지 않은 테이블, 컬럼, 엔드포인트를 임의로 추가하지 말 것
- 설계와 다르게 구현해야 할 이유가 생기면 수정하기 전에 반드시 보고할 것

### 수정 범위 제한
- 지시한 파일 외의 파일은 수정하지 말 것
- 파일을 새로 생성할 때는 생성 전에 목록을 먼저 보고할 것
- 기존 파일을 삭제하거나 이름을 바꿀 때는 반드시 승인을 받을 것

### 무한 수정 루프 방지
- 동일한 에러가 2회 이상 반복되면 수정을 멈추고 에러 내용을 보고할 것
- 에러 해결 방향은 제안만 하고, 직접 수정은 승인 후에만 진행할 것

---

## 2. 예외 상황 대응 규칙

### 빌드 실패
- 빌드 에러 발생 시 에러 메시지 전문을 먼저 출력할 것
- 수정 방향을 제안하되 직접 수정은 승인 후에만 진행할 것

### AI API 오류 (코드 구현 규칙)
- AI API 호출 실패 시 최대 2회까지만 재시도할 것
- 2회 재시도 후에도 실패하면 해당 record의 status를 `failed`로 저장할 것
- 재시도 간격은 1초로 설정할 것

```javascript
// AI API 호출 구현 예시
const MAX_RETRY = 2;
let attempt = 0;
while (attempt <= MAX_RETRY) {
  try {
    const result = await callAIApi(prompt);
    await saveResult(recordId, result);
    await updateStatus(recordId, 'done');
    break;
  } catch (err) {
    attempt++;
    if (attempt > MAX_RETRY) {
      await updateStatus(recordId, 'failed');
    } else {
      await sleep(1000);
    }
  }
}
```

### DB 연결 문제 (Docker 구성 규칙)
- `docker-compose.yml`에서 backend는 db가 완전히 준비된 후 시작되도록 설정할 것
- `depends_on`과 `healthcheck`를 반드시 포함할 것

```yaml
# docker-compose.yml 필수 포함 항목
services:
  db:
    image: postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    depends_on:
      db:
        condition: service_healthy
```

---

## 3. 품질 체크리스트

작업 완료 후 아래 항목을 스스로 확인하고 결과를 보고할 것.

### DB 관련
- [ ] 모든 테이블에 `deleted_at` 컬럼이 있는가
- [ ] 삭제 쿼리가 `DELETE` 대신 `deleted_at` 업데이트로 처리되는가
- [ ] FK 참조가 모두 올바르게 연결되어 있는가
- [ ] `users` 테이블에 `status` 컬럼이 있는가

### 인증 관련
- [ ] Access Token이 localStorage가 아닌 메모리에 저장되는가
- [ ] Refresh Token이 httpOnly 쿠키로 처리되는가
- [ ] 모든 보호 라우터에 Auth 미들웨어가 적용되어 있는가
- [ ] Refresh Token Rotation이 구현되어 있는가

### API 관련
- [ ] 모든 응답이 API 명세(`yakudoc_architecture.md 11섹션`)와 일치하는가
- [ ] 공통 에러 응답 형식이 통일되어 있는가 `{ error: "..." }`
- [ ] 관리자 전용 엔드포인트에 권한 체크가 적용되어 있는가

### AI 서비스 관련
- [ ] AI 호출이 `AIService` 인터페이스를 통해 추상화되어 있는가
- [ ] 환경변수로 Gemini / Anthropic 전환이 가능한가
- [ ] 재시도 횟수 제한(최대 2회)이 구현되어 있는가

---

## 4. 보고 형식

작업 완료 시 아래 형식으로 보고할 것.

```
[완료] 작업명
- 생성/수정한 파일 목록
- 품질 체크리스트 결과 (통과 / 미통과 항목)
- 미통과 항목이 있다면 이유와 제안 방향
```

에러 발생 시 아래 형식으로 보고할 것.

```
[에러] 발생 위치
- 에러 메시지 전문
- 시도한 횟수
- 제안하는 해결 방향 (수정은 승인 후 진행)
```
API 한도 초과(429 에러) 발생 시
수정을 멈추고 에러 내용을 보고할 것.
재시도하지 말 것.