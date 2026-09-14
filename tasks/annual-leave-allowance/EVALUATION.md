# EVALUATION: 연차수당 계산기

## Builder 구현 완료

2026-09-14, Builder가 승인된 SPEC.md/FORMULA.md/ARCHITECTURE.md를 그대로 구현했다. 아래는
구현 사실 기록이며 **최종 정확성 판정이 아니다** — 최종 판정은 Calculation Auditor·QA의
몫이다(`.claude/agents/builder.md`). "테스트 통과"라고 적어도 Calculation Auditor·QA는 이를
그대로 신뢰하지 않고 독립적으로 재검증해야 한다.

### 구현 파일

- `src/calculators/annual-leave-allowance/date-utils.ts` — ARCHITECTURE.md "1.5" 시그니처
  그대로 `monthAnniversary`/`yearAnniversary`/`completedMonths`/`completedYears` 4개 함수를
  새로 작성했다. `src/lib/date-calc.ts`의 `calendarFullMonthsBetweenUtc`/
  `calendarFullYearsBetweenUtc`는 호출하지 않았고(ARCHITECTURE.md "1."이 명시한 대로), 순수
  달력 산술인 `parseIsoDateUtc`/`lastDayOfMonthUtc`만 import했다. `yearAnniversary`는 2월
  29일(윤년)만의 특수 분기를 두지 않고 `lastDayOfMonthUtc(year, hire의 월)`로 일반화해
  월말/윤년 clamp를 동일한 코드 경로로 처리했다. `completedMonths`/`completedYears`는
  FORMULA.md 의사코드 그대로 선형 탐색(각각 0~11, 0~150 안전 상한)으로 구현했다.
- `src/calculators/annual-leave-allowance/date-utils.test.ts` — ARCHITECTURE.md "1.6"이
  요구한 "원본 날짜 기준 독립 계산(연쇄 계산 아님)" 자체를 검증하는 단위 테스트(FORMULA.md의
  `H=2024-01-31` 예시: `monthAnniversary(H,2)=2024-03-31`이지 "2024-02-29+1개월=2024-03-29"가
  아님을 직접 assert)와, 윤년 2/29 clamp가 매년 원본 기준으로 재계산됨을 증명하는 테스트
  (`yearAnniversary(H,4)=2028-02-29`가 나오는지 — 연쇄 계산이었다면 이 결과가 나올 수 없음)를
  포함한다.
- `src/calculators/annual-leave-allowance/logic.ts` — ARCHITECTURE.md "9." 5+1 함수
  (`determineContinuousServiceRegime`/`calculateAccruedDays`/`calculateUnusedDays`/
  `calculateAllowance`/`calculateMinimumWageReference`/`calculateAnnualLeaveAllowance`
  오케스트레이터)를 시그니처 그대로 구현했다. 법정 상수(11/15/26/25/2)는 `policy.ts` 없이
  이 파일 로컬 `const`로 뒀다(ARCHITECTURE.md "7."). 최저임금 참고는
  `getRatesForYearOrNull`이 연도 데이터가 없으면 throw하지 않고 `undefined`를 반환한다
  (ARCHITECTURE.md "6." — 이 필드에 한해 severance-pay/unemployment-benefit의 "throw" 정책을
  의도적으로 따르지 않음). 오케스트레이터는 판별 유니온 각 분기를 `if`로 명시적으로 좁혀
  조립한다(switch 대신 — TS narrowing을 가장 단순하게 보장하는 방식을 택함).
- `src/calculators/annual-leave-allowance/validation.ts` — `MIN_ALLOWED_DATE`
  (1970-01-01)/`getMaxAllowedDate()`(오늘+1년)를 severance-pay와 같은 근거로 이 계산기
  전용으로 독립 재정의했다(cross-import 없음, ARCHITECTURE.md "6.3"). `usedDays` 상한
  1,000일, `ordinaryDailyWage` 상한 100억원은 Builder 재량으로 확정했다(둘 다 계산 정확성과
  무관한 순수 UX 가드). `hireDate > referenceDate`(문자열 비교, ISO 형식이라 안전)만 오류로
  막고 `hireDate === referenceDate`(입사 당일 조회)는 통과시킨다(FORMULA.md "예외" 그대로).
- `src/calculators/annual-leave-allowance/formatting.ts` — `formatWon`/`formatDays`(반차 등
  소수 허용)/`formatMonths`/`formatYears`와 4단계 breakdown 빌더
  (`buildServicePeriodBreakdown`/`buildUnder1YearAccrualBreakdown`/
  `buildYear1To2AccrualBreakdown`/`buildOver2YearsAccrualBreakdown`/
  `buildUnusedDaysBreakdown`/`buildAllowanceBreakdown`/`buildBelowMinimumWageWarning`)를
  bmr-calculator/housing-acquisition-tax의 "logic.ts는 숫자만, formatting.ts가 문장 조립"
  관례 그대로 구현했다.
- `src/calculators/annual-leave-allowance/content.ts` — FORMULA.md "정책 고지 문구" 1~5,
  "FAQ 콘텐츠"(질문 1~4) + SPEC.md 질문 5~6(범위 밖 안내), "소개 문구"를 그대로 옮겼다. 정책
  고지 4번 문구에 "2년차에 발생일수가 26일에서 15일로 줄어드는 것도 오류가 아니다"라는 문장을
  추가해 FORMULA.md "예외" 절이 권고한 "버그처럼 보이지 않도록 명확히 설명"을 반영했다(새로운
  법적 주장은 아니고 FORMULA.md가 이미 설명한 내용을 결과 화면 문구로 옮긴 것).
- `src/calculators/annual-leave-allowance/ui.tsx` — ARCHITECTURE.md "12." 순서 그대로: 입력
  (입사일 → 기준일 → 사용일수 → 1일 통상임금) → 핵심 카드(allowance 유무로 "미사용
  연차수당"/"연차 발생일수" 전환) → 보조 정보(발생일수·미사용일수, allowance 유무와 무관하게
  항상 노출) → `usedMoreThanAccruedWarning`/`belowMinimumWageReference` 인라인 경고(눈에 띄는
  `warning-surface` 카드) → 계산 근거 4단계(allowance 없으면 3단계) → 정책 고지(항상 노출) →
  사용안내/소개/FAQ. 날짜 입력은 `<input type="date">` + `min`/`max`(validation.ts 상수 재사용).
  1일 통상임금은 severance-pay와 동일한 실시간 천 단위 콤마 포맷팅을 적용했다. 샘플 값은
  FORMULA.md 검증 예제 5(이 계산기의 핵심 경계값)를 그대로 썼다.
- `src/calculators/annual-leave-allowance/{logic,validation,formatting,date-utils}.test.ts` —
  아래 "Golden Test / Edge Case Test" 참고.
- `src/calculators/registry.ts` — `annual-leave-allowance` 신규 등록(`title: "연차수당
  계산기"`, `category: "labor"`, `icon: "chart"`, **`status: "draft"`**). 아이콘 근거: labor
  카테고리에 이미 coins(severance-pay)·calculator(unemployment-benefit)·calendar(weekly-
  holiday-allowance)·heart(parental-leave-benefit)가 쓰이고 있어(2026-09-14 registry.ts 직접
  확인), 겹치지 않으면서 아직 labor에서 안 쓰인 "chart"를 골랐다(근거는 registry.ts 인라인
  주석 참고).
- `src/calculators/calculator-components.ts`, `app/calculators/[slug]/page.tsx` — UI 컴포넌트
  연결 및 FAQPage JSON-LD용 `annualLeaveAllowanceFaqSeoItems` 매핑 추가.
- `src/calculators/annual-leave-allowance/types.ts`, `tasks/annual-leave-allowance/
  ARCHITECTURE.md`는 Architect 라운드에서 이미 작성 완료된 상태였고 이번 Builder 라운드에서
  타입을 임의로 바꾸지 않았다(그대로 구현만 채웠다).

### Golden Test / Edge Case Test

- `logic.test.ts` — FORMULA.md 검증 예제 17개 중 예제 1~16(정상 계산 경로)을 전부
  `calculateAnnualLeaveAllowance` 오케스트레이터 레벨로 구현했다. 예제 17(입력 오류 경로)은
  `validation.test.ts`에 구현했다(logic.ts는 날짜 순서를 검증하지 않으므로 — validation.ts의
  책임). **추가로 ARCHITECTURE.md "1.6"이 Calculation Auditor 인계용으로 요구한 반례 2건**
  (월말 clamp: `2025-01-31`→`2025-02-28` → `completedMonths=1`; 윤년 clamp:
  `2024-02-29`→`2025-02-28` → `completedYears=1`, `regime=YEAR_1_TO_2`, `accruedDays=26`)을
  오케스트레이터 레벨로 별도 describe 블록에 반드시 포함했다.
- `date-utils.test.ts` — `monthAnniversary`/`yearAnniversary` 자체가 "원본 날짜 기준 독립
  계산(연쇄 계산 아님)"을 실제로 지키는지 별도로 검증했다(FORMULA.md가 예로 든
  `H=2024-01-31`의 `monthAnniversary(H,2)=2024-03-31` 사례, 윤년 2/29 4년 반복 사례).
  `completedMonths`/`completedYears`도 FORMULA.md 예제 1/3/4/5/6/7/10/11/12에 대응하는
  경계값을 함수 단위로 재확인했다(오케스트레이터를 거치지 않고 날짜 산술만 독립 검증).
- `logic.ts`의 5개 하위 함수(`determineContinuousServiceRegime`/`calculateAccruedDays`/
  `calculateUnusedDays`/`calculateAllowance`/`calculateMinimumWageReference`)도 각각 별도
  describe로 단위 테스트했다. 특히 `calculateAccruedDays`는 `OVER_2YEARS` 구간 N=2~23 전체를
  `yearlyGrant(N)=min(15+floor((N-1)/2),25)` 기대표와 대조하는 전수 스윕 테스트를 추가해, 21·22
  년차가 같은 값(25)을 공유하고 23년차부터 캡이 실제로 작동하는지(`cappedAtMax`)를 개별
  케이스 나열이 아니라 표 전체 비교로 검증했다.
- `validation.test.ts` — 필수값 누락(hireDate/referenceDate), 존재하지 않는 달력 날짜
  (2024-02-30), 형식 오류, 예제 17(기준일이 입사일보다 이전), `MIN_ALLOWED_DATE`/
  `getMaxAllowedDate()` 경계(정확히 하한/상한은 허용, 그 밖은 거부), `usedDays`/
  `ordinaryDailyWage`의 음수·비숫자·상한 초과·빈 문자열(undefined 처리)·공백 문자열(`Number
  ('   ')===0` 함정 방지)·0(유효한 명시적 입력)까지 커버했다. 여러 필드 동시 오류(4건 모두
  반환)도 확인했다.
- `formatting.test.ts` — 4단계 breakdown 문자열이 실제 값을 정확히 대입해 조립되는지(특히
  25일 상한 적용 문구가 `cappedAtMax` 여부에 따라 노출/비노출되는지) 확인했다.
- Edge Case: 입사 당일 조회(`hireDate===referenceDate`, `completedMonths=0`,
  `accruedDays=0`), `usedDays` 미입력 시 기본값 0 처리, `ordinaryDailyWage=0`을 "명시적으로
  입력"한 경우(미입력과 다르게 `allowance`가 존재하되 금액 0)까지 별도로 검증했다.

### 실행 결과

- `npx vitest run`(전체 스위트) — **86개 파일, 1,199개 테스트 전부 통과**(이번 라운드에서
  신규 4개 파일·90개 테스트 추가, 기존 82개 파일·1,109개 테스트 회귀 없음 — Architect
  ARCHITECTURE.md "14."가 확인한 베이스라인과 정확히 일치하는 증가분).
- `npx tsc --noEmit` — 오류 없음.
- `npm run build`(Next.js 16, Turbopack) — 성공(정적 페이지 생성 포함). `status: "draft"`라
  sitemap/홈/카테고리 목록에는 노출되지 않지만 `/calculators/annual-leave-allowance` 라우팅
  자체는 동작한다(`calculatorComponents` 매핑 확인).
- `npx eslint src/calculators/annual-leave-allowance src/calculators/registry.ts
  src/calculators/calculator-components.ts "app/calculators/[slug]/page.tsx"` — 오류·경고
  0건.

### 판단이 필요했던 애매한 지점 (다음 역할이 참고할 것)

- **FORMULA.md가 남긴 메모 — `usedDays` helpText 카피 조정.** FORMULA.md "여전히 남아있는
  확인 필요 항목" 4번이 "올해 들어 사용한 연차일수"라는 SPEC.md 원문 helpText가 `UNDER_1YEAR`/
  `YEAR_1_TO_2` 구간에서는 "올해"라는 표현이 부정확할 수 있다고 지적했다. Builder는 이를
  반영해 실제 helpText를 "지금까지 사용한 연차일수를 입력하면..."으로 구간에 관계없이
  자연스러운 표현으로 바꿨다(SPEC.md 원문의 "올해 들어" 대신). 계산 로직에는 영향이 없다 —
  UX/UI Critic이 이 문구가 실제로 자연스러운지, 혹은 "올해 들어"를 완전히 대체하는 것이
  검색 의도(SPEC.md가 언급한 "연차수당 계산기" 검색어 맥락)와 어긋나지 않는지 재검토를
  권고한다.
