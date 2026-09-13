# EVALUATION: 주휴수당 계산기

## Builder 구현 완료

2026-09-04, Builder가 승인된 SPEC.md / FORMULA.md / ARCHITECTURE.md를 그대로 구현했다.
아래는 구현 사실 기록이며 최종 정확성 판정이 아니다 — 최종 판정은 Calculation Auditor ·
UX/UI Critic · QA의 몫이다(.claude/agents/builder.md).

### 구현한 파일

- `src/calculators/weekly-holiday-allowance/logic.ts` — `calculateWeeklyHolidayAllowance`
  본문. FORMULA.md "공식" 1~9단계 그대로. 40/8/15/월환산계수(365·12·7)·최저임금은 전부
  `getApplicableRates()`가 조회한 `rates-2026.json`의 `laborStandards.*` / `minimumWage.hourly`
  에서 읽는다(하드코딩 없음). 월 환산은 `(amount * daysPerYear) / (monthsPerYear * daysPerWeek)`
  로 곱셈 먼저·나눗셈 마지막 1회. 금액 5개 필드 + `weeklyHolidayHours`는 **완전정밀도(반올림
  전)** 로 반환. 결과에 `appliedRateYear`(=APPLICABLE_RATE_YEAR=2026), `minimumHourlyWage`,
  `meetsMinHoursRequirement`, `belowMinimumWage`, `cappedAtStatutoryLimit` 포함.
- `src/calculators/weekly-holiday-allowance/validation.ts` —
  `validateWeeklyHolidayAllowanceInput`. `hourlyWage`("시급"): 필수·정수만·`>0`·`≤1,000,000`.
  `weeklyHours`("주 근무시간"): 필수·소수 허용(0.5 배수 강제 안 함)·`>0`·`≤168`. 15 미만 /
  40 초과 / 최저임금 미만은 오류로 처리하지 않음. severance-pay / unemployment-benefit의
  `toOptionalNumber` / `hasFinalConsonant` / `particle`(한글 조사) 헬퍼를 같은 패턴으로 재사용.
  오류 메시지 라벨은 입력·결과와 동일하게 "시급" / "주 근무시간"으로 통일.
- `src/calculators/weekly-holiday-allowance/formatting.ts` — 기존 `roundWon` / `formatWon` /
  `formatHourlyWage` / `formatHours`는 그대로 사용. 추가: `buildWeeklyHolidayBreakdown`(계산
  방법 "라벨 = 값" 수식 문자열, 근거 법령 병기 — unemployment-benefit v2 스타일),
  `buildMinHoursWarning` / `buildBelowMinimumWageWarning`(경고 문구 조립, 최저임금 경고는
  연도·값 + 수습 감액 보조 문구 포함), `MONTHLY_REFERENCE_NOTE`(월 환산 "참고액" 주석 +
  209시간 관례 차이 고지), `STATUTORY_LIMIT_NOTICE`(40시간 초과 고지).
- `src/calculators/weekly-holiday-allowance/ui.tsx` — 전체 화면. 입력 2필드(시급 →
  주 근무시간 순서), 핵심 결과 카드 = 1주치 주휴수당, 계산 상세/계산 방법/적용된 입력값
  SectionCard, 경고 카드 2종(15시간 미만 / 최저임금 미만, 독립 조건·동시 표시 가능),
  월 환산 "참고액" 라벨 + 주석, `aria-live="polite"` 결과 영역, 입력-오류 `aria-describedby`.
  소개 문구·FAQ는 FORMULA.md "소개 문구" / "FAQ 콘텐츠" 원문. 공통 화면 순서(소개 → 사용
  방법 → 입력 → 결과 → 계산 근거 → 정책 안내 → FAQ) 준수. 샘플 = FORMULA.md 예제 1
  (`hourlyWage=10320`, `weeklyHours=40`).
- `src/calculators/weekly-holiday-allowance/seo-content.ts` — 신규. FAQ 6개(질문·답변
  FORMULA.md 원문, 마크다운 표기만 제거)를 SSOT로 두고 `weeklyHolidayAllowanceFaqItems`
  (FaqAccordion용) / `weeklyHolidayAllowanceFaqSeoItems`(JSON-LD FAQPage용) 두 형태로 export.
- `src/calculators/weekly-holiday-allowance/logic.test.ts` — `it.todo` → 실제 테스트.
  FORMULA.md 검증 예제 7개를 Golden Test로(각 주석에 FORMULA.md 원문 라벨·외부 대조 여부·
  확인일·"라이브 최종표시값 1:1 재현 미실시" 한계 그대로), 예제 2·3이 외부 대조 케이스임을
  명시. Edge Case(40 경계/40 바로 위/15 경계 아래·경계·위/최저임금 정확히·미만/극단 입력/
  `weeklyHolidayHours` 비반올림) + `roundWon` 정책 테스트.
- `src/calculators/weekly-holiday-allowance/validation.test.ts` — 신규. 정상 입력, 오류로
  막는 입력(빈 값/0/음수/숫자 아님/비정수 시급/상한 초과/168 초과), 오류가 아닌 것
  (15 미만·40 초과·최저임금 미만).
- `src/calculators/calculator-components.ts` — `"weekly-holiday-allowance"` →
  `WeeklyHolidayAllowanceCalculatorUi` 연결(default export).
- `app/calculators/[slug]/page.tsx` — `faqItemsBySlug`에 `"weekly-holiday-allowance"` 등록
  (JSON-LD FAQPage).

### 검증 결과 (Builder 실행 — 최종 판정 아님)

- `npx tsc --noEmit` — 오류 0.
- `npx eslint .` — 경고/오류 0.
- `npx vitest run --no-file-parallelism` — (ARCHITECTURE.md "남은 리스크"의 샌드박스 병렬
  실행 이슈 회피 옵션) 전체 통과. 기존 102개 + 주휴수당 신규(logic.test.ts, validation.test.ts).
- `npm run build`(next build) — 성공. `registry.ts` status가 `draft`라
  `/calculators/weekly-holiday-allowance`는 SSG 프리렌더 목록·sitemap에는 나타나지 않지만,
  `calculator-components.ts`에 연결돼 URL 직접 접근 시 렌더링된다.
- 회귀: severance-pay / unemployment-benefit 기존 테스트 그대로 통과, 두 계산기 페이지 빌드
  정상 포함.

### FORMULA 대비 Builder가 임의 판단한 지점 (Auditor 확인 요청)

1. **FAQ 6번 "근거" 줄**: FORMULA.md 원문은 `근거: SPEC.md "범위 밖"(...)`으로 내부 문서명을
   인용한다. 사용자에게 보이는 화면·JSON-LD이므로 "이 계산기의 범위 밖(포괄임금·월급제 계약
   분해는 다루지 않음)"으로 문구만 조정했다(법적 취지·내용은 동일).
2. **`weeklyHours` 입력에 `step={0.5}` 속성**: `type="text"`(실시간 콤마·소수 입력 자유도를
   위해 severance-pay / unemployment-benefit와 동일하게 text 사용)에서는 `step`이 동작하지
   않지만, ARCHITECTURE.md "입력 필드 설계"가 명시한 "0.5 단위 소수 입력 UI 힌트"를 코드에
   남기기 위해 속성으로 표기했다(주석 포함). validation은 0.5 배수를 강제하지 않는다.
3. **소개 문구를 두 문단으로 분리**: FORMULA.md "소개 문구" 한 문단을 문장 경계에서만 나눴다
   (단어·순서 불변, severance-pay 선례와 동일).

### Calculation Auditor / Critic / QA가 특히 볼 지점

- **반올림 방향**(FORMULA.md "확인 필요" 1): `roundWon`(round half up + EPSILON 1e-6)을
  formatting.ts 단일 함수로 분리. 노동OK/알바천국에 예제 1·2를 실제로 넣어 최종 표시 금액
  (반올림·월 환산 포함)을 라이브 대조하면 정책을 확정/조정할 수 있다. logic.ts는 완전정밀도만
  반환하므로 이 함수 본문만 고치면 된다.
- **월 환산 4.345 직접 곱셈 vs 209시간 관례**(FORMULA.md "확인 필요" 2): 주 40시간 근로자
  `monthlyTotalPay`가 최저임금 고시 최저월급(2,156,880원)보다 4,423원 낮다. 이 계산기는
  365/84 직접 곱셈 채택. UI는 월 환산액을 "참고액"으로 라벨링하고 `MONTHLY_REFERENCE_NOTE`로
  209시간 차이를 고지한다.
- **예제 5의 EPSILON 의존**: `2.8 × 10,320`이 부동소수점으로 `28,895.9999999996`처럼 계산돼
  `monthlyHolidayPay` / `weeklyTotalPay` 등이 정수 경계 바로 아래로 드리프트한다 —
  `roundWon`의 EPSILON 보정이 실제로 필요한 케이스다(logic.test.ts 주석 참고).
- **소정근로일 5일 기준 고정**(FORMULA.md "확인 필요" 3·4): 소정근로일수를 입력받지 않아 항상
  ÷5(= ÷40×8). 정책 안내 섹션에 "통상근로자 주 40시간·주 5일 기준" 전제를 명시했다.

## Calculation Auditor

2026-09-04. Builder를 신뢰하지 않고 코드(`logic.ts` / `validation.ts` / `formatting.ts` /
`types.ts` / `ui.tsx` / 두 테스트 파일)를 직접 읽고, `logic.ts`를 import하지 않는 **별도
Node 스크립트**로 FORMULA.md 검증 예제 7개를 손계산 그대로 재현했으며, `curl`로 **노동OK ·
알바천국 · 시프티 · 생활계산기(calcava)의 실제 계산 스크립트 소스를 4개 모두 추출**해 이
계산기 결과와 대조했다. Edit 권한 없이 읽기만 했고 Bash는 테스트 재실행·독립 재계산·소스
대조 용도로만 썼다.

