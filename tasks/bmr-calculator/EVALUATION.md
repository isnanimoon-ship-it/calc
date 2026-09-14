# EVALUATION: 기초대사량(BMR) 계산기

## Builder 구현 완료

2026-09-13, Builder가 승인된 SPEC.md/FORMULA.md/ARCHITECTURE.md를 그대로 구현했다. 아래는
구현 사실 기록이며 **최종 정확성 판정이 아니다** — 최종 판정은 Calculation Auditor·QA의
몫이다(`.claude/agents/builder.md`). "테스트 통과"라고 적어도 Calculation Auditor·QA는 이를
그대로 신뢰하지 않고 독립적으로 재검증해야 한다.

### 구현 파일

- `src/calculators/bmr-calculator/logic.ts` — `calculateBmr`(대표 공식, Mifflin-St Jeor),
  `calculateBmrAlternative`(보조 공식, Harris-Benedict 개정판, `calculateBmr`을 전혀 참조하지
  않는 완전히 독립된 계산), `calculateTdee(bmrRaw, activityLevel)`(파라미터명을 `bmrRaw`로
  고정해 "반올림 전 값만 받는다"는 계약을 시그니처로 강제), `calculateAllTdeeLevels`(Should
  Have, 5단계 전체 참고표 — 새 산식이 아니라 `calculateTdee`를 레벨별로 호출), 오케스트레이터
  `calculateBmrCalculation`(조립만 담당). ARCHITECTURE.md "1.", "2."가 정한 구조·계약을
  그대로 따랐다 — `tdee = calculateTdee(bmr.raw, ...)`처럼 항상 `bmr.raw`를 명시적으로
  선택해 전달한다(`bmr.display`를 넘기지 않는다).
- `src/calculators/bmr-calculator/validation.ts` — `MIN_AGE`(19)/`MAX_AGE`(78)/
  `MIN_HEIGHT_CM`(100.0)/`MAX_HEIGHT_CM`(230.0)/`MIN_WEIGHT_KG`(20.0)/`MAX_WEIGHT_KG`(300.0)를
  FORMULA.md 그대로 상수화했다. 나이는 `/^\d+$/` 순수 정수 문자열 검사를 먼저 통과해야
  범위를 검사한다(ARCHITECTURE.md "6." — "30.5"·"삼십" 모두 이 단계에서 거부). 성별→나이→
  키→체중 순서로 모든 필드를 검사해 오류를 한 번에 모아 반환한다(첫 오류에서 멈추지 않음,
  `bmi-calculator` 관례). `activityLevel`은 이 파일이 검증하지 않는다 — ARCHITECTURE.md
  "6.1"이 지시한 대로 방어적 처리(1~5 밖 값)는 `logic.ts` 책임으로 남겼다.
- `src/calculators/bmr-calculator/formatting.ts` — kcal 정수/완전정밀도 표시(`formatKcal`/
  `formatKcalPrecise`, `Intl.NumberFormat('ko-KR')`), 나이/키/체중 표시, `ACTIVITY_LEVEL_OPTIONS`
  (선택 안 함 + 5단계, FORMULA.md 표 문구 그대로), 대표/보조 공식·TDEE 계산 근거 문자열
  조립(`buildBmrBreakdown`/`buildBmrAlternativeBreakdown`/`buildTdeeBreakdown`).
- `src/calculators/bmr-calculator/content.ts` — 소개("BMR·TDEE란"), 사용법 3단계, FAQ 8개,
  그리고 SPEC.md "결과 안내"가 요구한 의료 면책 문구 3종(`BMR_RESULT_DISCLAIMERS` — 추정치·
  오차 가능성, 질병/임신·수유/특수 신체 조건 시 의료진 상담 필요, 식단·운동 처방·질병 진단
  아님)을 그대로 옮겼다 — 축약·누락 없이 세 항목 모두 결과 화면 "꼭 확인하세요" 카드와
  정책 안내 섹션 두 곳에 배치했다(SPEC.md "성공 지표: 의료 오해 문구 결함 0건" 대응).
- `src/calculators/bmr-calculator/ui.tsx` — 입력 폼(성별 2택 카드 라디오 → 나이 → 키 →
  체중 → 활동량 6옵션 카드형 라디오, 네이티브 select 아님 — ARCHITECTURE.md "7.2") + BMR
  핵심 카드(항상 렌더링) + TDEE 보조 카드(`result.tdee`가 있을 때만, BMR보다 덜 강조된
  스타일) + "계산 상세"/"계산 방법"(대표 공식·TDEE·보조 공식 breakdown) + "활동량 단계별
  TDEE 비교"(Should Have, `result.tdee`가 있을 때만) + "꼭 확인하세요"(의료 면책) +
  `ShareActions`(계산 전·후 동일 위치) + Reset/Sample(FORMULA.md 검증 예제 3, Male
  45/180cm/85kg/보통 활동) + `UsageGuide`/`IntroSection`/`FaqAccordion` + 정책 안내 섹션.
  공유 URL 복원 시 `activityLevel`이 1~5 중 하나가 아니면 즉시 `null`로 치환한 뒤 검증하고,
  검증을 통과한 경우에만 자동 계산한다(ARCHITECTURE.md "6.1" 1번, SPEC.md Must Have).
- `src/calculators/bmr-calculator/{logic,validation}.test.ts` — 아래 "Golden Test" 참고.
- `src/calculators/registry.ts` — `bmr-calculator` 신규 등록(`title: "기초대사량(BMR)
  계산기"`, `category: "health"`, `icon: "chart"`, **`status: "draft"`**). `icon: "chart"`는
  기존 유니온 타입에 이미 있는 키라 새 아이콘 키 추가는 필요 없었다.
- `src/calculators/calculator-components.ts`, `app/calculators/[slug]/page.tsx` — UI 컴포넌트
  연결 및 FAQPage JSON-LD용 `bmrFaqSeoItems` 매핑 추가.
- `src/calculators/bmr-calculator/types.ts`, `tasks/bmr-calculator/ARCHITECTURE.md`는 Architect
  라운드에서 이미 작성 완료된 상태였고 이번 Builder 라운드에서 수정하지 않았다.

### Golden Test / Edge Case Test

