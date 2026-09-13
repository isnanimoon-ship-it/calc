# ARCHITECTURE: 평단가(물타기) 계산기 (average-cost-calculator)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-12.
계산 공식 자체는 정의하지 않는다(Formula Analyst 소관, 가중평균 공식·반올림 정책(사사오입)을
바꾸지 않았다). 여기서는 코드 배치, 타입, 숫자 정밀도 자료형, UI 구조만 정한다.

관련 문서: docs/ARCHITECTURE.md, docs/CALCULATOR_RULES.md, docs/DESIGN_SYSTEM.md.
참고 선례: `tasks/loan-interest-calculator/ARCHITECTURE.md`(판별 유니온, `logic/` 분할 판단
기준, Builder 인수인계 형식), `tasks/bill-split-calculator/ARCHITECTURE.md`("0. 레지스트리
상태 확인" 관례, "숫자 정밀도 전략" 서술 형식, 계산기 전용 보조 모듈 분리 사례인
`ladder-layout.ts`, "아직 사례 1개뿐이면 승격하지 않는다"는 반복 원칙).

이 계산기는 이 사이트 최초로 **수량 자체가 소수**인 계산기이고, 그 결과 이 사이트 최초로
`BigInt`를 실제로 채택하는 계산기다(지금까지 모든 계산기는 일반 `Number` 또는 "정수 분수
연산"으로 충분했다 — docs/ARCHITECTURE.md "숫자 정밀도 전략" 결정 사례 목록 참고). 아래
"2."가 이 문서의 핵심이다.

---

## 0. 레지스트리 상태 확인

`src/calculators/registry.ts` 확인 결과 `average-cost-calculator` slug는 등록되어 있지
않다. 이번 Architect 라운드에서도 등록하지 않는다(기존 관례 — loan-interest-calculator·
bill-split-calculator 모두 Architect 라운드에서는 등록하지 않고 Builder가 구현 완료 시
`status: "draft"`로 등록했다) — 아래 "8. 계산기 등록 전략" 참고.

`src/calculators/average-cost-calculator/` 폴더는 이번 라운드에서 `types.ts` 하나만
생성했다(아래 "5." 참고). `logic.ts`/`decimal-scale.ts` 등 실제 계산 코드는 아직 없다
(Builder 몫).

`docs/ARCHITECTURE.md`·`PROGRESS.md`는 이번 라운드에서 함께 갱신한다(아래 "9." 참고) —
공용 유틸/컴포넌트 코드 자체는 건드리지 않는다(아래 "7. 회귀 방지 확인" 참고).

---

## 1. 이 계산기가 요구하는 새로운 판단이 무엇인가

FORMULA.md가 명시한 대로, 이 계산기는 "수량(소수) × 단가(소수)를 곱해 비용을 만들고, 그
합을 수량(소수)으로 나눠 평균을 낸다"는 곱셈→합산→나눗셈 체인 전체에서 이진 부동소수점
오차가 개입할 여지가 있다. 지금까지 이 사이트의 모든 금융 계산기(대출 이자, 4대 보험,
연봉 실수령액 등)는 "금액만 소수 위험이 있고 수량(주, 개월, 회차)은 항상 정수"였다 — 이
계산기가 최초로 이 전제를 깬다. FORMULA.md는 BigInt 8자리 고정소수점 스케일링을 권장(강제
아님)하며 구체적 알고리즘(문자열 기반 스케일링, 나머지 기반 사사오입 나눗셈)까지 제시했다.
아래 "2."에서 이 권장을 **직접 재검증**한 뒤 확정한다(다른 계산기 Architect 라운드가
Formula Analyst의 "권장(강제 아님)" 의견을 그대로 받지 않고 직접 최악 조합을 재계산해
확정한 것과 동일한 방법론 — loan-interest-calculator "1. 숫자 정밀도 전략" 참고).

---

## 2. 숫자 정밀도 전략 (핵심 결정) — BigInt 8자리 고정소수점 스케일링 채택 (확정)

### 2.1 결론

**FORMULA.md의 권장을 그대로 확정한다: 내부 계산은 BigInt 8자리 고정소수점 스케일링,
외부 결과 타입의 "정확한 계산값" 4종(`newAveragePrice`/`totalQty`/`totalCost`/
`priceChangeAmount`)은 `number`가 아니라 정확한 십진 문자열(`DecimalString`)로 노출한다.**
`decimal.js`/`big.js` 같은 임의정밀도 라이브러리는 채택하지 않는다. 일반 `Number`(정수
스케일링 포함)는 이 계산기의 FORMULA.md가 승인한 입력 상한 조합에서 **정답이 아예 틀리게
나올 수 있어** 채택하지 않는다.

### 2.2 왜 일반 `Number`(스케일링 포함)로는 안 되는가 — 직접 재계산으로 확인

FORMULA.md 검증 예제 10이 지적한 대로 `holdingQty=10^15, holdingPrice=10^10`인 극단
조합에서 `qty × price = 10^25`이다. 이는 `Number.MAX_SAFE_INTEGER`(약 9.007×10^15)를
**10^9배 이상** 초과한다 — "오차가 조금 있다" 수준이 아니라 **자릿수 자체가 통째로
소실**되는 규모다. loan-interest-calculator가 최악 조합을 검증했을 때(연이율 100%×480개월)
결론이 "Number로 충분하다"였던 것과 달리, 이 계산기는 FORMULA.md가 승인한 정상 입력
범위 안에서 이미 Number가 실패한다 — 이 계산기가 "Number로 충분하다"는 결론에 도달하지
못하는 결정적 이유다.

**"정수 스케일링"(예: 8자리 스케일 후 `Number`로 산술)도 이 계산기에는 통하지 않는다** —
다른 계산기(severance-pay 등)의 정수 스케일링은 스케일된 값도 안전 정수 범위 안에
머물렀기 때문에 유효했다. 이 계산기는 스케일 자체가 상한을 더 키운다: `holdingQty`
스케일 값만으로 `10^15 × 10^8 = 10^23`이라 스케일링 여부와 무관하게 애초에 `Number`
정수 표현 범위를 벗어난다. 즉 이 계산기에서 "정수 스케일링"이 안전하려면 스케일된
정수 자체가 임의 정밀도 정수 자료형(`BigInt`)이어야 하고, 이는 사실상 FORMULA.md가
권장한 "BigInt 고정소수점 스케일링"과 같은 것이다 — "Number 정수 스케일링"과 "BigInt
고정소수점 스케일링"은 이 계산기 규모에서 별개의 선택지가 아니라 하나로 수렴한다.

### 2.3 왜 `decimal.js`/`big.js`가 아니라 네이티브 `BigInt`인가 — FORMULA.md 근거 재확인

FORMULA.md의 논거를 직접 검증했다.

- **연산 횟수가 매우 적고 자릿수 상한이 고정돼 있다.** 곱셈 2회(비용 계산)·덧셈 2회(합산)·
  나눗셈 1~2회(평균·변동액)뿐이며, 소수 자릿수 상한도 (제품 결정으로) 항상 8로 고정이다.
  이런 조건에서는 "정수부+소수부를 8자리로 정규화해 BigInt로 변환 → BigInt 산술(완전정밀도)
  → 표시 직전 1회 나머지 기반 반올림"만으로 임의정밀도 라이브러리와 동일한 안전성을 얻는다.
- **`decimal.js`/`big.js`를 추가하면 이 사이트의 "모든 계산기에 무조건 무거운 decimal
  라이브러리를 쓰지 않는다"는 원칙(docs/ARCHITECTURE.md)에 부합하지 않는 실익 없는
  의존성 추가가 된다** — bill-split-calculator가 `html-to-image` 채택 시 적용한 것과
  같은 "번들 크기/의존성 대비 실익" 판단 기준을 적용하면, 네이티브 `BigInt`(의존성 0개,
  ES2020부터 모든 대상 브라우저가 지원)로 동일한 안전성을 이미 얻을 수 있는데 별도
  라이브러리를 추가할 이유가 없다.
- **반례 검토**: `BigInt`의 알려진 약점(정수 나눗셈만 지원해 자동으로 소수부가 버려짐)이
  다른 계산기(예: loan-interest-calculator가 "사사오입 정책과 상성이 나쁘다"며 BigInt를
  기각한 이유)에서는 채택 안 하는 근거였다. 이 계산기는 그 약점을 FORMULA.md가 제시한
  "나머지 기반 사사오입 나눗셈"(`divRoundHalfUp`, 아래 "3." 참고) 헬퍼 함수 하나로 정확히
  상쇄한다 — 나눗셈이 필요한 지점이 (평균 계산·변동액 계산) 단 두 곳뿐이라 이 헬퍼 하나로
  충분하며, loan-interest-calculator처럼 480회 반복 나눗셈이 필요한 구조가 아니다.
- **결론**: `decimal.js`/`big.js`가 제공하는 "임의 정밀도"라는 일반해는 이 계산기가 실제로
  필요로 하는 "정확히 8자리 고정소수점 + 연산 5회 이하"라는 특수해보다 과하다. 네이티브
  `BigInt` + 직접 구현한 소규모 유틸(아래 "3.")로 충분하다는 FORMULA.md의 판단을 그대로
  확정한다.

### 2.4 왜 외부 결과 타입에서 `number`가 아니라 `DecimalString`을 쓰는가 (BigInt 채택이
"타입 경계"까지 이어져야 하는 이유 — Architect가 FORMULA.md보다 한 걸음 더 나간 지점)