- **최저임금 참고 경고 문구에서 "8시간"을 명시하지 않은 것.** FORMULA.md 검증 예제 16의
  Expected 문구는 "...최저임금 기준(하루 8시간 근무 시 82,560원)보다 낮습니다"였지만,
  `types.ts`(Architect 확정)의 `MinimumWageReferenceDetail`은 `year`/`dailyReferenceAmount`/
  `belowMinimumWageReference` 세 필드만 갖고 소정근로시간(8시간) 자체는 별도 필드로 노출하지
  않는다. Builder는 이 문구를 "하루 소정근로시간 기준 {금액}"으로 일반화해 특정 시간 숫자를
  하드코딩하지 않았다(소정근로시간 값이 바뀌어도 문구가 조용히 틀리지 않도록). 계산되는 금액
  자체(82,560원)는 FORMULA.md와 정확히 일치한다 — 문구 표현만의 차이이며, 새로운 필드를 타입에
  추가해 정확한 "8시간" 문구를 만들지 여부는 Architect/UX Critic 판단에 맡긴다.
- **아이콘 선택("chart").** registry.ts에 직접 남긴 주석 그대로다 — labor 카테고리의 기존
  4개 아이콘(coins/calculator/calendar/heart)과 겹치지 않는 선택지 중 "가산 연차 단계별
  breakdown"이라는 결과 성격에 가장 잘 맞는다고 판단했다. UX/UI Critic이 실제 화면에서 이
  아이콘이 다른 계산기와 시각적으로 잘 구분되는지 확인할 것을 권고한다.
- **핵심 카드 하단 보조 정보의 "중복처럼 보일 수 있는" 레이아웃.** ARCHITECTURE.md "12."가
  명시한 대로, `allowance`가 없을 때는 핵심 카드가 이미 "연차 발생일수"를 크게 보여주는데
  바로 아래 보조 정보 카드에도 같은 값(발생일수)이 작게 다시 표시된다(미사용일수와 나란히).
  이는 Architect가 "allowance 유무와 무관하게 두 값은 항상 계산되므로 항상 노출"이라고 명시적
  으로 정한 설계라 그대로 구현했지만, UX/UI Critic이 실제 화면에서 이 중복이 어색해 보이는지
  재검토할 여지가 있다(Builder 임의로 이 레이아웃을 바꾸지 않았다).

### Calculation Auditor 인수인계 — 최우선 체크리스트

FORMULA.md/ARCHITECTURE.md가 이미 명시적으로 인계한 항목 + Builder가 구현 중 발견한 사항을
합쳐 우선순위대로 정리한다. 아래 항목은 Builder 테스트 통과로 "해결됨"이 아니라 **Calculation
Auditor가 독립적으로 재검증해야 할 대상**이다.

1. **[FORMULA.md 인계, 최우선] 온라인 계산기 실측 대조 미확보.** FORMULA.md 자신이 "Bash(curl)
   도구를 쓸 수 없어 고용노동부 근로조건 계산기(`labor.moel.go.kr/cmmt/calAnnlVctn.do`)·
   노동OK 연차계산기(`nodong.kr/AnnuaVacationCal`)의 실제 출력값과 대조하지 못했다"고
   명시했다. docs/CALCULATOR_RULES.md "공식 계산기 예시값과 대조한 케이스 최소 2개" 요건이
   이번 문서에서 미충족 상태다 — Calculation Auditor가 Bash 접근이 가능하면 이 두 계산기를
   curl로 직접 호출해 최소 2개 이상(특히 예제 5의 "1년 시점 26일" 같은 핵심 경계)을 재확인할
   것을 권고한다.
2. **[FORMULA.md 인계] 근로기준법 제60조③ 삭제의 정부 1차 출처(개정이유서·관보) 원문
   미열람.** 2차 출처(welfareact.net, 삼쩜삼 등) 다수가 일관되게 확인했으나 정부 공식
   개정이유서 자체는 확인되지 않았다 — 이 계산기의 가장 중요한 경계(26일 고정값)의 근거이므로
   우선순위가 높다.
3. **[FORMULA.md 인계] 연차 발생 시점(anniversary-of-month, "다음날 발생")의 정식 고용노동부
   행정해석 번호 미특정.** 다수 2차 출처가 일관되게 설명하나 구체적 질의회신 번호는 찾지
   못했다 — `monthAnniversary`/`completedMonths`의 "다음날 발생" 해석 자체가 옳은지 확인
   필요.
4. **[Builder 발견, 신규] `date-utils.ts`의 clamp 반례(월말 29~31일, 윤년 2/29)가 FORMULA.md
   17개 예제로는 전혀 검증되지 않는다는 점.** ARCHITECTURE.md "1.3"이 이미 이 문제를 지적하고
   반례 2건을 제시했으며, Builder는 이를 Golden Test로 반드시 포함했다(위 "Golden Test" 참고).
   Calculation Auditor는 `logic.test.ts`/`date-utils.test.ts`에 실제로 이 두 테스트가
   존재하고 통과하는지, 그리고 `date-utils.ts` 소스 코드가 정말로 `calendarFullMonthsBetweenUtc`/
   `calendarFullYearsBetweenUtc`를 import하지 않는지(코드 리딩으로) 직접 확인할 것을
   권고한다 — 이는 테스트 통과 여부만으로는 "재사용하지 않았음"을 완전히 보장하지 못하기
   때문이다(만약 우연히 같은 로직을 다시 베껴 썼다면 테스트는 통과하지만 "왜 새로 작성해야
   했는가"라는 근거 자체가 무의미해진다 — 코드 리딩으로 실제 import 문과 알고리즘을 직접
   대조해야 한다).
5. **[Builder 발견, 신규] `calculateMinimumWageReference`의 "연도 데이터 없으면 undefined"
   정책이 실제로 Must Have 계산(accruedDays 등)을 막지 않는지.** 오케스트레이터 코드를 직접
   읽어 `allowance`/`minimumWageReference` 계산 실패가 `accruedDays`/`unusedDays` 계산에
   전혀 영향을 주지 않는 구조인지(예외가 상위로 전파되지 않는지) 확인할 것을 권고한다(로직상
   `calculateMinimumWageReference`는 별도 optional chaining으로 호출되어 예외를 던지지 않지만,
   코드 리딩으로 재확인 필요).

## Calculation Auditor

2026-09-14, SPEC.md/FORMULA.md/ARCHITECTURE.md 전체와 "Builder 구현 완료" 절을 정독한 뒤,
소스 코드 직접 읽기 + 프로젝트 코드를 import하지 않는 독립 Python/Node 재계산 + 실제 온라인
계산기 2종의 클라이언트 로직을 직접 추출·실행하는 방식으로 검증했다. **판정: PASS.**
FORMULA.md 자체의 오류는 발견하지 못했고(따라서 "공식 재검토 요청" 대상 없음), Builder가
FORMULA.md/ARCHITECTURE.md의 공식·구조를 임의로 바꾼 지점도 발견하지 못했다. 아래 순서대로
지시받은 5개 항목 + 표준 검증을 기록한다.

### 1. [최우선] 온라인 계산기 실측 대조 — FORMULA.md가 미확보로 남긴 항목

FORMULA.md가 지목한 두 계산기 모두 실제로 접근해 **정적 텍스트가 아니라 실제 클라이언트 JS
계산 로직을 추출해 Node.js에서 직접 실행**하는 방식으로 대조했다(둘 다 서버 API 호출 없이
브라우저에서 폼 계산이 끝나는 순수 클라이언트 사이드 계산기라 가능했다).

- **고용노동부 근로조건 계산기** (`https://labor.moel.go.kr/cmmt/calAnnlVctn.do`, curl로 실제
  200 응답 확인) — `<script>` 내 `fn_Calc()` 함수(입사일/퇴직일 입력, 퇴직일 미입력 시 오늘
  기준)를 그대로 추출해 jQuery/DOM을 최소 스텁으로 대체한 뒤 Node로 실행했다. 11개 케이스
  (FORMULA.md 예제 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12에 대응하는 입력)를 넣어 실제 출력을
  받았다:
  - 1개월차/11개월차/11개월(1년-1일): 실제 출력 1일/11일/11일 — `logic.test.ts`와 정확히 일치.
  - **정확히 1년 시점(예제 5)과 1년+1일(예제 6)**: 실제 출력이 "2년차 15일 + 1년차 11일 =
    **연차 총합 26일**"로, 이 계산기의 가장 중요한 경계값(`YEAR_1_TO_2` 구간 26일 고정)과
    정확히 일치했다. moel.go.kr 자체 코드가 바로 이 좁은 구간(1~2년차)에서만 "11일 배치"와
    "15일 배치"가 동시에 살아있어 두 값을 더한다는 것을 직접 확인했다(FORMULA.md "왜 구간
    2에서만 26인가" 설명과 독립적으로 일치).
  - **정확히 2년 시점(예제 7)**: moel.go.kr 결과의 "최신(마지막) 연차" 버킷(연차 총합이 아니라
    그 해에 새로 발생한 항목)이 15일로, 이 계산기의 `accruedDays=15`와 일치했다.
  - **3/5/21/22/23년 시점(예제 8~12)**: moel.go.kr 결과의 "최신 연차" 버킷이 각각
    16/17/25/25/25일로, `yearlyGrant(3)=16`, `yearlyGrant(5)=17`, `yearlyGrant(21..23)=25`와
    전부 일치했다. 특히 21년차 25일 최초 도달, 22년차 유지, 23년차 캡 작동까지 그대로
    재현됐다.
- **노동OK 연차계산기** (`https://www.nodong.kr/AnnuaVacationCal`, 301 리다이렉트를 따라 200
  확인) — 페이지가 참조하는 외부 JS(`.../AnnualVacationCal/After_v6.js`)를 curl로 직접
  받아 확인한 결과, "1년"=15, "2년"=15, "3년"=16, "4년"=16, "5년"=17, "6년"=17,
  ..., "21년"=25, "22년"=25, "23년"=25, "24년"=25가 **하드코딩된 상수**로 그대로 박혀 있었다
  (`ThirdYearAnnualDaysCount = 16` 등, 변수명까지 grep으로 원문 확인). 1년 미만 구간도
  `FirstYearMonthDaysCount`가 11에서 상한(그 이상은 0으로 리셋)되도록 하드코딩돼 있어
  `UNDER_1YEAR`의 `min(months,11)`과 동일한 효과를 낸다.
- **교차 결론**: `yearlyGrant(N) = min(15+floor((N-1)/2), 25)` 공식이 만들어내는 수열
  (15,15,16,16,17,17,...,25,25,25...)이 정부 계산기(moel.go.kr, 실행 결과)와 민간 계산기
  (nodong.kr, 하드코딩된 상수)에서 **N=1..24 전 구간에 걸쳐 예외 없이 정확히 일치**했다.
  `docs/CALCULATOR_RULES.md`의 "공식 계산기 예시값과 대조한 케이스 최소 2개" 요건을 충족하고도
  남는다(실질적으로 두 계산기 × 각 10개 이상 지점 = 20개 이상 지점 대조).
- **중요한 개념적 차이 발견(버그 아님, Medium — 아래 "발견 사항" 참고)**: moel.go.kr·nodong.kr
  둘 다 화면 최상단에 크게 보여주는 "연차 총합"은 **입사 이후 매해 발생한 배치를 전부 더한
  누적 총량**이다(예: 5년 근속 시 90일, 21년 근속 시 426일). 이 프로젝트의 `accruedDays`는
  그 누적 총량이 아니라 **"지금 시점에 유효한 것으로 볼 수 있는" 가장 최근 배치 하나만**
  가리킨다(SPEC.md/FORMULA.md가 명시적으로 그렇게 정의했고, 근로기준법 제60조⑦의 1년
  소멸시효를 근거로 삼는다 — 아래 "3."에서 법적 타당성을 별도로 확인했다). 두 계산기의
  개별 연차별(per-year) 수치는 이 프로젝트의 `yearlyGrant(N)`과 완벽히 일치하지만, 최상단에
  노출되는 "합계" 숫자의 정의 자체가 다르므로 사용자가 두 계산기를 나란히 놓고 비교하면
  "우리 계산기가 훨씬 적게 나온다"고 오인할 수 있다. 이는 FORMULA.md/구현의 오류가 아니라
  (제목이 "연차수당 계산기"이지 "연차개수 누적 계산기"가 아니므로 현재 설계가 legally 더
  정확하다), 정책 고지/FAQ에 이 차이를 한 줄 명시하면 좋겠다는 **Medium 등급 개선 제안**으로
  아래에 별도 기록한다.

검증에 사용한 스크립트: `moel_driver.js`(고용노동부 JS를 추출·스텁·실행), `nodong_after_v6.js`
grep 확인 — 둘 다 세션 스크래치패드에 있으며 프로젝트 저장소에는 포함하지 않았다.

### 2. Architect가 발견한 날짜 유틸 버그 재현 검증

- **코드 확인**: `src/calculators/annual-leave-allowance/date-utils.ts`를 직접 읽었다.
  `import { lastDayOfMonthUtc } from "@/src/lib/date-calc";` 한 줄만 있고,
  `calendarFullMonthsBetweenUtc`/`calendarFullYearsBetweenUtc`는 import는 물론 파일 어디에도
  등장하지 않는다(문자열 검색으로 재확인). `monthAnniversary`/`yearAnniversary`는 매 호출마다
  `hire.getUTCMonth()`/`hire.getUTCFullYear()`에서 새로 `(연,월+k)`를 계산하는 구조라, 이전
  호출 결과를 인자로 다시 넘기는 "연쇄 계산" 경로 자체가 코드에 존재하지 않는다(각 함수가
  순수하게 `hire`(원본)와 `k`만 받는 것으로 이미 연쇄가 구조적으로 불가능하다).
- **독립 재계산(Python, 프로젝트 코드 미import)**: FORMULA.md 의사코드를 그대로 옮겨 재구현한
  스크립트로 두 반례와 기존 공용 함수(`calendarFullYearsBetweenUtc`/
  `calendarFullMonthsBetweenUtc`, `src/lib/date-calc.ts` 원문 그대로 재현)를 나란히 계산했다:
  - 반례 A(`2025-01-31`→`2025-02-28`): 신규 함수 `completedMonths=1`(올바름) vs 기존 공용
    함수 재현 결과 `0` — ARCHITECTURE.md "1.3"의 주장과 **정확히 일치**.
  - 반례 B(`2024-02-29`→`2025-02-28`): 신규 함수 `completedYears=1, regime=YEAR_1_TO_2,
    accruedDays=26`(올바름) vs 기존 공용 함수 재현 결과 `completedYears=0`→
    `UNDER_1YEAR`로 오분류, `completedMonths=11`→`accruedDays=11` — 이 역시 ARCHITECTURE.md
    주장과 정확히 일치.
- **테스트 존재 확인**: `date-utils.test.ts`(원본 기준 독립 계산 자체를 검증하는 별도 단위
  테스트, `H=2024-01-31`의 `monthAnniversary(H,2)=2024-03-31` 케이스와 윤년 2/29 4년 반복
  케이스 포함)와 `logic.test.ts`(오케스트레이터 레벨 반례 A·B)에 모두 실존하며
  `npx vitest run src/calculators/annual-leave-allowance` 로 4개 파일 90개 테스트 전부
  통과를 직접 재실행해 확인했다.
- **결론**: Architect의 버그 재현·Builder의 회피 조치 모두 사실이다. 허위 주장이나 "우연히
  같은 버그를 다시 베낀" 정황은 없다.

### 3. 핵심 산식 검증 — "1~2년차 26일 고정" 설계

- **법조문 원문 재확인**: CaseNote(casenote.kr)의 근로기준법 제60조·제61조 조문을 직접
  WebFetch로 열람했다. ①15일(80% 이상 출근), ②1개월 개근 시 1일(1년 미만/80% 미만),
  **③ 삭제(2017.11.28.)**, ④3년 이상 근속 시 매 2년마다 1일 가산(25일 한도), ⑤통상임금
  또는 평균임금 지급, ⑥출근 간주 규정, **⑦"제1항·제2항 및 제4항에 따른 휴가는 1년간
  행사하지 아니하면 소멸된다"** — FORMULA.md가 인용한 문구와 **한 글자도 다르지 않게
  일치**했다. 제61조도 ①(1년 이상, 6개월 전 10일 이내 통보 → 미회신 시 2개월 전까지 서면
  통보)·②(1년 미만, 3개월 전/1개월 전 등) 문구가 FORMULA.md 요약과 일치했다.
- **논리적 일관성 재검토**: 제60조⑦에 따라 1년 미만 시절 매월 발생한 최대 11개 배치는
  각각 "그 배치의 발생일로부터 1년"이 지나면 개별 소멸한다. 입사 후 1~11개월에 발생한
  배치들의 개별 만료 시점은 입사 후 13~23개월 사이에 분포한다. 즉:
  - 정확히 입사 1년 시점(예제 5)에는 11개 배치 중 어느 것도 아직 만료되지 않았으므로
    "11+15=26"은 그 **정확한 순간**에는 실제로 정확한 값이다(근사가 아니라 정확한 계산).
  - 그러나 입사 1년+1개월(13개월째)부터는 가장 먼저 발생한 배치부터 하나씩 순차적으로
    만료되므로, "26일 고정"은 구간 2(1~2년차) 나머지 구간(대략 11개월) 동안은 실제보다
    **과대평가**된 값이 된다(1년 도달 이후 시점에서 26 → 실제로는 25,24,...,15로 점진 감소해
    2년 시점에는 정확히 15로 수렴).
  - **입사 정확히 2년 시점에는 11개 배치가 전부 만료되어 있으므로**(가장 늦게 만료되는
    배치도 23개월째 만료) "그 해 신규 발생분만"(`yearlyGrant(2)=15`)으로 전환하는 구간 3의
    설계도 정확히 맞아떨어진다 — 즉 "1~2년차 구간이 끝나는 시점(=2년차 시작)에는 과거 배치가
    이미 전부 소멸했을 것"이라는 FORMULA.md의 가정은 산수로 검증해도 정확히 맞다(근사가
    아니라 정확한 경계 일치).
  - FORMULA.md는 이 과대평가 구간(1년+1개월~2년 미만)의 한계를 "구간 2 동안 26일은 시간이
    지나며 개별적으로 줄어든다... 사용자에게 유리한 방향"이라고 이미 정직하게 고지했고,
    `content.ts`의 `ANNUAL_LEAVE_POLICY_NOTICES[3]`에 그 문구가 실제로 그대로 반영돼 있음을
    코드로 확인했다. **"버그처럼 보이는 2년차 감소(26→15)"가 실제로는 정확한 경계에서
    발생한다는 점까지 독립 재계산으로 뒷받침되므로, 이 설계는 논리적으로 일관되고 고지도
    정확하다.**
  - 위 "1."에서 확인했듯, 이 26일이라는 값은 moel.go.kr 자체 계산기가 같은 순간(정확히 1년
    시점)에 내놓는 실제 출력과도 일치한다 — 법조문 해석뿐 아니라 실제 계산기 동작으로도
    삼중 교차검증됐다.
