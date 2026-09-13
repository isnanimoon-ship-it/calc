# EVALUATION: 청약가점 계산기

## Builder 구현 완료

2026-09-06, Builder가 승인된 SPEC.md / FORMULA.md / ARCHITECTURE.md를 그대로 구현했다.
아래는 구현 사실 기록이며 최종 정확성 판정이 아니다 — 최종 판정은 Calculation Auditor ·
UX/UI Critic · QA의 몫이다(.claude/agents/builder.md). `types.ts`와
`src/lib/date-calc.ts`의 `calendarFullYearsBetweenUtc`/`calendarFullMonthsBetweenUtc`는
Architect가 이미 작성·검증했으므로 그대로 재사용했고 새로 작성하지 않았다.

### 구현한 파일

- `src/calculators/housing-subscription-score/policy.ts` — 신규.
  `HOUSING_SUBSCRIPTION_SCORE_POLICY` 상수(무주택기간 32점/2점씩, 부양가족수 35점/기본
  5점·인당 5점·상한 6명, 청약통장 가입기간 17점/6개월미만 1점·1년미만 2점·1년 이후
  `floor(개월/12)+2`). 값은 FORMULA.md "배점표 (검증 결과)"/"기준 / 출처" 절에서 그대로
  옮겼고 "확인 필요"로 남은 조문 번호·시행일 등은 그대로 문자열로 남겼다(추정 안 함).
  `HOUSING_SUBSCRIPTION_SCORE_OPEN_QUESTIONS`(확인 필요 항목 요약)도 함께 추가.
- `src/calculators/housing-subscription-score/logic.ts` — `calculateHousingSubscriptionScore`
  본문. FORMULA.md "공식" 1~9단계 그대로: 만 30세/혼인신고일 기산일 산정 →
  현재 무주택 요건 판정 → 처분일 재기산(`max(candidate, disposalDate)`) →
  `homelessEligible`/연수 산출(`calendarFullYearsBetweenUtc`) → `min(32, 2*(years+1))` →
  부양가족수(`5 + 5*min(count,6)`) → 가입개월수(`calendarFullMonthsBetweenUtc`) →
  가입기간 점수(6개월/1년 분기 + `min(17, floor(months/12)+2)`) → 총점 합산. 매직 넘버
  없이 전부 `policy.ts` 상수만 참조. `homelessPeriodCapped`/`dependentCountCapped`/
  `subscriptionPeriodCapped`는 실제로 캡이 적용됐을 때만(입력값이 그대로 상한과 같으면
  false) true로 계산.
- `src/calculators/housing-subscription-score/validation.ts` — 신규.
  `validateHousingSubscriptionScoreInput`. `baseDate`(오늘+5년 이내, `birthDate` 이후),
  `birthDate`(1900-01-01 이후, `baseDate` 이전), 조건부 필수(`isMarried→marriageDate`,
  `housingStatus==='disposed'→mostRecentDisposalDate`,
  `hasSubscriptionAccount→subscriptionAccountOpenDate`), 각 조건부 날짜의
  `birthDate ≤ x ≤ baseDate` 논리 검증, `qualifyingAscendantCount`(0~4)/
  `qualifyingDescendantCount`(0~10) 정수·상한 검증. 조건부가 아닌 필드
  (`smallLowValueHomeException`, `hasQualifyingSpouseInHousehold`)는 조건 미해당 시
  `false`로 정규화해 반환.
- `src/calculators/housing-subscription-score/formatting.ts` — 신규.
  `buildHousingScoreBreakdown`(3행 — 무주택기간/부양가족수/가입기간, 실제 입력값을 대입한
  "라벨 = 값" 설명 문자열 + 근거 법령), `buildHomelessIneligibleWarnings`/
  `buildSubscriptionNotRegisteredWarning`(항목별 경고 — ui.tsx가 해당 항목 카드 바로
  아래 배치할 수 있도록 항목별로 분리) + 이 둘을 합친 `buildHousingScoreWarnings`,
  `formatKoreanDate`/`formatShortDate`.
- `src/calculators/housing-subscription-score/content.ts` — 신규. 정책 특례 고지 3종
  (소형·저가주택 무주택 간주 특례, 배우자 청약통장 합산 특례, 미성년자 가입기간 상한 —
  FORMULA.md "알려진 정책 특례" 원문을 거의 그대로 옮김), 소개 문단, 사용 방법 4단계,
  FAQ 5개(`housingSubscriptionScoreFaqItems`).
- `src/calculators/housing-subscription-score/ui.tsx` — 신규. 입력 순서(기준일 → 무주택
  기간 그룹[생년월일 → 혼인 여부 → (조건부)혼인신고일 → 주택 소유 이력 → (조건부)최근
  처분일 → (조건부)소형·저가주택 특례 체크] → 부양가족 그룹[배우자 인정 → 직계존속 수 →
  직계비속 수] → 청약통장 그룹[보유 여부 → (조건부)최초 가입일]), 결과 화면(핵심 총점
  카드 → 항목별 카드 3개 그리드, 각 카드 바로 아래 조건부 경고 카드 → 계산 방법 →
  적용된 입력값 → 정책 안내[기준 배지 + 적용 범위 고지 + 정책 특례 3종 항상 노출]) →
  사용 방법/소개 → FAQ. `SectionCard`/`UsageGuide`/`IntroSection`/`FaqAccordion`/
  `ShareActions`/`useCalculatorShare` 재사용, 새 공용 컴포넌트는 만들지 않음.
  `aria-live="polite"` 결과 영역, 모든 입력에 `label`/`aria-describedby`/
  `aria-invalid` 연결.
- `src/calculators/housing-subscription-score/logic.test.ts` — 신규. FORMULA.md 검증
  예제 12개를 Golden Test로 그대로 옮김(예제 1~12 각각 주석에 번호 명시) + 총점 불변식
  (`0≤totalScore≤84`, `totalScore`=세 항목 합)과 항목별 상한 캡 불변식(극단 입력) +
  FORMULA.md "예외" 절 케이스(현재 소유 중, 두 사유 동시 성립, 미가입, 처분일 재기산,
  처분일이 기산일보다 이전이면 무영향, 30세 이후 혼인).
- `src/calculators/housing-subscription-score/validation.test.ts` — 신규. 정상 케이스,
  필수값 누락(조건부 포함), 날짜 형식/논리 오류(미래 날짜, 순서 오류, 하한 미달, 5년
  초과), 부양가족 수 검증(음수/소수/상한 초과/숫자 아님/6명 초과는 통과), 조건부 필드
  정규화(false로 강제).
- `src/calculators/housing-subscription-score/formatting.test.ts` — 신규. 날짜 포맷,
  breakdown 3행 순서·내용(요건 미충족/충족/캡 문구), 경고 문구(단독·동시 성립) 검증.
- `src/calculators/housing-subscription-score/ui.test.tsx` — 신규. 필수값 누락 오류,
  샘플(FORMULA 예제 12) 계산 후 총점·항목별 점수 표시, 조건부 필드 노출(혼인/처분/특례
  체크), 경고 카드 노출(무주택 요건 미충족, 청약통장 미가입), 정책 특례 고지 3종 상시
  노출.
- `src/calculators/registry.ts` — `housing-subscription-score` 등록. title="청약가점
  계산기", category="tax", icon="chart"(신규 키), status="draft".
- `src/calculators/calculator-components.ts` — `HousingSubscriptionScoreUi` import·매핑
  추가(`military-salary`/`four-major-insurance` 선례와 동일한 형태).
- `components/calculator/CalculatorCard.tsx` — `CalculatorIcon`에 `chart` SVG 분기 추가
  (오름차순 막대그래프, 기존 6개 키와 시각적으로 구분).

### 검증 결과 (Builder 실행 — 최종 판정 아님)

- `npx vitest run src/calculators/housing-subscription-score --no-file-parallelism` —
  4개 파일 71개 테스트 전부 통과(logic 24 + validation 26 + formatting 15 + ui 8 — 최초
  실행 시 ui.test.tsx의 DOM 셀렉터 2곳만 손봐서 전부 통과시킴, 계산 로직 자체는 첫 실행부터
  전부 통과).
- `npx tsc --noEmit` — 오류 0.
- `npx vitest run --no-file-parallelism`(전체 스위트) — **47개 파일 462개 테스트 전부
  통과**(신규 9개 제외 기존 43개 파일 전부 회귀 없음). `src/lib/date-calc.ts`에 함수를
  추가했지만 기존 함수는 건드리지 않았고, 이를 공유하는 severance-pay/unemployment-benefit
  의 `logic.test.ts`도 그대로 통과 확인.
- `npm run build`(next build, Turbopack) — 성공. TypeScript 통과, 정적 페이지 생성 정상.
  `registry.ts` status가 `draft`라 `/calculators/housing-subscription-score`는 SSG
  프리렌더 목록(`generateStaticParams`가 `getPublishedCalculators()` 기반)·sitemap에는
  나타나지 않지만, `calculator-components.ts`에 연결돼 있어 URL 직접 접근 시 기존
  unemployment-benefit draft 선례와 동일하게 렌더링된다.

### FORMULA/ARCHITECTURE 대비 Builder가 판단해야 했던 지점 (Auditor 확인 요청)

