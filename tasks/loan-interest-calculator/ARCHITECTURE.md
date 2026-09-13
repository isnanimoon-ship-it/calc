# ARCHITECTURE: 대출 이자 계산기 (loan-interest-calculator)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-06.
계산 공식 자체는 정의하지 않는다(Formula Analyst 소관, 공식·반올림 정책을 바꾸지 않았다).
여기서는 코드 배치, 타입, 데이터 구조, UI 구조만 정한다.

관련 문서: docs/ARCHITECTURE.md, docs/CALCULATOR_RULES.md, docs/DESIGN_SYSTEM.md.
참고 선례: `tasks/four-major-insurance/ARCHITECTURE.md`(정책 없는 계산기의 숫자 정밀도 서술
방식, 표 형태 결과의 모바일 카드 전환), `tasks/housing-subscription-score/ARCHITECTURE.md`
(logic/formatting 경계, 공용화 판단 기준 세분화), `src/calculators/business-days/types.ts`
(판별 유니온 `mode`/`RangeResult`/`OffsetResult` — 이 문서가 채택한 `repaymentMethod` 판별
유니온의 직접 선례).

이 계산기는 이 사이트 최초로 (a) 정책형이 아니고(법령·요율 데이터 없음, 사용자가 직접 입력한
금리로만 계산), (b) 결과가 "회차별 스케줄 배열"(최대 480행)이라는 두 특징을 동시에 가진
계산기다. 아래 결정 중 일부(특히 "5.")는 이 특징 때문에 다른 계산기에는 아직 없던 새로운
판단이 필요했다.

---

## 0. 레지스트리 상태 확인

`src/calculators/registry.ts` 확인 결과 `loan-interest-calculator` slug는 아직 등록되어
있지 않다. 이번 Architect 라운드에서도 등록하지 않는다 — 아래 "9. 계산기 등록 전략" 참고,
Builder가 UI 구현을 완료할 때 `status: "draft"`로 등록한다.

`src/calculators/loan-interest-calculator/` 폴더는 이번 라운드에서 `types.ts` 하나만
생성했다(아래 "4." 참고). `logic.ts` 등 실제 계산 코드는 아직 없다(Builder 몫).

---

## 1. 숫자 정밀도 전략 (핵심 결정 4) — 일반 `Number`, 스케일링/BigInt/decimal 불필요 (확정)