- **결론**: 이 설계는 타당하다. FORMULA.md에 대한 "공식 재검토 요청" 사유를 발견하지
  못했다.

### 4. 가산 연차 공식 검증

- **`yearlyGrant(N) = min(15+floor((N-1)/2), 25)` 독립 재계산**: Python으로 N=2..23 전 구간을
  재계산해 `logic.test.ts`의 스윕 테이블과 완전히 일치함을 확인했다(15,16,16,17,17,18,18,19,
  19,20,20,21,21,22,22,23,23,24,24,25,25,25). 21년차에서 최초로 25(=15+10)에 도달하고,
  22년차도 `floor(21/2)=10`으로 동일하며, 23년차는 raw 26이 캡으로 25가 되는 최초 지점이라는
  FORMULA.md의 주장을 그대로 재현했다.
- **인용 출처 실사 확인(WebFetch, 실제 URL 접속)**:
  - `connectingus.co.kr/102`("연차수당 계산기 및 계산방법 총정리") — 실제로 존재하며, 본문에
    "1년차: 개근 시 최대 11일, 2년차: 15일, 4년차: 15+1=16일, 10년차: 15+4=19일" 예시 문구가
    실제로 있음을 확인했다(FORMULA.md가 인용한 그대로, 다만 "표" 형식이 아니라 문단 예시임 —
    FORMULA.md도 "표"라고 단정하지 않고 "표가 제시한"이라 다소 느슨하게 표현했으나 인용 수치
    자체는 정확하다).
  - `naver.worksmobile.com/blog/hr_master_leave_1/`("연차의 모든 것 1") — 실제로 존재하며,
    "1년 이상 15일, 2년 이상 15일, 3년 이상 16일, 4년 이상 16일, 5년 이상 17일, ..., 21년
    이상 25일, 22년 이상 25일" 표가 실제로 있음을 확인했다. 이 값들은 `yearlyGrant(N)`과
    정확히 일치한다.
  - 위 "1."에서 실행한 moel.go.kr/nodong.kr 실제 계산 결과와도 전부 일치해, 이 공식은
    법조문(1차)·2개 민간 콘텐츠(2차, 실사 확인)·2개 실제 계산기(실측)까지 다섯 갈래로
    교차검증됐다.
- **결론**: 가산 연차 공식과 21년차 25일 상한 도달 주장 모두 사실이며, FORMULA.md의 인용도
  정확하다.

### 5. Builder가 남긴 추가 이슈 확인

- **`date-utils.ts`가 기존 공용 함수를 정말 import하지 않는지**: 위 "2."에서 코드 리딩 +
  문자열 검색으로 재확인했다. `calendarFullMonthsBetweenUtc`/`calendarFullYearsBetweenUtc`
  문자열이 `date-utils.ts`/`logic.ts` 어디에도 등장하지 않는다. import 대상은
  `lastDayOfMonthUtc`(순수 달력 산술) 하나뿐이다.
- **연도 데이터 없을 때 `calculateMinimumWageReference`가 Must Have 계산을 막지 않는지**:
  `logic.ts`의 `calculateAnnualLeaveAllowance` 오케스트레이터를 직접 읽었다.
  `continuousServiceRegime`/`accrual`/`unusedDays` 계산은 `input.ordinaryDailyWage`와
  무관하게 먼저 전부 끝나고, `allowance`/`minimumWageReference`는 그 뒤 별도의 삼항 연산자
  두 줄로만 계산된다(`input.ordinaryDailyWage != null ? calculateXxx(...) : undefined`).
  `calculateMinimumWageReference` 내부도 `getRatesForYearOrNull`이 `null`이면 즉시
  `return undefined`이며 `throw`가 없다(코드에 `throw`가 없음을 직접 확인). 즉 최저임금
  데이터가 없는 연도를 조회해도 예외가 상위로 전파될 경로 자체가 없고, `accruedDays`/
  `unusedDays` 계산은 항상 완주한다. `logic.test.ts`의 "데이터가 없는 연도는 에러를 던지지
  않고 undefined를 반환한다" 테스트(2030년·1999년 케이스)가 실제로 통과함도 재실행해 확인했다.

### 표준 검증

- **FORMULA.md 17개 검증 예제 독립 재계산**: 프로젝트 코드를 import하지 않는 순수 Python
  재구현(날짜 유틸 + 3구간 발생일수 + 가산 공식)으로 예제 1~16(정상 계산 경로)을 전부
  재계산해 `logic.test.ts`의 기대값과 **1건의 불일치 없이 전부 일치**함을 확인했다(예제
  17은 입력 오류 경로라 `validation.test.ts`가 담당하며, 코드 리딩으로 `referenceDate <
  hireDate` 분기가 정확히 그 조건을 검사함을 확인했다).
- **함수별 계산 순서 대조**: `determineContinuousServiceRegime`(2단계: `completedYears`만
  호출해 3구간 분류) → `calculateAccruedDays`(3단계: 구간별 정의) →
  `calculateUnusedDays`(4단계: `max(accrued-used,0)` + 경고 플래그) →
  `calculateAllowance`(5단계: 곱 + 최종 1회 반올림) → `calculateMinimumWageReference`
  (6단계: 최저임금 비교) → 오케스트레이터(7~8단계: breakdown 조립을 위한 판별 유니온 조립)
  순서가 FORMULA.md "계산 순서" 1~8단계와 정확히 대응함을 코드로 확인했다.
- **raw/display 분리**: `accruedDays`는 `Math.min`/`Math.floor`만 거치고 반올림 함수를
  전혀 통과하지 않는다(코드 전체에서 `accruedDays`에 `round`가 적용되는 지점 없음).
  `unusedLeaveAllowance`는 `calculateAllowance` 안에서 `Math.round`가 **정확히 1번만**
  호출된다. `formatting.ts`의 `formatWon`이 표시 직전에 `Math.round`를 한 번 더 부르지만
  이미 정수인 값을 다시 반올림하는 것이라 항등연산(idempotent)이며 오차를 만들지 않는다
  (직접 계산해 확인: `round(round(x)) = round(x)`).
- **플래그 조건 확인**: `usedMoreThanAccruedWarning = usedDays > accruedDays`,
  `belowMinimumWageReference = ordinaryDailyWage < dailyReferenceAmount` — 둘 다 FORMULA.md
  정의와 정확히 일치한다. `calculateMinimumWageReference(60_000, 2026-03-10)` 등 기존
  테스트를 재실행해 `82,560원`(=10,320×8, `rates-2026.json` 원본 값과 대조 확인) 기준값도
  재확인했다.
- **부동소수점/반올림 검증**: 반차 등 소수 `usedDays`(0.1/0.3/0.5/0.7/0.9/1.1/4.5 등)를
  Node로 직접 대입해 `accruedDays - usedDays`/`unusedDays × wage` 연산에 부동소수점 표현
  오차로 인한 눈에 띄는 왜곡이 없음을 확인했다(`Math.round`가 사사오입을 정확히 수행,
  예: `10.5일 × 33,333원 = 349,996.5원 → 349,997원` 테스트값과 독립 계산이 일치).
- **잘못된 입력 처리**: `validation.ts`를 코드로 읽고 `validation.test.ts`(90개 테스트 중
  일부, 필수값 누락/존재하지 않는 달력 날짜/형식 오류/음수/비숫자/공백 문자열/상한 초과/
  `hireDate>referenceDate`)가 실제로 통과함을 재실행해 확인했다. 특히 `toOptionalNumber`가
  공백 문자열(`"   "`)을 `Number()`의 "0으로 취급" 함정 없이 `undefined`로 정확히 처리하는
  로직을 코드로 직접 확인했다.
- **전체 회귀 스윗**: `npx vitest run`(전체) — 86개 파일, 1,199개 테스트 전부 통과를 직접
  재실행해 재확인했다(Builder가 보고한 수치와 일치, 회귀 없음).

### 발견 사항 (심각도별)