### 1. 구현 ↔ FORMULA.md 일치 여부 — 완전 일치 확인

`logic.ts`를 FORMULA.md "공식" 1~9단계 / "계산 순서" 1~10단계 / "정밀도·반올림 정책" /
ARCHITECTURE.md "숫자 정밀도 전략"과 한 줄씩 대조했다.

| FORMULA.md | 구현(logic.ts) | 일치 |
|---|---|---|
| 1. `weeklyHolidayHours = min(weeklyHours / 40 * 8, 8)`, 중간 반올림 없음 | `Math.min((weeklyHours / statutoryWeeklyHours) * statutoryDailyHours, statutoryDailyHours)` — 나눗셈 후 곱셈, `Math.min` 상한, 반올림 없음 | ✅ |
| 2. `weeklyHolidayPay = weeklyHolidayHours * hourlyWage` (원) | `weeklyHolidayHours * hourlyWage` — 완전정밀도 | ✅ |
| 3. `monthlyHolidayPay = weeklyHolidayPay * 365 / 84`, ÷84는 곱셈 뒤 1회 | `(weeklyHolidayPay * daysPerYear) / (monthsPerYear * daysPerWeek)` — 곱셈 먼저, 나눗셈 마지막 1회 | ✅ |
| 4. `weeklyTotalPay = weeklyHours * hourlyWage + weeklyHolidayPay` | 동일 | ✅ |
| 5. `monthlyTotalPay = weeklyTotalPay * 365 / 84` | `(weeklyTotalPay * daysPerYear) / (monthsPerYear * daysPerWeek)` | ✅ |
| 6. `effectiveHourlyWage = weeklyTotalPay / weeklyHours` | 동일 | ✅ |
| 7. `meetsMinHoursRequirement = weeklyHours >= 15` | `weeklyHours >= ultraShortTimeWeeklyHours` (`>=`, 게이팅 아님) | ✅ |
| 8. `belowMinimumWage = hourlyWage < minWageHourly` | `hourlyWage < minimumHourlyWage` (`<` strict) | ✅ |
| 9. `cappedAtStatutoryLimit = weeklyHours > 40` (파생, UI 고지용) | `weeklyHours > statutoryWeeklyHours` (`>` strict — 정확히 40이면 false) | ✅ |

- **상수 하드코딩 없음**: 40 / 8 / 15 / 365·12·7 / 최저임금 10,320 전부
  `getApplicableRates().laborStandards.*.value` / `.minimumWage.hourly.value`에서 읽는다.
  `logic.ts`에 숫자 리터럴 상수는 `APPLICABLE_RATE_YEAR = 2026` 하나뿐이다. `grep`으로 확인.
- **월 환산 계수 미리 반올림 안 함**: `monthsPerYear * daysPerWeek`(= `12 * 7`)로 계산하며
  `4.345` 리터럴은 `logic.ts`에 없다(코드·주석 모두 `grep` 확인). `4.345` 문자열은
  `formatting.ts`의 화면 표기 라벨(`MONTHLY_FACTOR_LABEL = "365 ÷ 12 ÷ 7 ≈ 4.345주"`)에만
  존재하며 계산에 쓰이지 않는다.
- **반올림 위치**: `logic.ts`에는 `Math.round` / `Math.floor` / `Math.ceil` / `toFixed`가
  전혀 없다(`Math.min` 상한 처리만 있음). 금액 5필드 + `weeklyHolidayHours`는 완전정밀도로
  반환된다. `roundWon`(round half up + EPSILON)은 `formatting.ts`에만 있고, `formatWon` /
  `formatHourlyWage`를 통해 표시 직전에만 각 값에 독립 1회 적용된다. 반올림된 값이 다른 값의
  계산에 재사용되는 경로 없음(logic이 exact만 반환하므로 구조적으로 불가능).
- **`validation.ts` 게이팅 없음 확인**: `validateRequiredPositive`가 막는 것은 빈 값 /
  숫자 아님(NaN) / `<= 0` / (시급) 비정수 / `> max`뿐이다. 15 미만 · 40 초과 · 최저임금 미만을
  오류로 처리하는 코드 경로가 없다(테스트 `validation.test.ts` "오류가 아닌 것" describe로도
  검증). SPEC "설계상 핵심 결정(게이팅 없음)" 준수.
- **Builder 임의 판단 3건**(위 Builder 절): FAQ 6번 근거 문구 조정 / `step={0.5}` UI 힌트 /
  소개 문구 2문단 분리 — 모두 계산 로직·수치와 무관한 표시 문구 수정. 계산 정확성에 영향 없음.

**구현 결함(Builder가 공식·반올림 정책을 임의로 바꾼 흔적) 없음.**

### 2. 독립 재계산 — 검증 예제 7개 전부 FORMULA.md Expected와 일치

`logic.ts`를 import하지 않는 별도 Node 스크립트(`rates-2026.json` 상수만 읽고 산식은
FORMULA.md "공식"을 보고 직접 구현, round half up + EPSILON 1e-6)로 재현했다.

| 예제 | 입력 | weeklyHolidayHours | weeklyHolidayPay | monthlyHolidayPay | weeklyTotalPay | monthlyTotalPay | effectiveHourlyWage | 판정 |
|---|---|---|---|---|---|---|---|---|
| 1 | 10,320 / 40h | 8 | 82,560 | 358,743 | 495,360 | 2,152,457 | 12,384 | ✅ 전부 일치 |
| 2 | 10,000 / 20h | 4 | 40,000 | 173,810 | 240,000 | 1,042,857 | 12,000 | ✅ 전부 일치 |
| 3 | 9,000 / 16h | 3.2 | 28,800 | 125,143 | 172,800 | 750,857 | 10,800 | ✅ 전부 일치 |
| 4 | 12,000 / 15h | 3 | 36,000 | 156,429 | 216,000 | 938,571 | 14,400 | ✅ 전부 일치 |
| 5 | 10,320 / 14h | 2.8 | 28,896 | 125,560 | 173,376 | 753,360 | 12,384 | ✅ 전부 일치 |
| 6 | 15,000 / 48h | 8 (상한) | 120,000 | 521,429 | 840,000 | 3,650,000 | 17,500 | ✅ 전부 일치 |
| 7 | 11,000 / 13.5h | 2.7 | 29,700 | 129,054 | 178,200 | 774,321 | 13,200 | ✅ 전부 일치 |

- 플래그도 전부 일치: 예제 2·3 `belowMinimumWage=true`, 예제 5·7 `meetsMinHoursRequirement=false`,
  예제 6 `cappedAtStatutoryLimit=true`, 예제 5 `belowMinimumWage=false`(10,320 == 최저임금,
  미만 아님).
- FORMULA.md가 "나누어떨어짐"으로 표기한 예제 5(125,560 / 753,360)·6(3,650,000) 검산:
  `28,896 × 365 ÷ 84 = 10,547,040 ÷ 84 = 125,560.0`, `173,376 × 365 ÷ 84 = 63,282,240 ÷ 84 =
  753,360.0`, `840,000 × 365 ÷ 84 = 306,600,000 ÷ 84 = 3,650,000.0` — 정확히 정수. 확인.
- `npm test`(vitest) 코드 실행 결과(`logic.test.ts` Golden 7개)와 내 독립 재계산이 서로 일치.

#### 2-a. 예제 5 부동소수점 드리프트 + EPSILON 검증

`(14/40)*8 = 2.7999999999999998`, `× 10,320 = 28,895.999999999996`(수학적 참값 28,896 정수).
`× 365 ÷ 84 = 125,559.99999999998`(참값 125,560 정수).
- round half up 정책에서는 `Math.round(28,895.9999...) = 28,896`, `Math.round(125,559.9999...)
  = 125,560`이 **EPSILON 없이도** 정답이다 → 예제 5에서 EPSILON은 결과를 바꾸지 않는다
  (Builder EVALUATION의 "예제 5의 EPSILON 의존" 서술은 이 점에서 다소 부정확하나, 결론
  "EPSILON 필요"는 아래 2-b대로 일반적으로 옳고 구현도 정확하다 — 조치 불요, 문서 뉘앙스).

#### 2-b. EPSILON(1e-6) 오탐 위험 — 엄밀 스캔으로 "오탐 0" 확인

`hourlyWage ∈ [500, 40000]`(정수) × `weeklyHours ∈ [0.05, 168]`(0.05 step)의 전 조합
(약 1.3억 × 5필드)에 대해, **BigInt 유리수로 계산한 참값의 소수부**를 `roundWon`(float +
EPSILON) 결과와 대조했다:
- **참값이 x.5 미만이거나 정수인데 EPSILON이 위로 올린 경우(오탐): 0건.**
- **참값이 정확히 x.5인데 float가 x.4999...로 드리프트해 EPSILON이 올바르게 올림한 경우:
  534,938건** (예: 시급 502 / 주 31.5h → `monthlyHolidayPay` 참값 정확히 82,453.5). 이 케이스는
  EPSILON 없이는 round half up이 아래로 잘못 내려간다 → **EPSILON은 장식이 아니라 실제로
  필요**하다.