1. **`homelessStartDate` 출력값 채움 규칙**: types.ts 주석이 "만 30세/혼인신고일에 아직
   도달하지 않은 경우(`homelessEligible=false`이지만 현재는 무주택인 경우) 참고용으로
   채울지 null로 둘지 Builder가 결정한다"고 위임했다. `currentlyHomeless`(주택 미소유)가
   참이면 항상 계산된 기산일을 채우고(만 30세 미도달로 아직 eligible=false여도 "장차
   이 날부터 기산된다"는 참고 정보로 유용하다고 판단), `currently_owns`(현재 소유 중)일
   때만 null로 뒀다. 공식이나 점수 자체에는 영향 없다(0점 표시는 동일).
2. **경고 카드 배치**: ARCHITECTURE.md "6."이 "무주택기간 카드 바로 아래" "가입기간 카드
   바로 아래"라고 지시했는데, 항목별 카드가 3열 그리드라 완전히 독립된 전체 폭 카드로
   두면 "바로 아래"가 애매해진다. 각 항목 카드를 `space-y-3` 컬럼으로 감싸 그 컬럼 안에서
   카드 → (조건부) 경고 카드 순으로 쌓는 방식을 선택했다(그리드는 유지하면서 시각적으로
   해당 항목 바로 아래에 오도록). UX/UI Critic이 이 배치가 지시 의도와 맞는지 확인해
   주길 요청한다.
3. **부양가족 수 입력 상한**: FORMULA.md "입력값" 표가 "상식적 상한(예: 4)"/"(예: 10)"로
   예시만 제시해, `MAX_ASCENDANT_COUNT=4`/`MAX_DESCENDANT_COUNT=10`을 예시값 그대로
   채택했다(6명 초과 입력이 정상 동작이라는 FORMULA.md 문구와 충돌하지 않도록, 이 상한은
   점수 캡(6명)보다 훨씬 높게 잡아 배우자+직계존속+직계비속 합이 15명까지도 입력 자체는
   막지 않는다).
4. **`baseDate` 5년 상한 검사와 UI 기본값의 시간대差**: `validation.ts`의 "오늘+5년" 계산은
   `new Date()`(서버/브라우저 UTC 기준)를, `ui.tsx`의 기본 `baseDate`(오늘)는
   `Asia/Seoul` 기준(`age-calculator`/`bmi-calculator`/`military-salary` 기존 패턴)을
   쓴다. 자정 부근에 최대 하루 차이가 날 수 있으나 5년이라는 여유 범위 안에서는 실질적
   영향이 없다고 판단해 기존 계산기들의 관행을 그대로 따랐다(새로운 시간대 정합 로직을
   추가하지 않음).
5. **소개/사용법/FAQ 문구 신규 작성**: `content.ts`의 소개 문단·사용 방법·FAQ 5개는
   SPEC.md/FORMULA.md에 확정 원문이 없어(SPEC은 Should Have로만 요구) 이번에 새로
   작성했다. 정책 특례 3종 고지 문구만 FORMULA.md "알려진 정책 특례" 원문을 거의 그대로
   옮겼고, 나머지(소개/사용법/FAQ)는 SPEC/FORMULA에 있는 사실관계를 벗어나지 않는 선에서
   Builder가 새로 구성한 문장이다 — QA가 사실관계 오류 여부를 확인해 주길 요청한다.
6. **만 30세 되는 날 계산의 윤년 2월 29일 처리**: `logic.ts`의 `ageThirtyDate`는
   `Date.UTC(year+30, month, day)`를 그대로 써서 2월 29일생이 30년 뒤 평년을 맞으면
   JS 표준 정규화(3월 1일로 밀림)에 맡긴다. 이는 ARCHITECTURE.md "2."가 이미 "이 계산기는
   해당 엣지케이스가 SPEC/FORMULA에 요구되지 않는다"고 판단한 것을 그대로 따른 것이며,
   Builder가 새로 내린 판단은 아니다(참고로 재기재).

### 규모(FORMULA.md 검증 예제 12개 재확인)

12개 Golden Test 전부 `npx vitest run`에서 개별 `it`으로 통과 확인(예제 1·6·7·8·9·11의
"0점 아님/상한 캡" 경계 포함).

## Calculation Auditor

### 요약

구현은 FORMULA.md 공식 1~9단계와 정확히 일치하고, Golden Test 12개는 조작 없이 그대로
옮겨졌다. 독립 재계산(Bash/node 스크립트, FORMULA.md와 무관하게 직접 재구현)으로 여러
케이스를 재검증했고 전부 Builder 결과와 일치했다. FORMULA.md의 배점표(32/35/17=84)와
무주택기간 기산일 규칙은, Formula Analyst가 실패했던 law.go.kr 원문 대조를 **이번
세션에서 부분적으로 성공**시켜 1차 출처로 직접 확인했다(아래 "법령 원문 검증" 참고).
다만 실제 `logic.ts`에서 **재현 가능한 계산 버그 1건**(윤년 2월 29일 출생자의 "만 30세
되는 날" 산정)을 코드 실행으로 직접 확인했다 — Medium 등급으로 보고하며 FORMULA.md의
공식 1단계 의사코드가 이 경계 규칙을 명시하지 않은 "공식 명세 공백"에서 비롯된 것으로
판단해 Formula Analyst에게도 보완을 요청한다(Builder FAIL로 보지 않음).

### 1. 구현 ↔ FORMULA.md 일치 여부: **일치**

`logic.ts`를 FORMULA.md "공식" 절과 한 줄씩 대조했다.

| FORMULA.md 단계 | logic.ts 대응 | 일치 여부 |
|---|---|---|
| 1. `homelessStartCandidate = isMarried && marriageDate<ageStartDate ? marriageDate : ageStartDate` | 22~24행: `ageThirtyDate(birthDate)` 산출 후 동일 조건으로 `homelessStartCandidate` 산출 | 일치 |
| 2. 무주택 요건 판정 | `currentlyHomeless = input.housingStatus !== "currently_owns"` | 일치(`never_owned`/`disposed` 모두 true) |
| 3. `homelessStartDate = max(candidate, disposalDate)` | `disposalDate.getTime() > homelessStartCandidate.getTime() ? disposalDate : homelessStartCandidate` | 일치 |
| 4. `homelessEligible = baseDate>=candidate && currentlyHomeless` | 89~90행 동일 | 일치 |
| 5. `homelessPeriodScore = min(32, 2*(years+1))`, 미해당시 0 | 104~111행 `rawHomelessScore`/`Math.min` | 일치. `homelessPeriodCapped`는 "실제로 캡이 걸렸을 때만" true로 별도 계산 — FORMULA.md에 없는 필드지만 ARCHITECTURE.md "5."가 승인한 부가 필드이며 점수 산출식 자체를 바꾸지 않음 |
| 6. `dependentScore = 5 + 5*min(count,6)` | 113~122행 동일 | 일치 |
| 7. `subscriptionMonths`(미가입 시 -1) | 129~132행 `hasSubscriptionAccount` 분기, `calendarFullMonthsBetweenUtc` | 일치 |
| 8. 6개월/1년 분기 + `min(17, floor(months/12)+2)` | 134~149행 동일 분기 | 일치 |
| 9. `totalScore = 세 항목 합` | 155행 | 일치 |

`policy.ts` 상수(`perYearScore:2`, `baseScore:5`/`perDependentScore:5`/`capCount:6`,
`under6MonthsScore:1`/`under1YearScore:2`/`baseScoreAfter1Year:2`, 각 `maxScore`)도
FORMULA.md "배점표"/"기준·출처" 절 수치와 정확히 일치하며, `logic.ts`에 매직 넘버가
하드코딩된 곳은 없다(grep 확인, `32`/`35`/`17`/`6`/`5` 등 리터럴이 `policy.ts` 밖에서
쓰이지 않음).

**Golden Test 12개 대조**: `logic.test.ts`의 예제 1~12를 FORMULA.md "검증 예제" 절과
1:1로 대조했다. Input·중간값(연수/개월수)·Expected 점수 모두 FORMULA.md 원문과 정확히
같고, 값이 유리하게 조작된 흔적은 없다(오히려 예제 6·11처럼 "캡되어야 정답"인 케이스를
그대로 옮겨 상한 로직을 검증하고 있다).

**독립 재계산(Bash, `calendarFullYearsBetweenUtc`/`calendarFullMonthsBetweenUtc`를
FORMULA.md 의사코드만 보고 새로 짠 별도 스크립트로 재구현해 대조)**:
- 예제 3(30세 생일로부터 정확히 1년): 재구현 결과 `years=1` — Builder 결과(4점) 일치.
- 예제 12 무주택기간(2019-05-01→2026-09-06): 재구현 결과 `years=7` — Builder 결과(16점)
  일치.
- 예제 12 가입기간(2016-01-10→2026-09-06): 재구현 결과 `months=127` — Builder
  결과(12점) 일치.
- 예제 11(2006-01-01→2026-09-06): 재구현 결과 `months=248` — Builder 결과(17점,
  캡 적용) 일치.
- 예제 9 A/B(6개월 경계 전후 하루): 재구현 결과 A=5개월/B=6개월 — Builder 결과(1점/2점)
  일치.

세 항목 상한 합(32+35+17=84) 불변식, 상한 캡 불변식(부양가족 15명 입력해도 35점 등)도
`logic.test.ts`에 이미 있고 직접 재확인했다(`npx vitest run` 재실행, 85개 테스트 전부
통과 — 아래 "테스트 실행 재확인" 참고).

### 2. FORMULA.md ↔ 실제 근거 일치 여부: **대체로 일치, 법령 원문 부분 확보로 신뢰도 상향**

#### 2-1. law.go.kr 원문 재시도 결과 — **부분 성공**

Formula Analyst가 시도한 것과 다른 경로로 law.go.kr 원문 확보를 재시도했다:
- 직접 HTML 페이지 WebFetch(`lsInfoP.do`, `DRF/lawService.do` API 등 여러 URL 패턴) —
  Formula Analyst와 동일하게 실패(빈 페이지/네비게이션만 반환).
- **PDF 우회 경로가 성공했다**: WebSearch 결과 중 `daedeok.go.kr`(대덕구청 공식 공고문
  PDF)가 「주택공급에 관한 규칙」 조문 전체(2015.2.27. 시행, 국토교통부령 제186호,
  제1조~제35조)를 텍스트 그대로 담고 있었다. WebFetch가 이 PDF를 바이너리로만 받아
  요약에 실패했으나, 저장된 PDF 파일을 **Read 도구로 직접 열어(PDF 텍스트 추출)**
  전체 조문 원문을 확인했다 — Formula Analyst가 쓴 방법(WebFetch 요약)과 다른 방법(PDF
  직접 열람)으로 실제로 성공한 사례다.
- **확인된 원문(제11조제2항, 가점제 관련 국민주택 조항)**: "무주택기간은 입주자모집공고일
  현재 무주택세대구성원 전원이 주택을 소유하지 아니한 기간[무주택세대구성원 중
  주택공급신청자의 무주택기간은 **30세가 되는 날**(주택공급신청자가 30세가 되기 전에
  혼인한 경우에는 「가족관계의 등록 등에 관한 법률」에 따른 혼인관계증명서에
  **혼인신고일**로 등재된 날)부터 계속하여 무주택인 기간]으로 하되, 무주택세대구성원이
  주택을 소유한 사실이 있는 경우에는 **그 주택을 처분한 후 무주택자가 된 날(두 차례
  이상 주택을 소유한 사실이 있는 경우에는 최근에 무주택자가 된 날을 말한다)부터
  무주택기간을 산정한다**." — 이 문장은 FORMULA.md 공식 1~3단계(30세/혼인신고일 기산,
  처분일 재기산, 두 차례 이상이면 "최근" 처분일 기준)와 **표현 수준까지 정확히 일치**한다.
  또한 제2조제14호가 가점제를 "무주택기간·부양가족수·입주자저축 가입기간" 세 항목으로
  정의한 것도 FORMULA.md "목적" 절과 일치한다.
  - 단서: 확보한 판본이 2015.2.27. 시행본(제186호)이라 현행(2026년, 제1592호) 조번호와
    다를 수 있다(위 원문은 이 판본의 "제11조"에 있으나, FORMULA.md는 "제27조"로
    추정 인용했다 — 별도 WebSearch에서 casenote.kr도 "제27조제3항"이라 언급해, 조번호가
    수차례 개정으로 밀렸을 가능성이 높다). **조번호 자체는 여전히 "확인 필요"이나, 조문
    내용(기산일 규칙)은 오래 유지된 핵심 조항이라 실질적으로 변경되지 않았을 가능성이
    높다고 판단한다** — 이 조항이 민영주택 가점제(제12조/별표1)에도 준용되는지는 별표1
    원문을 직접 보지 못해 완전히 확정하지 못했다(별표1 자체는 이번에도 이미지/서식이라
    텍스트로 확보하지 못함).
- **결론**: FORMULA.md "무주택기간 기산일 규칙"은 2차 출처 교차검증뿐 아니라 **1차
  법령 원문(구버전이지만 동일 문구)으로도 확인**됐다 — Formula Analyst가 "확인 필요"로
  남긴 항목 중 이 부분의 신뢰도는 실질적으로 상향 조정할 수 있다.

#### 2-2. 배점표(32/35/17=84) 제3의 독립 출처 교차검증 — **일치, 단 1개 소스 불안정성 확인**

- HUG(khug.or.kr)의 구체적 하위 페이지(`hglg000020.jsp`)를 직접 WebFetch해 무주택기간
  표(1년 미만=2점 ~ 15년 이상=32점)와 부양가족수 표(0명=5점 ~ 6명 이상=35점) **전 구간을
  다시 받아 FORMULA.md와 완전히 일치함을 확인**했다(Formula Analyst가 인용한 것과 같은
  출처지만, 이번 세션에서 독립적으로 재접속·재확인).
- WebSearch 종합 결과(zippoom.com/jptcalc.kr 등 여러 민간 사이트가 섞인 요약)도 "통장
  2년=4점, 6년=8점, 15년 이상=17점(만점)"이라 확인해 FORMULA.md 표와 일치.
- **주의(신규 발견, "확인 필요" 추가 권고)**: 같은 HUG 페이지군 중 `hglg000019.jsp`를
  두 차례 다른 프롬프트로 WebFetch했더니 **서로 다른 청약통장 가입기간 표를 내놓았다**
  (1차: "8개월 이상~9개월 이하=18점" 등 명백히 말이 안 되는 값 — FORMULA.md가 이미
  경고한 nepla.ai 할루시네이션과 유사한 패턴, 채택 안 함. 2차: "6개월 이하=1점, 6개월
  초과~1년 이하=2점..." 형태로 숫자 자체는 FORMULA.md와 같으나 **구간 경계 표현이
  "이상~미만"이 아니라 "초과~이하"** — 이 경우 "정확히 6개월"이 1점 구간에 들어가
  FORMULA.md 예제 9-B(정확히 6개월=2점, Golden Test로 고정됨)와 충돌할 수 있다).
  같은 URL을 다른 프롬프트로 재요청했을 때 서로 다른 결과가 나온 것은 이 페이지 자체가
  WebFetch 요약 과정에서 불안정하게 파싱된다는 뜻이므로(FORMULA.md의 "사전 고지"가
  이미 이런 위험을 명시한 그대로), 이 "초과~이하" 표현을 신뢰도 있는 반증으로 채택하지
  않는다 — 다만 이 정확한 경계값(6개월/1년/2년.../15년 시작점)은 별표1 원문 이미지를
  직접 봐야 최종 확정되므로, **"청약통장 가입기간 각 구간의 정확한 경계 포함 여부
  (이상 vs 초과)"를 FORMULA.md "확인 필요 항목"에 추가할 것을 권고**한다(Critical은
  아님 — 표준 한국 법령 별표 관행과 무주택기간 표에서 확인된 "이상~미만" 패턴, 그리고
  Formula Analyst가 이미 이 경계를 의도적으로 Golden Test로 고정한 점을 근거로 현재
  구현이 맞을 개연성이 더 높다고 판단한다).

#### 2-3. 2026-06-15 시행 국토교통부령 제1592호 — **별표1(가점제) 미개정으로 판단, FORMULA.md 갱신 권고**

WebFetch로 이 개정의 개정이유 목록을 확보했다. 확인된 개정 내용은 "신생아 가구
특별공급 유형 신설", "지역균형발전 특별공급 추가", "해양수산부 이전기관 종사자 주택공급
조건 완화", "기관추천 특별공급위원회 설치 근거 마련" 4가지이며, 전부 **특별공급(제19조
계열) 관련 개정**이다. 별표1(가점제 산정기준표) 개정이라는 언급은 어디에도 없었다.
이는 FORMULA.md "확인 필요 항목 총정리" 6번("2026-06-15 시행 개정이 별표1을 개정했는지
여부")에 대한 실질적 답이다 — **별표1은 개정되지 않은 것으로 판단**한다(다만 개정문
원문 전체를 문장 단위로 대조하지는 못했으므로 100% 확정은 아니다). Formula Analyst에게
FORMULA.md의 이 항목을 "미개정으로 판단(2026-09-06 Auditor 재확인, 근거: 개정이유
목록에 특별공급 관련 4개 항목만 있고 별표1 언급 없음)"으로 갱신할 것을 권고한다 —
이는 FORMULA.md 오류가 아니라 정보 보완이므로 "공식 재검토 요청"이 아니라 단순
업데이트 권고로 분류한다.

#### 2-4. 미성년자 가입기간 상한 특례 — 서술 정확성 재확인, 미반영 판단은 합리적

WebSearch로 "미성년자로서 가입한 2023년 12월 31일 이전의 기간(해당 기간이 2년을
초과하는 경우에는 2년으로 한다)과 2024년 1월 1일 이후의 기간의 합이 5년을 초과하는
경우에는 5년만 인정합니다"라는, 법령 문언에 가까운 표현을 다시 확인했다 — FORMULA.md
"알려진 정책 특례" 3번의 서술(2년/5년 상한)과 정확히 일치한다. 또한 법령 원문(위
2-1에서 확보한 2015년판)에도 제5조의4제7항에 "성년에 이르기 전에 가입한 기간이 2년을
초과하는 경우에는 그 기간은 2년으로 본다"는 **원형 조항**이 이미 존재해, 2024년 개정이
이 기존 규칙을 "2년 상한 + 2024년 이후 기간 합산 5년 상한"으로 확장한 것이라는
서사가 법령 연혁상 자연스럽다. FORMULA.md가 이 특례를 v1에서 "계산에 반영하지 않고
고지만" 하기로 한 결정은 합리적이다 — SPEC.md 입력 모델이 미성년 가입 여부·정확한
성년 도달일을 받지 않으므로 이 특례를 정확히 자동 판정할 방법이 없고, 미반영은 항상
사용자에게 불리한 방향(실제보다 점수가 낮게 나와야 하는데 더 높게 보여줄 위험)이 아니라
"과소평가"쪽이라 SPEC.md "실제 청약홈 점수와 다를 수 있다"는 고지 원칙과 부합한다.
소형·저가주택 특례·배우자 통장 합산 특례도 같은 논리(v1 입력 모델의 한계, 미반영 시
방향이 사용자에게 유리하지 않음, 고지로 대체)로 타당하다고 판단한다. `logic.ts`/
`content.ts` 확인 결과 이 세 특례는 실제로 점수 계산에 전혀 반영되지 않고
`content.ts`의 정적 고지 문구로만 존재하며, `ui.tsx`가 이 3종을 입력값과 무관하게
항상 노출한다(ARCHITECTURE.md "6." 결정대로 조건부 숨김 없음, 857행
`housingScorePolicyExceptionNotices.map(...)`로 무조건 렌더링 확인).

#### 2-5. FORMULA.md 자체 오류 여부

법령 원문(2-1) 및 다중 독립 출처(2-2)와 대조한 결과, **FORMULA.md의 배점표·기산일
규칙·특례 서술 자체에서 명백한 오류는 발견하지 못했다.** 따라서 "공식 재검토 요청"으로
반려할 사유는 없다. 다만 위 2-2(가입기간 구간 경계 이상/초과 표현)와 2-3(2026-06-15
개정 영향)은 FORMULA.md에 추가·갱신을 권고하는 수준이며, 이는 오류 수정이 아니라
근거 보강이다.

### 3. 윤년 2월 29일 "만 30세가 되는 날" 처리 — 독립 실행 검증 결과

Builder가 EVALUATION.md에 참고 기재한 지점(6번)을 실제 코드 실행으로 직접 검증했다.

**검증 방법**: 프로젝트의 실제 `calculateHousingSubscriptionScore`(재구현이 아닌 원본
함수)를 `tsx`로 직접 import해 세 가지 입력을 실행했다(스크립트는 스크래치패드에만
저장, 소스 미수정).

