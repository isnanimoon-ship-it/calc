# ARCHITECTURE: 기초대사량(BMR) 계산기 (bmr-calculator)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-13.
계산 공식 자체는 정의하지 않는다(Formula Analyst 소관 — Mifflin-St Jeor/Harris-Benedict
계수, 활동계수 5단계, 유효 연령·키·체중 범위, 반올림 정책을 바꾸지 않았다). 여기서는 코드
배치, 타입, 숫자 정밀도 자료형, 입력 검증 순서, UI 구조만 정한다.

관련 문서: docs/ARCHITECTURE.md, docs/CALCULATOR_RULES.md, docs/DESIGN_SYSTEM.md.
참고 선례: `tasks/national-pension-benefit-estimate/ARCHITECTURE.md`(반올림 정책을 변수
경계로 강제하는 방식, optional 필드 vs 판별 유니온 판단 기준, `logic.ts` 단일 파일 + 이름
있는 하위 함수 분리 기준), `tasks/d-day-calculator/ARCHITECTURE.md`(문서 형식, 순수 산술
숫자 정밀도 재검증 방법론), `src/calculators/bmi-calculator/`(같은 `health` 카테고리 실제
구현 — 성별 라디오 카드, 도움말 문구, 결과 카드 레이아웃 패턴).

이 계산기는 법령·정책 데이터가 전혀 없는 **순수 의학 공식 계산기**라는 점에서 이 사이트의
다른 정책형 계산기들과 다르다. 이 문서에서 가장 중요한 결정은 "1."(대표 공식·보조 공식·
TDEE 세 계산의 독립성을 함수 경계로 어떻게 강제하는가)과 "7."(활동량 선택 UI를 select가
아니라 카드형 라디오로 정하는 이유)이다.

---

## 0. 레지스트리 상태 확인

`src/calculators/registry.ts` 확인 결과 `bmr-calculator` slug는 아직 등록되어 있지 않다.
이번 Architect 라운드에서도 등록하지 않는다(기존 관례 — d-day-calculator·
national-pension-benefit-estimate Architect 라운드와 동일, 아래 "10." 참고).

루트 `PROGRESS.md`의 `bmr-calculator` 행 "Formula" 컬럼이 `TODO`로 남아 있었는데,
FORMULA.md는 이미 대표/보조 공식·활동계수 5단계·유효 범위·반올림 정책·25개 Golden Test
그룹·"기준/출처"까지 전부 채워 완료된 상태였다(Formula Analyst 단계가 실제로는 끝나
있었다) — 이전 두 라운드와 동일하게 이번 라운드에서 `TODO` → `PASS`로 갱신한다(아래
"13." 참고, 계산 공식·수치는 전혀 바꾸지 않았다).

이번 라운드에서 실제로 만든/수정한 파일:
- `src/calculators/bmr-calculator/types.ts`: 신규 작성(아래 "9.").
- `PROGRESS.md`: 위 갱신.
- 이 문서.

`logic.ts` 등 실제 계산 코드는 아직 없다(Builder 몫).

---

## 1. 핵심 결정 — 대표 공식/보조 공식/TDEE를 이름 있는 순수 함수 3+1개로 분리 (단일 `logic.ts`, 디렉터리 분할 아님)

### 1.1 함수 분리

```
src/calculators/bmr-calculator/logic.ts

  calculateBmr(metrics: BodyMetrics): RoundedKcalValue
    // FORMULA.md 대표 공식(Mifflin-St Jeor). 성별 상수만 분기, 나머지는 한 줄 산술.

  calculateBmrAlternative(metrics: BodyMetrics): RoundedKcalValue
    // FORMULA.md 보조 공식(Harris-Benedict 개정판, Should Have). calculateBmr을 전혀
    // 호출하지 않고 같은 BodyMetrics로부터 독립적으로 계산한다.

  calculateTdee(bmrRaw: number, activityLevel: ActivityLevel): TdeeValue
    // FORMULA.md "TDEE — 활동계수 적용". 파라미터 이름 자체를 `bmrRaw`로 못박아
    // "반올림된 값이 아니라 완전정밀도 값만 받는다"는 계약을 시그니처로 드러낸다(아래 "2.").

  calculateAllTdeeLevels(bmrRaw: number): TdeeLevelComparisonRow[]
    // (Should Have) 활동계수 1~5 전체를 calculateTdee로 매핑만 한다 — 새 산식이 아니다.

  calculateBmrCalculation(input: BmrCalculationInput): BmrCalculationResult
    // 오케스트레이터. 위 함수들을 호출해 조립만 한다(아래 "1.2").
```