- 도메인 구조상(시급 정수, 주시간 소수 2자리 → 유리수 분모가 42,000×20 이하, 참값과 x.5의
  최소 간격이 1e-6보다 몇 자릿수 큼) 오탐이 나올 수 없음이 실증됐다. 이론상 오탐은
  사용자가 `weeklyHours`를 소수 5자리 이상(예: 13.33333)으로 입력하고 그 조합이 월 참고액
  참값을 x.5의 6e-7 이내로 만들 때만 가능하며, 그때도 오차는 "참고액" 1원. 실질 위험 없음.

**EPSILON = 1e-6은 이 계산기 입력 도메인에서 안전하고 필요하다.**

### 3. FORMULA.md ↔ 실제 법령·근거 일치 재확인

| 항목 | FORMULA.md 서술 | 독립 확인 결과 |
|---|---|---|
| 1주 주휴시간 = `weeklyHours ÷ 5`(= ÷40×8) | 대법원 2022다291153이 "1주 소정근로시간 ÷ 1주 소정근로일수, 5일 미달이면 5일로 봄" 제시 | **대법원 2025.8.14. 선고 2022다291153**: 유급주휴시간 = 1일 평균 소정근로시간(1주 소정근로시간 ÷ 1주 소정근로일수)이 원칙, **소정근로일 5일 미만이면 5일로 보고 나눔**. 판결 예시 "4.75시간 = 23.78시간 ÷ 5일". FORMULA.md 서술과 정확히 일치. 소정근로일 ≤ 5인 근로자에게 `weeklyHours ÷ 5`가 곧 대법원 방식이다. |
| 40시간(주휴 8시간) 상한 | 소정근로시간은 법정근로시간(1일 8h·1주 40h) 이내, 초과분은 연장근로라 주휴 산정 제외 | 근로기준법 제2조제1항제8호(소정근로시간 정의) + 제50조제1항·제2항(40h/8h). 유급주휴시간은 "1일 소정근로시간"(최대 8h)에 대응. 상한 근거 타당. 온라인 계산기 4개 중 3개(노동OK·알바천국·생활계산기)가 실제로 8h/40h 상한 적용(아래 4절). |
| 월 환산 계수 365/84 | 고용노동부 최저임금 월 환산 계수와 동일, 209시간은 이를 정수로 올린 값 | 2026년 최저월급 2,156,880원 = 10,320 × 209, 209 = 48 × (365÷12÷7) = 208.571 → 반올림. 노동OK 계산기 페이지가 "월급여액 = (40h + 주휴 8h) × (365일÷12월÷7일)"로 명시(4.345 미리 반올림 아님) — 이 계산기의 365/84 채택을 뒷받침. "40h 근로자 monthlyTotalPay가 최저월급보다 4,423원 낮다"는 FORMULA.md 서술 검산 일치. |
| 5인 미만 사업장 적용 | 시행령 별표1에 제55조제1항 포함, 규모 무관 적용 | 2차 출처 다수 일관(샤플·시프티·서울노동권익센터 등): 주휴수당은 5인 미만에도 적용. FORMULA.md "예외" 서술과 일치. |
| 초단시간 15시간(제18조제3항) | 4주 평균 1주 15시간 미만이면 제55조·제60조 미적용 | 제18조제3항 문언과 일치. 이 계산기는 게이팅하지 않고 경고에만 사용 — SPEC 결정과 일치. |
| 제63조 적용제외 | 감시·단속적(승인)·농림·축산·수산 종사자는 주휴 미적용 | 제63조 문언과 일치. UI 정책 안내·FAQ에 반영됨. |
| `rates-2026.json` 값·조문 | 40=제50조제1항 / 8=제50조제2항 / 15=제18조제3항 / 최저임금 10,320=고시 제2025-47호 | 전부 정확. 2026년 최저임금 10,320원(2025-08-05 고시 제2025-47호, 2026-01-01 시행) 재확인. |

법령 근거상 **FORMULA.md 공식 자체의 오류는 발견되지 않았다.**

### 4. 온라인 계산기 라이브 대조 — 4개 계산 스크립트 소스 직접 추출 (FORMULA.md "확인 필요" 1·7 해소)

FORMULA.md는 "계산 스크립트가 비공개라 반올림 방향을 직접 확인 못 함"이라 남겼다. 이번
검증에서 `curl`로 **4개 계산기의 실제 계산 코드를 모두 확보**했다(확인일 2026-09-04):

| 계산기 | 확보한 소스 | 산정식 | 40h 상한 | 최종 반올림 | 월 환산 | 15h 게이팅 |
|---|---|---|---|---|---|---|
| 노동OK | `nodong.kr/sangdam/Cal/WeeklyHolidayPay/cal_v3.js?ver=0.04` | `(1주시간 ÷ 통상소정일[기본5]).toFixed(1) × 시급` | 입력 select 최대 40(코드엔 상한 없음) | **절사**(`parseInt`, `stringMoney`) | 주휴수당 월 환산 없음(통상근로자 월급여만 `(40+8)×365÷12÷7` 문구) | 없음(빈값/0만 차단) |
| 알바천국 | `m.alba.co.kr/story/CalculatorHoliday.asp` 인라인 JS | `((h>40?40:h) ÷ 40) × 8 × 시급` | **명시적**(`h>40?40:h`) | **반올림**(`toFixed(0)`) | 없음 | 없음 |
| 생활계산기(calcava) | `_next/static/chunks/06l.8k3y27i4~.js` (Next.js, 난독화 해제) | `min(h ÷ 40 × 8, 8) × 시급` | **명시적**(`Math.min(_, 8)`) | **반올림**(`Math.round`) | `Math.round(4.345 × 반올림된 주휴수당)` — 미리 반올림한 4.345 + 이미 반올림된 값 재사용 | **있음**(`<15 → 0`) |
| 시프티 | `shiftee.io/.../weeklyPaidHolidayPayCalculator.min.js` | `h ÷ 5 × 시급` | **없음**(상한 코드·입력 제한 없음) | **절사**(`Math.floor`) | 없음 | **있음**(`<15 → 0`) |

#### 4-a. 핵심 값(1주치 주휴수당) 대조 — 예제 1~4 전부 4개 계산기와 정확히 일치

각 계산기의 실제 추출 로직을 재현해 이 계산기 결과와 대조:

| 예제 | 이 계산기 | 노동OK | 알바천국 | calcava | 시프티 |
|---|---|---|---|---|---|
| 1 (40h/10,320) | 82,560 | 82,560 | 82,560 | 82,560 | 82,560 |
| 2 (20h/10,000) | 40,000 | 40,000 | 40,000 | 40,000 | 40,000 |
| 3 (16h/9,000) | 28,800 | 28,800 | 28,800 | 28,800 | 28,800 |
| 4 (15h/12,000) | 36,000 | 36,000 | 36,000 | 36,000 | 36,000 |
| 5 (14h/10,320) | **28,896** | 28,895¹ | 28,896 | 0 (게이팅) | 0 (게이팅) |
| 6 (48h/15,000) | **120,000** | 120,000² | 120,000 | 120,000 | 144,000³ |
| 7 (13.5h/11,000) | 29,700 | 29,700 | 29,700 | 0 (게이팅) | 0 (게이팅) |

¹ 노동OK는 `2.8 × 10,320`을 `parseInt`로 절사하는데 float 드리프트(`28,895.9999...`)까지 겹쳐
  **28,895원**으로 1원 낮게 표시된다. 이 계산기의 28,896원이 수학적 참값이다(EPSILON + 반올림
  으로 올바르게 처리).
² 노동OK는 입력 select가 40시간까지만 있어 48시간을 입력할 수 없다(코드에 상한 로직은 없음).
³ 시프티는 40시간 상한이 **전혀 없어** `48 ÷ 5 × 15,000 = 144,000원`으로 계산한다 — 근로기준법
  제50조상 잘못된 처리이며 나머지 3개 계산기·이 계산기와 불일치.

**정수로 떨어지는 모든 케이스(예제 1~4, 6의 상한 적용값)에서 이 계산기는 4개 계산기와 완전
일치.** 소수가 남는 입력(예: 시급 10,101 / 주 23h → `4.6 × 10,101 = 46,464.6`)에서만 갈린다:
반올림 그룹 {이 계산기, 알바천국, calcava} = 46,465원 / 절사 그룹 {노동OK, 시프티} = 46,464원.
**차이는 항상 1원 미만(1주치).**

#### 4-b. FORMULA.md "확인 필요" 1(반올림 방향) — 실측 결과: 업계 2:2 분할, 이 계산기 선택 방어 가능

- **round half up(반올림)**: 알바천국(`toFixed(0)`), 생활계산기(`Math.round`) — 이 계산기와 동일.
- **절사(버림)**: 노동OK(`parseInt`), 시프티(`Math.floor`).
- 법령·행정해석은 원 미만 단수 처리를 명문화하지 않음(FORMULA.md "부재 확인"이 옳음).
- 이 계산기의 round half up은 (1) 4개 중 2개와 일치, (2) 편향 없는 선택(참고 도구에 적절),
  (3) 실제 차이가 1주치 1원 미만·월 환산 수 원. **정책 변경 불요.** 다만 FORMULA.md의
  "직접 확인 못 함" 문구는 이번에 소스로 확인됐으므로 **문서 갱신 권고**(아래 이슈 Low-1).

#### 4-c. 월 환산 대조 — calcava만 월 환산 제공, 미리 반올림한 4.345로 이 계산기보다 낮음

`calcava`는 `Math.round(4.345 × 반올림된 주휴수당)`을 쓴다(4.345를 미리 소수 3자리로 자름 +
이미 반올림된 값 재사용 — FORMULA.md·ARCHITECTURE.md가 명시적으로 금지한 두 가지):