FORMULA.md는 "BigInt로 계산하라"까지만 명시했고, 계산 결과를 **어떤 자료형으로 노출할지**는
언급하지 않았다(그 문서의 책임 범위 밖 — 타입 설계는 Architect 소관). 직접 재계산한 결과,
계산을 BigInt로 정확히 해도 **결과를 `number`로 변환해 반환하는 순간 그 경계에서 정밀도가
다시 소실될 수 있다**는 것을 확인했다 — 이는 FORMULA.md가 명시적으로 다루지 않은 위험이라
이 문서에서 결정 근거를 남긴다.

- **`newAveragePrice`조차 `number`로는 위험하다.** FORMULA.md 입력 상한상 단가는 "100억원
  (10^10), 소수 8자리까지" 허용된다. 즉 `9999999999.99999999`처럼 **정수부 10자리 +
  소수부 8자리 = 유효자리 18자리**인 값이 정상적으로 유효한 입력이자 결과값일 수 있다.
  `Number`(배정밀도, 유효자리 약 15~17자리)는 이 자릿수를 정확히 표현하지 못한다 — 이는
  "극단적으로 억지스러운 조합"이 아니라 FORMULA.md가 그대로 승인한 입력 범위 안의 값이다.
- **`totalCost`는 훨씬 더 심각하다.** `holdingQty × holdingPrice`의 상한은
  `10^15 × 10^10 = 10^25` 수준이다(검증 예제 10이 이미 지적). `totalCost`는 SPEC.md
  Must Have 출력 필드이므로 이 극단값에서도 정확히 표시해야 하는데, `number`로는 애초에
  이 크기의 정수를 정확히 저장할 방법이 없다(가장 가까운 표현 가능한 배정밀도 실수로
  반올림되어 마지막 여러 자리가 임의의 값으로 바뀐다 — "근사치가 아니라 다른 숫자"가
  나올 수 있다는 뜻).
- **`totalQty`도 이론상 같은 위험이 있다**(정수부 최대 10^15 + 소수부 8자리 = 유효자리
  23자리) — 실제로 이 조합(최대 수량 + 최대 소수 자릿수)이 동시에 나타날 현실적 가능성은
  낮지만, validation.ts가 이 조합을 형식적으로 막지 않는 한(그리고 막을 근거도 없다 —
  FORMULA.md가 수량 상한과 소수 자릿수 상한을 독립적으로 정의했다) 타입 설계 단계에서
  "이런 조합은 안 들어올 것"이라고 가정하지 않는다.
- **`priceChangeAmount`도 `newAveragePrice`와 같은 상한 구조**(단가 차이이므로)라 동일하게
  적용한다.
