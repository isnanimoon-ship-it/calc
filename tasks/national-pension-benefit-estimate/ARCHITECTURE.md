# ARCHITECTURE: 국민연금 예상수령액 계산기 (national-pension-benefit-estimate)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-13.
계산 공식 자체는 정의하지 않는다(Formula Analyst 소관 — 비례상수·A값·가입기간 보정·조기/연기
조정 산식과 반올림 정책을 바꾸지 않았다). 여기서는 코드 배치, 타입, 정책 데이터 스키마 반영,
숫자 정밀도 자료형, 입력 검증 로직 설계, UI 구조만 정한다.

관련 문서: docs/ARCHITECTURE.md, docs/CALCULATOR_RULES.md, docs/DESIGN_SYSTEM.md.
참고 선례: `tasks/unemployment-benefit/ARCHITECTURE.md`·`src/calculators/unemployment-benefit/`
(정책 데이터 `rows` 배열 조회 패턴, `eligible` discriminated union), `tasks/severance-pay`
(`SeverancePayIneligibleResult` "지급대상 아님" 패턴), `tasks/d-day-calculator/ARCHITECTURE.md`·
`tasks/average-cost-calculator/ARCHITECTURE.md`(문서 형식, "분기로 충분 vs 파일 분할" 판단
기준 재적용), `tasks/loan-interest-calculator/ARCHITECTURE.md`(그 판단 기준의 최초 정의),
`docs/ARCHITECTURE.md` "결정 사례: 정책 데이터를 언제 계산기 전용 policy.ts에 두는가".

이 계산기는 이 프로젝트에서 **법령 의존도가 가장 높고, FORMULA.md 스스로 "published 전환
전 라이브 계산기 대조가 반드시 필요하다"는 명시적 게이트를 건 최초의 계산기**다. 아래 "1."이
이 문서에서 가장 먼저, 가장 눈에 띄게 다뤄야 하는 내용이다.

---

## 0. 레지스트리 상태 확인

`src/calculators/registry.ts` 확인 결과 `national-pension-benefit-estimate` slug는 등록되어
있지 않다("국민연금", "연금", "노령연금" 이름의 계산기도 없음 — SPEC.md "계산기 중복 금지
체크"와 일치). 이번 Architect 라운드에서도 등록하지 않는다(기존 관례 — 아래 "14." 참고).

`PROGRESS.md`의 `national-pension-benefit-estimate` 행 "Formula" 컬럼이 `TODO`로 남아
있었는데, FORMULA.md는 이미 기준/공식/15개 Golden Test/"기준·출처" 스키마까지 전부 채워
완료된 상태였다(Formula Analyst 단계가 실제로는 끝나 있었다) — d-day-calculator·
average-cost-calculator Architect 라운드와 동일하게 `TODO` → `PASS`로 갱신했다(아래 "15."
참고, Formula Analyst의 실제 산식·수치는 전혀 바꾸지 않았다). "다음 재검토 예정일" 컬럼도
FORMULA.md "기준/출처"가 확정한 두 개의 서로 다른 재검토일(A값 2026-12-01, 비례상수 등
2027-01-01)로 갱신했다.

이번 라운드에서 실제로 만든/수정한 파일:
- `src/data/rates-2026.json`: `nationalPensionBenefit` 네임스페이스 신규 추가(아래 "2.").
- `src/calculators/national-pension-benefit-estimate/types.ts`: 신규 작성(아래 "11.").
- `PROGRESS.md`: 위 갱신.
- 이 문서.

`logic.ts` 등 실제 계산 코드는 아직 없다(Builder 몫).

---

## 1. PUBLISHED 전환 게이트 (최우선 — 모든 후속 역할이 반드시 인지)

> **이 계산기는 Calculation Auditor의 라이브 계산기 대조(÷12 검증)가 완료되기 전까지
> `registry.ts`의 `status`를 `"published"`로 바꾸지 않는다.** 이는 FORMULA.md가 "확인
> 필요 목록" 1번에서 명시적으로 건 게이트이며(FORMULA.md: "이 항목이 해소되기 전에는 이
> 계산기를 published 상태로 전환하지 않는다(SPEC.md 완료 기준과 일치)"), SPEC.md "완료
> 기준"("계산 정확성 감사, UX 검토, QA를 모두 통과하고 총점 기준을 만족한 뒤에만 레지스트리
> 상태를 published로 변경한다")과도 정확히 일치한다. Architect는 이 게이트를 완화하거나
> 해제할 권한이 없다 — 다음 두 조건이 **모두** 충족된 뒤에만 Calculation Auditor가 이
> 게이트를 해소할 수 있다.
>
> 1. nps.or.kr(또는 work24.go.kr류 정부 라이브 계산기)에 FORMULA.md 검증 예제(예제 2~9 중
>    최소 1개 이상)와 동일한 입력을 실제로 넣어 결과를 대조하고, 그 결과가 이 문서/FORMULA.md
>    산식(특히 `÷12` 단계)과 일치함을 확인한다.
>    (`docs/CALCULATOR_RULES.md` "Golden Test" — "공식 계산기 예시값과 대조한 케이스 최소
>    2개" 요건 중 FORMULA.md는 예제 1(독립 재무 콘텐츠 벤치마크) 1건만 확보했고 나머지
>    1건이 이 라이브 대조다.)
> 2. 원 단위 반올림/절사 방향(FORMULA.md "확인 필요" 3번, 잠정 round half up)과 20년 미만
>    비례 감액의 정확한 조문 위치(FORMULA.md "확인 필요" 2번)에 실질적 오류가 없는지
>    Calculation Auditor가 재확인한다.
>
> **왜 이 게이트가 유독 중요한가**: FORMULA.md 자신이 "이 계산기는 공식(수식) 자체의
> 단위/스케일 오류 위험이 매우 큰 계산기"라고 경고하며, `÷12`를 빠뜨리면 월 연금액이
> **12배 부풀려진다**(예: 정답 월 100만원 vs 오류 시 월 1,200만원)는 구체적 실패 모드까지
> 제시했다. 이는 "값이 조금 틀리는" 수준이 아니라 "자릿수 자체가 명백히 비상식적으로
> 틀어지는" 등급의 위험이라, 이 사이트의 다른 정책형 계산기들이 거친 통상적인 Calculation
> Auditor 검증(법령 조문 재대조)만으로는 부족하고 **반드시 실제 계산기 호출 대조**가
> 필요하다고 Formula Analyst가 명시적으로 요청했다.
>
> **Builder/Auditor 인수인계 체크리스트에 반드시 포함할 것**(아래 "16.", "17."에서 재강조):
> - [ ] Builder는 `logic.ts` 구현 완료 시 이 게이트가 아직 해소되지 않았음을 PROGRESS.md/
>   작업 로그에 명시적으로 남긴다(구현 완료 ≠ published 가능).
> - [ ] Calculation Auditor는 이 게이트를 최우선 항목으로 처리하고, 대조에 성공하든
>   실패하든(대조 자체가 불가능한 환경이라도) 그 결과를 EVALUATION.md에 구체적으로 기록한다.
> - [ ] 이 게이트가 해소되지 않은 채로는 UX/UI Critic·QA가 통과 판정을 내려도 최종 `status`는
>   `"draft"`로 유지한다.

---

## 2. 정책 데이터 배치 — `rates-2026.json`에 `nationalPensionBenefit` 신설 (완료)

### 2.1 결정: FORMULA.md가 제시한 스키마를 그대로 채택한다

FORMULA.md "정책 데이터 분리 요구사항"이 이미 `docs/CALCULATOR_RULES.md`의
`value`/`unit`/`source{law,article,effectiveDate,url}`/`lastVerified`/`nextReviewDue`
스키마를 정확히 따르는 완전한 JSON을 제시했고, 이 스키마는 `rates-2026.json`의 기존
`unemploymentBenefit`/`socialInsurance` 네임스페이스가 이미 쓰는 형태와 필드명까지 완전히
동일하다 — 조정할 필요가 없었다. `standardMonthlyIncomeMin`/`Max`는 FORMULA.md 지시대로
신규 생성하지 않고 기존 `socialInsurance.nationalPension.standardMonthlyIncomeMin/Max`
(410,000원/6,590,000원, 2026-07-01 적용)를 그대로 참조한다.

**이미 이번 라운드에서 `src/data/rates-2026.json`에 반영을 완료했다**(`nationalPensionBenefit`
키를 최상위에 추가, 기존 `socialInsurance` 블록 뒤에 append). `npx tsc --noEmit`과 전체
테스트 스위트(`npx vitest run`, 74개 파일 922개 테스트)를 재실행해 기존 계산기 15종에
회귀가 없음을 확인했다(아래 "15." 참고) — `weekly-holiday-allowance`의 `laborStandards`
신설 라운드가 세운 "공유 파일에 새 최상위 키를 추가하는 것은 순수 additive라 빌드·테스트로
안전성을 확인할 수 있다"는 선례를 그대로 따랐다.

### 2.2 왜 계산기 전용 `policy.ts`가 아니라 `rates-2026.json`인가

`docs/ARCHITECTURE.md` "결정 사례: 정책 데이터를 언제 계산기 전용 `policy.ts`에 두는가"의
1차 판단 기준("이 값을 다른 계산기가 재사용할 근거가 실제로 있는가")만 문자 그대로 적용하면
이 데이터(A값·비례상수·수급개시연령 스케줄 등)를 재사용하는 다른 계산기가 현재 없으므로
`policy.ts`로 보일 수 있다. 그럼에도 `rates-2026.json`을 선택한 이유는 그 결정 사례가 제시한
**두 번째 기준**("연도별 파일 분리가 적합한가")이 이 경우에는 명확히 "그렇다"이기 때문이다.

- **A값은 실제로 연 1회(매년 12월) 갱신되는, `rates-{year}.json`이라는 "연도" 축 자체가
  의미를 갖는 값이다** — 최저임금(`minimumWage`, 매년 1월)·기준소득월액 상하한(매년 7월)과
  정확히 같은 성격("연도별로 고시가 바뀌는 수치")이다. 「주택공급에 관한 규칙」(수시 개정,
  housing-subscription-score가 `policy.ts`를 택한 핵심 근거)처럼 "연도 축으로 나누는 것
  자체가 어색한" 정책이 아니다.
- **`standardMonthlyIncomeMin`/`Max`를 이미 같은 파일(`rates-2026.json`)에서 재사용해야
  한다.** 이 값이 `nationalPensionBenefit`이 아니라 계산기 전용 `policy.ts`에 있었다면,
  `policy.ts`가 `rates-2026.json`을 import해 필드를 다시 참조하는 교차 파일 의존이
  생겼을 것이다 — 같은 파일 안에 두면 이 의존이 아예 필요 없어진다(교차 파일 참조보다
  단일 파일 내 참조가 더 단순하고 드리프트 위험이 적다).
- **`unemploymentBenefit` 네임스페이스가 이미 "단일 계산기 전용이지만 `rates-{year}.json`에
  둔" 선례다.** `benefitDaysTable`(고용보험법 별표1 소정급여일수 표)도 오직
  unemployment-benefit 하나만 쓰는 데이터이지만 `rates-2026.json`에 있다 — 이유는 그 값
  역시 "연도별 갱신 대상"이라는 성격을 갖기 때문이다(최저임금 연동 최저구직급여일액 등). 이
  계산기도 같은 논리를 그대로 적용한다.

정리하면: "재사용 여부"와 "연도 축 적합성" 두 기준이 갈릴 때는 후자를 우선한다 — 이는
`docs/ARCHITECTURE.md` 결정 사례가 이미 "연도별 파일 분리가 적합하지 않은 정책만 `policy.ts`를
쓴다"고 서술한 것과 일관된 해석이다(부정 조건이 성립하지 않으면 기본값인 `rates-{year}.json`을
쓴다).