- **[Medium] "연차 총합 누적" vs "현재 유효 배치" 개념 차이가 정책 고지/FAQ에 명시돼 있지
  않다.** 위 "1."에서 확인했듯 고용노동부·노동OK 계산기는 화면 최상단에 "누적 총 연차"를
  보여주지만, 이 계산기의 `accruedDays`(2년 이상 구간)는 "가장 최근에 새로 발생한 배치"만
  가리킨다. 계산 자체는 옳지만(오히려 소멸시효를 반영해 더 실무에 가까운 값이다), 사용자가
  다른 계산기와 비교할 때 혼란을 겪을 수 있다. FAQ 1번 답변이나 정책 고지에 "이 계산기는
  아직 소멸되지 않은 것으로 볼 수 있는 연차만 보여주며, 과거 연도에 발생한 연차를 모두 더한
  누적 총량이 아닙니다" 같은 한 문장을 추가할 것을 권고한다(계산 로직 변경 불필요, 문구
  추가만 필요 — Formula Analyst/Content 담당 재량).
- **[Low] `getMaxAllowedDate()`가 `Asia/Seoul` 고정이 아니라 브라우저 로컬 타임존의
  `new Date()`를 쓴다.** `ui.tsx`의 `todayInKorea()`(입력 기본값)는 `Asia/Seoul`로 고정돼
  있지만, `validation.ts`의 `getMaxAllowedDate()`(날짜 상한 검증에도 쓰임)는 로컬 타임존
  기준이다. 한국 외 타임존 사용자가 자정 부근에 조회하면 허용 상한이 하루 어긋날 수 있는
  극단적 edge case이며, 핵심 계산(발생일수·금액)에는 영향이 없다(입력 검증 상한선의
  오차일 뿐이다). QA가 인지만 하면 되는 수준으로, 이번 라운드의 PASS 판정에 영향을 주지
  않는다.
- **[정보성, 결함 아님] FORMULA.md "확인 필요 항목 3"(anniversary-of-month "다음날 발생")의
  고용노동부 행정해석 번호 미특정)** — 문서 번호 자체는 여전히 특정하지 못했으나, 위 "1."에서
  moel.go.kr 자체 계산기의 월 단위 판정 로직을 직접 실행해 이 계산기의 `completedMonths`
  모델과 동일한 결과(1개월차=1일, 11개월차=11일, 11개월+29일=11일 유지)를 얻었다 — 즉 실무적
  타당성은 정부 계산기 실측으로 이미 확인됐고, 남은 것은 순수 인용 번호 표기의 공백이다(계산
  정확성과 무관).

### 항목별 결론 요약

1. 온라인 계산기 실측 대조: **완료, 일치** — moel.go.kr(11개 지점)·nodong.kr(24개 지점 하드코딩
   테이블) 모두 이 계산기의 값과 정확히 일치. FORMULA.md의 미확보 항목을 해소했다.
2. 날짜 유틸 버그 재현: **확인, 사실** — 코드 리딩(비-import 확인) + 독립 재계산(반례 A·B
   재현) 모두 Architect/Builder 주장과 일치.
3. "1~2년차 26일 고정" 설계: **타당** — 법조문 원문 재확인 + 산수로 재검증한 논리적 일관성 +
   moel.go.kr 실측까지 삼중 확인. 정책 고지 문구도 정확히 반영됨.
4. 가산 연차 공식(21년차 25일 상한): **정확** — 독립 재계산 + 인용 출처 2건 실사 확인 +
   실제 계산기 2종 실측까지 다섯 갈래 교차검증.
5. Builder 인계 항목(비-import, minimumWageReference 비차단): **둘 다 코드로 확인, 사실**.

**최종 판정: PASS.** FORMULA.md 재검토 요청 사유 없음, Builder FAIL 사유 없음. 위 Medium 1건
(정책 고지 문구 보강 권고)·Low 1건(타임존 edge case)은 차단 사유가 아니며 다음 라운드(Content
보강/QA)에서 참고할 개선 제안으로 남긴다.

## UX/UI Critic

2026-09-14, Edit 권한 없이 소스 코드를 읽기만 하는 방식으로 검증했다. 읽은 파일: SPEC.md,
FORMULA.md, ARCHITECTURE.md, 위 "Builder 구현 완료"/"Calculation Auditor" 절, 그리고
`src/calculators/annual-leave-allowance/{ui.tsx,content.ts,validation.ts,types.ts,
formatting.ts}` 전체. 비교 대상으로 `src/calculators/severance-pay/ui.tsx`,
`src/calculators/weekly-holiday-allowance/ui.tsx`, `src/calculators/housing-acquisition-tax/
ui.tsx`, `components/calculator/UsageGuide.tsx`, `src/calculators/registry.ts`(categoryLabels·
아이콘 배정 현황)도 함께 확인했다.

### 자체 평가 질문 (평가 항목 매핑 포함)

아래 순서로 총 16개 질문을 만들었다(요구된 최소 10개 초과, 필수 질문 4개 포함, 7개 평가
항목을 모두 최소 1개 이상 커버). 각 질문 뒤에 [평가 항목]과 등급을 표기한다.

**Q1. [필수] `FIELDS`(라벨) 직접 대조 — 법령·전문 용어를 라벨에 그대로 썼는가?**
[입력 라벨 표현]
실제 라벨은 "입사일"/"연차 산정 기준일"/"이미 사용한 연차일수"/"1일 통상임금" 4개다.
"계속근로기간"·"통상임금 산정"·"연차 사용촉진" 같은 노무 전문 용어는 라벨에 없고 helpText·
정책 고지에만 등장한다(SPEC.md "입력 라벨·순서" 준수). 다만 "연차 산정 기준일"은 SPEC.md
Must Have 입력 목록의 표현("연차 산정 기준일")을 토씨 하나 다르지 않게 그대로 옮긴 것이라,
docs/DESIGN_SYSTEM.md "FORMULA.md·SPEC.md의 용어를 화면 라벨로 그대로 복사하지 않는다" 원칙의
문언에는 어긋난다. 다만 (a) "연차 산정 기준일"은 법령상 정의된 전문 용어가 아니라 이 계산기가
새로 만든 서술적 표현이고, (b) helpText("비워두면 오늘 날짜를 기준으로 계산합니다")가 바로
아래 붙어 있어 이해에 실질적 장벽은 없다. "1일 통상임금"은 severance-pay `FIELDS` 배열이
이미 동일 라벨을 쓰고 있는 이 사이트의 기존 관례라 새로운 이탈이 아니다.
→ **Low** (원칙의 문언은 어겼지만 실사용자 이해에 지장이 없고, 대체할 더 쉬운 표현이 마땅치
않다 — 굳이 고친다면 "확인 기준일"/"기준 날짜" 등을 고려할 수 있다).

**Q2. [필수] 입력 순서가 시간순인가? 하나의 기간을 이루는 두 날짜 사이에 다른 성격의 필드가
끼어 있지 않은가?** [입력 라벨·순서·그룹핑]
입사일 → 연차 산정 기준일이 `grid gap-5 sm:grid-cols-2`로 바로 인접해 있고, 그 사이에 다른
필드가 없다. 사용일수·1일 통상임금은 `border-t` 아래 별도 그룹으로 분리돼 있다. SPEC.md/
ARCHITECTURE.md가 요구한 순서와 정확히 일치.
→ **문제없음.**

**Q3. [필수] 같은 개념이 폼·결과·오류 메시지 전체에서 한 용어로 통일돼 있는가?**
[결과 가독성 / 입력 라벨]
"연차 발생일수"(라벨: 핵심카드/보조정보/breakdown 1~2단계 전부 동일), "미사용 연차일수"/
"미사용일수"(보조정보 카드는 "미사용 연차일수", breakdown 3단계 문장은 "미사용일수" —
약어 관계로 의미 충돌 없음, severance-pay도 동일하게 축약해 쓰는 관례), "미사용 연차수당"
(라벨·핵심카드·breakdown 4단계 동일), "이미 사용한 연차일수"(입력 라벨) ↔ "사용일수"
(breakdown 3단계, validation.ts 오류 메시지는 라벨과 동일하게 "이미 사용한 연차일수"를
그대로 씀) — 오류 메시지는 라벨과 완전히 동일한 표현을 쓰고 있어 오히려 일관성이 breakdown
문장보다 더 높다.
→ **문제없음** (breakdown의 약어 사용은 사이트 전반의 기존 관례와 같은 수준).

**Q4. [필수] 입력 필드 수가 최소인가? 다른 입력에서 유도 가능한 값을 중복으로 묻지 않는가?**
[입력 라벨 / 일반 사용자 사용성]
4개 필드(입사일·기준일·사용일수·1일 통상임금) 모두 서로 독립적인 값이며, 어느 하나도 다른
입력에서 계산으로 유도할 수 없다(기준일은 기본값 "오늘"로 자동 채워지고, 사용일수는 기본값
0으로 처리돼 실질 필수 입력은 입사일 하나뿐 — 폼 헤더의 "필수 1개" 배지가 이를 정확히
알려준다).
→ **문제없음.**

**Q5. 근속 1~2년차 사용자가 "26일"을 본 뒤 다른 시점(2년차 이상)에 "15일"을 보면 당황하지
않고 이유를 이해할 수 있는가?** [일반 사용자가 계산법을 몰라도 사용 가능한지 / 계산 근거
이해]
`content.ts`의 정책 고지 4번("...2년차에 발생일수가 26일에서 15일로 줄어드는 것도 오류가
아니라...")이 이 현상을 명시적으로 설명하고, FAQ 2번도 "이론상 최대 26일까지 함께 존재할 수
있습니다"로 배경을 보완한다. 두 문구 모두 결과가 계산된 화면(정책 고지 SectionCard, 아
result 블록 안)에 항상 노출되므로 스크롤 한 번이면 도달할 수 있다. 다만 이 설명은 5개 정책
고지 문구 중 4번째 항목으로, 시각적으로는 다른 4개 문구(법령 근거·사용촉진·회계연도·최저임금
갱신)와 동일한 `text-muted` 불릿 목록에 섞여 있어, 이 계산기의 "가장 신경 써서 다루는 바로 그
경계"(ARCHITECTURE.md 표현)치고는 강조 수준이 특별히 높지 않다 — 핵심 결과 카드나 계산 근거
2단계 바로 옆에 이 설명을 짚어주는 인라인 콜아웃은 없다.
→ **Medium** (설명 자체는 정확하고 항상 노출되지만, 이 계산기의 핵심 혼란 포인트치고 시각적
우선순위가 다른 일반 고지 문구와 동일하게 낮다 — 발생 시점에 더 가깝게, 또는 더 눈에 띄게
배치할 것을 권고).

**Q6. "이미 사용한 연차일수" 입력의 의미가 구간에 따라 다를 수 있는데, 실제 문구가 모든
구간에서 자연스럽고 정확하게 읽히는가?** [일반 사용자가 계산법을 몰라도 사용 가능한지 /
계산 근거 이해 — 이번 평가의 핵심 이슈]
helpText는 "지금까지 사용한 연차일수를 입력하면 남은 연차수당을 계산해드립니다"이다. 문장
자체는 문법적으로 모든 구간에서 자연스럽게 읽힌다. 그러나 **범위(scope) 정의가 근속
2년 이상(`OVER_2YEARS`) 사용자에게 실제로 오입력을 유발할 수 있다**: FORMULA.md는 `usedDays`
를 "'현재 유효 연차 풀'에서 사용한 일수"로 명확히 정의하고 있고, `OVER_2YEARS` 구간의
`accruedDays`는 Calculation Auditor가 이미 확인했듯 "누적 총량이 아니라 가장 최근 배치
하나"만 가리킨다(예: 5년 근속자는 `accruedDays=17`이지 5년간 발생한 연차 총합이 아니다).
그런데 helpText의 "지금까지"라는 표현은 "입사 후 지금까지 누적으로 사용한 총 일수"로 읽힐
가능성이 높다 — 예를 들어 5년 근속자가 실제로 지난 5년간 총 60일을 사용했다면(연 12일 정도),
그 값을 그대로 입력하면 `unusedDays = max(17-60, 0) = 0`이 되고
`usedMoreThanAccruedWarning`이 함께 뜬다. 계산 자체는 정의대로 정확하지만, 사용자 입장에서는
"5년이나 일했는데 왜 남은 연차가 0이고 심지어 경고까지 뜨지?"라는 잘못된 결론에 도달하기
쉽다 — 실제로 필요한 입력값은 "이번에 새로 받은 17일 중 사용한 일수"인데 문구가 이를
구분해주지 않는다. 이 문제는 화면 어디에도(핵심 카드 옆, `accruedDays` 옆, 정책 고지, FAQ)
"이 발생일수는 누적이 아니라 최근 1회 배치만 나타낸다"는 설명이 없다는 점(Calculation
Auditor가 이미 Medium으로 지적한 "누적 총합 vs 현재 유효 배치" 개념 차이, 아직 문구 보강
미반영)과 정확히 맞물려 있다 — 두 문제가 결합하면 "무엇을 입력해야 하는지"와 "결과가 왜
그렇게 나오는지"를 모두 오해할 수 있는 근속 2년 이상(가장 흔한) 사용자층에게 실질적인 혼란을
일으킨다.
→ **High** (계산 자체의 버그는 아니지만, 다수 사용자군에게 입력 단계에서부터 잘못된 값을
유도해 최종적으로 신뢰할 수 없는 "미사용 연차수당" 결과로 이어질 실질적 위험 — 오탐지된
`usedMoreThanAccruedWarning`이 오히려 확신을 더 강화한다).

**Q7. 1일 통상임금 미입력 시 핵심 카드가 "발생일수"로 바뀌는 전환이 자연스러운가?**
[결과 가독성]
핵심 카드 안에 "1일 통상임금을 입력하면 미사용 연차수당 금액까지 이어서 계산해드립니다"라는
안내 문장이 발생일수 바로 아래 붙어 있고, 입력 폼의 helpText에도 "비워두면 금액 계산 없이
발생일수·미사용일수까지만 보여드립니다"로 동일한 전환 규칙을 미리 예고한다. 두 지점이 서로
일관되게 같은 규칙을 설명해 "왜 금액이 안 나오지?"라는 혼란 여지가 적다.
→ **문제없음.**