| 케이스 | baseDate | birthDate | `homelessStartDate` | `homelessEligible` | `homelessPeriodScore` |
|---|---|---|---|---|---|
| 대조군(평년생) | 2026-02-28 | 1996-02-28(30세 정확) | 2026-02-28 | **true** | **2** |
| 윤년생, 생일 당일(법적 관점) | 2026-02-28 | 1996-02-29 | **2026-03-01** | **false** | **0** |
| 윤년생, 코드가 계산한 기산일 | 2026-03-01 | 1996-02-29 | 2026-03-01 | true | 2 |

**분석**: `ageThirtyDate()`가 `Date.UTC(year+30, month, day)`를 그대로 써서 2월 29일생의
"30세 되는 날"을 2026년(평년)에 대해 계산하면 JS가 자동으로 3월 1일로 정규화한다. 반면
한국 민법상 기간 계산 원칙(민법 제155~161조, 특히 제160조제3항 "월 또는 연으로 정한
경우에 최종의 월에 해당일이 없는 때에는 그 월의 말일로 기간이 만료한다" — 나이 계산에
이 조항이 준용된다는 것은 행정기본법 제7조의2·민법 제158조를 통해 일반적으로 인정되는
해석이다)에 따르면 2월 29일생은 평년에 **2월 28일**에 만 30세가 되어야 한다. 대조군
케이스(생일이 원래 2월 28일인 사람)는 정확히 그날 `homelessEligible=true`/2점을
받는데, 윤년생은 "논리적으로 동등한 날"인 2월 28일에 아직 미해당(0점, "만 30세 미만"
경고)으로 처리되고 하루 늦은 3월 1일에야 인정된다 — **재현 가능한 1일 지연 버그**다.

이 처리 방식은 이 코드베이스 안에 있는 **기존 계산기(age-calculator)의 검증된 관례와도
반대**된다. `src/calculators/age-calculator/date-utils.ts`의 `anniversaryInYear`는
`Math.min(day, daysInMonth(year, month))`로 평년의 2월 29일 기념일을 2월 28일로
clamp하며, 이 clamp 동작은 age-calculator의 Golden Test(tasks/age-calculator/
ARCHITECTURE.md "2월 29일생의 윤년·평년 경계")가 **법제처 공식 예시로 검증**한
것이다. 즉 "어느 쪽이 맞는지 모르는 설계 차이"가 아니라, 이 프로젝트 안에 이미 검증된
정답(clamp)이 있는데 이번 계산기만 다르게(정규화/roll-over) 구현된 것이다.

**영향 범위(왜 Critical/High가 아니라 Medium인가)**: 이 버그는 (1) 생년월일이 정확히
2월 29일인 사용자에게만(전체 인구의 약 1/1461), (2) 매년 단 하루(2월 28일, 윤년의 경우
2월 29일)에만 나타나고, (3) 그 하루가 지나면(3월 1일부터) 결과가 다시 정확해진다(그
이후 날짜에 대해서는 대조군과 동일한 연수 판정을 내린다 — 직접 확인함). 즉 상시적으로
틀린 계산이 아니라 극히 좁은 경계 조건에서만 발생한다. 다만 발생하면 실제로 틀린
점수(0점 vs 정답 2점, 그리고 "만 30세 미만" 이라는 사실과 다른 경고 문구까지 노출)를
보여주는 명백한 계산 오류이고, 하필 그 하루가 "본인의 생일"이라 사용자가 가장 확인하고
싶어할 만한 시점이라는 점에서 완전히 무해하다고 보기도 어렵다.

**책임 소재 판단**: FORMULA.md "공식" 1단계는 "`ageStartDate = birthDate + 30년(만
30세가 되는 날, 생일)`"이라고만 적었을 뿐 2월 29일 clamp 규칙을 명시하지 않았다.
docs/CALCULATOR_RULES.md "날짜 계산기" 절이 "윤년... Date 객체로 인해 날짜가 하루
이동하는 문제가 없는지 검증한다"를 요구사항으로 명시하는 것을 고려하면, 이 공백은
FORMULA.md 단계에서 미리 메워졌어야 한다. Architect가 ARCHITECTURE.md "2."에서 이
문제를 인지하고도 "SPEC/FORMULA가 요구하지 않았다"는 이유로 보류한 것은, 이번 감사로
"민법상 정답이 이미 이 코드베이스 안에 존재한다(age-calculator)"는 근거가 새로
확인되기 전까지는 합리적인 판단이었다. 따라서 이 건은 **Builder 결함이 아니라
FORMULA.md 공식 명세의 공백**으로 분류하고, Formula Analyst에게 "공식 1단계에 윤년
2월 29일 처리 규칙(월말 clamp, 민법 제160조제3항 근거)을 명시할 것"을 요청하는 것이
맞다고 판단한다. Formula Analyst가 이를 보완하면 Builder는 `ageThirtyDate()`를
`age-calculator/date-utils.ts`의 `Math.min(day, daysInMonth(...))` 패턴과 동일한
방식(단, 파일은 공유하지 않고 각자 구현 유지, ARCHITECTURE.md "2." 결정 그대로)으로
간단히 수정하면 된다 — 수정 비용이 매우 낮다.

**등급: Medium** (Critical/High 아님 — 위 "영향 범위" 근거. 그러나 재현 가능한 실제
계산 오류이므로 Low는 아니며, 다음 개선 Loop에서 반드시 반영을 권고).

### 4. 기타 확인 항목

- **경계값**: 만 30세 생일 당일(예제1), 만 1년 경계(예제3/4), 6개월 경계(예제9),
  1년 경계(예제10), 15년 상한(예제6/11), 부양가족 0명(예제7)/6명 상한(예제8) 전부
  Golden Test로 고정되어 있고 직접 재계산으로도 확인했다 — 위 윤년 건을 제외하면
  경계값 처리 자체는 정확하다.
- **반올림/부동소수점**: 모든 계산이 정수 연산(연/월 정수 차, `Math.floor`,
  `Math.min`)이며 소수 곱셈·나눗셈이 공식에 없다. ARCHITECTURE.md "1."의 "Number로
  충분하다"는 판단에 동의한다. 부동소수점 오차가 결과에 영향을 줄 여지가 없다.
  Bash로 `0.1+0.2` 류 오차 가능 지점이 있는지 코드 전체를 재검토했으나 해당 없음을
  확인했다.
- **단위 변환**: 날짜(UTC 자정 고정, `parseIsoDateUtc` 재사용)·연/월 정수·점수(정수)
  세 단위 모두 명확히 분리되어 있고 혼동 지점이 없다.
- **계산 순서**: FORMULA.md "계산 순서" 1~8단계와 `logic.ts`/`formatting.ts` 호출
  순서가 일치한다(검증→기산일→무주택 점수→부양가족→가입기간→총점→breakdown, ui.tsx가
  `validateHousingSubscriptionScoreInput` 실패 시 `calculateHousingSubscriptionScore`를
  호출하지 않는 것도 확인).
- **잘못된 입력 처리**: `validation.test.ts`의 미래 날짜·순서 오류·5년 초과·음수/소수
  케이스를 코드로 직접 재확인했고, `logic.ts`는 `parseIsoDateUtc`가 `null`을 반환하면
  `throw`하도록 방어되어 있어(검증을 통과하지 못한 입력이 실수로 `calculate`에 들어가도
  조용히 잘못된 결과를 내지 않는다) 안전하다.
- **테스트 실행 재확인(Bash)**: `npx vitest run src/calculators/housing-subscription-score
  src/lib/date-calc.test.ts --no-file-parallelism` → 5개 파일 85개 테스트 전부 통과
  (Builder가 보고한 71개 + `date-calc.test.ts` 14개, 회귀 없음 재확인).

### 발견된 이슈 (등급별)

- **Medium**: 윤년 2월 29일생의 "만 30세가 되는 날" 계산이 평년에 3월 1일로 밀려
  실제(민법상 clamp 기준) 30세 도달일보다 하루 늦게 인정된다(위 "3." 상세). 근본
  원인은 FORMULA.md 공식 1단계가 이 경계 규칙을 명시하지 않은 공백 — Formula Analyst
  보완 후 Builder가 `age-calculator`와 동일한 clamp 방식(파일 공유 없이 로직만
  동일하게)으로 `ageThirtyDate()`를 수정할 것을 권고.
- **Low(정보 보강 권고, 오류 아님)**: FORMULA.md "확인 필요 항목 총정리"에 다음 2건
  추가·갱신 권고 — (1) 2026-06-15 시행 국토교통부령 제1592호는 별표1(가점제)이 아니라
  특별공급 조항만 개정한 것으로 확인됨(위 "2-3"), FORMULA.md 갱신 권고. (2) 청약통장
  가입기간표의 구간 경계가 "이상~미만"인지 "초과~이하"인지, HUG 사이트 재확인 시도에서
  불안정한 결과가 나와 완전히 재확인되지 않음(위 "2-2") — 별표1 원문 확보 시 최우선
  대조 대상으로 남길 것을 권고. 두 건 모두 현재 구현/Golden Test를 바꿀 근거는 아니다.
- **Critical/High**: 없음.

### 5. 공식 재검토 요청 여부

FORMULA.md 자체에서 명백한 오류는 발견하지 못했다 — **공식 재검토 요청(FAIL 반려)
대상 아님**. 다만 위 "발견된 이슈"의 Medium 1건은 FORMULA.md 공식 1단계의 **명세 공백
보완**을 Formula Analyst에게 요청하는 형태로 처리할 것을 권고한다(docs/EVALUATION.md
"역할 간 이견 조정" — 공식의 정확성 최종 권위는 Formula Analyst에게 있으므로, Auditor는
근거(민법 제160조제3항, age-calculator 기존 검증 사례)를 제시하고 Formula Analyst의
재검토를 요청하는 데 그친다).

### 구현 ↔ FORMULA.md 일치 여부

일치 (공식 1~9단계, Golden Test 12개, policy.ts 상수 전부 대조 완료 — 위 "1." 참고).

### FORMULA.md ↔ 실제 근거 일치 여부

대체로 일치. law.go.kr 원문(구버전, 핵심 기산일 조항 문구 일치 확인) + HUG 재확인 +
2026-06-15 개정 내역(별표1 미포함 확인)으로 이전보다 신뢰도가 상향됐다. 청약통장
가입기간 구간 경계(이상/초과)는 여전히 완전히 확정하지 못해 "확인 필요"로 유지 권고
(위 "2." 전체 참고).

### 발견된 이슈 (등급별) — 요약

- Critical: 0
- High: 0
- Medium: 1 (윤년 2월 29일 "만 30세가 되는 날" 산정 — FORMULA.md 명세 공백 + Builder
  수정 필요)
- Low: 2 (정보 보강 권고 — 2026-06-15 개정 영향 확정, 가입기간 구간 경계 표현 재확인)

### 판정: **PASS** (Medium 1건 개선 권고, Critical/High 없음 — docs/EVALUATION.md PASS
기준의 "Critical 0, High 0"을 충족하며 계산 정확성 자체는 FORMULA.md와 정확히 일치하나,
다음 Optimizer 라운드에서 Medium 이슈 반영을 권고)

## Optimizer 수정 (라운드 1)

2026-09-06. Calculation Auditor가 지적한 Medium 이슈 1건(윤년 2월 29일생의 "만 30세가
되는 날" 산정 — `ageThirtyDate()`가 `Date.UTC(year+30, month, day)`의 표준 정규화에
맡겨 평년에 3월 1일로 밀리는 문제)을 수정했다. Formula Analyst가 이미 FORMULA.md "공식"
1단계에 clamp 규칙(민법 제160조제3항 근거)을 명시하고 검증 예제 13·14를 추가한 뒤였으므로,
그 갱신된 FORMULA.md를 그대로 구현했다 — 새 규칙을 임의로 설계하지 않았다.

### 수정한 파일

- `src/calculators/housing-subscription-score/logic.ts`
  - `lastDayOfMonthUtc`를 `@/src/lib/date-calc`에서 추가 import(기존 import에 한 줄
    추가, 이 함수는 계산기 도메인 의미가 없는 순수 산술 유틸이라 공유해도 되는 것으로
    이미 ARCHITECTURE.md "2."에서 판단됨).
  - `ageThirtyDate()` 함수 본문을 다음과 같이 수정:
    ```ts
    function ageThirtyDate(birthDate: Date): Date {
      const year = birthDate.getUTCFullYear() + 30;
      const month = birthDate.getUTCMonth();
      const day = Math.min(birthDate.getUTCDate(), lastDayOfMonthUtc(year, month));
      return new Date(Date.UTC(year, month, day));
    }
    ```
    `age-calculator/date-utils.ts`의 `anniversaryInYear`(`Math.min(day, daysInMonth(year,
    month))`)와 개념적으로 동일한 월말 clamp 패턴이되, 파일을 공유(import)하지 않고 이
    계산기 자체 헬퍼로 독립 구현했다(ARCHITECTURE.md "2." 결정 — 두 계산기의 날짜
    헬퍼를 통합하지 않기로 이미 확정되어 있어 그대로 유지).
  - 함수 위 doc comment도 새 clamp 규칙과 근거(민법 제160조제3항, FORMULA.md 공식
    1단계·검증 예제 13·14)를 반영하도록 갱신했다.
- `src/calculators/housing-subscription-score/logic.test.ts`
  - FORMULA.md 검증 예제 13(1996-02-29생)·14(2000-02-29생)를 Golden Test 4건으로
    추가(각 예제당 clamp 경계 하루 전=0점 / clamp된 당일=2점 두 케이스). `describe` 제목을
    "검증 예제 12개" → "검증 예제 14개"로 갱신.
  - 다른 부분(배점표·부양가족·가입기간 관련 기존 테스트, 상한/하한 불변식 테스트, 예외
    케이스 테스트)은 손대지 않았다.
- FORMULA.md, SPEC.md, ARCHITECTURE.md는 이번 라운드에서 수정하지 않았다(지시대로).

### 독립 검증 (Optimizer, tsx로 원본 함수 직접 실행)

스크래치패드 스크립트로 `calculateHousingSubscriptionScore`를 직접 import해 네 가지
입력을 재실행했다(소스 미수정, 검증 전용):

| baseDate | birthDate | homelessStartDate | homelessEligible | homelessPeriodScore |
|---|---|---|---|---|
| 2026-02-27 | 1996-02-29 | 2026-02-28 | false | 0 |
| 2026-02-28 | 1996-02-29 | 2026-02-28 | true | 2 |
| 2030-02-27 | 2000-02-29 | 2030-02-28 | false | 0 |
| 2030-02-28 | 2000-02-29 | 2030-02-28 | true | 2 |

수정 전 Calculation Auditor가 재현했던 버그(`homelessStartDate=2026-03-01`,
`2026-02-28`에도 `eligible=false`/0점)가 더 이상 나타나지 않고, `homelessStartDate`가
2월 28일로 정확히 clamp되며 그 날부터 `eligible=true`/2점이 되는 것을 확인했다.

### 검증 실행 결과

- `npx vitest run --no-file-parallelism`(전체 스위트) — **47개 파일 466개 테스트 전부
  통과**(기존 462개 + 신규 예제 13·14 Golden Test 4개, 회귀 없음).
- `npx tsc --noEmit` — 오류 0.
- `npm run build`(next build, Turbopack) — 성공. TypeScript 통과, 정적 페이지 생성 정상.

### 참고

- Calculation Auditor가 함께 "Low(정보 보강 권고)"로 남긴 2건(2026-06-15 시행 개정의
  별표1 미개정 확인, 청약통장 가입기간 구간 경계 "이상/초과" 재확인)은 이번 요청 범위
  밖이라 손대지 않았다(요청이 Medium 이슈 1건만 명시).
- 최종 PASS/FAIL 재판정은 Calculation Auditor의 몫이다.

## Calculation Auditor 재검증 (라운드 1)

2026-09-06, 이전 라운드에서 보고한 Medium 이슈("3. 윤년 2월 29일 '만 30세가 되는 날'
처리")가 Formula Analyst의 FORMULA.md 보완과 Optimizer의 `logic.ts` 수정을 거쳐
실제로 해소됐는지 재검증했다. 아래 두 축(구현↔FORMULA.md, FORMULA.md↔실제 근거)을
모두 다시 확인했고, 추가로 실제 함수를 직접 실행하는 독립 재현 검증과 전체 회귀
테스트를 수행했다.

### 1. FORMULA.md 보완 내용 확인 — Formula Analyst의 근거 충실성

FORMULA.md "공식" 1단계에 추가된 문단을 읽었다. 지난 라운드에서 요구했던 두 근거가
모두 정확히 반영되어 있다:

- **민법 제160조제3항 근거**: "월 또는 연으로 정한 경우에 최종의 월에 해당일이 없는
  때에는 그 월의 말일로 기간이 만료한다"는 조문을 그대로 인용하고, 나이 계산에 이
  조항이 준용된다는 해석 근거(행정기본법 제7조의2·민법 제158조)까지 명시했다 — 지난
  라운드 지적문과 표현 수준까지 일치한다.
  - 참고: 아래 "3." 재현 검증에서 확인했듯 실제 clamp 결과(2026-02-28)는 이 조문의
    "말일로 만료"라는 문언과 정확히 부합한다(2월 28일=평년 2월의 말일).
- **age-calculator 선례 인용**: `age-calculator/date-utils.ts`의 `anniversaryInYear`
  (`Math.min(day, daysInMonth(year, month))`)와 `tasks/age-calculator/FORMULA.md`/
  `ARCHITECTURE.md`("법제처 공식 예시로 검증")를 근거로 들며, "파일을 공유·import하지
  말고 이 계산기 자체 헬퍼에서 동일 로직으로 독립 구현할 것"이라는 Builder 안내까지
  포함했다 — 이는 지난 라운드가 "Builder 결함이 아니라 FORMULA.md 공백"으로 분류하며
  요구한 정확히 그 내용이다.
- **추가된 수학적 증명**(요구하지 않았으나 유용한 보강): "2월 29일 출생연도는 반드시
  4의 배수여야 하고 30은 4의 배수가 아니므로 출생연도+30은 결코 4의 배수(윤년)가 될 수
  없다"는 주장을 직접 검산했다 — 윤년은 4의 배수(그레고리력 100/400 예외 포함)여야
  하므로 출생연도 mod 4 = 0. 출생연도+30 mod 4 = 30 mod 4 = 2 ≠ 0. 따라서 출생연도+30은
  결코 4의 배수가 될 수 없고, 4의 배수가 아니면 그레고리력상 결코 윤년일 수 없다 —
  수학적으로 정확한 증명이다. 즉 이 계산기 안에서는 "2월 29일생이 30세 되는 해에
  윤년"인 대조 사례가 존재할 수 없으므로, 검증 예제가 실제 윤년 사례를 못 담은 것은
  누락이 아니라 필연이라는 설명도 타당하다.

**검증 예제 13·14 확인**: 두 예제 모두 "clamp 경계 하루 전=0점" / "clamp된 당일=2점"
쌍으로 구성되어 있고, 서로 다른 두 출생연도(1996년 통상 윤년, 2000년 400배수 윤년)를
써서 clamp 규칙이 윤년 종류에 무관하게 일관 적용됨을 보인다 — 400배수 윤년을 별도
사례로 넣은 것은 "4의 배수지만 100의 배수는 윤년이 아닌" 경계(1900, 2100 등)까지
고려한 신중한 선택이며, 지난 라운드가 요구하지 않았던 부분까지 스스로 보강한 점을
긍정적으로 평가한다.

**"확인 필요 항목"의 Low 이슈 2건 반영 여부**: 재조사하지 않고 문서에 반영됐는지만
확인하라는 지시대로, FORMULA.md를 다시 읽어 두 항목의 존재만 확인했다.
- 항목 6(2026-06-15 개정의 별표1 미개정 판단): "미개정으로 판단(2026-09-06
  Calculation Auditor 재확인)"이라는 문구와 근거(개정이유 4가지가 전부 특별공급 관련)가
  "확인 필요 항목 총정리" 6번과 "기준/출처" 절 두 곳 모두에 반영되어 있다. 확인됨.
- 항목 9(청약통장 가입기간 구간 경계 "이상 vs 초과"): "확인 필요 항목 총정리" 9번과
  "기준/출처" 절에 HUG 페이지 재확인 시 발견한 불안정성(같은 URL이 프롬프트에 따라
  다른 결과를 반환)과 "현재 배점표·Golden Test 값은 변경하지 않는다"는 결론이 그대로
  반영되어 있다. 확인됨.

두 건 모두 지난 라운드의 조사 결과가 누락 없이 문서에 옮겨졌다.

### 2. 구현(`logic.ts`) ↔ FORMULA.md 새 규칙 일치 여부: **일치**

`ageThirtyDate()` 수정본을 FORMULA.md 공식 1단계 clamp 규칙과 한 줄씩 대조했다.

```ts
function ageThirtyDate(birthDate: Date): Date {
  const year = birthDate.getUTCFullYear() + 30;
  const month = birthDate.getUTCMonth();
  const day = Math.min(birthDate.getUTCDate(), lastDayOfMonthUtc(year, month));
  return new Date(Date.UTC(year, month, day));
}
```

- `year = birthDate.year + 30`: FORMULA.md "생일이 2월 29일이고, 30세가 되는 해
  (birthDate.year + 30)가 평년이면"과 정확히 같은 대상 연도 계산.
- `day = Math.min(birthDate.day, lastDayOfMonthUtc(year, month))`: FORMULA.md가 요구한
  "3월 1일로 넘어가지 않고 그 해의 2월 28일로 한다(월말 clamp)"를 일반화된 형태(월말
  일수를 직접 계산해 `Math.min`)로 정확히 구현한다. 2월이 아닌 다른 달(예: 31일→30일
  달)에도 같은 로직이 안전하게 적용되지만, 이 계산기의 유일한 실사용 대상은 2월 29일
  뿐이므로 결과적으로 FORMULA.md가 요구한 그 규칙과 동치다.
- `Date.UTC(year, month, day)`: clamp된 `day`를 그대로 써서 `Date.UTC`의 자동 정규화
  경로 자체를 원천 차단한다(수정 전 버그의 원인이었던 "정규화에 맡김" 경로 제거).
- `lastDayOfMonthUtc(year, monthIndex0)` 확인(`src/lib/date-calc.ts` 63~65행):
  `new Date(Date.UTC(year, monthIndex0+1, 0)).getUTCDate()` — "다음 달 0일=이번 달
  마지막 날" 표준 트릭으로, 윤년 2월(29일)·평년 2월(28일)을 정확히 구분한다. 이미
  `calendarMonthsBeforeUtc`(severance-pay/unemployment-benefit이 공유)가 같은 함수를
  쓰고 있어 검증된 유틸이다.
- **파일 공유 여부**: `ageThirtyDate()`는 `age-calculator/date-utils.ts`를 import하지
  않는다(grep 확인, `age-calculator` 문자열이 `logic.ts`에 등장하지 않음) — 공유하는
  것은 도메인 의미가 없는 범용 유틸(`lastDayOfMonthUtc`, `src/lib/date-calc.ts`)뿐이다.
  Optimizer 수정 지시("age-calculator와 파일 공유 없이 독립 구현")를 정확히 지켰다.

FORMULA.md 공식 1단계와 `ageThirtyDate()` 구현 사이에 불일치는 없다.

### 3. 독립 재현 검증 (실제 함수 직접 실행)

이전 라운드와 동일한 방식(재구현이 아닌 원본 `calculateHousingSubscriptionScore`를
`tsx`로 직접 import해 실행, 스크립트는 스크래치패드에만 저장하고 소스는 건드리지
않음)으로 재검증했다. 지시받은 세 가지 케이스에 참고용 케이스(clamp 다음날)를 하나
더 추가해 총 5개 입력을 실행했다.

| 케이스 | baseDate | birthDate | homelessStartDate | homelessEligible | homelessPeriodYears | homelessPeriodScore |
|---|---|---|---|---|---|---|
| 1996-02-29생, clamp 하루 전 | 2026-02-27 | 1996-02-29 | 2026-02-28 | **false** | 0 | **0** |
| 1996-02-29생, clamp 당일 | 2026-02-28 | 1996-02-29 | 2026-02-28 | **true** | 0 | **2** |
| 1996-02-29생, clamp 다음날(참고, 회귀 없음 확인용) | 2026-03-01 | 1996-02-29 | 2026-02-28 | true | 0 | 2 |
| 2000-02-29생(400배수 윤년), clamp 하루 전 | 2030-02-27 | 2000-02-29 | 2030-02-28 | **false** | 0 | **0** |
| 2000-02-29생, clamp 당일 | 2030-02-28 | 2000-02-29 | 2030-02-28 | **true** | 0 | **2** |

**결과 요약**: 지시받은 세 확인 사항 모두 재현됐다.
- 1996-02-29생이 2026-02-28(clamp 기준일)에 `homelessEligible=true`, `homelessPeriodScore=2`를
  정확히 받는다.
- 하루 전(2026-02-27)에는 여전히 `homelessEligible=false`, `homelessPeriodScore=0`이다
  (수정 전 버그처럼 3월 1일까지 밀리지 않는다).
- 400배수 윤년(2000-02-29)도 동일 패턴(2030-02-27=false/0점, 2030-02-28=true/2점)으로
  일반성이 확인된다.

수정 전 이 계산기가 보였던 버그(`homelessStartDate=2026-03-01`로 밀려 2026-02-28에도
`eligible=false`)는 더 이상 재현되지 않는다. `homelessStartDate`가 5개 케이스 모두
`2026-02-28`/`2030-02-28`로 정확히 clamp된 채 반환됨을 직접 확인했다(Optimizer가
EVALUATION.md에 기록한 표와 값 완전히 일치, 독립 재실행으로 재확인).

### 4. 회귀 테스트 재확인

`npx vitest run --no-file-parallelism`(전체 스위트, 47개 파일)를 직접 재실행했다.

```
Test Files  47 passed (47)
     Tests  466 passed (466)