### 2.3 TypeScript 타입 파생 — Builder 안내

`types.ts`에는 `rates2026`을 import하지 않는다(위 "11." 및 unemployment-benefit의
기존 관례 — `types.ts`는 순수 도메인 타입만, JSON 구조 파생 타입은 `logic.ts` 로컬).
`logic.ts`는 다음과 같이 `unemployment-benefit/logic.ts`와 동일한 패턴으로 타입을 파생한다:

```ts
import rates2026 from "@/src/data/rates-2026.json";

type NationalPensionBenefitRates = (typeof rates2026)["nationalPensionBenefit"];
type PensionableAgeScheduleRow =
  NationalPensionBenefitRates["pensionableAgeSchedule"]["rows"][number];
```

**이 계산기는 `unemployment-benefit`과 달리 "연도별 rates 파일 선택"(`RATES_BY_YEAR` 맵,
`year` 파라미터)이 필요 없다.** unemployment-benefit은 `leaveDate`(과거일 수 있는 사용자
입력 날짜)에 따라 어느 연도 rates를 적용할지가 달라질 수 있었지만, 이 계산기는 SPEC.md가
이미 "계산 시점(오늘) 기준 최신 고시치를 그대로 사용하는 현재가치 추정치"로 범위를
확정했다 — 즉 항상 "지금 배포된 rates 파일 하나"만 쓴다. 이는 `four-major-insurance/logic.ts`가
`rates2026`을 모듈 최상단에서 바로 import해 쓰는 패턴과 같다 — Builder는 `year` 파라미터나
`RATES_BY_YEAR` 맵을 새로 만들지 않는다(불필요한 복잡도 추가 금지).

### 2.4 `pensionableAgeSchedule.rows`의 첫 행 표현 — FORMULA.md 예시와의 구조적 차이(값은 동일)

FORMULA.md가 제시한 JSON 예시는 첫 행에서 `birthYearMin` 키 자체를 생략했다
(`{ "birthYearMax": 1952, "age": 60 }`). 실제로 반영한 `rates-2026.json`은 이 행에
`"birthYearMin": null`을 **명시적으로** 채워 넣었다(값은 동일 — "1952년 이하 전부"라는
의미가 전혀 바뀌지 않는다). 이는 계산 수치가 아니라 순수 타입 스키마 판단으로, 모든 행이
`{ birthYearMin: number | null; birthYearMax: number | null; age: number }`라는 하나의
균일한 shape을 갖게 해 TypeScript 타입과 아래 "3."의 조회 함수 구현을 더 단순하게 만든다
(옵셔널 키 유무를 분기하지 않고 항상 `row.birthYearMin ?? -Infinity` 형태로 통일 처리 가능).
Formula Analyst가 확정한 값(경계 연도·나이)은 전혀 건드리지 않았다.

---

## 3. 수급개시연령 스케줄 조회 — 순차 탐색 로컬 함수로 충분 (별도 유틸 불필요)

FORMULA.md "6. 수급개시연령 스케줄"은 6개 행뿐인 정적 테이블이고, `unemployment-benefit`이
이미 구조적으로 동일한 문제(연속 구간 배열에서 값 하나를 판정, `insuredYearsMin`/
`insuredYearsMax`, `null`은 무제한)를 `determineInsuredPeriodBand`라는 순차 탐색(`for` 루프)
함수 하나로 풀어 뒀다(`src/calculators/unemployment-benefit/logic.ts`). 이 계산기도 **완전히
같은 패턴**을 재사용한다 — 새 유틸을 만들거나 `src/lib/`로 승격할 이유가 없다(행이 6개뿐이고
이 계산기 하나만 이 구조를 쓴다 — "아직 사례가 1개뿐이면 승격하지 않는다"는 반복 원칙과도
일치).