- **결정**: 위 네 필드는 `types.ts`에서 `Won = number`가 아니라 `DecimalString = string`으로
  선언했다(이미 작성 완료 — 아래 "5." 참고). BigInt 내부 연산을 아무리 정확히 해도 결과
  타입이 `number`이면 그 순간 정밀도가 재도입되므로, "BigInt를 채택한다"는 결정은 계산
  함수 내부만이 아니라 **그 함수가 반환하는 타입의 경계**까지 일관되게 지켜야 의미가
  있다 — 이것이 이 섹션의 핵심 주장이다.
- **부수 이점**: `DecimalString`은 `JSON.stringify`로 직렬화 가능하다. `BigInt`는
  `JSON.stringify`가 지원하지 않아(`TypeError: Do not know how to serialize a BigInt`)
  결과 타입에 `BigInt`를 그대로 노출했다면 `src/lib/share.ts`의 공유 URL 인코딩
  (`encodeShareState` → `JSON.stringify`)이 애초에 깨졌을 것이다. `DecimalString`을
  선택함으로써 이 문제가 자연스럽게 해결된다(별도 직렬화 어댑터가 필요 없다).
- **예외: `priceChangeRate`(%)는 `number`로 유지한다.** 이 값은 FORMULA.md "단위" 절이
  이미 "계산 자체는 완전정밀도 나눗셈 후 표시 직전 반올림"이라고 명시한, 표시용으로
  근사되는 비율이다(다른 계산기의 `annualRatePercent`류 비율 필드와 동일 성격). 소수
  둘째 자리로 반올림해 표시하는 값에서 배정밀도 상대오차(~2.2×10^-16)가 결과에 영향을 줄
  여지가 없다 — 이 값이 이론상 매우 커질 수 있는 경우(단가 하한 10^-8원과 상한 100억원을
  극단적으로 조합하면 비율이 10^20% 수준까지 커질 수 있음)는 정밀도 문제가 아니라
  "비정상적으로 큰 숫자를 어떻게 표시할지"의 UX 문제이므로 이 절의 범위 밖이다(Builder/
  UX Critic이 formatting.ts에서 필요 시 축약 표기를 검토할 수 있으나 강제하지 않는다).

### 2.5 확정: `decimal-scale.ts` 유틸 함수 시그니처

FORMULA.md "정밀도/반올림 정책"이 제시한 알고리즘(문자열 기반 스케일링, 나머지 기반
사사오입)을 그대로 구현하는 계산기 전용 유틸 모듈이다. **아직 이 파일 자체는 생성하지
않았다(Builder 몫)** — 다만 아래 시그니처는 이 라운드에서 확정하며, Builder는 이 계약을
임의로 바꾸지 않는다(Calculation Auditor가 이 시그니처에 직접 의존하는 단위 테스트를
작성할 것이므로 — bill-split-calculator의 `RandomSource`/`pickWinnerIndex` 시그니처를
Builder가 임의로 바꾸지 않기로 한 것과 같은 이유).

```ts
// src/calculators/average-cost-calculator/decimal-scale.ts

export const SCALE_DECIMALS = 8;
export const SCALE_FACTOR = 10n ** BigInt(SCALE_DECIMALS); // 100_000_000n

/**
 * 부호 없는 순수 십진수 형식인지만 검사한다(자릿수 상한은 검사하지 않음 — 그건
 * countDecimalPlaces로 별도 검사). "0", "0.5", "10000" 등만 허용하고 지수 표기(1e10),
 * 부호(+/-), 공백, 다중 소수점, 빈 문자열은 모두 false.
 */
export function isPlainUnsignedDecimal(value: string): boolean;

/** 소수점 이하 자릿수. 정수(소수점 없음)는 0을 반환한다. 형식이 올바른 값에만 호출한다. */
export function countDecimalPlaces(value: string): number;

/**
 * `isPlainUnsignedDecimal(value)`가 true이고 `countDecimalPlaces(value) <= scale`인 값만
 * 호출한다는 전제로, `value × 10^scale`을 나타내는 BigInt로 변환한다. **parseFloat/Number를
 * 전혀 거치지 않고** 정수부/소수부 문자열을 직접 분리 → 소수부를 scale 자리로 우측
 * 0-패딩 → 문자열을 이어붙여 BigInt로 변환한다(FORMULA.md "문자열 기반 스케일링" 그대로).
 * 전제가 깨지면 예외를 던진다 — 호출부(validation.ts)가 반드시 먼저
 * isPlainUnsignedDecimal/countDecimalPlaces로 형식을 확인한 뒤에만 호출해야 한다.
 */
export function toScaledBigInt(value: string, scale?: number): bigint;

/**
 * 나머지 기반 사사오입 나눗셈(FORMULA.md 알고리즘 그대로). `numerator >= 0n`,
 * `denominator > 0n` 전제 — 이 계산기는 수량·단가가 항상 0 초과라는 입력 검증을 거치므로
 * 이 전제가 항상 성립하는 지점에서만 쓴다. **부호 있는 값(예: priceChangeAmount)에는
 * 절대값에 적용한 뒤 호출부가 부호를 별도로 복원한다** — 이 함수 자체가 부호를 처리하지
 * 않는다(FORMULA.md 알고리즘이 애초에 "분모가 항상 양수"만 전제하고 분자의 부호는
 * 다루지 않았다는 점을 그대로 반영).
 */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint;

/**
 * `value × 10^decimals`를 나타내는 (음수 가능) BigInt를 십진 문자열로 되돌린다. **반올림하지
 * 않는다** — 순수 자릿수 삽입 함수다. 호출 전에 이미 `divRoundHalfUp` 등으로 반올림이 끝나
 * 있어야 한다(중복 반올림 방지 — 표시 단계 1회만 반올림한다는 FORMULA.md 정책을 지키려면
 * "반올림"과 "문자열 포맷"을 서로 다른 함수로 분리해야 한다).
 */
export function fromScaledBigInt(scaledValue: bigint, decimals: number): string;

/**
 * 두 유효 십진 문자열을 정확히 비교한다(문자열 사전식 비교 금지 — 예: "9" > "10"이 사전식
 * 비교로는 참이 되는 함정을 피한다). 내부적으로 `toScaledBigInt`로 변환한 뒤 BigInt로
 * 비교한다. logic.test.ts의 불변식 검증(예: "새평단가가 min/max 사이")과 direction 판정
 * 양쪽에서 재사용한다.
 */
export function compareDecimalStrings(a: string, b: string, scale?: number): -1 | 0 | 1;
```