```

Builder 라운드(462개) 대비 Optimizer가 추가한 예제 13·14 Golden Test 4건이 더해져
466개, 전부 통과 — 실패한 테스트 없음, 다른 계산기(severance-pay, unemployment-benefit
등 `lastDayOfMonthUtc`/`calendarMonthsBeforeUtc`를 공유하는 계산기 포함)에도 회귀
없음을 재확인했다.

### 5. 종합 판정

- **구현 ↔ FORMULA.md 일치**: 일치. `ageThirtyDate()`가 새 clamp 규칙을 정확히
  구현하고, 파일 공유 제약도 지켰다.
- **FORMULA.md ↔ 실제 근거 일치**: 일치. 민법 제160조제3항 근거와 age-calculator
  선례 인용이 정확하고, 추가된 수학적 증명도 직접 검산해 타당함을 확인했다. FORMULA.md
  자체의 오류는 발견되지 않았다 — "공식 재검토 요청" 사유 없음.
  Low 이슈 2건도 문서에 이미 반영되어 있음을 확인했다(재조사 없이 존재 확인만 수행).
- **독립 재현 검증**: 위 "3."의 5개 케이스 전부 기대대로 동작(경계 하루 전=0점,
  clamp 당일=2점, 서로 다른 두 윤년 종류에서 일관됨).
- **회귀 테스트**: 47개 파일 466개 테스트 전부 통과, 회귀 없음.

지난 라운드에서 보고한 Medium 이슈 1건은 완전히 해소된 것으로 판단한다. 남은 항목은
Low 등급 정보 보강 권고 2건뿐이며(재조사 불필요, 이미 문서 반영 확인), 이는 계산
정확성 자체에 영향을 주는 오류가 아니라 향후 별표1 원문 확보 시 대조할 참고 사항이다.

### 최종 판정: **PASS**

- Critical: 0
- High: 0
- Medium: 0 (이전 1건 해소 확인)
- Low: 2 (정보 보강 권고, 문서 반영 확인 완료 — 재조사 불필요, 구현/Golden Test 변경
  근거 아님)

이 계산기의 Calculation Auditor 단계는 이번 재검증으로 **최종 PASS**로 마무리한다.

## UX/UI Critic

2026-09-06. Edit 권한 없이 소스 코드를 직접 읽고(`ui.tsx`, `content.ts`, `formatting.ts`,
`types.ts`, `validation.ts`, `logic.ts`), `SPEC.md`/`FORMULA.md`/`ARCHITECTURE.md`와
대조해 평가했다. 평가에 앞서 이 계산기에 특화된 자체 평가 질문 14개를 만들었고, 7개
평가 항목을 각각 최소 1개 이상 커버했으며(아래 각 질문에 대응 항목 표시), 4개 필수
질문을 모두 포함했다(★ 표시).

### 자체 평가 질문 · 답변 · 등급

**[평가 항목: 입력 라벨 표현·순서·그룹핑] ★필수질문 1 — 모든 입력 라벨을
`src/calculators/severance-pay/ui.tsx`의 `FIELDS` 배열(퇴사일·입사일 등 일상어 라벨의
기준 예시)과 직접 대조했을 때, 일반 사용자 표현 대신 법령·전문 용어를 쓰거나
`FORMULA.md`/`SPEC.md` 용어를 화면 라벨로 그대로 복사한 라벨이 있는가?**

답변: 있다. `ui.tsx`의 부양가족 그룹(542~590행)에서 라벨이 각각 "인정되는 직계존속
수", "인정되는 미혼 직계비속 수"로, FORMULA.md/SPEC.md의 법령 친족 용어(직계존속=
부모·조부모 등 손윗세대, 직계비속=자녀·손자녀 등 손아랫세대)를 그대로 라벨에 복사했다.
severance-pay의 "이직일"→"퇴사일" 같은 순화 작업이 이 두 필드에는 전혀 적용되지 않았다.
더 큰 문제는 helpText(556~559행, 581~584행)조차 "직계존속", "직계비속"이라는 단어를
설명 없이 그대로 재사용한다는 점이다 — "신청자 또는 배우자와 3년 이상 계속 동일
주민등록표에 등재되어 있고, 본인 소유 주택이 없는 **직계존속** 수입니다"처럼, 인정
요건(3년 동거·무주택)은 풀어 썼지만 정작 "직계존속이 누구를 가리키는지"(부모님,
배우자의 부모님, 조부모님 등)는 라벨에도 helpText에도 FAQ에도 어디에도 명시돼 있지
않다. DESIGN_SYSTEM.md "라벨 표현"이 요구하는 "정확한 법령 용어가 필요하면 라벨이
아니라 helpText에 넣는다"는 원칙이 지켜지지 않았다 — helpText에도 없기 때문이다.
이 계산기의 SPEC.md가 "이 계산기는 법령 용어(무주택기간, 부양가족, 세대구성원 등)를
몰라도 쓸 수 있는 참고용 도구"라고 목적을 명시했고, 오케스트레이터가 이번 평가에서
특별히 "직계존속·직계비속" 용어의 처리를 핵심 포인트로 지목했다는 점을 고려하면, 이
필드에서 사용자가 "직계존속"이 누구인지 몰라 잘못된 인원 수(예: 부모님을 빠뜨리거나
배우자의 부모님을 넣을지 헷갈림)를 입력해 실제로 틀린 점수를 받을 위험이 있다.
대조적으로 "기준일"(284~311행)은 라벨은 일상어("기준일")로 두고 법령 용어
("입주자모집공고일")를 helpText에만 넣어 올바른 패턴을 보여준다 — 같은 파일 안에서
패턴이 일관되지 않는다는 점도 지적할 만하다.
**등급: High** — SPEC.md의 핵심 목적("법령 용어를 몰라도 쓸 수 있는 도구")과
DESIGN_SYSTEM.md "라벨 표현" 규칙을 동시에 위반하고, 실제로 틀린 입력(→틀린 점수)으로
이어질 개연성이 있는 필드에서 발생했다.

**[평가 항목: 입력 라벨 표현·순서·그룹핑] ★필수질문 2 — 입력 필드 순서가 시간 순서
(입사일 → 퇴사일 등)인가? 하나의 기간을 이루는 두 날짜 사이에 성격이 다른 필드가
끼어 있지 않은가?**

답변: 부분적으로 우려가 있으나 설계상 불가피성이 인정된다. 이 계산기는 "기간"이 3개
(무주택기간, 부양가족 인정기간 각각, 청약통장 가입기간)이고 셋 다 종료일이 동일한
`baseDate`(기준일)라서, ARCHITECTURE.md "6."의 결정대로 `baseDate`를 최상단에 단독
배치했다. 그 결과 "청약통장 가입기간"을 이루는 두 날짜(`subscriptionAccountOpenDate`
와 `baseDate`)는 화면상 맨 위(기준일)와 맨 아래(청약통장 그룹, 594~657행) 사이에
무주택기간·부양가족 그룹 전체가 끼어 있는 모양이 된다. 다만 (1) 상단 `baseDate`
helpText(302~305행)가 "무주택기간·부양가족수·가입기간 세 항목 모두 이 날짜를
기준으로 계산합니다"라고 명시해 이 관계를 미리 알려주고, (2) 각 그룹 내부(생년월일→
혼인여부→혼인신고일→주택소유이력→처분일, 통장보유여부→가입일)는 정확히 시간순으로
배치돼 있어, "성격이 다른 필드가 완전히 무작위로 끼어든" 상태는 아니다.
**등급: Low** — 구조적으로 불가피한 설계이고 helpText로 보완되지만, 이상적으로는
severance-pay의 "두 필드를 인접시킨다" 원칙과는 다른 예외 패턴이라는 점은 기록해 둔다.

**[평가 항목: 입력 라벨 표현·순서·그룹핑] ★필수질문 3 — 같은 개념이 폼·결과·오류
메시지 전체에서 한 용어로 통일돼 있는가?**

답변: 핵심 세 용어("무주택기간", "부양가족수", "청약통장 가입기간")는 fieldset
legend("무주택기간 정보"/"부양가족 정보"/"청약통장 정보"), 결과 카드 제목("무주택기간"
/"부양가족수"/"청약통장 가입기간"), breakdown label(`buildHomelessRow`/
`buildDependentRow`/`buildSubscriptionRow`의 `label` 필드), 경고 문구, FAQ 전체에서
완전히 일치한다(grep 대조 결과 표기 흔들림 없음). "가입기간"을 "보유기간"으로 바꿔
쓰거나 "무주택기간"을 결과에서만 "무주택 기간"으로 띄어 쓰는 등의 불일치도 없다.
**등급: 문제없음.**

**[평가 항목: 입력 라벨 표현·순서·그룹핑] ★필수질문 4 — 입력 필드 수가 최소인가?
다른 입력에서 유도 가능한 값을 사용자에게 중복으로 물어보지 않는가?**

답변: `hasQualifyingSpouseInHousehold`(배우자 부양가족 인정 여부, 504~538행)가
`isMarried`와 사실상 항상 같은 값이어야 하는데도 별도 토글로 다시 물어본다.
FORMULA.md "부양가족 인정 범위"는 "배우자: 주민등록이 분리되어 있어도(세대 분리)
인정된다"고 **무조건적**으로 서술하며, 예외 조건을 제시하지 않는다. `ui.tsx`의
helpText(534~537행)도 "배우자는 주민등록이 분리(세대 분리)되어 있어도 부양가족으로
인정됩니다"라고 같은 취지로 재확인한다 — 즉 이 필드가 `false`가 되어야 하는 시나리오가
FORMULA.md·helpText 어디에도 설명돼 있지 않다. 사용자 입장에서는 "혼인했다"고 이미
답했는데 왜 "배우자가 부양가족으로 인정되는지"를 다시 "예/아니요"로 물어보는지 이해하기
어렵고, 잘못 "아니요"를 선택하면 이유 없이 점수가 5점(부양가족 1명분) 낮아진다. 이
필드가 실제로 필요한 예외(예: 혼인관계증명서상 인정되지 않는 특수 혼인 상태 등)가
있다면 helpText에 "이런 경우에만 아니요를 선택하세요"라는 안내가 있어야 하는데 없다.
**등급: Medium** — 중복 가능성이 높은 입력이 근거 설명 없이 노출돼 오입력 위험을 만든다.

**[평가 항목: 일반 사용자가 계산법을 몰라도 사용할 수 있는지] 질문 5 — 전체 입력 흐름을
계산 공식을 전혀 모르는 사용자가 끝까지 막힘 없이 따라갈 수 있는가?**

답변: 대체로 가능하다 — 기준일(오늘 기본값)→생년월일→혼인여부→주택 소유 이력→
부양가족→청약통장 순서가 직관적이고, 각 단계 helpText가 "왜 이걸 묻는지"를 설명한다
(예: "만 30세가 되기 전에 혼인했다면 혼인신고일부터 계산합니다"). 다만 위 필수질문 1의
"직계존속/직계비속" 두 필드에서는 사용자가 "내가 몇 명을 입력해야 하는지" 판단할 근거
자체(그 용어가 부모님·자녀를 가리킨다는 사실)가 화면 어디에도 없어 그 지점에서 막히거나
잘못된 값을 넣을 수 있다.
**등급: Medium** — 필수질문 1과 동일 원인, 전체 흐름 관점에서 재확인.

**[평가 항목: 결과 가독성] 질문 6 — 총점과 항목별 점수의 위계(어느 것이 가장 중요한
숫자인지)가 한눈에 파악되는가?**

답변: 그렇다. 핵심 결과 카드(`bg-primary`, 699~716행)가 총점(0~84)을 `text-4xl`/
`sm:text-5xl`로 가장 크게 표시하고, 바로 아래 한 줄 요약("무주택기간 O점 + 부양가족수
O점 + 가입기간 O점")과 참고용 면책 문구가 이어진다. 이어지는 3열 카드는 각 항목의
"O / 최대점수" 형태로 상한을 항상 병기해 총점 대비 위치를 파악하기 쉽다.
**등급: 문제없음.**

**[평가 항목: 결과 가독성] 질문 7 — 정책 특례 3종("v1이 반영하지 못하는 특례") 고지가
"내 점수가 실제 청약홈 점수와 다를 수 있다"는 것을 사용자가 놓치지 않을 만큼 충분히
눈에 띄는가, 아니면 무시하고 지나칠 법한 텍스트인가?**

답변: 완전히 묻히지는 않지만 중요도 대비 시각적 우선순위가 낮다. 이 3종 고지는 "정책
안내" `SectionCard`(822~864행) 맨 아래, "계산 방법"·"적용된 입력값" 섹션을 지나야
도달하는 위치에 있고, 스타일도 일반 본문 텍스트(`text-sm`, `text-muted`)로 개별
경고카드(`WarningCard`, `bg-warning-surface`+경고 아이콘)와 달리 **경고 색상·아이콘이
전혀 없다**. 반면 이 3종 고지는 "모든 사용자에게 항상 적용되는" 고지(ARCHITECTURE.md
"6."이 "특정 입력값에 따라 골라서 보여주면 오히려 반영되고 있다는 오해를 준다"며 상시
노출을 결정한 이유)라는 점에서, 오히려 개별 조건부 경고(무주택 요건 미충족 등)보다
더 눈에 띄어야 할 수도 있는 정보다. 핵심 결과 카드 근처의 짧은 면책 문구(712~715행,
"참고용 예상 점수이며... 실제 당첨 여부를 의미하지 않습니다")는 총점 자체가 세부
특례로 인해 달라질 수 있다는 구체적 힌트를 주지 않는다 — "당첨 여부"는 언급하지만
"당신의 점수 자체가 최대 +3점, 또는 무주택 인정 여부가 달라질 수 있다"는 점은 스크롤을
끝까지 내려야 알 수 있다. 결과 화면을 끝까지 읽지 않는 사용자는 이 고지를 놓칠 가능성이
있다.
**등급: Medium.**

**[평가 항목: 모바일 사용성(레이아웃)] 질문 8 — 항목별 카드 3개(그리드) + 조건부 경고
카드 배치(Builder가 "3열 그리드 안에서 해당 항목 컬럼에 배치"라고 판단한 방식)가 모바일
단일 컬럼으로 줄어들 때도 "어떤 항목이 문제인지 바로 알 수 있는" 인접성을 유지하는가?**

답변: 유지된다. `ui.tsx` 719~767행 구조를 보면, 그리드(`grid gap-4 sm:grid-cols-3`)의
각 열이 `<div className="space-y-3">`로 "항목 카드 + (조건부) 경고 카드"를 하나의
컬럼으로 묶고 있다. `sm:` 미만(모바일)에서는 `grid-cols`가 지정되어 있지 않아 암묵적으로
단일 컬럼으로 쌓이는데, 이때도 DOM 순서상 "무주택기간 카드 → 무주택 경고(있으면) →
부양가족수 카드 → 청약통장 카드 → 통장 경고(있으면)" 순서가 그대로 유지되므로, 세로로
스크롤해도 경고가 항상 자신이 속한 항목 바로 아래 나온다. 데스크톱 3열 레이아웃에서는
경고가 있는 컬럼만 세로로 더 길어져 카드 높이가 열마다 달라질 수 있으나(사소한 시각적
비대칭), "어떤 항목에 문제가 있는지"를 헷갈리게 하지는 않는다. Builder의 배치 판단은
지시("해당 항목 바로 아래")의 의도를 정확히 달성한다(단, 실제 브라우저 렌더링 확인은
QA 영역).
**등급: 문제없음** (열 높이 비대칭은 Low 수준의 시각적 사소한 점으로 별도 기록).

**[평가 항목: 모바일 사용성(레이아웃)] 질문 9 — 320px 너비에서 라디오형 토글 그룹
(혼인 여부/주택 소유 이력/배우자 인정/통장 보유)의 레이아웃이 잘리거나 겹치지 않는가?**

답변: 코드 검토 기준으로는 문제가 없어 보인다. 2열 토글(혼인 여부·배우자 인정·통장
보유)은 `grid max-w-xs grid-cols-2 gap-2` — `max-w-xs`(20rem)로 제한돼 있어 320px
뷰포트 안에서도 넘치지 않고, 3열 토글(주택 소유 이력, 411행)은 `grid gap-2
sm:grid-cols-3`로 모바일에서는 1열로 자동 축소된다. 각 옵션 버튼은 `px-3 py-2.5`로
충분한 터치 영역(약 40px 높이 이상)을 확보한다.
**등급: 문제없음** (레이아웃 관점 확인 — 실제 기기·브라우저 렌더링 검증은 QA 영역).

**[평가 항목: 오류 메시지의 이해 용이성] 질문 10 — 검증 오류 메시지가 어떤 필드를
어떻게 고쳐야 하는지 구체적으로 안내하는가?**

답변: 그렇다. `validation.ts`의 오류 메시지는 필드명과 구체적 조건을 자연어 문장으로
결합한다(예: "혼인신고일은 생년월일보다 빠를 수 없습니다.", "기준일은 오늘로부터 5년
이내로 입력해 주세요.", "인정되는 직계존속 수는 4명 이하로 입력해 주세요."). 모두
`role="alert"`로 표시되고 해당 입력 바로 아래(`errorFor` 헬퍼로 필드별 매칭) 배치돼
어떤 필드의 문제인지 헷갈릴 일이 없다. 다만 "직계존속"/"직계비속" 관련 오류 메시지는
라벨과 동일한 용어 노출 문제를 그대로 물려받는다(필수질문 1과 동일 원인이라 중복
집계하지 않음).
**등급: 문제없음** (메시지 구조·구체성 자체는 우수; 용어 이슈는 필수질문 1로 이관).

**[평가 항목: 계산 과정(근거 breakdown)을 이해할 수 있는지] 질문 11 — breakdown 문장이
계산법을 몰라도 "왜 이 점수가 나왔는지"를 이해시키는가?**

답변: 그렇다. `formatting.ts`의 세 행이 전부 "입력값 → 구간 → 점수" 순서로 실제 값을
대입한다. 예: "2019년 5월 1일부터 2026년 9월 6일까지 7년 경과 → 7년 이상 ~ 8년 미만
구간 → 16점", "배우자 1명 + 직계존속 1명 + 직계비속 1명 = 3명 → 5점 + 5점 × 3명 = 20점"
처럼 산식 자체를 문장에 노출해, 사용자가 배점표를 몰라도 "내 입력값이 이렇게
계산됐구나"를 따라갈 수 있다. 캡(상한) 적용 시 "(15년 이상 상한 적용)"/"(6명 이상 상한
적용)" 문구가 덧붙어 왜 더 높은 점수가 아닌지도 설명한다. 요건 미충족 사유(만 30세
미만 미혼, 현재 소유 중)도 별도 문장으로 명확히 안내한다(`buildHomelessRow` 50~63행).
**등급: 문제없음.**

**[평가 항목: 불필요한 UI 요소 존재 여부] 질문 12 — 결과 화면에 breakdown/입력값과
중복되거나 굳이 필요 없는 섹션이 있는가?**

답변: "적용된 입력값"(`SectionCard`, 784~819행)이 "계산 방법" breakdown과 일부 정보가
겹친다(생년월일·기준일·혼인 여부 등). 다만 breakdown은 "계산 과정"에 초점을 맞춘
문장형이고, "적용된 입력값"은 "내가 실제로 무엇을 입력했는지"를 표 형태로 빠르게
재확인하는 용도라 목적이 다르며, 공유 링크로 결과를 받은 제3자가 원본 입력을 빠르게
파악하는 데도 유용하다. 과도한 중복이라기보다 상호 보완적이다.
**등급: 문제없음(경미한 정보 중복, Low 수준으로도 지적할 정도는 아님).**

**[평가 항목: 불필요한 UI 요소 존재 여부] 질문 13 — "정책 안내" 섹션의 배지 4개(법령명/
버전/확인일/재검토일)가 정보 과잉으로 화면을 어지럽히는가?**

답변: 아니다. 4개 배지는 `text-xs`의 작은 pill 형태(823~836행)로 한 줄에
`flex-wrap`으로 배치돼 시각적 비중이 낮고, 정책형 계산기의 신뢰성 표시(기준 시행일·
재검토일 명시는 SPEC.md Must Have "기준일자 표시" 요구사항)로서 실질적 근거가 있다.
**등급: 문제없음.**

**[평가 항목: 계산 과정을 이해할 수 있는지 / 결과 가독성] 질문 14 — "상한 도달" 배지가
사용자에게 정확한 의미(더 잘해도 이 이상 점수가 오르지 않는다는 뜻)를 전달하는가?**

답변: `ItemScoreCard`(162~192행)의 "상한 도달" 배지는 실제로 상한이 적용됐을 때만
(`homelessPeriodCapped` 등 실제 캡이 걸린 경우만 true) 표시되고, 카드 안에 "O / 최대
점수"가 항상 함께 표시돼 그 숫자가 이 항목의 최댓값이라는 것을 유추하기 쉽다. 다만
배지 텍스트 "상한 도달"만으로는 "그래서 더 채워도 소용없다"는 의미까지는 명시적으로
설명하지 않는다(암묵적 유추에 의존).
**등급: Low.**

### 발견된 이슈 (등급별 요약표)

| 등급 | 이슈 | 근거 |
|---|---|---|
| Critical | 없음 | — |
| **High** | "인정되는 직계존속 수"/"인정되는 미혼 직계비속 수" 라벨·helpText가 법령 친족 용어를 그대로 노출하고, 그 용어가 누구를 가리키는지(부모님/조부모님, 자녀/손자녀) 라벨·helpText·FAQ 어디에도 설명이 없어 오입력(→오점수) 위험이 있다 | 필수질문 1, DESIGN_SYSTEM.md "라벨 표현", SPEC.md "법령 용어를 몰라도 쓸 수 있는 도구" 목적 |
| Medium | `hasQualifyingSpouseInHousehold`가 `isMarried`와 사실상 항상 같아야 하는데(FORMULA.md상 예외 없음) 별도 입력으로 중복 요청되고, "아니요"를 선택해야 하는 경우에 대한 안내가 없다 | 필수질문 4 |
| Medium | 위 직계존속/직계비속 라벨 이슈로 인해 "계산법을 몰라도 끝까지 입력 가능"이라는 목적이 그 두 필드에서 흔들린다 | 질문 5(필수질문 1과 동일 원인, 별도 집계 아님— 참고용) |
| Medium | 정책 특례 3종("v1 미반영") 고지가 항상 노출되지만, 경고 카드와 달리 색상·아이콘 강조가 없고 결과 화면 맨 아래에 위치해 "내 점수가 다를 수 있다"는 메시지를 놓치기 쉽다 | 질문 7 |
| Low | `baseDate`가 세 기간 모두의 종료일 역할을 하면서 최상단에 단독 배치돼, 청약통장 가입일 등과 화면상 멀리 떨어진다(helpText로 보완됨) | 필수질문 2 |
| Low | 데스크톱 3열 그리드에서 경고 카드가 있는 컬럼만 높이가 길어져 시각적으로 살짝 비대칭 | 질문 8 |
| Low | "상한 도달" 배지가 "더 채워도 소용없다"는 의미를 명시적으로 설명하지 않음(암묵적 유추) | 질문 14 |

(위 "Medium(질문 5)"은 필수질문 1과 원인이 같아 등급별 집계에서 중복 카운트하지
않았다 — 실제 서로 다른 이슈는 위 표의 High 1건 + Medium 2건 + Low 3건이다.)

### 최종 판정: **FAIL**

- Critical: 0
- **High: 1** (직계존속/직계비속 라벨·helpText 미순화 — docs/EVALUATION.md PASS 기준
  "Critical 0, High 0"을 충족하지 못함)
- Medium: 2 (배우자 부양가족 인정 필드 중복, 정책 특례 3종 고지 프롬넌스 부족)
- Low: 3 (기준일-가입일 이격, 카드 높이 비대칭, 상한 배지 설명 부족)

계산 정확성(Calculation Auditor, 최종 PASS)과 별개로, UX 관점에서 SPEC.md의 핵심
목적("법령 용어를 몰라도 쓸 수 있는 참고용 도구")을 정면으로 위반하는 High 등급 이슈가
1건 있어 **FAIL**로 판정한다. 다음 Optimizer 라운드에서 다음을 권고한다:
1. (필수, High) "인정되는 직계존속 수"/"인정되는 미혼 직계비속 수" 라벨 또는 helpText에
   평이한 설명을 추가한다(예: 라벨 옆 보조 설명 "(부모님·배우자의 부모님 등)" /
   "(자녀·손자녀 등)", 또는 helpText 첫 문장에 "직계존속이란 부모님·조부모님처럼
   본인보다 윗세대인 직계가족을 말합니다"를 추가). FAQ에도 한 항목 추가를 권고한다.
2. (권고, Medium) `hasQualifyingSpouseInHousehold` 필드에 "혼인 상태라면 대부분 '예'를
   선택하면 됩니다. '아니요'를 선택해야 하는 경우: (예시)"와 같은 구체적 안내를
   helpText에 추가하거나, FORMULA.md에 예외 시나리오가 실제로 없다면 이 필드 자체의
   필요성을 Architect/Formula Analyst와 재검토한다.
3. (권고, Medium) 정책 특례 3종 고지를 핵심 결과 카드 근처(또는 최소한 결과 화면
   상단)에 한 줄 요약("일부 특례는 반영되지 않아 실제 점수와 다를 수 있습니다 — 아래
   '정책 안내' 참고" 등)으로 예고하거나, 해당 섹션에 경고 계열 강조(아이콘/보더 색)를
   추가하는 것을 검토한다.

## Optimizer 수정 (라운드 2)

2026-09-06. UX/UI Critic 보고서(위 "## UX/UI Critic", 판정 FAIL)가 지적한 High 1건 +
Medium 2건을 `src/calculators/housing-subscription-score/ui.tsx`에서만 텍스트/스타일
수준으로 수정했다. 계산 로직(`logic.ts`/`policy.ts`)과 FORMULA.md/SPEC.md/
ARCHITECTURE.md, validation.ts의 검증 로직은 건드리지 않았다. Low 3건(baseDate 배치,
그리드 비대칭, 상한 배지 의미)은 지시대로 이번 라운드에서 다루지 않았다.

### 수정한 파일

- `src/calculators/housing-subscription-score/ui.tsx` — 유일하게 수정한 파일.

#### High — "인정되는 직계존속 수" / "인정되는 미혼 직계비속 수" 라벨·helpText

라벨은 그대로 두었다(변경하지 않음). 이유: 이 라벨 문자열은 `validation.ts`의 오류
메시지("인정되는 직계존속 수를 입력해 주세요." 등), `formatting.ts`의 breakdown
문장("직계존속 {n}명 + 직계비속 {n}명"), `content.ts`의 사용법 3단계 문구와 동일한
용어를 쓰고 있어(DESIGN_SYSTEM.md "같은 개념은 폼·결과·오류 메시지 전체에서 한 용어로
통일한다"), 라벨만 바꾸면 화면 안에서 용어가 갈라지는 새로운 불일치를 만들게 된다.
Critic 보고서가 제시한 두 대안 중 "라벨은 유지하되 helpText 맨 앞에 평이한 뜻을 반드시
추가"를 택했다(보고서 예시 문구 "직계존속(부모님·조부모님 등)은..."을 그대로 채택).
검증 조건(3년 동거+무주택, 30세 이상 1년 동거)이나 상한값(`MAX_ASCENDANT_COUNT`/
`MAX_DESCENDANT_COUNT`)은 손대지 않았다.

- `qualifyingAscendantCount` helpText(558~563행): "직계존속(부모님·조부모님 등,
  배우자의 부모님·조부모님 포함)은 신청자보다 윗세대인 가족을 말합니다."를 문장 맨
  앞에 추가하고, 기존 인정 요건 설명(3년 이상 동거·무주택)은 그 뒤에 그대로 이어붙였다.
- `qualifyingDescendantCount` helpText(585~589행): "직계비속(자녀·손자녀 등)은
  신청자보다 아랫세대인 가족을 말합니다."를 문장 맨 앞에 추가하고, 기존 인정 요건
  설명(미혼+30세 미만 또는 30세 이상 1년 동거)은 그 뒤에 그대로 이어붙였다.

#### Medium 1 — `hasQualifyingSpouseInHousehold`(배우자 부양가족 인정) 중복 질문

FORMULA.md "부양가족 인정 범위"의 배우자 항목("주민등록이 분리되어 있어도 세대 분리
인정된다")과 "확인 필요 항목 총정리" 7~8번을 다시 확인했다 — `isMarried=true`인데도
배우자가 부양가족으로 인정되지 않는 예외 시나리오는 FORMULA.md 어디에도 서술되어 있지
않다(이혼·재혼 이력은 별도 "확인 필요" 항목 7번으로 이미 범위 밖으로 분류되어 있고,
이 필드의 "아니요" 답과 직접 연결되지 않는다). 즉 실제 예외 시나리오는 존재하지
않는다고 판단했다 — 지시받은 대로 필드 자체를 없애지 않고(구조 변경은 Architect
영역) helpText로 "왜 별도로 물어보는지"만 설명했다.

- `hasQualifyingSpouseInHousehold` helpText(533~539행, `isMarried=true`일 때 분기):
  기존 "배우자는 주민등록이 분리(세대 분리)되어 있어도 부양가족으로 인정됩니다." 뒤에
  "혼인 상태라면 이 항목은 거의 항상 '예'이며, 아래 '계산 방법'에서 배우자를 부양가족
  인원에 포함했는지 명확히 보여드리기 위해 혼인 여부와 별도로 확인합니다."를 이어
  붙였다. 새로운 예외 시나리오를 지어내지 않았고, 필드·기본값·검증 로직은 그대로다.

#### Medium 2 — 정책 특례 3종 고지의 시각적 우선순위

"정책 안내" `SectionCard` 맨 아래, 일반 본문 텍스트(`text-sm`, `text-muted`)로만
표시되던 정책 특례 3종 블록(853~863행 원본)을, docs/DESIGN_SYSTEM.md "카드/표면 패턴"의
기존 경고 토큰(`border-warning-border`/`bg-warning-surface`)과 `WarningCard`
컴포넌트(145~159행)가 이미 쓰고 있는 경고 아이콘(SVG, 같은 `path`)을 재사용해
감쌌다(858~884행). 새 색상 토큰은 추가하지 않았다(지시대로). 제목 문구에도 "(항상
안내)"만 있던 것을 "(항상 안내 — 실제 점수와 다를 수 있습니다)"로 보강해, 이 블록까지
스크롤하지 않아도(정책 안내 섹션 진입 즉시) 핵심 메시지가 먼저 눈에 띄도록 했다. 본문
텍스트 색상도 `text-muted`에서 `WarningCard`와 동일한 `text-zinc-700 dark:text-zinc-300`
(경고 표면 위에서의 기존 관행, DESIGN_SYSTEM.md 명도 대비 기준)으로 맞췄다.
핵심 결과 카드 자체를 수정하거나 새 문구를 그 위치에 추가하지는 않았다(Critic이 제시한
두 대안 중 "해당 섹션에 경고 계열 강조를 추가" 쪽을 택함 — 핵심 결과 카드 변경은
ARCHITECTURE.md "6."이 이미 확정한 카드 구성을 건드리는 더 큰 변경이라 판단해 보류).

### 하지 않은 것 (범위 밖)

- Low 3건(baseDate 배치, 카드 높이 비대칭, "상한 도달" 배지 설명 부족)은 지시대로 이번
  라운드에서 다루지 않았다.
- Critic 보고서가 "권고"로 덧붙인 FAQ 항목 추가(High 항목의 부가 제안)는 오케스트레이터
  지시 범위("ui.tsx의 라벨·helpText만 수정")에 없어 추가하지 않았다 — 새 기능/콘텐츠를
  임의로 추가하지 않기 위함이다.
- `validation.ts`/`formatting.ts`/`content.ts`/`policy.ts`/`logic.ts`/FORMULA.md/
  SPEC.md/ARCHITECTURE.md는 전혀 수정하지 않았다.

### 검증 실행 결과

- `npx vitest run --no-file-parallelism`(전체 스위트) — **47개 파일 466개 테스트 전부
  통과**(회귀 없음, `ui.test.tsx` 8개 포함 — 기존 테스트가 이 두 필드·정책 특례 블록의
  정확한 라벨/클래스 문자열을 assert하지 않고 있어 테스트 파일 자체는 수정할 필요가
  없었다).
- `npx tsc --noEmit` — 오류 0.

### 참고

- 최종 PASS/FAIL 재판정은 UX/UI Critic의 몫이다.

## UX/UI Critic 재검증 (라운드 1)

2026-09-06. Edit 권한 없이 `src/calculators/housing-subscription-score/ui.tsx`를 다시
읽고, 위 "## Optimizer 수정 (라운드 2)"가 주장하는 세 가지 수정이 실제 파일에 반영됐는지
바이트 단위로 대조했으며(라벨 문자열 544~546행/571~573행 미변경 확인, helpText
558~563행/585~589행/533~539행 변경 확인, 정책 특례 블록 858~884행 스타일 확인),
`docs/DESIGN_SYSTEM.md` "입력 라벨·순서"·"카드/표면 패턴"과 다시 대조했다. 처음부터 10개
질문을 새로 만들지 않고, 지시대로 이전 라운드(위 "## UX/UI Critic")의 자체 평가 질문 중
이번 수정과 직접 관련된 4개(★필수질문 1, ★필수질문 4, 질문 5, 질문 7)만 재확인하고,
새로운 문제 발생 여부(질문 15 신설)를 추가로 점검했다.

### 재확인 질문 · 답변 · 등급

**[평가 항목: 입력 라벨 표현·순서·그룹핑] ★필수질문 1 재확인 — helpText 맨 앞에 추가된
설명이 일반 사용자가 "직계존속"/"직계비속"의 뜻을 실제로 이해할 수 있는 수준인가?
"라벨은 유지, helpText만 보강"이라는 선택이 문제를 실제로 해소하는가?**

답변: 실제 파일을 대조한 결과, 수정 내용은 보고와 정확히 일치한다.

- `qualifyingAscendantCount` helpText(558~563행): "직계존속(부모님·조부모님 등,
  배우자의 부모님·조부모님 포함)은 신청자보다 윗세대인 가족을 말합니다. 그 중 신청자
  또는 배우자와 3년 이상 계속 동일 주민등록표에 등재되어 있고, 본인 소유 주택이 없는
  사람 수를 입력하세요(상한 4명)."
- `qualifyingDescendantCount` helpText(585~589행): "직계비속(자녀·손자녀 등)은 신청자보다
  아랫세대인 가족을 말합니다. 그 중 미혼 자녀로서 만 30세 미만이거나, 만 30세 이상이면서
  최근 1년 이상 계속 동일 주민등록표에 등재된 사람 수를 입력하세요(상한 10명)."

이전 라운드가 지적한 핵심 결함은 "직계존속/직계비속이 누구를 가리키는지 화면 어디에도
없다"는 정보 공백 자체였다. 이제 두 helpText 모두 문장 맨 앞에 "부모님·조부모님 등,
배우자의 부모님·조부모님 포함"/"자녀·손자녀 등"이라는 구체적이고 평이한 예시를 명시해,
사용자가 인원수를 세기 전에 "누구를 포함해야 하는지" 판단할 근거를 실제로 얻는다. 이
문장은 지난 라운드 보고서가 직접 제시한 두 대안 중 하나("helpText 첫 문장에 평이한 뜻
추가")를 예시 문구 수준까지 거의 그대로 채택한 것이라, "제안한 해법이 실제로 이행됐는가"
기준으로는 충실히 이행됐다.

다만 "라벨을 바꾸지 않고 helpText만 보강"하는 선택 자체를 냉정히 재평가하면, 이는
`docs/DESIGN_SYSTEM.md` "라벨 표현"이 명시한 방향과 **정반대**다. 그 절은 "라벨은
일반 사용자 표현, 법령 용어가 필요하면 helpText에 넣는다"(예: 라벨 "퇴사일" + helpText
"고용보험법상 '이직일'과 같습니다")는 구조를 요구하는데, 이번 수정은 라벨이 여전히
법령 용어("직계존속"/"직계비속")이고 helpText가 그것을 평이하게 "번역"해 주는 반대
구조다. Optimizer가 제시한 "라벨을 바꾸면 validation.ts/formatting.ts/content.ts의
동일 용어와 갈라진다"는 근거는, 뒤집어 보면 "그 세 파일도 함께 순화했어야 한다"는
뜻이지 "라벨을 순화하지 않아도 된다"는 뜻은 아니다(severance-pay 선례도 "이직일"이
아니라 "퇴사일"로 관련 파일 전체를 통일했으리라 추정된다 — 라벨만 예외로 남기는 것은
DESIGN_SYSTEM.md가 요구하는 전체 통일과는 다른 방향의 통일이다). 즉 이번 수정은
"허용된 범위(ui.tsx만)" 안에서 나올 수 있는 최선의 대응이었을 뿐, DESIGN_SYSTEM.md
기준으로 100% 정합한 최종형은 아니다 — 근본적으로 바르게 고치려면 validation.ts/
formatting.ts/content.ts까지 포함한 더 넓은 범위(Architect/Formula Analyst 조정 필요)의
후속 작업이 남아 있다.

그럼에도 이번 재평가에서 가장 중요한 기준은 "실제 사용자가 오입력할 위험이 줄었는가"다.
이 helpText는 (1) 해당 입력 바로 아래 `aria-describedby`로 연결되어 있고(552행/579행
확인), (2) 예시 단어("부모님·조부모님", "자녀·손자녀")가 법령 용어보다 먼저 나와
스크린리더·시각 사용자 모두에게 첫 문장만 읽어도 뜻이 전달되며, (3) FORMULA.md가 정의한
포함 범위(배우자의 부모님·조부모님 포함)까지 정확히 반영해 실제 산정 기준과 어긋나는
축약이 없다. 이는 "라벨만 봐서는 이해 못 한다"는 잔여 위험(라벨 자체는 여전히 전문
용어)은 남기지만, "이해할 근거 자체가 화면에 없다"는 이전 라운드의 핵심 지적(오입력→
오점수로 이어지는 실질적 위험)은 실질적으로 해소한다.
**등급: Medium(다운그레이드, High → Medium)** — 정보 공백은 해소됐으나
DESIGN_SYSTEM.md "라벨 표현" 원칙과는 여전히 어긋나는 구조이고, helpText를 건너뛰는
사용자에게는 라벨만으로 여전히 불친절하다. Critical/High로 볼 근거(오입력으로 직결되는
정보 부재)는 사라졌다고 판단한다.

**[평가 항목: 입력 라벨 표현·순서·그룹핑] ★필수질문 4 재확인 — `hasQualifyingSpouseInHousehold`
helpText 보강이 "왜 별도로 물어보는지"를 실제로 납득시키는가?**

답변: 533~539행을 확인했다. `isMarried=true` 분기 helpText가 "배우자는 주민등록이
분리(세대 분리)되어 있어도 부양가족으로 인정됩니다." 뒤에 "혼인 상태라면 이 항목은
거의 항상 '예'이며, 아래 '계산 방법'에서 배우자를 부양가족 인원에 포함했는지 명확히
보여드리기 위해 혼인 여부와 별도로 확인합니다."를 추가한 것을 확인했다(보고와 일치).
이전 라운드의 핵심 우려는 "이 필드가 `false`가 되어야 하는 시나리오가 설명돼 있지
않다"였는데, 새 문장은 그 시나리오를 지어내지 않는 대신 "이 항목은 거의 항상 예"라고
명시해 사용자가 "특별한 사정이 없다면 그냥 예를 선택하면 된다"는 확신을 얻게 하고,
"왜 이미 답한 혼인 여부를 또 묻는가"라는 의문에도 "계산 근거 투명성(breakdown에 명시적
표시)" 목적이라는 답을 준다. 다만 "그렇다면 이 필드를 없애고 `isMarried`에서 자동
유도하면 되지 않는가"라는 구조적 의문(★필수질문 4가 원래 겨냥한 "유도 가능한 값 중복
질문")은 여전히 남는다 — 이는 UI 텍스트로는 근본적으로 해소할 수 없는 아키텍처 수준의
문제이고, Optimizer도 "구조 변경은 Architect 영역"이라며 범위 밖으로 명시했다.
**등급: Low(다운그레이드, Medium → Low)** — 오입력 위험(설명 없이 "아니요"를 잘못
선택)은 helpText로 충분히 낮아졌으나, 필드 자체의 구조적 중복은 여전히 남아 있어
완전한 "문제없음"으로는 판정하지 않는다. 향후 Architect 재검토를 권고 사항으로 유지한다.

**[평가 항목: 결과 가독성] 질문 7 재확인 — 정책 특례 3종 고지의 시각적 우선순위가
실제로 개선됐는가?**

답변: 858~884행을 확인했다. 원래 `text-sm`/`text-muted` 일반 텍스트였던 블록이
`WarningCard`와 동일한 `border-warning-border`/`bg-warning-surface` 카드로 감싸졌고,
`WarningCard`가 쓰는 것과 동일한 경고 삼각형 SVG 아이콘(861~871행, path 문자열까지
`WarningCard`의 150~152행과 동일)이 추가됐으며, 제목이 "(항상 안내)"에서 "(항상 안내
— 실제 점수와 다를 수 있습니다)"로 보강됐다(872~875행). 본문 텍스트 색상도
`text-zinc-700 dark:text-zinc-300`으로 조정돼(880행) 경고 카드 안에서의 명도 대비가
`WarningCard` 본문(156행)과 일치한다. 이전 라운드가 제시한 두 대안(① 결과 상단 요약,
② 해당 섹션에 경고 강조 추가) 중 ②를 충실히 이행했고, 코드 검토 기준으로 "정책 안내"
섹션에 진입하는 즉시(스크롤로 그 섹션에 도달하면) 노란 경고 카드가 눈에 띄어 이전보다
"무시하고 지나칠 가능성"이 낮아졌다고 판단한다. 다만 위치 자체(결과 화면 맨 아래,
"계산 방법"·"적용된 입력값"을 지나야 도달)는 그대로다 — 즉 "결과 화면을 끝까지 스크롤
하지 않는 사용자"에게는 여전히 도달하지 않을 수 있다는 잔여 위험은 남지만, 이는
Optimizer가 명시적으로 보류한 범위(핵심 결과 카드 변경)이고, 이전 라운드가 두 대안을
모두 유효한 해법으로 제시했으므로 그중 하나를 택해 완수한 것을 미이행으로 볼 수 없다.
**등급: Low(다운그레이드, Medium → Low)** — 스타일 강조는 목적대로 이행됨. 위치
문제(결과 화면 맨 아래)는 잔여 사항으로 기록하되, 향후 라운드에서 "선택 사항"으로
남긴다(이전 라운드가 필수로 요구한 항목은 아니었음).

**[신규] 질문 15 — 이번 수정(helpText 문장 추가)으로 helpText가 과도하게 길어져
오히려 가독성이 떨어지는 새로운 문제가 생기지 않았는가?**

답변: `qualifyingAscendantCount`/`qualifyingDescendantCount` helpText는 각각 정의
문장(1개) + 기존 인정 요건 문장(1개)이 이어져 총 2문장, 약 90자 내외로 늘었다(수정 전
대비 약 40~50% 증가). 같은 파일 안의 다른 helpText(예: "최근 처분일" helpText 465~468행,
"청약통장 최초 가입일" helpText 651~654행)가 대체로 1~2문장·40~60자 수준인 것과
비교하면 이 두 곳이 상대적으로 길다. `text-xs text-muted`(HELP_CLASS)로 렌더링되므로
모바일 좁은 화면에서는 4~5줄로 줄바꿈될 가능성이 있다. 다만 (1) 두 문장이 각각 "정의"와
"인정 요건"이라는 명확히 다른 역할을 하고 있어 내용이 뒤섞여 읽기 어렵지는 않고, (2) 이
필드들은 원래도 인정 요건(3년 동거·무주택 등) 자체가 복잡해 어느 정도 긴 설명이
불가피한 필드였으며, (3) 같은 파일의 "정책 특례" 고지 문구(content.ts)들은 이보다 훨씬
긴 문장을 이미 쓰고 있어 이 계산기 전체의 문체 기준에서 크게 벗어나지 않는다.
**등급: Low** — 새로운 문제로 보되, 차단 사유는 아니다. 두 문장을 개행하거나(`<br/>`
또는 별도 `<p>`) 정의 부분만 라벨 옆 작은 배지로 분리하는 개선을 향후 라운드에서
검토할 만하다.

### 회귀 확인

`ui.tsx` 외 다른 파일(`validation.ts`/`formatting.ts`/`content.ts`/`logic.ts`/
`policy.ts`)은 이번 라운드에서 전혀 수정되지 않았음을 재확인했다(Read로 직접 대조,
Optimizer 보고와 일치). 라벨 문자열(544~546행 "인정되는 직계존속 수", 571~573행
"인정되는 미혼 직계비속 수")과 상한값(`MAX_ASCENDANT_COUNT`/`MAX_DESCENDANT_COUNT`
참조부)도 그대로임을 확인해, "필요한 부분만 수정하고 나머지는 건드리지 않았다"는
Optimizer의 주장과 실제 코드가 일치한다. `aria-describedby` 연결(552행/579행)도
helpText id가 그대로 유지되어 손상되지 않았다.

### 발견된 이슈 (재검증 후, 등급별 요약표)

| 등급 | 이슈 | 라운드 1 대비 |
|---|---|---|
| Critical | 없음 | — |
| High | 없음 | (해소, 이전 1건 → Medium으로 다운그레이드) |
| Medium | "인정되는 직계존속 수"/"인정되는 미혼 직계비속 수" 라벨 자체는 여전히 법령 용어이고, DESIGN_SYSTEM.md "라벨=평이한 표현, helpText=법령 용어" 방향과 반대 구조다(helpText를 건너뛰는 사용자에게는 여전히 불친절). 정보 공백 자체는 helpText로 해소됨 | 다운그레이드(High→Medium) |
| Low | `hasQualifyingSpouseInHousehold` 필드의 구조적 중복(설명은 추가됐으나 필드 자체 존재 이유는 helpText로 완전히 해소되지 않음, Architect 재검토 권고 유지) | 다운그레이드(Medium→Low) |
| Low | 정책 특례 3종 고지가 결과 화면 맨 아래에 위치한 것은 그대로(스타일 강조만 추가) | 다운그레이드(Medium→Low) |
| Low | (신규) 직계존속/직계비속 helpText가 같은 파일의 다른 helpText보다 눈에 띄게 길어짐 | 신규 |
| Low | (라운드 1에서 이월, 이번에 다루지 않음) `baseDate` 배치, 카드 높이 비대칭, "상한 도달" 배지 설명 부족 | 변경 없음 |

### 최종 판정: **PASS**

- Critical: 0
- High: 0 (이전 1건, Medium으로 다운그레이드 확인)
- Medium: 1 (직계존속/직계비속 라벨 자체는 여전히 DESIGN_SYSTEM.md 표준 방향과
  어긋나는 구조 — 기능적 위험은 해소됐으나 구조적 잔여 이슈로 기록)
- Low: 5 (배우자 필드 구조적 중복, 정책 특례 고지 위치, helpText 길이 증가, baseDate
  배치, 카드 높이 비대칭/상한 배지 설명 — 마지막 2건은 이월)

docs/EVALUATION.md PASS 기준("Critical 0, High 0")을 충족한다. Optimizer의 수정은
이전 라운드가 지적한 실질적 위험(직계존속/직계비속을 몰라 오입력·오점수로 이어질 위험,
배우자 필드를 이유 없이 다시 물어본다는 의문, 정책 특례 고지가 시각적으로 완전히
묻힘)을 코드 대조 결과 실제로 낮췄다. 다만 "라벨은 그대로 두고 helpText만 보강"하는
선택은 DESIGN_SYSTEM.md "라벨 표현" 절이 명시한 구조(라벨=평이한 표현, helpText=법령
용어)와는 반대 방향이라는 점에서 완전한 정합은 아니며, 이를 Medium 등급 잔여 이슈로
남긴다 — 다음 개선 Loop(또는 향후 전체 계산기 일괄 정비 시)에서 라벨 자체를 평이한
표현으로 바꾸고 validation.ts/formatting.ts/content.ts까지 함께 통일하는 것을
Architect/Formula Analyst와 함께 검토할 것을 권고한다. 이는 PASS를 막는 사유는 아니다.

## Optimizer 수정 (라운드 3, QA 대응)

2026-09-06. QA(`tasks/housing-subscription-score/QA.md`, 판정 PASS, Medium 3건/Low 3건
발견) 보고서를 대응했다. 계산 로직(`logic.ts`/`policy.ts`)은 이번에도 건드리지 않았고,
QA.md에 없는 개선은 추가하지 않았다.

### 수정한 파일

- `src/calculators/housing-subscription-score/ui.tsx`
  - **M-2 (`hasQualifyingSpouseInHousehold` 기본값 미동기화, 최우선 수정)**: 범용
    `update()` setter 안에서 `key === "isMarried"`일 때만
    `next.hasQualifyingSpouseInHousehold = value`로 함께 맞추도록 분기를 추가했다.
    `isMarried: false→true` 전환 시 배우자 부양가족 인정을 자동으로 `true`로,
    `true→false` 전환 시 `false`로 되돌린다. `isMarried`가 그대로인 동안 사용자가
    `hasQualifyingSpouseInHousehold`를 수동으로 바꾼 값은 `update("hasQualifyingSpouseInHousehold", ...)`
    호출 경로가 이 분기를 타지 않으므로 그대로 유지된다(매 렌더 강제 덮어쓰기 아님,
    QA가 요구한 정확한 동작).
  - **M-3 (오류 `aria-describedby` 미연결)**: `severance-pay/ui.tsx`(436~440행)의
    "오류 id(있을 때만) + 도움말 id를 join" 방식을 그대로 적용한 로컬 헬퍼
    `combineDescribedBy(...ids)`를 추가하고, 8개 오류 발생 가능 필드
    (`baseDate`/`birthDate`/`marriageDate`/`mostRecentDisposalDate`/
    `qualifyingAscendantCount`/`qualifyingDescendantCount`/`subscriptionAccountOpenDate`/
    `housingStatus`) 전부에 적용했다. 각 오류 `<p role="alert">`에 고유 `id`를 부여하고
    (기존에 `id`가 없었음), 해당 입력의 `aria-describedby`가 오류 발생 시 그 `id`를
    포함하도록 바꿨다. `housingStatus`는 라디오 그룹(단일 입력이 아님)이라 그룹 내
    각 라디오 `<input>`에 동일한 `aria-describedby`(오류 id + 새로 id를 부여한 help
    문단)를 연결했다(military-discharge-date/ui.tsx의 라디오 그룹 오류 처리 방식과
    같은 방향).
  - **M-1 (키보드 포커스 표시 누락)**: 혼인 여부/주택 소유 이력/배우자 부양가족 인정/
    청약통장 보유 여부 4개 토글 그룹의 `label` className에
    `focus-within:ring-2 focus-within:ring-primary`를 추가했다(`business-days`/
    `parental-leave-benefit`의 기존 패턴과 동일한 클래스 조합 — `ring-offset`은 이
    계산기의 다른 필드에 없는 클래스라 추가하지 않음, military-discharge-date의
    `ring-offset-2` 변형까지는 따르지 않았다).
  - **L-1 (결과 카드 그리드 브레이크포인트)**: 항목별 카드 3개 그리드를
    `grid gap-4 sm:grid-cols-3` → `grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3`로
    변경해 `docs/DESIGN_SYSTEM.md` 표준 패턴에 맞췄다.
  - **L-3 (직계존속/직계비속 소수점 무음 정제)**: `qualifyingAscendantCount`/
    `qualifyingDescendantCount`의 `onChange`를 `e.target.value.replace(/[^0-9]/g, "")`
    (비숫자만 제거하고 남은 숫자를 이어붙임)에서 `/^[0-9]*$/.test(e.target.value)`
    검사로 바꿔, 숫자가 아닌 문자가 하나라도 섞여 있으면 그 입력 전체를 무시하고
    상태를 바꾸지 않도록 했다(controlled input이라 다음 렌더에서 이전 값으로
    되돌아간다). `"1.5"` → `"15"`로 조용히 이어붙는 문제가 사라진다.
- `src/calculators/housing-subscription-score/content.ts`
  - **L-2 (FAQPage JSON-LD 미등록)**: `business-days`/`four-major-insurance` 등의
    `xFaqSeoItems` 패턴과 동일하게, 기존 `housingSubscriptionScoreFaqItems`를
    `answer` 배열을 공백으로 join한 평탄화 버전 `housingSubscriptionScoreFaqSeoItems`로
    파생시켜 새로 export했다. 원본 `housingSubscriptionScoreFaqItems`(화면
    `FaqAccordion`용)는 변경하지 않았다.
- `app/calculators/[slug]/page.tsx`
  - `housingSubscriptionScoreFaqSeoItems` import를 추가하고 `faqItemsBySlug` 맵에
    `"housing-subscription-score": housingSubscriptionScoreFaqSeoItems` 항목을
    등록했다(다른 계산기와 동일한 등록 패턴).
- `src/calculators/housing-subscription-score/ui.test.tsx`
  - M-2 회귀 테스트 1건 추가: 초기 상태(미혼)에서 배우자 부양가족 인정이 "아니요"로
    선택돼 있음을 확인 → "혼인" 라디오 클릭 → 배우자 부양가족 인정이 자동으로 "예"로
    바뀌고 "아니요"는 체크 해제됨을 확인 → 다시 "미혼"으로 되돌리면 "아니요"로
    복귀함을 확인.

### 하지 않은 것 (QA.md 범위 밖)

- `logic.ts`/`policy.ts`(계산 로직)는 이번 라운드에서도 전혀 수정하지 않았다.
- QA.md에 명시되지 않은 추가 개선(예: 다른 계산기의 `aria-invalid` 보강, 새로운
  helpText 문구 추가 등)은 하지 않았다.

### 검증 실행 결과

```
npx vitest run --no-file-parallelism (전체 스위트)
→ Test Files 47 passed (47) / Tests 467 passed (467)
  (기존 466개 + M-2 회귀 테스트 1개 신규, 회귀 없음)