```ts
// src/calculators/national-pension-benefit-estimate/logic.ts (Builder 작성 예정, 시그니처만 확정)

/** 6개 행을 순서대로 순회하며 birthYear가 속하는 첫 구간을 반환한다. rows는 항상 전체
 *  정수 범위를 빠짐없이 커버하도록 구성돼 있으므로(첫 행 하한 -Infinity, 마지막 행 상한
 *  +Infinity) 매치 실패는 일어나지 않는다 — 다만 방어적으로 매치 실패 시 에러를 던진다. */
export function findPensionableAgeRow(
  birthYear: number,
  rows: readonly PensionableAgeScheduleRow[],
): PensionableAgeScheduleRow {
  for (const row of rows) {
    const min = row.birthYearMin ?? -Infinity;
    const max = row.birthYearMax ?? Infinity;
    if (birthYear >= min && birthYear <= max) return row;
  }
  throw new Error(`pensionableAgeSchedule에 birthYear=${birthYear}를 커버하는 구간이 없습니다.`);
}
```

- `unemployment-benefit`의 `null` 처리 관례(`row.insuredYearsMax === null ? Infinity : ...`)를
  그대로 따르되, 이 계산기는 첫 행에도 `birthYearMin: null`(위 "2.4")이 있어 `??`
  연산자로 최솟값·최댓값 양쪽을 대칭적으로 처리할 수 있다(unemployment-benefit보다 약간 더
  단순한 형태).
- FORMULA.md "예외 > 출생연도가 1952년 이하"는 별도 분기 코드가 필요 없다 — 첫 행이 이미
  이 조건을 정확히 표현하므로 이 함수 하나로 자동 처리된다.
- 이 함수는 `eligible` 판정과 무관하게 항상 호출된다(FORMULA.md "계산 순서" 2번) — 아래
  "5."의 `calculateNationalPensionBenefit` 오케스트레이터가 최소 가입기간 판정보다 먼저
  이 함수를 호출한다.

---

## 4. 숫자 정밀도 전략 — 일반 `Number`로 충분 (Architect 재검증, FORMULA.md 판단에 동의)

FORMULA.md "정밀도/반올림 정책"은 "JS `Number`로 충분하다 — 이 계산기가 다루는 금액 범위(수백만원
이하)는 안전 정수 범위에 전혀 근접하지 않는다"고 결론 냈다. 다른 계산기 Architect 라운드가
반복해 온 방법론(Formula Analyst의 "충분하다" 의견을 그대로 받지 않고 최악 조합을 직접
재계산)을 그대로 적용해 이 판단을 재검증한다.

**최악 조합 직접 계산** — 이 계산기가 실제로 승인하는 입력 범위 안에서 가장 큰 중간값을
만드는 조합을 구성한다:
- `bValueApprox` 최대값 = 기준소득월액 상한(clamp 후) = 6,590,000원.
- `aValue` = 3,193,511원(고정, 매년 소폭 변동하지만 자릿수 자체는 변하지 않음).
- `factor` 최대값 = 아래 "7."에서 확정하는 `totalContributionMonths` 상한(624개월, 52년) 기준
  `1 + 0.05×(624-240)/12 = 1 + 1.6 = 2.6`. (참고: 입력 검증 상한을 무시하고 극단적으로 비현실적인
  값, 예: 100,000개월(약 8,333년)을 넣어도 `factor ≈ 1+0.05×99,760/12 ≈ 416.8`이고
  `bracket ≈ 1.29×9,783,511×416.8 ≈ 52.6억` 수준으로, `Number.MAX_SAFE_INTEGER`
  (약 9.007×10^15)까지는 여전히 압도적으로 여유가 있다 — validation.ts의 상한 검증이
  없더라도 이 계산기 자체가 부정확한 값을 낼 위험은 없다.)
- `bracket = proportionalConstant × (aValue + bValueApprox) × factor
  = 1.29 × (3,193,511 + 6,590,000) × 2.6 = 1.29 × 9,783,511 × 2.6 ≈ 32,813,895`
- `basicPensionMonthlyRaw = bracket / 12 ≈ 2,734,491`
- 조기/연기 조정(최대 ×1.36)까지 반영해도 `adjustedPensionMonthly ≈ 3,720,908` 수준.

이 값들은 모두 자릿수가 수백만~수천만 원대로, `Number.MAX_SAFE_INTEGER`(약 9.007×10^15)와
비교하면 **8~9자리(약 10^8~10^9배) 여유가 있다** — average-cost-calculator가 `BigInt`를
채택해야 했던 "정상 입력 범위 안에서 이미 Number가 틀린 값을 낼 수 있는" 상황과는 질적으로
다르다. 조기/연기 조정의 곱셈(최대 1.36배)도 자릿수를 바꾸지 않는다.

**결론: Architect는 FORMULA.md의 판단(일반 `Number`, 전 단위 스케일링/`BigInt`/`decimal.js`
전부 불필요)에 동의한다(이견 없음).** 다만 FORMULA.md "정밀도/반올림 정책"이 요구하는
"중간 단계 반올림 금지 + 최종 표시 단계 1회만" 규칙은 구조적으로 강제해야 한다 — 아래
"6."에서 이를 타입/함수 경계로 어떻게 강제하는지 정한다.

---

## 5. 계산 로직 분리 방식 — 단일 `logic.ts` + 이름 있는 하위 함수 5개 (디렉터리 분할 아님)