**설계 원칙**:
- 이 파일은 "평단가"라는 도메인 지식이 전혀 없는 순수 산술 primitive 모음이다(어떤 필드가
  가격인지 수량인지 모른다) — `bill-split-calculator`의 `pickWinnerIndex`/
  `fisherYatesShuffle`(도메인 의미 없는 순수 RNG 알고리즘)과 같은 성격이다.
- **`src/lib/`로 승격하지 않는다.** 이 사이트에 "수량 자체가 소수인 계산기"가 아직 이것
  하나뿐이다 — `housing-subscription-score`/`loan-interest-calculator`/
  `bill-split-calculator`가 반복해서 세운 "아직 사례가 1개뿐이면 승격하지 않는다" 원칙을
  그대로 적용한다. 다음에 유사한 소수 수량 계산기(예: 다른 코인 관련 계산기)가 필요해지면
  그때 `src/lib/decimal-scale.ts` 승격을 재검토한다.
- FORMULA.md가 정한 구체적 상한값(수량 10^15, 단가 100억원)은 이 파일에 두지 않는다 —
  이 파일은 스케일(8)과 사사오입 알고리즘만 알고, 상한 비교는 그 값을 아는
  `validation.ts`(아래 "4." 참고)의 책임이다. 도메인 지식(상한값)과 순수 산술(스케일링)을
  분리해야 FORMULA.md의 상한이 나중에 바뀌어도 이 파일을 수정할 필요가 없다.
- `logic.ts`는 FORMULA.md "계산 순서" 1~9단계를 이 primitive들을 조합해 그대로 구현한다
  (예: `새평단가 스케일드 = divRoundHalfUp(totalCostScaled * 10n**BigInt(priceResultDecimals),
  totalQtyScaled * SCALE_FACTOR)`). 이 wiring 자체는 FORMULA.md가 이미 단계별로 상세히
  지정했으므로 Architect가 다시 정의하지 않는다(Formula Analyst 영역 재침범 방지) —
  Builder가 FORMULA.md "계산 순서"를 그대로 코드로 옮긴다.

### 2.6 안전성 재확인 — 극단 조합에서 BigInt 연산 자체가 안전한가

`BigInt`는 정의상 임의 정밀도 정수이므로 자릿수 상한이 없다 — `10^15 × 10^8 = 10^23`,
`10^23 × 10^18 = 10^41` 같은 중간값도 `BigInt` 곱셈에서는 정확히 계산된다(JS 엔진이
필요한 만큼 내부적으로 여러 워드를 쓴다). loan-interest-calculator가 "정수 연산이 안전
정수 범위 안에 머무는지"를 검증해야 했던 것과 달리, 이 계산기는 애초에 `BigInt`를 쓰는
이유 자체가 "안전 정수 범위라는 개념을 완전히 벗어난다"는 것이므로 범위 재계산이 필요
없다 — `BigInt` 연산 자체의 정확성은 자료형 선택만으로 이미 보장된다. Calculation
Auditor가 확인해야 할 지점은 연산의 정확성이 아니라 **"어디선가 실수로 `Number()`를
거치는 코드가 섞여 들어가 정밀도를 재도입하지 않았는가"**(예: `toScaledBigInt`를 쓰지
않고 실수로 `Number(rawInput) * 1e8`을 쓰는 실수, 또는 결과를 `DecimalString` 대신
`Number(scaledValue) / 1e8`로 변환하는 실수)다 — 이 문서의 "2.4"가 왜 결과 타입까지
`DecimalString`으로 강제했는지의 이유이기도 하다(타입 시스템이 `number`를 반환하도록
허용하면 이런 실수가 컴파일 타임에 걸러지지 않는다).

---

## 3. 로직 폴더 구조 — 단일 `logic.ts` + 보조 primitive 파일 `decimal-scale.ts`

### 3.1 단일 `logic.ts` vs `logic/` 디렉터리 — **단일 파일로 확정**