| 예제 | 이 계산기 monthlyHolidayPay (365/84) | calcava (4.345 × 반올림값) | 차이 |
|---|---|---|---|
| 1 | 358,743 | 358,723 | 20 |
| 2 | 173,810 | 173,800 | 10 |
| 6 | 521,429 | 521,400 | 29 |

이 계산기의 365/84 완전정밀도 방식이 더 정확하고, 노동OK 페이지 문구(`365÷12÷7`)·고용노동부
209시간 산출 계수와도 정합한다. calcava 방식이 낮게 나오는 것은 계수 절삭 때문. 두 계산기
모두 이 값을 "참고액"으로 라벨링. **이 계산기 방식이 우월하며 조치 불요**(정보성).

#### 4-d. 게이팅 — 이 계산기의 "게이팅 없이 항상 계산 + 경고"는 알바천국·노동OK와 동일 방식

calcava·시프티는 `weeklyHours < 15`에서 결과를 0으로 막지만, 알바천국·노동OK는 막지 않고
그대로 계산한다. 이 계산기의 SPEC 결정("게이팅 없음, 경고만")은 업계 관행 안에 있고 참고
도구로 더 유용하다. 정상.

### 5. 테스트·타입 재실행 (직접 실행)

- `npm test`(= `vitest run`, **병렬 옵션 없이**) — **12개 파일 150개 테스트 전부 통과**.
  (Builder/Architect가 보고한 샌드박스 병렬 실행 이슈는 이 환경에서 재현되지 않았고
  `--no-file-parallelism` 없이도 통과.)
  - `weekly-holiday-allowance/logic.test.ts` — Golden 7 + `formatWon` 표시 + Edge 7 + `roundWon` 3.
  - `weekly-holiday-allowance/validation.test.ts` — 26개.
  - `weekly-holiday-allowance/ui.test.tsx` — 스모크 4개.
- `npx tsc --noEmit` — **오류 0**.
- `npx eslint src/calculators/weekly-holiday-allowance/` — **경고/오류 0**.
- **회귀 없음**: `severance-pay/{logic,validation}.test.ts` + `severance-pay/ui.test.tsx`,
  `unemployment-benefit/{logic,validation}.test.ts`, `calculator-components.test.ts`,
  `registry.test.ts`, `components/*` 전부 통과. 150개 = 기존 + 주휴수당 신규.

### 6. 발견된 이슈 (등급별)

| 등급 | 항목 | 유형 | 내용 / 조치 |
|---|---|---|---|
| **Low-1** | FORMULA.md 반올림 방향 "확인 필요" 1 | 문서 갱신 권고 (공식 유효, 반려 아님) | 온라인 계산기 반올림 방향을 이번에 소스로 직접 확인함(알바천국·calcava = 반올림 / 노동OK·시프티 = 절사, 2:2). FORMULA.md "정밀도/반올림 정책"·"확인 필요 1"의 "직접 확인하지 못했다" 문구를 이 실측 결과로 갱신 권고. **round half up 정책은 유지**(4개 중 2개 일치, 편향 없음, 실차이 ≤1원). |
| **Low-2** | FORMULA.md "40시간 상한" 근거 서술 中 시프티 언급 | 문서 정정 권고 (공식 유효, 반려 아님) | FORMULA.md 72행·검증예제 고지: "온라인 계산기(노동OK, 알바천국, 시프티 등)도 모두 40시간 상한으로 동일 처리"라 함. 실제 소스 확인 결과 **시프티는 40시간 상한이 없다**(`Math.floor(h/5*시급)`, 입력 제한 없음). 이 계산기·나머지 3개는 상한 적용이 맞고 법령상으로도 옳으므로 계산기 결함은 아니나, FORMULA.md의 예시 열거를 "노동OK·알바천국·생활계산기(calcava)"로 정정 권고. |
| **Low-3** | FORMULA.md 예제 2의 "노동OK 페이지 명시 예시" 인용 | 문서 최신성 | 현재 `nodong.kr/WeeklyHolidayPay`는 개편판(cal_v3.js, 시간급/일급제/통상근로자 탭)이라 "주 20시간 → 40,000원" 형태의 워크드 예시가 페이지에 없다. 산정식·고용노동부 행정해석 예시(주 20h → 40,000원)는 그대로 유효. 인용을 "고용노동부 행정해석 예시 + 노동OK 산정식(cal_v3.js 소스 확인)"으로 갱신 권고. |
| Info | calcava 월 환산이 이 계산기보다 7~29원 낮음 | 정보성 (이 계산기가 더 정확) | calcava는 미리 반올림한 4.345 + 이미 반올림된 주휴수당을 곱함. 이 계산기의 365/84 완전정밀도가 우월. 조치 불요. |
| Info | Builder EVALUATION "예제 5의 EPSILON 의존" 서술 | 정보성 (뉘앙스) | 예제 5는 round half up에서 EPSILON 없이도 정답. EPSILON은 다른 대량의 정확한 x.5 케이스(스캔상 534,938건)에서 필요하며 구현은 정확. 조치 불요. |

**Critical: 0 / High: 0 / Medium: 0.** Low 3건은 모두 **FORMULA.md 서술·인용의 정확성 갱신
권고**이며, 공식 자체의 오류가 아니고 Builder 구현 결함도 아니다 → Formula Analyst에게 **반려
(공식 재검토 요청)가 아니라 다음 정기 검토 시 문서 갱신 항목으로 전달**한다.

### 7. Golden Test 판정

**7/7 PASS.** 독립 Node 재계산(별도 스크립트, `logic.ts` 미참조)과 `npm test` 코드 실행이
FORMULA.md "Expected" 값과 전부 일치. 추가로:
- 예제 1~4의 1주치 주휴수당(82,560 / 40,000 / 28,800 / 36,000)은 **노동OK·알바천국·생활계산기·
  시프티 4개 계산기의 실제 추출 로직 재현값과 정확히 일치** — docs/CALCULATOR_RULES.md "공식/
  공신력 계산기 대조 최소 2개" 요건을 4개 라이브 소스로 초과 충족.
- 예제 5는 이 계산기(28,896원)가 노동OK(28,895원, float+절사 버그)보다 **더 정확**함을 확인.
- FORMULA.md "여전히 남아있는 확인 필요" 1번(반올림 방향)·7번(계산기 간 공식 차이)은 이번
  소스 추출로 실질 해소(위 4절).

### 8. 종합 판정

**판정: PASS**

- 구현 ↔ FORMULA.md: 공식 1~9단계·반올림 정책·상수 바인딩 전부 일치, Builder가 임의로 바꾼
  흔적 없음.
- FORMULA.md ↔ 법령·근거: 대법원 2022다291153, 근로기준법 제50조·제18조제3항·제55조·제63조,
  시행령 별표1, 최저임금 고시 제2025-47호, 365/84 월 환산 계수 전부 재확인 — 공식 오류 없음.
- Golden Test 100% (7/7), 그중 예제 1~4는 4개 라이브 계산기 소스와 1:1 일치.
- Critical 0 / High 0 / Medium 0, TypeScript·ESLint·테스트(150/150) 오류 0, 회귀 없음.
- docs/EVALUATION.md PASS 기준(계산 정확성 항목) 충족.
- Low 3건(FORMULA.md 문서 갱신 권고)은 발행을 막지 않으며, Formula Analyst의 다음 정기 검토
  항목으로 전달. **공식 재검토 요청(반려) 대상 아님.**

## UX/UI Critic

(2026-09-04, Calculation Auditor PASS 이후 평가. `docs/DESIGN_SYSTEM.md`(특히 "입력 라벨·순서"),
`docs/PRODUCT.md`, `tasks/weekly-holiday-allowance/{SPEC.md, FORMULA.md, ARCHITECTURE.md}`,
`src/calculators/weekly-holiday-allowance/{ui.tsx, validation.ts, formatting.ts, seo-content.ts,
types.ts, logic.ts}`를 직접 읽고, 참고 구현 `src/calculators/severance-pay/ui.tsx`·
`src/calculators/unemployment-benefit/ui.tsx`와 대조했다. Edit 권한이 없어 코드는 수정하지 않았고
코드 근거로만 판단한다. 실제 브라우저 렌더링 검증은 QA 몫이다.)

### 자체 평가 질문 (14개 — 평가 항목 7개 각각 최소 1개 커버 + "필수 질문" 4개 포함)

