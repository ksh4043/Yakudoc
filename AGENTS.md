# AGENTS.md — Yakudoc (Codex 작업 지침)

이 파일은 Codex가 작업 전에 자동으로 읽는 프로젝트 지침이다.
Yakudoc의 고도화 개발은 이 지침과 아래 설계 문서를 준수해 진행한다.

## 0. 작업 시작 전 필독

작업을 시작하기 전에 **반드시** 아래 세 문서를 읽고, 읽었음을 알린 뒤 작업 지시를 기다린다.

1. `docs/yakudoc_architecture.md` — MVP 확정 설계 (DB / API / 화면 / 인증)
2. `docs/yakudoc_advanced_spec.md` — 고도화 설계 명세 (진행 대상)
3. `docs/yakudoc_harness.md` — 작업 하네스 규칙 (원본 규칙 문서)

> 고도화 기능의 상세는 `advanced_spec.md`에 있다. MVP 본문(`architecture.md` 4장 등)은
> 고도화로 신설되는 역할·화면을 반영하지 않으므로, 고도화 작업 근거는 `advanced_spec.md`를 우선한다.

---

## 1. 오작동 방지 규칙

### 설계 준수
- 설계 문서에 명시되지 않은 **테이블 / 컬럼 / 엔드포인트 / 역할 / 화면을 임의로 추가하지 않는다.**
- 설계와 다르게 구현해야 할 이유가 생기면, 문서나 코드를 임의로 고치지 말고 **사용자에게 즉시 보고하고 의사를 확인한 뒤** 진행한다.
- 고도화는 **문서 → 마이그레이션 → 코드** 순서를 지킨다 (advanced_spec 0-1).
- 예약 구조(`teams`, `users.team_id`, `records.owner_type`)는 새 구조를 만들기 전에 **먼저 활성화**한다.

### 수정 범위 제한
- 지시한 파일 외의 파일은 수정하지 않는다.
- 파일을 새로 생성할 때는 **생성 전에 목록을 먼저 보고**한다.
- 기존 파일을 삭제하거나 이름을 바꿀 때는 **반드시 승인**을 받는다.

### 무한 수정 루프 방지
- 동일한 에러가 **2회 이상 반복**되면 수정을 멈추고 에러 내용을 보고한다.
- 에러 해결 방향은 **제안만** 하고, 직접 수정은 승인 후에만 진행한다.

---

## 2. 예외 상황 대응

### 빌드 실패
- 에러 메시지 **전문을 먼저 출력**한다.
- 수정 방향을 제안하되 직접 수정은 승인 후에만 진행한다.

### AI / 외부 API 오류 (코드 구현 규칙)
- 호출 실패 시 **최대 2회까지만 재시도**하고, 재시도 간격은 **1초**로 한다.
- 2회 재시도 후에도 실패하면 해당 record의 `status`를 `failed`로 저장한다.
- 문서 파싱(기능 5), LINE 알림(기능 6) 등 외부 연동도 동일한 재시도 규칙을 따른다.

```javascript
const MAX_RETRY = 2;
let attempt = 0;
while (attempt <= MAX_RETRY) {
  try {
    const result = await callExternalApi(input);
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

### API 한도 초과(429)
- **재시도하지 않는다.** 수정을 멈추고 에러 내용을 보고한다.

### DB 연결 / Docker
- `docker-compose.yml`에서 backend는 db가 완전히 준비된 후 시작되도록 `depends_on` + `healthcheck`를 유지한다.

---

## 3. 품질 체크리스트

작업 완료 후 스스로 확인하고 결과를 보고한다.

### DB
- [ ] 모든 테이블에 `deleted_at`이 있는가 (순수 연결/불변 로그 테이블은 예외이며, 예외 근거를 문서에 명시했는가)
- [ ] 삭제가 `DELETE`가 아닌 `deleted_at` 갱신으로 처리되는가
- [ ] FK 참조가 올바른가
- [ ] 마이그레이션이 idempotent한가 (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`)

### 인증 / 권한
- [ ] Access Token은 메모리, Refresh Token은 httpOnly 쿠키인가
- [ ] 보호 라우트에 `authenticate`, 관리자 전용에 `requireAdmin`이 적용됐는가
- [ ] 팀 역할(`lead`) / owner / admin 권한 분기가 명세대로인가 (advanced_spec 1장)
- [ ] Refresh Token Rotation이 유지되는가

### API
- [ ] 응답이 명세(architecture 11장 / advanced_spec 각 절)와 일치하는가
- [ ] 공통 에러 응답 형식 `{ error: "..." }` 및 상태코드가 통일됐는가

### 외부 연동 / AI
- [ ] AI 호출이 `AIService` 인터페이스로 추상화됐는가 (env 전환 가능)
- [ ] 문서 파서 / 알림도 인터페이스로 추상화됐는가 (해당 기능 시)
- [ ] 재시도 제한(최대 2회)이 구현됐는가
- [ ] 업로드/파싱 원본을 저장하지 않는가 (원본 미저장 원칙)

---

## 4. 보고 형식

작업 완료:
```
[완료] 작업명
- 생성/수정한 파일 목록
- 품질 체크리스트 결과 (통과 / 미통과)
- 미통과 항목이 있다면 이유와 제안 방향
```

에러 발생:
```
[에러] 발생 위치
- 에러 메시지 전문
- 시도한 횟수
- 제안하는 해결 방향 (수정은 승인 후 진행)
```