`loan-interest-calculator`가 세운 판단 기준("여러 변형이 짧고 독립적인 연산의 나열이면
분기로 충분, 같은 모양의 복잡한 다단계 절차 여러 벌을 공유하면 파일 분할")과
`bill-split-calculator`가 재확인한 기준("방식이 여러 개라는 사실만으로 분할하지 않는다 —
실제 코드 길이·반복 구조를 먼저 본다")을 그대로 적용한다.

이 계산기의 v1 Must Have는 **분기 자체가 없다** — 정방향 가중평균 계산 하나뿐이다(상환
방식 3종, 분배 방식 3종처럼 "여러 변형"이 애초에 존재하지 않는다). FORMULA.md "계산 순서
(정방향)" 1~9단계도 순차적인 한 벌의 절차이지, 세 벌의 유사 절차가 아니다. 따라서
`logic/` 디렉터리로 분할할 근거 자체가 없다 — 단일 `logic.ts`에 진입점 함수 하나
(`calculateAverageCost`)만 두는 것으로 충분하다.

```
src/calculators/average-cost-calculator/logic.ts
  calculateAverageCost(input: AverageCostCalculatorInput): AverageCostCalculatorResult
  restoreAverageCostResult(state: AverageCostShareState): AverageCostCalculatorResult
```

`restoreAverageCostResult`는 `calculateAverageCost`의 얇은 별칭이다(입력 타입과 공유 상태
타입이 동일하므로 — 위 "5." `AverageCostShareState = AverageCostCalculatorInput` 참고).
RNG가 없어 "결정 단계"와 "재구성 단계"를 분리해야 했던 bill-split-calculator와 달리, 이
계산기는 애초에 입력이 같으면 결과가 항상 같으므로 별도 분리가 필요 없다 — 다만
`ui.tsx`/`useCalculatorShare` 호출부가 "공유 복원 전용 진입점"이라는 이름으로 명시적으로
부르고 싶어할 수 있어 얇은 별칭만 하나 열어 둔다(선택 사항, Builder가 굳이 별칭을 만들지
않고 `calculateAverageCost`를 그대로 재사용해도 무방하다 — 결과가 같으므로).

### 3.2 `decimal-scale.ts`를 `logic.ts`에 합치지 않고 별도 파일로 분리하는 이유

`bill-split-calculator`의 `ladder-layout.ts`(계산기 전용 보조 모듈을 `logic.ts` 밖으로
뺀 첫 선례)와 동일한 논리를 적용한다.

1. **도메인 경계**: `logic.ts`는 "가중평균 계산"이라는 도메인 지식을 갖지만,
   `decimal-scale.ts`는 "8자리 고정소수점 스케일링"이라는 도메인 지식 없는 순수 산술만
   안다. 섞으면 "이 파일에서 어디까지가 재사용 가능한 순수 산술이고 어디부터 이 계산기만의
   공식인지"가 흐려진다.
2. **테스트 성격이 다르다**: `decimal-scale.test.ts`는 FORMULA.md의 골든 예제와 무관하게
   순수 산술 자체(예: `toScaledBigInt("0.1") === 10000000n`, `divRoundHalfUp(5n, 2n) === 3n`,
   경계값 `divRoundHalfUp` 정확히 절반일 때 사사오입 방향)를 검증하는 반면,
   `logic.test.ts`는 FORMULA.md 검증 예제 1~10을 `calculateAverageCost` 호출로 재현하는
   Golden Test다. 두 테스트의 "정답 출처"가 다르므로(전자는 산술적 자기증명, 후자는
   FORMULA.md 대조) 파일을 분리하면 Calculation Auditor가 "이 실패가 산술 버그인지 공식
   적용 버그인지"를 즉시 구분할 수 있다.
3. **재사용 가능성을 코드 구조로 드러낸다** — 지금은 승격하지 않지만(위 "2.5" "설계
   원칙"), 별도 파일로 두면 다음 계산기가 이 파일을 그대로 복사해 시작하거나
   `src/lib/`로 승격하는 리팩터링이 훨씬 쉬워진다(`logic.ts`에 섞여 있으면 도메인 코드와
   분리하는 작업이 먼저 필요하다).

---

## 4. `validation.ts` 설계 지침 (Builder 몫, 흐름만 확정)

decimal-scale.ts의 형식 검증 primitive(`isPlainUnsignedDecimal`/`countDecimalPlaces`)와
FORMULA.md가 정한 상한값을 조합해 4개 필드 각각 다음 순서로 검증한다(zod
`.refine()` 체이닝, `docs/CALCULATOR_RULES.md` "모든 입력은 타입, 범위, 형식을 검증한다"):

1. `isPlainUnsignedDecimal(raw)` — 아니면 "숫자 형식이 올바르지 않습니다."
2. `countDecimalPlaces(raw) <= 8` — 아니면 "소수점 8자리까지 입력할 수 있습니다."
   (FORMULA.md "예외" 절 — 자동으로 반올림·절사하지 않고 계산 자체를 차단한다.)
3. `toScaledBigInt(raw)` (위 1·2를 통과했으므로 안전하게 호출 가능) `> 0n` — 아니면
   "0보다 큰 값을 입력해 주세요."
4. `toScaledBigInt(raw) <= UPPER_BOUND_SCALED`(수량은 `10n**15n * SCALE_FACTOR`, 단가는
   `10n**10n * SCALE_FACTOR`) — 아니면 "입력 상한을 초과했습니다." 이 상한 상수들은
   FORMULA.md "입력값" 표를 그대로 인용한 주석과 함께 `validation.ts`에 둔다(도메인
   지식이므로 `decimal-scale.ts`가 아니라 여기 둔다 — 위 "2.5" 설계 원칙 참고).

UI 계층은 기존 관례(`docs/DESIGN_SYSTEM.md` "금액 입력은 타이핑 중 실시간 천 단위 콤마를
표시한다 — 표시만 콤마, 검증/계산 전에 제거")를 그대로 따른다 — 콤마 제거 후의 원본 문자열이
바로 위 1번 단계에 들어가는 `raw`다. **이 계산기는 다른 계산기와 달리 `Number(raw)`로
변환하는 단계가 어디에도 없다** — 검증도 계산도 문자열/BigInt로만 이뤄진다는 것이 이
계산기 UI 폼 처리의 핵심 차이점이며, Builder가 반드시 지켜야 할 불변식이다(중간에
`Number()`가 한 번이라도 섞이면 위 "2.4"가 막으려던 정밀도 재도입이 그 지점에서 발생한다).

---

## 5. 타입 설계 — `types.ts` 확정 완료 (이번 라운드에 작성)

`src/calculators/average-cost-calculator/types.ts`를 작성했다(전체 내용은 파일 참고).
핵심 결정은 위 "2.4"에서 이미 근거를 설명했으므로 여기서는 요약만 한다.

- `DecimalString = string` — 검증을 통과한 0 초과 순수 십진 문자열.
- `AverageCostCalculatorInput`: `holdingQty`/`holdingPrice`/`additionalQty`/
  `additionalPrice` 4개 필드, 전부 `DecimalString`.
- `AverageCostShareState = AverageCostCalculatorInput`(별칭) — RNG 없음, 입력만으로
  결과가 결정적이므로 `bill-split-calculator`의 "equal" 모드와 동일하게 결과 스냅샷을
  따로 두지 않는다.
- `AverageCostCalculatorResult`: 입력 4개 echo + `newAveragePrice`/`totalQty`/
  `totalCost`/`priceChangeAmount`(전부 `DecimalString`) + `priceChangeRate`(`number`) +
  `direction`(`AverageCostDirection` 유니온) + `isRoundedToZeroButChanged`(`boolean`,
  FORMULA.md "모순 방지 규칙" 판정 결과) + `priceResultDecimals`/`qtyResultDecimals`
  (`number`, formatting.ts가 자릿수 맞춤에 사용).
- **판별 유니온을 쓰지 않았다** — loan-interest-calculator(상환방식 3종)·
  bill-split-calculator(분배방식 3종)와 달리 이 계산기는 "방식"이 하나뿐이므로(v1 Must
  Have 범위, 아래 "6." 참고) 분기할 대상 자체가 없다. 판별 유니온은 "핵심 결과 모양이
  방식마다 다를 때"를 위한 패턴인데, 이 계산기는 core 산식 자체가 언제나 하나다.

### logic.test.ts에서 `DecimalString` 비교 시 주의 (Builder에게 남기는 지침)

Golden Test와 완료 기준 불변식(예: "새평단가는 항상 min/max 사이") 검증 시
`DecimalString`을 `<`/`>` 연산자로 직접 비교하지 않는다 — 문자열 사전식 비교는 자릿수가
다르면 틀린 결과를 준다(`"9" > "10"`이 문자열 비교로는 `true`). 위 "2.5"의
`compareDecimalStrings` 헬퍼를 재사용한다. 정확히 일치해야 하는 Golden Test 기대값은
`toBe("86,172,191")`류의 포맷된 문자열이 아니라 `toBe("86172191")`처럼 포맷 이전의
정확한 `DecimalString` 원본과 대조한다(포맷팅은 `formatting.test.ts`가 별도로 검증).

---

## 6. Should Have(목표 평단가 역산) — 이번 라운드에는 타입/시그니처를 설계하지 않는다

SPEC.md가 이미 "목표 평단가 역산"을 Should Have로 v1 범위에서 명시적으로 제외했고,
FORMULA.md도 공식(②)과 유효성 조건(`Pc<Pt<P1`), 검증 예제(11~13)까지 이미 확정해 뒀다 —
언젠가 구현할 때 필요한 "정답"은 이미 다 갖춰져 있다. 그럼에도 이번 Architect 라운드에서는
이 기능의 타입(`requiredAdditionalQty` 등)이나 함수 시그니처를 지금 미리 설계하지 않고
**v1 Must Have 구현이 끝난 뒤의 별도 Architect 라운드로 미룬다.** 근거:

- **`docs/PRODUCT.md` "불필요한 기능 확장을 막는다"와 SPEC.md 자신의 논리를 그대로
  따른다.** SPEC.md는 목표 평단가 역산을 Should Have로 미룬 이유로 "검증해야 할 예외
  상황이 정방향보다 구조적으로 더 많다"(무효 조건 3종 — 이미 달성/도달 불가능/형식 오류)를
  들었다 — 이는 타입 설계 단계에도 그대로 적용된다. 지금 타입을 만들면 아직 구현되지
  않는 기능의 "무효 상태" 표현(예: 결과 타입에 `requiredAdditionalQty: number |
  { invalid: true; reason: ... }` 같은 분기)을 미리 확정해야 하는데, 실제 UI/UX 설계
  (에러 카드로 보여줄지, 별도 안내 문구로 보여줄지)가 나오지 않은 시점에 이 모양을
  고정하면 나중에 뒤집을 위험이 있다.
- **v1 타입과의 결합이 없다.** 목표 평단가 역산은 `holdingQty`/`holdingPrice`/
  `additionalPrice`/`targetPrice`를 입력받는 **별도 계산**이지 `calculateAverageCost`의
  옵션이 아니다(FORMULA.md "역방향(Should Have)" 계산 순서가 정방향과 독립적인 별도
  절차임을 보여준다). 즉 v1 타입(`AverageCostCalculatorInput`/`Result`)에 지금 필드를
  추가해 둘 이유가 전혀 없다 — 나중에 추가해도 기존 타입을 깨지 않는 순수 additive
  변경(새 인터페이스 `TargetPriceReverseInput`/`Result` 추가)이므로 지금 미리 자리를
  잡아둘 필요도 없다.
- **재사용 가능한 인프라는 이미 준비돼 있다.** 위 "2.5"의 `decimal-scale.ts` primitive
  (`toScaledBigInt`/`divRoundHalfUp`/`fromScaledBigInt`)는 이 역산 공식에도 그대로
  재사용 가능하도록 범용으로 설계했다 — 나중에 이 기능을 구현할 때 새 primitive를 만들
  필요 없이 `logic.ts`에 `calculateRequiredAdditionalQty(...)` 함수 하나와 그 결과 타입만
  추가하면 된다. 즉 "미루는 것"이 "다시 만드는 비용"으로 이어지지 않는다.
- **`bill-split-calculator`도 유사한 판단을 했다** — SPEC.md Should Have("결과 텍스트
  클립보드 복사")를 Architect 라운드에서 타입까지 미리 설계하지 않고 필요해질 때(에러
  폴백 경로로 실제로 쓰이게 됐을 때) 자연스럽게 다뤘다. 이번에도 동일하게, Should Have는
  "그 라운드가 실제로 시작될 때"의 Architect가 그 시점의 UX 결정과 함께 설계한다.

---

## 7. 공통 컴포넌트 재사용 검토

- **`ShareActions`**: 그대로 재사용한다. `payload.text`는 `formatting.ts`가 만드는 결과
  요약 문자열(예: "10주 12,000원 → 20주 10,000원, 평단가 2,000원 하락")이면 되고, 이
  계산기가 컴포넌트 자체를 수정할 이유가 없다. 공유 URL 인코딩(`encodeShareState`)은
  `AverageCostShareState`(= `AverageCostCalculatorInput`, 전부 `DecimalString`)를 그대로
  `JSON.stringify`하면 되므로 위 "2.4"가 확인한 대로 별도 처리 없이 호환된다.
- **`SectionCard`/`UsageGuide`/`IntroSection`/`FaqAccordion`**: 그대로 재사용한다. 이
  계산기가 이 네 컴포넌트의 계약을 바꿔야 할 이유가 없다.
- **핵심 결과 카드**: 새 컴포넌트를 만들지 않는다 — `docs/DESIGN_SYSTEM.md`의 `bg-primary`
  강조 카드 스타일을 다른 계산기와 동일하게 `ui.tsx`에서 직접 구현한다(이 스타일은
  애초에 "컴포넌트"가 아니라 CSS 클래스 조합이라 재사용할 컴포넌트 자체가 없다 — 다른
  계산기들도 각자 `ui.tsx`에서 직접 이 클래스를 쓴다).
- **새 컴포넌트 후보 — "방향 뱃지"(하락/상승/변동없음)**: SPEC.md가 요구한 "방향을 명확히
  라벨링"을 위해 색상/아이콘이 있는 작은 뱃지가 필요하다. 이 사이트에 아직 "가격
  등락 방향"을 표시하는 계산기가 없으므로(다른 계산기의 "증감"은 모두 순수 텍스트/숫자로만
  표현했다) 이번이 첫 사례다. `loan-interest-calculator`의 "년+개월 입력"·
  `bill-split-calculator`의 `RouletteWheel` 모두 "아직 사례가 1개뿐이면 승격하지 않는다"는
  원칙을 세웠으므로, 이번에도 `components/calculator/`로 승격하지 않고 계산기 전용 폴더
  안에 둔다. 구현 복잡도가 낮으므로(색상 있는 텍스트/아이콘 조합, SVG 애니메이션 같은
  복잡한 로직 없음) `RouletteWheel.tsx`처럼 별도 파일로 뺄 필요 없이 **`ui.tsx` 안의 로컬
  서브컴포넌트**로 구현하는 것을 권장한다(파일이 비대해지면 Builder 재량으로 분리 가능).
- **색상 토큰에 관한 주의(UX Critic에게 명시적으로 넘기는 판단)**: SPEC.md는 "상승(불타기)을
  오류로 취급하지 않는다"고 명시했다 — 따라서 "상승" 방향에 `text-danger`(에러용 빨간색
  토큰)를 쓰면 "이건 잘못된 결과"라는 잘못된 신호를 준다. 이 사이트에는 아직 "가격 상승/
  하락"을 표현하는 시맨틱 색상 토큰(예: 증권가 관행인 빨강=상승/파랑=하락, 또는 반대)이
  없다(`app/globals.css` 확인 결과 `--danger`/`--warning`만 있고 `--success`류 토�큰
  없음). **이번 Architect 라운드에서는 새 색상 토큰을 추가하지 않는다** — 방향 뱃지는
  우선 `text-primary`/`text-muted`/`border-border` 등 기존 중립 토큰과 텍스트 라벨(▲/▼
  화살표 아이콘 + "하락"/"상승" 문구)만으로 구현 가능하고, 실제로 색상 구분이 필요하다는
  판단은 UX/UI Critic 라운드에서 화면을 보고 내리는 것이 더 적절하다(임의로 hex 색상을
  넣지 않는다는 `docs/DESIGN_SYSTEM.md` 원칙과도 부합). 색상 토큰이 필요하다고 판단되면
  그때 `globals.css`에 `:root`/`.dark` 양쪽 값과 `@theme inline` 매핑을 추가한다.

---

## 8. 계산기 등록 전략

- 이번 Architect 라운드에서는 등록하지 않는다(위 "0." 참고, 기존 관례).
- Builder가 UI 구현을 완료하면 `registry.ts`에 다음으로 등록한다:
  ```
  slug: "average-cost-calculator"
  title: "평단가(물타기) 계산기"
  category: "finance"
  status: "draft"
  ```
- **아이콘 — 새 키 `"trend"` 신설을 권장한다(이번 라운드에서 코드에 반영하지는 않음).**
  SPEC.md "슬러그/카테고리"가 이미 "기존 6개 키 중 이 계산기의 '평단가 변동(하락/상승)
  효과'에 뚜렷이 맞는 키가 없다"며 새 아이콘 키(예: `trend`)를 Architect 재량으로
  검토하라고 위임했다. `finance` 카테고리에는 이미 `coins`(military-salary)·
  `chart`(loan-interest-calculator)가 있어 세 번째 계산기는 시각적으로 구분되는 새
  아이콘이 필요하다 — "등락 화살표"(위아래 화살표 또는 지그재그 추세선) 모양의 `trend`
  키를 신설해 `CalculatorMeta.icon` 유니온과 `CalculatorCard.tsx`의 `CalculatorIcon`
  매핑에 추가할 것을 권장한다. **이 코드 변경(공용 파일 `registry.ts`/
  `CalculatorCard.tsx` 수정)은 실제 등록 시점(Builder가 `status: "draft"`로 등록하는
  때)에 함께 하도록 미룬다** — 아래 "9. 회귀 방지 확인"이 명시하듯 이번 라운드는 공용
  파일을 전혀 건드리지 않는 것을 원칙으로 하기 때문이다.
- Calculation Auditor + UX/UI Critic + QA 통과 전에는 `published`로 바꾸지 않는다.

---

## 9. 회귀 방지 확인

**이번 라운드에서 공용 코드(`src/lib/`, `components/calculator/`, `src/calculators/registry.ts`,
`app/calculators/[slug]/page.tsx` 등 다른 계산기가 함께 쓰는 파일)를 전혀 수정하지
않았다.** 이번 라운드에서 실제로 만든 파일은 다음 두 개뿐이다:

- `src/calculators/average-cost-calculator/types.ts` (신규 파일, 이 계산기 전용 폴더 —
  다른 계산기가 import하지 않는다)
- `tasks/average-cost-calculator/ARCHITECTURE.md` (이 문서)

그 외에 다음 두 문서를 갱신했다(코드 아님, 문서):
- `docs/ARCHITECTURE.md` "숫자 정밀도 전략" 절 끝에 이번 계산기의 결정 사례 추가(기존
  내용 삭제·재배열 없이 append만 함).
- 루트 `PROGRESS.md`의 `average-cost-calculator` 행 "Formula" 컬럼을 `TODO` → `PASS`로
  갱신(Formula Analyst 단계가 이미 완료됐음을 반영 — 계산 로직 자체는 바꾸지 않았다).

따라서 **기존 계산기 13종에 대한 회귀 위험은 이번 라운드에서 발생하지 않는다** — 새
계산기 완료 후 요구되는 "기존 계산기 Smoke Test"(docs/EVALUATION.md)는 Builder가 이
계산기의 실제 구현을 마친 뒤(공용 코드를 처음 건드리게 될 시점 — 위 "8."의 아이콘 추가
등) 수행하는 것이 합리적이며, 이번 Architect 단계에서는 실행 대상 변경 자체가 없다.

---

## 10. Builder 인수인계 요약

1. `types.ts` — 이미 작성 완료(위 "5." 그대로). 새 필드가 필요하면 이 문서의 설계 원칙
   (`DecimalString` 경계, 판별 유니온 미사용 근거)을 유지한 채 추가한다.
2. `decimal-scale.ts` — 위 "2.5" 시그니처를 그대로 구현. `toScaledBigInt`는 parseFloat/
   Number를 절대 거치지 않는다(문자열 직접 분해). `divRoundHalfUp`은 FORMULA.md 알고리즘
   그대로(나머지×2 ≥ 분모 → 올림).
3. `logic.ts` — `calculateAverageCost(input): AverageCostCalculatorResult`.
   FORMULA.md "계산 순서(정방향)" 1~9단계를 `decimal-scale.ts` primitive로 그대로 구현.
   `direction`은 반드시 스케일된 BigInt 비교로 판정(반올림된 표시값과 절대 비교하지
   않는다 — FORMULA.md "모순 방지 규칙" 1번). `priceChangeAmount`는 부호 있는 값이므로
   절대값에 `divRoundHalfUp` 적용 후 `direction`에 따라 부호를 복원한다(위 "2.5"
   `divRoundHalfUp` 설명 참고).
4. `validation.ts` — 위 "4." 4단계 검증 흐름을 4개 필드에 각각 적용. 상한 상수
   (`10n**15n`, `10n**10n`)에 FORMULA.md "입력값" 표 출처 주석을 남긴다.
5. `logic.test.ts` — FORMULA.md 검증 예제 1~10을 `calculateAverageCost`로 그대로
   Golden Test로 옮긴다(외부 출처 대조 3건: 예제 1·2·3). 완료 기준 불변식(min/max 범위,
   방향별 부등식, 수렴성)도 `compareDecimalStrings`로 검증. Should Have 예제 11~13은
   이번 라운드에 구현하지 않으므로 테스트도 작성하지 않는다(위 "6." 참고).
6. `decimal-scale.test.ts` — 순수 산술 단위 테스트(정상 케이스, 소수점 없음/있음, 8자리
   경계, 정확히 .5인 사사오입 경계, `compareDecimalStrings`의 자릿수가 다른 두 값 비교).
7. `formatting.ts` — `DecimalString`을 천 단위 콤마가 포함된 표시 문자열로 바꾸는 포맷터
   (BigInt 정수부는 `Intl.NumberFormat('ko-KR').format(BigInt(integerPart))`로 그룹 구분
   가능 — 정수부가 안전 정수 범위를 넘어도 `Intl.NumberFormat`은 BigInt를 직접 받아
   정확히 포맷한다, 소수부는 문자열로 그대로 붙인다). `isRoundedToZeroButChanged`가
   true일 때의 보조 설명 문구, 계산 근거(breakdown) 문자열 조립, `direction`별 라벨.
8. `content.ts` — 소개("평단가"·"물타기"·"불타기" 용어 설명), 사용법, FAQ, 계산 전제
   고지(수수료·세금 미반영, 소수 8자리 처리 기준).
9. `ui.tsx` — 입력(보유 수량 → 보유 평단가 → 추가 매수 수량 → 추가 매수 단가, 전부
   `inputMode="decimal"` 텍스트 입력으로 문자열 상태 유지 — `Number()` 변환 금지, 위 "4."
   마지막 문단 참고), 방향 뱃지 로컬 서브컴포넌트(위 "7."), 핵심 결과 카드, 보조 결과,
   계산 근거, `ShareActions`(계산 전·후 동일 위치).
10. 레지스트리에 `status: "draft"`로 등록 + 아이콘 `trend` 신설(`CalculatorMeta.icon`
    유니온과 `CalculatorCard.tsx` 매핑에 함께 추가, 위 "8." 참고) — 이 시점에 처음으로
    공용 파일을 건드리게 되므로, 그 직후 기존 계산기 Smoke Test를 실행한다
    (docs/EVALUATION.md "회귀 방지").

---

## 11. 남은 리스크 / 확인 필요

- FORMULA.md "확인 필요 목록"(업비트 자릿수 정책 1차 출처 미확보, 증권사 수수료 포함
  여부, calctools.co.kr 오류 원인)은 Architect 영역 밖이다 — 이미 FORMULA.md가 "계산
  정확성에는 영향 없음"으로 판단했으므로 재확인을 강제하지 않는다.
- 이 문서 "2.4"가 지적한 "정수부+소수부 동시 극단값" 조합(예: 수량이 10^15에 가까우면서
  동시에 소수 8자리를 모두 채우는 입력)은 FORMULA.md Golden Test(예제 10)가 정수 값만으로
  검증했다 — Builder는 Edge Case Test에 이 조합(예: `holdingQty=999999999999999.12345678`)을
  추가해 `DecimalString` 경계가 실제로 안전한지(즉 `Number`를 전혀 거치지 않는지) 확인할
  것을 권장한다(docs/CALCULATOR_RULES.md "Edge Case Test" — 매우 큰 값 항목).
- `decimal-scale.ts`가 이 사이트 최초의 `BigInt` 채택 사례이므로, Calculation Auditor는
  "Number 구현과 BigInt 구현을 대조해 예제 6에서 값이 갈리는지 확인하라"는 FORMULA.md의
  권고를 실제로 수행할 것을 권장한다(예: 의도적으로 `Number` 기반의 미검증 구현을 참고용
  스크립트로 짜서 예제 6·10의 결과가 실제로 달라지는지 재현 — 이 문서 "2.2"/"2.4"의
  수식 기반 분석이 실측과 일치하는지 확인).