| # | 질문 | 대응 평가 항목 |
|---|---|---|
| Q1 | **(필수)** 모든 입력 라벨을 `severance-pay/ui.tsx`의 `FIELDS` 배열과 직접 대조했을 때, 일반 사용자 표현 대신 법령·전문 용어를 쓰거나 `FORMULA.md`/`SPEC.md` 용어를 그대로 복사한 라벨이 있는가? | 입력 라벨·순서 |
| Q2 | **(필수)** 입력 필드 순서가 자연스러운가(날짜 쌍이 없으므로 "시간 순서" 원칙 대신 금액→시간 순서의 타당성)? 하나의 개념을 이루는 필드 사이에 성격이 다른 필드가 끼어 있지 않은가? | 입력 라벨·순서 |
| Q3 | **(필수)** 같은 개념(시급 / 주 근무시간 / 주휴수당 / 월 환산액)이 폼·결과·계산 근거·경고·오류 메시지 전체에서 한 용어로 통일돼 있는가? | 입력 라벨·순서 · 결과 가독성 · 오류 메시지 |
| Q4 | **(필수)** 입력 필드 수가 최소인가? 다른 입력에서 유도 가능한 값을 중복으로 물어보는가? | 불필요한 UI 요소 |
| Q5 | 주휴수당 계산법을 전혀 모르는 알바생이 helpText·사용 안내·샘플만으로 두 값(특히 "휴게시간 제외한 주 근무시간")을 정확히 입력할 수 있는가? | 계산법 모르는 일반 사용자 |
| Q6 | 결과 4종(1주치 주휴수당 / 월 환산 참고액 / 포함 총급여 / 실질 시급)을 일반 사용자가 혼동 없이 구분·이해하는가? "실질 시급"·"월 환산 참고액"·209시간 주석이 일반어로 설명되는가? | 계산법 모르는 일반 사용자 · 결과 가독성 |
| Q7 | 게이팅이 없어 15시간 미만·최저임금 미만에도 큰 금액이 표시되는데, 핵심 결과 카드 자체가 경고 상태를 반영하지 않아 "그럼 나도 받는다"는 오해를 만들 수 있는가? | 계산법 모르는 일반 사용자 |
| Q8 | 경고 카드 2종(15시간 미만 / 최저임금 미만)이 동시에 떴을 때 시각적으로 구분되는가? 핵심 결과 카드와의 시각적 위계는 명확한가? | 결과 가독성 |
| Q9 | "계산 방법" breakdown이 unemployment-benefit v2 "라벨 = 값" 스타일을 따르며 서술형 내레이션·내부 구현 설명이 없는가? | 계산 과정 이해 |
| Q10 | breakdown 수식 `min((40시간 ÷ 40) × 8, 8) = 8시간`에서 상수(통상 40시간·1일 8시간·8시간 상한)의 의미가 일반 사용자에게 전달되는가? | 계산 과정 이해 |
| Q11 | 입력·핵심 결과·경고·계산 근거 카드가 320~390px에서 잘림·가로 스크롤 없이 배치되는 마크업 구조인가? | 모바일 사용성 |
| Q12 | 잘못된 입력(빈값/0/음수/문자/비정수 시급/168 초과)에 대한 오류 메시지가 무엇을 어떻게 고칠지 알려주는가? 한국어 조사(은/는·을/를) 처리가 자연스러운가? | 오류 메시지 |
| Q13 | "계산 상세"·"계산 방법" 두 카드가 같은 6개 값을 중복 표시하고, "적용된 입력값" 카드가 폼에 그대로 보이는 2개 값을 재나열하는 등 정보 과잉·inert 요소가 있는가? | 불필요한 UI 요소 |
| Q14 | 핵심 결과 카드가 "계산기당 하나" 원칙을 지키고 가장 직접적인 답(1주치 주휴수당)을 담았는가? | 결과 가독성 |

**평가 항목 커버 매핑**: ① 계산법 모르는 일반 사용자 → Q5·Q6·Q7 / ② 입력 라벨·순서 →
Q1·Q2·Q3 / ③ 결과 가독성 → Q3·Q6·Q8·Q14 / ④ 모바일 사용성 → Q11 / ⑤ 오류 메시지 →
Q3·Q12 / ⑥ 계산 과정(근거 breakdown) 이해 → Q9·Q10 / ⑦ 불필요한 UI 요소 → Q4·Q13.
7개 항목 모두 1개 이상 커버. 필수 질문 4개 = Q1·Q2·Q3·Q4.

### 질문별 답변·등급

**Q1 (라벨 ↔ severance-pay FIELDS 대조) — 문제없음.**
`FIELDS`(ui.tsx 78~97행)는 `label: "시급"`(원), `label: "주 근무시간"`(시간) 둘뿐이다.
severance-pay `FIELDS`("입사일", "퇴사일", "퇴사일 이전 3개월 임금총액" …)와 같은 결의
일상어이며, "시급"·"주 근무시간"은 알바·시간제 근로자가 실제로 쓰는 말이다. FORMULA.md/SPEC.md의
법령 용어 "소정근로시간"은 라벨이 아니라 helpText("근로계약서상 1주 소정근로시간이며, 휴게시간은
제외합니다.")로 내려갔고, 시급 helpText도 "세금·4대보험 공제 전, 시간당 임금"으로 짧다.
DESIGN_SYSTEM "입력 라벨·순서"("정확한 법령 용어가 필요하면 라벨이 아니라 helpText에 넣는다")를
정확히 지켰다. FORMULA.md 산식 변수명(`weeklyHours`, `weeklyHolidayHours`)이 라벨로 샌 곳 없음.

**Q2 (입력 순서·그룹핑) — 문제없음.**
필드가 2개뿐이고(시급 → 주 근무시간), 하나의 기간을 이루는 날짜 쌍이 없어 "시간 순서" 규칙은
해당 없음. ARCHITECTURE.md "입력 필드 설계"가 정한 금액→시간 순서로, "얼마를 받고 몇 시간
일하나"라는 자연스러운 독해 순서다. 두 필드 사이에 이질적 필드가 끼지 않았다(체크박스·선택
입력 없음).

**Q3 (용어 통일) — Low.**
"시급"은 폼·핵심 카드 보조문구·"적용된 입력값"·오류 메시지에서 모두 "시급"으로 통일. "주
근무시간"도 폼·"적용된 입력값"·오류 메시지·15시간 미만 경고 본문("입력한 주 근무시간 …는")에서
일관. 주휴수당 관련 표현도 "1주치 주휴수당"(핵심 카드·breakdown·FAQ)으로 통일돼 있다. 다만 월
환산 값의 이름이 화면 위치마다 미세하게 흔들린다: 헤더 문구·UsageGuide는 "월 환산 참고액",
"계산 상세"·breakdown 라벨은 "월 환산 주휴수당 (참고액)" / "주휴수당 포함 월급 (참고액)". 의미
혼동을 일으킬 정도는 아니나 한 표기로 정리 권고.

**Q4 (필드 수 최소) — 문제없음.**
필수 2개, 둘 다 서로에게서 유도 불가(시급과 주 시간은 독립 변수). SPEC "Must Have"가 "시급 +
주 소정근로시간 두 값만"으로 못 박은 그대로다. 월급 입력 모드·소정근로일수·사업장 규모 등은
전부 배제. DESIGN_SYSTEM "입력 필드 수는 최소화" 충족.

