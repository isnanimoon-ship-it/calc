# ARCHITECTURE: 4대 보험 계산기

Architect 구조 결정 메모. 승인된 `SPEC.md`와 `FORMULA.md` 기준. 작성일 2026-09-04.
이 문서는 공식을 바꾸지 않고 코드 배치, 타입, 데이터 경계와 UI 구조를 확정한다.

## 1. 숫자 정밀도 전략

- 일반 `Number`를 사용하되 **모든 금액과 요율 계산은 정수 연산**으로 구현한다.
- 요율을 `0.0475`처럼 직접 곱하지 않는다. 정책 데이터에는 사람이 읽기 위한 소수값과 함께
  계산용 정수 `numerator`·`denominator`를 둔다.
- `multiplyRateAndTruncate10Won(amount, rate)` 공용 지역 함수를 `logic.ts`에 한 번만 둔다.
- 월 급여 상한 10억 원에서 가장 큰 중간 곱 `1,000,000,000 × 9,448`도 약 9.4조로
  `Number.MAX_SAFE_INTEGER` 약 9,007조보다 충분히 작다.
- `BigInt`는 JSON 데이터 및 UI 숫자와의 변환 비용이 크고 이 범위에서 필요하지 않다.
- `decimal.js` 같은 추가 의존성도 필요하지 않다.
- 보험별 10원 미만 절사는 계산 로직에서 확정해 반환한다. 표시 계층은 다시 반올림하지 않는다.

## 2. 정책 데이터 구조

- 위치: `src/data/rates-2026.json` 최상위 `socialInsurance`
- 다른 계산기도 사회보험 요율을 사용할 수 있으므로 계산기 전용 이름 대신 공용 이름을 쓴다.
- `effectiveFrom`과 `effectiveTo`를 둬 국민연금 상·하한의 7월 변경을 숨기지 않는다.
- 각 요율은 `{ value, numerator, denominator, unit, source, lastVerified, nextReviewDue }` 구조다.
- Builder는 `value`를 계산에 사용하지 않고 `numerator / denominator` 정수 분수를 사용한다.
- 산재보험 평균요율은 안내 데이터로만 저장하며 `calculationSupported: false`로 명시한다.

## 3. 폴더 구조

```text
src/calculators/four-major-insurance/
  types.ts        # 이번 Architect 단계에서 확정
  logic.ts        # Builder가 순수 계산 함수 구현
  logic.test.ts   # Golden Test 12개 + 경계값
  validation.ts   # 원시 폼 입력 검증
  validation.test.ts
  formatting.ts   # 원화·요율 표시만 담당
  ui.tsx          # 클라이언트 폼과 결과 화면
  ui.test.tsx
  content.ts      # 소개·사용법·FAQ의 화면/JSON-LD 공용 원본
```

`content.ts`는 클라이언트 컴포넌트를 import하지 않는 순수 데이터 모듈로 만들어 동적 페이지의
FAQ JSON-LD와 화면이 같은 질문·답변을 사용하도록 한다.

## 4. 타입 결정

- 가입 선택은 보험별 boolean 세 개로 유지한다. 배열이나 임의 문자열보다 폼과 결과의 관계가
  명확하고 잘못된 보험 키가 들어올 수 없다.
- 장기요양보험 선택 필드는 만들지 않는다. 건강보험 선택값에 종속시킨다.
- 사업장 규모는 닫힌 유니온 `EmploymentBusinessRateTier`로 제한한다.
- 보험별 결과는 공통 `InsuranceContribution` 타입을 사용한다.
- 계산 제외 이유는 `disabled | linkedToHealth | industryRateRequired` 유니온으로 제한한다.
- 결과에 적용 연도·기간과 상하한 적용 플래그를 포함해 UI가 정책을 재계산하지 않게 한다.

## 5. UI 구조

- 기존 계산기와 같은 디자인 토큰 및 `SectionCard`, `UsageGuide`, `IntroSection`,
  `FaqAccordion`을 재사용한다.
- 첫 화면 순서: 제목 → 입력 → 핵심 근로자 공제 합계 → 보험별 상세 → 사업주 부담 → 안내.
- 입력은 `월 급여`, `비과세 금액`, `가입 보험`, `사업장 규모` 순서다.
- 사업장 규모는 사업주 부담액에만 영향을 준다는 설명을 선택 필드 바로 아래 표시한다.
- 핵심 카드에는 `월 4대 보험 공제액`과 `4대 보험 공제 후 금액`을 함께 표시한다.
- 결과 표는 보험명·산정 기준·근로자·사업주 네 열이며 모바일에서는 보험별 카드 행으로 접는다.
- 산재보험 행은 금액 대신 `업종별 요율 필요`를 표시하고 합계 제외 사실을 명시한다.
- 가입 해제 항목은 숨기지 않고 `미가입으로 설정` 상태를 표시한다.

## 6. 계산기 등록 전략

- Architect 단계에서는 레지스트리에 등록하지 않는다. 빈 URL이 노출되는 것을 피한다.
- Builder가 UI 구현을 완료할 때 `registry.ts`에 `status: "draft"`로 등록하고
  `calculator-components.ts`에 화면을 함께 연결한다.
- 아이콘은 기존 유니온의 `heart`를 사용한다.
- Calculation Auditor·UX Critic·QA 통과 전에는 `published`로 바꾸지 않는다.

## 7. Builder 인수인계

1. `logic.ts`: FORMULA의 계산 순서를 그대로 구현하고 정책 데이터만 읽는다.
2. `validation.ts`: 월 급여·비과세 금액과 enum을 검증한다.
3. `logic.test.ts`: FORMULA 예제 12개와 건강보험 상·하한 경계를 추가한다.
4. `formatting.ts`: 이미 확정된 정수 보험료를 `Intl.NumberFormat("ko-KR")`로 표시한다.
5. `content.ts`, `ui.tsx`, `ui.test.tsx`: 화면·FAQ·상호작용 구현.
6. 레지스트리와 컴포넌트 매핑을 draft로 연결한다.
7. 구현 전에 공식 모의계산기로 건강보험·장기요양·고용보험 단수 처리 순서를 재확인한다.