FORMULA.md "구현 시 숫자 표현 권장" 절의 의견("일반 `Number`로 충분, `(1+r)^n` 계산 1회만
부동소수점 지수 연산 필요")을 그대로 **확정**한다. 다만 이 계산기는 이 사이트 최초로
거듭제곱(`(1+r)^n`, 최대 n=480)이 등장하므로, FORMULA.md의 주장을 액면 그대로 받지 않고
최악 조합(원금 상한 100억 원 × 연이율 상한 100% × 기간 상한 480개월)으로 직접 재계산해
확정 근거를 남긴다.

- **정수 값(원금·이자·원금상환액·상환액·잔액)의 안전 정수 범위 확인**: 최대 월이율은
  `100% / 12 ≈ 0.0833`. n=1(최소 기간, 최악의 단일 회차 부담)에서 원리금균등 앵커값
  `A = P×(1+r) ≈ 10,000,000,000 × 1.0833 ≈ 10,833,333,333원` — `Number.MAX_SAFE_INTEGER`
  (약 9.007×10^15)의 약 1/830,000 수준으로 압도적으로 안전하다. 480회 반복 누적
  (`totalInterest`, 각 회차 이자가 최대 이 스케일 수준일 때 480개 합산)도 최대 약
  `10,833,333,333 × 480 ≈ 5.2×10^12`로 여전히 안전 정수 범위의 1/1,700 수준이다.
  실무 대출(신용대출·주담대, 연이율 수 %~두 자릿수, 기간 최대 40년)에서는 이보다 훨씬
  작은 값만 나온다.
- **`(1+r)^n` 자체는 정수가 아니라 부동소수점 실수이므로 `MAX_SAFE_INTEGER` 논의 대상이
  아니다 — 대신 이 값이 최종 결과(`A`)의 유효자리를 얼마나 갉아먹는지가 관건이다.** 최악
  조합(r=0.0833, n=480)에서 `(1+r)^n ≈ e^(480×ln(1.0833)) ≈ e^38.4 ≈ 5×10^16`로 매우
  크다. 하지만 이 값은 `A = P×r×(1+r)^n / [(1+r)^n - 1]` 식에서 **분모·분자 양쪽에 모두
  등장하는 지배적 항**이다 — `(1+r)^n / [(1+r)^n - 1] = 1 / (1 - (1+r)^-n) ≈ 1 +
  (1+r)^-n`이고 `(1+r)^-n`은 n=480에서 극히 작은 값(약 2×10^-17)이므로, 이 비율은
  사실상 정확히 `1`에 수렴한다. 배정밀도 부동소수점의 상대오차(약 2.2×10^-16)가
  `(1+r)^n` 계산 자체에 섞여 들어가도, 이 오차가 최종 비율(`1`에 극히 가까운 값)에
  기여하는 **절대오차는 1원에 한참 못 미치는 수준**이다 — 즉 극단적 조합에서도 원 단위
  반올림 결과에 영향을 주지 않는다. 이 분석은 FORMULA.md가 예시로 든 실무 범위(연 5~6%,
  15~20년)보다 훨씬 가혹한 조건에서도 성립하므로, FORMULA.md의 "Number로 충분하다"는
  의견을 그대로 확정하는 근거로 삼는다.
- **`BigInt`**: 나눗셈에서 정수 나눗셈만 지원해(자동 절사) 이 계산기의 "사사오입" 반올림
  정책과 상성이 나쁘고, `(1+r)^n` 같은 실수 거듭제곱 연산 자체를 지원하지 않아 애초에
  적합하지 않다.
- **`decimal.js`/`big.js`**: 위 분석대로 이 계산기 규모에서 정밀도 문제가 실재하지 않아
  번들 크기·의존성만 늘린다(docs/ARCHITECTURE.md "모든 계산기에 무조건 무거운 decimal
  라이브러리를 쓰지 않는다").
- **회차별 반올림 재사용에 따른 오차 축적도 없다** — FORMULA.md "정밀도/반올림 정책"이
  이미 명시했듯 매 회차 값을 원 단위 정수로 확정해 다음 회차에 넘기므로, `잔액 × 월이율`
  곱셈 한 번에서만 소수가 생기고 즉시 반올림으로 제거된다. 480회 반복해도 부동소수점
  오차가 누적되지 않는 구조다(정수 스케일링을 쓰는 계산기들과 달리, 이 계산기는 "정수로
  즉시 확정"이라는 FORMULA.md의 정책 자체가 이미 오차 축적을 막는 역할을 한다).

---

## 2. 계산 로직 분리 방식 (핵심 결정 1) — `logic/` 디렉터리로 분할, 공통 골격은 `schedule-common.ts`

### 결정: 단일 `logic.ts` 대신 `logic/` 디렉터리 + `index.ts` 진입점

```
src/calculators/loan-interest-calculator/logic/
  index.ts               # 공개 진입점: calculateLoanInterest(input) — repaymentMethod로 분기
  schedule-common.ts      # 공통 골격: 회차 반복 러너 + 마지막 회차 강제 보정 + 연도별 집계
  equal-installment.ts    # 원리금균등 전용: 앵커(A) 계산 + 회차별 스텝 함수
  equal-principal.ts      # 원금균등 전용: 앵커(base) 계산 + 회차별 스텝 함수
  bullet.ts               # 만기일시 전용: 앵커(I) 계산 + 회차별 스텝 함수
```

다른 파일(`ui.tsx`, `logic.test.ts` 등)은 기존 관례와 동일하게 `from "./logic"`으로
import한다 — TypeScript/Next.js 모듈 해석 규칙상 `./logic`은 `./logic/index.ts`를
가리키므로 호출부 관례(단일 파일이라고 가정한 기존 `logic.ts` import 경로)를 그대로
유지할 수 있다.

### 왜 four-major-insurance 방식(한 함수 안에서 분기)이 아니라 파일 분할을 택했는가

`four-major-insurance/logic.ts`는 4개 보험 종류를 한 함수(`calculateFourMajorInsurance`)
안에서 순차적으로 계산한다 — 각 보험 계산은 "요율을 곱하고 상하한을 clamp"하는 한 줄~
몇 줄짜리 독립적 연산이라, 공유할 "반복 골격" 자체가 없다(보험 A의 계산이 보험 B의 계산에
개입할 여지가 없는 구조). `business-days`도 `logic.ts` 하나에서 `mode`로 분기하지만
공휴일 **데이터**만 `holidays.ts`로 뺐을 뿐 알고리즘 자체는 나누지 않았다.

이 계산기는 다르다 — FORMULA.md "계산 순서" 1~8단계가 명시하듯 세 상환방식이
**"앵커값 계산 → 회차 반복 → 마지막 회차 강제 보정 → 총계 → 연도별 집계"라는 다단계
알고리즘 골격을 공유하면서 각 단계의 세부 공식만 다르다.** 이는 "짧은 독립 연산 여러 개"가
아니라 "같은 모양의 복잡한 절차 세 벌"이므로, 한 함수 안에 세 분기를 넣으면 (a) 각
분기가 이미 앵커 계산 + 반복 루프 + 예외 처리(r=0 등)를 포함해 함수가 매우 길어지고,
(b) SPEC.md Must Have "계산 로직은... 상환방식별로 명확히 분리된 함수/모듈로 구현한다"가
요구하는 수준의 분리가 한 함수 내부 분기만으로는 시각적으로 드러나지 않으며, (c) Calculation
Auditor가 "원리금균등 공식만" 독립적으로 감사하기 어려워진다(다른 두 방식의 코드를
같이 읽어야 함). 파일 단위 분리는 이 세 가지 문제를 모두 해결하고, FORMULA.md의 "명확히
분리된 함수/모듈"이라는 요구를 문자 그대로 만족시킨다.

### 공통 골격은 별도 헬퍼로 뽑는다 (`schedule-common.ts`) — 독립 전체 로직 복붙은 하지 않는다

FORMULA.md "계산 순서" 6단계(마지막 회차 강제 보정)를 세 방식에 각각 다시 구현하면,
세 파일 중 하나만 수정되고 나머지가 방치되는 드리프트 위험이 생긴다 — 특히 이 단계는
SPEC.md "완료 기준" 불변식("Σ회차별 원금 상환액 = 대출 원금", "마지막 회차 이후 잔액은
0")을 **항상** 성립시켜야 하는 안전장치이므로, 세 벌로 흩어두면 그중 하나가 조용히
깨져도 알아채기 어렵다. 아래 사실이 이 공통화를 안전하게 만든다:

- **마지막 회차 강제 보정 공식은 세 방식 모두 완전히 동일하다.** FORMULA.md를 자세히
  보면 `원금상환액_n = 직전(n-1) 잔액 전액`, `이자_n = round(직전 잔액 × 월이율)`,
  `잔액_n = 0`이 세 방식 공통이다 — 만기일시상환도 예외가 아니다(원금이 만기까지 전혀
  줄지 않으므로 "직전 잔액"이 곧 원금 전액이 되어, 이 공식을 그대로 적용하면 자동으로
  "원금 전액 + 마지막 달 이자"가 나온다). 즉 이 단계는 방식별 특수 케이스가 필요 없는
  **진짜 공통 로직**이다.
- **연도별 집계(`yearlySummary`)도 완전히 공통이다** — `schedule[]`가 이미 확정된 뒤
  12개월 단위로 묶어 합산하는 순수 기계적 연산이라 상환방식과 무관하다.
- **회차 반복 루프(1~n-1회차)는 "매 회차 이자를 구하고 원금상환액/상환액을 구하고
  잔액을 갱신한다"는 뼈대는 공통이지만, 그 안의 세부 공식(이자에서 원금상환액을
  빼는지/더하는지, 원금상환액이 고정인지 등)은 방식마다 다르다** — 따라서 이 부분만
  방식별 "스텝 함수"로 주입받는 구조(콜백)로 설계한다:

```
runAmortizationSchedule({
  principal, monthlyRate, termMonths,
  computeRegularInstallment: (previousBalance, monthlyRate) => { interest, principalPayment, payment }
})
```

  `equal-installment.ts`/`equal-principal.ts`/`bullet.ts`는 각각 (1) 앵커값 계산 함수
  (`A_fixed`/`base_fixed`/`I_fixed`, r=0 등 방식별 특수 분기 포함)와 (2) 이 앵커값을
  클로저로 받는 `computeRegularInstallment` 함수만 구현해 `schedule-common.ts`의
  러너에 넘긴다. 마지막 회차 보정·연도별 집계·총계는 러너가 전담한다.
- 이렇게 하면 "공통 골격은 한 곳에서만 검증하면 된다"는 이점과 "방식별 고유 공식은
  독립적으로 읽고 감사할 수 있다"는 이점을 동시에 얻는다 — 이 사이트가 날짜 산술
  (`src/lib/date-calc.ts`)이나 4대 보험 근로자 부담분(`src/lib/social-insurance.ts`)에
  적용해 온 "두 계산기가 아니라 한 계산기 내부에서도 반복되는 순수 로직은 공용 헬퍼로
  뽑는다"는 원칙(housing-subscription-score Architect 라운드가 명시적으로 일반화한 기준
  — docs/ARCHITECTURE.md "결정 사례: 순수 날짜 산술 함수의 공용화 범위 재확인" 2번
  "한 계산기 내부에서 ≥2회 재사용되는 것만으로도 공용 함수로 뽑을 이유가 된다")을 이번엔
  "계산기 3종 사이"가 아니라 "한 계산기 안의 상환방식 3종 사이"에 그대로 적용한 것이다.

### r=0 특수 분기의 위치

FORMULA.md "월이율 0% 특수 케이스"(`0/0` NaN 방지)는 원리금균등 앵커 계산에서만
필요하다(원금균등의 `base=P/n`, 만기일시의 `I=P×r`는 r=0에서도 NaN 위험이 없다). 이
분기는 `equal-installment.ts`의 앵커 계산 함수 안에만 두고, `schedule-common.ts`의
공통 러너는 r=0 여부를 전혀 알 필요가 없다(러너 입장에서는 그냥 `monthlyRate=0`으로
계산되는 스텝 함수를 받을 뿐이다) — 방식별 특수 케이스가 공통 코드로 새어 들어가지
않도록 하는 경계다.

---

## 3. 결과 타입 설계 (핵심 결정 2) — `repaymentMethod` 판별 유니온, 이미 `types.ts`로 확정함

이번 라운드에서 `src/calculators/loan-interest-calculator/types.ts`를 작성해 확정했다.
핵심 결정:

- **`business-days`의 `mode` 판별 유니온(`RangeInput`/`OffsetInput`,
  `RangeResult`/`OffsetResult`) 선례를 그대로 따라 `repaymentMethod`를 판별 태그로 쓰는
  discriminated union으로 설계했다.** SPEC.md "계산 결과 — 상환방식별로 다른 템플릿"이
  세 방식의 핵심 결과 필드가 근본적으로 다르다고 명시한 만큼(원리금균등:
  `fixedMonthlyPayment` 하나 / 원금균등: `firstPayment`~`lastPayment` 범위 / 만기일시:
  `monthlyInterestBeforeMaturity` + `maturityPayment`), 하나의 인터페이스에 세 세트의
  optional 필드를 다 넣는 설계는 채택하지 않았다 — 그렇게 하면 예를 들어 원리금균등
  결과에서 `firstPayment`/`maturityPayment`가 항상 `undefined`인 필드로 타입에 나타나
      "이 값이 왜 없는지"를 매번 런타임에 방식을 다시 확인해야 하고, `docs/CALCULATOR_RULES.md`
  "서로 다른 계산 방식을 같은 공식으로 처리하지 않는다"는 원칙이 결과 화면·타입에서도
  흐려진다. `business-days`가 이미 이 문제를 판별 유니온으로 해결한 선례이므로 새로운
  패턴을 만들지 않고 그대로 따랐다.
- **다만 `business-days`처럼 공통 필드를 매 분기마다 반복 나열하지 않고
  `LoanCalculationBase`를 교차 타입(`&`)으로 합성했다.** `business-days`의 공통 필드는
  `mode`/`businessDays`/`excludedDays`/`reasonCounts` 정도로 적어 반복 비용이 낮았지만,
  이 계산기는 공통 필드가 7개(`principal`/`annualRatePercent`/`termMonths`/
  `monthlyRate`/`schedule`/`yearlySummary`/`totalInterest`/`totalPayment`)로 훨씬 많고
  그중 `schedule`/`yearlySummary`는 타입 자체가 배열이라 세 번 반복 정의하면 오타·드리프트
  위험이 커진다. 판별 유니온이라는 전략은 그대로 따르되, 구현 스타일만 반복을 줄이는
  쪽으로 조정했다 — `LoanCalculationBase`는 export하지 않고 세 분기 타입 안에서만
  합성해, 호출부가 이 베이스 타입 하나만으로 방식을 특정하지 않고 접근하는 것을 막는다.
- **`schedule`/`yearlySummary`를 공통 필드에 포함시켰다** — 세 방식 모두 스케줄과
  연도별 요약을 항상 계산·반환하므로(핵심 결정 1의 공통 골격 결과물), 이 두 필드는
  방식별로 다르지 않다.
- **`housing-subscription-score`의 "로직 값만, 문장 조립은 formatting.ts"라는 경계를
  그대로 따른다** — `types.ts`에는 breakdown 문자열, 경고 문구, "마지막 회차가 근소하게
  다를 수 있습니다" 같은 안내 카피를 넣지 않았다. 다만 이번엔 "핵심 결과 자체의 모양"이
  방식마다 다르다는 점이 housing-subscription-score와 다르므로, 그 차이는 문장 조립
  경계가 아니라 **타입 구조(판별 유니온) 자체**에서 이미 처리된다 — formatting.ts는
  이 판별 유니온을 그대로 받아 `result.repaymentMethod`로 분기해 표시 문자열만 만들면
  된다(예: `buildLoanKeyResultLabel(result)`가 방식별로 다른 라벨/값 조합을 리턴).

---

## 4. 회차별 스케줄(최대 480행) 데이터 구조와 UI 처리 (핵심 결정 3)

### `schedule[]`을 그대로 컴포넌트 state/props로 들고 다녀도 괜찮은가 — 그렇다

- **규모 자체가 문제되지 않는다.** 최대 480개 항목 × 5개 숫자 필드(`installment`,
  `principalPayment`, `interest`, `payment`, `balance`)는 순수 데이터로 수십 KB 수준이다
  — 웹 애플리케이션이 일상적으로 다루는 배열 크기(수천~수만 항목)에 한참 못 미친다.
  `annual-salary-take-home-pay`의 세액표(646행)와 달리 이건 **정적 JSON이 아니라 매
  계산마다 클라이언트에서 새로 생성되는 배열**이라는 차이는 있지만, 480회 반복 계산
  자체가 순수 산술(곱셈·뺄셈 1회씩)이라 1ms 미만에 끝난다 — 생성 비용도 문제가 아니다.
- **진짜 위험은 배열을 "state로 들고 다니는 것"이 아니라 "그대로 480개 DOM 행으로
  렌더링하는 것"이다.** React가 480개 객체를 `useState`로 들고 있는 것 자체는 참조
  하나만 바뀌는 얕은 비교라 리렌더 비용이 거의 없다. 하지만 이 배열을 그대로
  `<table>`에 480개 `<tr>`로 매핑하면 모바일에서 레이아웃/스크롤 성능이 나빠질 수
  있다 — 그런데 SPEC.md는 이미 이 문제를 인지해 "회차(월)별 전체 상세표"를 Should
  Have로 미뤘다(모바일에서 "한눈에" 파악하기 어렵다는 이유). **즉 v1은 애초에 480행을
  DOM에 렌더링하지 않는다** — 화면에는 `yearlySummary[]`(최대 40행, 40년 만기 기준)만
  표로 그린다. 480행 렌더링 성능 문제는 v1에서 아예 발생하지 않는다.
- **결론**: `schedule[]`을 `LoanInterestCalculatorResult`의 필드로 두고 계산 결과
  객체 하나(`useState<LoanInterestCalculatorResult | null>`)에 포함시켜 들고 다니는
  것을 그대로 채택한다. 별도의 "요약만 있는 경량 결과 타입"과 "상세 스케줄이 있는
  무거운 타입"으로 나누지 않는다 — 나누면 Should Have(회차별 상세표)를 나중에 추가할 때
  다시 계산해야 하는 번거로움이 생기고, 지금 나눌 실익(성능·메모리)이 없기 때문이다.

### `yearlySummary[]`는 `logic.ts`(정확히는 `logic/schedule-common.ts`)가 계산해서 반환한다 — `formatting.ts`로 미루지 않는다

- **`yearlySummary`는 숫자 집계(합산)이지 표시 포맷팅이 아니다.** `docs/ARCHITECTURE.md`
  "계산 로직 / UI 분리"가 그은 경계(`logic.ts` = 계산, `formatting.ts` = 표시용 포맷)를
  그대로 적용하면, "12개월씩 묶어 원금/이자를 더하고 연말 잔액을 뽑는다"는 연산은
  계산(숫자를 만들어내는 로직)이지 포맷(문자열을 만드는 로직)이 아니다 — `formatting.ts`가
  이미 계산된 숫자를 콤마·단위 붙여 문자열로 바꾸는 `weekly-holiday-allowance`의
  `formatWon`/`buildWeeklyHolidayBreakdown` 패턴과 대칭이 맞으려면, "더한다"는
  `logic`이 하고 "표시한다"는 `formatting`이 해야 한다.
  FORMULA.md "계산 순서" 8단계도 `yearlySummary` 집계를 명시적으로 계산 절차의 일부로
  적어 뒀다(로직 절차 안에 포함, 표시 절차가 아님).
- **Golden Test 가능성도 이 결정을 지지한다.** `logic.test.ts`가 `yearlySummary`의
  연도별 원금합계·이자합계·연말잔액을 FORMULA.md 검증 예제(특히 예제 9의 회차별 표)로
  정확히 검증하려면, 이 값이 `logic`의 순수 함수 출력이어야 한다 — `formatting.ts`로
  미루면 Golden Test가 "계산"이 아니라 "표시 로직"을 검증하는 모양이 되어 계산 정확성
  검증이라는 목적과 어긋난다.
- **`formatting.ts`는 `yearlySummary[]`를 받아 표시 문자열(원 단위 콤마, "1년차" 라벨
  등)로 바꾸는 역할만 한다** — 숫자를 다시 계산하거나 재집계하지 않는다.

---

## 5. 대출 기간 입력 UX — "년 + 개월" 조합 두 입력 필드로 결정

SPEC.md가 Architect/Builder에게 위임한 항목이다. **개월 수 단일 입력이 아니라 "년"과
"개월" 두 개의 숫자 입력을 나란히 받는 방식으로 결정한다** (내부적으로는 항상
`termMonths = years × 12 + months`로 환산해 `logic`에 전달 — FORMULA.md/`types.ts`
계약과 무관, UI 폼 레벨의 변환).

- **근거 1 — "계산법을 몰라도 쓸 수 있어야 한다"(docs/PRODUCT.md)를 문자 그대로 적용하면
  오히려 "개월 수만 입력"이 계산을 강요한다.** 이 계산기의 주 사용자 중 하나는 주택담보
  대출처럼 만기가 "20년", "30년"으로 통용되는 상품 사용자다(SPEC.md "주요 사용자"). 이런
  사용자에게 "개월 수를 입력하세요"라고만 하면 "20년 = 240개월"을 사용자가 암산해야
  한다 — 이는 정확히 이 계산기가 사용자 대신 없애 주려는 계산 부담을 사용자에게 되돌려
  주는 것이다.
  반대로 신용대출처럼 "12개월", "36개월"로 통용되는 짧은 대출 사용자에게는 개월 입력이
  더 자연스럽다 — 두 사용자군을 모두 만족시키려면 "년"과 "개월"을 함께 받아, 20년
  대출은 `20년 0개월`로, 18개월 대출은 `1년 6개월`(또는 `0년 18개월`도 입력 가능하게
  월 필드에 상한을 두지 않는 방식도 고려했으나 아래 참고)로 자연스럽게 표현하게 한다.
- **근거 2 — 대안(개월 단독 입력 + "년 단위 프리셋 버튼")도 검토했으나 기각.** 프리셋
  버튼(12/24/36/60/120/180/240/300/360개월 등)만으로는 "22년" 같은 프리셋에 없는
  값을 표현할 수 없어 결국 자유 입력 필드가 하나는 있어야 하고, 그러면 "년+개월 조합
  입력"과 "프리셋 버튼 + 자유 개월 입력"이라는 두 UI 중 후자가 입력 요소를 하나 더
  갖게 되어 오히려 복잡하다.
- **필드 설계**: "년"(정수, 0~40, 선택 아님 — 기본값 0) + "개월"(정수, 0~11, 기본값
  0) 두 입력을 라벨 하나("대출 기간") 아래 나란히 배치한다(`DESIGN_SYSTEM.md` "입력
  순서·그룹핑" — 하나의 개념을 이루는 필드는 인접시킨다). 개월 필드를 0~11로 제한하는
  이유는 "1년 6개월"과 "18개월"이라는 두 표현이 항상 하나의 조합으로 수렴하게 해
  입력 모호성을 없애기 위함이다 — 사용자가 18을 입력하면 UI가 즉시 `1년 6개월`로
  정규화해 보여주거나(가장 친절), 최소한 `min=0 max=11` 힌트로 유도한다(validation.ts는
  더 관대하게 월 필드 0~479도 허용하되 `termMonths` 합산 후 1~480 범위만 최종
  검증하는 방식도 가능 — 최종 UX 디테일은 Builder 재량, 이 문서는 "두 필드 + 내부
  합산"이라는 구조만 확정한다).
- **검증**: `validation.ts`는 `termMonths = years*12 + months`가 1~480 범위인지
  최종적으로 검사한다(개별 필드 범위 검사와 별개로, 합산값 자체도 검증 — 예:
  `40년 1개월`처럼 개별 필드는 각각 유효해 보여도 합산이 480을 넘는 경우를 잡아야
  한다).
- **공유 상태(ShareActions)에는 `termMonths`(합산된 단일 정수)만 저장한다** — SPEC.md
  "공유 상태에는... 대출 기간... 만 저장한다"는 요건을 "년/개월 UI 필드 두 개"가 아니라
  "내부 표준 단위 하나"로 만족시킨다. 공유 URL을 복원할 때 `termMonths`를
  `Math.floor(termMonths/12)`년 + `termMonths%12`개월로 역산해 두 필드에 채운다.
- 이 "년+개월 조합 입력"은 이 사이트 최초의 "기간(개월수) 입력" UX 패턴이다(기존
  계산기는 모두 날짜 두 개를 받아 기간을 계산했지, 기간 자체를 직접 입력받지 않았다).
  아직 이 패턴을 요구하는 계산기가 하나뿐이므로 `components/calculator/`에 범용
  `YearsMonthsInput` 공용 컴포넌트로 승격하지 않고 `ui.tsx` 안의 로컬 서브컴포넌트로
  구현한다 — housing-subscription-score의 "아직 사례 2개뿐이라 승격하지 않는다"는
  판단 기준과 동일하게, 이 계산기 하나만 필요한 시점에 미리 범용화하지 않는다. 다음
  계산기가 유사한 "기간 직접 입력"을 필요로 하면 그때 공용화를 재검토한다.

---

## 6. 폴더 구조

```
src/calculators/loan-interest-calculator/
  types.ts                     # 입력·결과 타입 (Architect 완성 — 이번 라운드에 작성함)
  logic/
    index.ts                    # calculateLoanInterest(input) — 공개 진입점, repaymentMethod 분기
    schedule-common.ts          # 공통 러너(회차 반복+마지막 회차 보정+연도별 집계), r=0 등 방식별 특수 케이스 모름
    equal-installment.ts        # 원리금균등 앵커(A) 계산 + 회차별 스텝 함수 (r=0 특수 분기 포함)
    equal-principal.ts          # 원금균등 앵커(base) 계산 + 회차별 스텝 함수
    bullet.ts                   # 만기일시 앵커(I) 계산 + 회차별 스텝 함수
  logic.test.ts                 # FORMULA.md 검증 예제 13개 + 불변식(완료 기준) 테스트
  validation.ts                 # 원금/연이율/년+개월/상환방식 입력 검증
  validation.test.ts
  formatting.ts                 # 통화 포맷, 방식별 핵심 결과 라벨, breakdown, 연도별 표 표시용 가공
  formatting.test.ts
  content.ts                    # 상환방식 3종 한 줄 요약, 계산 전제 고지 문구, 소개/사용법/FAQ
  ui.tsx                        # 입력(년+개월 포함)/결과(방식별 템플릿)/연도별 표/계산 근거 UI
  ui.test.tsx
```

`schedule-common.ts`는 이 계산기 전용 공통 로직이라 `src/lib/`으로 옮기지 않는다 — 위
"2."에서 설명한 "한 계산기 내부에서 여러 번 재사용되는 로직"에 해당하지만, 날짜 산술
(`src/lib/date-calc.ts`)이나 4대 보험 근로자 부담분(`src/lib/social-insurance.ts`)과
달리 **다른 계산기가 재사용할 근거가 없다**(다른 계산기 중 회차별 상환 스케줄을 다루는
곳이 없다) — `src/lib/` 승격 기준("두 계산기가 동일한 정의를 공유")을 충족하지 못하므로
계산기 전용 폴더 안에 둔다.

---

## 7. UI 구조

SPEC.md "화면 구성" 1~8번을 그대로 순서로 채택하고, `docs/DESIGN_SYSTEM.md` "공통 화면
순서"의 기존 4개 공용 컴포넌트(`SectionCard`, `UsageGuide`, `IntroSection`,
`FaqAccordion`)를 그대로 재사용한다 — 새 Generic 컴포넌트는 만들지 않는다(공유할 만한
후보는 "방식별 결과 카드"·"연도별 요약표"인데, 아래에서 보듯 둘 다 이 계산기 하나에서만
쓰이는 구조라 공용화 대상이 아니다).

1. **소개**(`IntroSection`): SPEC.md "목적" 요약.
2. **입력**: 대출 원금 → 연이율 → 대출 기간(년+개월, 위 "5." 구조) → 상환방식 선택
   (라디오/세그먼트, 방식별 한 줄 요약 helpText 포함 — SPEC.md가 제시한 3개 문구
   그대로 `content.ts`에 보관).
3. **공유 액션**(`ShareActions`): 계산 전·후 동일 위치. 공유 상태 = 원금·연이율·
   `termMonths`·상환방식(위 "5." 참고).
4. **계산 버튼**.
5. **핵심 결과 카드**(강조 카드, `bg-primary`): `result.repaymentMethod`로 분기해
   방식별 템플릿을 렌더링한다(타입이 이미 판별 유니온이라 `switch`문이 TypeScript
   exhaustiveness 체크의 도움을 받는다 — 방식 추가/삭제 시 컴파일 타임에 누락을 잡는다):
   - `equalInstallment`: "매월 상환액" 큰 숫자 하나 + 총 이자·총 상환금액.
   - `equalPrincipal`: "첫 회차 ~ 마지막 회차 상환액" 범위 표기(`firstPayment`~
     `lastPayment`) + 총 이자·총 상환금액. 고정값 하나로 보이지 않도록 반드시 "~"
     범위 서식을 쓴다(SPEC.md "오해를 만들지 않는다").
   - `bullet`: "매월 이자(만기 전)"과 "만기 상환액"을 별도 줄로 구분 + 총 이자.
   - 공통 하단: 대출 원금·연이율·대출 기간(예: "20년(240개월)")·상환방식을 계산 근거
     대조용으로 노출(SPEC.md "공통" 요건).
   - 원리금균등·원금균등에는 "마지막 회차는 반올림 잔여 정산으로 금액이 근소하게 다를
     수 있습니다" 안내를 핵심 카드 아래 작은 캡션으로 둔다(FORMULA.md 권장 사항).
6. **연도별 상환 스케줄 요약표**(`SectionCard`): `yearlySummary[]`를 표로. 데스크톱은
   `<table>`, 모바일은 `four-major-insurance`의 "보험별 카드 행으로 접는다" 패턴을
   그대로 적용해 연차별 카드로 전환한다(연차·원금합계·이자합계·연말잔액 4개 값을 카드
   하나에). 최대 40행(40년)이라 카드 전환도 가로 스크롤도 모두 감당 가능한 규모다.
7. **계산 근거(수식 breakdown)**(`SectionCard`): `formatting.ts`의
   `buildLoanInterestBreakdown(input, result)`가 방식별로 다른 단계 목록을 반환 —
   월이율 계산 → 앵커값 계산(방식별 수식) → 1회차 계산 예시 → 총 이자/총 상환금액.
   `weekly-holiday-allowance`의 `BreakdownRow`(`label`/`legalBasis`/`expression`)
   형태를 재사용하되 `legalBasis` 자리에는 법령 대신 "표준 재무수학(연금 현재가치
   공식)" 같은 출처 라벨을 넣는다(이 계산기는 법령이 아니라 재무수학이 근거이므로).
8. **계산 전제 고지 + 상환방식 설명 + FAQ**(`bg-surface-subtle` 안내 블록 +
   `FaqAccordion`): FORMULA.md가 명시한 한계(월 단위 근사, 실제 일할계산과 차이 가능,
   복리 월환산이 아니라 단순 12분할 채택 등)를 정적 문구로 `content.ts`에 보관해 노출.
   "정책형 계산기가 아니다 — 사용자가 입력한 금리로만 계산하며 법정 상한(예: 대부업
   최고금리)을 검증하지 않는다"는 고지도 이 섹션에 포함한다(SPEC.md "범위 밖" 대응).

### 접근성/반응형

SPEC.md 공통 요건 그대로 — 결과 영역 `aria-live="polite"`, 모든 입력(원금·연이율·년·
개월·상환방식) `label` 연결, 320~1440px 무중단. 상환방식 라디오 변경 시 핵심 결과
템플릿 자체가 통째로 바뀌므로(다른 계산기의 "조건부 필드 등장/소멸"보다 변화 폭이 큼),
레이아웃 시프트를 줄이기 위해 핵심 결과 카드의 최소 높이를 방식별로 크게 차이 나지
않도록 맞춘다(3줄 내외로 통일).

---

## 8. 계산기 등록 전략

- 이번 Architect 단계에서는 등록하지 않는다(빈 URL 노출 방지, 기존 관례).
- Builder가 UI 구현을 완료하면 `registry.ts`에 다음으로 등록한다:
  ```
  slug: "loan-interest-calculator"
  title: "대출 이자 계산기"
  category: "finance"
  status: "draft"
  ```
  - **아이콘**: `chart`를 제안한다. 현재 `finance` 카테고리에는 `military-salary`
    (아이콘 `coins`) 하나뿐이라 같은 카테고리 안에서 `coins`와 시각적으로 구분되는
    아이콘이 필요하다. `chart`는 이미 `housing-subscription-score`(카테고리 `tax`)가
    쓰고 있지만, 서로 다른 카테고리 섹션에 노출되므로(레지스트리의 기존 관례 — `coins`도
    `severance-pay`(labor)와 `military-salary`(finance)가 카테고리를 넘어 중복 사용
    중) 문제되지 않는다. "회차별 상환 스케줄"이라는 이 계산기의 핵심 결과 성격(추이를
    보여주는 표/그래프형 데이터)과도 `chart`가 `coins`보다 더 잘 맞는다.
- Calculation Auditor + UX/UI Critic + QA 통과 전에는 `published`로 바꾸지 않는다.

---

## 9. Builder 인수인계 요약

1. `types.ts` — 이미 작성 완료(위 "3." 그대로). 새 필드가 필요하면 이 문서의 설계
   원칙(판별 유니온, 공통 필드는 베이스 타입 교차)을 유지한 채 추가한다.
2. `logic/equal-installment.ts` / `equal-principal.ts` / `bullet.ts` — FORMULA.md
   "공식 ①/②/③"을 각각 그대로 구현. 앵커값은 "한 번만 반올림해 고정"(FORMULA.md
   "앵커 값은 한 번만 반올림한다") 후 클로저로 캡처해 스텝 함수에 넘긴다. r=0 특수
   분기는 `equal-installment.ts`에만 존재.
3. `logic/schedule-common.ts` — 회차 1~n-1 반복 러너(스텝 함수를 인자로 받음) +
   마지막 회차 강제 보정(위 "2." 공식, 세 방식 공통) + `totalInterest`/`totalPayment`
   + `yearlySummary` 집계. 이 파일 자체의 좁은 단위 테스트(합성 스텝 함수로 마지막
   회차 보정과 연도별 집계만 독립 검증)를 추가할 것을 권장한다(필수는 아님) — 세
   방식이 공유하는 코드라 결함 시 영향이 가장 크기 때문이다.
4. `logic/index.ts` — `calculateLoanInterest(input: LoanInterestCalculatorInput):
   LoanInterestCalculatorResult`. `repaymentMethod`로 위 세 모듈 중 하나를 호출.
5. `validation.ts` — FORMULA.md "입력값" 표의 범위(원금 10,000~10,000,000,000,
   연이율 0~100, `termMonths` 1~480) + 위 "5."의 년/개월 합산 검증 + 상환방식 필수
   선택.
6. `logic.test.ts` — FORMULA.md 검증 예제 13개를 `calculateLoanInterest`를 통해
   그대로 Golden Test로 옮긴다(예제 9는 회차별 표 전체를 `schedule[]`과 대조). 추가로
   완료 기준 불변식 2종(Σ원금상환액=원금, 총이자 순서 `만기일시>원리금균등>원금균등`)을
   property 성격으로 추가.
7. `formatting.ts` — `roundWon`은 이미 FORMULA.md가 로직 단계(회차마다)에서 반올림을
   끝내므로 이 계산기는 `weekly-holiday-allowance`처럼 "표시 직전 재반올림"이 필요
   없다(logic이 이미 정수를 반환) — `formatWon`은 `Intl.NumberFormat`만 적용한다.
   `buildLoanInterestBreakdown(input, result)`, 방식별 핵심 결과 라벨 조립 함수,
   `yearlySummary` 표시용 가공(연차 라벨 "1년차" 등)을 추가.
8. `content.ts` — 상환방식 3종 한 줄 요약(SPEC.md 제시 문구 그대로), 계산 전제 고지
   문구(월 단위 근사·일할계산 차이·법정 상한 미검증), 소개/사용법/FAQ.
9. `ui.tsx` — 위 "7." 화면 구조. 년+개월 입력 서브컴포넌트, 상환방식별 결과 템플릿
   switch, 연도별 표의 모바일 카드 전환. `ShareActions`는 계산 전·후 동일 위치,
   공유 상태는 `termMonths` 합산값 기준.
10. 레지스트리에 `status: "draft"`로 등록 + 아이콘 `chart` (위 "8.").
11. 새 계산기 완료 후 기존 계산기 Smoke Test(docs/EVALUATION.md "회귀 방지") — 이번
    라운드는 `src/lib/`의 공용 파일을 전혀 수정하지 않았으므로(이 계산기 전용 코드만
    추가) 회귀 위험 자체가 낮지만, 원칙대로 전체 테스트 스위트를 재실행해 확인한다.

---

## 10. 남은 리스크 / 확인 필요

- FORMULA.md "확인 필요 목록"(반올림 사사오입 vs 올림 완전 특정, 은행권 원단위 절사
  관행, 토스피드 16회차 1원 오차 원인, 실제 일할계산 편차 크기)은 Architect 영역 밖이다
  — Calculation Auditor 단계에서 재확인을 권고한다(FORMULA.md가 이미 명시).
- 위 "1."의 극단 조합(연이율 100% × 480개월) 부동소수점 분석은 이 문서에서 처음
  수행한 것으로, Calculation Auditor가 실제 구현 결과로 이 극단값 테스트 케이스
  (Edge Case Test — 연이율 상한 100%, 대출기간 상한 480개월 조합)를 돌려 이 분석이
  실측과 일치하는지 재확인할 것을 권장한다(Architect의 수식 기반 분석은 실제 Builder
  구현·런타임 부동소수점 동작을 대체하지 않는다).
- `logic/` 디렉터리 분할은 이 사이트 최초 사례다 — Builder 구현 이후 실제로 "공통
  골격 재사용"이 의도대로 동작하는지(특히 만기일시상환에서 마지막 회차 보정 공식이
  방식별 특수 케이스 없이도 올바르게 "원금 전액+마지막 이자"를 만들어내는지)
  `schedule-common.ts` 단위 테스트로 반드시 확인한다.