npx tsc --noEmit
→ 오류 0

npm run build (next build, Turbopack)
→ 성공, TypeScript 통과, 정적 페이지 생성 정상(15개 페이지)
```

### 참고

- 최종 PASS/FAIL 재판정은 다음 순서(Calculation Auditor → UX/UI Critic → QA)의 몫이며,
  이 문서에서 Optimizer가 최종 판정을 내리지 않는다.
- QA.md의 M-1/M-2/M-3(Medium 전부)과 L-1/L-2/L-3(Low 전부, "시간 되면 반영" 권고였으나
  전부 반영) 총 6건을 이번 라운드에서 반영했다.

## 종합 재검증 (2026-09-06, 오케스트레이터)

세 게이트(Calculation Auditor / UX/UI Critic / QA) 모두 최소 1회 이상 이슈를 지적받고
Optimizer가 수정한 뒤 해당 역할이 직접 재검증해 PASS로 마감했다. 각 라운드의 산출물을
직접 다시 읽고, 다음을 오케스트레이터가 독립적으로 재확인했다.

- **라운드 1 (Calculation Auditor)**: 윤년 2월 29일 "만 30세가 되는 날" 산정 버그를
  Auditor가 코드 실행으로 재현(Medium 판정) → 이 등급이 docs/EVALUATION.md 정의("특정
  정상 입력에서 잘못된 결과" = High)에 비춰 실제로는 High에 해당한다고 오케스트레이터가
  판단해 즉시 수정 경로로 전환 → Formula Analyst가 FORMULA.md 공식 1단계에 민법
  제160조제3항 근거 clamp 규칙과 검증 예제 13·14 추가 → Optimizer가 `logic.ts`의
  `ageThirtyDate()`를 clamp 방식으로 수정 → Auditor가 1996-02-29/2000-02-29 두 케이스를
  재실행해 정확한 날짜에 정확한 점수가 나옴을 재확인 → **PASS**(Critical 0/High 0/Medium
  0/Low 2).
- **라운드 2 (UX/UI Critic)**: 최초 평가 **FAIL**(High 1건 — 직계존속/직계비속 라벨이
  법령 용어 그대로이고 평이한 뜻 설명이 helpText에도 없어 오입력 위험) → Optimizer가
  helpText 맨 앞에 평이한 설명을 추가하고 배우자 필드 안내·정책 특례 고지 스타일을
  보강 → Critic 재검증 결과 High는 Medium으로 다운그레이드(오입력 위험은 해소, 라벨
  자체가 DESIGN_SYSTEM.md 표준 방향과는 여전히 다르다는 구조적 지적만 잔존) → **PASS**
  (Critical 0/High 0/Medium 1/Low 5).
- **라운드 3 (QA)**: 기능·입력검증·접근성·모바일 레이아웃 테스트에서 Medium 3건(배우자
  부양가족 기본값이 혼인여부와 동기화되지 않아 점수가 5점 낮게 나올 수 있는 위험 포함)과
  Low 3건 발견, Critical/High는 처음부터 0 → Optimizer가 전부 수정(기본값 동기화,
  `aria-describedby` 연결, 포커스 링, 그리드 표준화, 숫자 입력 정제, FAQ JSON-LD 등록) →
  QA 재검증에서 6건 전부 해소, 신규 이슈 없음 확인 → **PASS**(Critical 0/High 0/Medium
  0/Low 0).

오케스트레이터가 직접 `npx vitest run --no-file-parallelism`(47개 파일 467개 테스트 전부
통과), `npx tsc --noEmit`(오류 0)을 각 라운드 이후 재실행해 하위 에이전트 보고를 그대로
신뢰하지 않고 검증했다. `logic.ts`/`policy.ts`(계산 로직)는 라운드 1(clamp 수정) 이후
추가로 변경되지 않았다 — 라운드 2·3은 전부 `ui.tsx`/`content.ts`/`page.tsx` 등 UI·문서
레이어였다.

## 점수

| 항목 | 배점 | 획득 | 근거 |
|---|---|---|---|
| 계산 정확성 | 35 | **34** | Calculation Auditor 최종 PASS. Golden Test 14/14(FORMULA.md 예제 12개 + 윤년 clamp 경계 2개), 독립 재계산(별도 스크립트) 일치, 윤년 버그 실사용 재현·수정 확인. 배점표(32/35/17=84)는 2개 이상 독립 2차 출처 완전 일치로 검증했고 무주택기간 기산일 규칙은 law.go.kr 구버전 원문 문구까지 확인했으나, 별표1(가점제 배점표) 자체의 원문 이미지 최종 대조와 청약통장 가입기간 구간의 "이상 vs 초과" 경계 표현은 끝내 100% 확정하지 못했다(공식 조번호도 "확인 필요"로 남음) — 이 잔여 불확실성으로 −1. |
| 예외/경계값 처리 | 15 | **15** | 0/음수/빈값/미래 날짜/날짜 순서 오류/미혼·만30세 미만/현재 소유 중/미가입/6명 초과/15년 이상 상한/6개월·12개월 경계/윤년 2월 29일 경계 전부 Golden Test·validation 테스트로 고정. QA 입력 검증 PASS(Critical/High 0). |
| UX/사용 편의성 | 15 | **13** | UX/UI Critic 재검증 PASS(Critical/High 0). High 1건(라벨 오해 위험) 해소, 다만 "직계존속/직계비속" 라벨 자체가 DESIGN_SYSTEM.md "라벨 표현" 표준 방향과 다르다는 구조적 Medium 1건과 Low 5건(배우자 필드 구조적 중복, 정책 특례 고지 위치, helpText 길이, baseDate 배치, 카드 높이 비대칭)이 잔존 — 실사용성에 치명적이지 않으나 확실한 개선 여지로 −2. |
| 모바일/반응형 | 10 | **9** | 그리드를 DESIGN_SYSTEM.md 표준 패턴(`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)으로 통일, 320~1440px 구조상 가로 스크롤 유발 요소 없음(코드 분석). Playwright 등 브라우저 자동화 도구 부재로 실기기 렌더링 미검증 −1(QA.md에 한계로 명시됨, 기존 계산기들과 동일한 사유). |
| 접근성 | 5 | **5** | label 연결, `aria-describedby`(8개 오류 필드 전부 연결), `role="alert"`, `aria-live="polite"`, 4개 토글 `focus-within:ring`, FaqAccordion aria-expanded/region. |
| 성능/안정성 | 5 | **5** | Console Error 0(SSR+ui.test.tsx로 확인), TypeScript Error 0, `npm run build` 성공, 순수 정수 연산(부동소수점 오차 지점 없음). |
| 설명/계산 근거 | 5 | **5** | breakdown 3행(라벨=값+근거법령), 정책 특례 3종 고지(항상 노출, 경고 스타일), 적용 범위 고지, FAQ 5개, 소개/사용법. |
| SEO/페이지 완성도 | 5 | **5** | registry 등록(현재 `status: draft`), canonical, JSON-LD(WebApplication+FAQPage, 이번 라운드에 FAQ 등록 완료), 공통 페이지 구조 준수. |
| 코드 품질/유지보수성 | 5 | **5** | logic/validation/formatting/ui/policy/content 분리, 매직 넘버 없이 `policy.ts` 단일 참조, `src/lib/date-calc.ts` 공용 헬퍼(다른 계산기 회귀 없음 확인), 신규 테스트 다수(logic 14+validation+formatting+ui). |
| **총점** | 100 | **96** | |