- FORMULA.md 검증 예제 25개 그룹을 ARCHITECTURE.md "8. Golden Test 배치 전략"이 지정한 대로
  `logic.test.ts`(정상 계산값 — #1~9, #11, #13~14, #16~22, #25)와 `validation.test.ts`
  (입력 검증 실패 — #10, #12, #15, #23~24, 그리고 #9·#11·#13~14 경계값이 검증 단계에서도
  통과하는지 재확인)에 나눠 배치했다. 전부 `describe` 블록으로 대표 공식/보조 공식/TDEE/
  오케스트레이터/검증 실패로 그룹화했다.
- `docs/CALCULATOR_RULES.md` "Golden Test — 공식 계산기 예시값과 대조한 케이스 최소 2개"는
  FORMULA.md가 이미 확보한 Inch Calculator 대조 2건(#20 Female 35/165.1cm/54.55kg → 1,241kcal
  일치, #21 Male 60/162.56cm/68.04kg → 1,401.4kcal/day 일치)을 `logic.test.ts`에 출처·확인일
  주석과 함께 그대로 옮겨 충족했다. 이 계산기는 국민연금 계산기와 달리 법령·정책 데이터
  의존이 없어 "라이브 계산기 대조 전까지 draft 유지" 같은 추가 게이트가 없다
  (ARCHITECTURE.md "11.").
- **반올림 정책(중간 반올림 금지) 자체를 검증하는 테스트를 별도로 포함했다**(사용자 지시
  요구사항) — `calculateTdee(1241.375, 5)`(raw 기준, 올바른 정책)와 `calculateTdee(1241, 5)`
  (display를 잘못 넘긴 경우)를 나란히 비교해 raw는 2358.6125 vs 2357.9, **표시값 자체가
  2359 vs 2358로 실제로 1kcal 어긋난다는 것**을 직접 assert했다(FORMULA.md Golden Test #20이
  문서화한 정확한 실패 모드의 재현). 추가로 경계 사례(`bmrRaw=1000.4` vs `bmrDisplay=1000`,
  활동계수 1.9)를 별도로 구성해 raw 기준 1901 vs display 기준 1900으로 표시값이 갈리는
  경계 케이스도 직접 검증했다.
- 완료 기준 불변식(ARCHITECTURE.md "8." 권장) 2개를 추가로 구현했다: (a) 활동계수가
  1.2→1.9로 커질수록 `calculateAllTdeeLevels`/`calculateTdee` 결과가 항상 단조 증가한다,
  (b) 같은 성별·키·체중에서 나이가 1씩 증가하면 `calculateBmr` raw가 항상 정확히 5kcal씩
  감소한다(나이 계수가 선형).
- `isValidActivityLevel` 타입 가드, `ACTIVITY_FACTORS` 상수 자체가 FORMULA.md 표(1.2/1.375/
  1.55/1.725/1.9)와 정확히 일치하는지도 별도로 assert했다.
- Edge Case: 나이 하한/상한 경계(19/78) 자체는 유효, 경계 바로 밖(18/79) 실패; 키·체중 상·
  하한 경계 자체는 유효, 경계 바로 밖(99.9/230.1/19.9/300.1) 실패; 체중 0/음수/빈 값 실패;
  나이 소수/비숫자 문자열 실패; `activityLevel` 1~5 밖 방어적 값(0, 6) 입력 시 BMR만 계산되고
  TDEE는 생성되지 않음; 여러 필드 오류 동시 입력 시 4개 오류 모두 반환.

### 실행 결과

- `npx vitest run`(전체 스위트, 79개 파일 1034개 테스트) — 전부 통과, 기존 계산기 회귀 없음.
- `npx tsc --noEmit` — 오류 없음.
- `npm run build` — 성공(정적 페이지 생성 포함).
- `npx eslint`(bmr-calculator 폴더 + 배선 파일) — 오류 0건, 경고 1건(`aria-required` on
  role=radio) — `loan-interest-calculator`의 상환방식 라디오에도 동일하게 존재하는 기존
  패턴이며, 이번 라운드에서 새로 만든 문제가 아니다.

### 판단이 필요했던 애매한 지점 (다음 역할이 참고할 것)

- **계산 근거 화면을 "계산 상세"/"계산 방법"/"활동량 단계별 TDEE 비교" 3개 SectionCard로
  나눌지, ARCHITECTURE.md 예시처럼 하나로 합칠지** — ARCHITECTURE.md "7.1"은 하나의
  "계산 근거" SectionCard 안에 세 내용을 모두 넣는 레이아웃을 예시로 들었으나,
  `national-pension-benefit-estimate`가 실제로는 "계산 상세"/"계산 방법"/"적용된 입력값"
  3개로 분리한 선례를 따라 이 계산기도 3개로 나눴다(값 확인용 dl과 서술형 breakdown을
  섞지 않는 편이 가독성이 낫다고 판단). 정보 구조 자체는 ARCHITECTURE.md가 요구한 내용을
  모두 포함하므로 배치만 다르다 — UX/UI Critic이 재검토할 여지를 남긴다.
- **TDEE 보조 카드의 정확한 시각 톤** — ARCHITECTURE.md "7.3"은 "BMR보다 덜 강조되어야
  한다"는 방향만 정하고 구체적 색상은 Builder/UX Critic 재량으로 남겼다. `border-primary/30
  bg-primary-soft`(테두리 있는 소프트 배경)를 선택해 BMR의 `bg-primary`(완전히 채운 배경)와
  명확히 구분했다 — 이 선택이 "충분히 덜 강조되었는지"는 UX/UI Critic이 실제 화면으로
  재검토해야 한다.
- **"선택 안 함" 카드의 시각적 구분** — ARCHITECTURE.md "7.2"가 권장한 대로 점선 테두리
  (`border-dashed`) + `bg-surface-subtle` + `text-muted` 제목으로 나머지 5개 "진짜 활동
  단계"와 구분했다. 이 처리가 충분한지는 UX/UI Critic 재검토 대상이다(ARCHITECTURE.md
  "14."가 이미 이 지점을 리스크로 남겨뒀다).
- **활동계수 5단계 비교표를 `result.tdee`가 있을 때만 보여줄지** — SPEC.md Should Have와
  ARCHITECTURE.md "7.1"을 그대로 따라 활동량을 선택하지 않으면 이 표 자체를 렌더링하지
  않았다(비교할 "현재 선택"이 없기 때문). 활동량 미선택 상태에서도 참고용으로 보여줄지는
  이견이 있을 수 있으나, "TDEE 섹션 자체를 만들지 않는다"는 FORMULA.md "계산 순서" 6번의
  취지를 표에도 일관되게 적용하는 것이 맞다고 판단했다.

## Calculation Auditor

### 재검증 (Formula Analyst 출처 정정 후)

**검증일: 2026-09-13. 판정: PASS(전체 최종 판정 확정).** Formula Analyst가 정정한 Golden
Test #21 출처(Omni Calculator)를 독립 재검증했다.

1. `https://www.omnicalculator.com/health/bmr`를 서로 다른 프롬프트로 WebFetch 2회 호출한
   결과, 페이지 제목 "BMR Calculator (Basal Metabolic Rate, Mifflin St Jeor Equation)",
   섹션 "BMR for man calculation – an example", 계산식
   "10×68.04+6.25×162.56−5×60+5=680.4+1016−300+5=1401.4 (kcal/day)"가 FORMULA.md 서술과
   토씨까지 정확히 일치함을 확인했다. Formula Analyst 보고를 그대로 믿지 않고 독립 재현했다.
2. 혼동 우려가 있던 `/health/bmr-harris-benedict-equation` 페이지도 별도로 열람했다 — 실제로
   1918년 Harris-Benedict 원판 계수(66.5+13.75W+5.003H−6.75A 등)를 쓰고 예시 수치가 전혀
   없어, 인용한 `/health/bmr` 페이지와 명확히 다른 별개 페이지임을 확인했다. FORMULA.md의
   주의 문구는 근거가 있었고 실제 혼동은 없다.
3. Inch Calculator(#20)도 재확인해 "BMR = (10×54.55)+(6.25×165.1)–(5×35)–161 = 1,241 kcal"가
   그대로 존재함을 재확인했다.
4. `logic.ts`/`logic.test.ts`는 grep으로 확인한 결과 수치·구조가 전혀 변경되지 않았다.
   다만 `logic.test.ts` 94행 주석이 여전히 "#21 ... Inch Calculator"로 남아 있어 출처
   정정이 테스트 주석에는 반영되지 않았다(**Low** — 계산값은 정확하고 기능에 영향 없음,
   다음 Builder 소폭 라운드에서 "Omni Calculator"로 주석만 갱신 권고). `npx vitest run`
   재실행 결과 50/50 테스트 통과.

**결론**: 외부 계산기 대조 2건(Inch Calculator #20, Omni Calculator #21) 모두 독립
재검증으로 확인되어 `docs/CALCULATOR_RULES.md` "최소 2건" 요건이 실질적으로 충족됐다.
이전 라운드의 계산 로직 PASS와 합쳐 **전체 최종 판정: PASS**로 확정한다.

### 재검증 (Optimizer 수정 후)

검증일: 2026-09-13. 판정: PASS(계산 로직 변경 없음, 문구만 수정됨).

`validation.ts`를 전체 대조한 결과, `hasFinalConsonant` 헬퍼(유니코드 완성형 코드
`(code-0xAC00)%28!==0`로 종성 유무 판정)만 추가됐고 범위 비교(`value < min || value >
max`), `Number.isNaN` 체크, MIN/MAX 상수, 검증 순서(성별→나이→키→체중)는 한 글자도
바뀌지 않았다. Node로 직접 실행해 `hasFinalConsonant("키")===false`(받침 없음→"를"/"는"),
`hasFinalConsonant("체중")===true`(받침 있음→"을"/"은")를 확인했으며, 이 값은 오직
`errors.push` 메시지 문자열 조립에만 쓰이고 성공/실패 판정에는 전혀 관여하지 않는다. 나이
오류 메시지("나이를"/"나이는")는 이전부터 하드코딩된 형태로 이번에 바뀌지 않았고 "나이"도
받침 없는 글자라 원래 문법이 맞았다(문제없음, 확인만).

`logic.ts`/`logic.test.ts`/`validation.test.ts`는 grep과 파일 수정시각(17:28~18:12,
Optimizer 작업시각 21:17 이전) 모두로 미변경을 확인했다. `formatting.ts`의 활동계수
숫자(1.2/1.375/1.55/1.725/1.9)는 그대로이며 레벨5 설명 문구만 바뀌었다(의미 동일).

`npx vitest run`(79파일/1034테스트 전부 통과), `npx tsc --noEmit`(오류 0건) 재확인
완료. 이슈 없음.

### 1. 구현 ↔ FORMULA.md 일치 검증

`src/calculators/bmr-calculator/{logic,types,validation,formatting,content,ui}.tsx`를
FORMULA.md "공식"/"계산 순서"/"정밀도·반올림 정책"과 줄 단위로 대조했다.

**(a) 공식 자체 — 일치.** `logic.ts` 62-67행 `calculateBmr`(대표 공식)과 75-81행
`calculateBmrAlternative`(보조 공식)의 계수(10/6.25/5/+5·−161, 88.362/13.397/4.799/5.677와
447.593/9.247/3.098/4.330)가 FORMULA.md "공식" 절과 정확히 일치한다. `calculateTdee`(89-93행)
는 `ACTIVITY_FACTORS`(39-45행, 1.2/1.375/1.55/1.725/1.9)를 곱하고 `calculateAllTdeeLevels`
(99-101행)는 새 산식 없이 `calculateTdee`를 레벨 1~5에 매핑만 한다 — FORMULA.md와 일치.

**(b) `calculateBmrAlternative`의 독립성 — 확인됨(가장 중요한 검증 항목).**
`calculateBmrAlternative` 함수 본문(75-81행)을 문자 그대로 읽으면 `metrics`만 참조하고
`calculateBmr`·`bmr`·`bmr.raw`·`bmr.display` 어디에도 접근하지 않는다. `logic.test.ts`도
"이 describe 블록은 calculateBmr을 호출하지 않고도 독립적으로 검증 가능하다"(137-142행)는
블록으로 이를 문서화했다. 정적 코드 읽기에 더해, Node 24의 네이티브 TypeScript 실행
(`node --experimental-strip-types`)으로 프로젝트의 `logic.ts`/`types.ts`를 **그대로**(수정
없이 원본 복사본으로) import해 실행한 결과도 동일했다(`calculateBmrAlternative`가 `bmr`
객체나 `calculateBmr`을 참조할 방법 자체가 함수 스코프에 없음을 런타임에서도 재확인).
독립성은 코드 구조상으로도, 실행 결과상으로도 참이다.

**(c) 반올림 정책 — 확인됨. 실제 코드를 직접 호출해 검증했다(사용자 지시 핵심 항목).**
오케스트레이터 `calculateBmrCalculation`(108-121행)의 117행은
`tdee = calculateTdee(bmr.raw, input.activityLevel);`로, `bmr.display`가 아니라 `bmr.raw`를
명시적으로 전달한다. `ui.tsx` 523행의 5단계 비교표도 `calculateAllTdeeLevels(result.bmr.raw)`
로 동일하게 raw를 전달한다. 프로젝트 코드를 import하지 않는 순수 Python 재계산과, 프로젝트의
실제 `logic.ts`를 원본 그대로 실행하는 두 가지 방법으로 이를 재검증했다.

- FORMULA.md Golden Test #20이 이미 제시한 경계(`bmrRaw=1241.375` vs `bmrDisplay=1241`,
  활동계수 1.9)를 실제 `calculateTdee`로 재현: raw 기준 `2358.6125 → 2359`, display 기준
  `2357.9 → 2358`로 **표시값 자체가 1kcal 어긋남**을 확인했다(Python·Node 실행 모두 일치).
- **새로운 독립 경계 케이스를 직접 탐색해 실제 코드로 검증했다** — `bmrRaw`가 `x.3`~`x.9`인
  구간을 격자 탐색한 결과, 예를 들어 `bmrRaw=1000.3`(display 1000)에 활동계수 1.725(레벨4)를
  적용하면 raw 기준 `calculateTdee(1000.3, 4).display = 1726`인데 display 기준
  `calculateTdee(1000, 4).display = 1725`로 **1kcal 차이**가 나는 등, 좁은 격자 안에서만도
  18건의 새로운 표시값 불일치 사례를 실제 `calculateTdee` 호출로 확인했다.
- **가장 강력한 증거 — 실제 유효한 `BmrCalculationInput`으로 오케스트레이터 자체를
  호출**: `{ sex: "male", ageYears: 19, heightCm: 100, weightKg: 46.53, activityLevel: 4 }`
  (모두 FORMULA.md 유효 범위 안의 실제 사용자 입력 가능값)를 넣으면
  `calculateBmr`이 `raw=1000.3, display=1000`을 반환하고, 실제
  `calculateBmrCalculation(input).tdee.display`는 **1726**이다. 만약 오케스트레이터가
  실수로 `bmr.display`(1000)를 넘겼다면 `calculateTdee(1000, 4).display`는 **1725**가
  되어 사용자에게 다른 숫자가 보였을 것이다 — 실제 오케스트레이터가 정말로 raw를 쓴다는
  것을 이론이 아니라 이 계산기가 받을 수 있는 실제 입력값으로 직접 증명했다.
- 결론: `docs/CALCULATOR_RULES.md` "반올림 정책"·FORMULA.md "정밀도/반올림 정책"이 요구하는
  "중간 반올림 금지, 최종 표시 직전에만 반올림"이 실제 코드에서 완전히 지켜지고 있다.

**(d) Golden Test 25개 그룹 — 프로젝트 코드를 import하지 않는 독립 스크립트로 재계산해
전부 일치했다.** Python으로 Mifflin-St Jeor·Harris-Benedict 개정판 공식을 처음부터 다시
구현해 FORMULA.md의 raw/display 값 전부(#1~9, #11, #13~14, #16~22)를 재계산했고, 모두
FORMULA.md 및 `logic.test.ts`의 값과 소수점까지 정확히 일치했다(부동소수점 오차 범위 내
`toBeCloseTo` 처리가 필요한 항목도 동일하게 재현됨 — 예: #18 Harris-Benedict raw는
Python·JS 모두 `1835.4620000000002`로 나오는 이진 부동소수점 표현 오차가 있으나 표시값
1835에는 영향이 없음). `logic.test.ts`/`validation.test.ts`도 `npx vitest run
src/calculators/bmr-calculator`로 재실행해 50개 테스트 전부 통과를 직접 확인했다(Builder의
보고를 그대로 신뢰하지 않고 재실행).

**(e) 예외/방어적 처리 — 일치.** `activityLevel`이 1~5 밖이면(`isValidActivityLevel`,
48-50행) TDEE를 만들지 않는 처리, `validation.ts`의 성별→나이→키→체중 순서 검증과 경계값
포함(inclusive) 처리, 공유 URL 복원 시 `activityLevel` 재검증(`ui.tsx` 118행) 모두
FORMULA.md "예외" 절과 정확히 일치함을 코드로 확인했다. `src/lib/share.ts`가
`JSON.stringify`/`JSON.parse`로 상태를 직렬화해 숫자 타입이 문자열로 뒤바뀌지 않는 것도
확인해, `isValidActivityLevel`의 엄격 동등 비교(`=== 1|2|3|4|5`)가 공유 URL 복원 경로에서도
의도대로 동작함을 확인했다.

**부동소수점/단위 안전성 — 별도 결함 없음.** 이 계산기가 다루는 값(수백~수천 kcal)은
`Number.MAX_SAFE_INTEGER` 대비 11~12자리 여유가 있다는 ARCHITECTURE.md "2.4"의 분석을
직접 재현해 확인했고, 유효 입력 범위 전체(키 100~230cm, 체중 20~300kg, 나이 19~78세)에서
대표/보조 공식 결과가 항상 양수임을 극단값(여성, 78세, 100cm, 20kg → 274kcal)으로 확인해
"음수 특이 케이스 없음"이라는 FORMULA.md 서술이 사실임을 검증했다. 단위 변환은 이 계산기에
존재하지 않는다(cm·kg을 그대로 계산에 사용 — FORMULA.md "단위" 절과 일치).

### 2. FORMULA.md ↔ 실제 근거 일치 검증

**(a) Mifflin-St Jeor(1990) 계수 — 다수 독립 출처로 교차 확인됨.** WebSearch로
mifflinstjeor.com, Medscape/QxMD 계산기, ScienceDirect 초록 등 서로 무관한 다수 출처에서
"남 10×체중+6.25×키−5×나이+5 / 여 …−161" 공식과 "원 논문 정밀 계수는 9.99(체중)/4.92(나이)
였으나 임상에서는 10/5로 반올림해 쓴다"는 설명이 일관되게 재현됨을 확인했다. 표본 정보(건강한
성인 498명, 남 251/여 247명, 19~78세, 평균 45±14세)도 다수 출처에서 FORMULA.md 서술과
정확히 일치함을 재확인했다.

**(b) Harris-Benedict 개정판(Roza & Shizgal, 1984) 계수 — 다수 독립 출처로 교차 확인됨.**
남성(88.362/13.397/4.799/5.677), 여성(447.593/9.247/3.098/4.330) 계수 모두 검색된 여러
2차 출처(NCBI PMC, Inch Calculator, promealplan 등)에서 동일하게 재현됨을 확인했다. 추가로
**FORMULA.md가 경고한 "1919년 원판과 1984년 개정판 혼동" 문제를 실제로 재현하는 증거를
찾았다** — Inch Calculator의 별도 페이지(`inchcalculator.com/harris-benedict-calculator/`)를
직접 열어보니 이 페이지는 실제로 **1919년 원판 계수(66.5+13.75×체중+5.003×키−6.775×나이 등)**
를 쓰고 있었다(FORMULA.md가 이미 "온라인에 흔히 도는 Harris-Benedict 계산기는 종종 1919년
원판을 쓴다"고 경고한 바로 그 사례). FORMULA.md가 개정판 계수만 명시적으로 채택한 판단은
근거가 있었다고 확인된다.

**(c) 활동계수 5단계(1.2/1.375/1.55/1.725/1.9) — FORMULA.md의 "확인 필요" 판정 그대로
유지(격상하지 않음).** legionathletics.com, athleanx.com, calculatemytdee.org,
tdeecalculator.org 등 다수 독립 피트니스/영양 사이트에서 동일한 5개 숫자와 동일한 일수 구간
설명(주 1~3일/3~5일/6~7일)이 재현됨을 확인했으나, 이 값을 최초로 제시한 단일 1차 학술
출처는 이번 조사에서도 특정하지 못했다. FORMULA.md의 기존 판단(여러 독립 2차 출처 일치 →
표준값으로 채택하되 "확인 필요"로 남김)이 여전히 맞다고 판단해 격상하지 않았다.

**(d) 나머지 "확인 필요" 항목 — 전부 그대로 유지(격상하지 않음).**
- 원 논문 정밀 회귀계수(9.99/4.92): 위 (a)에서 여러 2차 출처가 이 수치를 일관되게 보고하나,
  전부 원문이 아니라 2차 인용이었다(원문 PDF에 직접 접근하지 못함) — "확인 필요" 유지가
  타당하다.
- 원 논문 Table 1의 실측 키/체중 범위: 이번 조사에서도 원문 전체(PMID 2305711, AJCN
  1990;51(2):241-247)에는 접근하지 못했고, 검색된 모든 2차 출처가 "정상 체중~비만"이라는
  정성적 설명만 제공할 뿐 구체적 cm/kg 수치를 제시하지 않았다 — "확인 필요" 유지가 타당하다.
- 79세 이상 정확도 저하 정량치(PMID 24527991): PubMed 초록 수준 정보(Mifflin-St Jeor가
  고령자 대상 다른 공식보다는 낫지만 여전히 부정확하다는 정성적 결론)만 재확인했고, 원문의
  정량적 오차율은 여전히 확인하지 못했다 — "확인 필요" 유지가 타당하다.

**(e) 외부 계산기 재대조 — Golden Test #20은 재현됨, #21은 재현되지 않음(핵심 발견,
2026-09-13 최초 라운드 시점 — 이후 정정 경과는 위 "재검증" 절 참고).**

- **#20 (Female 35/165.1cm/54.55kg → 1,241kcal) — 재현됨.**
  `https://www.inchcalculator.com/mifflin-st-jeor-calculator/`를 WebFetch로 4회에 걸쳐
  직접 열람해 원문 텍스트를 그대로 확인했다: "120 lbs ÷ 2.2 = 54.55 kg / 65 inches × 2.54 =
  165.1 cm ... BMR = (10 × 54.55) + (6.25 × 165.1) – (5 × 35) – 161 ... BMR = 1,241 kcal".
  이어서 "1,241 × 1.9 = 2,358 kcal"이라는 TDEE 예시도 원문에 그대로 있어, FORMULA.md가
  설명한 "외부 계산기는 반올림된 BMR에 곱해 2,358을 얻지만 이 계산기는 raw에 곱해 2,359를
  얻는다"는 정책 차이 서술도 정확했다. (참고: 원문 산문은 "36-year-old woman"이라고 쓰면서
  수식에는 "5 × 35"를 대입하는 자체 오타/불일치가 있는데, FORMULA.md가 이미 "36→35세"로
  이 불일치를 인지하고 수식과 일치하는 35세를 채택한 것도 확인했다 — 적절한 처리다.)
- **#21 (Male 60/162.56cm/68.04kg → "1,401.4 kcal/day") — 원문에서 재현되지 않았다(당시).**
  같은 페이지를 서로 다른 4가지 질문(전체 예시 나열, 남성 예시 유무, 특정 수치 위치 검색,
  단위 환산 문단 검색)으로 WebFetch했으나, 이 페이지에는 **여성 35세 예시 단 하나만
  존재**하고 남성 예시·"60세"·"5ft4in"·"150lb"·"162.56"·"68.04"·"1,401"·"1401.4" 중 어느
  것도 등장하지 않았다. 혹시 Formula Analyst가 다른 Inch Calculator 페이지(Harris-Benedict
  계산기)와 혼동했을 가능성을 확인하기 위해 `inchcalculator.com/harris-benedict-calculator/`
  도 별도로 열람했으나, 그 페이지에도 이 남성 예시나 수치는 없었다(그 페이지의 유일한 예시는
  25세 남성/72in/180lb, 1919년 원판 계수 결과 1,937kcal). web.archive.org 스냅샷으로 과거
  버전을 대조하려 했으나 이 도구로는 archive.org에 접근할 수 없어 시도하지 못했다.
  **다만 산술 자체는 맞다** — Mifflin-St Jeor 공식에 남성/60세/162.56cm/68.04kg을 그대로
  대입하면 `10×68.04+6.25×162.56−5×60+5 = 1401.4`가 정확히 나온다(Python·Node 실행,
  `logic.ts`의 `calculateBmr` 실행 결과 모두 일치). 즉 **숫자 자체는 이 계산기가 채택한
  공식으로 정확히 계산되지만, "Inch Calculator 원문이 이 결과를 실제로 제시했다"는 인용은
  이번 조사로 확인되지 않았다** — 자체적으로 공식에 대입해 계산한 값을 외부 계산기의
  "발표된 예시"인 것처럼 인용한 것으로 보인다.

  **판정 근거**: `docs/CALCULATOR_RULES.md` "Golden Test"는 "공식 계산기 예시값과 대조한
  케이스를 최소 2개 포함한다"고 명시하고, FORMULA.md는 이 요건을 #20·#21 두 건으로
  충족했다고 주장한다. 그러나 #21이 실제로는 "외부 계산기가 발표한 예시"가 아니라 "이
  계산기 스스로 공식에 대입해 얻은 값"이라면, 이는 자기 자신을 검증하는 순환 검증이 되어
  독립적 교차검증으로서의 증거력이 없다. `docs/GOAL.md`의 "확인 안 된 수치는 추정하지
  않는다" 원칙과 이 프로젝트의 정확성 우선 원칙에 비추어, 확인되지 않은 출처를 확인된
  것처럼 서술한 것은 "확인 필요"로 정직하게 남긴 다른 항목들과 달리 더 심각하게 다뤄야
  한다. 이는 Builder 결함이 아니라 **FORMULA.md 자체의 근거 문제**이므로 Calculation
  Auditor 권한(Edit 없음, 코드 수정 불가)으로 고칠 수 없고, `docs/EVALUATION.md` "역할 간
  이견 조정" 절차에 따라 Formula Analyst에게 반려한다.

  **등급: High.** (Critical로 보지 않은 이유: 실제 사용자가 이 입력값을 넣었을 때 화면에
  표시되는 숫자 자체는 Mifflin-St Jeor 공식을 정확히 따른 올바른 값이며, 공식·계수·반올림
  정책 어디에도 실제 오류가 없다. High로 보는 이유: `docs/CALCULATOR_RULES.md`가 요구하는
  "공식 계산기 대조 최소 2건"이라는 정확성 게이트 중 1건이 실제로는 충족되지 않은 상태이고,
  FORMULA.md가 이를 "확인일 2026-09-13"까지 명시하며 확인된 사실처럼 서술한 것은 이
  프로젝트의 핵심 원칙과 정면으로 배치된다.) — **이후 상태: Formula Analyst 재조사로 출처를
  Omni Calculator로 정정, 위 "재검증" 절에서 독립 확인 완료해 해소됨.**

  **Formula Analyst에게 요청하는 조치(공식 재검토 요청)**: (1) Golden Test #21을 실제로
  검증 가능한 다른 공식 계산기의 발표된 예시로 교체하거나, (2) 교체가 어렵다면 #21을
  "외부 계산기 예시 대조"가 아니라 "자체 공식 대입 검산(수동 계산 재현)"으로 재분류하고
  별도의 진짜 두 번째 외부 계산기 예시를 추가로 찾아 `docs/CALCULATOR_RULES.md` "최소
  2건" 요건을 다시 채워야 한다. `docs/PRODUCT.md`/`docs/GOAL.md` 원칙상 이 계산기가
  법령형이 아니라 학술 공식형이라는 특성상 정부 공식 계산기가 없으므로 대체 후보로는
  Omni Calculator, Cronometer, NIH Body Weight Planner 등 다른 독립 계산기 사이트의
  실제 게시된 worked example을 우선 검토할 것을 제안한다. — **(조치 완료, 위 "재검증"
  절 참고)**

### 3. 의료 면책 문구 검증

SPEC.md "성공 지표"의 "의료 오해 문구 결함 0건" 요건을 `content.ts`/`ui.tsx`로 확인했다.

- **추정치 안내**: `BMR_RESULT_DISCLAIMERS[0]`("BMR과 TDEE는 공식으로 추정한 값이며, 실제
  대사량과 차이가 있을 수 있습니다") — 존재. 추가로 `BMR_RESULT_APPROX_CAPTION`("이 값은
  추정치이며, 실제 대사량과 다를 수 있습니다")이 BMR 카드(`ui.tsx` 424-426행)와 TDEE
  카드(442행) **각각의 바로 아래**에 개별적으로 배치돼, 결과 숫자와 물리적으로 가장 가까운
  위치에서 즉시 노출된다.
- **질병/임신·수유/특수 신체 조건 시 의료진 상담**: `BMR_RESULT_DISCLAIMERS[1]`("갑상선
  질환 등 질병이 있거나, 임신·수유 중이거나, 근육량이 매우 많거나 적은 등 특수한 신체
  조건이라면 이 계산기의 오차가 더 커질 수 있습니다 — 이런 경우 의료진과 상담하세요.") —
  SPEC.md가 요구한 세 조건(질병, 임신·수유, 근육량 극단) 전부와 의료진 상담 권고까지 모두
  포함해 존재.
- **처방·진단 아님**: `BMR_RESULT_DISCLAIMERS[2]`("이 결과는 식단·운동 처방이나 질병
  진단이 아닙니다. 건강 관리 계획은 의료진·전문가와 상의해 결정하세요.") — 존재.
- **배치 확인**: 세 문구 모두 담긴 "꼭 확인하세요" `SectionCard`(`ui.tsx` 544-550행)가
  결과 카드·계산 근거 섹션 **바로 다음**(소개/사용법/FAQ보다 앞)에 배치돼 있고, 페이지
  맨 아래 "정책 안내" 섹션(566-579행)에 동일 문구가 한 번 더 반복된다 — 즉 문구가 결과와
  멀리 떨어지거나 작은 글씨로만 숨어 있는 것이 아니라 오히려 결과 바로 아래에 노출되고
  페이지 하단에도 중복 노출된다. `docs/DESIGN_SYSTEM.md`의 "공통 화면 순서"(계산 근거 →
  소개·사용 방법 → 계산 전제/주의사항 → FAQ)와 비교하면 ARCHITECTURE.md "7.1"이 의도적으로
  "꼭 확인하세요"를 소개/사용법보다 앞으로 당겨 배치했는데, 이는 화면 순서 규칙에서 살짝
  벗어나지만 의료 면책 문구의 가시성을 오히려 높이는 방향의 이탈이라 계산 정확성/의료
  오해 방지 관점에서는 결함이 아니라고 판단한다(화면 순서 규칙 자체를 지킬지는 UX/UI
  Critic이 판단할 문제로 남긴다).
- **결론: 의료 오해 문구 결함 0건 — SPEC.md 성공 지표 충족.**

### 종합 판정

| 검증 항목 | 결과 |
|---|---|
| 구현 ↔ FORMULA.md 일치(공식·독립성·반올림 정책·계산 순서·예외) | PASS |
| Golden Test 25개 그룹, 독립 재계산 대조 | PASS (전부 일치) |
| 반올림 정책 핵심 불변식(실제 코드 호출, 신규 경계 케이스 포함) | PASS |
| FORMULA.md 1차 출처(Mifflin-St Jeor/Harris-Benedict/활동계수) 교차검증 | PASS |
| FORMULA.md "확인 필요" 4개 항목 재조사 | 변화 없음(격상 없음, 그대로 유지가 타당) |
| 외부 계산기 대조 최소 2건(`docs/CALCULATOR_RULES.md`) | **PASS(재검증 완료) — #21 출처 정정 후 Omni Calculator로 재현 확인** |
| 의료 면책 문구(SPEC.md 성공 지표) | PASS |

**최종 판정: PASS.** Builder의 구현·테스트는 FORMULA.md를 한 글자도 벗어나지 않고 정확히
구현했고, FORMULA.md의 유일한 미해결 쟁점이었던 Golden Test #21 출처 문제도 Formula
Analyst의 정정과 이 감사자의 독립 재검증(위 "재검증" 절)으로 해소되었다. 남은 것은 Low
등급 후속 권고(`logic.test.ts` 94행 주석의 "Inch Calculator" 표기를 "Omni Calculator"로
갱신) 하나뿐이며, 이는 계산 정확성에 영향을 주지 않으므로 최종 판정을 막지 않는다.

## UX/UI Critic

검토일: 2026-09-13. 대상: `src/calculators/bmr-calculator/{ui.tsx,content.ts,formatting.ts,
types.ts,validation.ts}` 및 `docs/DESIGN_SYSTEM.md` 전체 대조. Calculation Auditor가 이미
PASS 확정한 계산 정확성은 재검증하지 않았다(코드를 열람하되 수치 재계산은 하지 않음). Edit
권한이 없어 코드는 수정하지 않았다 — 아래는 전부 관찰·판단 결과다.

### 재검증 (Optimizer 수정 후)

검증일: 2026-09-13. Optimizer가 조치한 5건을 실제 코드(`ui.tsx`/`validation.ts`/
`formatting.ts`/`content.ts`)로 재확인했다. 코드 수정 없이 열람만 했다.

1. **[Medium→해결됨] 면책 캡션 시각적 우선순위.** `ui.tsx` 425행(BMR 카드) `text-sm
   opacity-90`, 443행(TDEE 카드) `text-sm text-muted`로 실제 반영 확인 — 기존 `text-xs
   opacity-70`/`text-xs text-muted`보다 폰트 12px→14px, 불투명도 최대 90%로 뚜렷이
   커졌다. 결과 숫자(`text-4xl~5xl`/`text-3xl~4xl font-bold`)보다는 여전히 작고, 바로
   위 메타 정보 줄(입력값 에코, 동일하게 `text-sm`)과 같은 급이라 "숫자 > 캡션" 위계는
   그대로 유지된다. **등급: 해소(문제없음).**
2. **[Low(QA)→해결됨] 조사 오류.** `validation.ts` `hasFinalConsonant`가 유니코드
   종성 계산(`(code-0xAC00)%28`)으로 "키"(종성 없음→`(0xD0A4-0xAC00)%28=0`)는 "를"/
   "는", "체중"(종성 있음→`(0xC911-0xAC00)%28=21`)은 "을"/"은"을 정확히 골라, "키는
   100~230cm 사이여야 합니다."/"키를 입력해 주세요."로 문법이 맞게 고쳐졌고 "체중은/
   체중을" 메시지는 그대로 유지됨을 확인했다. **등급: 해소(문제없음).**
3. **[Low→해결됨] 4·5단계 설명 중복.** `formatting.ts` 61-62행, 레벨4는 "주 6~7일
   강도 높은 운동"(변경 없음), 레벨5는 "매일 하는 고강도 운동 또는 육체노동"으로
   바뀌어 "강도 높은"이라는 동일 문자열 중복이 사라졌다. FORMULA.md "활동계수 5단계"
   표의 레벨5 정의("매일 강도 높은 운동/육체노동" — 빈도 매일 + 강도 높음 + 육체노동
   대안)는 "고강도"·"또는"이라는 동의어 치환만 있을 뿐 의미가 그대로 보존됐고, 활동계수
   숫자(1.9)·`ACTIVITY_FACTORS`는 변경되지 않았다. **등급: 해소(문제없음).**
4. **[Low→해결됨] 보조 공식 시각적 구분.** `ui.tsx` 497-505행, 보조 공식(Harris-
   Benedict) 항목만 `text-muted` 톤 다운 + "참고용" 배지(`bg-surface-subtle` 캡슐)가
   추가돼, 같은 `<ol>` 안에서 대표 공식(1번)·TDEE(2번, 기본색)와 즉시 구분된다. 배지가
   과하게 크거나 경고색을 쓰지 않아 캡션을 가리거나 산만하게 하지도 않는다. **등급:
   해소(문제없음).**
5. **[Low→해결됨] 의료 면책 3문장 중복.** `content.ts`에 추가된
   `BMR_POLICY_DISCLAIMER_SUMMARY`(요약 1문장 + "꼭 확인하세요 참고" 안내)가 `ui.tsx`
   581행 하단 정책 안내에 쓰이는 반면, 결과 직후 "꼭 확인하세요" `SectionCard`(550-556행)
   는 `BMR_RESULT_DISCLAIMERS` 3문장 전문을 변경 없이 그대로 렌더링한다 — SPEC.md
   "결과 안내" Must Have(추정치·의료진 상담·처방 아님 3항목) 노출 위치가 그대로 남아
   있어 요건 충족이 유지된다. **등급: 해소(문제없음).**

**전체 재검증 판정: PASS.** 5건 모두 실제 코드에서 의도대로 반영되었고 새로운 회귀(과도한
경고색 오용, 의미 왜곡, 면책 요건 누락 등)도 발견되지 않았다. 이전 PASS 판정을 유지한다.

### 자체 평가 질문 · 답변 · 등급

각 질문 앞 `[평가 항목]`은 이 질문이 대응하는 "평가 항목" 7개 중 어느 것인지 표시한다.
`(필수)`가 붙은 질문은 지시문의 "필수 질문"이다.

---

**Q1. (필수) [입력 라벨 표현] 모든 입력 라벨을 `FIELDS`류 실제 구현(`ui.tsx`)과 대조했을 때,
`FORMULA.md`/`SPEC.md` 용어를 그대로 복사했거나 법령·전문 용어를 쓴 라벨이 있는가?**

- 라벨: "성별"(+도움말 "성 정체성을 판정하지 않습니다 — 계산 공식의 성별 상수를 선택하는
  데에만 사용됩니다"), "나이 (만 나이, 세)", "키 (cm)", "체중 (kg)", "활동량 (선택)". 전부
  일상어이고, `FORMULA.md`가 쓰는 변수명(`sex`/`ageYears`/`heightCm`/`weightKg`/
  `activityLevel`)이나 공식명(Mifflin-St Jeor, Harris-Benedict)을 라벨에 그대로 옮기지
  않았다.
- 활동량 옵션 라벨도 "활동계수 1.375" 같은 숫자를 노출하지 않고 "가벼운 활동(주 1~3일
  정도 가벼운 운동)"처럼 일상어로만 표시한다(SPEC.md Must Have 요건과 정확히 일치,
  `formatting.ts`의 `ACTIVITY_LEVEL_OPTIONS`가 활동계수 실수값을 아예 담지 않음).
- 메인 결과 타이틀("기초대사량(BMR) — 아무 활동을 하지 않아도 쓰는 하루 최소 에너지",
  "TDEE — 활동을 반영한 하루 총 소비 칼로리")에도 공식명이 노출되지 않는다. 공식명은
  "계산 방법" SectionCard와 페이지 하단 "정책 안내"의 작은 배지에만 등장한다 — SPEC.md
  Must Have("메인 결과 타이틀에는 노출하지 않음")를 정확히 지켰다.
- **판정: 문제없음.**

**Q2. (필수) [입력 순서·그룹핑] 입력 필드 순서가 시간 순서인가? 하나의 기간을 이루는 두
날짜 사이에 성격이 다른 필드가 끼어 있지 않은가?**

- 이 계산기에는 기간을 이루는 날짜 쌍이 없다(입사일·퇴사일류 패턴 자체가 없음 — 이
  계산기는 시점 데이터가 아니라 신체 계측값만 다룬다). 순서는 성별 → 나이 → 키 → 체중 →
  활동량으로, "기본 신원·신체 정보 4개(필수) → 부가 선택 정보 1개(선택)"라는 논리적
  그룹핑을 따른다. 서로 다른 성격의 정보가 중간에 끼어드는 문제는 없다.
- **판정: 해당 없음(날짜 쌍 없음) — 위반 없음.**

**Q3. (필수) [결과 가독성 / 오류 메시지] 같은 개념이 폼·결과·오류 메시지 전체에서 한
용어로 통일돼 있는가?**

- "나이"(라벨/도움말/에러 메시지 "나이는 19~78세 사이여야 합니다"/결과 에코 "45세")로
  일관. "키"·"체중"도 동일(폼 라벨 → 에러 메시지 → 결과 에코 → breakdown 문자열까지
  전부 "키"/"체중"). "활동량"도 폼 라벨·결과 표시("선택한 활동량: ...")·비교표 헤더까지
  통일. "BMR"/"기초대사량", "TDEE"/"하루 총 소비 칼로리"라는 축약어-완전어 쌍도 첫
  등장 시 병기하고 이후 문서 전체에서 흔들리지 않는다.
- **판정: 문제없음.**

**Q4. (필수) [일반 사용자가 계산법을 몰라도 사용 가능] 입력 필드 수가 최소인가? 다른
입력에서 유도 가능한 값을 중복으로 물어보지 않는가?**

- 필수 4개(성별·나이·키·체중) + 선택 1개(활동량)로 최소 구성이다. 나이를 생년월일
  대신 직접 입력받기로 한 SPEC.md 결정(응답 부담이 더 작은 쪽 선택)이 실제 UI에도
  그대로 반영됐다 — 생년월일·기준일 두 필드 대신 나이 입력 필드 하나만 존재한다. 활동량도
  "활동계수"라는 파생값을 직접 물어보지 않고 일상어 5단계 중 선택하게 해 유도 가능한
  중간값(계수)을 사용자에게 요구하지 않는다.
- **판정: 문제없음.**

**Q5. [일반 사용자가 계산법을 몰라도 사용 가능] 활동량 6옵션 카드형 라디오(선택
안 함 + 5단계)가 실제로 "일상어 설명을 비교해서 고르기 편한지"? 5단계 설명 문구가
서로 헷갈리지 않고 구분되는가?**

- 6개 옵션이 세로로 한 번에 모두 펼쳐져(`<select>`가 아님) 비교가 쉽다. 각 옵션이
  제목(굵게)과 설명(작게, `text-muted`) 2줄 구조로 돼 있어 훑어보기 좋다.
- 다만 4단계("활발한 활동 — 주 6~7일 강도 높은 운동")와 5단계("매우 활발함 — 매일 강도
  높은 운동/육체노동")가 둘 다 "강도 높은 운동"이라는 동일한 수식어를 공유해, 두 단계의
  차이가 "주 6~7일 vs 매일"이라는 빈도 차이뿐이라는 점을 빠르게 훑을 때 놓치기 쉽다(둘
  다 "강도 높은"이라는 단어가 먼저 눈에 들어와 비슷해 보일 수 있음). 완전히 헷갈리는
  수준은 아니지만(빈도 문구 자체는 명확히 다름), 5단계 설명 문구 전체를 훑었을 때 1~3
  단계는 강도가 뚜렷이 다른 단어(거의 안 함/가벼운/보통)를 쓰는 반면 4·5단계만 형용사가
  겹친다.
- "선택 안 함" 카드는 점선 테두리 + `bg-surface-subtle` + `text-muted` 제목으로 나머지
  5개와 구분되고, 설명("BMR(기초대사량)만 확인할게요")도 그 옵션의 의미를 명확히
  전달한다 — 자연스럽다.
- **판정: Low.** (4·5단계 형용사 중복으로 인한 미세한 구분 저하. 기능적 오류는 아니며,
  실제 선택에는 지장이 없을 정도.) — **Optimizer 수정 후 재검증: 해소됨(위 "재검증" 3번
  참고).**

**Q6. [결과 가독성] 의료 면책 문구가 눈에 잘 띄는 위치·디자인인가 — 사용자가 결과를
"확정된 의학적 사실"로 오인하지 않을 만큼 충분한가?**

- 결과 숫자 바로 아래(같은 카드 안, 물리적으로 가장 가까운 위치)에 `BMR_RESULT_APPROX_
  CAPTION`("이 값은 추정치이며, 실제 대사량과 다를 수 있습니다")이 BMR·TDEE 카드 각각에
  배치돼 있다 — 위치 자체는 이상적이다.
- 그러나 이 캡션의 스타일은 `text-xs opacity-70`(BMR 카드, 라이트 모드 기준 흰 텍스트의
  70% 불투명도)/`text-xs text-muted`(TDEE 카드)로, 카드 안에서 **가장 작고 가장 흐린
  텍스트**다. 결과 숫자는 `text-4xl~5xl font-bold`로 매우 크고 진한 반면, 바로 이어지는
  면책 문구는 육안상 거의 "각주" 수준으로 축소돼 있다. 경고 색상(주황/빨강 계열, 이
  사이트의 `bg-warning-surface`/`border-warning-border` 패턴)도 전혀 쓰이지 않는다 —
  다만 이는 "지급 대상 아님" 같은 경고와 달리 이 문구가 부정적 판정이 아니라 일반적인
  추정치 고지이므로 경고색까지는 필요 없다는 판단도 가능하다.
- 세 가지 면책 문구 전문(질병/임신·수유/처방 아님 포함)은 "꼭 확인하세요" SectionCard에
  있는데, 이 카드는 결과 카드 → "계산 상세" → "계산 방법" → (활동량 선택 시) "활동량
  단계별 비교" **다음**에 나온다 — 화면 순서상 "결과 바로 다음"이 아니라 계산 근거
  섹션들을 다 지나야 나오는 4번째 카드다. 다만 이 배치는 `bmi-calculator`(같은 `health`
  카테고리 계산기)의 "꼭 확인하세요" 배치 패턴과 동일해 이 사이트의 기존 컨벤션에서
  벗어난 것은 아니다.
- 종합: "결과가 추정치"라는 최소한의 경고는 결과 숫자와 물리적으로 인접해 있어 완전히
  놓치기는 어렵지만, 그 문구 자체의 시각적 비중(글자 크기·불투명도)이 SPEC.md가 명시한
  성공 지표("의료 오해 문구 결함 0건")의 취지에 비해 다소 약하다. 특히 결과 숫자만
  캡처해 공유하거나 스크린샷만 보는 경우, 작은 캡션은 눈에 띄지만 완전한 면책(의료진
  상담 필요 조건 등)은 화면을 더 내려야 확인 가능하다.
- **판정: Medium.** 문구의 "존재"와 "인접 배치"는 충분하지만, 즉각적 캡션의 폰트 크기/
  불투명도가 결과 숫자 대비 지나치게 약해 시각적 우선순위가 낮다. Critical/High로 보지
  않는 이유는 (1) 완전한 면책 카드가 결과 화면에서 스크롤 한 번이면 바로 보이는 위치에
  있고, (2) `aria-live="polite"` 영역 안에 전부 포함돼 스크린 리더 사용자에게는 결과와
  함께 그대로 낭독되며, (3) 부정확한 정보를 제공하는 것이 아니라 "표시 강조가 약하다"는
  디자인 톤의 문제이기 때문이다. 권고(Builder/디자이너 참고용, 본인은 수정 불가): 즉시
  캡션의 클래스를 `text-xs opacity-70`에서 최소 `text-sm`(또는 `opacity-90` 이상)으로
  올리는 것을 고려할 것. — **Optimizer 수정 후 재검증: 해소됨(위 "재검증" 1번 참고).**

**Q7. [결과 가독성] TDEE 섹션이 BMR 핵심 결과 카드보다 확실히 "덜 강조됨"으로 보이면서도,
부차적 정보로 무시되지 않을 만큼 눈에 띄는가?**

- BMR 카드: `bg-primary`(완전히 채운 배경) + `text-4xl~5xl font-bold`(가장 큰 숫자).
  TDEE 카드: `border-primary/30 bg-primary-soft`(테두리 있는 옅은 배경) + `text-3xl~4xl
  font-bold`(한 단계 작은 숫자). 배경 채움 여부(완전 채움 vs 옅은 배경)와 폰트 크기
  두 축 모두에서 위계가 명확히 다르다 — 강조 순서가 뒤바뀌거나 시각적으로 헷갈릴
  위험은 낮다.
- 동시에 TDEE 카드도 독립된 카드 형태(자체 테두리·배경·제목·큰 숫자)를 갖추고 있어
  "곁다리 텍스트"처럼 무시되지 않는다. 제목("TDEE — 활동을 반영한 하루 총 소비
  칼로리")도 `text-primary` 색상으로 눈에 띈다.
- **판정: 문제없음.** ARCHITECTURE.md "7.3"이 요구한 "결코 BMR보다 더 강조되지 않되,
  무시되지도 않는" 균형이 실제 스타일 선택(배경 채움 강도 + 폰트 크기 2단계 차등)으로
  잘 구현됐다.

**Q8. [계산 과정을 이해할 수 있는지] 활동량을 선택하지 않아 TDEE 섹션이 안 보일 때,
사용자가 "왜 여기 아무것도 없지?"라고 혼란스러워하지 않는가? 활동량을 선택하면 뭐가
더 나온다는 안내가 있는가?**

- 활동량 fieldset의 도움말 문구가 입력 시점에 미리 안내한다: "평소 운동·활동 습관과
  가장 비슷한 설명을 하나 선택하면 TDEE(하루 총 소비 칼로리)가 함께 계산됩니다.
  선택하지 않아도 BMR 결과는 그대로 계산됩니다." — 사용자가 활동량을 선택하지 않기로
  결정하기 **전에** "선택하면 TDEE가 추가된다"는 인과관계를 이미 알게 된다.
- 결과 화면에서도 TDEE 섹션이 존재하지 않을 뿐 빈 박스나 "TDEE: -" 같은 깨진 자리표시가
  남지 않는다(완전한 부재 — FORMULA.md "계산 순서" 6번과 일치). "활동량 단계별 TDEE
  비교" 표도 활동량 미선택 시 함께 사라져, "표는 있는데 숫자만 없는" 어색한 상태가
  생기지 않는다.
- **판정: 문제없음.** 사전 안내(입력 단계 도움말)로 결과 단계의 잠재적 혼란을
  선제적으로 해소했다.

**Q9. [계산 과정을 이해할 수 있는지] 보조 공식(Harris-Benedict) 참고 표시가 대표 공식
결과와 혼동을 주지 않는가 — "어느 게 맞는 거지?"라는 의문이 들지 않는가?**

- 보조 공식 결과는 핵심 결과 카드(BMR/TDEE, 페이지 상단의 강조된 큰 숫자)에는 전혀
  나타나지 않고, "계산 방법" SectionCard 안의 서술형 목록 3번째 항목("보조 공식
  참고값 — Harris-Benedict 개정판")에만 등장한다. 바로 아래 캡션에 "대표 공식과
  독립적으로 계산한 참고값이며, **결과 판정에는 쓰이지 않습니다**"라고 명시적으로
  선을 그어, "이 두 숫자 중 뭘 믿어야 하나"라는 의문에 직접 답한다. FAQ에도 "왜
  대표 공식으로 Mifflin-St Jeor를 쓰나요?", "보조 공식이 대표 공식과 다르게 나오는
  이유는 무엇인가요?" 2개 문항이 있어 중복 안전장치가 있다.
- 다만 "계산 방법" 안에서 대표 공식(1번)·TDEE(2번)·보조 공식(3번)이 같은 `<ol>` 안에
  동일한 폰트 굵기(`font-medium`)로 순서만 매겨져 있어, 목록을 빠르게 훑는 사용자는
  3번도 앞의 1·2번과 "같은 급"의 계산 단계로 오인할 소지가 아주 없지는 않다(캡션까지
  읽어야 "참고용"임을 명확히 알 수 있음).
- **판정: Low.** 문구 자체는 명확하지만, 목록 항목 간 시각적 위계(예: 3번 항목만
  `text-muted`나 "참고" 배지를 다는 등)가 조금 더 있었다면 캡션을 읽지 않고 훑기만
  하는 사용자에게도 더 즉각적으로 전달됐을 것이다. — **Optimizer 수정 후 재검증: 해소됨
  (위 "재검증" 4번 참고).**

**Q10. [오류 메시지의 이해 용이성] 나이 19~78세 범위 제한이 오류 메시지로 명확히
안내되는가? 다른 오류 메시지도 평이한 문구인가?**

- 나이 범위 위반: "나이는 19~78세 사이여야 합니다." — 숫자 범위와 단위가 그대로
  드러나 명확하다. 정수가 아닌 경우: "나이는 정수(세)로 입력해 주세요." — "정수"라는
  단어가 아주 쉬운 일상어는 아니지만 초등 수학 수준의 보편적 용어라 이해에 무리가
  없다. 미입력: "나이를 입력해 주세요."
- 키/체중: "키는 100~230cm 사이여야 합니다.", "체중은 20~300kg 사이여야 합니다." —
  단위 포함, 평이함. 성별: "성별을 선택해 주세요." — 평이함.
- 모든 오류가 `role="alert"`로 선언되고 `aria-describedby`로 해당 입력과 연결돼
  있어(`ui.tsx` 261, 288, 315행) 스크린 리더 사용자도 어떤 필드의 오류인지 즉시 알 수
  있다. 법령 조문이나 공식 변수명(`ageYears` 등)이 오류 메시지에 그대로 노출되는
  사례는 없다.
- **판정: 문제없음.** — **Optimizer 수정 후 재검증: "키" 관련 조사 오류가 별도로
  정정된 것도 확인함(위 "재검증" 2번 참고, QA 발견 건).**

**Q11. [모바일 사용성 — 레이아웃 관점] 활동량 카드 6개, 입력 3열 그리드, TDEE 비교표
등이 320px 폭에서 가로 스크롤 없이 배치되는 구조인가?**

- 나이/키/체중 입력은 `grid gap-5 sm:grid-cols-3` — `sm` 미만(모바일 기본)에는 열
  지정이 없어 암묵적으로 세로 1열로 쌓인다. 320px에서 각 입력 박스가 화면 폭을 넘칠
  요소는 없다.
- 성별 카드는 `grid grid-cols-2`(고정 2열, `max-w-md`) — "남성"/"여성" 두 글자 라벨만
  들어가므로 320px에서도 잘림 없이 표시될 만큼 여유가 있다.
- 활동량 카드 6개는 `space-y-2`(세로 나열, `block` 라벨) — 각 카드 안의 텍스트는
  줄바꿈 가능한 `<span className="block">` 구조라 가로 넘침 위험이 낮다. 다만 6개
  카드가 모두 2줄씩(제목+설명) 차지해 세로 스크롤 길이는 상당히 길어진다 — 이는
  ARCHITECTURE.md "14."가 이미 "실기기로 재확인 필요"로 남겨둔 리스크와 동일하며,
  세로 스크롤 자체는 디자인 시스템이 금지하는 대상이 아니므로 구조적 결함은 아니다.
- "활동량 단계별 TDEE 비교" 표는 `overflow-x-auto` 컨테이너 안에 `min-w-[28rem]`
  (448px) 테이블을 담아, 320px 화면에서는 **표 내부에서만** 가로 스크롤이 발생하고
  페이지 전체는 가로로 밀리지 않는다 — 디자인 시스템의 "가로 스크롤 없음" 원칙(페이지
  레벨)과 실제로 충돌하지 않는, 이 사이트에서 이미 쓰이는 완화 패턴이다.
- 폼 헤더의 `flex items-center justify-between`(제목/설명 + "필수 4개" 배지)은
  `flex-wrap`이 없어 이론상 매우 좁은 화면에서 배지가 밀릴 여지가 있으나, 배지 텍스트가
  짧고("필수 4개") 다른 계산기에도 유사 구조가 있어 실제 깨짐 가능성은 낮아 보인다.
- **판정: Low.** 코드 구조상 확정적 결함은 보이지 않으나, (a) 활동량 카드 6개의 체감
  스크롤 길이, (b) 폼 헤더 배지의 극단적 좁은 화면(320px) 랩 여부는 실기기 확인이
  필요하다(QA 영역으로 이관). — **이번 재검증 범위 밖(Optimizer가 손대지 않음, 그대로
  QA 이관 유지).**

**Q12. [불필요한 UI 요소 존재 여부] 의료 면책 문구·입력값 에코 등이 화면에 중복
노출되어 불필요하게 장황하지 않은가?**

- `BMR_RESULT_DISCLAIMERS` 3문구가 "꼭 확인하세요" SectionCard와 페이지 맨 아래 "정책
  안내" 섹션에 **완전히 동일한 문장으로 두 번** 반복된다(`content.ts`를 그대로 두 곳에서
  `.map`). 같은 `health` 카테고리의 `bmi-calculator`는 "꼭 확인하세요" 카드의 면책
  문구와 페이지 하단 안내 문구를 **서로 다른 내용**(하단은 데이터 출처·개인정보 처리
  안내 위주)으로 분리해, 동일 문장을 그대로 반복하지 않는다. 이 계산기는 그 선례와
  달리 완전한 문장 중복을 택했다.
- 의도(가시성 강화)는 Calculation Auditor도 이미 "결함이 아니다"라고 판단했고, 실제로
  사용자에게 잘못된 정보를 주지는 않는다. 다만 페이지를 끝까지 읽는 사용자 입장에서는
  같은 문장을 두 번 읽게 되는 장황함이 있다.
- 입력값 에코(성별·나이·키·체중)도 BMR 카드 헤더 한 줄 요약과 "계산 상세" `dl` 두
  곳에 표시되지만, 전자는 "요약 한 줄", 후자는 "라벨-값 상세 그리드"로 표현 방식이
  달라 순수 중복이라기보다 요약과 상세라는 서로 다른 목적의 표시로 보는 것이 합리적이다
  — 이 부분은 문제로 보지 않는다.
- **판정: Low.** 의료 면책 3문장의 완전 동일 반복(요약 캡션과는 별개로, 전문 자체가
  두 번)은 `bmi-calculator` 선례에 비해 다소 장황하다. 사용자에게 해가 되지는 않으나
  "불필요한 UI 요소" 관점에서 개선 여지가 있다. — **Optimizer 수정 후 재검증: 해소됨
  (위 "재검증" 5번 참고).**

**Q13. [모바일 사용성 / 결과 가독성 — DESIGN_SYSTEM 접근성·헤더 규칙 대조] 접근성
요건(라디오 그룹 시맨틱, `aria-live`, 포커스, 헤더 eyebrow 라벨)이 지켜지는가?**

- 헤더 eyebrow 라벨: `<Link>...>건강</Link>`(`text-sm font-semibold text-primary`) —
  `registry.ts`의 `categoryLabels.health = "건강"`과 토씨 하나 다르지 않게 정확히
  일치하고, `bmi-calculator`(같은 카테고리)의 동일 패턴과도 완전히 같다. 문제없음.
- 라디오 그룹: 성별·활동량 모두 `<fieldset><legend>`으로 감싸고 네이티브
  `<input type="radio" className="sr-only">` + 스타일 입힌 `<label>`로 구성 —
  시맨틱상 올바른 라디오 그룹이다. "필수" 표시(`aria-required="true"`)는 성별 각
  라디오 입력에 붙어 있다.
- `aria-live="polite"`가 결과 섹션 전체(`<div aria-live="polite" className="mt-8
  space-y-5">`)를 감싸 SPEC.md Must Have("결과 갱신 영역에 aria-live 적용")를 충족한다.
- 텍스트/숫자 입력은 `htmlFor`/`id`로 라벨과 연결되고, 오류는 `role="alert"` +
  `aria-describedby`로 연결된다(위 Q10 참고) — 디자인 시스템 접근성 요건과 일치.
- ESLint가 보고한 "aria-required on role=radio" 경고 1건은 `loan-interest-calculator`에도
  동일하게 존재하는 기존 패턴(Builder 보고)이라 이 계산기가 새로 만든 회귀가 아니다.
- **판정: 문제없음.** (기존 사이트 전역 패턴에 속하는 ESLint 경고 1건은 이 계산기
  고유의 신규 결함이 아니므로 등급을 매기지 않음.)

---

### 이슈 등급표

| 등급 | 개수 | 내용 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | Q6(면책 캡션 시각적 우선순위) — Optimizer 수정 후 재검증 완료, 해소됨. |
| Low | 1 | Q11(활동량 카드 6개의 세로 스크롤 길이·폼 헤더 배지의 극단적 좁은 화면 랩 여부는 실기기 확인 필요, QA 이관 — 이번 Optimizer 수정 범위 밖). Q5·Q9·Q12는 Optimizer 수정 후 재검증 완료, 해소됨. |
| 문제없음 | 9 | Q1, Q2, Q3, Q4, Q7, Q8, Q10, Q13, (Q6/Q5/Q9/Q12는 재검증으로 해소되어 사실상 문제없음으로 전환) |

### 최종 판정: PASS

Critical·High 이슈가 없고, Medium 이슈 1건도 "문구 부재"가 아니라 "이미 존재하는 문구의
시각적 강조 수준" 문제이며 완전한 면책 카드 자체는 결과 화면에 정상적으로 노출되고
`aria-live` 영역에 포함돼 접근성 경로로는 완전히 전달된다. `docs/EVALUATION.md`의 PASS
기준(Critical/High 0건)을 충족하므로 **PASS**로 판정한다.

다만 이 계산기의 SPEC.md가 "의료 오해 문구 결함 0건"을 명시적 성공 지표로 못박은 점을
고려해, 다음 Builder 소폭 라운드(코드 수정 권한이 있는 역할)에서 아래 두 가지를 낮은
우선순위로 검토할 것을 권고한다(PASS 판정을 막는 조건은 아님):

1. Q6: `BMR_RESULT_APPROX_CAPTION`의 클래스를 `text-xs opacity-70`/`opacity-80`에서
   최소 `text-sm`(및 `opacity-90` 이상 또는 `text-muted` 고정 색상)으로 올려 결과
   숫자 바로 아래 캡션의 가독성을 높이는 방안 검토.
2. Q12: 페이지 하단 "정책 안내" 섹션의 문구를 "꼭 확인하세요" 카드와 완전히 동일한
   3문장을 반복하는 대신, `bmi-calculator` 선례처럼 데이터 출처·개인정보 처리 등
   보완적인 내용으로 차별화하는 방안 검토.

**(참고: 위 1·2번 권고는 최초 검토(2026-09-13) 시점 기록이며, 이후 Optimizer가 동일 날짜에
실제로 조치했다. 조치 내용과 재검증 결과는 이 절 상단 "### 재검증 (Optimizer 수정 후)"을
참고할 것 — 최종 결론은 재검증 결과가 우선한다.)**

## Optimizer

수정일: 2026-09-13. Calculation Auditor(재검증 PASS)·UX/UI Critic(PASS, Medium 1·Low 4)·
QA(PASS, Medium 1·Low 5 — QA 신규 발견 1건 포함)가 남긴 잔여 이슈 5건을 UI/문구 레이어에서만
수정했다. `logic.ts`는 전혀 건드리지 않았고, `validation.ts`는 순수 오탈자(조사) 수정 외
검증 조건(범위·`min`/`max`/정규식)을 변경하지 않았다.

### 1. [Medium] 의료 면책 캡션 시각적 우선순위 상향 — `src/calculators/bmr-calculator/ui.tsx`

- BMR 핵심 결과 카드의 `BMR_RESULT_APPROX_CAPTION` 문단: `text-xs opacity-70
  dark:text-muted dark:opacity-100` → `text-sm opacity-90 dark:text-muted dark:opacity-100`
  (약 424행 부근).
- TDEE 보조 카드의 같은 캡션: `text-xs text-muted` → `text-sm text-muted`(약 442행 부근).
- 새 경고색 토큰(`bg-warning-surface`/`border-warning-border`)은 적용하지 않았다 —
  `docs/DESIGN_SYSTEM.md`가 이 토큰을 "지급대상 아님"류 **부정적 판정** 카드 용도로 명시
  했고, 이 문구는 부정적 판정이 아니라 일반 추정치 고지라 그 의미를 빌려 쓰면 오히려
  디자인 언어를 오용하게 된다(Critic 스스로도 "경고색까지는 필요 없다는 판단도 가능"이라고
  남겼음). 대신 결과 숫자 바로 위 메타 정보 줄(`text-sm opacity-80`)과 동일한 크기대로
  맞춰, 결과 숫자(`text-4xl~5xl`/`text-3xl~4xl`)보다는 항상 작지만 각주 수준보다는 확실히
  커지도록 했다 — 위계는 유지하면서 가독성만 올렸다.

### 2. [Low, QA 신규] 키(height) 검증 메시지 한국어 조사 오류 — `src/calculators/bmr-calculator/validation.ts`

- `validateHeightOrWeight` 함수(60행 부근) 위에 `hasFinalConsonant(label)` 헬퍼를 추가했다
  — 라벨 마지막 글자의 유니코드 값으로 한글 음절의 받침(종성) 유무를 직접 계산해
  (`(code - 0xAC00) % 28 !== 0`), "키"(받침 없음 → 를/는)와 "체중"(받침 있음 → 을/은) 모두
  라벨을 하드코딩하지 않고 항상 문법적으로 맞는 조사를 고르게 했다.
- 세 군데 오류 메시지 템플릿을 전부 `objectParticle`/`topicParticle` 변수로 교체했다:
  `${label}을 입력해 주세요.` → `${label}${objectParticle} 입력해 주세요.`,
  `${label}은 숫자여야 합니다.` → `${label}${topicParticle} 숫자여야 합니다.`,
  `${label}은 ${min}~${max}${unit} 사이여야 합니다.` →
  `${label}${topicParticle} ${min}~${max}${unit} 사이여야 합니다.`
- 결과: "키을 입력해 주세요." → "**키를** 입력해 주세요.", "키은 숫자여야 합니다." →
  "**키는** 숫자여야 합니다.", "키은 100~230cm 사이여야 합니다." → "**키는** 100~230cm
  사이여야 합니다." 세 문구 모두 정정됨. "체중"은 `hasFinalConsonant("체중") === true`라
  기존 그대로 "체중은"/"체중을"이 유지된다(직접 확인).
- 검증 로직(최소/최대값, 정규식, 필드 순서)은 한 글자도 바꾸지 않았다 — 순수 문자열
  조합 방식만 변경했다.

### 3. [Low] 활동량 4·5단계 설명 문구 차별화 — `src/calculators/bmr-calculator/formatting.ts`

- `ACTIVITY_LEVEL_OPTIONS`의 레벨5 `description`만 수정: `"매일 강도 높은 운동/육체노동"`
  → `"매일 하는 고강도 운동 또는 육체노동"`. 레벨4(`"주 6~7일 강도 높은 운동"`)는 그대로
  두었다 — 이제 두 옵션이 "강도 높은"이라는 동일 수식어를 공유하지 않는다("고강도"로 표현만
  바꿔 문자열 중복을 없앰).
- FORMULA.md "활동계수 5단계" 표의 숫자(1.725/1.9)와 레벨 정의 자체는 전혀 건드리지
  않았다 — FORMULA.md는 수정하지 않았고, `ACTIVITY_FACTORS` 상수(`logic.ts`)도 손대지
  않았다. 의미도 유지했다: 레벨4=주 6~7일 고강도 운동, 레벨5=매일 고강도 운동 **또는**
  육체노동 — FORMULA.md가 정의한 "매일 강도 높은 운동/육체노동"이라는 의미(빈도 매일 +
  강도 높음 + 육체노동 대안 포함)를 그대로 보존했다.

### 4. [Low] 보조 공식(Harris-Benedict) 시각적 구분 — `src/calculators/bmr-calculator/ui.tsx`

- "계산 방법" SectionCard의 3번째(또는 활동량 미선택 시 2번째) 목록 항목 제목을
  `<p className="font-medium">...</p>`에서 `<p className="flex flex-wrap items-center
  gap-2 font-medium text-muted">`로 바꾸고, 제목 텍스트를 `<span>`으로 감싼 뒤 바로
  옆에 `<span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs
  font-semibold text-muted">참고용</span>` 배지를 추가했다.
- 대표 공식(1번)·TDEE(2번) 항목은 그대로 `font-medium`(기본 전경색)을 유지해, 목록을
  빠르게 훑어도 3번 항목만 `text-muted` 톤 다운 + "참고용" 배지로 즉시 구분된다. 기존에
  있던 캡션 문구("참고값이며, 결과 판정에는 쓰이지 않습니다")는 그대로 유지했다 — 과도한
  리디자인 없이 최소한의 시각적 차등만 추가했다.

### 5. [Low] 의료 면책 3문장 완전 중복 완화 — `src/calculators/bmr-calculator/content.ts`, `ui.tsx`

- `content.ts`에 `BMR_POLICY_DISCLAIMER_SUMMARY`(한 문장 요약 + "꼭 확인하세요" 카드
  참조 안내)를 새로 추가했다. 기존 `BMR_RESULT_DISCLAIMERS`(3문장 전문)는 삭제하거나
  축약하지 않고 그대로 유지했다.
  ```ts
  export const BMR_POLICY_DISCLAIMER_SUMMARY =
    "BMR·TDEE는 의료진의 처방이나 진단을 대체하지 않는 추정치입니다. 질병·임신·수유 등 " +
    "특수한 신체 조건에서 주의할 점을 포함한 전체 안내는 결과 화면의 \"꼭 확인하세요\"를 " +
    "참고하세요.";
  ```
- `ui.tsx` 하단 "정책 안내" 섹션에서 `{BMR_RESULT_DISCLAIMERS.map((notice) => <p
  key={notice}>{notice}</p>)}`를 `<p>{BMR_POLICY_DISCLAIMER_SUMMARY}</p>`로 교체했다.
  결과 카드 바로 다음의 "꼭 확인하세요" `SectionCard`는 여전히 `BMR_RESULT_DISCLAIMERS`
  3문장 전문을 그대로 `.map`으로 렌더링한다(변경 없음) — SPEC.md "결과 안내" Must Have
  요건(질병/임신·수유/특수 신체 조건 안내, 처방·진단 아님 안내)이 없어지지 않았다. 완전
  중복을 없애고 한쪽(정책 안내)만 요약 + 상단 재확인 유도로 대체했다.

### 실행한 회귀 테스트

- `npx vitest run` — 79개 파일, **1,034개 테스트 전부 통과**(Builder/Auditor/QA가 보고한
  것과 동일한 수치, 회귀 없음).
- `npx tsc --noEmit` — 오류 0건.
- `npm run build`(Next.js 16.3.4, Turbopack) — 성공(36개 페이지 생성, `bmr-calculator`는
  `registry.ts`의 `status: "draft"`를 그대로 유지해 SSG 목록에는 없음 — 이번 라운드에서
  `registry.ts`는 아예 열람만 하고 수정하지 않았다).

### 수정 범위 확인

- 건드리지 않은 파일: `src/calculators/bmr-calculator/logic.ts`,
  `src/calculators/bmr-calculator/logic.test.ts`,
  `src/calculators/bmr-calculator/validation.test.ts`, `src/calculators/registry.ts`,
  `src/calculators/bmr-calculator/types.ts`. `validation.ts`는 검증 조건(범위 상수,
  `/^\d+$/` 정규식, 필드 순서)을 전혀 바꾸지 않고 오류 메시지 조사 조합 로직만 수정했다.
- FORMULA.md의 활동계수 숫자·공식·상수는 열람만 하고 수정하지 않았다.

### 다음 단계

이번 라운드가 수정한 5건은 모두 UX/UI Critic·QA가 Medium/Low로 남긴 항목이며 Critical/High
이슈는 원래도 없었다. `docs/EVALUATION.md` 개선 Loop에 따라 Calculation Auditor(계산 로직은
변경하지 않았으므로 재검증 범위는 "변경 없음" 확인 위주) → UX/UI Critic → QA 순서로 재검증
단계로 넘긴다.

이후 Calculation Auditor·UX/UI Critic·QA 세 역할 모두 재검증(각 섹션의 "### 재검증
(Optimizer 수정 후)" 참고)에서 PASS를 확정했다 — 아래 점수·최종 판정은 그 결과를 반영한다.

## 점수 (오케스트레이터, 2026-09-13)

| 항목 | 배점 | 획득 | 근거 |
|---|---|---|---|
| 계산 정확성 | 35 | **34** | Calculation Auditor PASS(재검증 포함, Critical/High/Medium 0). FORMULA.md의 대표 공식(Mifflin-St Jeor 1990)·보조 공식(Harris-Benedict 개정판 1984)·채택 근거(Frankenfield 2005 체계적 문헌고찰)를 1차 학술 출처로 교차검증, 25개 Golden Test 그룹을 독립 재계산, 반올림 정책(TDEE는 반올림 전 BMR raw 사용)을 실제 코드 실행으로 실증. 1차 검증에서 Golden Test #21의 외부 계산기 인용("Inch Calculator")이 실제로 그 페이지에 없다는 걸 발견해 "공식 재검토 요청"으로 반려했고, Formula Analyst가 실제 출처(Omni Calculator)로 정정한 뒤 Auditor가 재검증까지 마쳤다 — 이런 인용 오류를 실제로 잡아낸 사례. 잔여 "확인 필요"(원 논문 정밀 회귀계수, 실측 키/체중 범위, 활동계수 단일 1차 출처 미확정, 79세 이상 정확도 저하 정량치)로 −1. |
| 예외/경계값 처리 | 15 | **15** | 나이(19/78 유효, 18/79 무효)·키(100.0/230.0 유효, 99.9/230.1 무효)·체중(20.0/300.0 유효, 19.9/300.1 무효) 전 경계 검증, 성별 상수 차이(166kcal) 정확히 재현, 활동량 5단계 전부와 미선택 시 TDEE 섹션 자체가 생성되지 않는 케이스까지 실제 UI로 재현. |
| UX/사용 편의성 | 15 | **14** | UX/UI Critic PASS + 재검증 PASS(Medium 1건, Low 4건 전부 해소). 의료 면책 문구 가시성 개선(각주 수준→본문급), 보조 공식 "참고용" 배지로 시각적 위계 정리, 활동량 설명 문구 중복 해소, 정책 안내 중복 축약까지 전부 재검증 확인. 잔여 Low(모바일 실기기 확인 필요, Optimizer 범위 밖)로 −1. |
| 모바일/반응형 | 10 | **9** | QA가 실제 headless Chrome/Edge(CDP)로 320~1440px 전 구간 레이아웃·활동량 카드 6개 배치·결과 카드 오버플로를 실측해 이상 없음을 확인. Safari/Firefox 미검증(이 환경의 구조적 한계, 기존 계산기 공통 감점)으로 −1. |
| 접근성 | 5 | **5** | label 연결, `aria-live`, `role="alert"`, 활동량 카드형 라디오 그룹의 실제 화살표 키 이동을 CDP로 실측 확인, 결과와 인접한 면책 캡션도 `aria-live` 영역 안에 포함되어 스크린리더에 전달됨을 확인. |
| 성능/안정성 | 5 | **5** | 15개 이상 시나리오의 실제 브라우저 흐름에서 콘솔 에러/경고 0회, `npx tsc --noEmit` 오류 0, `npm run build` 성공. |
| 설명/계산 근거 | 5 | **5** | 대표 공식 breakdown(실제 값 대입)에 더해 보조 공식(참고용 배지)까지 함께 제공, SPEC.md가 요구한 의료 면책 3문장(추정치·의료진 상담·처방/진단 아님)을 결과 직후 카드에 전문으로, 하단 정책 안내에는 요약으로 중복 없이 배치. |
| SEO/페이지 완성도 | 5 | **5** | registry 등록(`status: draft`), 카테고리 말머리 링크(`/categories/health`)까지 기존 계산기와 동일한 패턴 준수, `app/calculators/[slug]/page.tsx` 배선 완료. |
| 코드 품질/유지보수성 | 5 | **5** | `calculateBmr`/`calculateBmrAlternative`가 서로를 전혀 참조하지 않는 완전 독립 계산임을 코드·실행 양쪽으로 증명, `calculateTdee(bmrRaw, ...)` 시그니처로 "raw 값만 받는다"는 계약을 강제, 오탈자 수정(`hasFinalConsonant` 헬퍼)도 검증 로직과 분리된 순수 문자열 조립 함수로 깔끔하게 처리. |
| **총점** | 100 | **97** | |

## 최종 판정

PASS 기준(docs/EVALUATION.md): 총점 92+, 계산정확성 33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0

| 기준 | 결과 |
|---|---|
| 총점 92+ | 97 ✅ |
| 계산 정확성 33/35+ | 34 ✅ |
| Critical 0 / High 0 | Auditor·Critic·QA 전부 최초 판정 + 재검증에서 0(1차 Auditor 라운드의 "공식 재검토 요청" High는 Formula Analyst 정정 후 재검증에서 해소) ✅ |
| Golden Test 100% | 25/25 + 외부 계산기 대조 2건(Inch Calculator, Omni Calculator) 실제 재확인 ✅ |
| Console Error 0 / TypeScript Error 0 | ✅ (실제 headless 브라우저 실측 포함) |
| Mobile Critical 0 | ✅ (실제 Chrome/Edge 5개 breakpoint 실측) |

**판정: PASS — registry.ts `status`를 `published`로 전환한다.**
개선 Loop 횟수: 2/5 (1차: Calculation Auditor의 "공식 재검토 요청"(외부 계산기 인용 오류) 처리, 2차: UX/UI Critic Medium 1건 + Low 5건 처리 — 둘 다 재검증 전부 PASS)

### 남은 후속 과제 (발행 비차단, 전부 Low 이하)
- Mifflin et al. 1990 원 논문의 정밀 회귀계수(반올림 전 체중 9.99/나이 4.92 추정)·원 논문 실측 키/체중 범위는 원문 미확보로 확인하지 못했다(임상 표준 반올림값 10/6.25/5를 채택했으므로 기능 영향 없음).
- 활동계수 5단계(1.2/1.375/1.55/1.725/1.9)의 단일 1차 학술 출처는 특정하지 못했다(여러 독립 2차 출처가 완전히 동일한 값을 재현해 표준값으로 채택).
- 모바일 실기기(특히 Safari) 렌더링은 이 환경의 구조적 한계로 미검증.
- 이 계산기는 정책형이 아니므로 정기 재검토 없음 — 대표 공식의 1차 출처가 개정되거나 공식 오류가 발견되는 경우에만 재검토.