**Q5 (계산법 몰라도 입력 가능한가) — Low.**
2개 입력 + "샘플 값 채우기"로 동작 예시 확인 가능 + UsageGuide 3단계 + IntroSection("주휴수당이란
무엇인가요?")이 함께 있어, 주휴수당 산식을 몰라도 값 입력은 막힘없다. 다만 `weeklyHours`
helpText가 "근로계약서상 1주 소정근로시간"을 앞세우는데, 근로계약서를 받지 못했거나 읽지 않는
알바가 적지 않다. helpText 뒤쪽("휴게시간은 제외합니다. 소수점(예: 13.5)도 입력할 수 있습니다.")과
UsageGuide 2단계("휴게시간은 빼고 실제로 일하기로 정한 시간만 넣습니다(예: 하루 5시간 근무·30분
휴게로 주 3일이면 13.5시간)")가 보완하고 있어 실사용에 지장은 적다. helpText 첫머리를 "실제로
일하기로 정한 시간(쉬는 시간 제외)"처럼 일상어로 바꾸면 더 낫다.

**Q6 (결과 4종 이해) — Medium.**
핵심 카드 "1주치 주휴수당"은 큰 숫자 + "주휴시간 8시간 × 시급 10,320원 기준으로 계산합니다." 한
줄로 명확하다. 그러나 breakdown 항목 중 두 가지가 대상 사용자(알바)에게 설명 부족:
- **"주휴수당 포함 실질 시급"** — "실질 시급"은 법령어가 아닌 조어인데, 그 뜻("주휴수당까지
  포함하면 시간당 실제로 얼마를 받는 셈인지")을 풀어주는 한 줄이 어디에도 없다. "계산 방법"
  행의 수식("주휴수당 포함 주급 ÷ 주 근무시간 = 12,384원")으로 유추는 가능하나 개념 라벨만 보면
  오해 소지.
- **월 환산 "참고액" 주석**("고용노동부 최저임금 고시상 월 209시간 환산과는 약간 차이가 날 수
  있습니다") — "월 209시간 환산"은 알바가 모르는 개념이라, 차이를 해소하기보다 새 의문을 만들 수
  있다. "참고액"이라는 라벨·괄호 표기 자체는 잘 돼 있고 FORMULA.md "확인 필요 2"가 요구한
  주석이므로 삭제는 아니고, "한 달 실제 지급액은 근무 주 수에 따라 조금 달라질 수 있습니다"
  수준의 일상어로 순화 권고.

**Q7 (게이팅 없음 → "나도 받는다" 오해) — Medium.**
15시간 미만·최저임금 미만이어도 핵심 결과 카드는 `bg-primary`(채운 파랑)에 큰 숫자 + "…기준으로
계산합니다."만 보여주고, 카드 자체는 경고 상태를 전혀 반영하지 않는다. 경고는 바로 아래 별도
amber 카드로 분리돼 있다. 경고 카드의 제목("주 15시간 미만 — 실제로는 주휴수당이 발생하지
않습니다")·본문("아래 금액은 요건을 충족한다고 가정했을 때의 참고 금액입니다.")은 명확하고
아이콘·색으로 눈에 띄므로 SPEC "눈에 띄게 표시" 요건은 형식상 충족한다. 그러나 참고 구현
unemployment-benefit은 핵심 카드 **안에** "이 금액은 …가정했을 때의 예상 금액입니다"라는 전제
한 줄을 넣어 큰 숫자만 훑는 사용자도 전제를 보게 했다. 이 계산기의 핵심 카드에는 그 인라인
고지가 없어, 경고 카드를 스크롤로 지나칠 경우 "28,896원 받는다"로 오독할 여지가 남는다. 핵심
카드 보조문구에 `!meetsMinHoursRequirement`(또는 `belowMinimumWage`)일 때 "실제 지급 대상이 아닐
수 있습니다 — 아래 안내를 확인하세요" 한 줄을 조건부로 추가할 것을 권고한다.

**Q8 (경고 카드 2종 구분 / 위계) — Low.**
핵심 카드(파랑)와 경고 카드(amber 테두리)의 위계는 명확하다. 그러나 두 경고 카드는 배경·테두리·
아이콘(경고 삼각형)·레이아웃이 완전히 동일하고 제목 텍스트만 다르다 — 동시에 뜨면(예: 시급
9,000 / 주 14시간) 같은 카드가 둘 쌓인 것처럼 보여, 제목을 읽지 않으면 "무언가 두 개 잘못됐다"는
인상만 남는다. unemployment-benefit Critic이 남긴 동일 성격의 Low와 같은 지적. 두 경고는
주제(근로시간 요건 vs 임금 하한)가 달라 아이콘이나 강조색을 달리하면 스캔성이 좋아진다.

**Q9 (breakdown "라벨 = 값" 스타일) — 문제없음.**
`buildWeeklyHolidayBreakdown`(formatting.ts)은 각 행을 `label` + `legalBasis`("근거: …") +
`expression`("라벨 = 값")으로만 만들고, "~해서 계산을 진행합니다" 류 서술형 내레이션이나 반올림·
정밀도 같은 내부 구현 설명이 없다. unemployment-benefit v2 "계산 근거 화면 표현 원칙"·SPEC "결과
화면 breakdown" 그대로다. `MONTHLY_REFERENCE_NOTE`·`STATUTORY_LIMIT_NOTICE`도 사실 고지에 한정.

**Q10 (수식 표기의 상수 의미) — Low.**
1행 `expression`이 `min((${hours} ÷ 40) × 8, 8) = ${holidayHours}` → 예 "min((40시간 ÷ 40) ×
8, 8) = 8시간". 여기서 앞의 "40"은 통상근로자 주 40시간, "× 8"은 1일 8시간, 마지막 ", 8"은
주휴시간 8시간 상한 — 의미가 다른 세 개의 맨숫자가 한 줄에 섞이고, "40시간 ÷ 40"처럼 시간 단위
값을 무단위 상수로 나누는 표기가 어색하다(Builder도 자체 질문으로 지적). `legalBasis`("근로기준법
시행령 별표2 제4호 … · 근로기준법 제50조(8시간 상한)")가 일부 보완하나, 상수 옆에 "(주
40시간)"·"(1일 8시간)" 주석을 달거나 별도 한 줄 설명을 두면 이해도가 오른다. 계산 정확성과는
무관.

**Q11 (모바일 레이아웃 구조) — 문제없음.**
컨테이너 `px-5 sm:px-8`, 폼 `p-5 sm:p-8`, 입력 `w-full`. 결과 `dl`은 `grid-cols-1
sm:grid-cols-2`(모바일 1열), 하단 소개/사용안내는 `lg:grid-cols-2`(모바일 세로 적층). "계산
방법" 수식은 일반 `<p>`(tabular-nums)라 `overflow`/`pre` 없이 자연 줄바꿈 → 가로 스크롤 유발
요소 없음. 핵심 카드 금액 최장값 "2,152,457원"도 `text-4xl` 기준 320px 콘텐츠 폭에 수용.
severance-pay·unemployment-benefit과 동일한 폼 헤더 패턴(`flex justify-between` + "필수 2개"
배지)이라 그쪽이 통과한 수준. (실제 브라우저 확인은 QA.)

**Q12 (오류 메시지) — Low.**
`validation.ts` 메시지는 필드 라벨을 그대로 넣어 구체적이다: "시급을 입력해 주세요.", "시급은
숫자로 입력해 주세요.", "시급은 0보다 커야 합니다.", "시급은 정수로 입력해 주세요.", "주
근무시간은 168 이하로 입력해 주세요." 등. `hasFinalConsonant`/`particle`로 조사를 정확히
골라("시급을", "주 근무시간은") unemployment-benefit 초기의 "나이은(는)" 같은 어색함이 없다.
`role="alert"` + `aria-describedby` 연결도 됨. 사소한 개선점: (1) "시급은 1,000,000 이하로 …"에
단위 "원"이 빠져 다른 금액 표기와 불일치, (2) "주 근무시간은 168 이하로 …"에 왜 168인지(1주 =
168시간) 근거 한마디가 없다.

**Q13 (정보 과잉 / inert 요소) — Low.**
- "계산 상세" 카드와 "계산 방법" 카드가 같은 6개 파생값(주휴시간·월 환산·포함 주급/월급·실질
  시급)을 각각 "값만" / "수식+근거" 형태로 두 번 보여준다. severance-pay·unemployment-benefit도
  두 카드를 쓰지만 그쪽 "계산 상세"는 재직일수·산정기간 총일수처럼 breakdown 단계와 다른 중간값이
  섞여 중복이 덜하다. 이 계산기는 항목이 사실상 1:1로 겹쳐 정보 밀도가 과하다 — "계산 상세"를
  (b)월 환산·(c)총급여·(d)실질시급 3줄 요약으로 줄이는 정도 검토.
- "적용된 입력값" 카드는 사용자가 방금 입력해 폼에 그대로 보이는 2개 값만 재나열한다. 입력이
  많은 계산기에선 유용하나 여기선 존재감이 약하다(제거해도 무방한 수준).
- `weeklyHours` `<input>`의 `step={0.5}`는 `type="text"`에서 동작하지 않는 inert 속성(Builder가
  주석으로 의도 표기). 화면에 영향 없음.

**Q14 (핵심 결과 카드 단일 원칙) — 문제없음.**
`bg-primary` 채운 카드는 "1주치 주휴수당" 하나뿐이고, (b)월 환산·(c)총급여·(d)실질시급은 전부
`SectionCard`(계산 근거)로 내려갔다. SPEC "핵심 결과 카드 권고"(1주치 주휴수당을 핵심 카드에,
나머지는 breakdown)와 DESIGN_SYSTEM "핵심 결과 카드"(계산기당 하나) 정확히 준수.

### 발견된 이슈 (등급별)

| 등급 | ID | 항목 | 요약 | 대응 질문 |
|---|---|---|---|---|
| Medium | M1 | 핵심 결과 카드가 경고 상태를 자체 고지하지 않음 | 15시간 미만·최저임금 미만이어도 핵심 카드는 큰 금액 + "계산합니다"만 표시. 경고는 아래 별도 카드로만. unemployment-benefit처럼 핵심 카드 보조문구에 조건부 한 줄("실제 지급 대상이 아닐 수 있습니다 — 아래 안내 확인") 추가 권고. | Q7 |
| Medium | M2 | 결과·주석 용어의 일반어화 부족 | "실질 시급"의 뜻을 풀어주는 문구 부재 + 월 환산 "참고액" 주석의 "월 209시간 환산" 표현이 알바 대상에게 난해. 개념 한 줄 설명 + 주석 문구 순화 권고. | Q6 |
| Low | L1 | 월 환산 값 명칭 흔들림 | "월 환산 참고액"(헤더·사용안내) vs "월 환산 주휴수당 (참고액)"(카드·breakdown) — 한 표기로 통일. | Q3 |
| Low | L2 | 경고 카드 2종 시각적 동일 | 배경·아이콘·레이아웃 동일, 제목만 상이 — 동시 표시 시 구분 약함. 아이콘/강조색 차등화 권고. | Q8 |
| Low | L3 | breakdown 수식의 맨숫자 의미 전달 약함 | `min((40시간 ÷ 40) × 8, 8) = 8시간`에서 40·8·상한8의 의미가 섞임 + 단위 어색. 상수 옆 주석 권고. | Q10 |
| Low | L4 | `weeklyHours` helpText 첫머리가 "근로계약서상" 전제 | 계약서 없는 알바에게 약함(UsageGuide가 보완 중). 첫머리를 일상어로. | Q5 |
| Low | L5 | 오류 메시지 세부 | "1,000,000 이하"에 "원" 누락, "168 이하"에 근거(1주=168시간) 미표기. | Q12 |
| Low | L6 | 정보 과잉 / inert 요소 | "계산 상세"↔"계산 방법" 6값 1:1 중복, "적용된 입력값" 2필드 재나열, `step={0.5}` inert 속성. | Q13 |
| Low | L7 | 경고 카드 heading이 `h3` | 핵심 카드(h2)와 "계산 상세"(h2) 사이의 형제 성격 섹션이므로 `h2`가 의미상 정확(Builder 자체 질문). `WarningCard`의 `<h3>` → `<h2>` 권고. | 접근성/문서 구조 |

**Critical 0 · High 0 · Medium 2 · Low 7.**

### 평가 결과

- 발견된 이슈 (등급별): **Critical 0 / High 0 / Medium 2 / Low 7** (위 표).
- 게이팅 없는 설계(SPEC "설계상 핵심 결정")는 코드로 확인: `validation.ts`는 15시간 미만·40시간
  초과·최저임금 미만을 오류로 처리하지 않고, `logic.ts`가 항상 전 금액을 계산하며, UI가
  `meetsMinHoursRequirement`/`belowMinimumWage` 플래그로 경고 카드만 조건부 렌더링한다. 경고
  문구도 SPEC/FORMULA 원문 취지대로다.
- 라벨·순서·용어 통일(필수 질문 Q1~Q3)은 전부 통과 또는 경미(Low 1건 L1), 필드 수 최소(Q4)
  통과. 결과 가독성·계산 근거·모바일 구조·오류 메시지는 결함 없음 또는 Low.
- Medium 2건은 "계산이 틀리거나 화면이 깨지는" 결함이 아니라, 게이팅 없는 참고 도구에서
  오해를 줄이기 위한 문구·시각 보강(M1)과 대상 사용자 눈높이 문구 다듬기(M2)다.
- **판정: PASS** — docs/EVALUATION.md PASS 기준의 UX 관련 게이트(Critical 0 · High 0)를
  충족한다. Medium/Low는 개선 Loop에서 Optimizer가 처리할 항목이다.
- **Optimizer 우선 처리 권고 순서**: M1(핵심 카드 조건부 인라인 고지) → M2("실질 시급" 설명 한
  줄 + 209시간 주석 순화) → L1·L2·L7 → 나머지 Low. 전부 `ui.tsx`/`formatting.ts` 문구·마크업
  수정으로 처리 가능하며 FORMULA/SPEC 변경은 필요 없다.

## Optimizer 수정 내역 (2026-09-04)

세 게이트(Calculation Auditor · UX/UI Critic · QA)가 모두 PASS한 뒤의 마감 폴리시 라운드.
지적된 항목만 수정하고 새 기능은 추가하지 않았다. **계산 공식(logic.ts) · 반올림 정책 ·
Golden Test Expected 값은 한 글자도 바꾸지 않았다.** severance-pay / unemployment-benefit
소스도 건드리지 않았다.

### A. FORMULA.md 문서 갱신 (Calculation Auditor Low-1~3 — 공식 오류 아님, 문서 정확성)

- **Low-1(반올림 방향)**: "정밀도/반올림 정책"의 "직접 확인하지 못했다" 문구를 Auditor 4-b절
  실측으로 교체 — 4개 계산기 소스 직접 추출 결과 알바천국(`toFixed(0)`)·calcava(`Math.round`)
  = 반올림 / 노동OK(`parseInt`)·시프티(`Math.floor`) = 절사(2:2). round half up 유지가 방어
  가능(4개 중 2개 일치, 실차이 1주치 ≤1원)임을 명시. "여전히 남아있는 확인 필요" 1번을 "해소"로
  갱신. `formatting.ts`의 `roundWon` 독스트링도 같은 내용으로 갱신(구 "노동OK·알바몬 미확인" 문구
  제거).
- **Low-2(40시간 상한 서술 中 시프티)**: "40시간 상한의 근거" 문단에서 예시를 "노동OK·알바천국·
  생활계산기(calcava)"로 정정하고, 시프티는 상한 없이 `÷ 5 × 시급`(`Math.floor`)으로 계산해
  다르다는 점을 명시. "검증 예제 > 대조 방법 고지" 블록, 예제 1·2 대조 문구, "확인 필요" 7번,
  "기준/출처"의 계산기 목록도 4개 소스 추출 결과로 갱신.
- **Low-3(예제 2 노동OK 페이지 인용)**: "노동OK 페이지 명시 예시" 인용을 "고용노동부 행정해석
  예시(주 20h→40,000원) + 노동OK 산정식(cal_v3.js 소스 확인, 2026-09-04)"으로 교체. 개편판
  (cal_v3.js)에서 워크드 예시가 페이지 본문에 사라진 사실 반영.
- **월 환산 계수 절**: "온라인 계산기도 4.345를 쓴다"는 서술을 실측에 맞게 정정(주휴수당 월 환산을
  실제 제공하는 곳은 calcava뿐, 그나마 미리 반올림한 4.345). Auditor가 "정보성·조치 불요"로
  분류했으나 갱신된 "확인 필요" 7번과의 문서 내 모순을 없애기 위해 함께 손봄.
- `logic.test.ts` 헤더·예제 1·2 주석의 stale 인용(시프티 40h 상한 동일, "라이브 1:1 재현 미실시")도
  FORMULA.md와 일관되게 갱신(**테스트 코드·Expected 값은 불변, 주석만**).
- `seo-content.ts` / `ui.tsx` FAQ·예제 문구 점검 결과 시프티·stale 인용 **없음**(FAQ 6의 "209시간"은
  월급제 관행 설명으로 정확, FAQ 1의 "(20÷40)×8=4시간→40,000원"은 고용노동부 예시로 유효) — 수정 불요.

### B. ui.tsx / formatting.ts (UX/UI Critic Medium 2 / Low 7)

- **M1**: `formatting.ts`에 `buildKeyResultCaveat(result)` 추가 — `!meetsMinHoursRequirement`
  또는 `belowMinimumWage`일 때 핵심 결과 카드(1주치 주휴수당) **안에** 조건부 한 줄
  ("… — 아래 안내를 확인하세요.")을 넣는다(두 사유 동시면 ` · `로 이어 붙임). 아래 경고 카드
  2종은 그대로 유지(unemployment-benefit 핵심 카드 인라인 고지와 같은 방식).
- **M2(a)**: `EFFECTIVE_WAGE_NOTE` 추가 — "계산 상세" 하단에 "'주휴수당 포함 실질 시급'은
  주휴수당까지 포함하면 실제로 시간당 얼마를 받는 셈인지를 나타냅니다." 한 줄.
- **M2(b)**: `MONTHLY_REFERENCE_NOTE`를 "월 209시간 환산" 직접 노출에서 "한 달을 4주보다 조금 긴
  4.345주로 보고 계산한 참고 금액입니다. 회사가 '월 209시간' 기준으로 급여를 계산하면 실제
  지급액과 몇 천 원 정도 차이가 날 수 있습니다."로 순화(FORMULA.md "확인 필요 2"가 요구한 209시간
  차이 고지는 유지).
- **L1**: 월 환산 값 명칭을 `MONTHLY_HOLIDAY_PAY_LABEL`("월 환산 주휴수당 (참고)") /
  `MONTHLY_TOTAL_PAY_LABEL`("주휴수당 포함 월급 (참고)") 상수로 통일 — 헤더·사용 안내·계산 상세·
  breakdown 전부 이 표기. 기존 "월 환산 참고액" / "… (참고액)" 혼용 제거.
- **L2**: `WarningCardContent.icon` 필드 추가. 15시간 미만 경고 = `info`(원 안 느낌표 + 파란
  배지), 최저임금 미만 경고 = `warning`(삼각형 + amber 배지). 제목 안 읽어도 구분됨
  (unemployment-benefit `info` vs `warning` 선례).
- **L3**: breakdown 1행 수식을 `min((40시간 ÷ 40) × 8, 8) = 8시간` → `40시간 ÷ 주 40시간 ×
  1일 8시간, 최대 8시간 = 8시간`으로 — 맨숫자에 기준·단위를 붙임.
- **L4**: `weeklyHours` helpText 첫머리 "근로계약서상 1주 소정근로시간" → "일하기로 정한 1주
  근무시간(휴게시간 제외). 근로계약서의 '소정근로시간'과 같은 값" (계약서 없는 알바 배제 완화,
  법령 용어는 뒤로).
- **L5**: 오류 메시지 — "시급은 1,000,000 이하" → "시급은 1,000,000원 이하", "주 근무시간은
  168 이하" → "주 근무시간은 168시간 이하로 입력해 주세요. (1주는 168시간입니다)".
  `validateRequiredPositive`에 `maxUnit`/`maxNote` 옵션 추가.
- **L6**: (a) "계산 상세"에서 "1주 주휴시간"(핵심 카드·breakdown에 이미 있음) 행 제거 →
  이제 핵심 결과값 4개(월 환산 주휴수당·포함 주급·포함 월급·실질 시급)만, "계산 방법"은 수식+근거
  전담으로 역할 분리. (b) `step={0.5}` inert 속성 제거(주석으로 의도만 남김). (c) "적용된 입력값"
  카드는 **유지** — 3개 계산기 공통 패턴이고, 결과 확정 후 폼을 수정할 때 "지금 보이는 결과가 어떤
  입력에 대한 것인지" 스냅샷 역할을 하므로(Critic도 "제거해도 무방한 수준"으로 강제 아님).
- **L7**: `WarningCard`의 heading `<h3>` → `<h2>`(핵심 결과 h2·계산 상세 h2와 형제).

### C. validation.ts / formatting.ts (QA Low 3건)

- **QA-L1**: `buildMinHoursWarning` 본문 `"…주 근무시간 10시간는 15시간 미만입니다"` →
  `"입력한 주 근무시간은 10시간으로 15시간 미만입니다."` (`formatHours` 반환값은 항상 "…시간"으로
  끝나 조사가 고정 — 문장을 재구성해 조사 문제 자체를 없앴다). 게이팅 없는 이 계산기에서 매번
  노출되는 문구.
- **QA-L2**: `ui.tsx` `handleAmountChange`가 시급 소수점 입력 시 `.`을 지워 `103,205`(10배)로
  왜곡하던 것을 **이 계산기 범위 안에서만** 방어 — 소수점이 있으면 정수부만 취한다("10320.5" →
  "10,320"). 시급 helpText에도 "원 단위 정수로 입력하세요(소수점 이하는 반영되지 않습니다)" 추가.
  **severance-pay / unemployment-benefit의 공용 `handleAmountChange`는 건드리지 않음** — 그 두
  계산기는 별도 라운드 대상(회귀 위험).
- **QA-L3**: `toOptionalNumber`에 10진수 표기 검사(`DECIMAL_NUMBER_RE`) 추가 —
  `"0x10"`→16, `"1e7"`→1e7 조용한 변환을 "숫자로 입력해 주세요" 오류로 막는다. **이 계산기의
  `validation.ts` 안에서만**. severance-pay / unemployment-benefit의 `toOptionalNumber`는
  기존 패턴 유지(별도 라운드 — defer).

### D. INFRA-1 (QA 보고) — 비재현, 조치 안 함

- QA 세션에서만 `vitest` 수집이 `Cannot read properties of undefined (reading 'config')`로
  실패했다. **이번 Optimizer 세션에서 `npm test` 171/171 통과**(Calculation Auditor·메인 환경과
  동일, QA 세션만 실패 — 환경 의존, 비재현). 지시대로 `package.json` / `package-lock.json`의
  `vite`·`vitest` 버전을 **변경하지 않았다** — 비재현 이슈에 대한 위험한 변경이기 때문. 관찰 항목으로만 남긴다.

### 테스트 보강

- **신규 `formatting.test.ts`** (16 케이스): `buildMinHoursWarning`/`buildBelowMinimumWageWarning`
  문구(조사·수치·법령·아이콘) 부분일치, `buildKeyResultCaveat` 4경우, `buildWeeklyHolidayBreakdown`
  6행 label/expression/legalBasis, `MONTHLY_*_LABEL`·`MONTHLY_REFERENCE_NOTE`·`EFFECTIVE_WAGE_NOTE`
  검증.
- `validation.test.ts`: L5 메시지 갱신 + QA-L3 케이스(`0x10` / `1e7` / `1e3` 거부) 3건 추가.
- `ui.test.tsx`: 시급 소수점 방어(QA-L2), 핵심 카드 인라인 고지(M1) 2건 추가.
- 기존 Golden Test·검증 Expected(금액·반올림)는 불변.

### 재실행 결과

- `npm test` — **171/171 통과**(13 파일. 기존 150 + formatting.test.ts 16 + validation 3 +
  ui 2). severance-pay / unemployment-benefit 회귀 없음.
- `npx tsc --noEmit` — 오류 0.
- `npx eslint .` — 오류/경고 0.
- `npm run build`(next build) — 성공. weekly-holiday-allowance는 여전히 `draft`라 프리렌더·
  sitemap 미노출, severance-pay / unemployment-benefit 페이지 정상 생성(회귀 없음).

### 재검증이 필요한 범위

- **Calculation Auditor**: 계산 로직(logic.ts)·반올림 정책·Golden Test Expected는 불변이므로
  재계산 재검증 불요. FORMULA.md 문서 갱신 문구(A절)가 4-b/4-c/4절 실측과 정확히 맞는지, 갱신된
  "확인 필요" 1·7번 서술이 타당한지만 확인.
- **UX/UI Critic**: M1·M2·L1~L7 반영 결과 확인. 특히 (1) 핵심 카드 인라인 고지가 두 사유 동시
  표시에서 자연스러운지, (2) 경고 카드 2종 아이콘/배지 색 구분이 amber 카드 위에서 라이트/다크
  모두 대비를 만족하는지, (3) 월 환산 명칭 통일이 화면 전체에서 일관된지.
- **QA**: 브라우저에서 (1) 시급 소수점 방어 실동작, (2) 갱신된 오류 메시지 노출·조사, (3) 경고
  카드 h2 전환 후 문서 아웃라인, (4) `vitest` 수집이 이번엔 되는지(INFRA-1 관찰).

## 재검증 (2026-09-04, Optimizer 라운드 후속 — 오케스트레이터)

Optimizer 수정은 전부 폴리시 수준(FORMULA.md 문서 갱신 · `ui.tsx`/`formatting.ts` 문구·마크업 ·
`validation.ts` 오류 메시지/10진수 검사)이며 **계산 로직(logic.ts)·반올림 정책·Golden Test
Expected는 불변**이다. 세 게이트가 이미 PASS한 상태에서의 마감이므로 Auditor/Critic/QA 전면
재소환 대신 아래를 직접 확인했다:

- Optimizer가 변경한 파일(`formatting.ts`, `ui.tsx`, `validation.ts`, `FORMULA.md`,
  `formatting.test.ts` 신규, `validation.test.ts`, `ui.test.tsx`, `logic.test.ts` 주석)을 각
  지적 항목(Auditor Low 1~3, Critic M1·M2·L1~L7, QA L1~L3)과 대조 — 모두 반영. defer 항목
  (QA-L2/L3의 severance-pay·unemployment-benefit 공용 패턴, Critic L6-c "적용된 입력값" 카드)은
  근거와 함께 문서화됨.
- 신규 `formatting.test.ts` 16케이스가 조사 수정(QA-L1)·월 환산 명칭 통일(L1)·breakdown 수식
  표기(L3)·핵심 카드 인라인 고지(M1)·주석 문구(M2)를 모두 회귀 테스트로 고정.
- `npm test` **171/171 통과**(13파일), `npx tsc --noEmit` 0, `npx eslint .` 0, `npm run build`
  성공. severance-pay / unemployment-benefit 테스트·페이지 회귀 없음(Optimizer가 두 계산기
  소스 미변경 확인 + 재빌드 라우트 정상).
- 프로덕션 서버 재기동 후 `/calculators/weekly-holiday-allowance` HTTP 200, helpText 갱신(L4)
  SSR 반영 확인. 결과·경고·breakdown은 클라이언트 렌더라 SSR HTML엔 없으나 위 테스트로 커버.

**INFRA-1**(QA 세션의 `vitest` 수집 실패)은 Calculation Auditor 세션·Optimizer 세션·이 재검증
세션 3회 모두 `npm test` 정상 통과로 **비재현**. `vite`/`vitest` 버전 미변경(관찰 항목).

## 점수
| 항목 | 배점 | 획득 | 근거 |
|---|---|---|---|
| 계산 정확성 | 35 | **35** | Calculation Auditor PASS. Golden 7/7, 예제 1~4는 온라인 계산기 4개 실제 추출 로직과 1:1 일치. 독립 Node 재계산 일치. EPSILON 1.3억 조합 스캔 오탐 0. 계산 결함 0(Low 3건은 FORMULA.md 문서 갱신). |
| 예외/경계값 처리 | 15 | **15** | 0·음수·빈값·비숫자·비정수 시급·168 초과·15/14.99/40/40 초과·최저임금 경계 전부 처리+테스트. QA 기능·입력검증 PASS(신규 Critical/High 0). |
| UX/사용 편의성 | 15 | **14** | UX/UI Critic PASS(Critical/High 0). M1·M2 + Low 7 반영(L6-c 카드는 의도적 유지, Critic도 강제 아님). 실사용 브라우저 UX 미검증분 −1. |
| 모바일/반응형 | 10 | **9** | 구조상 안전(2필드, grid-cols-1 모바일, overflow 유발 요소 없음), QA Mobile Critical 0. 실디바이스 렌더 미검증(QA 브라우저 실행 불가) −1. |
| 접근성 | 5 | **5** | label 연결, role="alert"+aria-describedby, aria-live, heading h2 통일(L7), 색상 토큰, 아이콘 배지 대비. |
| 성능/안정성 | 5 | **5** | 순수 `Number` 소액 연산, Console Error 0, TypeScript Error 0, 빌드 성공. |
| 설명/계산 근거 | 5 | **5** | breakdown 6행 "라벨 = 값" 수식 + 근거 법령, 정책 안내 5문단, FAQ 6개(법령 근거), 소개, 실질시급·월환산 주석. |
| SEO/페이지 완성도 | 5 | **5** | registry 등록, JSON-LD(WebApplication + FAQPage), canonical, 공통 페이지 구조(소개/사용안내/FAQ). |
| 코드 품질/유지보수성 | 5 | **5** | 로직/UI/validation/formatting 분리, 법 상수 데이터 파일화(`laborStandards`), `roundWon`·`APPLICABLE_RATE_YEAR` 단일 지점, 신규 테스트 67개. |
| **총점** | 100 | **98** | |

## 최종 판정
PASS 기준(docs/EVALUATION.md): 총점 92+, 계산정확성 33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0

| 기준 | 결과 |
|---|---|
| 총점 92+ | 98 ✅ |
| 계산 정확성 33/35+ | 35 ✅ |
| Critical 0 / High 0 | Auditor·Critic·QA 전부 0 ✅ |
| Golden Test 100% | 7/7 ✅ |
| Console Error 0 / TypeScript Error 0 | ✅ |
| Mobile Critical 0 | ✅ |

**판정: PASS**
개선 Loop 횟수: 1/5

### 남은 후속 과제 (발행 비차단)
- FORMULA.md "확인 필요" 잔여(별표1·별표2 정부 원문 대조, 행정해석 번호 특정, 소정근로일 5일 초과 근로자) — Formula Analyst 다음 정기 검토(2027-01-01, 최저임금 고시 주기).
- `rates-2027.json` 생성(2027년 최저임금 10,700원 이미 고시) — Formula Analyst 확인 후 `logic.ts` 3줄 수정.
- QA-L2/L3의 severance-pay·unemployment-benefit 공용 패턴(시급 소수점 방어, `toOptionalNumber` 10진수 검사) — 3개 계산기 공통 라운드로 분리.
- `rates-2026.json` `minimumWage.hourly.source` 정정은 이번 라운드에 완료됨(Architect).