## 최종 판정

PASS 기준(docs/EVALUATION.md): 총점 92+, 계산정확성 33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0

| 기준 | 결과 |
|---|---|
| 총점 92+ | 96 ✅ |
| 계산 정확성 33/35+ | 34 ✅ |
| Critical 0 / High 0 | Auditor·Critic·QA 전부 최종 재검증에서 0 ✅ |
| Golden Test 100% | 14/14 ✅ |
| Console Error 0 / TypeScript Error 0 | ✅ |
| Mobile Critical 0 | ✅ |

**판정: PASS**
개선 Loop 횟수: 3/5 (Auditor 대상 1회, Critic 대상 1회, QA 대상 1회 — 각각 별도 발견 시점에
맞춰 순차 처리, 최대 5회 이내)

### 남은 후속 과제 (발행 비차단, 다음 정기 검토 또는 후속 라운드 권고)

- **법령 원문 최종 대조**: 「주택공급에 관한 규칙」 별표1(가점제 배점표) 원문 이미지와
  1:1 대조, 정확한 조번호 확정(무주택기간 기산일 조항이 구버전 제11조/현행 추정 제27조
  중 어느 쪽인지) — 국가법령정보센터 접속 가능한 사람이 직접 확인 권고.
- 청약통장 가입기간 구간 경계 표현("이상~미만" vs "초과~이하") 최종 확정.
- 직계존속/직계비속 라벨을 helpText 보강이 아니라 라벨 자체를 평이한 표현으로 바꾸고
  `validation.ts`/`formatting.ts`/`content.ts`까지 용어를 통일하는 구조적 개선(Architect
  검토 필요, 현재는 다른 파일과의 용어 통일을 위해 라벨 유지 상태).
- `hasQualifyingSpouseInHousehold` 필드의 구조적 중복 여부 재검토(Architect 영역, 현재는
  helpText로 설명 보강만 완료).
- 정책 특례 3종 고지 위치(결과 화면 맨 아래) 및 배우자 통장 합산 특례의 정확한 산정
  방식(50% 적용 시점) — 확인되는 대로 v1에 반영할지 재검토.
- 다음 정기 재검토: 2027-01-01 또는 「주택공급에 관한 규칙」 개정 시(PROGRESS.md 반영됨).
