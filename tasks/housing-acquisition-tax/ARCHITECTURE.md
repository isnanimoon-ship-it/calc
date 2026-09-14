# ARCHITECTURE: 주택 취득세 계산기 (housing-acquisition-tax)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-14.
계산 공식 자체(세율표, 경계값, 산식)는 정의하지 않는다(Formula Analyst 소관) — 단, SPEC.md와
FORMULA.md 사이의 입력 설계 불일치 1건(아래 "1.")과 FORMULA.md 문서 내부의 반올림 서술
불일치 1건(아래 "2.")은 Architect 권한으로 조사·판단·기록했다. 이 문서에서는 그 두 가지에
더해 코드 배치, 정책 데이터 스키마, 타입, 숫자 정밀도 자료형, 함수 분리, UI 구조, Golden
Test 배치를 정한다.

관련 문서: docs/ARCHITECTURE.md, docs/CALCULATOR_RULES.md, docs/DESIGN_SYSTEM.md,
docs/EVALUATION.md("역할 간 이견 조정").
참고 선례: `tasks/national-pension-benefit-estimate/ARCHITECTURE.md`(raw/display 변수명으로
반올림 정책 강제, 판별 유니온 vs optional 필드 판단, 이 사이트에서 법령 의존도가 가장 높은
계산기가 세운 방법론), `tasks/housing-subscription-score/ARCHITECTURE.md`(계산기 전용
`policy.ts`를 택하는 기준 — "연도 축이 어색한 정책"), `tasks/four-major-insurance/`
(세목별 10원 미만 절사, `truncateTo10Won` 기존 구현), `tasks/bmr-calculator/ARCHITECTURE.md`
(문서 형식, "짧은 분기 vs 파일 분할" 기준 재적용).

이 계산기는 SPEC.md 자신이 "이 프로젝트에서 법령 의존 요소가 가장 많은 축"이라고 규정했고,
FORMULA.md는 조사 과정에서 SPEC.md 사실 오류 1건과 입력 설계 결함 1건을 직접 지적하며
Architect의 재검토를 요청했다. 아래 "1."이 이 문서에서 가장 먼저, 가장 눈에 띄게 다뤄야
하는 내용이다.

---

## 0. 레지스트리 상태 확인

`src/calculators/registry.ts` 확인 결과 `housing-acquisition-tax` slug는 아직 등록되어
있지 않다("취득세", "부동산", "주택 취득" 이름의 계산기도 없음 — SPEC.md "계산기 중복 금지
체크"와 일치). 이번 Architect 라운드에서도 등록하지 않는다(기존 관례 — d-day-calculator·
national-pension-benefit-estimate·bmr-calculator Architect 라운드와 동일, 아래 "12." 참고).

이번 라운드에서 실제로 만든/수정한 파일:
- `src/calculators/housing-acquisition-tax/types.ts`: 신규 작성(아래 "7.").
- `src/calculators/housing-acquisition-tax/policy.ts`: 신규 작성(아래 "3.").
- `PROGRESS.md`: `housing-acquisition-tax` 행의 "Formula" 컬럼(TODO → PASS, FORMULA.md가
  실제로는 완료 상태였다는 점을 반영 — d-day-calculator·national-pension·bmr-calculator
  Architect 라운드와 동일한 관례) 및 "다음 재검토 예정일" 컬럼 갱신.
- 이 문서.

`logic.ts` 등 실제 계산 코드는 아직 없다(Builder 몫).

---

## 1. 입력 설계 재검토 — "보유 주택 수" 3구간 vs 4구간 (최우선 결정)

### 1.1 결론: FORMULA.md의 4구간 권고에 동의한다. Product Owner 재검토로 넘기지 않는다.

**Architect는 4구간(1채/2채/3채/4채 이상)을 채택하고, Builder가 이 구간으로 구현하도록
강제한다(`src/calculators/housing-acquisition-tax/types.ts`의 `HouseCountAfterAcquisition
= 1 | 2 | 3 | 4` 타입으로 이미 반영했다).**

### 1.2 왜 이것이 "범위 변경"이 아니라 Architect가 결정할 수 있는 "입력 설계 구체화"인가

`docs/EVALUATION.md` "역할 간 이견 조정"은 "기술 구조에 대한 이견은 Architect가 최종
결정한다"고 규정하면서도, 사용자 지시는 이것이 "입력 필드 자체의 의미가 바뀌는 문제"라
Product Owner 영역과 겹칠 수 있다고 경고했다. 이 우려를 다음 기준으로 직접 검토했다.