**Q8. `usedMoreThanAccruedWarning`/`belowMinimumWageReference` 경고가 오류처럼 느껴지지
않고 참고 안내로 읽히는가?** [오류 메시지의 이해 용이성]
두 경고 모두 `rounded-2xl border border-warning-border bg-warning-surface` 카드로,
weekly-holiday-allowance의 `belowMinimumWage`/`meetsMinHoursRequirement` 비차단 경고와
동일한 스타일이다(사이트 전역에서 이미 검증된 패턴). 문구도 "...미사용일수는 0일로
계산합니다"/"...보다 낮습니다"처럼 사실 서술형이지 "오류"·"실패" 같은 단정적 표현이 없다.
계산은 두 경고 모두 계속 진행되며 폼을 막지 않는다.
→ **문제없음** (다만 Q6에서 지적한 "사용일수 오입력"이 실제로 발생하면, 이 경고가 뜨는
빈도 자체가 부당하게 높아질 수 있다는 점은 Q6의 연장선 — 별도 감점 아님).

**Q9. 연차 사용촉진(제61조) 고지가 "못 받을 수도 있다"는 불안을 과하지 않게 전달하면서
계산 자체는 유용하게 유지하는가?** [일반 사용자가 계산법을 몰라도 사용 가능한지]
정책 고지 2번 문구가 조건(적법한 사용촉진 절차 이행 시)과 이 계산기의 가정("적법한
사용촉진이 없었다고 가정")을 함께 명시하고, 계산 자체는 게이팅 없이 항상 진행된다(SPEC.md
"설계상 핵심 결정" 그대로 구현). FAQ 3번이 같은 내용을 다시 한번 이해하기 쉬운 언어로
풀어 설명한다. 위협적 어조("못 받을 수도 있습니다!") 대신 조건문 서술로 담담하게 전달한다.
→ **문제없음.**

**Q10. 회계연도 기준 부여 방식을 모르는 사용자가 이 계산기 결과를 오해하지 않도록 안내가
충분한가?** [일반 사용자가 계산법을 몰라도 사용 가능한지]
정책 고지 3번("회사가 회계연도 기준으로 연차를 일괄 부여하는 경우 실제 발생일수·수당액과
다를 수 있습니다")과 FAQ 5번이 동일 내용을 항상 노출한다. 이 계산기가 무슨 방식을 쓰는지
("입사일 기준")까지 명시해 사용자가 자기 회사와 비교할 수 있는 최소한의 단서를 준다.
→ **문제없음** (SPEC.md 범위 밖 결정 그대로 반영됨).

**Q11. 입사일이 윤년 2/29이거나 말일(29~31일)인 사용자를 위한 별도 UX 배려가 필요한가?**
[일반 사용자가 계산법을 몰라도 사용 가능한지]
`<input type="date">`는 브라우저 네이티브 달력 선택기를 쓰므로 사용자가 "2월 29일"을 직접
고르는 데 문제가 없고, clamp 로직 자체는 Calculation Auditor가 이미 정확함을 확인했다.
화면에 "말일 입사자는 다음 달 마지막 날 기준으로 계산됩니다" 같은 별도 안내는 없지만,
severance-pay 등 이 사이트의 다른 날짜 계산기들도 이런 극단값에 대한 전용 UI 설명을 따로
두지 않는 것이 기존 관례다.
→ **Low** (없어도 무방하지만, "계산 근거" 1단계 문구에 clamp가 적용됐다는 티끌만큼의
단서도 없어 궁금한 사용자가 재현해보기는 어렵다 — 우선순위 낮은 개선 아이디어로만 남김).

**Q12. 모바일에서 4개 입력 필드와 계산 근거 4단계가 잘 읽히는가(레이아웃 관점)?**
[모바일 사용성]
입력 필드 두 그룹 모두 `grid gap-5 sm:grid-cols-2`라 640px 미만에서는 1열로 자연스럽게
쌓인다(설계 시스템 기준 충족). 다만 "보조 정보"(발생일수·미사용일수) 두 카드는
`grid grid-cols-2 gap-3`로 **반응형 breakpoint나 `max-w-*` 제약이 없다** — 이 사이트의
유사한 2열 미니 통계 카드들(`loan-interest-calculator`의 `grid-cols-2 gap-4`,
`bmr-calculator`/`housing-acquisition-tax`의 `max-w-md`/`max-w-xs grid-cols-2`)은
대부분 폭 제한을 함께 준다는 점과 비교하면 이 계산기만 폭 제한이 빠져 있다. 320px 뷰포트
기준으로 각 카드 안쪽 텍스트 폭이 대략 100px 안팎까지 좁아지는데, 라벨("미사용 연차일수")과
값("26일")이 짧아 줄바꿈은 되어도 잘림(overflow)은 발생하지 않을 것으로 판단된다(코드에
`truncate`/`overflow-hidden`이 없어 잘리는 대신 줄바꿈되는 안전한 실패 모드). 데스크톱
(`max-w-6xl` 컨테이너)에서는 이 제약 부재로 카드 두 개가 불필요하게 넓게 늘어나는 미관상의
어색함이 있을 수 있다.
→ **Low** (기능적 모바일 결함은 아니지만, 사이트 관례와의 일관성 차원에서 `max-w-md` 등
폭 제약 추가를 권고 — QA가 실제 기기에서 잘림 여부를 재확인할 것).

**Q13. 이 사이트의 유사 계산기와 비교해 톤·카드 스타일·eyebrow 라벨이 일관되는가?**
[결과 가독성 / 불필요한 UI 요소 — 디자인 일관성]
eyebrow는 `<Link href="/categories/labor">노동/근로</Link>`로 `registry.ts`의
`categoryLabels.labor = "노동/근로"`와 토씨 하나 다르지 않게 일치한다(docs/DESIGN_SYSTEM.md
"헤더(eyebrow) 라벨" 규칙 충족). 핵심 카드(`bg-primary`)·경고 카드(`warning-surface`)·
SectionCard 아이콘 배지·버튼 스타일 모두 severance-pay/weekly-holiday-allowance와 동일한
클래스를 그대로 재사용한다. 아이콘은 `registry.ts`에서 "chart"를 새로 배정했는데, labor
카테고리 안에서는 겹치지 않는다(coins/calculator/calendar/heart와 구분됨). "chart" 아이콘이
다른 카테고리(예: 222행, 299행)에서도 이미 쓰이고 있으나, 이 사이트는 아이콘을 카테고리
내에서만 구분하면 되는 관례(예: "coins"가 3개 계산기에서 이미 중복 사용 중)라 새 이탈이
아니다.
→ **문제없음.**

**Q14. 경계값 입력(입사일=기준일, 사용일수 소수 입력 등) 시 오류 메시지가 이해하기 쉬운가?**
[오류 메시지의 이해 용이성]
`hireDate === referenceDate`는 오류가 아니라 정상 계산 경로(0일)로 처리되고 별도 오류
메시지 자체가 뜨지 않는다(FORMULA.md "예외" 그대로). `referenceDate < hireDate`일 때는
"기준일은 입사일 이후여야 합니다"로 원인·조치가 분명하다. 소수 사용일수(예: "0.5")는
`inputMode="decimal"`로 받아 오류 없이 정상 처리되고 결과에 "0.5일"로 자연스럽게
표시된다(`Intl.NumberFormat('ko-KR')`이 소수를 그대로 표기). 그 외 음수·상한 초과·비숫자
오류 메시지도 전부 라벨과 동일한 용어("이미 사용한 연차일수", "1일 통상임금")를 써서
어떤 필드의 문제인지 헷갈리지 않는다.
→ **문제없음.**

**Q15. 계산 근거 4단계 breakdown이 서술형 내레이션 없이 "라벨=값" 형태로 명확하고,
카드/아이콘/단계 표시로 시각적 계층을 갖췄는가?** [계산 과정을 이해할 수 있는지 / 결과
가독성]
`buildServicePeriodBreakdown`/`buildUnder1YearAccrualBreakdown`/
`buildYear1To2AccrualBreakdown`/`buildOver2YearsAccrualBreakdown`/
`buildUnusedDaysBreakdown`/`buildAllowanceBreakdown` 전부 "라벨 값 → 값" 형식의 수식
문자열이며 서술형 문장이 아니다(SPEC.md 요구 그대로). `SectionCard`에 `formula` 아이콘이
있고, `<ol>` 안에 1~4단계가 번호와 굵은 소제목("1. 근속기간 판정" 등)으로 구분돼 있다.
다만 severance-pay/housing-acquisition-tax의 기존 breakdown 스타일(순수 텍스트 `<li>`,
카드 배경 구분 없음)을 그대로 따른 것이라, `UsageGuide`가 쓰는 원형 번호 배지 같은 더
강한 시각적 계층은 없다 — 그러나 이는 이 사이트 전체의 기존 관례(2개 선례와 동일)이지
이 계산기만의 이탈이 아니다.
→ **문제없음** (SPEC.md "카드 구분·아이콘·단계 표시" 요구를 기존 사이트 관례 수준으로
충족 — 더 강한 시각적 계층은 "있으면 좋음" 수준의 개선 여지).

**Q16. 불필요한 UI 요소가 존재하는가(중복 정보, 불필요한 배지 등)?** [불필요한 UI 요소
존재 여부]
Builder가 스스로 지적한 대로, `allowance`가 없을 때 핵심 카드의 큰 "연차 발생일수" 숫자와
바로 아래 보조 정보 카드의 작은 "연차 발생일수" 숫자가 같은 값을 중복 표시한다. 사용일수를
입력하지 않은 가장 단순한 케이스(발생일수 = 미사용일수)에서 이 중복이 가장 두드러진다.
다만 Architect가 "allowance 유무와 무관하게 두 값(발생일수·미사용일수)은 항상 함께
계산되므로 항상 노출한다"고 의도적으로 설계한 것이고, 사용일수를 입력한 경우에는 보조
정보 카드가 (발생일수와 다른) 미사용일수라는 새 정보를 제공하므로 완전한 중복은 아니다.
"필수 1개" 배지, 샘플/초기화 버튼, ShareActions 등 다른 요소는 모두 목적이 분명해
불필요하다고 보기 어렵다.
→ **Low** (가장 단순한 입력 케이스에서만 발생하는 경미한 시각적 중복 — 구조를 바꾸지
않고도 보조 정보 카드에서 발생일수와 미사용일수가 같을 때 "동일" 표시를 생략하거나 두
값을 합치는 정도의 미세 조정으로 개선 가능하나, 시급성은 낮다).

### 발견 이슈 등급별 표

| 등급 | 이슈 | 근거 질문 |
|---|---|---|
| **High** | `OVER_2YEARS`(근속 2년 이상) 구간에서 "이미 사용한 연차일수" helpText("지금까지 사용한 연차일수")가 "입사 후 누적 총 사용일수"로 오독되기 쉽다 — 실제로는 "가장 최근 배치(그 해 신규 발생분) 안에서 사용한 일수"만 넣어야 정확한 결과가 나온다. 화면 어디에도 `accruedDays`가 누적이 아니라는 설명이 없어, 오입력 시 `usedMoreThanAccruedWarning`까지 함께 떠서 사용자가 잘못된 확신("계산기가 내 연차를 다 써버린 걸로 계산했다")을 가질 위험이 있다. | Q6 (+ Q8 연장) |
| Medium | "26일 → 15일 전환은 정상"이라는 설명(정책 고지 4번)은 존재하지만, 이 계산기의 핵심 혼란 포인트치고 다른 일반 고지 문구와 시각적으로 동일한 우선순위(불릿 목록)로만 노출된다 — 더 눈에 띄는 위치/스타일 권고. | Q5 |
| Low | "연차 산정 기준일" 라벨이 SPEC.md 원문 표현을 그대로 복사(docs/DESIGN_SYSTEM.md 원칙의 문언 위반이나 실사용 이해 장벽은 낮음). | Q1 |
| Low | "보조 정보" 2열 카드(`grid-cols-2`)에 반응형/폭 제약이 없어 이 사이트의 유사 패턴과 다르다(기능 결함은 아님, 데스크톱 미관·QA 재확인 권고). | Q12 |
| Low | 말일/윤년 2/29 입사자에 대한 계산 근거 화면상의 clamp 단서 부재(사이트 기존 관례와 동일 수준이라 필수는 아님). | Q11 |
| Low | `allowance` 없을 때 핵심 카드와 보조 정보 카드가 "연차 발생일수"를 중복 표시(Architect 의도된 설계, 가장 단순한 입력 케이스에서만 두드러짐). | Q16 |

### 최종 판정

**FAIL** (구체적 수정 필요 — High 1건).

docs/EVALUATION.md의 PASS 기준("Critical 0, High 0")에 따라, Q6에서 확인한 **"이미 사용한
연차일수" 입력 범위(scope) 불명확** 1건이 High로 남아 있는 한 이번 라운드는 PASS로 보고할
수 없다. 이 항목은 계산 공식 자체의 오류(Calculation Auditor 영역)가 아니라 **입력 helpText가
실제 계산 정의(FORMULA.md "현재 유효 연차 풀")를 정확히 전달하지 못해, 근속 2년 이상(가장
흔한 사용자층)에게 잘못된 입력 → 잘못된 최종 금액이라는 신뢰 결과로 이어질 수 있는 UX
결함**이다.

Optimizer에게 요청하는 구체적 수정 항목(코드 수정 없이 문구만으로 해결 가능, 계산 로직 변경
불필요):
1. `usedDays` helpText를 "지금까지 사용한 연차일수"에서 "이번에 새로 발생한 연차 중 사용한
   일수"처럼, `accruedDays`가 가리키는 "가장 최근 배치" 범위로 한정하는 표현으로 조정한다.
   구간마다 문구를 분기해도 되고(예: `OVER_2YEARS`에서만 "올해분 중"을 명시), 세 구간에 모두
   자연스러운 공통 표현을 찾아도 된다.
2. 위 helpText 조정과 함께(또는 대신), 결과 화면에 "이 발생일수는 지금까지 쌓인 연차를
   모두 더한 값이 아니라, 소멸시효를 감안했을 때 지금 시점에 유효한 것으로 볼 수 있는
   가장 최근 발생분만 나타냅니다" 같은 한 문장을 추가한다 — 이는 Calculation Auditor가
   이미 Medium으로 권고한 항목과 동일한 문구 추가로 두 이슈를 한 번에 해소할 수 있다.
3. (권고, 차단 아님) 정책 고지 4번("26일→15일 전환은 정상")을 다른 4개 일반 고지와 시각적으로
   구분되는 위치/스타일(예: 계산 근거 2단계 바로 아래 인라인 안내)로 옮기거나 강조한다.

위 1·2번(둘 중 하나 이상, 가능하면 둘 다)을 반영한 뒤 재검증을 요청한다. 3번은 Medium 권고
사항으로 이번 FAIL의 직접 사유는 아니다.

## Optimizer

2026-09-14, UX/UI Critic 보고서의 FAIL 사유(High 1건)와 권고(Medium 1건, Low 4건)를 문구·카피
수준에서만 수정했다. `logic.ts`/`date-utils.ts`/반올림·절사 로직은 전혀 건드리지 않았다(수정
파일: `content.ts`, `formatting.ts`, `ui.tsx` 3개뿐).

### [필수] High 1건 — "이미 사용한 연차일수" 입력 범위 불명확 (Q6)

1. `ui.tsx`의 `usedDays` helpText를 "지금까지 사용한 연차일수를 입력하면..."에서 "발생일수는
   가장 최근 발생한 연차만 기준으로 계산합니다(과거 발생분은 1년 내 미사용 시 소멸한 것으로
   간주). 사용일수도 입사 후 누적 총 사용일수가 아니라 이 최근 발생분 중 사용한 일수를
   입력하세요..."로 교체했다. 특정 구간만 분기하지 않고(제출 전에는 `continuousServiceRegime`을
   알 수 없으므로) 세 구간 모두에서 자연스럽게 읽히는 공통 표현을 썼다 — `UNDER_1YEAR`(월 단위
   누적, 아직 아무 배치도 소멸하지 않아 "가장 최근 발생분"="지금까지 발생분 전체"와 사실상
   같음)·`YEAR_1_TO_2`(26일 고정)·`OVER_2YEARS`(그 해 신규 배치만) 세 경우 모두 "가장 최근
   발생분" 표현이 틀리지 않는지 재확인했다. `content.ts`의 `ANNUAL_LEAVE_USAGE_STEPS` 2번째
   단계 설명도 동일 취지로 맞춰 고쳤다(사이트 내 동일 개념 통일 — Q3 기준).
