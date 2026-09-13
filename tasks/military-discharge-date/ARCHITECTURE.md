# ARCHITECTURE: 전역일 계산기

## 파일 구조

```text
src/calculators/military-discharge-date/
  policy.ts       유형별 정책 SSOT
  types.ts        입력·결과 타입
  logic.ts        순수 달력 계산
  validation.ts   문자열 입력 검증
  formatting.ts   날짜·기간 표시
  content.ts      FAQ/SEO 데이터
  ui.tsx          클라이언트 UI
  *.test.ts(x)    로직·검증·UI 테스트
```

## 결정

- 외부 날짜 라이브러리 없이 연·월·일 구조체와 UTC day serial을 사용한다.
- 정책 데이터와 계산 로직을 분리해 복무기간 변경 시 UI를 수정하지 않는다.
- 결과는 표준 종료일, 상태, D-day, 달력 기간, 진행률과 이정표를 한 번에 반환한다.
- 현재 날짜는 로직 내부에서 읽지 않고 UI가 `referenceDate`로 주입해 테스트를 결정적으로 만든다.
- 레지스트리에는 Builder 완료 시 draft로 등록하고 감사·QA 후 published로 전환한다.
