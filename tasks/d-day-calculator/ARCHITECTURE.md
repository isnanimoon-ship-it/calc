# ARCHITECTURE: 디데이 계산기 (d-day-calculator)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-12.
계산 공식 자체는 정의하지 않는다(Formula Analyst 소관, `diff`/`add`/요일 공식과 반올림
정책(사실상 반올림 없음)을 바꾸지 않았다). 여기서는 코드 배치, 타입, 날짜 유틸 공용화 범위,
UI 구조만 정한다.

관련 문서: docs/ARCHITECTURE.md("결정 사례: 날짜 계산 유틸 공용화", "결정 사례: 순수 날짜
산술 함수의 공용화 범위 재확인"), docs/CALCULATOR_RULES.md("날짜 계산기", "Golden Test"),
docs/DESIGN_SYSTEM.md. 참고 선례: `tasks/average-cost-calculator/ARCHITECTURE.md`·
`tasks/loan-interest-calculator/ARCHITECTURE.md`(문서 형식, "0. 레지스트리 상태 확인"
관례), `tasks/business-days/SPEC.md`/`src/calculators/business-days/types.ts`(모드
탭 분리·판별 유니온의 직접 선례), `src/lib/date-calc.ts`(순수 날짜 산술 공용화 기존 결정).

이 계산기는 **법령·정책 데이터가 전혀 없는 순수 그레고리력 산술 계산기**라는 점에서
loan-interest-calculator·average-cost-calculator·bill-split-calculator와 같은 부류지만,
이 사이트에서 **이미 검증된 날짜 산술이 최소 3곳(`src/lib/date-calc.ts`,
`military-discharge-date/logic.ts`, `age-calculator/date-utils.ts`)에 중복 구현돼 있는
상태에서 네 번째로 등장하는 날짜 계산기**라는 점이 이번 라운드의 핵심 판단 지점이다. 아래
"1."이 이 문서의 핵심이다.

---

## 0. 레지스트리 상태 확인

`src/calculators/registry.ts` 확인 결과 `d-day-calculator` slug는 아직 등록되어 있지
않다. 이번 Architect 라운드에서도 등록하지 않는다(기존 관례 — average-cost-calculator·
loan-interest-calculator 모두 Architect 라운드에서는 등록하지 않고 Builder가 구현 완료 시
`status: "draft"`로 등록했다) — 아래 "8. 계산기 등록 전략" 참고.

`src/calculators/d-day-calculator/` 폴더는 이번 라운드에서 `types.ts` 하나만 생성했다(아래
"5." 참고). `logic.ts` 등 실제 계산 코드는 아직 없다(Builder 몫).

`PROGRESS.md`의 `d-day-calculator` 행 "Formula" 컬럼이 `TODO`로 남아 있었는데, FORMULA.md는
이미 기준/공식/26개 Golden Test/"기준·출처" 스키마까지 전부 채워 완료된 상태였다(Formula
Analyst 단계가 실제로는 끝나 있었다) — average-cost-calculator Architect 라운드가 같은
상황에서 취한 조치와 동일하게, 이번 라운드에서 `TODO` → `PASS`로 갱신했다(아래 "9." 참고,
이 자체는 Architect의 새 작업이 아니라 이미 끝난 단계의 기록 반영이다).

---

## 1. 날짜 유틸 공용화 여부 (핵심 결정) — `parseIsoDateUtc`/`diffDaysUtc`는 그대로 재사용,
`addDaysUtc`/`weekdayUtc`/`formatIsoDateUtc` 3개를 `src/lib/date-calc.ts`에 신규 추가

### 1.1 문제 상황 — 같은 네 가지 원자 연산이 이미 2~3곳에 중복 구현돼 있다

| 원자 연산 | `src/lib/date-calc.ts` | `military-discharge-date/logic.ts` | `age-calculator/date-utils.ts` |
|---|---|---|---|
| 문자열 파싱+검증 | `parseIsoDateUtc(iso): Date\|null` (왕복 검증 포함) | `parseIso`(검증 없음, `validation.ts`가 별도 처리) | `parseIso`(검증 없음) |
| 날짜 차이 | `diffDaysUtc(start: Date, end: Date): number` | `differenceInDays(from: string, to: string): number` | `differenceInDays(from: string, to: string): number` |
| 날짜+N일 이동 | (없음) | `addCalendarDays(value: string, days: number): string` | (없음) |
| 요일 계산 | (없음) | (없음) | `weekday(value: string): number` |

세 파일 모두 **동일한 핵심 알고리즘**(`Math.floor(Date.UTC(y,m-1,d)/86_400_000)` 기반 일련
번호, `getUTCDay()` 기반 요일)을 쓰지만 **시그니처가 다르다** — `date-calc.ts`는 Date 객체를
입출력하고, 나머지 둘은 ISO 문자열을 직접 입출력한다. FORMULA.md "공식 출처"가 이 세 파일을
모두 "동일 알고리즘을 이미 프로덕션에서 검증한 패턴"으로 직접 인용했으므로(위 표), 이번
계산기가 이 네 연산을 또 한 번(네 번째로) 새로 구현하면 드리프트 위험이 더 커진다.

### 1.2 판단 기준 — docs/ARCHITECTURE.md 기존 원칙 적용

docs/ARCHITECTURE.md "결정 사례: 순수 날짜 산술 함수의 공용화 범위 재확인"
(housing-subscription-score 라운드)이 이미 이런 상황을 위한 기준을 세워 뒀다. 이번
라운드는 그 기준을 그대로 적용한다.

1. **"함수 자체가 도메인 의미 없는 순수 산술인가"** — `diff`(날짜 차이), `add`(날짜+N일
   이동), `weekday`(요일)는 "이 값이 몇 점인지/며칠부터 지급 대상인지" 같은 계산기별 해석이
   전혀 없는 순수 그레고리력 산술이다. 자격이 있다.
2. **"한 계산기 내부에서 ≥2회 재사용되는 것만으로도 공용 함수로 뽑을 이유가 된다"** —
   이 계산기 하나만 봐도 `weekday`는 모드 B의 `resultDate` 1회 + 모드 A Should Have의
   `startDate`/`targetDate` 2회로 총 3회, `add`는 모드 B에서 1회 쓰이지만 모드 A/B
   역함수 불변식 검증(완료 기준, Golden Test #25~#26)에서 로직뿐 아니라 **테스트 코드도**
   `add`를 반복 호출한다. 인라인으로 두면 계산기 하나 안에서도 드리프트 위험이 생긴다.
3. **"공용화가 항상 기존 구현까지 리팩터링을 의미하지는 않는다"** — `military-discharge-date`·
   `age-calculator`는 이미 `published` 상태이고 각자의 문자열 기반 API로 자체 Golden
   Test까지 갖췄다. "복붙 대신 추출"이 안전하려면 로직을 한 글자도 바꾸지 않고 이동할 수
   있어야 하는데, 이 두 계산기는 **Date 객체가 아니라 문자열을 직접 입출력하는 다른 시그니처**를
   쓰고 있어 "이동"이 아니라 "재작성"이 필요하다 — 이는 이번 작업 범위 밖의 회귀 위험을
   새로 만든다(housing-subscription-score가 age-calculator를 통합하지 않은 것과 정확히
   같은 이유).

### 1.3 확정 결정

- **`parseIsoDateUtc`/`diffDaysUtc`는 그대로 import해서 쓴다.** 이 두 함수는 이미
  `src/lib/date-calc.ts`에 있고 Date 객체 기반 시그니처이며 이 계산기가 그대로 필요로 하는
  모양(문자열 검증+파싱, 날짜 차이)과 정확히 일치한다 — 새로 만들 이유가 전혀 없다.
- **`addDaysUtc(date: Date, days: number): Date`, `weekdayUtc(date: Date): number`,
  `formatIsoDateUtc(date: Date): string`(Date → 문자열, `parseIsoDateUtc`의 역함수) 3개를
  `src/lib/date-calc.ts`에 신규 추가한다(이번 라운드에서 이미 작성 완료 — 아래 "1.5" 참고).**
  `military-discharge-date`/`age-calculator`의 기존 코드는 전혀 수정하지 않는다(그 두
  계산기는 계속 자기 파일의 문자열 기반 함수를 쓴다) — 이것은 "기존 배포 계산기 리팩터링"이
  아니라 "새 함수를 순수 추가만 하는 것"이라 회귀 위험이 없다(위 "1.2"의 3번 기준과
  일관됨).
- **`d-day-calculator`의 `logic.ts`는 내부적으로 Date 객체 기반으로 구현한다** —
  ISO 문자열 입력을 `parseIsoDateUtc`로 Date로 바꾼 뒤 `diffDaysUtc`/`addDaysUtc`/
  `weekdayUtc`로 계산하고, 결과 문자열이 필요한 지점(모드 B의 `resultDate`)에서만
  `formatIsoDateUtc`로 되돌린다. `military-discharge-date`/`age-calculator`처럼 계산기
  전용 `serial`/`fromSerial`/`daySerial`/`weekday` 함수를 새로 작성하지 않는다 — 그렇게
  하면 이번에 또 다섯 번째 중복 구현이 생긴다.

### 1.4 왜 이번엔 "새로 추가"가 "리스크 낮음"인가

- `military-discharge-date`/`age-calculator`의 기존 파일을 한 줄도 건드리지 않는다 — 두
  계산기의 published 동작에 영향을 줄 수 있는 경로가 물리적으로 없다.
- `src/lib/date-calc.ts`에 새 함수 3개를 **append**만 했다(기존 `parseIsoDateUtc`/
  `diffDaysUtc`/`lastDayOfMonthUtc`/`calendarMonthsBeforeUtc`/
  `calculateCalendarPeriodDaysBefore`/`calendarFullYearsBetweenUtc`/
  `calendarFullMonthsBetweenUtc`는 한 글자도 수정하지 않았다). 이 파일을 import하는 기존
  계산기(unemployment-benefit, severance-pay, housing-subscription-score)는 이번
  변경과 무관하다 — 이미 이번 라운드에서 전체 테스트 스위트(70개 파일, 842개 테스트)를
  재실행해 회귀가 없음을 확인했다(아래 "9." 참고).
- 새 함수 3개 모두 기존 함수 알고리즘과 수학적으로 동일함을 직접 검증했다(아래 "1.5"의
  각 함수 docstring 참고) — 예를 들어 `addDaysUtc`는 `date.getTime() + days*MS_PER_DAY`를
  쓰는데, `parseIsoDateUtc`가 만든 Date는 항상 UTC 자정(시:분:초:밀리초 0)이므로
  `date.getTime()`이 이미 `daySerial(date) * 86_400_000`과 정확히 같다 — 따라서 이 구현은
  `military-discharge-date`의 `daySerial`+`fromSerial` 조합과 동일한 값을 낸다(별도
  일련번호 변수를 거치지 않을 뿐, 수식은 동일). FORMULA.md의 공식을 바꾼 것이 아니라
  **동일 공식의 다른 구현 경로**를 선택한 것이다.

### 1.5 `src/lib/date-calc.ts`에 추가한 함수 (이미 작성 완료)

```ts
/** date에 days일을 더한(음수면 뺀) UTC 자정 기준 Date. daySerial(date)+days와 수학적으로 동일. */
export function addDaysUtc(date: Date, days: number): Date;

/** UTC 자정 기준 Date의 요일 인덱스(0=일요일~6=토요일, getUTCDay() 표준). */
export function weekdayUtc(date: Date): number;

/** UTC 자정 기준 Date를 "YYYY-MM-DD" 문자열로. parseIsoDateUtc의 역함수. */
export function formatIsoDateUtc(date: Date): string;
```

`src/lib/date-calc.test.ts`에도 이 세 함수의 계약 테스트를 추가했다(FORMULA.md Golden
Test #16~#22, #25, "요일 계산 검증" 표의 6개 앵커값을 그대로 옮김) — 기존 파일의 관례(각
계산기 FORMULA.md 예제를 인용하는 주석, `d(iso)` 헬퍼 재사용)를 그대로 따랐다. 전체
테스트 스위트 재실행 결과 70개 파일 842개 테스트 전부 통과(회귀 없음).

### 1.6 참고 — `todayInKorea()` 중복은 이번 범위 밖

`military-discharge-date/ui.tsx`, `age-calculator/ui.tsx`, `housing-subscription-score/ui.tsx`
세 곳 모두 `Intl.DateTimeFormat(..., { timeZone: "Asia/Seoul" })` 기반의 `todayInKorea()`
(또는 `todayIso()`)를 거의 동일한 코드로 각자 갖고 있다 — 이 역시 공용화 후보이지만, 이번
Architect 작업 지시는 명시적으로 "문자열 파싱/날짜 차이/날짜 이동/요일 계산" 네 가지로 범위를
한정했다. `d-day-calculator`도 동일한 관례(계산기 전용 `ui.tsx` 안에 로컬 함수로 구현)를
그대로 따르고, 이 중복의 공용화는 이번 라운드에서 다루지 않는다(다음에 이 패턴을 다루는
라운드가 있으면 재검토).

---

## 2. 숫자 정밀도 전략 — 일반 `Number`, 스케일링/`BigInt`/`decimal.js` 전혀 불필요

FORMULA.md "정밀도/반올림 정책"이 이미 "모든 날짜 연산은 정수(일련번호) 산술만 사용한다"고
명시했다. Architect가 직접 안전 범위를 재확인한다(다른 계산기 라운드가 Formula Analyst의
의견을 그대로 받지 않고 직접 재계산해 확정한 것과 동일한 방법론).

- **다루는 모든 수치가 이미 정수다**: 날짜 직렬번호(`daySerial`), 일수 차이(`diff`), 이동
  일수(`days`, 최대 100,000), 요일 인덱스(0~6). 반올림이 필요한 소수 자체가 존재하지 않는다
  (FORMULA.md "예외" 절과 동일 결론).
- **안전 정수 범위 확인**: FORMULA.md "N 상한 근거"가 이미 계산한 대로 지원 범위 전체
  폭은 109,937일(약 301년), 밀리초로 환산해도 약 9.5×10^12ms 수준이다 —
  `Number.MAX_SAFE_INTEGER`(약 9.007×10^15)의 1/1,000 이하로 압도적으로 안전하다.
  `addDaysUtc`의 `date.getTime() + days * MS_PER_DAY` 계산에서 가장 큰 중간값(2200년경
  Date의 getTime() 절대값 + 100,000일 이동분)도 마찬가지로 안전 범위 안이다(1970년 기준
  ±273,790년까지 표현 가능한 JS `Date` 자체의 여유 범위와도 별개로, 이 계산기가 실제로
  다루는 값은 그 부분집합인 1900~2200년 범위로 훨씬 작다).
- **`BigInt`/`decimal.js`/`big.js`는 실익이 없다** — 이 계산기는 애초에 소수를 다루지 않고
  (average-cost-calculator가 `BigInt`를 채택해야 했던 이유였던 "소수 수량 × 소수 단가"
  같은 상황 자체가 없다), 정수 산술만으로 충분해 무거운 의존성을 추가할 이유가 없다
  (docs/ARCHITECTURE.md "모든 계산기에 무조건 무거운 decimal 라이브러리를 쓰지 않는다").
- **`Math.round`가 `diffDaysUtc` 내부에 있지만 이 계산기에서는 항상 정확히 나눠떨어진다** —
  `addDaysUtc`로 만든 Date는 항상 UTC 자정(시:분:초:밀리초 0)이므로 두 Date의 시간 차이는
  항상 `MS_PER_DAY`의 정수배다. `Math.round`는 부동소수점 표현 오차에 대한 방어적 안전장치일
  뿐, 이 계산기의 계산 결과를 절사·반올림하는 정책적 의미가 아니다(FORMULA.md "정밀도/반올림
  정책"과 모순되지 않는다 — 애초에 반올림 대상 자체가 없다는 그 문서의 결론과 일치).

결론: 정밀도 전략에 관해 Builder가 결정할 것이 없다 — 일반 `Number` 정수 산술을 그대로
쓰면 된다.

---

## 3. 상태 구조 — 모드 A/B를 완전히 독립된 두 벌의 state로 분리 (business-days와의 명시적 차이)

### 3.1 business-days 선례를 그대로 따르지 않는 이유

SPEC.md는 "탭으로 두 모드를 분리한다"는 UI 패턴을 `business-days`에서 그대로 가져왔지만,
`business-days/ui.tsx`를 실제로 확인한 결과 그 계산기는 **모드 전환 시 입력·결과를
보존하지 않는다** — `form`(모드 판별 태그 포함) 하나, `result` 하나만 있고 모드를 바꾸면
같은 `form`/`result`를 계속 덮어쓴다. 반면 `d-day-calculator` SPEC.md Must Have는 "모드
전환 후에도 각 모드의 입력값과 계산 결과를 서로 보존해 혼동시키지 않는다"를 **명시적으로
새로 요구**한다 — 즉 SPEC.md는 business-days에서 "탭 UI"라는 패턴만 가져왔을 뿐, "상태
보존" 요구는 이번 계산기가 처음이다. 이 차이를 문서로 남겨 둔다(다음에 이 SPEC.md를 읽는
사람이 business-days 코드를 그대로 참고해 상태 보존을 빠뜨리지 않도록).

### 3.2 확정: 모드별로 완전히 독립된 `useState` 3종 세트

```tsx
const [activeMode, setActiveMode] = useState<DdayCalculatorMode>("dday");

// 모드 A
const [ddayForm, setDdayForm] = useState<RawDdayInput>({ startDate: today, targetDate: "" });
const [ddayErrors, setDdayErrors] = useState<Record<string, string>>({});
const [ddayResult, setDdayResult] = useState<DdayCalculationResult | null>(null);

// 모드 B
const [shiftForm, setShiftForm] = useState<RawDateShiftInput>({ baseDate: today, days: "", direction: "add" });
const [shiftErrors, setShiftErrors] = useState<Record<string, string>>({});
const [shiftResult, setShiftResult] = useState<DateShiftCalculationResult | null>(null);
```

`activeMode`를 바꾸는 탭/라디오 클릭은 **오직 어느 입력·결과 블록을 보여줄지만** 바꾸고,
다른 모드의 세 state는 절대 초기화하지 않는다 — "보존"을 별도 캐시/복사 로직 없이 애초에
두 상태를 섞지 않는 것으로 구조적으로 보장한다(가장 단순하고 실수할 여지가 적은 방식).
`types.ts`가 모드 A/B 타입을 판별 유니온 하나로 묶지 않고 독립된 인터페이스 두 벌로 설계한
이유가 바로 이것이다(위 "5." 및 `types.ts` 파일 상단 주석 참고) — 판별 유니온으로 묶으면
"현재 보이지 않는 모드의 state"를 표현하기 애매해진다.

### 3.3 탭/세그먼트 UI 구현 — `business-days`의 "스타일 입힌 라디오" 패턴 재사용

이 사이트에는 아직 ARIA `role="tablist"` 기반 탭 컴포넌트가 없다(전수 확인 결과 0건).
`business-days/ui.tsx`가 이미 "계산 방식" 선택에 쓴 패턴(시각적으로는 세그먼트 버튼처럼
보이지만 실제로는 `<input type="radio" className="sr-only">` + 스타일 입힌 `<label>`)을
그대로 재사용한다 — SPEC.md "모드 전환은 실제 탭 또는 라디오 그룹으로 구현하고 키보드로
조작할 수 있어야 한다"는 요건을 이미 이 패턴이 만족함을 business-days의 Audit/QA 통과
이력이 보여준다. 새 공용 Tab 컴포넌트를 만들지 않는다(아직 이 패턴이 필요한 계산기가
2개뿐이라 `components/calculator/`로 승격하지 않는다 — housing-subscription-score/
loan-interest-calculator가 반복한 "사례 1~2개면 승격하지 않는다" 원칙과 동일).

---

## 4. 폴더/파일 구조

```
src/calculators/d-day-calculator/
  types.ts          # 입력·결과 타입 (Architect 완성 — 이번 라운드에 작성함, 위 "5.")
  logic.ts          # calculateDday(input), calculateDateShift(input), computeWeeksBreakdown(n)
  logic.test.ts     # FORMULA.md Golden Test 26개 + 역함수 불변식 (아래 "6.")
  validation.ts     # 모드 A/B 입력 검증 (zod), 지원 범위 상수(1900-01-01~2200-12-31)
  validation.test.ts
  formatting.ts     # 문장형 설명, YYYY년 M월 D일 포맷, 요일 한국어 라벨, 주 단위 환산 문자열,
                     # "오늘" 배지 판정(isToday), 계산 근거(수식 breakdown) 조립
  formatting.test.ts
  content.ts        # 소개, 사용 방법, FAQ, 계산 전제 고지 문구
  ui.tsx            # 모드 탭 전환 + 독립 상태 2벌(위 "3.") + 결과 UI
```

`logic/` 디렉터리로 분할하지 않고 단일 `logic.ts`로 확정한다. `loan-interest-calculator`가
세운 기준("여러 변형이 짧고 독립적인 연산의 나열이면 분기로 충분, 같은 모양의 복잡한
다단계 절차 여러 벌을 공유하면 파일 분할")과 `bill-split-calculator`가 재확인한 기준을
그대로 적용하면, 이 계산기의 모드 A(`diff` 한 줄 + 라벨 분기)와 모드 B(`add` 한 줄 +
범위 재검증)는 각각 매우 짧고(FORMULA.md "계산 순서"가 각 5~6단계지만 각 단계가 함수 호출
한두 줄 수준), 둘이 공유하는 "복잡한 반복 골격" 자체가 없다(회차 반복 같은 루프가 없다) —
`four-major-insurance`/`business-days`와 같은 "분기로 충분한" 부류다.

`calculateDday`/`calculateDateShift`는 서로를 호출하지 않지만 같은 원자 함수
(`parseIsoDateUtc`/`diffDaysUtc`/`addDaysUtc`/`weekdayUtc`/`formatIsoDateUtc`)를
`src/lib/date-calc.ts`에서 함께 import해 쓴다 — 이것이 SPEC.md "계산 방식(공통)"이 요구하는
"같은 날짜 유틸(순수 함수)을 공유해 구현"의 실체이며, FORMULA.md "모드 A ↔ 모드 B 역함수
불변식"이 항상 성립하는 이유이기도 하다(같은 산술 함수를 쓰므로 서로 다른 경로로 계산해
값이 갈릴 여지가 구조적으로 없다).

`computeWeeksBreakdown(n: number): WeeksBreakdown | null`은 FORMULA.md "주 단위 환산" 공식을
그대로 구현하는 순수 함수로, 모드 A 결과 조립에 쓰인다(`n=0`이면 `null`). Should Have 범위상
v1은 모드 A에서만 실제로 호출·노출하지만, FORMULA.md 공식 자체가 모드 A/B 모두에 적용 가능한
일반형(`n = |diff|` 또는 `n = days`)이므로 이 함수를 모드 A 전용으로 짜지 않고 `n: number`
하나만 받는 범용 함수로 둔다 — 나중에 모드 B에도 노출하고 싶어지면 `logic.ts`를 건드리지
않고 `ui.tsx`/`formatting.ts`에서 이 함수를 한 번 더 호출하기만 하면 된다.

---

## 5. 타입 설계 — `types.ts` 확정 완료 (이번 라운드에 작성)

`src/calculators/d-day-calculator/types.ts`를 작성했다(전체 내용은 파일 참고). 핵심
결정은 위 "3.1"에서 이미 설명했으므로 요약만 한다.

- `Weekday = 0|1|2|3|4|5|6`(`getUTCDay()` 규약 그대로) — 한국어 라벨 매핑은 `formatting.ts`
  책임(`weekdayLabels` 같은 배열, `age-calculator/formatting.ts`의 `weekdayLabels` 선례와
  동일한 형태를 이 계산기 전용으로 둔다 — 공용화하지 않는다, 이유는 위 "1.6"과 동일하게
  이번 범위 밖).
- `DdayCalculationInput`/`DdayCalculationResult`(모드 A), `DateShiftCalculationInput`/
  `DateShiftCalculationResult`(모드 B) — **판별 유니온으로 묶지 않고 독립된 타입 두 벌**로
  설계했다(위 "3.1"·"3.2" 근거, `business-days`의 `mode` 판별 유니온과 의도적으로 다른
  선택).
- `ddayLabel: string`은 로직 단계 산출물이다(포맷팅이 아니라 FORMULA.md가 명시적으로 정의한
  정확한 형식의 계산 결과) — `average-cost-calculator`의 `direction`,
  `loan-interest-calculator`의 판별 유니온 필드처럼 "로직이 반환하는 범주형/정형 값"과 같은
  성격이다. 반면 "2026년 12월 25일까지 104일 남았습니다" 같은 한국어 문장은 `formatting.ts`가
  `diffDays`/`targetDate`로부터 별도로 조립한다 — `housing-subscription-score`가 세운
  "로직 값만, 문장 조립은 formatting.ts" 경계를 그대로 따른다.
- `DdayCalculatorShareState`만 유일하게 판별 유니온(`mode: "dday"|"dateShift"`)을 쓴다 —
  공유 URL은 "그 순간 활성 모드 하나"만 직렬화하면 되므로, 화면 state와 달리 공유 상태는
  하나로 묶는 것이 자연스럽다(`business-days`가 공유 상태에 `{f: form, ...}`로 판별 필드가
  포함된 `form` 전체를 그대로 담은 것과 같은 방식).
- `ValidationResult` 판별 유니온(`{success:true,data}|{success:false,errors}`)은
  `age-calculator/validation.ts` 선례를 따라 이 계산기의 `validation.ts`에 로컬로 정의한다
  (types.ts에 두지 않음 — 기존 계산기들의 일관된 배치).

---

## 6. Golden Test 배치 전략 — 단일 `logic.test.ts`, FORMULA.md 3개 그룹을 `describe`로 분리

FORMULA.md의 26개 Golden Test는 성격상 "모드 A(#1~15)", "모드 B(#16~24)", "모드 A↔B
역함수(#25~26)" 세 그룹이지만, **세 그룹 모두 같은 두 함수(`calculateDday`/
`calculateDateShift`)를 호출해 FORMULA.md 대조값과 비교하는 동일한 성격의 테스트**다 —
`average-cost-calculator`가 `logic.test.ts`(공식 대조)와 `decimal-scale.test.ts`(순수
산술 자기증명)를 분리한 이유("정답의 출처가 다르다")가 이 계산기에는 적용되지 않는다.
따라서 단일 `logic.test.ts` 파일에 담되, 가독성과 Auditor의 부분 재실행 편의를 위해
`describe` 블록으로 세 그룹을 나눈다(`loan-interest-calculator`의 단일 파일 + 그룹화
관례와 동일):

```ts
describe("calculateDday — 모드 A: 날짜 차이 (FORMULA.md Golden Test #1~#15)", ...)
describe("calculateDateShift — 모드 B: 날짜 계산 (FORMULA.md Golden Test #16~#24)", ...)
describe("모드 A ↔ 모드 B 역함수 불변식 (FORMULA.md Golden Test #25~#26, 완료 기준)", ...)
```

- 순수 날짜 산술 원자 함수(`addDaysUtc`/`weekdayUtc`/`formatIsoDateUtc`) 자체의 계약
  테스트는 이미 `src/lib/date-calc.test.ts`에 이번 라운드에서 추가해 뒀다(위 "1.5") — 이
  덕분에 `d-day-calculator/logic.test.ts`가 실패하면 "날짜 산술 자체의 문제"가 아니라
  "모드 조립(라벨 분기, 범위 재검증 등) 로직의 문제"로 원인을 좁혀 볼 수 있다(원자
  연산과 조립 로직의 테스트 책임을 분리하는 것은 `calendarFullYearsBetweenUtc` 도입 때부터
  이 사이트가 지켜온 관례).
- `computeWeeksBreakdown`은 로직상 매우 단순한 순수 함수(나눗셈 1회 + 분기 4가지)이지만
  FORMULA.md 예제(#4·#5)가 이미 구체값(`14주 6일`, `36주 2일`)을 제시했으므로 별도 파일로
  빼지 않고 `logic.test.ts`에 같은 `describe` 안에서 함께 검증한다 — `decimal-scale.ts`
  수준의 복잡한 별도 primitive 모듈이 필요할 만큼 로직이 크지 않다(4줄 이내).
- 완료 기준 불변식(모드 A: 시작일=목표일→D-Day 등, 모드 B: 결과일-기준일 항상 정확히 N)도
  개별 Golden Test 값과 별개로 `it.each`류 property 성격 테스트를 추가할 것을 Builder에게
  권장한다(loan-interest-calculator의 "완료 기준 불변식 2종" 추가 관례와 동일).
- `docs/CALCULATOR_RULES.md` "Golden Test"가 요구하는 "공식 계산기 대조 최소 2건"은 이
  계산기에는 적용 방식이 다르다 — FORMULA.md 자체가 "법령·고시가 아니라 그레고리력 규칙 +
  독립 알고리즘(Zeller's Congruence, Howard Hinnant `days_from_civil`) 교차검증"을 출처로
  명시했으므로(loan-interest-calculator/average-cost-calculator가 "재무수학"/"산술
  자기증명"을 출처로 삼은 것과 동일한 패턴), Golden Test 주석에는 "○○ 계산기 대조"가 아니라
  "FORMULA.md가 Zeller's Congruence/Hinnant 알고리즘으로 교차검증한 값" 형태로 출처를
  남기면 된다.

---

## 7. 공통 컴포넌트 재사용 검토

- **`ShareActions`**: 그대로 재사용한다. `text`는 활성 모드에 따라 formatting.ts가 만드는
  요약 문장(모드 A: "2026년 12월 25일까지 104일 남았습니다.", 모드 B: "2026년 9월 12일에서
  104일 후는 2026년 12월 25일(금)입니다.")을 그대로 쓰면 된다. 공유 URL 인코딩은 위 "5."의
  `DdayCalculatorShareState`(판별 유니온, 전부 원시 타입)를 그대로 `encodeShareState`에
  넘기면 되므로 별도 처리가 필요 없다(BigInt 미사용이라 average-cost-calculator가 겪은
  `JSON.stringify` 직렬화 문제도 없다).
- **`SectionCard`/`UsageGuide`/`IntroSection`/`FaqAccordion`**: 그대로 재사용한다. 이
  계산기가 네 컴포넌트의 계약을 바꿔야 할 이유가 없다.
- **핵심 결과 카드**: 새 컴포넌트를 만들지 않는다 — 다른 계산기와 동일하게 `bg-primary`
  강조 카드 스타일을 `ui.tsx`에서 직접 구현한다(순수 CSS 클래스 조합이라 컴포넌트화
  대상이 아니다, `average-cost-calculator`와 동일한 판단).
- **모드 탭 UI**: 새 컴포넌트를 만들지 않는다 — 위 "3.3" 참고, `business-days`가 이미 쓴
  "스타일 입힌 라디오" 패턴을 `ui.tsx` 로컬로 재사용한다.
- **"오늘" 배지**: 새 컴포넌트가 필요 없다 — `military-discharge-date`가 이미 이 패턴
  ("기준일이 오늘이면 배지, 아니면 실제 날짜 노출")을 갖고 있고 단순 조건부 렌더링(작은
  `<span>`)이므로 로컬 서브컴포넌트로 충분하다.

---

## 8. 계산기 등록 전략

- 이번 Architect 라운드에서는 등록하지 않는다(위 "0." 참고, 기존 관례).
- Builder가 UI 구현을 완료하면 `registry.ts`에 다음으로 등록한다:
  ```
  slug: "d-day-calculator"
  title: "디데이 계산기"
  category: "date"
  status: "draft"
  ```
- **아이콘: `calendar`(SPEC.md가 이미 확정한 값 그대로).** `date` 카테고리의
  `age-calculator`/`military-discharge-date`/`business-days`가 이미 모두 `calendar`를
  쓰고 있어 새 아이콘 키가 필요하지 않다(SPEC.md "슬러그/카테고리" 근거 그대로 수용 — 이
  네 계산기 모두 "날짜"라는 공통 시각 언어를 공유해도 문제되지 않는다는 기존 관례,
  `coins`도 여러 계산기가 카테고리 내에서 중복 사용 중인 것과 동일).
- Calculation Auditor + UX/UI Critic + QA 통과 전에는 `published`로 바꾸지 않는다.

---

## 9. 회귀 방지 확인

이번 라운드에서 실제로 수정·생성한 파일은 다음과 같다.

**공용 코드(다른 계산기가 함께 쓰는 파일) — 순수 추가(append)만 수행, 기존 내용 미수정**:
- `src/lib/date-calc.ts`: `addDaysUtc`/`weekdayUtc`/`formatIsoDateUtc` 3개 함수 추가(기존
  7개 함수는 한 글자도 수정하지 않음).
- `src/lib/date-calc.test.ts`: 위 3개 함수의 계약 테스트(`describe` 2개) 추가(기존 테스트는
  수정하지 않음).

**이 계산기 전용 신규 파일**:
- `src/calculators/d-day-calculator/types.ts` (신규 — 다른 계산기가 import하지 않는다).
- `tasks/d-day-calculator/ARCHITECTURE.md` (이 문서).

**문서만 갱신(코드 아님)**:
- `docs/ARCHITECTURE.md`: "날짜 계산" 절과 "숫자 정밀도 전략" 절 끝에 이번 계산기의 결정
  사례를 append(기존 내용 삭제·재배열 없음).
- 루트 `PROGRESS.md`: `d-day-calculator` 행 "Formula" 컬럼 `TODO` → `PASS` 갱신(위 "0."
  근거 — Formula Analyst 단계가 이미 끝나 있었음을 반영, 계산 로직 자체는 바꾸지 않았다).

**검증**: 위 `src/lib/date-calc.ts`/`date-calc.test.ts` 변경 직후 전체 테스트 스위트를
재실행해 70개 파일 842개 테스트 전부 통과를 확인했다(`npx vitest run`). `npx tsc --noEmit`도
오류 없이 통과했다. 따라서 **기존 계산기 14종에 대한 회귀 위험은 이번 라운드에서 발생하지
않는다.**

---

## 10. Builder 인수인계 요약

1. `types.ts` — 이미 작성 완료(위 "5." 그대로). 새 필드가 필요하면 이 문서의 설계 원칙
   (모드 A/B 독립 타입, `ddayLabel`은 로직 산출물, 공유 상태만 판별 유니온)을 유지한 채
   추가한다.
2. `logic.ts` —
   - `calculateDday(input: DdayCalculationInput): DdayCalculationResult`: FORMULA.md
     "계산 순서 — 모드 A" 1~5단계. `parseIsoDateUtc`로 두 날짜 파싱+범위 검증(1900-01-01~
     2200-12-31, 실패 시 예외 또는 validation.ts에서 사전 차단) → `diffDaysUtc`로 `diff`
     계산 → 부호별 `ddayLabel` 조립 → `computeWeeksBreakdown(Math.abs(diff))` → `diff===0`이면
     `null`로 override → `weekdayUtc`로 두 날짜 요일.
   - `calculateDateShift(input: DateShiftCalculationInput): DateShiftCalculationResult`:
     FORMULA.md "계산 순서 — 모드 B" 1~6단계. `direction`으로 `signedDays` 결정 →
     `addDaysUtc(parseIsoDateUtc(baseDate)!, signedDays)` → **결과도 지원 범위 안인지 다시
     검증(FORMULA.md 5단계, 생략 시 결함으로 반려 대상)** → `formatIsoDateUtc`로 문자열화 →
     `weekdayUtc`로 요일.
   - `computeWeeksBreakdown(n: number): WeeksBreakdown | null`: FORMULA.md "주 단위 환산"
     공식 그대로(`floor` 나눗셈만 사용, `n===0`이면 `null`).
   - 세 함수 모두 `src/lib/date-calc.ts`의 `parseIsoDateUtc`/`diffDaysUtc`/`addDaysUtc`/
     `weekdayUtc`/`formatIsoDateUtc`를 import해서 쓴다 — 계산기 전용 `serial`/`fromSerial`류
     함수를 새로 작성하지 않는다(위 "1.3").
3. `validation.ts` — zod(또는 동등한 수기 검증)로 모드 A/B 입력을 검증. 지원 범위 상수
   (`MIN_SUPPORTED_DATE = "1900-01-01"`, `MAX_SUPPORTED_DATE = "2200-12-31"`)와 모드 B
   `days` 상한(`100_000`)을 이 파일에 도메인 상수로 둔다(`src/lib/date-calc.ts`에 두지
   않는다 — 순수 산술과 이 계산기 고유 상한을 분리하는 `average-cost-calculator`의
   `decimal-scale.ts`/`validation.ts` 경계와 동일 원칙). `ValidationResult` 판별 유니온은
   `age-calculator/validation.ts` 선례대로 이 파일에 로컬로 정의한다.
4. `logic.test.ts` — 위 "6." 구조(단일 파일 + `describe` 3그룹)로 FORMULA.md Golden Test
   26개를 그대로 옮긴다. 완료 기준 불변식 테스트를 추가로 작성할 것을 권장.
5. `formatting.ts` — 문장형 설명(`"{targetDate}까지 {n}일 남았습니다."` 등, SPEC.md 예시
   문구 그대로), `formatKoreanDate`(`YYYY년 M월 D일`), `weekdayLabels`(한국어 요일 배열,
   이 계산기 전용 — `age-calculator/formatting.ts`의 동명 배열과 값은 같지만 공용화하지
   않음, 위 "1.6"과 같은 이유로 이번 범위 밖), `formatWeeksBreakdown(breakdown, diffSign)`
   (FORMULA.md 규칙대로 "전"/"후" 어미 부착), `isToday(dateIso, todayIso)`("오늘" 배지
   판정), 계산 근거(수식 breakdown) 문자열 조립.
6. `content.ts` — 소개(디데이·날짜 계산 개념 설명), 사용 방법, FAQ, 계산 전제 고지(순수
   달력일 계산, 영업일/공휴일 제외 없음, Asia/Seoul 기준).
7. `ui.tsx` — 위 "3." 상태 구조(모드별 독립 3종 세트) + 위 "3.3" 탭 UI + 모드별 입력 폼 +
   핵심 결과 카드(모드 A: `D-N`/`D-Day`/`D+N` 강조 + 문장형 설명 + 주 단위 환산 + 요일,
   모드 B: `YYYY년 M월 D일 (요일)` 강조 + 계산 근거) + `ShareActions`(계산 전·후 동일 위치,
   공유 상태는 `activeMode` 기준 판별 유니온) + "오늘로 되돌리기" 버튼(Should Have) + 소개/
   사용법/전제고지/FAQ. `todayInKorea()`는 로컬 함수로 구현(위 "1.6").
8. 레지스트리에 `status: "draft"`로 등록(위 "8.", 아이콘은 기존 `calendar` 재사용이라 공용
   파일의 아이콘 유니온/매핑 변경이 필요 없다 — `CalculatorCard.tsx` 수정 없이 등록만 하면
   된다).
9. 새 계산기 완료 후 기존 계산기 Smoke Test(docs/EVALUATION.md "회귀 방지") 실행 — 이번
   라운드는 `src/lib/date-calc.ts`에 함수를 추가했으므로(이 파일을 이미 쓰는
   unemployment-benefit/severance-pay/housing-subscription-score 포함) 원칙대로 전체
   테스트 스위트를 재실행해 확인한다(이미 이번 라운드에서 1회 확인했지만, Builder 구현
   완료 후 다시 한번 확인 권장).

---

## 11. 남은 리스크 / 확인 필요

- FORMULA.md가 "확인 필요"로 남긴 미확정 수치는 없다(문서 자체가 명시). Architect 영역에서
  추가로 발견한 리스크도 없다 — 이 계산기는 정책 데이터·법령 해석이 없어 다른 계산기들이
  겪은 "FORMULA.md 대 실제 법령" 종류의 리스크 자체가 구조적으로 없다.
- `addDaysUtc`가 `date.getTime() + days * MS_PER_DAY` 방식으로 구현되어 있어, 이론상 DST가
  있는 로컬 timezone Date를 넣으면 문제가 될 수 있다 — 그러나 이 함수는 항상
  `parseIsoDateUtc`가 만든 **UTC 자정 Date**만 입력으로 받는다는 전제이므로(문서화됨) 이
  전제가 깨지는 호출(예: `new Date()`를 직접 넣는 실수)이 없는지는 Calculation Auditor가
  `logic.ts`/`ui.tsx` 코드 리뷰에서 확인할 것을 권장한다.
- Golden Test #23("산술 결과는 범위를 벗어나지만 상한 통과")은 Builder가 "결과 재검증"
  단계를 빠뜨리기 가장 쉬운 케이스다(FORMULA.md도 "Builder가 생략하면 계산기 결함으로
  반려 대상"이라고 명시) — Calculation Auditor는 이 케이스를 최우선으로 확인할 것을
  권장한다.