2. `content.ts`의 `ANNUAL_LEAVE_POLICY_NOTICES`에 새 항목(현재 배열의 2번째 항목)을 추가해
   "이 계산기의 발생일수는 누적 총량이 아니라 근로기준법 제60조⑦(1년 미행사 시 소멸)에 따라
   가장 최근 발생분만 나타내며, 다른 계산기의 '누적 연차'와 다를 수 있다"는 점과 "이미 사용한
   연차일수도 이 최근 발생분 기준으로 입력해야 한다"는 점을 함께 고지했다. 이는 Calculation
   Auditor가 이미 Medium으로 권고한 "누적 총합 vs 현재 유효 배치" 문구 보강과 동일한 문장으로
   두 이슈를 한 번에 해소한다. 새로운 법적 주장을 추가하지 않았다 — FORMULA.md/SPEC.md가 이미
   정의한 개념을 결과 화면 문구로 옮긴 것이다.
3. `formatting.ts`의 `USED_MORE_THAN_ACCRUED_WARNING_TEXT`에 "발생일수는 입사 후 누적 총
   사용일수가 아니라 가장 최근 발생분 기준이니, 혹시 누적 사용일수를 입력하지 않았는지
   확인해보세요"를 덧붙였다 — 근속 2년 이상 사용자가 실수로 누적치를 입력해 이 경고를 보게
   됐을 때 원인을 스스로 짚어볼 수 있게 했다. 이 상수는 `ui.tsx`가 그대로 렌더링하므로 별도
   UI 변경이 필요 없었다.

### [권장] Medium 1건 — 26→15 전환 설명의 시각적 우선순위 (Q5)

`content.ts`에 `ANNUAL_LEAVE_YEAR_TRANSITION_HIGHLIGHT`(정책 고지 4번과 같은 취지의 짧은
문장)를 새로 추가하고, `ui.tsx`의 "계산 근거" 2단계(발생일수 산출) `<li>` 안에
`result.continuousServiceRegime === "OVER_2YEARS" && result.completedYears <= 3`일 때만
`border-primary/20 bg-primary-soft text-primary` 강조 박스로 노출했다(기존 `bg-primary-soft`/
`text-primary` 토큰만 재사용, 새 색상 추가 없음). 근속 2~3년차(최근에 26일 구간을 지나왔을
가능성이 높은 경계)에서만 노출해 다른 근속 구간에는 영향이 없다. 기존 정책 고지 4번 문구는
그대로 유지해 항상 노출되는 일반 고지 역할을 계속한다(중복이지만 위치·강조 수준이 달라 서로
보완적).

### [선택] Low 4건

1. **라벨("연차 산정 기준일") SPEC.md 복사** — 수정하지 않았다. Critic 스스로 "대체할 더 쉬운
   표현이 마땅치 않다"고 밝혔고, 라벨을 바꾸면 `validation.ts`/`validation.test.ts`의 동일
   문구 오류 메시지까지 함께 바꿔야 해 이번 "순수 문구" 수정 범위(계산 로직 인접 파일 최소
   변경)를 벗어난다고 판단했다. 차단 사유가 아니므로 다음 라운드에서 재검토 가능하다.
2. **보조 정보 카드 반응형 폭 제약** — `ui.tsx`의 보조 정보 `<section>`에 `max-w-md`를
   추가했다(`bmr-calculator`/`housing-acquisition-tax`가 쓰는 `max-w-md grid-cols-2` 패턴과
   동일). 데스크톱에서 카드 두 개가 불필요하게 넓게 늘어나던 문제를 해소했다.
3. **말일/윤년 2/29 입사 안내** — `ui.tsx`의 `hireDate` 입력에 helpText("말일(29~31일)이나
   2월 29일에 입사한 경우에도 매달/매년 마지막 날을 기준으로 자동 계산됩니다")를 새로
   추가했다(이전에는 이 필드에 helpText 자체가 없었다). `aria-describedby`를 `referenceDate`
   필드와 동일한 패턴으로 연결했다.
4. **핵심 카드·보조 정보 카드의 발생일수 중복 표시** — Architect가 명시적으로 "allowance
   유무와 무관하게 두 값은 항상 노출"이라고 정한 구조 자체는 바꾸지 않았다(Optimizer가
   Architect 설계를 임의로 뒤집지 않음, Critic도 "구조를 바꾸지 않고" 수정할 것을 권고).
   대신 `allowance`가 없을 때(핵심 카드가 이미 같은 값을 크게 보여줄 때)만 보조 정보의 "연차
   발생일수" 카드 아래에 "위 핵심 결과와 같은 값입니다"라는 짧은 안내를 추가해, 의도치 않은
   버그처럼 보이던 중복을 "의도된 요약"으로 명확히 구분했다.

### 검증

- `npx tsc --noEmit` — 오류 없음.
- `npx vitest run src/calculators/annual-leave-allowance` — 4개 파일 90개 테스트 전부 통과
  (Golden Test 기대값 변경 없음 — `logic.ts`/`date-utils.ts`를 건드리지 않았으므로 당연한
  결과이나 직접 재실행해 재확인했다).
- `npx vitest run`(전체) — 86개 파일 1,199개 테스트 전부 통과(회귀 없음, Builder/Calculation
  Auditor가 확인한 수치와 정확히 일치).
- `npm run build`(Next.js 16, Turbopack) — 성공.
- `npx eslint src/calculators/annual-leave-allowance src/calculators/registry.ts
  src/calculators/calculator-components.ts "app/calculators/[slug]/page.tsx"` — 오류·경고
  0건.

### 수정 파일

- `src/calculators/annual-leave-allowance/content.ts` — 정책 고지 신규 1건 추가,
  `ANNUAL_LEAVE_YEAR_TRANSITION_HIGHLIGHT` 신규 export, `ANNUAL_LEAVE_USAGE_STEPS` 2번째
  단계 설명 문구 조정.
- `src/calculators/annual-leave-allowance/formatting.ts` — `USED_MORE_THAN_ACCRUED_WARNING_TEXT`
  문구에 힌트 문장 추가.
- `src/calculators/annual-leave-allowance/ui.tsx` — `usedDays`/`hireDate` helpText 교체·추가,
  보조 정보 섹션에 `max-w-md` 추가 및 발생일수 중복 안내 문구 추가, "계산 근거" 2단계에
  근속 2~3년차 전용 강조 박스 추가, 신규 content export import.

다음 단계는 UX/UI Critic 재검증(2차 라운드) → QA다. Optimizer는 재검증을 직접 수행하지
않는다.

## UX/UI Critic (재검증)

2026-09-14, 2차 라운드. Edit 권한 없이 소스 코드를 읽기만 하는 방식으로 재검증했다. 읽은
문서·코드: 위 "## UX/UI Critic"(1차 판정, High 1건/Medium 1건/Low 4건)과 "## Optimizer"(수정
내역) 전체, 그리고 실제 코드 `src/calculators/annual-leave-allowance/{ui.tsx,content.ts,
formatting.ts,validation.ts,types.ts,logic.ts,date-utils.ts}` 전체를 처음부터 다시 읽었다.
1차 라운드와 달리 이번에는 "Optimizer가 보고한 수정이 실제 코드에 존재하는가"와 "그 수정이
새 문제를 만들지 않는가"를 코드 대조로 직접 확인하는 데 집중했다.

### 자체 평가 질문 (평가 항목 매핑 포함, 재검증 기준)

1차 라운드와 동일한 7개 평가 항목을 모두 커버하도록 12개 질문을 다시 만들었다(요구된 최소
10개 초과, 필수 질문 4개 포함). Q1~Q4는 필수 질문이며, Q5~Q7은 1차 FAIL·Medium 사유의 해소
여부를, Q8~Q12는 회귀(새 문제) 여부와 나머지 평가 항목을 확인한다.