- **사용자에게 보이는 질문(의미) 자체는 바뀌지 않는다.** SPEC.md가 정의한 질문("이 집을
  포함해서 총 몇 채를 갖게 되나요?")과 그 질문이 답하려는 개념(취득 후 보유 주택 수)은
  3구간이든 4구간이든 동일하다 — 선택지의 **개수**만 하나 늘어날 뿐, 새로운 개념(예: 공시가격,
  법인 여부, 처분 예정 여부 등)을 추가로 묻지 않는다. 이는 "이 계산기가 무엇을 계산하는가"를
  바꾸는 결정이 아니라 "이미 확정된 개념을 몇 개의 선택지로 쪼갤 것인가"라는 순수 입력
  UI/데이터 모델링 문제다.
- **SPEC.md 원문이 이미 "예:"로 시작하는 예시임을 스스로 밝혔다**("취득 후 보유하게 되는
  주택 수: 필수, 선택형 입력(**예**: 1채/2채/3채 이상)"). SPEC.md의 Must Have 요건 문장이
  실제로 못박은 것은 "선택형 입력이어야 한다"는 것이지 "정확히 3개 옵션이어야 한다"는 것이
  아니다.
- **3구간을 그대로 구현하면 SPEC.md 자신이 이미 Must Have로 확정한 핵심 가치가 깨진다.**
  SPEC.md "V1 범위를 좁힌 판단 3번"은 "다주택자·조정대상지역 중과세율 — Must Have로
  포함한다"며 "이 항목이 빠지면 이 계산기는 표준세율표에 불과해... 차별점이 없다"고 명시했다.
  FORMULA.md가 확정한 세율표(아래 "3." 참고)는 비조정대상지역 3주택(8%)과 4주택 이상(12%)의
  세율이 서로 다르므로, "3채 이상"으로 뭉뚱그리면 이 사용자군에게 **틀린 세액**(최대
  22,000,000원 차이, FORMULA.md 검증 예제 13)을 보여주게 된다. 이것은 "기능을 덜 만드는
  것"이 아니라 "이미 약속한 기능을 실제로는 잘못 계산하는 것"이라 SPEC.md 준수 여부의
  문제이지, SPEC.md 범위를 확장하는 문제가 아니다.
- **비교 대상: 만약 4구간이 아니라 5구간·6구간처럼 세율표에 없는 추가 세분화를 요구했다면
  이는 진짜 범위 확장(Should Have 승격)에 해당해 Product Owner 재검토가 필요했을 것이다.**
  하지만 FORMULA.md가 요구하는 구간 수(4)는 정확히 세율표가 실제로 구분하는 구간 수와
  일치한다 — "필요한 만큼만 정확하게" 구현하는 것이지 그 이상을 넘어서지 않는다.
- **선례**: `national-pension-benefit-estimate` Architect 라운드("7. 입력 검증")도 이와
  구조적으로 동일한 상황(FORMULA.md의 문자 그대로의 제안을 그대로 구현하면 SPEC.md 자신의
  다른 정의와 모순되는 경우)에서 Product Owner에게 되돌리지 않고 Architect가 직접 SPEC.md
  정의에 맞게 재설계했다. 이번에도 같은 방식이 적용 가능하다 — 다만 이번 사안은 "검증 상한"이
  아니라 "선택지 개수"라는 점만 다르다.

**결론**: 이 결정은 "기술 구조"(입력 데이터 모델이 세율표의 실제 분기 수와 일치해야 정확한
계산이 가능하다는 구현 정확성 문제)에 대한 이견이며, Architect의 소관이다. SPEC.md가 명시한
사용자 질문 문구, 대상 범위(매매·주택·개인), Must/Should/Could Have 분류는 전혀 바뀌지
않는다 — 오직 하나의 입력 필드가 제공하는 선택지 개수만 3에서 4로 바뀐다. Product Owner
재검토가 필요한 "실질적 범위 변경"의 기준(새로운 세목·감면·취득 원인·부동산 종류 추가 등)에
해당하지 않는다고 판단해, NEEDS HUMAN REVIEW로 넘기지 않고 이 자리에서 확정한다.

### 1.3 강제 방식

- `types.ts`의 `HouseCountAfterAcquisition = 1 | 2 | 3 | 4` 리터럴 유니온(이미 작성 완료,
  위 "0." 참고)이 1차 강제 장치다 — Builder가 라디오 그룹을 3개로 구현하면 UI 값과 이 타입이
  맞지 않아 타입 에러가 난다.
  `policy.ts`의 `heavyRate.rows`가 `houseCount: 1|2|3|4 × isAdjustmentTargetArea:
  true|false` 8행을 전부 명시적으로 나열한 것이 2차 강제 장치다 — 표에 없는 조합은 존재할
  수 없다.
- UI 라디오 카드는 4개("1채", "2채", "3채", "4채 이상")로 구현한다. SPEC.md의 일상어 질문
  문구("이 집을 포함해서 총 몇 채를 갖게 되나요?")는 그대로 유지한다.

---

## 2. FORMULA.md 내부 정합성 이슈 — 6~9억 구간 세율의 "소수 4자리 반올림" 대상 정정

FORMULA.md를 정독하는 과정에서, 표준세율 6~9억 구간 산식의 반올림 규칙 설명(프로즈)이 같은
문서의 검증 예제(Golden Test)와 실제로 어긋나는 지점을 발견했다. 이는 FORMULA.md의 공식·
상수·경계값을 바꾸는 문제가 아니라(둘 다 그대로 유지), "이미 확정된 반올림 규칙을 어느
단계의 숫자에 적용하는가"에 대한 서술 오류를 찾아 올바른 해석으로 못박는 문제라 Architect가
직접 재계산해 정정한다 — Calculation Auditor가 이 지점을 최우선으로 재검증해야 한다.

### 2.1 문제

FORMULA.md 프로즈 설명:
> 7억원 → (7/3×2−3)=1.66667 → 반올림 1.6667% ... 8억원 → (8/3×2−3)=2.33333 → 반올림 2.3333%

이 문장만 읽으면 "퍼센트로 표시한 숫자(1.66667, 2.33333)를 소수 4자리로 반올림한다"로
읽힌다. 그런데 같은 문서의 검증 예제(Golden Test, 실제 채점 대상 Expected 값)는 이와 다르게
계산한다:

> 예제4: `standardRate = (650,000,000/300,000,000×2−3)×1/100 = (4.33333−3)×1/100 =
> 0.0133333... → 반올림 0.0133`
> 예제16: `standardRate = (800,000,000/300,000,000×2−3)×1/100 = (5.33333−3)×1/100 =
> 0.0233333 → 반올림 0.0233`

여기서는 **"세율을 소수(0.0133333, 0.0233333)로 나타낸 값 자체"를 소수 4자리로
반올림**한다(0.0133, 0.0233). 두 방식은 같은 숫자가 아니다 — 프로즈 방식대로 "퍼센트 숫자를
4자리로 반올림한 뒤 100으로 나누면" 8억원 케이스는 0.023333(6자리)이 되어 예제16의 Expected
값 0.0233(4자리)과 어긋난다. 실제 금액으로 환산하면 800,000,000원 기준 26,400원 차이,
650,000,000원 기준으로도 계산해 보면 같은 자릿수 차이가 발생한다 — "확인 필요" 수준이 아니라
실제 세액이 달라지는 구현 오류로 이어질 수 있는 지점이다.

### 2.2 재계산 및 결론

Architect가 두 해석을 직접 계산해 대조했다.

- **fraction-4자리 반올림(검증 예제 방식)**: 7억원 → raw 0.016666667 → ×10000=166.667 →
  반올림 167 → 0.0167. 8억원 → raw 0.023333333 → ×10000=233.333 → 반올림 233 → 0.0233.
- FORMULA.md 프로즈 자신도 같은 단락에서 "여러 독립 검색 결과에서도 '7억원 약 1.67%'로
  반복 인용되어 정합성을 재확인했다", "독립 검색 결과의 '8억원 약 2.33%'와 일치"라고
  적었다 — **이 외부 검증치(1.67%, 2.33%)는 fraction-4자리 반올림 결과(0.0167=1.67%,
  0.0233=2.33%)와 정확히 일치하고, 프로즈가 스스로 제시한 "1.6667%"/"2.3333%"라는 표기와는
  오히려 어긋난다.** 즉 FORMULA.md는 정답(검증 예제, 외부 인용치)은 올바르게 적었지만, 그
  정답에 도달하는 중간 서술 문구("1.6667%")를 잘못 적은 것으로 판단한다.
- **결론(Architect 확정, FORMULA.md의 공식·상수·경계값은 전혀 바꾸지 않음)**: 6~9억 구간
  세율의 "소수점 다섯째자리에서 반올림하여 넷째자리까지 계산"이라는 법정 규칙은, **세율을
  소수(fraction, 예 0.0133)로 나타낸 값 자체에 적용**한다. 즉
  `standardRate = Math.round(rawFraction * 10000) / 10000`이며, 퍼센트 표기(1.33%) 단계에서
  반올림한 뒤 100으로 나누는 방식은 쓰지 않는다. 이 결론은 FORMULA.md의 실제 채점 대상인
  검증 예제 4·5·6·16의 Expected 세액과 100% 일치하고, FORMULA.md가 스스로 인용한 외부
  검증치와도 일치한다.

### 2.3 반영 위치

- `policy.ts`의 `standardRate.midTier` 주석에 이 결론과 재계산 근거를 그대로 기록했다(위
  "정책 데이터 배치" 참고) — Builder가 별도 문서를 다시 찾아보지 않아도 구현 지점에서 바로
  확인할 수 있게 했다.
- Calculation Auditor 인수인계 체크리스트(아래 "14.")에 최우선 항목으로 등록한다.

---

## 3. 정책 데이터 배치 — 계산기 전용 `policy.ts` 신설 (완료)

### 3.1 결정: `rates-2026.json`이 아니라 `src/calculators/housing-acquisition-tax/policy.ts`

`docs/ARCHITECTURE.md` "결정 사례: 정책 데이터를 언제 계산기 전용 `policy.ts`에 두는가"의
두 기준을 그대로 적용했다.

- **1차 기준(재사용 가능성)**: 이 세율표(표준세율 구간, 다주택자 중과세율표, 지방교육세율,
  농특세율)를 재사용할 다른 계산기가 현재 없고 예정도 없다(SPEC.md "계산기 중복 금지 체크"가
  이미 확인). `four-major-insurance`/`annual-salary-take-home-pay`가 공유하는 4대보험
  요율과 성격이 다르다.
- **2차 기준(연도 축 적합성) — 이 계산기가 `rates-2026.json`을 선택하지 않은 결정적 이유**:
  이 세율표는 `national-pension-benefit-estimate`의 A값(매년 12월 정기 갱신)과 달리
  **연 단위 정기 고시가 아니라 지방세법 개정 시점에 수시로 바뀌는 정책**이다. FORMULA.md
  "기준/출처"가 확인했듯 현재 세율은 2020-08-12(7·10대책 후속 개정) 이후 6년째 변경이
  없다 — "2026년" 파일에 이 값을 넣으면 마치 "2026년에만 유효한 값"처럼 보이는 오해를 준다.
  이는 `housing-subscription-score`가 「주택공급에 관한 규칙」(수시 개정)을 `policy.ts`로
  분리한 것과 정확히 같은 논리다. **national-pension-benefit-estimate(연 1회 정기 갱신 →
  `rates-2026.json`)와 이 계산기(수시 개정 → `policy.ts`)가 "재사용 없음"이라는 같은 1차
  판정에서도 서로 다른 배치를 택한 이유가 바로 이 2차 기준의 차이다.**

### 3.2 스키마

`docs/CALCULATOR_RULES.md` 데이터 파일 스키마(`value`/`unit`/`source{law,article,
effectiveDate,url}`/`lastVerified`/`nextReviewDue`)의 정신을 그대로 따르되,
`housing-subscription-score/policy.ts` 선례와 동일하게 `lastVerified`/`nextReviewDue`는
파일 최상단에 한 번만 두는 "단일 최신본" 방식을 쓴다(항목마다 반복하지 않음 — 이 계산기의
모든 세율이 같은 조사 시점(2026-09-13)에 함께 확인됐기 때문). 각 세율 블록에는 `source`를
빠짐없이 남긴다. FORMULA.md가 "확인 필요"로 남긴 항목(10원 미만 절사 근거, 농특세 중과세율
산정 방식의 "부분 확인", 읍면 100㎡ 특례)은 값을 추정하지 않고 `note`에 그 불확실성을 그대로
옮기거나, `HOUSING_ACQUISITION_TAX_OPEN_QUESTIONS` 배열(문자열 목록, 결과 화면 정책 고지
문구 조립에 재사용 가능)로 별도 관리한다 — `housing-subscription-score`의
`HOUSING_SUBSCRIPTION_SCORE_OPEN_QUESTIONS` 배열과 동일한 패턴.

**이미 이번 라운드에서 `src/calculators/housing-acquisition-tax/policy.ts`를 작성
완료했다**(`npx tsc --noEmit`으로 문법 오류 없음을 확인). 실제 필드 구성:

```
HOUSING_ACQUISITION_TAX_POLICY
  lastVerified / nextReviewDue / earlyReviewTriggers[]  ← FORMULA.md "조기 재검토 트리거" 그대로
  standardRate: { lowTier, midTier, highTier }          ← 위 "2." 반올림 정정 주석 포함
  heavyRate: { rows: 8행(houseCount 1~4 × isAdjustmentTargetArea) }
  localEducationTax: { standardRateFactor: 0.1, heavyRateFixedFactor: 0.004 }
  ruralSpecialTax: { exemptAreaThresholdSqm: 85, standardRateFactor, heavy8PercentFactor,
                     heavy12PercentFactor }
  rounding: { unit: 10, method: "truncate" }            ← "확인 필요" 명시(아래 "6.")

HOUSING_ACQUISITION_TAX_OPEN_QUESTIONS: string[]        ← 확인 필요 항목 4개 원문 그대로
```

### 3.3 조정대상지역 현재 목록(FORMULA.md "6.")은 policy.ts에 넣지 않는다

FORMULA.md 스스로 "V1 로직에는 쓰지 않지만 입력 helpText의 확인 방법 안내·샘플 값 구성에
참고"한다고 밝혔고, 근거 자체도 "국토교통부 고시 원문이 아니라 3차 출처(부동산 정보 블로그)"
라 신뢰도가 다른 정책 데이터보다 현저히 낮다. `docs/CALCULATOR_RULES.md`의 데이터 파일
스키마는 "계산에 쓰이는 연도별 수치"를 위한 것인데, 이 목록은 계산에 전혀 쓰이지 않는
안내용 스냅샷이다 — `policy.ts`(계산 상수, 신뢰도 높은 1차 출처)와 같은 파일에 섞으면
독자가 이 목록도 같은 수준의 신뢰도를 가진 것으로 오인할 위험이 있다. **이 목록은
`content.ts`(Builder 작성, 소개/FAQ/정책 고지 문구 전담 파일)에 "참고용, 확인일
2026-09-07 기준, 반드시 국토교통부 규제지역 지정 현황에서 직접 확인" 고지와 함께 넣는다.**

---

## 4. 숫자 정밀도 전략 — 일반 `Number`로 충분 (Architect 재검증, FORMULA.md 판단에 동의)

FORMULA.md "단위"는 "Number로 충분하다 — 이 계산기가 다루는 금액 범위는 안전 정수 범위에
전혀 근접하지 않는다"고 결론 냈다. 다른 계산기 Architect 라운드의 방법론(Formula Analyst의
"충분하다" 의견을 그대로 받지 않고 최악 조합을 직접 재계산)을 그대로 적용해 재검증한다.

- **최악 조합 직접 계산**: SPEC.md는 취득가액 상·하한을 Builder 재량으로 남겼으나, 실제
  주택 시장에서 있을 수 없는 극단값(예: 1,000억원 = 10^11원)을 넣어도
  `acquisitionTax = 100,000,000,000 × 0.12 = 12,000,000,000`(120억원) 수준이다. 지방교육세·
  농특세까지 합산한 `totalTax`도 같은 자릿수(10^10~10^11)에 머문다.
- 이 값들은 `Number.MAX_SAFE_INTEGER`(약 9.007×10^15)와 비교하면 **4~5자리(10^4~10^5배)
  이상 여유가 있다** — `average-cost-calculator`가 `BigInt`를 채택해야 했던 "정상 입력
  범위에서 이미 Number가 틀린 값을 낼 수 있는" 상황과는 전혀 다르다.
- 6~9억 구간 세율 계산(`(price/300,000,000)×2−3`)도 나눗셈 한 번 + 사칙연산이라 반복 연산에
  따른 오차 누적이 없고, 위 "2."에서 정한 대로 소수 4자리 반올림을 세율 계산 단계에서
  **한 번만** 수행한 뒤 그 반올림된 세율을 가격에 곱하므로(FORMULA.md "단위" 절이 명시한
  순서), 부동소수점 오차가 반올림 경계(0.00005)에 영향을 줄 정도로 누적되지 않는다.
- **결론: Architect는 FORMULA.md의 판단(일반 `Number`, 전 단위 스케일링/`BigInt`/
  `decimal.js` 전부 불필요)에 동의한다(이견 없음).** 다만 반올림·절사 정책은 자료형과
  무관하게 함수 경계로 강제해야 한다 — 아래 "6." 참고.

---

## 5. 계산 로직 분리 방식 — 단일 `logic.ts` + 이름 있는 하위 함수 3개 (디렉터리 분할 아님)

`loan-interest-calculator`가 세운 기준("여러 변형이 짧고 독립적인 연산의 나열이면 분기로
충분, 같은 모양의 복잡한 다단계 절차 여러 벌을 공유하면 파일 분할")과 `national-pension-
benefit-estimate`·`bmr-calculator`가 재확인한 기준을 그대로 적용한다. FORMULA.md "계산 순서"
11단계는 표면적으로 많아 보이지만, 반복 루프나 회차별 보정 같은 "공유 가능한 복잡한 절차"가
없다 — 대부분 한 줄~두 줄 수준의 산술과 분기다. `logic/` 디렉터리로 분할할 근거가 없다.

다만 오케스트레이터 안에 전부 인라인하지 않고, 독립 검증(Golden Test 직접 호출)이 의미 있는
지점만 이름 있는 함수로 분리한다 — 이는 이 작업 지시가 예시한 "(가격구간 판정, 중과여부
판정, 세목별 계산)" 3분할과 정확히 일치한다.

```
src/calculators/housing-acquisition-tax/logic.ts

  determineStandardRate(acquisitionPrice: Won): { priceTier: PriceTier; standardRate: Rate }
    // FORMULA.md 2단계. 6억/9억 경계 판정 + mid 구간 산식 + 소수 4자리 반올림(위 "2.").
    // Golden Test 경계값(6억, 6.5억, 7억, 7.5억, 8억, 9억, 9.5억)을 이 함수만 직접 호출해
    // 검증할 수 있다.

  determineAppliedRate(
    isAdjustmentTargetArea: boolean,
    houseCount: HouseCountAfterAcquisition,
    standardRate: Rate,
  ): { isHeavyRateApplied: boolean; appliedRate: Rate }
    // FORMULA.md 3~4단계. policy.ts의 heavyRate.rows 8행을 조회해 판정한다. 이 계산기에서
    // 가장 버그에 취약한 지점(SPEC.md의 3구간 예시를 그대로 옮기면 틀리는 지점, 위 "1.")
    // 이므로 별도 함수로 분리해 Calculation Auditor가 8행 조합 전체를 이 함수 하나로 직접
    // 스윕(sweep)해 검증할 수 있게 한다.

  calculateTaxAmounts(
    acquisitionPrice: Won,
    exclusiveArea: number,
    appliedRate: Rate,
    isHeavyRateApplied: boolean,
  ): {
    acquisitionTax: Won; localEducationTax: Won;
    isRuralSpecialTaxExempt: boolean; ruralSpecialTax: Won; totalTax: Won;
  }
    // FORMULA.md 5~9단계(세목별 계산 + 10원 미만 절사 + 합산)를 전담한다. 세 세목의 raw 계산과
    // 절사를 한 함수 안에 모아, "절사된 값을 다른 세목 계산에 재사용하지 않는다"는 불변식을
    // 함수 하나의 지역 변수 스코프 안에서 눈으로 검증하기 쉽게 한다(아래 "6.").

  calculateHousingAcquisitionTax(
    input: HousingAcquisitionTaxFormInput,
  ): HousingAcquisitionTaxResult
    // 오케스트레이터. 위 세 함수를 순서대로 호출해 조립만 한다.
```

- `determineStandardRate`/`determineAppliedRate`를 분리한 이유는 `national-pension-benefit-
  estimate`의 `findPensionableAgeRow`/`calculateContributionAdjustmentFactor` 분리와 같은
  근거다 — 각각 FORMULA.md Golden Test가 독립적인 경계값 세트(가격 구간 경계 7개, 조정×
  보유주택수 조합 8개)를 갖고 있어 오케스트레이터 전체를 거치지 않고 개별 함수로 직접
  검증하는 것이 Calculation Auditor에게 유리하다.
- `calculateTaxAmounts`를 세 세목(취득세/지방교육세/농특세) 각각 별도 함수로 더 쪼개지
  않은 이유: `bill-split-calculator`가 세운 "짧고 독립적인 연산이면 함수로 더 쪼개지
  않는다" 기준과 같다 — 세 세목 각각의 산식은 1~2줄이고, 오히려 한 함수 안에 모아 두는 쪽이
  "이 세 값이 서로의 raw를 참조하지 않고 각자 독립적으로 절사된다"는 불변식을 한눈에
  보여주기 쉽다.

---

## 6. 반올림/절사 정책을 함수 경계로 강제 — "raw"는 로컬 변수로만 존재

FORMULA.md "계산 순서" 5~9번과 "정밀도/반올림 정책"의 핵심 불변식은 "세목별 raw 값(완전정밀도)을
독립적으로 10원 미만 절사하고, 절사된 값을 다른 세목 계산이나 합계 재계산에 재사용하지
않는다"이다. `national-pension-benefit-estimate`가 `basicPensionMonthlyRaw`라는 변수명으로
이를 강제한 것과 동일한 방식을 적용한다.

```ts
// logic.ts 내부 (의사코드, Builder가 그대로 구현)
function truncateTo10Won(value: number): Won {
  // FORMULA.md "정밀도/반올림 정책" — 잠정 채택(확인 필요, 위 policy.ts rounding 주석 참고).
  return Math.floor(value / 10) * 10;
}

function calculateTaxAmounts(acquisitionPrice, exclusiveArea, appliedRate, isHeavyRateApplied) {
  const acquisitionTaxRaw = acquisitionPrice * appliedRate;              // 완전정밀도
  const acquisitionTax = truncateTo10Won(acquisitionTaxRaw);             // 표시값, 여기서만 사용

  const localEducationTaxRaw = isHeavyRateApplied
    ? acquisitionPrice * POLICY.localEducationTax.heavyRateFixedFactor    // ← acquisitionPrice 기준
    : acquisitionTaxRaw * POLICY.localEducationTax.standardRateFactor;    // ← acquisitionTaxRaw 기준(절사 전!)
  const localEducationTax = truncateTo10Won(localEducationTaxRaw);

  const isRuralSpecialTaxExempt = exclusiveArea <= POLICY.ruralSpecialTax.exemptAreaThresholdSqm;
  const ruralSpecialTaxRaw = isRuralSpecialTaxExempt ? 0 : acquisitionPrice * (...);
  const ruralSpecialTax = isRuralSpecialTaxExempt ? 0 : truncateTo10Won(ruralSpecialTaxRaw);

  const totalTax = acquisitionTax + localEducationTax + ruralSpecialTax; // 절사된 값의 합
  return { acquisitionTax, localEducationTax, isRuralSpecialTaxExempt, ruralSpecialTax, totalTax };
}
```

- **`localEducationTaxRaw`의 표준세율 분기는 반드시 `acquisitionTaxRaw`(절사 전 완전정밀도)를
  참조해야 한다** — `acquisitionTax`(절사 후)를 참조하면 FORMULA.md 6단계("표준세율 케이스면
  `localEducationTaxRaw = acquisitionTaxRaw × 0.1`")를 위반하고, 예제 17류의 비정형 금액에서
  결과가 미세하게 달라진다. 이 계약을 코드 리뷰에만 의존하지 않도록 두 변수 이름을
  `acquisitionTaxRaw`/`acquisitionTax`로 명확히 구분하고(national-pension의 `Raw` 접미사
  관례), Golden Test 예제 17을 정확히 이 지점(raw 재사용 여부)을 검증하는 테스트로 배치한다
  (아래 "10." 참고).
- **왜 `src/lib/social-insurance.ts`의 기존 `truncateTo10Won`을 재사용하지 않고 이 계산기
  로컬에 새로 정의하는가**: 두 함수의 산술 자체(`Math.floor(v/10)*10`)는 동일하지만,
  `docs/ARCHITECTURE.md` "계산 로직 공용화" 결정 사례의 공용화 기준은 "**동일한 법적 정의**를
  공유하는 계산"이다. `social-insurance.ts`의 절사는 국민연금법 제117조·사회보험 통합징수
  실무에 근거하고, 이 계산기의 절사는 「지방세기본법」제59조(「국고금 관리법」제47조 준용)에
  근거한다 — 법적 근거 자체가 다르고, **이 계산기의 절사 규칙은 FORMULA.md 스스로 "확인
  필요"로 남긴 잠정 정책**이다(위 "2.", policy.ts `rounding` 참고). 만약 공유 함수로
  묶었다가 Calculation Auditor의 위택스 대조 결과 이 계산기만 절사 방식(예: 반올림 또는 1원
  단위)이 달라야 한다는 결론이 나오면, 이미 검증 완료·published 상태인 `four-major-insurance`/
  `annual-salary-take-home-pay`의 동작을 건드리지 않고 이 계산기만 독립적으로 수정할 수
  있어야 한다 — `docs/ARCHITECTURE.md` "계산 로직 / UI 분리"의 "다른 계산기에 영향 없이 이
  폴더 하나만 수정할 수 있어야 한다" 원칙을 "우연히 같은 산술식을 쓰는 서로 다른 법적 근거"
  사이에도 그대로 적용한 결과다. 산술 자체가 단 한 줄(`Math.floor(v/10)*10`)이라 복붙에
  따른 실질적 유지보수 비용도 거의 없다(`weekly-holiday-allowance`의 `roundWon()`처럼
  "확인 필요" 정책이 나중에 바뀔 가능성이 있는 계산기는 그 계산기 전용의 이름 있는 함수를
  갖는 것이 오히려 안전하다는 선례와 일관된다).
- **`totalTax`는 절사된 세 값의 합이며 그 합 자체를 다시 절사하지 않는다**(FORMULA.md 9단계,
  "중간 절사 금지" 원칙과 헷갈리지 않도록 — 여기서는 "합계 자체가 이미 10원 단위 정수들의
  합이라 다시 절사할 필요가 없다"는 의미이지 "합계에는 절사를 적용하면 안 된다"는 금지가
  아니다. 절사된 정수 3개를 더하면 결과도 항상 10원 단위 정수이므로 이 둘은 결과적으로
  같다).

---

## 7. 타입 설계 — `types.ts` 확정 완료 (이번 라운드에 작성)

`src/calculators/housing-acquisition-tax/types.ts`를 작성했다(전체 내용은 파일 참고). 핵심
결정은 위 "1.", "6."에서 이미 설명했으므로 요약만 한다.

- `HousingAcquisitionTaxFormInput`: `acquisitionPrice`/`exclusiveArea`/
  `isAdjustmentTargetArea`/`houseCountAfterAcquisition` 4개 필드, FORMULA.md "입력값" 표
  그대로.
- `HouseCountAfterAcquisition = 1 | 2 | 3 | 4` — 위 "1."의 4구간 결정을 강제하는 리터럴
  유니온.
- `HousingAcquisitionTaxResult`: **판별 유니온이 아니라 단일 인터페이스**다 —
  severance-pay/unemployment-benefit/national-pension-benefit-estimate와 달리 이 계산기는
  "지급 대상 아님"에 준하는 상태가 없다(입력이 검증을 통과하면 항상 세액이 나온다 — 취득세
  면제 대상 같은 개념 자체를 v1이 다루지 않는다). 검증 실패는 결과 자체를 만들지 않는
  `validation.ts`의 책임이지 `HousingAcquisitionTaxResult`의 분기가 아니다.
- `acquisitionTax`/`localEducationTax`/`ruralSpecialTax`는 전부 절사 후 표시값만 담고,
  raw 값은 타입에 노출하지 않는다(위 "6.").
- `types.ts`에 `policy.ts`를 import하지 않는다 — JSON/정책 구조 파생 타입(`heavyRate.rows`의
  행 타입 등)은 `logic.ts` 로컬에 둔다(national-pension·four-major-insurance의 기존 관례).

---

## 8. 입력 검증 — 개요 (상세 상·하한은 Builder 재량, SPEC.md 위임 그대로)

- `acquisitionPrice > 0`, `exclusiveArea > 0`, `isAdjustmentTargetArea`/
  `houseCountAfterAcquisition` 미선택 시 계산하지 않음 — FORMULA.md "예외"·SPEC.md "오류와
  예외 처리" 그대로.
- **상한 값**: SPEC.md가 "정확한 상·하한은 Builder가 정한다"고 명시적으로 위임했고, 이는
  계산 정확성에 영향을 주지 않는 순수 UX 가드(타이핑 실수 방어)이므로 Architect가 임의로
  숫자를 못박지 않는다. 다만 위 "4."의 최악 조합 검토(1,000억원까지도 안전)를 참고해 Builder가
  "명백히 비정상적인 값"만 걸러내는 넉넉한 상한(예: 취득가액 1,000억원, 전용면적 10,000㎡)을
  둘 것을 권장한다 — national-pension-benefit-estimate "7.2"의 "제출 차단이 아니라 확인
  안내 수준" 권고와 같은 톤이다.
- `houseCountAfterAcquisition`은 `types.ts`의 리터럴 유니온으로 이미 타입이 좁혀지므로
  (`loan-interest-calculator`의 `repaymentMethod`처럼 라디오 그룹에서 문자열 파싱 없이 바로
  값이 들어옴), `validation.ts`가 범위를 별도로 재검사할 필요는 크지 않다 — 다만 공유 URL
  복원 경로(`unknown` JSON)를 통해 1~4 밖의 값이 들어올 수 있으므로, `bmr-calculator`의
  `activityLevel` 방어적 처리(ARCHITECTURE.md "6.1")와 동일한 패턴으로 `ui.tsx`의 공유 상태
  복원 지점에서 `[1,2,3,4].includes(value)` 가드를 두는 것을 Builder에게 권장한다.

---

## 9. UI 구조 — 결과 배치와 정책 고지 문구 그룹화

### 9.1 화면 순서(공통 규칙)

`docs/DESIGN_SYSTEM.md` "공통 화면 순서"를 그대로 따른다: 입력 → 결과 → 계산 근거 → 소개·
사용 방법 → 계산 전제/주의사항 → FAQ.

```
[스코프 배너 — 입력 폼 바로 위, 결과와 무관하게 항상 노출]
  "이 계산기는 매매(유상취득)로 취득하는 주택의 취득세만 계산합니다. 상속·증여·신축,
   비주택(토지·상가 등), 법인 취득은 계산하지 않습니다." (SPEC.md Must Have "기준과 적용
   대상" — 계산 자체를 시작하기 전에 대상 여부를 먼저 알려줘야 하는 성격이라 결과 하단
   고지와 별개로 최상단에 배치한다)

[입력 폼]
  취득가액 → 전용면적(helpText: 전용면적 vs 공급면적) →
  조정대상지역 여부(예/아니오, helpText: 확인 방법 + "확인 시점 기준 직접 확인 책임" 문구를
    이 입력 바로 옆에 배치 — SPEC.md Must Have가 "입력 옆에 명시"를 요구했으므로 결과
    하단 고지 목록에 두지 않고 입력 지점에 1차로 배치한다) →
  보유 주택 수(4개 카드형 라디오, 위 "1.3")

[결과 — 핵심 카드] (bg-primary 강조)
  totalTax(총 납부액) 가장 크게 표시

[결과 — 세목별 내역 카드]
  취득세 / 지방교육세 / 농어촌특별세(비과세면 "0원 · 전용면적 85㎡ 이하 비과세" 배지) 3행

[SectionCard "계산 근거"]
  가격 구간(priceTier) + 표준세율(standardRate, 항상 표시) → 중과 적용 여부(isHeavyRateApplied)
  + 어느 조합(조정대상지역 여부 × 보유 주택 수)에서 비롯됐는지 → 최종 적용 세율(appliedRate)
  → 세목별 raw→절사 과정(실제 대입값)

[SectionCard "이 결과가 반영하지 않는 것"]  ← 아래 "9.2"
[SectionCard "꼭 확인하세요" — 법적 고지]  ← 아래 "9.2"

[IntroSection] [UsageGuide] [FaqAccordion]
```

### 9.2 정책 고지 문구 — 4단 그룹화(전부 한 목록으로 나열하지 않는다)

이 계산기는 이 사이트에서 가장 많은 정책 고지 문구를 요구한다(FORMULA.md 11단계 (a)~(e) +
SPEC.md Must Have 5개 항목이 상당 부분 겹치지만 문구는 조금씩 다르다). 전부 한 리스트로
나열하면 사용자가 실제로 중요한 것(적용 대상·감면 여부)을 놓치기 쉬우므로, 성격이 다른
4개 그룹으로 나눠 배치한다(정확한 시각적 톤·순서는 UX/UI Critic이 화면을 보고 조정할 여지를
남긴다 — Architect는 "정보 구조"만 확정한다).

1. **스코프 배너**(위 "9.1", 결과와 무관하게 항상 노출): 매매·주택·개인 취득만 계산.
2. **입력 옆 helpText**(조정대상지역 입력에 결합): 자가 확인 책임 + 확인 방법 안내. 이
   항목만 유일하게 "결과 화면"이 아니라 "입력 화면"에 1차로 배치한다 — SPEC.md가 명시적으로
   "입력 옆에"라고 지정했기 때문이다.
3. **"이 결과가 반영하지 않는 것"(계산 결과 이후, 불릿 목록)**: FORMULA.md 11단계 (a)~(c),
   (e)를 여기 모은다 — 일시적 2주택 미반영, 지방 저가주택(공시가격 2억원 이하) 특례 미반영,
   생애최초 등 감면 미반영, 읍·면 100㎡ 특례 미반영(확인 필요). 네 항목 모두 "이 계산기가
   특정 조건에서 실제보다 **과대 추정**할 수 있다"는 같은 성격(안 보여주면 사용자가 손해를
   볼 수 있는 방향)을 공유해 한 그룹으로 묶는 것이 자연스럽다. `policy.ts`의
   `HOUSING_ACQUISITION_TAX_OPEN_QUESTIONS`와 FORMULA.md "예외" 절 텍스트를 `content.ts`가
   조합해 문구를 만든다.
4. **표준 법적 고지 footer(다른 정책형 계산기와 공통 톤)**: 추정치·현재 시행 세율 기준·
   지방세법 개정이나 조정대상지역 지정·해제로 달라질 수 있음·위택스(wetax.go.kr) 또는
   관할 시·군·구청에서 확인·공식 고지서 아님·데이터 마지막 검토일(policy.ts
   `lastVerified`) 표시. 이 그룹은 `four-major-insurance`/`national-pension-benefit-
   estimate` 등 기존 정책형 계산기들의 표준 고지 톤을 그대로 재사용한다(새 패턴 아님).

- **Should Have(교차 안내)**: `housing-subscription-score`와의 관계 안내("이 계산기는 청약
  가점이 아니라 실제 취득세액을 계산합니다")는 위 4개 그룹 중 어디에도 강제로 끼워 넣지
  않는다 — SectionCard "이 결과가 반영하지 않는 것" 아래 또는 FAQ 항목으로 두는 것을
  권장하되, Should Have이므로 이번 v1 필수 배치 대상은 아니다.

### 9.3 보유 주택 수 입력 UI — 4개 카드형 라디오(select 아님)

`bmr-calculator`의 활동량 선택 판단(ARCHITECTURE.md "7.2")과 같은 이유로 카드형 라디오를
택한다 — 4개는 `national-pension-benefit-estimate`의 11개(select 채택 이유였던 "세로 나열
부담")보다 훨씬 적고, "1채/2채/3채/4채 이상"은 사용자가 이미 알고 있는 정확한 값을 목록에서
찾는 것이 아니라 명확히 구분된 4개 선택지 중 하나를 고르는 것이라 한 번에 펼쳐 보여주는
카드형이 더 적합하다(`loan-interest-calculator`의 상환방식 3택 카드와 같은 성격).

---

## 10. Golden Test 배치 전략

FORMULA.md의 17개 검증 예제를 `logic.test.ts`(대부분)와 `validation.test.ts`(입력 검증
실패 케이스, FORMULA.md에 명시적 예제는 없지만 SPEC.md Must Have 요건이라 Builder가 직접
작성)로 나눈다.

```ts
// logic.test.ts

describe("determineStandardRate — 가격 구간 경계 및 6~9억 구간 반올림 (Golden Test #3~6, #16)")
  // #3: 정확히 6억원(가목 경계, low 유지)
  // #4: 6.5억원(mid, 0.0133 — 위 "2." 반올림 정정의 핵심 회귀 테스트)
  // #5: 정확히 9억원(mid 산식 적용, 결과값은 다목과 동일 0.03이지만 근거는 나목이어야 함)
  // #6: 9.5억원(high, 0.03 고정)
  // #16: 8억원(mid, 0.0233 — "2."의 두 번째 회귀 테스트)
  // 추가 권장(FORMULA.md 17개에는 없지만 경계 완전성을 위해 Builder가 보강): 599,999,999원
  // (low 유지), 600,000,001원(mid 진입), 899,999,999원/900,000,001원(mid/high 경계)

describe("determineAppliedRate — 다주택자·조정대상지역 중과세율표 8행 전체 (Golden Test #9~15)")
  // #9: 조정·1주택 → 표준세율(조정 여부 무관 재확인)
  // #10: 비조정·2주택 → 표준세율(중과 아님)
  // #11: 비조정·3주택 → 8% 중과
  // #12: 조정·2주택 → 8% 중과(예제11과 값이 완전히 같아야 함)
  // #13: 비조정·4채 이상 → 12% 중과(예제11과 22,000,000원 차이 — 4구간 설계의 존재 이유를
  //   직접 증명하는 핵심 회귀 테스트, 반드시 포함)
  // #14: 조정·3주택(또는 4+) → 12% 중과(예제13과 완전히 동일해야 함)
  // #15: 조정·1주택 vs 조정·3주택+ 배수 비교(약 11.27배, SPEC 필수 대조 케이스)
  // 완료 기준 불변식(Builder 권장): heavyRate.rows 8행을 전부 `it.each`로 스윕해 policy.ts
  //   표와 함수 반환값이 1:1로 일치하는지 확인.

describe("calculateTaxAmounts — 세목별 계산·85㎡ 비과세 경계·10원 미만 절사 (Golden Test #1~2, #7~8, #17)")
  // #1: 85㎡ 이하 비과세, #2: 100㎡ 과세, #7: 정확히 85㎡(경계, 비과세), #8: 85.01㎡(과세 시작)
  // #17: 10원 미만 절사(잠정, 확인 필요 — 테스트 파일 주석에 "Calculation Auditor 위택스
  //   대조 전까지 잠정" 명시. localEducationTaxRaw가 acquisitionTaxRaw(절사 전)를 참조했는지
  //   직접 assert(위 "6." 핵심 불변식).

describe("calculateHousingAcquisitionTax — 오케스트레이터 조립 (나머지 조합)")
  // 예제 5·6처럼 여러 단계가 함께 얽히는 케이스, 표준세율 항상 계산 필드(standardRate)가
  // 중과 케이스에서도 값이 채워지는지 확인(FORMULA.md "출력값" 표 요건).

// validation.test.ts
describe("입력 검증 실패")
  // acquisitionPrice/exclusiveArea 0 이하·비숫자, isAdjustmentTargetArea/
  // houseCountAfterAcquisition 미선택 — SPEC.md "오류와 예외 처리" 그대로.
```

- `docs/CALCULATOR_RULES.md` "Golden Test — 공식 계산기 예시값과 대조한 케이스 최소 2개"는
  FORMULA.md가 예제 12·14(총부담률 9.0%/13.4% 벤치마크 교차 확인)로 충족했다고 주장한다 —
  다만 이는 "위택스 등에 직접 입력해 얻은 결과"가 아니라 "여러 2차 출처의 반복 인용치와의
  정합성 확인"이다. **national-pension-benefit-estimate가 세운 PUBLISHED 게이트 선례를
  참고해, 이 계산기도 Calculation Auditor가 wetax.go.kr 모의계산과 최소 1건 이상 실제
  대조하기 전까지는 이 요건이 "약하게만" 충족된 상태임을 인수인계에 명시한다.** 다만
  national-pension처럼 "12배 부풀려짐" 등급의 구조적 위험(÷12 누락)까지는 아니고 세율표
  자체는 법 조문을 직접 대입한 것이라, 이 계산기에 대해 registry `published` 전환을 전면
  금지하는 강한 게이트까지는 걸지 않는다 — 대신 아래 "14."에 Calculation Auditor 최우선
  항목으로 명시한다.

---

## 11. 공통 컴포넌트 재사용 검토

- **`ShareActions`**: 그대로 재사용한다. 공유 상태(`HousingAcquisitionTaxFormInput`)는 전부
  원시 타입(`number`/`boolean`/리터럴)이라 직렬화 문제가 없다.
- **`SectionCard`/`UsageGuide`/`IntroSection`/`FaqAccordion`**: 그대로 재사용한다.
- **핵심 결과 카드**: 새 컴포넌트를 만들지 않는다 — 기존 `bg-primary` 강조 카드 패턴을
  `ui.tsx`에서 직접 구현한다. 이 계산기는 national-pension/bmr-calculator와 달리 "이중
  카드"(1차/2차)가 필요 없다 — `totalTax` 하나만 항상 핵심 결과다.
- **세목별 내역 카드**: 새 컴포넌트로 승격하지 않는다 — `four-major-insurance`가 이미
  "보험 4종 내역을 표 형태로 나열"하는 유사 패턴을 갖고 있으므로 그 마크업 스타일을 참고해
  로컬로 구현한다(세 세목이라 재사용 가치가 크지 않다).
- **보유 주택 수 카드형 라디오**: 새 공용 컴포넌트 불필요 — `loan-interest-calculator`/
  `bmi-calculator`의 `sr-only` 라디오 + 스타일 입힌 `label` 패턴을 그대로 재사용한다(위
  "9.3").

---

## 12. registry.ts 등록 계획

- 이번 Architect 라운드에서는 등록하지 않는다(위 "0.", 기존 관례).
- Builder가 UI 구현을 완료하면 다음으로 등록한다(SPEC.md "슬러그/카테고리" 그대로, Architect
  이견 없음):
  ```
  slug: "housing-acquisition-tax"
  title: "주택 취득세 계산기"
  category: "tax"
  status: "draft"
  ```
- **아이콘: `calculator`(SPEC.md 제안 그대로 채택).** SPEC.md 근거(`tax` 카테고리에 이미
  `heart`(four-major-insurance)·`chart`(housing-subscription-score)·`coins`(annual-salary-
  take-home-pay, national-pension-benefit-estimate, 2회 중복)가 쓰이고 있어 `calculator`가
  시각적으로 구분된다)를 재확인했다 — 현재 `registry.ts`에서 `calculator` 아이콘은
  `unemployment-benefit`(labor 카테고리) 1곳뿐이라 `tax` 카테고리 안에서는 중복이 없다.
  Architect는 이 판단에 동의하며 새 아이콘 키 신설이 필요 없다.
- 초기 `status: "draft"`. national-pension-benefit-estimate 같은 "라이브 계산기 대조 없이는
  published 불가"라는 전면 게이트까지는 걸지 않지만(위 "10." 참고), 통상적인 3단계
  (Calculation Auditor → UX/UI Critic → QA) 통과 기준에 더해 **위 "2."(반올림 대상 정정)와
  "6."(10원 미만 절사 확인 필요)를 Calculation Auditor가 명시적으로 재검증했다는 기록**이
  EVALUATION.md에 남아야 `published` 전환을 권장한다.

---

## 13. 폴더/파일 구조 및 Builder 인수인계 요약

```
src/calculators/housing-acquisition-tax/
  types.ts          # 입력·결과 타입 (Architect 완성 — 위 "7.")
  policy.ts          # 세율표·출처 메타데이터 (Architect 완성 — 위 "3.")
  logic.ts          # determineStandardRate, determineAppliedRate, calculateTaxAmounts,
                     # calculateHousingAcquisitionTax (위 "5.", 단일 파일)
  logic.test.ts     # FORMULA.md Golden Test 17개(경계값 describe 그룹, 위 "10.")
  validation.ts     # 입력 검증, 상한 가드(위 "8.")
  validation.test.ts
  formatting.ts     # 금액 천단위 콤마, 세율 %표시, 계산 근거 문자열 조립
  formatting.test.ts
  content.ts        # 소개/사용법/FAQ, 정책 고지 문구 4단 그룹(위 "9.2") 조립,
                     # 조정대상지역 참고 스냅샷(위 "3.3"), HOUSING_ACQUISITION_TAX_OPEN_
                     # QUESTIONS 소비
  ui.tsx            # 입력 폼(4개 라디오 카드 포함) + 핵심 카드 + 세목별 내역 카드 +
                     # 계산 근거 SectionCard + 정책 고지 2개 SectionCard(위 "9.1")
```

Builder 체크리스트:
1. `logic.ts` 3+1 함수, 위 "5." 시그니처 그대로. `policy.ts`의 상수만 참조하고 매직 넘버를
   직접 쓰지 않는다.
2. `localEducationTaxRaw` 표준세율 분기는 반드시 `acquisitionTaxRaw`(절사 전)를 참조한다
   (위 "6." 핵심 계약, Golden Test 예제 17로 검증).
3. `determineStandardRate`의 반올림은 세율을 **소수(fraction)로 나타낸 값 자체**에 4자리
   반올림을 적용한다(위 "2.", policy.ts 주석 재확인).
4. `houseCountAfterAcquisition`은 4구간(위 "1.")이다 — SPEC.md 원문의 "3채 이상" 표현을
   그대로 옮기지 않는다.
5. `validation.ts`: 4구간 리터럴 유니온 방어(공유 URL 복원 경로), 취득가액/전용면적 상한은
   "확인 안내" 수준으로(위 "8.").
6. `content.ts`: 정책 고지 4단 그룹(위 "9.2"), 조정대상지역 스냅샷(위 "3.3", 3차 출처
   신뢰도 고지 포함), `HOUSING_ACQUISITION_TAX_OPEN_QUESTIONS` 반영.
7. `ui.tsx`: 스코프 배너 → 입력(조정대상지역 helpText에 자가 확인 책임 포함) → 핵심 카드
   (totalTax) → 세목별 내역 → 계산 근거 → 정책 고지 2개 SectionCard → 소개/사용법/FAQ.
8. 레지스트리에 `status: "draft"`로 등록(위 "12.").
9. 새 계산기 완료 후 기존 계산기 Smoke Test 실행(docs/EVALUATION.md "회귀 방지") — 이번
   라운드는 신규 파일만 추가했고 공용 코드를 전혀 건드리지 않아(아래 "회귀 방지 확인")
   회귀 위험은 원천적으로 없지만 관례대로 재확인을 권장한다.

---

## 14. 회귀 방지 확인 및 Calculation Auditor 최우선 체크리스트

**공용 코드 — 전혀 수정하지 않음**: `src/lib/`, `rates-2026.json` 등 다른 계산기와 공유하는
파일을 하나도 건드리지 않았다(위 "6."에서 `truncateTo10Won` 재사용을 의도적으로 거부한
결정 참고). `npx tsc --noEmit` 재실행으로 신규 파일 2개(`types.ts`, `policy.ts`)에 구문
오류가 없음을 확인했다 — 다른 계산기가 이 폴더를 import하지 않으므로 회귀 위험이 없다.

**Calculation Auditor 최우선 체크리스트(우선순위 순)**:
1. **[위 "2."] 6~9억 구간 세율의 소수 4자리 반올림이 fraction 값 자체에 적용됐는지** —
   6.5억(0.0133)·8억(0.0233) 회귀 테스트로 확인.
2. **[FORMULA.md 자체 권고] 10원 미만 절사(내림) 규칙을 wetax.go.kr 등 실제 계산기와 최소
   1건 이상 대조** — 위 "3.2"·"6." `policy.ts` `rounding` 참고.
3. **[FORMULA.md "4."] 농특세 중과세율(0.6%/1.0%) 산정 방식의 "부분 확인" 재검증** —
   가능하면 위택스 대조로 격상.
4. **[위 "1."] 4구간 heavyRate 8행 전체가 실제로 8%/12%/표준세율을 정확히 분기하는지** —
   특히 예제 13(비조정 4채 이상, 12%)과 예제 11(비조정 3채, 8%)의 22,000,000원 차이가
   실제로 재현되는지.

---

## 15. 남은 리스크 / 확인 필요

- FORMULA.md 자신이 "확인 필요"로 남긴 항목(10원 미만 절사 근거, 농특세 중과 산정 방식
  부분 확인, 읍면 100㎡ 특례)은 Architect가 임의로 해소하지 않았다 — `policy.ts`
  `HOUSING_ACQUISITION_TAX_OPEN_QUESTIONS`에 그대로 옮겨 Calculation Auditor·Builder가
  놓치지 않게 했다.
- 위 "2."(반올림 대상 정정)는 Architect가 FORMULA.md의 검증 예제·외부 인용치를 근거로
  내린 해석이지, 위택스 등 1차 출처로 재확인한 것은 아니다 — Calculation Auditor가 가능하면
  이 해석 자체도 재검증할 것을 권고한다(위 "14." 1번).
- 4단 정책 고지 그룹(위 "9.2")의 정확한 시각적 배치(카드 색상·굵기·접기/펼치기 여부 등)는
  Builder 구현 후 UX/UI Critic이 실제 화면으로 재검토해야 한다 — Architect는 "몇 개 그룹으로
  나누는지, 어느 그룹이 어디에 위치하는지"라는 정보 구조까지만 확정했다.