`loan-interest-calculator`가 세운 기준("여러 변형이 짧고 독립적인 연산의 나열이면 분기로
충분, 같은 모양의 복잡한 다단계 절차 여러 벌을 공유하면 파일 분할")과 `bill-split-calculator`·
`d-day-calculator`가 재확인한 기준("방식이 여러 개라는 사실만으로 분할하지 않는다 — 실제
코드 길이·반복 구조를 먼저 본다")을 그대로 적용한다.

FORMULA.md "계산 순서" 10단계는 표면적으로 단계가 많아 보이지만, 실제로는 **분기(early/late
조건)가 있는 하나의 순차 파이프라인**이지 loan-interest-calculator(상환방식 3종이 각각
"앵커값 계산 → 회차 반복 → 마지막 회차 보정"이라는 복잡한 절차를 공유)처럼 "같은 모양의
복잡한 절차가 여러 벌" 반복되는 구조가 아니다. 각 단계도 대부분 한 줄 산술(곱셈/나눗셈/비교)
수준이다. 따라서 `logic/` 디렉터리로 분할할 근거가 없다 — `four-major-insurance`·
`business-days`·`d-day-calculator`와 같은 "분기로 충분한" 부류다.

다만 각 단계를 오케스트레이터 함수 안에 전부 인라인하지 않고, **재사용·독립 검증이 의미 있는
단계만 이름 있는 순수 함수로 분리**한다(`unemployment-benefit`의 `determineInsuredPeriodBand`
선례와 동일한 수준의 분리):

```
src/calculators/national-pension-benefit-estimate/logic.ts

  findPensionableAgeRow(birthYear, rows): PensionableAgeScheduleRow        // 위 "3."
  calculateContributionAdjustmentFactor(months, baseMonths, excessRate): number
    // FORMULA.md 6단계. months <= baseMonths ? months/baseMonths : 1 + excessRate*(months-baseMonths)/12
  calculateEarlyOrDeferredAdjustmentRate(months, earlyPension, deferredPension): number
    // FORMULA.md "7." — months < 0 ? -earlyPension.monthlyReductionRate * -months
    //                  : months > 0 ? deferredPension.monthlyIncreaseRate * months : 0
  calculateNationalPensionBenefit(input: NationalPensionBenefitFormInput): NationalPensionBenefitResult
    // 오케스트레이터. FORMULA.md "계산 순서" 2~10번을 그대로 순서대로 호출.
```

- **`clamp`(B값 상하한)는 별도 함수로 뽑지 않고 오케스트레이터 안에 한 줄
  (`Math.min(Math.max(averageMonthlyIncome, min), max)`)로 인라인한다** — 도메인 의미 없는
  1줄 연산을 함수로 분리하는 것은 과설계다(`src/lib/`로 승격할 만큼 이 계산기 밖에서
  재사용되는 것도 아니다 — 위 "결정 사례: 순수 날짜 산술 함수의 공용화 범위 재확인"의
  기준을 금액 clamp에도 동일하게 적용한 결론).
- **`basicPensionMonthlyRaw` 계산(FORMULA.md 7단계, `proportionalConstant × (aValue +
  bValueApprox) × factor / 12`)도 별도 함수로 뽑지 않는다** — 한 줄 산술이고, 조기/연기
  조정(9단계)이 이 값을 그대로 재사용해야 하므로 오케스트레이터가 지역 변수로 들고 있는
  편이 "완전정밀도 값의 재사용"이라는 반올림 정책(아래 "6.")을 표현하기에 더 명확하다.
- `findPensionableAgeRow`/`calculateContributionAdjustmentFactor`/
  `calculateEarlyOrDeferredAdjustmentRate` 3개를 분리한 이유는 각각 (a) FORMULA.md
  Golden Test가 독립적인 경계값 세트를 갖고 있어(스케줄 경계 3쌍, 240개월 경계 3개, 조기/연기
  한도 2개) Calculation Auditor가 오케스트레이터 전체를 거치지 않고 이 함수들만 직접
  호출해 경계값을 검증할 수 있게 하기 위해서고, (b) 세 함수 모두 "이 값이 몇 세인지/몇
  퍼센트인지"라는 법령 해석이 담긴 순수 산술이라 `four-major-insurance`가 보험 4종을 분기
  안에서 처리한 것보다 한 단계 더 세분화할 가치가 있다고 판단했기 때문이다(FORMULA.md
  자신이 이 세 지점을 "1-a/1-c", "4.", "7." 절로 각각 독립적으로 상세히 설명한 것과도
  결이 맞는다).

---

## 6. 반올림 정책을 함수 경계로 강제 — "완전정밀도 값"과 "표시값"을 서로 다른 변수로 분리

FORMULA.md "계산 순서" 8~9번과 "정밀도/반올림 정책"이 요구하는 핵심 불변식은 "반올림된
`basicPensionMonthly`를 `adjustedPensionMonthly` 계산에 재사용하지 않는다"이다(각각 완전정밀도
`basicPensionMonthlyRaw`에서 독립적으로 반올림). 이를 코드 리뷰나 주석에만 의존하지 않고
**변수 이름과 함수 구조로 강제**한다.

```ts
// logic.ts 오케스트레이터 내부 (의사코드, Builder가 그대로 구현)
const factor = calculateContributionAdjustmentFactor(input.totalContributionMonths, ...);
const basicPensionMonthlyRaw =                       // 완전정밀도. 이 변수만 9번 단계에 넘긴다.
  (proportionalConstant * (aValue + bValueApprox) * factor) / 12;
const basicPensionMonthly = Math.round(basicPensionMonthlyRaw); // 표시용, 여기서만 쓰고 버림

let earlyOrDeferredAdjustmentRate: number | undefined;
let adjustedPensionMonthly: Won | undefined;
if (input.earlyOrDeferredMonths !== 0) {
  earlyOrDeferredAdjustmentRate = calculateEarlyOrDeferredAdjustmentRate(...);
  adjustedPensionMonthly = Math.round(
    basicPensionMonthlyRaw * (1 + earlyOrDeferredAdjustmentRate),  // ← Raw를 쓴다, Monthly 아님
  );
}
```

- **`basicPensionMonthlyRaw`는 결과 타입(`types.ts`)에 노출하지 않는다**(위 "11." 참고) —
  이는 "내부 계산 전용, 화면에 보여줄 값이 아님"이라는 의미를 타입 경계에서도 분명히 한다.
  UI가 계산 근거를 보여줘야 한다면(SPEC Must Have "각 단계의 실제 대입값") `aValue`/
  `bValueApprox`/`proportionalConstant`/`contributionAdjustmentFactor`처럼 이미 결과 타입에
  있는 필드들로부터 화면에서 재현 가능한 수식을 텍스트로 보여주면 되고, 굳이 반올림 전
  중간값 자체를 타입으로 노출할 필요가 없다.
- **잠정 반올림 함수(round half up)를 이름 있는 상수/헬퍼로 분리할 필요는 없다** — 이
  계산기는 `Math.round`(JS 기본, 항상 .5를 올림)가 FORMULA.md가 잠정 채택한 "사사오입"과
  정확히 일치하는 유일한 지점 두 곳(`basicPensionMonthly`, `adjustedPensionMonthly`)뿐이라
  `weekly-holiday-allowance`의 `roundWon()`처럼 여러 곳에서 반복 호출되는 별도 함수로 뽑을
  실익이 크지 않다. 다만 **FORMULA.md "확인 필요" 3번(반올림 방향)이 향후 바뀔 수 있음을
  고려해, `Math.round` 호출 두 지점에 "FORMULA.md 확인 필요 3번, 잠정 round half up" 주석을
  남겨 한 번에 찾을 수 있게 한다**(Builder에게 남기는 지침).

---

## 7. 입력 검증 — `totalContributionMonths`의 "논리적으로 불가능한 가입기간" 상한 설계

FORMULA.md가 "Architect/Builder 재량"으로 남긴 부분이다. FORMULA.md 본문의 괄호 예시
("birthYear 기준 나이 - 18세를 초과할 수 없음")를 문자 그대로 구현하면 **SPEC.md 자신의
입력 정의와 모순된다** — SPEC.md는 `totalContributionMonths`를 "이미 납부한 기간 **+ 앞으로
납부할 예정 기간**을 합산한 총 개월수"로 명시했는데, "현재 나이 - 18"은 오직 **이미 경과한**
기간의 상한일 뿐 미래 예정분을 전혀 허용하지 않는다. 예를 들어 올해 30세인 사용자가 "앞으로
65세까지 계속 납부할 예정"이라고 입력하면 총 가입기간은 최대 47년(564개월)까지 정당하게
나올 수 있는데, "현재 나이(30) - 18 = 12년(144개월)"로 상한을 걸면 이 정상적인 미래 계획
입력을 전부 오류로 거부하게 된다. 이는 FORMULA.md의 예시가 "이미 납부한 기간만"을 염두에
둔 표현이었을 가능성이 높다고 판단해, Architect가 SPEC.md 정의에 맞게 재설계한다.

### 7.1 확정: "생애 가입 가능 나이 창(18~70세)" 기반의 birthYear-무관 정액 상한

```ts
// validation.ts (Builder 작성 예정, 상수만 이번 라운드에서 확정)
export const MIN_CONTRIBUTION_START_AGE = 18; // 성인 가입 가능 연령(SPEC.md birthYear 하한 근거와 동일)
export const MAX_CONTRIBUTION_END_AGE = 70;   // FORMULA.md 스케줄표 자체가 언급하는 최고 나이
                                                // (1969년생 이후 연기연금 최고 수급 나이) — 이
                                                // 계산기가 다루는 개념 안에서 가장 늦은 나이 참조
export const MAX_TOTAL_CONTRIBUTION_MONTHS =
  (MAX_CONTRIBUTION_END_AGE - MIN_CONTRIBUTION_START_AGE) * 12; // = 624개월(52년)
```

- **이 상한은 `birthYear` 값 자체를 파라미터로 받지 않는다** — "이미 납부 + 예정"을 구분해
  입력받지 않는 이상, 총 가입기간의 논리적 한계는 "가장 이르게 시작할 수 있는 나이(18세)부터
  가장 늦게까지 낼 수 있다고 가정하는 나이(70세)까지의 폭"이라는 **birthYear와 무관한 상수
  구간**으로 정해진다(어느 해에 태어났든 이 폭 자체는 달라지지 않는다 — 이미 지난 부분과
  남은 부분의 배분만 달라질 뿐, 합계의 상한은 동일).
- "출생연도 기준"이라는 SPEC/FORMULA.md의 표현은 이 상수를 `birthYear`로 다시 나누지
  않아도, 애초에 이 상한 개념 자체가 "성인 가입 연령(18세)"이라는 `birthYear` 하한 검증과
  같은 근거를 공유한다는 점에서 계승된다 — 다만 계산식에 `birthYear` 변수가 직접 등장하지
  않을 뿐이다. 이 판단 근거를 명시적으로 남겨 향후 리뷰어가 "왜 birthYear를 안 쓰지?"라고
  의아해하지 않게 한다.
- **70세는 검증된 법령 상한이 아니라 실용적 안전판(sanity bound)이다** — FORMULA.md가
  "확인 필요"로 남긴 항목이 아니라 Architect가 이번에 새로 도입하는 UX/검증용 상수이므로,
  `docs/CALCULATOR_RULES.md` "정책형 계산기"가 요구하는 `source`/`lastVerified` 메타데이터
  스키마의 적용 대상이 아니다(법적 사실이 아니라 "말이 안 되는 입력을 거르는 넉넉한 울타리"
  라는 성격을 코드 주석에 명확히 남겨, Calculation Auditor가 이를 검증되지 않은 법령 수치로
  오인해 "확인 필요"로 재분류하지 않도록 한다).
- **480개월(FORMULA.md 예제 7, "40년 초과해도 산식 그대로 적용")보다 넉넉히 위에 있다** —
  624 > 480이므로 FORMULA.md가 이미 유효한 입력으로 승인한 예제를 이 상한이 실수로 막는
  일은 없다.
- 검증 오류 메시지 예시(Builder 참고): "입력하신 가입기간(OOO개월)은 만 18세부터 만
  70세까지 계속 납부해도 도달하기 어려운 기간입니다. 이미 납부한 기간과 앞으로 납부 예정인
  기간을 다시 확인해 주세요."

### 7.2 그 외 검증 (FORMULA.md·SPEC.md가 이미 확정한 범위를 그대로 구현)

- `birthYear`: 정수, `1940 <= birthYear <= currentYear - 18`(SPEC.md 권장 범위,
  `currentYear`는 `ui.tsx`가 `today`를 props/파라미터로 넘기는 기존 관례를 따른다 —
  `age-calculator`/`military-discharge-date`처럼 `logic.ts`/`validation.ts`가 `Date.now()`를
  직접 읽지 않는다, docs/ARCHITECTURE.md "날짜 계산" 원칙과 동일한 이유로 "현재 연도"도
  순수 함수 바깥에서 주입한다).
- `totalContributionMonths`: 정수, `0 <= months <= MAX_TOTAL_CONTRIBUTION_MONTHS`(위 "7.1").
- `averageMonthlyIncome`: 정수, `> 0`. FORMULA.md "예외"에 따라 상·하한 초과 자체는 오류가
  아니라 clamp 대상이므로 상한 초과를 이유로 입력을 거부하지 않는다 — 다만 순수 UX 목적의
  "비정상적으로 큰 값" 타이핑 실수 방어용 넉넉한 안내 상한(예: 1억원/월)을 두는 것은 Builder
  재량으로 허용한다(계산 정확성과 무관한 UX 가드일 뿐, FORMULA.md 산식이나 clamp 로직을
  변경하지 않는다 — 이 상한을 넘겨도 clamp 자체는 여전히 정상 동작해야 하므로 "제출 차단"이
  아니라 "확인 안내" 수준으로 구현할 것을 권장).
- `earlyOrDeferredMonths`: 정수, `-60 <= n <= 60`(FORMULA.md "예외", `rates2026.
  nationalPensionBenefit.earlyPension.maxMonths`/`deferredPension.maxMonths`에서 상수를
  읽어 하드코딩하지 않는다). 범위를 벗어나면 FORMULA.md Golden Test #15가 요구하는 "조기/연기는
  최대 5년(60개월)까지만 가능합니다" 오류 메시지를 표시한다 — 이 테스트는 `logic.ts`가 아니라
  `validation.ts`의 책임이므로 `validation.test.ts`에 배치한다(아래 "12." 참고).

---

## 8. `earlyOrDeferredMonths` UI — 자유 입력 대신 11개 선택지 드롭다운, 결과는 이중 카드

### 8.1 입력 UI — `<select>` 드롭다운(라디오/세그먼트 아님)

FORMULA.md가 권고한 "그대로/1년 앞당김/.../5년 늦춤" 선택형을 구체화한다. 총 11개 값
(`-60, -48, -36, -24, -12, 0, +12, +24, +36, +48, +60`)을 1년 단위로만 제공한다(FORMULA.md가
개월 단위 자유 입력을 UX상 안전하지 않다고 판단한 취지를 그대로 따른다 — 국민연금 조기/연기
신청도 실무상 "몇 년 앞당김/늦춤" 단위로 안내되는 경우가 흔해 사용자 정신모형과도 맞는다).

- **컴포넌트: 네이티브 `<select>`.** `business-days`/`d-day-calculator`가 쓰는 "스타일 입힌
  라디오"(세그먼트 버튼) 패턴은 옵션이 2~3개일 때는 적합하지만, 11개 옵션을 라디오/세그먼트로
  펼치면 320px 화면에서 세로로 매우 길어지거나 줄바꿈이 지저분해진다(`docs/DESIGN_SYSTEM.md`
  "320px~1440px 가로 스크롤 없이" 요건과 충돌 위험) — 이 사이트에 아직 11개 수준의 옵션을
  가진 선택 입력이 없으므로, 이런 규모에는 네이티브 `<select>`(모바일에서 OS 네이티브 휠/목록
  UI로 렌더링되어 세로 공간을 차지하지 않음)가 더 적합하다고 판단한다. 새 공용 컴포넌트를
  만들 필요는 없다 — 표준 HTML `<select>` + 기존 `CalculatorField`류 레이블/오류 래퍼만으로
  충분하다.
- 옵션 레이블 예시(Builder가 그대로 쓰거나 다듬을 수 있음, 값은 이 문서가 고정):
  `"5년 앞당겨 받기(조기노령연금, -30%)"`, ..., `"그대로(법정 수급개시연령)"`(기본 선택),
  ..., `"5년 늦춰 받기(연기연금, +36%)"`. 각 옵션에 미리 계산된 감액/가산율(%)을 함께
  보여주면 사용자가 선택 전에 효과를 가늠할 수 있다(FORMULA.md "7."의 확정 수치를 그대로
  라벨에 반영 — `earlyPension.monthlyReductionRate × |months|`, `deferredPension.
  monthlyIncreaseRate × months`를 `content.ts`/`ui.tsx`가 정적으로 미리 계산해 문자열로
  갖고 있어도 되고, 매 렌더마다 계산해도 비용이 없다).
- 옵션 목록 자체(값+레이블 배열)는 `types.ts`에 타입으로 강제하지 않는다 — `loan-interest-
  calculator`의 상환방식 라디오 레이블처럼 `ui.tsx` 로컬 상수 배열로 두는 기존 관례를
  따른다(위 조사 결과, 이 사이트의 선택형 옵션 레이블은 일관되게 UI 계층에 있다).

### 8.2 결과 화면 — "법정 나이 기준"과 "조기/연기 반영" 두 금액을 함께 표시

SPEC.md Should Have였다가 Must Have로 승격된 요구("법정 나이 기준 금액"과 "조기/연기 반영
금액"을 함께 보여주는 레이아웃)를 다음과 같이 구조화한다.

- **`earlyOrDeferredMonths === 0`**: `basicPensionMonthly` 하나만 핵심 결과 카드로 크게
  표시한다(다른 계산기의 단일 핵심 결과 카드 패턴과 동일 — `adjustedPensionMonthly`
  자체가 `undefined`이므로 두 번째 카드를 렌더링할 데이터가 없다).
- **`earlyOrDeferredMonths !== 0`**: 두 값을 모두 보여주되 **`adjustedPensionMonthly`를
  1차(가장 크게 강조된) 핵심 결과로, `basicPensionMonthly`를 2차(보조, "참고: 법정
  수급개시연령 기준 금액은 OOO원입니다" 형태)로 배치한다** — 사용자가 실제로 선택한
  시나리오(조기/연기)의 결과가 "지금 이 입력에 대한 답"이므로 시각적 우선순위를 그쪽에
  둔다. 이 우선순위 판단(어느 카드를 더 크게 보여줄지)은 화면을 직접 보고 조정할 여지가
  있으므로 UX/UI Critic 라운드에서 재검토 가능하다고 명시해 둔다 — Architect는 "정보
  구조"(두 값을 모두 보여줘야 한다, 어느 것이 1차인지의 기본값)만 확정하고 시각적 세부
  구현은 강제하지 않는다.
- 두 카드 모두 "법정 수급개시연령: {pensionableAge}세({pensionableYear}년)"이라는 공통
  컨텍스트를 공유하므로, 이 정보는 두 카드 바깥(공통 헤더)에 한 번만 표시한다.

---

## 9. 최소 가입기간 미달 시 결과 타입/UI — severance-pay 패턴 재사용 + pensionableAge 예외

`src/calculators/severance-pay/`의 실제 구현을 확인했다(`types.ts`의
`SeverancePayIneligibleResult`, `ui.tsx`의 `{result && !result.eligible && (...)}` 분기,
`<h2 className="text-lg font-semibold">지급대상 아님</h2>` 헤딩 패턴). 이 계산기도 동일한
구조를 재사용한다.

- **재사용하는 부분**: discriminated union(`eligible: false | true`)으로 타입 레벨에서
  "금액 필드 접근 자체를 막는" 패턴, `<h2>지급대상 아님</h2>` 헤딩 스타일, 결과 영역을
  통째로 다른 레이아웃(금액 카드 대신 안내 카드)으로 교체하는 조건부 렌더링 구조.
- **이 계산기만의 차이 — pensionableAge는 예외적으로 ineligible 결과에도 포함한다.**
  severance-pay/unemployment-benefit의 ineligible 타입은 금액 관련 필드를 전부 제거하는데
  그치지만(별도로 "그래도 계산되는 다른 값"이 없었다), 이 계산기는 FORMULA.md "계산 순서"
  2번이 "수급개시연령 판정은 최소 가입기간과 무관하게 항상 수행"하도록 명시했으므로,
  `NationalPensionBenefitIneligibleResult`(위 "11.")에 `pensionableAge`/`pensionableYear`를
  **포함**한다. 화면 문구 예: "입력하신 가입기간(OO개월)은 노령연금 수급을 위한 법정 최소
  가입기간(120개월)에 못 미쳐 예상 연금액을 계산할 수 없습니다. 다만 출생연도 기준
  수급개시연령은 {pensionableAge}세({pensionableYear}년)로 계산됩니다." — "지급대상
  아님" 안내와 "그래도 몇 살부터 받을 수 있었을지는 참고로 알려준다"는 SPEC.md의 사용자
  흐름("몇 살부터 국민연금을 받을 수 있는지 확인하려는 사용자")을 동시에 만족한다.
- 반환일시금 등 다른 제도 안내는 SPEC.md·FORMULA.md가 이미 "계산하지 않고 안내만"으로
  범위를 확정했으므로 `content.ts`의 정적 문구로만 처리하고 타입/로직에 반영하지 않는다.

---

## 10. 폴더/파일 구조

```
src/calculators/national-pension-benefit-estimate/
  types.ts          # 입력·결과 타입 (Architect 완성 — 이번 라운드에 작성함, 위 "11.")
  logic.ts          # findPensionableAgeRow, calculateContributionAdjustmentFactor,
                     # calculateEarlyOrDeferredAdjustmentRate, calculateNationalPensionBenefit
                     # (위 "5.", 단일 파일 — logic/ 디렉터리 분할 아님)
  logic.test.ts     # FORMULA.md Golden Test 14개(#15 제외, 아래 "12.") + 경계값 describe 그룹
  validation.ts     # 입력 검증(zod 등), MAX_TOTAL_CONTRIBUTION_MONTHS 등 도메인 상수(위 "7.")
  validation.test.ts
  formatting.ts     # 금액/기간("N년 M개월")/퍼센트 포맷, 계산 근거(breakdown) 문자열 조립,
                     # 조기/연기 선택지 라벨용 감액·가산율 문자열
  formatting.test.ts
  content.ts        # 소개, 사용법, FAQ, 정책 고지 문구(B값 근사 한계, 비례상수 근사 한계,
                     # 세전·유족/장애연금 제외·군복무크레딧 등 미반영 고지, annual-salary-
                     # take-home-pay/four-major-insurance 교차 안내)
  ui.tsx            # 입력 폼(조기/연기 select 포함, 위 "8.1") + 이중 결과 카드(위 "8.2") +
                     # "지급대상 아님" 분기(위 "9.")
```

`logic/` 디렉터리로 분할하지 않는다(위 "5." 근거). 다른 계산기가 이 폴더의 파일을 import하지
않는다 — `rates-2026.json`의 새 네임스페이스(위 "2.")를 통해서만 데이터를 공유하고, 계산
로직 자체는 공유하지 않는다.

---

## 11. 타입 설계 — `types.ts` 확정 완료 (이번 라운드에 작성)

`src/calculators/national-pension-benefit-estimate/types.ts`를 작성했다(전체 내용은 파일
참고). 핵심 결정은 위 "6.", "9."에서 이미 설명했으므로 요약만 한다.

- `NationalPensionBenefitFormInput`: `birthYear`/`totalContributionMonths`/
  `averageMonthlyIncome`/`earlyOrDeferredMonths`(기본 0) 4개 필드, FORMULA.md "입력값" 표
  그대로.
- `NationalPensionBenefitIneligibleResult`: `eligible: false` + `pensionableAge`/
  `pensionableYear`(항상 계산됨, 위 "9.") + `minEligibleMonths`/`totalContributionMonths`
  (안내 문구용 에코). 금액 필드 전무.
- `NationalPensionBenefitEligibleResult`: `eligible: true` + `pensionableAge`/
  `pensionableYear` + `aValue`/`bValueApprox`/`bValueClamped`/`proportionalConstant`/
  `contributionAdjustmentFactor`/`basicPensionMonthly`(표시용 반올림값) +
  `earlyOrDeferredMonths`(에코) + `earlyOrDeferredAdjustmentRate?`/`adjustedPensionMonthly?`
  (조기/연기 미신청 시 `undefined`, 위 "6.").
- **완전정밀도 중간값(`basicPensionMonthlyRaw`)은 결과 타입에 노출하지 않는다**(위 "6.").
- **판별 유니온을 굳이 3종 이상으로 늘리지 않았다** — "조기/연기 신청 여부"는 별도
  discriminated union 분기가 아니라 `eligible: true` 결과 안의 optional 필드
  (`adjustedPensionMonthly?`)로 표현했다. loan-interest-calculator(상환방식 3종, 결과 모양
  자체가 방식마다 다름)와 달리 이 계산기는 조기/연기 여부와 무관하게 `eligible: true`
  결과의 핵심 필드 구성이 동일하고 단지 "추가로 값 두 개가 더 있는지"만 다르므로, 판별
  유니온보다 optional 필드가 더 단순하고 정확하다.
- `types.ts`에 `rates2026`을 import하지 않는다 — JSON 구조 파생 타입
  (`PensionableAgeScheduleRow` 등)은 `logic.ts` 로컬에 둔다(위 "2.3", unemployment-benefit
  선례).

---

## 12. Golden Test 배치 전략

FORMULA.md의 15개 검증 예제를 `logic.test.ts`(14개)와 `validation.test.ts`(1개, #15)로
나눈다 — **예제 15("조기/연기 61개월, 입력 오류")는 `calculateNationalPensionBenefit`이
아니라 `validation.ts`가 검증할 책임**이기 때문이다(이 계산기의 다른 모든 계산기와
동일하게, `logic.ts`의 순수 계산 함수는 이미 검증을 통과한 입력만 받는다는 전제 — 범위
밖 입력을 방어적으로 다시 체크하지 않는다).

`logic.test.ts`는 다음 `describe` 그룹으로 나눈다(경계값 성격별로 묶어 Auditor가 부분
재실행하기 쉽게 하는 기존 관례, `d-day-calculator`/`loan-interest-calculator`와 동일 형식):

```ts
describe("기본연금액 산식 — 구조 검증(÷12) 및 정상/경계 케이스 (Golden Test #1~4, #7)")
  // #1: 독립 재무 콘텐츠 벤치마크(A=B=250만, 40년, 구 상수 1.2) — "공식 계산기 대조" 1/2건.
  //     주석에 "한경매거진/미래에셋투자와연금센터, 확인일 2026-09-13, 대조 1/2건 — 나머지
  //     1건은 Calculation Auditor의 라이브 계산기 대조로 완성 예정(위 '1.' 게이트)"를 남긴다.
  // #2: 240개월 정상 케이스(현재 A/B값)
  // #3: 239개월(비례구간 상단 바로 아래)
  // #4: 241개월(가산구간 진입 직후)
  // #7: 480개월(40년, 장기가입)

describe("최소 가입기간 경계 (Golden Test #5~6)")
  // #5: 120개월, eligible=true 경계
  // #6: 119개월, eligible=false — "지급대상 아님" + pensionableAge는 여전히 계산됨을 함께 검증

describe("기준소득월액 clamp (Golden Test #8~9)")
  // #8: 상한 clamp, bValueClamped=true
  // #9: 하한 clamp, bValueClamped=true

describe("수급개시연령 스케줄 경계 (Golden Test #10~12)")
  // #10: 1952/1953, #11: 1956/1957, #12: 1968/1969 — findPensionableAgeRow 직접 호출도 겸함

describe("조기노령연금·연기연금 (Golden Test #13~14)")
  // #13: -60개월(최대 조기, -30%), #14: +60개월(최대 연기, +36%)
  // 두 예제 모두 basicPensionMonthlyRaw(반올림 전 완전정밀도)를 기준으로
  // adjustedPensionMonthly를 계산했는지(= basicPensionMonthly가 아니라 Raw를 썼는지)를
  // 반드시 함께 assert한다 — 위 "6."의 핵심 불변식이 실제로 지켜지는지 확인하는 지점.
```

- `validation.test.ts`에 별도 케이스로 "Golden Test #15 — earlyOrDeferredMonths=-61/+61 →
  입력 오류"를 추가한다.
- `docs/CALCULATOR_RULES.md` "Golden Test — 공식 계산기 예시값과 대조한 케이스 최소 2개"
  요건은 **이번 라운드까지 1건만 충족**된 상태임을 테스트 파일 최상단 주석에도 명시한다
  (FORMULA.md와 동일한 문구, 위 "1." 게이트와 연결) — 두 번째 라이브 대조 케이스가
  Calculation Auditor 라운드에서 추가되면 이 describe 블록에 새 `it`으로 추가한다(파일
  구조를 새로 만들 필요 없음, 자리는 이미 "①" 그룹 안에 마련돼 있다).
- 완료 기준 불변식 후보(Builder에게 권장, `d-day-calculator`/`loan-interest-calculator`의
  "완료 기준 불변식" 추가 관례와 동일): (a) `totalContributionMonths`가 240 전후로 연속
  증가할 때 `basicPensionMonthly`도 항상 단조 증가한다(예제 2·3·4가 개별 값으로 이미
  검증하지만, `it.each`로 더 촘촘한 값들을 스윕해 불연속이 없는지 재확인), (b)
  `earlyOrDeferredMonths`가 0에서 멀어질수록(같은 부호 안에서) `|adjustedPensionMonthly -
  basicPensionMonthly|`가 단조 증가한다.

---

## 13. 공통 컴포넌트 재사용 검토

- **`ShareActions`**: 그대로 재사용한다. `text`는 `formatting.ts`가 만드는 요약 문장(예:
  "1975년생, 가입 300개월 기준 예상 노령연금은 월 665,802원(65세부터)입니다." 또는 지급대상
  아님일 때 "입력한 가입기간은 노령연금 법정 최소 가입기간에 못 미칩니다.")이면 된다. 공유
  상태(`NationalPensionBenefitFormInput`)는 전부 원시 타입(`number`)이라 `average-cost-
  calculator`가 겪은 `BigInt` 직렬화 문제, `bill-split-calculator`의 RNG 재현 문제 모두
  해당 없음 — 입력을 그대로 `encodeShareState`에 넘기면 결정적으로 같은 결과가 재현된다.
- **`SectionCard`/`UsageGuide`/`IntroSection`/`FaqAccordion`**: 그대로 재사용한다.
- **핵심 결과 카드**: 새 컴포넌트를 만들지 않는다 — 다른 계산기와 동일하게 `ui.tsx`에서
  `bg-primary` 강조 카드 스타일을 직접 구현한다. 다만 위 "8.2"의 "이중 카드"(1차/2차) 레이아웃
  자체는 이 계산기가 처음 필요로 하는 조합이므로, 기존 단일 카드 마크업을 그대로 복붙하지
  말고 "핵심 카드 1개 + 보조 카드 0~1개"를 조건부로 렌더링하는 지역 구조로 짠다(별도 공용
  컴포넌트로 승격하기엔 아직 사례가 1개뿐).
- **조기/연기 select**: 위 "8.1" 참고, 새 공용 컴포넌트 불필요(네이티브 `<select>` + 기존
  레이블/오류 래퍼).
- **"지급대상 아님" 카드**: `severance-pay`의 기존 마크업 패턴을 그대로 재사용한다(새 컴포넌트
  불필요, 이미 두 번째 계산기인 unemployment-benefit도 텍스트만 다르고 동일 구조를 재사용한
  전례가 있다 — 이번이 세 번째 재사용).

---

## 14. 계산기 등록 전략

- 이번 Architect 라운드에서는 등록하지 않는다(위 "0." 참고, 기존 관례).
- Builder가 UI 구현을 완료하면 `registry.ts`에 다음으로 등록한다(SPEC.md "슬러그/카테고리"가
  이미 확정한 값 그대로):
  ```
  slug: "national-pension-benefit-estimate"
  title: "국민연금 예상수령액 계산기"
  category: "tax"
  status: "draft"
  ```
- **아이콘: `coins`(SPEC.md가 이미 확정).** `tax` 카테고리에는 이미 `heart`
  (four-major-insurance) · `chart`(housing-subscription-score) · `coins`
  (annual-salary-take-home-pay)가 있다 — `coins`는 `severance-pay`/`military-salary`/
  `annual-salary-take-home-pay`와 중복되지만 SPEC.md가 "핵심 결과가 금액이라는 점에서
  동일 아이콘 키 재사용"을 명시적 근거로 들었고, 이 사이트는 이미 `coins`/`calendar`
  등을 여러 카테고리·계산기가 중복 사용 중이므로(예: `calendar`가 date 카테고리 4개
  전부) 새 아이콘 키 신설이 필요 없다.
- **이 계산기는 위 "1."의 published 게이트를 통과하기 전까지 `status: "draft"`를 유지한다**
  — Calculation Auditor + UX/UI Critic + QA 통과만으로는 부족하고, 위 "1."의 라이브 계산기
  대조까지 완료되어야 `"published"`로 전환할 수 있다(이 계산기에서만 추가되는 조건 — 다른
  계산기들의 통상적인 3단계 통과 기준보다 한 단계 더 엄격하다).

---

## 15. 회귀 방지 확인

이번 라운드에서 실제로 수정·생성한 파일은 다음과 같다.

**공용 코드(다른 계산기가 함께 쓰는 파일) — 순수 추가(append)만 수행, 기존 내용 미수정**:
- `src/data/rates-2026.json`: 최상위 `nationalPensionBenefit` 네임스페이스 추가(기존
  `unemploymentBenefit`/`socialInsurance` 등 다른 네임스페이스는 한 글자도 수정하지 않음).

**이 계산기 전용 신규 파일**:
- `src/calculators/national-pension-benefit-estimate/types.ts` (신규 — 다른 계산기가
  import하지 않는다).
- `tasks/national-pension-benefit-estimate/ARCHITECTURE.md` (이 문서).

**문서만 갱신(코드 아님)**:
- 루트 `PROGRESS.md`: `national-pension-benefit-estimate` 행 "Formula" 컬럼 `TODO` →
  `PASS`, "다음 재검토 예정일" 컬럼을 FORMULA.md 확정치로 갱신(계산 로직 자체는 바꾸지
  않았다).

**검증**: `src/data/rates-2026.json` 변경 직후 `npx tsc --noEmit`(오류 없음)과 전체 테스트
스위트(`npx vitest run`, 74개 파일 922개 테스트 전부 통과)를 재실행해 회귀가 없음을
확인했다. 따라서 **기존 계산기 16종에 대한 회귀 위험은 이번 라운드에서 발생하지 않는다.**

---

## 16. Builder 인수인계 요약

> **가장 먼저 위 "1. PUBLISHED 전환 게이트"를 읽을 것.** 구현을 완료해도 이 계산기는
> 곧바로 published로 전환되지 않는다 — Calculation Auditor의 라이브 계산기 대조가 남아있다.

1. `types.ts` — 이미 작성 완료(위 "11." 그대로). 새 필드가 필요하면 이 문서의 설계 원칙
   (완전정밀도 값 비노출, ineligible에도 pensionableAge 포함, optional 필드로 조기/연기 표현)을
   유지한 채 추가한다.
2. `logic.ts` —
   - `findPensionableAgeRow(birthYear, rows)`: 위 "3." 시그니처 그대로.
   - `calculateContributionAdjustmentFactor(months, baseMonths, excessRate)`: FORMULA.md
     6단계(`months <= baseMonths ? months/baseMonths : 1 + excessRate*(months-baseMonths)/12`).
   - `calculateEarlyOrDeferredAdjustmentRate(months, earlyPension, deferredPension)`:
     FORMULA.md "7."(조기: `-earlyPension.monthlyReductionRate * -months`, 연기:
     `deferredPension.monthlyIncreaseRate * months`, 0이면 0 또는 호출 자체를 생략).
   - `calculateNationalPensionBenefit(input)`: FORMULA.md "계산 순서" 2~10번을 그대로
     순서대로 호출. **9단계는 반드시 `basicPensionMonthlyRaw`(반올림 전)를 기반으로
     계산한다 — `basicPensionMonthly`(반올림 후)를 재사용하면 결함이다**(위 "6." 핵심
     불변식).
   - `rates2026`을 모듈 최상단에서 바로 import해서 쓴다(위 "2.3", `year` 파라미터·
     `RATES_BY_YEAR` 맵 불필요).
   - `clamp`는 인라인 한 줄로 처리한다(위 "5.", 별도 함수 불필요).
3. `validation.ts` — 위 "7." 그대로. `MIN_CONTRIBUTION_START_AGE`(18)·
   `MAX_CONTRIBUTION_END_AGE`(70)·`MAX_TOTAL_CONTRIBUTION_MONTHS`(624) 상수와 그 근거
   주석(위 "7.1", "법령 검증치 아닌 실용적 안전판"임을 명시)을 포함한다. `earlyOrDeferredMonths`
   범위(-60~60)는 `rates2026.nationalPensionBenefit.earlyPension/deferredPension.maxMonths`에서
   읽는다(하드코딩 금지). "현재 연도"는 `ui.tsx`가 주입한다(순수 함수가 `Date.now()`를 직접
   읽지 않음).
4. `logic.test.ts`/`validation.test.ts` — 위 "12." 구조 그대로 FORMULA.md Golden Test
   14+1개를 옮긴다. 예제 1 주석에 "공식 계산기 대조 1/2건, 나머지는 Calculation Auditor
   라이브 대조 예정(위 '1.' 게이트)"을 반드시 남긴다.
5. `formatting.ts` — 금액(`Intl.NumberFormat('ko-KR')`), 가입기간("N년 M개월" 변환, 개월
   단위 내부 유지), 조기/연기 조정률(%) 표시, 계산 근거(breakdown) 문자열 조립(FORMULA.md
   "계산 순서" 각 단계의 실제 대입값을 SPEC Must Have대로 노출), 조기/연기 select 옵션
   레이블(위 "8.1").
6. `content.ts` — 소개("노령연금이란", "A값/B값을 쉬운 말로"), 사용법, FAQ, 정책 고지
   문구 전체(FORMULA.md "1-c" 필수 고지 문구, "3." B값 근사 고지 문구, SPEC.md "설명과
   정책 고지" 전 항목: 세전만 다룸, 유족/장애연금 등 미포함, 군복무·출산크레딧·부양가족연금액
   미반영, 브라우저 로컬 계산, "국민연금공단 내 연금 알아보기" 안내), annual-salary-
   take-home-pay/four-major-insurance 교차 안내 문구(SPEC Should Have).
7. `ui.tsx` — 입력 폼(4개 필드, 조기/연기는 위 "8.1" select) + 이중 결과 카드(위 "8.2") +
   "지급대상 아님" 분기(위 "9.") + `ShareActions`(계산 전·후 동일 위치) + 소개/사용법/
   정책고지/FAQ.
8. 레지스트리에 `status: "draft"`로 등록(위 "14.").
9. **Builder는 구현 완료 시점에 위 "1." 게이트가 아직 해소되지 않았음을 작업 로그/
   PROGRESS.md에 명시적으로 남긴다** — "구현 완료"와 "published 가능"을 혼동하지 않는다.
10. 새 계산기 완료 후 기존 계산기 Smoke Test(docs/EVALUATION.md "회귀 방지") 실행 — 이번
    Architect 라운드가 이미 `rates-2026.json` 변경 직후 1회 확인했지만(위 "15."), Builder
    구현 완료 후 다시 한번 전체 스위트를 재실행할 것을 권장한다.

---

## 17. 남은 리스크 / 확인 필요 (FORMULA.md "확인 필요 목록"과 이 라운드에서 추가된 것)

- **[최우선, 재강조] 위 "1." published 게이트** — ÷12 단계·최종 반올림 정책의 nps.or.kr
  라이브 계산기 대조가 이 계산기의 최종 PASS 판정 전 반드시 필요하다.
- FORMULA.md "확인 필요 목록" 2~6번(20년 미만 비례 감액의 정확한 조문 위치, 원 단위
  반올림/절사 방향, 재평가율 테이블 갱신 주기, 43% 고정 조항의 정확한 시행일, 군복무·출산
  크레딧·부양가족연금액의 향후 범위 밖 처리 여부)은 Architect 영역 밖이며 그대로 Calculation
  Auditor/Product Owner에게 남긴다 — 이번 라운드에서 임의로 확정하지 않았다.
- **이 라운드에서 새로 도입한 검증 상수(`MAX_CONTRIBUTION_END_AGE = 70`, 위 "7.1")는
  법령 검증치가 아니라 Architect의 실용적 판단이다** — Calculation Auditor가 이를 "확인
  필요"한 법령 수치로 오인하지 않도록 이 문서와 코드 주석에 성격을 명확히 남겼다. 다만
  이 값이 실제 사용성에 비해 너무 넉넉하거나(비현실적 입력을 못 거름) 너무 빡빡한지
  (정당한 장기 가입 계획을 막는지)는 QA/UX 단계에서 실제 사용자 시나리오로 재검토할
  여지가 있다.
- **조기/연기 select의 11개 옵션이 실제 화면(특히 320px)에서 라벨이 길어져 잘리지 않는지**는
  Builder 구현 후 UX/UI Critic이 실기기/뷰포트로 확인해야 한다(이 문서는 레이아웃 방향만
  정했다).
- 위 "8.2"의 "어느 카드가 1차 강조인지"는 Architect가 기본값(조기/연기 신청 시
  `adjustedPensionMonthly` 우선)만 정했을 뿐 최종 시각적 확정은 UX/UI Critic 라운드로
  남긴다(위 "8.2" 명시).