**Q1. [필수] `ui.tsx`의 입력 라벨을 FORMULA.md/SPEC.md 원문과 다시 대조 — 이번 수정이 법령·
전문 용어를 라벨에 새로 끌어들이지 않았는가?** [입력 라벨 표현]
`ui.tsx` 251~361행을 다시 읽었다. 라벨 4개("입사일"/"연차 산정 기준일"/"이미 사용한
연차일수"/"1일 통상임금")는 1차 라운드와 완전히 동일하며 Optimizer가 라벨 자체를 건드리지
않았다(수정 파일 목록에도 라벨 텍스트 변경이 없다고 명시돼 있고, 코드로도 확인했다).
`usedDays` helpText가 길어지면서 "근로기준법 제60조⑦" 같은 조문 번호는 여전히 helpText가
아니라 `content.ts`의 정책 고지에만 등장한다(helpText 자체는 "발생일수는 가장 최근 발생한
연차만 기준으로 계산합니다..."처럼 조문 번호 없이 일상어로 풀어 썼다) — 라벨/helpText 모두
법령 용어를 새로 끌어들이지 않았다.
→ **문제없음** (1차 라운드의 Q1 Low 이슈 — "연차 산정 기준일" SPEC.md 복사 — 는 Optimizer가
"차단 사유 아님"으로 의도적으로 보류한 항목이라 그대로 남아 있다. 아래 "잔존 이슈"에 재기록).

**Q2. [필수] 입력 순서·그룹핑이 이번 수정으로 흐트러지지 않았는가?** [입력 라벨·순서·그룹핑]
`ui.tsx`의 필드 순서(입사일 → 연차 산정 기준일 → 사용일수 → 1일 통상임금)와 그룹 구조(날짜
2개 `grid sm:grid-cols-2` 한 그룹 + `border-t` 아래 사용일수·통상임금 그룹)는 코드상 1차
라운드와 완전히 동일하다. Optimizer는 helpText 문자열만 교체·추가했을 뿐 DOM 구조·순서를
바꾸지 않았다(코드 대조로 확인 — `<div className="grid gap-5 sm:grid-cols-2">`와
`<div className="grid gap-5 border-t border-border pt-6 sm:grid-cols-2">` 두 그룹 모두 위치
그대로).
→ **문제없음.**

**Q3. [필수] "가장 최근 발생분" 개념이 helpText·정책 고지·경고 문구 세 곳에서 동일 용어로
통일됐는가?** [결과 가독성 / 입력 라벨 — 이번 수정의 핵심 성공 기준]
`usedDays` helpText("가장 최근 발생한 연차만 기준", "이 최근 발생분 중 사용한 일수"),
`ANNUAL_LEAVE_POLICY_NOTICES[1]`("가장 최근 발생분만 나타냅니다", "이 최근 발생분 중 사용한
일수를 입력해야"), `USED_MORE_THAN_ACCRUED_WARNING_TEXT`("가장 최근 발생분 기준이니") —
세 곳 모두 "가장 최근 발생분"이라는 동일한 핵심 어구를 그대로 재사용한다(코드에서 문자열
직접 대조 확인). `ANNUAL_LEAVE_USAGE_STEPS[1]`도 "가장 최근에 발생한 연차 중... 입사 후
누적 총 사용일수가 아닙니다"로 같은 개념을 같은 방향으로 설명한다.
→ **문제없음** (오히려 1차 라운드보다 용어 통일성이 강화됐다 — 4개 지점이 하나의 어구를
공유).

**Q4. [필수] 이번 수정이 입력 필드 수를 늘리지 않았는가(문구만으로 해결했는가)?** [입력 라벨
/ 일반 사용자 사용성]
`types.ts`/`validation.ts`의 입력 필드 정의(`hireDate`/`referenceDate`/`usedDays`/
`ordinaryDailyWage` 4개)는 완전히 그대로다(코드로 확인, Optimizer가 이 두 파일을 수정 파일
목록에서 제외한 것과 일치). 새 필드·새 입력 없이 helpText·정책 고지·경고 문구 3곳의 텍스트
수정만으로 High 이슈를 해소했다 — Optimizer 보고서의 "문구·카피 수준에서만 수정" 주장이
사실과 일치한다.
→ **문제없음.**

**Q5. [High 해소 확인] `usedDays` helpText가 `UNDER_1YEAR`/`YEAR_1_TO_2`/`OVER_2YEARS` 세
구간 모두에서 자연스럽고 정확하게 읽히는가?** [일반 사용자가 계산법을 몰라도 사용 가능한지 /
계산 근거 이해 — 이번 재검증의 핵심 질문]
`ui.tsx` 322~327행의 실제 helpText: "발생일수는 가장 최근 발생한 연차만 기준으로
계산합니다(과거 발생분은 1년 내 미사용 시 소멸한 것으로 간주). 사용일수도 입사 후 누적 총
사용일수가 아니라 이 최근 발생분 중 사용한 일수를 입력하세요. 모르면 비워두세요(전부
미사용으로 계산). 반차 등 0.5일 단위도 입력할 수 있습니다."
- `OVER_2YEARS`(1차 FAIL의 원인 구간): `accruedDays`가 정확히 "가장 최근 발생분"(그 해
  신규 배치) 하나만 가리키는 구간이라 이 문장이 **가장 정확하게** 들어맞는다. 1차 라운드가
  지적한 "5년 근속자가 누적 60일을 입력해 unusedDays=0이 되는" 시나리오를 helpText가 직접
  예방한다 — High 이슈는 실질적으로 해소됐다고 판단한다.
- `YEAR_1_TO_2`(26일 고정): 이 구간의 `accruedDays`=26은 실제로는 "가장 최근 발생분 하나"가
  아니라 두 법정 배치(1년 미만 누적 최대 11일 + 1년 시점 15일)의 **합**이다. "가장 최근
  발생한 연차만 기준"이라는 문구를 극도로 문자 그대로 읽으면 "26일 중 가장 최근 것(15일)만
  기준"으로 오독될 여지가 이론적으로 존재한다. 다만 실제 위해 여부를 따져보면: 이 구간에서
  "발생일로부터 1년 경과로 소멸"한 배치는 아직 하나도 없으므로(Calculation Auditor "3."의
  분석 — 1~11개월 배치의 최초 만료는 입사 13개월째부터), "이 최근 발생분 중 사용한 일수"와
  "입사 후 지금까지 사용한 일수"가 **이 구간에서는 항상 같은 값**이다. 즉 사용자가 어느
  쪽으로 해석하든 올바른 값(=입사 후 총 사용일수)을 입력하게 되므로, 문구의 문자적 부정확함이
  실제 오입력으로 이어지지 않는다.
- `UNDER_1YEAR`(월 단위 누적, 최대 11일): 같은 논리로, 이 구간에서도 아직 소멸한 배치가
  없으므로 "가장 최근 발생분"="입사 후 누적 발생분 전체"가 항상 성립한다. 사용자가 "이번
  달에 받은 1일 중 사용분"처럼 지나치게 좁게 해석할 여지가 문구상 완전히 없다고는 할 수
  없으나, `usedDays`가 애초에 작은 값(최대 11)이고 helpText 세 번째 문장("모르면
  비워두세요")이 안전망 역할을 하므로 실질적 위해 가능성은 낮다.
→ **Low** (문구가 세 구간 모두에 100% 문자 그대로 들어맞지는 않지만 — `YEAR_1_TO_2`/
`UNDER_1YEAR`에서는 "가장 최근 발생분"이 우연이 아니라 이 두 구간의 소멸시효 구조상 항상
"누적 발생분 전체"와 동일하기 때문에 실제 오입력으로 이어지지 않는다 — 애초 High였던
`OVER_2YEARS`의 실질적 위험은 확실히 해소됐다. 남은 것은 표현의 엄밀성 문제이지 기능적 위해가
아니므로 Low로 하향한다. Optimizer가 이미 "세 구간 모두에서 자연스러운지 재확인했다"고
기록했고, 실제로 세 구간 모두에서 사용자가 잘못된 값을 입력하게 되는 경로는 없음을 직접
검증했다).

**Q6. [High 해소 확인] `content.ts`의 새 정책 고지(누적 총량 아님)가 실제 렌더링 경로에
포함되는가?** [계산 근거 이해 / 결과 가독성]
`content.ts` 22~29행의 `ANNUAL_LEAVE_POLICY_NOTICES` 배열(6개 항목, 인덱스 1이 신규)이
`ui.tsx` 509~518행의 "정책 고지" `SectionCard`에서 `ANNUAL_LEAVE_POLICY_NOTICES.map(...)`로
그대로 `<li>` 순회 렌더링됨을 코드로 확인했다 — 배열에 값을 추가하기만 하면 자동으로 화면에
반영되는 구조라 "추가는 했는데 안 그려지는" 누락 가능성 자체가 구조적으로 없다.
→ **문제없음.**

**Q7. [Medium 해소 확인] `ANNUAL_LEAVE_YEAR_TRANSITION_HIGHLIGHT`가 정확히
`OVER_2YEARS && completedYears<=3`에서만 강조되는가? 이 조건이 부자연스러운 사각지대를
만들지 않는가?** [결과 가독성 / 계산 근거 이해]
`ui.tsx` 481~485행: `{result.continuousServiceRegime === "OVER_2YEARS" && result.completedYears
<= 3 && (...)}` — 보고된 조건과 코드가 정확히 일치한다. `determineContinuousServiceRegime`
(logic.ts 77~85행)를 보면 `OVER_2YEARS`는 `completedYears>=2`일 때만 진입하므로, 이 강조는
실질적으로 `completedYears ∈ {2, 3}`에서만 노출된다. 근속 4년차(`completedYears=4`,
`yearlyGrant(4)=16`, 3년차와 같은 값)부터는 강조가 사라지는데, 이는 "26일 구간을 막 지나온
사용자"에게만 좁게 타겟팅하려는 의도된 설계이고, 사용자는 한 시점에 자신의 결과 하나만 보므로
"3년차엔 있는데 4년차엔 없네?"처럼 두 값을 나란히 비교할 상황 자체가 발생하지 않는다(단일
세션 안에서 근속연수가 바뀌지 않음). 강조 박스 렌더링 위치도 "발생일수 산출" 2단계 바로
아래에 있어(코드 순서 확인), 방금 본 breakdown 숫자(예: "근속 2년차 → ... = 15일")와 바로
연결된다.
→ **문제없음** (조건·위치 모두 코드와 설계 의도가 정확히 일치, 어색한 사각지대 없음).

**Q8. [Low 해소 확인] 보조 정보 카드에 `max-w-md`가 실제로 추가됐고 다른 레이아웃을
깨뜨리지 않는가?** [모바일 사용성]
`ui.tsx` 434행: `<section className="grid max-w-md grid-cols-2 gap-3">` — 1차 라운드가
지적한 `max-w-*` 부재가 해소됐다(`bmr-calculator`/`housing-acquisition-tax`와 동일한
`max-w-md grid-cols-2` 패턴). 부모 컨테이너가 `<div aria-live="polite" className="mt-8
space-y-5">`(`398행`)이고 그 위·아래 형제 요소(핵심 카드, 경고 카드, SectionCard)는 모두
`max-w` 제약이 없는 전체 폭 요소이므로, 이 섹션에만 `max-w-md`가 붙어도 전체 레이아웃의
정렬(`space-y-5`가 세로 간격만 제어)이 깨지지 않는다. 640px 미만에서는 `grid-cols-2`가
그대로 유지되므로(반응형 breakpoint 변경 없음) 모바일에서는 시각적으로 1차 라운드와 동일하게
보인다 — 이번 수정은 데스크톱 전용 개선이며 모바일 레이아웃에 부작용이 없다.
→ **문제없음.**

**Q9. [Low 해소 확인] 입사일 helpText(말일/윤년 안내)가 실제로 추가됐고 `aria-describedby`
연결이 올바른가?** [오류 메시지의 이해 용이성 / 접근성 관점의 라벨링]
`ui.tsx` 267~270행: `<p id={`${formId}-hireDate-help`} className={HELP_CLASS}>말일(29~31일)이나
2월 29일에 입사한 경우에도 매달/매년 마지막 날을 기준으로 자동 계산됩니다.</p>` — 신규 추가가
확인된다. `aria-describedby={`${formId}-hireDate-help${errorFor("hireDate") ? ` ${formId}
-hireDate-error` : ""}`}`(264행)가 이 새 `id`를 정확히 참조하며, `referenceDate` 필드의
기존 패턴과 동일한 구조다(오류 발생 시 error id를 뒤에 추가로 붙이는 방식도 동일).
→ **문제없음.**

**Q10. [Low 해소 확인] 발생일수 중복 표시에 "위 핵심 결과와 같은 값입니다" 안내가 실제로
`allowance` 없을 때만 조건부로 표시되는가?** [불필요한 UI 요소 존재 여부 / 결과 가독성]
`ui.tsx` 438~440행: `{!result.allowance && (<p className="mt-0.5 text-xs text-muted">위 핵심
결과와 같은 값입니다.</p>)}` — `allowance`가 있을 때(핵심 카드가 "미사용 연차수당" 금액을
보여줄 때)는 이 안내가 나타나지 않고, 보조 정보의 "연차 발생일수"가 핵심 카드와 다른 새로운
보조 정보 역할을 그대로 유지한다. `allowance`가 없을 때만(핵심 카드가 이미 같은
"연차 발생일수" 값을 크게 보여줄 때) 짧은 안내가 붙어 "이건 오류로 두 번 나온 게 아니라
의도된 요약"임을 알려준다 — 조건 분기가 정확히 Optimizer 보고와 일치한다.
→ **문제없음.**

**Q11. [회귀 확인] Optimizer가 `logic.ts`/`date-utils.ts`를 건드리지 않았다는 주장이
사실인가?** [계산 정확성과 UX의 경계 확인 — Critic 권한 밖이지만 "새 문제를 만들지 않았는가"
확인 차원에서 코드를 직접 대조]
`date-utils.ts`(89줄) 전체를 다시 읽었다 — `monthAnniversary`/`yearAnniversary`/
`completedMonths`/`completedYears` 4개 함수의 구현이 Calculation Auditor가 검증한 시점의
설명(`lastDayOfMonthUtc`만 import, 원본 `hire` 기준 독립 계산, `COMPLETED_YEARS_SAFE_UPPER_
BOUND=150`)과 한 글자도 다르지 않게 일치한다. `logic.ts`(268줄) 전체도 다시 읽었다 —
5개 하위 함수 + 오케스트레이터 구조, 법정 상수(`UNDER_ONE_YEAR_MAX_DAYS=11`,
`FIRST_YEAR_GRANT_DAYS=15`, `YEAR_1_TO_2_ACCRUED_DAYS=26`, `MAX_ACCRUED_DAYS=25`,
`ACCRUAL_INTERVAL_YEARS=2`), `calculateAccruedDays`/`calculateUnusedDays`/`calculateAllowance`/
`calculateMinimumWageReference`의 계산식이 Builder/Calculation Auditor 절이 기록한 내용과
정확히 일치한다. `validation.ts`/`types.ts`도 전체를 다시 읽어 필드 정의·상수(`MIN_ALLOWED_
DATE`/`MAX_USED_DAYS`/`MAX_ORDINARY_DAILY_WAGE`)·오류 메시지가 그대로임을 확인했다.
→ **문제없음** (Optimizer의 "계산 로직 무변경" 주장은 사실이다).

**Q12. [신규 확인] 이번 수정으로 텍스트 분량이 늘면서 helpText/정책 고지가 지나치게 길어져
새로운 가독성 문제를 만들지 않았는가?** [결과 가독성 / 불필요한 UI 요소 존재 여부]
`usedDays` helpText가 4문장으로 늘었고(약 95자), `ANNUAL_LEAVE_POLICY_NOTICES[1]`도 약 160자
로 6개 정책 고지 중 가장 길다. 다만 이 사이트의 기존 관례와 대조하면 새로운 이탈이 아니다 —
`severance-pay/ui.tsx`의 `FIELDS` 배열 중 "3개월 임금총액" 필드 helpText(약 120자, 상여금
이중계산 방지 설명)가 이미 이보다 길거나 비슷한 밀도로 존재한다(코드 직접 확인). 정책 고지는
`text-muted` 스타일의 보조 정보 영역이라 핵심 결과·계산 근거를 밀어내지 않으며, 폼 helpText도
입력 필드 바로 아래 고정 위치에 줄바꿈되어 표시될 뿐 레이아웃을 깨지 않는다(코드에
`truncate`/고정 높이 없음 확인).
→ **Low** (사이트 기존 관례 수준의 길이지만, 이 계산기의 helpText 4개 중 `usedDays` 하나만
유독 문장 수가 많아(4문장) 다른 3개 helpText(1~2문장)와 밀도 차이가 눈에 띈다 — 시급성 낮은
개선 여지로만 기록, 차단 사유 아님).

### 재검증 결과 요약

| 항목 | 1차 판정 | 재검증 결과 | 근거 |
|---|---|---|---|
| High: `usedDays` helpText 범위 불명확 (Q6, 1차) | High | **해소 — Low로 하향** | Q5: `OVER_2YEARS`(원인 구간)의 실질적 오입력 위험은 helpText 교체로 확실히 제거됨. `YEAR_1_TO_2`/`UNDER_1YEAR`는 문구가 100% 엄밀하진 않으나 두 구간 모두 "가장 최근 발생분"="누적 발생분 전체"가 항상 성립해 실제 오입력으로 이어지지 않음(기능적 위해 없음, 표현의 엄밀성 문제만 남음). |
| Medium: 26→15 전환 설명 시각적 우선순위 (Q5, 1차) | Medium | **해소** | Q7: `ANNUAL_LEAVE_YEAR_TRANSITION_HIGHLIGHT`가 정확히 `OVER_2YEARS && completedYears<=3`에서 "발생일수 산출" 단계 바로 아래 강조 박스로 노출됨을 코드로 확인. 조건에 어색한 사각지대 없음. |
| Low: "연차 산정 기준일" 라벨 SPEC.md 복사 (Q1, 1차) | Low | **의도적 보류(그대로 존재)** | Q1: Optimizer가 "차단 사유 아님"으로 명시적으로 보류. 재검증에서도 실사용 장벽이 낮다는 1차 평가에 변화 없음. |
| Low: 보조 정보 카드 폭 제약 없음 (Q12, 1차) | Low | **해소** | Q8: `max-w-md` 추가 확인, 부작용 없음. |
| Low: 말일/윤년 clamp 안내 부재 (Q11, 1차) | Low | **해소** | Q9: `hireDate` helpText 추가, `aria-describedby` 연결 정상. |
| Low: 발생일수 중복 표시 (Q16, 1차) | Low | **해소** | Q10: `!result.allowance` 조건부 "위 핵심 결과와 같은 값입니다" 안내 추가 확인. |
| (신규) `usedDays` helpText 문장 밀도 불균형 | — | **신규 Low** | Q12: 다른 helpText 대비 문장 수가 많으나 사이트 기존 관례(severance-pay) 범위 안, 차단 사유 아님. |

### 발견 이슈 등급별 표 (재검증 후 잔존)

| 등급 | 이슈 | 근거 질문 |
|---|---|---|
| Low | `usedDays` helpText의 "가장 최근 발생한 연차만 기준"이라는 표현이 `YEAR_1_TO_2`/`UNDER_1YEAR` 구간에서는 문자 그대로 정확하지 않다(두 구간 모두 "가장 최근 발생분"="누적 발생분 전체"가 항상 성립해 실제 오입력으로 이어지지는 않음 — 표현의 엄밀성 문제). | Q5 |
| Low | "연차 산정 기준일" 라벨이 SPEC.md 원문 표현을 그대로 복사(1차 라운드에서 이미 확인, Optimizer가 의도적으로 보류). | Q1 |
| Low | `usedDays` helpText가 4문장으로 다른 3개 helpText(1~2문장)보다 유독 길어 밀도 차이가 있다(사이트 기존 관례 범위 안). | Q12 |

Critical 0건, High 0건, Medium 0건 — 잔존 이슈는 모두 Low이며 어느 것도 차단 사유가 아니다.

### 최종 판정

**PASS.**

docs/EVALUATION.md의 PASS 기준("Critical 0, High 0")을 충족한다. 1차 라운드의 FAIL 사유였던
High 1건(Q6, `usedDays` helpText 범위 불명확)은 Optimizer의 helpText 교체로 실질적인 오입력
위험이 해소됐음을 코드 대조와 3구간(UNDER_1YEAR/YEAR_1_TO_2/OVER_2YEARS) 각각에 대한 재추론으로
확인했다. Medium 1건(Q5, 26→15 전환 강조)도 조건부 인라인 강조 박스가 보고된 그대로 정확히
구현됐음을 확인했다. Low 4건 중 3건은 해소됐고 1건("연차 산정 기준일" 라벨)은 Optimizer가
의도적으로 보류한 항목으로 이번 판정에 영향을 주지 않는다. 코드 대조 결과 `logic.ts`/
`date-utils.ts`/`validation.ts`/`types.ts`는 Optimizer 보고대로 전혀 변경되지 않았다(계산
로직 회귀 없음). 새로 발견한 Low 1건(helpText 문장 밀도 불균형)을 포함해 잔존 이슈는 모두
Low이며 차단 사유가 아니다.

다음 단계는 QA다.

---

## QA

**검증일 2026-09-14. 판정: PASS.** 상세 보고서는 `tasks/annual-leave-allowance/QA.md` 참고.
실행 중이던 dev 서버(D:\유틸\cal, 3000포트)를 재사용하고, 격리된 `--user-data-dir` 프로파일의
Chrome(CDP)으로 실제 브라우저 테스트를 진행했다(사용자 실제 브라우저·다른 프로젝트 dev 서버는
전혀 건드리지 않음, 세션 전용 프로파일 프로세스만 확인 후 종료). FORMULA.md 17개 골든 테스트
전부(12개 실제 UI 입력 재현 + 5개 vitest 교차 확인)가 화면 표시값과 일치했다 — 11개월차↔정확히
1년(26일 급증), 정확히 1년↔정확히 2년(26→15, Optimizer 강조 박스가 `OVER_2YEARS &&
completedYears<=3`에서만 정확히 노출됨을 확인), 21/22/23년차 25일 상한 동작, 사용일수 초과 경고,
부분 입력 시 핵심 카드 전환, 최저임금 참고 경고까지 전부 포함. Architect가 발견한 두 반례(월말
입사 2025-01-31→2025-02-28, 윤년 입사 2024-02-29→2025-02-28)도 실제 UI에서 올바른 clamp 값으로
재현됐다. Optimizer의 6개 수정사항(helpText, 정책 고지, `max-w-md`, 입사일 helpText, 중복표시
안내, 26→15 강조박스) 전부 실제 렌더링에서 확인. 입력 검증(동일일자, 오류 순서, 소수 0.5일,
음수, 0원/미입력 구분, 상한 초과, 먼 미래 기준일)이 명확한 오류 메시지와 올바른
`aria-invalid`/`aria-describedby`로 동작. 공유 URL 왕복 정상. 모바일 5개 뷰포트(320~1440px)
오버플로 0건. Console Error 0건, `tsc` 클린, 이 계산기 테스트 90/90 통과. 접근성 label/aria 실측
확인. severance-pay·weekly-holiday-allowance·housing-acquisition-tax 회귀 없음. 신규 발견
Critical/High/Medium 결함 **0건**, Low 1건(이 계산기와 무관한 사이트 전역 헤더의 기존 빈
`aria-live` 요소, 실질적 영향 없음).

---

## 점수 (오케스트레이터, 2026-09-14)

| 항목 | 배점 | 획득 | 근거 |
|---|---|---|---|
| 계산 정확성 | 35 | **34** | Calculation Auditor PASS(Critical/High/Medium 0). FORMULA.md 17개 예제를 독립 Python 재계산으로 전부 일치 확인, 근로기준법 제60조·제61조 원문을 casenote.kr로 직접 대조, 가산연차 공식(21년차 25일 상한)을 2개 독립 출처로 교차검증. 특히 고용노동부 근로조건 계산기·노동OK 연차계산기의 실제 클라이언트 JS를 curl로 받아 Node.js에서 직접 실행해 `yearlyGrant(N)` 수열 전체를 라이브 대조한 것은 이 프로젝트에서도 드문 수준의 검증이다. Architect가 발견한 날짜 유틸 반례(월말/윤년 clamp)도 Builder가 전용 구현으로 정확히 반영했음을 코드 읽기로 확인. 잔여 리스크(제60조③ 삭제의 정부 1차 출처 미열람, 월 단위 발생 시점의 행정해석 번호 미특정)는 전부 Low로 실질 영향 없어 −1. |
| 예외/경계값 처리 | 15 | **15** | 1년 미만 상한(11일), 1↔2년 전환(26→15), 가산 시작(3년차), 25일 상한(21/22/23년차), 사용일수 초과, 임금 미입력, 최저임금 미만, 입력 오류(기준일<입사일) 전부 코드·QA 실측 양쪽으로 확인. 월말·윤년 입사자를 위한 날짜 clamp 전용 구현까지 포함. |
| UX/사용 편의성 | 15 | **14** | UX/UI Critic 1차 FAIL(High 1건: usedDays 입력 범위 오해 유발) → Optimizer 수정 → 재검증 PASS(신규 Critical/High/Medium 0). "26→15 전환이 버그가 아니다"라는 이 계산기 고유의 설명 부담을 정책 고지·강조 박스·FAQ로 다층적으로 해소했다. 잔여 Low 3건(라벨의 법령 용어 그대로 사용 등 의도적 유보 포함)으로 −1. |
| 모바일/반응형 | 10 | **10** | QA가 CDP로 320/375/390/768/1440px 5개 뷰포트 실측, 4개 입력 필드·계산 근거 breakdown·강조 박스 전부 오버플로 없음 확인. |
| 접근성 | 5 | **5** | label 연결, aria-describedby/aria-invalid, FAQ aria-expanded/aria-controls/role=region 전부 실측 확인. |
| 성능/안정성 | 5 | **5** | Console Error 0건, 실패한 네트워크 요청 0건, `npx tsc --noEmit` 클린, 이 계산기 90/90 테스트 통과(전체 스위트 86파일/1199테스트). |
| 설명/계산 근거 | 5 | **5** | 근속구간 판정→발생일수 산출→미사용일수→수당금액까지 각 단계 실제 수식·숫자를 노출하고, 이 계산기의 가장 까다로운 지점(26→15 "감소")을 별도 강조 박스+FAQ+정책고지 3중으로 설명. |
| SEO/페이지 완성도 | 5 | **5** | registry 등록(`status: draft`→이번에 `published`로 전환), 카테고리 말머리 링크(`/categories/labor`), FAQPage JSON-LD 매핑, `app/calculators/[slug]/page.tsx` 배선 완료. |
| 코드 품질/유지보수성 | 5 | **5** | 기존 공용 날짜 유틸 재사용 시 발생하는 조용한 오류를 Architect가 사전에 발견해 전용 `date-utils.ts`로 분리한 설계, discriminated union으로 3구간을 명확히 표현, raw/display 분리 원칙 일관 적용. |
| **총점** | 100 | **98** | |

## 최종 판정

PASS 기준(docs/EVALUATION.md): 총점 92+, 계산정확성 33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0

| 기준 | 결과 |
|---|---|
| 총점 92+ | 98 ✅ |
| 계산 정확성 33/35+ | 34 ✅ |
| Critical 0 / High 0 | Auditor 최초 PASS(0) · UX Critic 1차 FAIL(High 1건) → Optimizer 수정 → 재검증 PASS(0) · QA PASS(0) ✅ |
| Golden Test 100% | 17/17(Auditor 독립 재계산 + 고용노동부/노동OK 실제 계산기 JS 라이브 대조) + 17/17(QA 실제 UI 재현) ✅ |
| Console Error 0 / TypeScript Error 0 | ✅ (실제 headless 브라우저 실측 포함) |
| Mobile Critical 0 | ✅ (실제 Chrome 5개 breakpoint 실측) |

**판정: PASS — registry.ts `status`를 `published`로 전환한다.**
개선 Loop 횟수: 1/5 (1차: UX/UI Critic의 High 1건(usedDays 입력 범위 오해) + Medium 1건 처리 — 재검증 PASS)

### 남은 후속 과제 (발행 비차단, 전부 Low 이하)
- 근로기준법 제60조③ 삭제(2018.5.29 시행)의 정부 1차 출처(개정이유서·관보)는 열람하지 못했다 — 다수의 독립적인 2차 출처(노무법인·HR 플랫폼)로 교차확인했으며, 이 삭제 자체의 존재와 효과는 casenote.kr 조문 원문("③ 삭제<2017. 11. 28.>")으로 1차 확인됐다.
- 1년 미만 구간의 월 단위 연차 발생 시점("다음날 발생")을 뒷받침하는 정식 고용노동부 행정해석 번호는 특정하지 못했다.
- "usedDays" helpText의 "가장 최근 발생한 연차만 기준"이라는 표현이 `UNDER_1YEAR`/`YEAR_1_TO_2` 구간에서는 문언상 완전히 엄밀하지 않다(다만 두 구간에서는 최근 발생분과 누적 발생분이 항상 같아 실질적 오입력 위험은 없다).
- "연차 산정 기준일" 라벨은 SPEC.md 원문 표현을 그대로 쓴다(Optimizer가 다른 필드와의 일관성을 이유로 의도적으로 보류, 위험도 Low).
- 다음 재검토 트리거: `PROGRESS.md`에 기록(2027-01-01 최저임금 참고 경고 갱신, 근로기준법 제60조/제61조 개정 시).