`loan-interest-calculator`가 세운 기준("여러 변형이 짧고 독립적인 연산의 나열이면 분기로
충분, 같은 모양의 복잡한 다단계 절차 여러 벌을 공유하면 파일 분할")과 `d-day-calculator`·
`national-pension-benefit-estimate`가 재확인한 기준("방식이 여러 개라는 사실만으로
분할하지 않는다 — 실제 코드 길이·반복 구조를 먼저 본다")을 그대로 적용한다. 이 계산기의
세 계산(대표 공식/보조 공식/TDEE)은 각각 **한 줄~두 줄 수준의 산술**이고, 회차 반복이나
다단계 보정 같은 "공유 가능한 복잡한 골격" 자체가 없다 — `four-major-insurance`·
`d-day-calculator`·`national-pension-benefit-estimate`와 같은 "분기(또는 함수 분리)로
충분한" 부류다. `logic/` 디렉터리로 분할하지 않는다.

`calculateBmr`/`calculateBmrAlternative`/`calculateTdee` 3개를 오케스트레이터 안에
인라인하지 않고 이름 있는 함수로 뽑은 이유는 FORMULA.md의 설계("대표 공식과 서로 영향을
주지 않는 완전히 독립된 계산이다", "계산 순서" 4~5번)를 코드 리뷰 없이도 함수 시그니처만
보고 확인할 수 있게 하기 위해서다 — `national-pension-benefit-estimate`가
`findPensionableAgeRow`/`calculateContributionAdjustmentFactor`/
`calculateEarlyOrDeferredAdjustmentRate` 3개를 분리한 것과 같은 근거(Golden Test가 독립
경계값 세트를 갖고 있어 Calculation Auditor가 오케스트레이터 전체를 거치지 않고 개별
함수를 직접 호출해 검증할 수 있다).

### 1.2 오케스트레이터 — 조립만 하고 산식을 갖지 않는다

```ts
// logic.ts 오케스트레이터 내부 (의사코드, Builder가 그대로 구현)
export function calculateBmrCalculation(input: BmrCalculationInput): BmrCalculationResult {
  const metrics: BodyMetrics = input; // 구조적으로 이미 BodyMetrics를 확장하므로 그대로 전달
  const bmr = calculateBmr(metrics);
  const bmrAlternative = calculateBmrAlternative(metrics); // bmr을 전혀 참조하지 않는다

  let tdee: TdeeValue | undefined;
  if (input.activityLevel !== null && isValidActivityLevel(input.activityLevel)) {
    // ↑ FORMULA.md "예외": activityLevel이 1~5 밖의 값이면(방어적 코딩 대상) TDEE를 만들지
    // 않는다. 이 방어는 UI(라디오 그룹)가 아니라 공유 URL 복원 경로(디코딩된 값은
    // `unknown`)를 통해 부정확한 값이 들어올 가능성에 대비한다 — Golden Test #25가
    // 이 분기를 직접 검증한다(아래 "8.").
    tdee = calculateTdee(bmr.raw, input.activityLevel); // ← bmr.raw, bmr.display 아님
  }

  return { input, bmr, bmrAlternative, tdee };
}
```

- `bmrAlternative`는 `bmr`이나 `bmr.raw`를 절대 참조하지 않는다 — 두 계산이 같은
  `metrics`만 공유할 뿐 서로의 결과값을 재사용하지 않는다는 FORMULA.md "계산 순서" 5번을
  코드 구조로 보여준다.
- `tdee`가 존재하려면 `calculateTdee(bmr.raw, ...)`처럼 **반드시 `bmr.raw`를 전달**해야
  한다 — `bmr.display`를 전달하면 FORMULA.md Golden Test #20(외부 계산기 대조, "반올림
  시점 정책 차이로 1kcal 어긋나는 사례")이 재현하는 정확한 실패 모드가 그대로 발생한다.
  이 불변식을 타입 시스템만으로 완전히 강제할 수는 없지만(둘 다 `number`), 파라미터 이름
  자체를 `bmrRaw`로 못박고 Golden Test #17·#20을 "raw를 썼는지" 직접 assert하는 방식으로
  강제한다(아래 "2.", "8." 참고) — `national-pension-benefit-estimate`가
  `basicPensionMonthlyRaw`라는 변수명 하나로 같은 문제를 강제한 것과 동일한 방법론이다.

---

## 2. 반올림 정책을 함수 시그니처·변수명으로 강제

FORMULA.md "정밀도/반올림 정책"의 핵심 불변식은 "`tdeeExact`는 반드시 `bmrDisplay`가
아니라 `bmrExact`(반올림 전 값)에 활동계수를 곱해서 구한다"이다. 이를 코드 리뷰에만
의존하지 않고 다음 두 가지로 강제한다.

1. **`calculateTdee`의 첫 파라미터 이름을 `bmrRaw: number`로 고정한다.** `bmr: RoundedKcalValue`
   객체 전체를 받아 함수 내부에서 `.raw`를 꺼내 쓰는 형태로 만들지 않는다 — 그렇게 하면
   호출부에서 실수로 `.display`를 넘겨도 타입 에러가 나지 않는다. 반면 시그니처를
   `(bmrRaw: number, activityLevel: ActivityLevel)`로 고정하면 호출부(오케스트레이터)가
   `calculateTdee(bmr.raw, ...)`라고 **명시적으로 `.raw`를 선택하는 코드**를 작성해야
   하므로, 실수로 `bmr.display`를 넘기는 코드가 리뷰 시 눈에 띈다.
2. **`RoundedKcalValue.raw`/`.display`라는 필드명 자체가 계약이다**(types.ts, 위 "9.").
   `bmrExact`/`bmrDisplay`라는 FORMULA.md 원래 이름을 그대로 쓰지 않고 `raw`/`display`로
   통일한 이유는 `bmr`/`bmrAlternative`/`tdee` 세 값 모두 같은 두 필드 이름 쌍을 공유하게
   해서, "이 계산기의 모든 kcal 값은 raw(완전정밀도)와 display(표시용 반올림) 두 형태로
   존재하고 절대 섞이지 않는다"는 규칙을 단일 타입(`RoundedKcalValue`)으로 표현하기
   위해서다.
3. **반올림 함수는 `logic.ts` 오케스트레이터 안에서 표시 직전에만 호출한다** — 각
   `calculateBmr`/`calculateBmrAlternative`/`calculateTdee` 함수 자신이 자기 결과의
   `raw`/`display`를 함께 만들어 반환한다(national-pension처럼 "raw는 로직 내부에만
   존재하고 타입에는 안 보인다" 방식이 아니다 — 위 "9." 참고, 이 계산기는 raw를 화면에
   보여줘야 하므로 값 객체 자체에 함께 담는다). `Math.round`(0.5 올림, FORMULA.md
   "정밀도/반올림 정책" — "값이 항상 양수이므로 음수 특이 케이스 없음"과 일치)를 세 함수
   각각의 마지막 줄에서 한 번씩만 호출하고, 그 결과를 다른 계산에 재사용하지 않는다.
4. **부동소수점 안전성 재확인**: 이 계산기가 다루는 입력(키·체중 소수 첫째 자리, 정수 나이)
   과 상수(10, 6.25, 5, 161, 1.2~1.9 등)의 조합에서 이진 부동소수점 표현 오차가 반올림
   경계(.5)를 넘나들 위험을 직접 계산해 봤다 — 최대값(체중 300kg, 키 230cm, 나이 19세
   조합)에서도 결과값 자체가 수천 단위(최대 약 4,347.5kcal)이고, `Number`의 상대 오차
   (약 2.22×10⁻¹⁶)가 만드는 절대 오차는 약 10⁻¹² 수준으로 반올림 경계(0.5)에는
   전혀 근접하지 않는다. FORMULA.md Golden Test #22("소수 입력 처리 — 68.3kg"처럼 이진
   소수로 정확히 표현되지 않는 입력)도 이 오차 폭 안에서 안전하게 재현 가능함을 확인했다
   (아래 "3." 계속).

---

## 3. 숫자 정밀도 전략 — 일반 `Number`로 충분 (Architect 재검증, FORMULA.md 판단에 동의)

FORMULA.md "정밀도/반올림 정책"은 "JS `number` 완전정밀도로 충분하다"고 결론 냈다. 다른
계산기 Architect 라운드가 반복해 온 방법론(Formula Analyst의 "충분하다" 의견을 그대로
받지 않고 최악 조합을 직접 재계산)을 그대로 적용해 재검증한다.

- **최악 조합 직접 계산**: 체중 300.0kg(상한), 키 230.0cm(상한), 나이 19세(하한, 남성 —
  나이 계수가 음수라 나이가 작을수록 BMR이 커짐), 활동계수 1.9(최대)를 대입한다.
  `BMR = 10×300 + 6.25×230 − 5×19 + 5 = 3000 + 1437.5 − 95 + 5 = 4347.5`.
  `TDEE = 4347.5 × 1.9 = 8260.25`. Harris-Benedict 보조 공식도 같은 입력 범위에서
  자릿수가 같은 수준(`88.362 + 13.397×300 + 4.799×230 − 5.677×19 ≈ 4988` 등)이다.
- 이 값들은 전부 4~5자리(수천 단위)로, `Number.MAX_SAFE_INTEGER`(약 9.007×10¹⁵)와
  비교하면 **11~12자리(10¹¹~10¹²배) 이상 여유가 있다** — `average-cost-calculator`가
  `BigInt`를 채택해야 했던 "정상 입력 범위 안에서 이미 Number가 틀린 값을 낼 수 있는"
  상황과는 질적으로 전혀 다르다. 이 계산기는 이 사이트에서 가장 작은 값의 범위를 다루는
  축에 속한다(d-day-calculator의 날짜 직렬번호보다도 작다).
- **`BigInt`/`decimal.js`/`big.js`는 전혀 실익이 없다** — 소수 자릿수도 얕고(입력은 소수
  첫째 자리까지, 상수는 최대 소수 셋째 자리 `4.330`), 연산 횟수도 매우 적다(곱셈 3~4회 +
  덧셈 3~4회, 반복문 없음). 이 계산기 규모에서 무거운 의존성을 추가할 이유가 없다
  (docs/ARCHITECTURE.md "모든 계산기에 무조건 무거운 decimal 라이브러리를 쓰지 않는다").
- **결론: Architect는 FORMULA.md의 판단에 동의한다(이견 없음).** 다만 위 "2."에서 설명한
  대로 "raw를 재사용하지 않는다"는 규칙은 자료형 선택과 무관하게 함수 경계로 별도 강제해야
  한다(정밀도 전략이 충분해도 반올림 정책 위반은 별개 버그이기 때문).

---

## 4. 타입 설계 핵심 — `tdee?: TdeeValue` (optional 필드, 판별 유니온 아님)

`activityLevel`이 선택 입력이라 "TDEE 관련 필드가 존재하지 않을 수 있는 상태"를 어떻게
표현할지가 이 계산기 타입 설계의 핵심 질문이다. 세 가지 대안을 검토했다.

1. **판별 유니온**(`{ hasTdee: true; tdee: TdeeValue } | { hasTdee: false }`로 결과 타입
   전체를 분기): 채택하지 않았다. `bmr`/`bmrAlternative`/`input`은 TDEE 존재 여부와
   무관하게 항상 같은 모양으로 존재하므로, 결과 타입 전체를 두 갈래로 나누면 두 분기에서
   `bmr`/`bmrAlternative`/`input` 필드를 매번 중복 선언해야 하고 UI 쪽도
   `result.hasTdee ? result.tdee : undefined`처럼 불필요한 분기가 늘어난다.
2. **완전히 별도의 결과 타입**(`BmrOnlyResult`/`BmrWithTdeeResult` 두 인터페이스를
   두고 `calculateBmrCalculation`이 둘 중 하나를 리턴): 채택하지 않았다. 1번과 같은
   중복 문제에 더해, `severance-pay`/`unemployment-benefit`/`national-pension-benefit-
   estimate`가 판별 유니온을 쓰는 경우는 전부 "지급 대상 여부"처럼 **결과의 의미 자체가
   완전히 달라지는 경우**(금액 필드가 아예 존재할 수 없음)였다 — 이 계산기의 TDEE 유무는
   그런 성격이 아니라 "추가 정보가 있는지 없는지"의 차이일 뿐이다.
3. **`tdee?: TdeeValue` optional 필드(채택)** — `national-pension-benefit-estimate`의
   `adjustedPensionMonthly?`/`earlyOrDeferredAdjustmentRate?` 패턴과 동일한 근거를
   그대로 적용한다: "조기/연기 신청 여부"가 국민연금 계산기에서 별도 판별 유니온이 아니라
   optional 필드였던 이유(핵심 필드 구성이 동일하고 "추가로 값이 있는지"만 다름)가 이
   계산기의 "활동량 선택 여부"에도 문자 그대로 적용된다.

`tdee === undefined`는 "값이 아직 계산되지 않음"이 아니라 **"TDEE 섹션 자체를 만들지
않는다"는 FORMULA.md의 명시적 설계**(계산 순서 6번: "TDEE 관련 값을 아예 생성하지
않는다")를 의미한다 — UI는 `result.tdee`의 존재 여부만으로 TDEE 섹션 렌더링 여부를
결정하면 되고, 별도의 `activityLevel !== null` 재확인이 필요 없다(SPOT: single point of
truth, `types.ts` 상세 주석 참고).

---

## 5. `bmi-calculator`와의 비교 — 재사용할 것과 재사용하지 않을 것

`src/calculators/bmi-calculator/`의 실제 구현을 확인했다. 같은 `health` 카테고리이고
"성별·키·체중"이라는 입력이 겹치지만, SPEC.md가 이미 "계산기 중복 금지 체크"에서 판단한
대로 계산 로직·결과 형태가 실질적으로 달라 구조도 상당 부분 다르다.

### 5.1 재사용하는 패턴
- **성별 라디오 카드 UI**: `bmi-calculator/ui.tsx`의 `[['male','남성'],['female','여성']]`
  2택 카드형 라디오(`<input type="radio" className="sr-only">` + 스타일 입힌 `<label>`)를
  그대로 재사용한다 — `business-days`/`loan-interest-calculator`가 쓰는 것과 같은 이
  사이트의 표준 라디오 카드 패턴이다.
- **성별 도움말 문구 패턴**: SPEC.md가 이미 "성 정체성 판정이 아니라 공식의 성별 상수
  선택에 필요한 분류임을 도움말로 안내한다(bmi-calculator SPEC의 동일 안내 패턴을 따름)"고
  명시했다 — `bmi-calculator`가 실제로 쓰는 도움말 문구("소아청소년의 또래 비교와 성인
  허리둘레 기준에 사용합니다" 류)의 톤을 그대로 참고해 이 계산기 맥락(공식의 성별 상수
  선택)에 맞게 새로 쓴다(문구 자체는 content.ts에서 Builder가 작성).
- **`SectionCard`/`UsageGuide`/`IntroSection`/`FaqAccordion`/`ShareActions`**: 그대로
  재사용한다(아래 "9.").
- **입력이 바뀌면 결과를 숨긴다(`setResult(null)`)는 패턴**: `bmi-calculator`의
  `update()` 핸들러가 이미 이 패턴을 구현하고 있다 — 그대로 재사용한다(SPEC.md Must
  Have와 정확히 일치).

### 5.2 재사용하지 않는 것 — 이유
- **연령대 분기(`AgeGroup: "infant"|"child"|"adult"`), 성장도표 LMS 백분위수 계산
  (`lms-data.ts`, `age.ts`)**: 이 계산기는 애초에 성인(19~78세)만 대상으로 하고
  (FORMULA.md "유효 연령 범위 근거"), 소아·청소년 전용 공식은 SPEC.md가 v1 범위 밖으로
  이미 뺐다. `bmi-calculator`처럼 "나이에 따라 완전히 다른 계산 로직·데이터 테이블을
  적용"하는 구조 자체가 이 계산기에는 없다 — 사용자 지시가 명시한 대로 "복잡한 연령별
  분기는 없다."
- **나이를 생년월일 대신 직접 입력받는 것도 재사용이 아니라 SPEC.md의 독자적 결정**이다
  (`bmi-calculator`는 생년월일+기준일을 받아 나이를 유도하지만, 이 계산기는 "만 나이를
  정수로 직접 입력"이 SPEC.md의 명시적 선택 — "생년월일 선택보다 응답 부담이 작다"). 두
  계산기가 "나이"라는 개념을 다루는 방식 자체가 달라 `age.ts`류 날짜 계산 유틸을
  재사용할 지점이 없다.
- **허리둘레 등 "성인일 때만 나타나는 추가 선택 필드" 조건부 렌더링 패턴**은 구조적으로
  비슷해 보이지만 이 계산기에는 해당 입력 자체가 없다(활동량은 나이와 무관하게 항상
  선택 가능한 별개 선택 입력이다) — 참고할 조건부 렌더링 대상이 없다.

---

## 6. 입력 검증 — 순서·방식

FORMULA.md "예외" 절이 나열한 순서(성별 → 나이 → 키 → 체중 → activityLevel 방어적 처리)를
`validation.ts`의 필드 검사 순서로 그대로 따른다. `bmi-calculator/validation.ts`의 관례
(모든 필드를 검사해 오류를 한 번에 모아 반환, 첫 오류에서 멈추지 않음)를 그대로 재사용한다
— 사용자가 여러 필드를 동시에 잘못 입력해도 한 번에 전부 안내받을 수 있다.

```ts
// validation.ts (Builder 작성 예정, 검증 순서만 이번 라운드에서 확정)
export function validateBmrInput(raw: RawBmrFormInput):
  | { success: true; data: BmrCalculationInput }
  | { success: false; errors: FormError[] } {
  const errors: FormError[] = [];

  // 1. 성별 — 필수
  if (raw.sex !== "male" && raw.sex !== "female") errors.push({ field: "sex", message: "..." });

  // 2. 나이 — 정수만 허용, 19~78
  //    "30.5"·"삼십" 모두 거부해야 하므로(Golden Test #24) `/^\d+$/` 형태의 순수 정수
  //    문자열 검사를 먼저 하고, 그 다음 범위(19~78)를 검사한다. `Number.isInteger(Number(x))`
  //    단독으로는 "30.0" 같은 표현을 정수로 오인할 여지가 있어 정규식 검사를 우선한다.
  if (!/^\d+$/.test(raw.ageYears)) errors.push({ field: "ageYears", message: "..." });
  else if (Number(raw.ageYears) < 19 || Number(raw.ageYears) > 78) errors.push(...);

  // 3. 키 — 100.0~230.0 (소수 허용, 자릿수 제한은 걸지 않음 — 아래 참고)
  // 4. 체중 — 20.0~300.0
  // 5. activityLevel은 이 함수에서 범위를 검사하지 않는다 — 아래 "6.1" 참고.
  ...
}
```

- **키/체중의 "소수 첫째 자리까지 허용"은 입력 표기 관례이지 검증 규칙이 아니다.**
  `bmi-calculator/validation.ts`가 `heightCm`/`weightKg`에 자릿수 제한을 걸지 않고
  `Number.isFinite` + 범위만 검사하는 것과 동일하게, 이 계산기도 "175.55"처럼 소수 둘째
  자리 이하 입력을 규칙 위반으로 거부하지 않는다 — FORMULA.md "예외" 절에도 이런 케이스가
  Golden Test로 등장하지 않으며, 이런 입력을 오류로 막는 것은 사용자에게 불필요하게
  가혹하다. 화면 표시(formatting.ts)만 소수 첫째 자리로 반올림해 보여준다.
- **경계값은 포함(inclusive)이다** — 19·78·100.0·230.0·20.0·300.0 자체는 유효(FORMULA.md
  "예외" 절 "경계값 자체는 유효"). `<`/`>` 비교로 구현하고 `<=`/`>=`를 혼동하지 않는다
  (Golden Test #9·#11·#13·#14가 정확히 이 경계를 검증).

### 6.1 `activityLevel`은 `validation.ts`가 범위를 검사하지 않는다

`activityLevel: ActivityLevel | null`은 UI의 라디오 그룹에서 고정된 값 집합(`null`,
`1`~`5`)으로만 들어오므로 타입 자체가 이미 잘못된 값을 배제한다(문자열 파싱을 거치지
않는다 — `loan-interest-calculator`의 `repaymentMethod`가 라디오에서 문자열 파싱 없이
바로 타입 값으로 들어오는 것과 동일한 패턴, 위 "9." `types.ts` 참고). FORMULA.md가
"방어적 코딩 대상"이라고 표현한 "1~5 밖의 값"은 정상적인 폼 제출 경로에서는 발생할 수
없고, **공유 URL 복원 경로**(`decodeShareState`가 반환하는 `unknown` JSON)를 통해서만
발생할 수 있다. 이 경우의 처리 계층을 두 군데로 나눈다.

1. **공유 상태 복원 시점(`ui.tsx`의 candidate 조립, `bmi-calculator`의 `useCalculatorShare`
   콜백과 동일한 자리)**: 디코딩된 값이 `1|2|3|4|5` 중 하나가 아니면 즉시 `null`로
   치환한다(`[1,2,3,4,5].includes(saved.activityLevel) ? saved.activityLevel : null`).
   이렇게 하면 `validateBmrInput`에 도달하는 시점에는 이미 정상적인 값만 남는다.
2. **`calculateBmrCalculation` 내부의 방어적 재확인**(위 "1.2"): 1번을 거치지 않고 로직
   함수가 직접 호출되는 경우(단위 테스트, 향후 다른 진입점)까지 대비한 마지막 안전장치.
   FORMULA.md 자신이 이 처리를 "계산 순서"(검증이 아니라 계산 단계) 안에서 설명하므로,
   `validation.ts`의 오류 메시지 목록에 추가하지 않고 `logic.ts`에 두는 것이 FORMULA.md
   구조와 일치한다(Golden Test #25는 `logic.test.ts`에 배치 — 아래 "8." 참고).

---

## 7. UI 구조 — 3단 결과 배치와 활동량 선택 컨트롤

### 7.1 화면 순서(공통 규칙 그대로 적용)

`docs/DESIGN_SYSTEM.md` "공통 화면 순서"를 그대로 따른다: 입력 → 결과 → 계산 근거 → 소개·
사용 방법 → 계산 전제/주의사항 → FAQ. "결과" 영역 안에서 SPEC.md가 요구한 3단 구성을
다음과 같이 배치한다.

```
[입력 폼]
  성별(라디오 카드 2택) → 나이 → 키 → 체중 → 활동량(선택, 아래 "7.2")

[결과 — 항상 렌더링되는 핵심 카드] (bg-primary 강조, 계산기당 하나)
  BMR 표시값(정수, 대문자) + "kcal/일" — 메인 타이틀에 공식명 노출 안 함(SPEC.md)
  입력한 성별·나이·키·체중 에코

[결과 — TDEE 섹션] (result.tdee가 있을 때만 렌더링, BMR 카드와 시각적으로 명확히 구분)
  TDEE 표시값 + "kcal/일" + 선택한 활동량 단계 설명
  → national-pension-benefit-estimate의 "이중 카드"(1차/2차)와 유사하지만, 이 계산기는
    TDEE가 BMR의 대체가 아니라 확장이므로 "더 크게 강조"가 아니라 "BMR 아래 별도 카드"로
    배치한다(SPEC.md "같은 숫자처럼 섞어 보여주지 않음"의 요구가 "이중 강조 카드"가 아니라
    "명확한 섹션 분리"이기 때문 — national-pension은 두 값이 같은 질문("월 얼마 받는지")의
    다른 시나리오였지만, 이 계산기는 BMR과 TDEE가 서로 다른 질문("누워만 있어도 vs 활동까지
    포함하면")이라 위계보다 구분이 더 중요하다).

[SectionCard "계산 근거"]
  - 대표 공식(Mifflin-St Jeor) breakdown: 실제 입력값 대입 수식 + raw→display 반올림 과정
  - 보조 공식(Harris-Benedict) 참고값 — bmr.raw/display와 나란히, "참고" 라벨 명시
    (SPEC.md Should Have "계산 근거 섹션에 함께 표시" 그대로)
  - (Should Have) TDEE가 있을 때만: 활동계수 5단계 전체 비교표(calculateAllTdeeLevels 결과,
    현재 선택 단계 강조 — bmi-calculator의 AdultReference 표가 "현재 위치 강조" 패턴을
    쓰는 것과 같은 시각 언어 재사용)

[SectionCard "꼭 확인하세요"] — 추정치 고지, 질병/임신·수유/특수 신체 조건 안내, 처방 아님

[IntroSection] [UsageGuide] [FaqAccordion]
```

### 7.2 활동량 선택 컨트롤 — 카드형 라디오(6옵션: "선택 안 함" + 5단계), 네이티브 select 아님

**결정: 네이티브 `<select>`가 아니라 카드형 라디오(세로 1열, `bmi-calculator`/
`loan-interest-calculator`가 쓰는 `sr-only` 라디오 + 스타일 입힌 `<label>` 패턴)를
채택한다.**

`national-pension-benefit-estimate`가 11개 옵션(조기/연기 개월수)에 네이티브 `<select>`를
채택한 선례가 있어 처음에는 이 계산기의 5개 옵션도 같은 패턴을 따르는 것이 자연스러워
보였다. 그러나 두 계산기의 선택 UX 목적이 다르다는 점을 근거로 반대로 결정한다.

- **선택의 성격이 다르다.** 조기/연기 개월수는 사용자가 "몇 년 앞당길지"를 이미 마음속에
  정하고 그 정확한 값을 찾는 UX(알고 있는 값을 목록에서 고르는 것)에 가깝다. 반면 활동량
  5단계는 SPEC.md 핵심 사용자 흐름이 "일상어 설명을 보고 하나 선택한다"고 명시했듯,
  사용자가 자신의 생활 패턴을 5개 설명과 **비교**해 가장 가까운 것을 찾는 UX다(정확한
  값을 미리 아는 것이 아니라 "이 중에 내 얘기랑 제일 비슷한 게 뭐지"를 판단). 비교가
  핵심인 선택은 옵션을 한 번에 펼쳐 보여주는 쪽이 낫다 — `<select>`는 한 번에 하나의
  옵션만 보여주고 나머지는 드롭다운을 열어야 비교할 수 있어 이 비교 과정에 마찰을 더한다.
- **옵션 개수가 5개(+"선택 안 함" 1개)로 11개보다 적어 세로 카드 나열의 부담이 작다.**
  `d-day-calculator` ARCHITECTURE.md가 11개 옵션에 세그먼트/라디오를 쓰지 않은 이유는
  "320px 화면에서 세로로 매우 길어지거나 줄바꿈이 지저분해진다"는 우려였다 — 6개는 각
  카드가 2줄(레벨명 + 설명) 수준이라도 전체 높이가 부담스러운 수준으로 길어지지 않는다
  (가로 스크롤은 없고, 세로 스크롤은 `docs/DESIGN_SYSTEM.md`가 금지하는 대상이 아니다).
- **`<option>`은 서식 있는 2줄 텍스트(레벨명 굵게 + 설명 작게)를 표현할 수 없다** — 순수
  텍스트 한 줄만 가능하다. 카드형 라디오는 `loan-interest-calculator`의 상환방식
  카드처럼 레벨명(굵게)과 설명(작게, `text-muted`)을 시각적으로 구분해 가독성을 높일 수
  있다.

**옵션 구성(6개, 위에서 아래로)**:

```
[ ] 선택 안 함 — BMR(기초대사량)만 확인할게요           ← 기본 선택값(activityLevel: null)
[ ] 1. 거의 운동을 안 함 (주로 앉아서 생활)
[ ] 2. 가벼운 활동 (주 1~3일 정도 가벼운 운동)
[ ] 3. 보통 활동 (주 3~5일 정도 적당한 강도의 운동)
[ ] 4. 활발한 활동 (주 6~7일 강도 높은 운동)
[ ] 5. 매우 활발함 (매일 강도 높은 운동/육체노동)
```

- **"선택 안 함"을 라디오 그룹의 정식 옵션(1번째, 기본 선택)으로 포함한다** — 라디오
  그룹이 항상 정확히 하나만 선택된 상태를 유지하게 해(WCAG 라디오 그룹 관례, "아무것도
  선택 안 된 상태"라는 애매한 상태를 만들지 않음) `activityLevel: null`을 명시적이고
  되돌리기 쉬운 선택지로 표현한다 — `national-pension-benefit-estimate`의
  `earlyOrDeferredMonths` select가 "그대로(0개월)"를 목록 중간에 포함한 것과 같은
  아이디어를 라디오 그룹에 적용한 것이다. 사용자가 활동량을 선택했다가 다시 "선택 안 함"
  으로 되돌릴 수 있어(전체 폼 Reset과 별개로) UX 유연성도 생긴다.
- "선택 안 함" 카드는 나머지 5개(실제 활동 수준)와 시각적으로 다소 구분되게 스타일링할
  것을 권장한다(예: 옅은 구분선 또는 `text-muted` 톤) — 5개의 "진짜 선택지"와 섞여 6번째
  활동 단계처럼 오인되지 않게 하기 위해서다. 다만 정확한 시각적 처리는 UX/UI Critic
  라운드에서 조정할 여지를 남긴다(Architect는 "정보 구조"만 확정).
- 라디오 그룹 마크업은 `<fieldset><legend>활동량 <span>(선택)</span></legend>...</fieldset>`
  로 감싸고, `docs/DESIGN_SYSTEM.md` "입력 UX" 규칙대로 "(선택)"을 라벨에 명시한다.
- 활동량을 바꾸면(어느 옵션이든) 다른 필드와 동일하게 기존 결과를 숨긴다(SPEC.md Must
  Have "입력이 바뀌면 기존 결과를 숨긴다"— 활동량도 예외 없이 이 규칙을 따른다).

### 7.3 결과 카드 강조 우선순위

BMR 카드가 항상 1차 핵심 카드다(TDEE 선택 여부와 무관 — SPEC.md "BMR은 항상 표시"가
national-pension의 "조기/연기 선택 시 adjustedPensionMonthly가 1차"와 다른 지점). TDEE는
있을 때만 BMR 카드 **아래에 추가되는 2차 카드**이며 결코 BMR보다 시각적으로 더 강조되지
않는다 — "TDEE는 BMR의 역함수가 아니라 BMR에 종속된 단방향 확장"이라는 SPEC.md의 설명과
일치한다.

---

## 8. Golden Test 배치 전략

FORMULA.md의 25개 검증 예제 그룹을 `logic.test.ts`(대부분)와 `validation.test.ts`(입력
검증 실패 케이스)로 나눈다 — `national-pension-benefit-estimate`가 "logic.ts의 순수
계산 함수는 이미 검증을 통과한 입력만 받는다"는 원칙을 따른 것과 동일하되, `activityLevel`
방어적 처리(#25)만 FORMULA.md 자신의 설명대로 `logic.ts` 쪽에 남긴다(위 "6.1").

```ts
// logic.test.ts

describe("calculateBmr — 대표 공식 정상값·성별대조·경계값 (Golden Test #1~2, #9, #11, #13~14, #16, #20~22)")
  // #1 Male 30/175/70(미선택), #2 Female 30/165/60(미선택) — 이 두 그룹은 TDEE 없이
  //   bmr만 보는 케이스라 calculateBmr 직접 호출로 충분하다.
  // #9 나이 하한 19세, #11 나이 상한 78세, #13 키 하한 100.0cm, #14 키·체중 상한
  //   230.0cm/300.0kg — 전부 "경계값 자체는 유효" 케이스.
  // #16 성별 상수 차이(남 vs 여, 나머지 동일) — 두 결과의 차이가 정확히 166kcal(성별
  //   상수 차 5-(-161))인지까지 assert.
  // #20 외부 계산기 대조 1(Inch Calculator, Female 35/165.1/54.55) — 대조 출처·확인일
  //   주석 필수(docs/CALCULATOR_RULES.md "Golden Test").
  // #21 외부 계산기 대조 2(Inch Calculator, Male 60/162.56/68.04).
  // #22 소수 입력 처리(174.5cm/68.3kg, 이진 소수 비정확 표현 케이스 — 위 "2." 부동소수점
  //   안전성 재확인과 직접 연결되는 테스트).

describe("calculateBmrAlternative — 보조 공식 (Golden Test #18~19)")
  // #18 Male 45/180/85(대표 공식 #3번과 동일 인물, 두 공식 결과가 서로 다른 값임을 함께
  //   assert), #19 Female 45/160/55(#4번과 동일 인물).
  // 이 describe 블록의 테스트는 calculateBmr을 전혀 호출하지 않는다 — "완전히 독립된
  //   계산"이라는 설계(위 "1.2")를 테스트 구조로도 증명한다.

describe("calculateTdee — 활동계수 적용 및 반올림 정책 핵심 불변식 (Golden Test #3~7, #17, #20 재검증)")
  // #3~7: 각기 다른 인물 + 활동량 1건씩(레벨 1~5 각 1회 이상 커버).
  // #17: 기준 인물(Male 35/175/75, BMR raw 1673.75) 활동계수 5단계 전체 — 아래
  //   calculateAllTdeeLevels 테스트와 값 공유.
  // **핵심 불변식 테스트(필수)**: `calculateTdee(1241.375, 5)`가 정확히 2358.6125 raw →
  //   2359 display를 반환하는지 직접 assert(FORMULA.md Golden Test #20의 "외부 계산기는
  //   반올림된 BMR(1241)에 곱해 2358을 얻지만 이 계산기는 raw(1241.375)에 곱해 2359를
  //   얻는다"는 정책 차이를 코드로 증명하는 지점) — 이 테스트가 실패하면 누군가
  //   `calculateTdee`에 `bmr.display`를 잘못 넘긴 것이다.

describe("calculateAllTdeeLevels — 활동계수 5단계 비교표 (Should Have, Golden Test #17 재사용)")
  // 기준 인물 1명으로 5개 행 전부가 개별 calculateTdee 호출 결과와 정확히 일치하는지 확인.

describe("calculateBmrCalculation — 오케스트레이터 조립 (Golden Test #8, #25)")
  // #8: 활동량 미선택 → result.tdee === undefined (TDEE 섹션 자체가 없음을 확인하는
  //   유일하게 올바른 방법 — "빈 값"이 아니라 "필드 부재"임을 직접 assert).
  // #25: activityLevel에 방어적 코딩 대상 값(예: `6 as ActivityLevel`, `0 as
  //   ActivityLevel`)을 강제로 넣었을 때 result.tdee === undefined이고 result.bmr은
  //   정상 계산되는지 확인.

// validation.test.ts

describe("입력 검증 실패 (Golden Test #10, #12, #15, #23~24)")
  // #10 나이 18세(하한 미만), #12 나이 79세(상한 초과), #15 키 99.9/230.1, 체중
  //   19.9/300.1(경계 바로 밖 4종), #23 체중 0/음수/빈 값, #24 나이 30.5/"삼십".
```

- `docs/CALCULATOR_RULES.md` "Golden Test — 공식 계산기 예시값과 대조한 케이스 최소
  2개"는 이 계산기가 이미 FORMULA.md 단계에서 확보했다(Golden Test #20~#21, Inch
  Calculator 대조 2건) — 국민연금 계산기처럼 "라이브 계산기 대조가 남아있어 published
  게이트가 걸리는" 상황이 아니다(아래 "10." 참고, 이 계산기는 그런 게이트가 없다).
- 완료 기준 불변식 후보(Builder 권장, 기존 라운드들의 "완료 기준 불변식" 관례): (a)
  활동계수가 1.2→1.9로 커질수록 `calculateAllTdeeLevels` 결과가 항상 단조 증가한다,
  (b) 같은 성별·키·체중에서 나이가 1씩 증가할 때 `calculateBmr` 결과가 항상 정확히
  5kcal(raw 기준)씩 감소한다(나이 계수가 선형이므로).

---

## 9. 타입 설계 상세 — `types.ts` 확정 완료 (이번 라운드에 작성)

`src/calculators/bmr-calculator/types.ts`를 작성했다(전체 내용은 파일 참고). 핵심 결정은
위 "2.", "4."에서 이미 설명했으므로 요약만 한다.

- `BodyMetrics`(성별·나이·키·체중 4종)를 `calculateBmr`/`calculateBmrAlternative`가
  공유하는 파라미터 타입으로 분리했다 — 두 함수가 "같은 입력, 다른 산식"이라는 관계임을
  타입으로도 드러낸다.
- `BmrCalculationInput extends BodyMetrics`에 `activityLevel: ActivityLevel | null`을
  추가한 것이 오케스트레이터의 전체 입력이다.
- `RoundedKcalValue { raw, display }`를 `bmr`/`bmrAlternative`/`tdee` 세 값이 공통으로
  쓰는 값 객체 타입으로 도입했다 — FORMULA.md의 `xxxExact`/`xxxDisplay` 명명을 그대로
  타입 필드명으로 옮기지 않고 `raw`/`display`로 통일해, "이 계산기의 모든 kcal 값은 항상
  이 두 형태로 존재한다"는 규칙을 하나의 재사용 가능한 타입으로 표현했다.
- `BmrCalculationResult.tdee?: TdeeValue` — 판별 유니온이 아니라 optional 필드(위 "4.").
- `activityLevel`의 실제 활동계수 숫자(1.2~1.9)는 `types.ts`가 아니라 `logic.ts` 로컬
  상수에 둔다 — 법령 데이터가 아니라서 `rates-{year}.json` 대상이 아니고, `types.ts`는
  "이 계산기가 어떤 모양의 값을 다루는지"만 표현하고 실제 상수값은 담지 않는다(다른
  계산기들의 "types.ts에 정책 데이터를 import하지 않는다" 관례와 같은 이유).
- raw 폼 입력 타입(`RawBmrFormInput` 등 문자열 기반)은 `types.ts`에 두지 않았다 —
  `bmi-calculator`/`national-pension-benefit-estimate` 전 계산기가 일관되게 "raw 폼
  타입은 validation.ts 로컬"이라는 관례를 따르므로 Builder가 validation.ts에 정의한다.

---

## 10. 공통 컴포넌트 재사용 검토

- **`ShareActions`**: 그대로 재사용한다. `text`는 `formatting.ts`가 만드는 요약 문장
  (예: "기초대사량은 1,649kcal/일입니다." 또는 TDEE가 있으면 "기초대사량 1,649kcal,
  활동량을 반영한 하루 총 소비 칼로리는 2,594kcal/일입니다.")이면 된다. 공유 상태
  (`BmrCalculatorShareState = BmrCalculationInput`)는 전부 원시 타입(`string 리터럴`/
  `number`/`null`)이라 `average-cost-calculator`의 `BigInt` 직렬화 문제, `bill-split-
  calculator`의 RNG 재현 문제 모두 해당 없음 — 입력을 그대로 `encodeShareState`에 넘기면
  결정적으로 같은 결과가 재현된다.
- **`SectionCard`/`UsageGuide`/`IntroSection`/`FaqAccordion`**: 그대로 재사용한다. 이
  계산기가 네 컴포넌트의 계약을 바꿔야 할 이유가 없다.
- **핵심 결과 카드(BMR)**: 새 컴포넌트를 만들지 않는다 — 다른 계산기와 동일하게
  `bg-primary` 강조 카드 스타일을 `ui.tsx`에서 직접 구현한다.
- **TDEE 보조 카드**: 새 공용 컴포넌트로 승격하지 않는다 — "핵심 카드 1개 + 조건부 보조
  카드 0~1개" 조합은 `national-pension-benefit-estimate`가 이미 도입한 지역 구조와 같은
  성격이지만, 그 계산기와 공유할 만큼 시각적 규격이 동일하지 않다(이 계산기는 보조 카드가
  "덜 강조"되어야 하고, national-pension은 "더 강조"되어야 하는 반대 요구라 공용화하면
  오히려 옵션 분기가 늘어난다) — 아직 사례가 이질적인 1~2개뿐이라 승격하지 않는다는 기존
  원칙과 일치한다.
- **활동량 카드형 라디오**: 새 공용 컴포넌트를 만들지 않는다 — `loan-interest-calculator`/
  `bmi-calculator`가 이미 쓰는 "`sr-only` 라디오 + 스타일 입힌 `label`" 패턴을 `ui.tsx`
  로컬로 재사용한다(위 "7.2").
- **활동계수 5단계 비교표(Should Have)**: 새 컴포넌트를 만들지 않는다 — `bmi-calculator`의
  `AdultReference` 표(현재 값 강조, `<table>` 기반)와 같은 시각 언어를 로컬로 재구현한다
  (재사용 가능한 만큼 컴포넌트를 추상화할 실익보다 계산기별 텍스트·강조 로직 차이가 커
  복붙보다 얇은 로컬 구현이 낫다는 기존 판단과 일치).

---

## 11. registry.ts 등록 계획

- 이번 Architect 라운드에서는 등록하지 않는다(위 "0.", 기존 관례).
- Builder가 UI 구현을 완료하면 `registry.ts`에 다음으로 등록한다(SPEC.md "슬러그/카테고리"
  값 그대로):
  ```
  slug: "bmr-calculator"
  title: "기초대사량(BMR) 계산기"
  category: "health"
  status: "draft"
  ```
- **아이콘: `chart`(SPEC.md 제안을 그대로 채택).** 현재 `chart`는 `housing-subscription-
  score`(`tax`)와 `loan-interest-calculator`(`finance`) 2곳에서 쓰이고 있으나, 둘 다
  `health`가 아닌 다른 카테고리라 같은 카테고리 화면(홈/카테고리 목록)에서 동시에
  노출되지 않는다 — `coins`(labor/finance/tax 3개 카테고리 중복), `calendar`(date
  카테고리 4개 전부 중복), `heart`(labor/tax/health 3개 카테고리 중복)가 이미 여러
  카테고리에 걸쳐 중복 사용되는 것과 동일한 기존 관례를 그대로 따르면 된다. `health`
  카테고리 안에서는 `bmi-calculator`가 이미 `heart`를 쓰고 있어 `chart`를 선택하면 그
  카테고리 안에서도 시각적으로 구분된다(SPEC.md 근거 그대로 유효) — 새 아이콘 키 신설도
  필요 없다. Architect는 SPEC.md의 판단에 동의하며 별도 이견이 없다.
- 초기 `status: "draft"`. 이 계산기는 `national-pension-benefit-estimate`처럼 "라이브
  계산기 대조 없이는 published 불가" 같은 추가 게이트가 없다 — 법령 의존이 없고
  Golden Test에 이미 공식 계산기 대조 2건(FORMULA.md #20~#21)이 포함돼 있어 통상적인
  3단계(Calculation Auditor → UX/UI Critic → QA) 통과 기준만 적용된다.

---

## 12. Builder 인수인계 요약

1. `types.ts` — 이미 작성 완료(위 "9." 그대로). 새 필드가 필요하면 이 문서의 설계 원칙
   (raw/display 쌍, tdee는 optional, BodyMetrics 공유)을 유지한 채 추가한다.
2. `logic.ts` —
   - `calculateBmr(metrics)`/`calculateBmrAlternative(metrics)`/
     `calculateTdee(bmrRaw, activityLevel)`/`calculateAllTdeeLevels(bmrRaw)`/
     `calculateBmrCalculation(input)` 5개 함수, 위 "1.1"·"1.2" 시그니처 그대로.
   - 성별 상수, 활동계수 테이블(`ACTIVITY_FACTORS: Record<ActivityLevel, number>`),
     Harris-Benedict 계수는 모두 `logic.ts` 로컬 명명 상수로 두고 FORMULA.md 절 번호를
     주석으로 남긴다(예: `// FORMULA.md "대표 공식 — Mifflin-St Jeor (1990)"`).
   - `calculateTdee`의 첫 파라미터명은 반드시 `bmrRaw`로 쓴다(위 "2." 계약).
   - `activityLevel`이 `null`이 아니지만 1~5 범위 밖이면 `calculateBmrCalculation`이
     `tdee`를 만들지 않는다(위 "1.2", "6.1" — 방어적 처리, `isValidActivityLevel` 같은
     작은 타입 가드 헬퍼를 둘 것을 권장).
3. `validation.ts` — 위 "6." 순서(성별→나이→키→체중) 그대로, 모든 오류를 한 번에 수집.
   `RawBmrFormInput`(문자열 기반 raw 폼 타입)을 이 파일에 로컬로 정의한다. `activityLevel`
   범위는 이 파일이 검사하지 않는다(위 "6.1").
4. `logic.test.ts`/`validation.test.ts` — 위 "8." 구조 그대로 FORMULA.md Golden Test
   25개 그룹을 옮긴다. `calculateTdee(1241.375, 5)` 핵심 불변식 테스트를 반드시 포함한다.
5. `formatting.ts` — kcal 천단위 콤마(`Intl.NumberFormat('ko-KR')`), 대표/보조 공식
   breakdown 문자열 조립(실제 입력값 대입 수식), 활동량 5단계 라벨 배열(FORMULA.md 표
   그대로, "선택 안 함" 포함 6개), 5단계 비교표 표시용 행 조립.
6. `content.ts` — 소개("기초대사량이란", "TDEE란"), 사용법, FAQ, 계산 전제 고지(추정치
   한계, 질병/임신·수유/특수 신체 조건 안내, 처방·진단 아님 — SPEC.md "결과 안내" 3개
   항목 모두), 성별 도움말 문구(위 "5.1").
7. `ui.tsx` — 입력 폼(성별 라디오 카드 → 나이 → 키 → 체중 → 활동량 카드형 라디오, 위
   "7.2") + BMR 핵심 카드(항상) + TDEE 보조 카드(조건부) + "계산 근거" SectionCard(대표
   공식 breakdown + 보조 공식 참고값 + 5단계 비교표) + "꼭 확인하세요" SectionCard +
   `ShareActions`(계산 전·후 동일 위치) + Reset/Sample 버튼(FORMULA.md 검증 예제 값을
   샘플로 사용 권장, 예: Golden Test #3의 Male 45/180/85/보통 활동) + 소개/사용법/FAQ.
   공유 URL 복원 시 `activityLevel` 값 검증(위 "6.1" 1번)을 이 파일에 구현한다.
8. 레지스트리에 `status: "draft"`로 등록(위 "11.").
9. 새 계산기 완료 후 기존 계산기 Smoke Test(docs/EVALUATION.md "회귀 방지") 실행 — 이번
   라운드는 공용 파일을 전혀 건드리지 않았으므로(신규 파일만 추가) 회귀 위험은 원천적으로
   없지만, 관례대로 Builder 구현 완료 후 전체 테스트 스위트 재실행을 권장한다.

---

## 13. 회귀 방지 확인

이번 라운드에서 실제로 수정·생성한 파일:

**공용 코드 — 전혀 수정하지 않음**: 이 계산기는 `src/lib/`이나 `rates-{year}.json` 등
다른 계산기와 공유하는 파일을 하나도 필요로 하지 않는다(법령·정책 데이터, 날짜 산술,
금액 계산 공용화 대상 모두 해당 없음). 따라서 이번 라운드는 다른 계산기에 영향을 줄
파일 변경이 원천적으로 없다.

**이 계산기 전용 신규 파일**:
- `src/calculators/bmr-calculator/types.ts` (신규 — 다른 계산기가 import하지 않는다).
- `tasks/bmr-calculator/ARCHITECTURE.md` (이 문서).

**문서만 갱신(코드 아님)**:
- 루트 `PROGRESS.md`: `bmr-calculator` 행 "Formula" 컬럼 `TODO` → `PASS` 갱신(계산 로직
  자체는 바꾸지 않았다).

**검증**: 새로 추가한 `types.ts`는 다른 파일에서 import되지 않는 신규 파일이라 기존
계산기 18종에 대한 회귀 위험이 없다. `npx tsc --noEmit`으로 타입 자체의 구문 오류가
없는지 확인할 것을 Builder에게 권장한다(로직 구현 파일들이 아직 없어 지금 시점의 전체
빌드는 이 파일의 신규 타입만으로는 실질적 차이를 만들지 않는다).

---

## 14. 남은 리스크 / 확인 필요

- FORMULA.md "확인 필요" 목록(원 논문 정밀 회귀계수, 원 논문 실측 키/체중 범위, 활동계수
  5단계의 단일 1차 출처 미확정, 79세 이상 정확도 저하 정량 수치)은 전부 Formula Analyst
  영역이며 Architect가 임의로 해소하지 않았다 — 이 계산기의 기능 자체에는 영향이 없다는
  FORMULA.md의 결론에 동의한다.
- **"선택 안 함"을 라디오 그룹의 정식 옵션으로 포함하는 결정(위 "7.2")의 최종 시각적
  구현**(구분선, 톤 차이 등으로 5개 "진짜 활동 단계"와 명확히 구분되는지)은 Builder 구현
  후 UX/UI Critic이 실제 화면으로 재검토할 여지를 남긴다 — Architect는 정보 구조(6개
  옵션 중 하나가 항상 선택된 상태, 첫 옵션이 null)만 확정했다.
- **활동량 카드 6개가 실제 화면(특히 320px)에서 세로로 얼마나 길어지는지**는 Builder
  구현 후 UX/UI Critic이 실기기/뷰포트로 확인해야 한다(이 문서는 "가로 스크롤은 없다"는
  것만 근거로 세로 나열이 가능하다고 판단했을 뿐, 실제 체감 스크롤 길이의 적정성은 화면을
  보고 판단할 사안이다).
- **TDEE 보조 카드의 정확한 강조 톤(색상 대비 등)**은 Architect가 "BMR보다 덜 강조되어야
  한다"는 방향만 정했다(위 "7.3") — 구체적 Tailwind 클래스 조합은 Builder/UX Critic
  재량이다.
