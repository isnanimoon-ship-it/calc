# EVALUATION: 퇴직금 계산기

## Builder
- Builder 구현 완료 (2026-09-02). `src/calculators/severance-pay/{logic,validation,formatting,ui}.tsx(.ts)`,
  `logic.test.ts`, `validation.test.ts` 작성. `app/calculators/[slug]/page.tsx`에 라우팅 연결.
  registry.ts의 status는 draft로 유지(변경하지 않음).
- **재구현(2차) 완료 (2026-09-02)**: Calculation Auditor FAIL(High #1) 대응으로 Formula Analyst가
  FORMULA.md를 재검토(반올림 정책을 "완전정밀도 유지"→"1일 평균임금을 전 단위 올림해 6~7단계까지
  재사용", moel.go.kr 방식)한 데 맞춰 `logic.ts`를 재구현했다. 변경 내용: (1) 5단계 1일 평균임금을
  `Math.ceil`로 전 단위(0.01원) 올림 확정해 기준임금 비교·최종 곱셈까지 그 값을 그대로 재사용하도록
  변경(구 완전정밀도 이어가기 방식 폐기), (2) `calendarMonthsBefore`를 JS Date 자동 오버플로
  정규화 의존에서 명시적 clamp(월말 경계는 항상 그 달의 마지막 날로 보정, 5월만이 아니라 모든
  월말 경계에 동일 적용) 계산으로 재작성, (3) `logic.test.ts`를 FORMULA.md 검증 예제 1~7(신규
  예제 7 — 신·구 정책이 653,068원 vs 653,067원으로 실제로 갈리는 회귀 테스트)로 갱신하고 월말
  clamp(5/31, 7/31, 12/31, 3/1 윤년 경계) Edge Case Test 6건을 추가했다. `npm test`(39개 전부
  통과) / `npx tsc --noEmit` / `npm run build` 모두 통과 확인. registry.ts status는 여전히
  draft 유지.
- 아래 Calculation Auditor / UX·UI Critic 섹션은 Builder가 작성하지 않는다 — 최종 정확성 판정은
  Builder의 권한 밖이다(.claude/agents/builder.md).

### Builder v2 구현 (2026-09-02)

SPEC.md/FORMULA.md v2(주당 소정근로시간 필수→선택 전환, 사용 안내·소개·FAQ 섹션, 결과 카피 톤
변경)에 맞춰 Architect가 만들어 둔 `types.ts`(이미 v2 타입 반영 완료 — `weeklyScheduledHours?`,
`underFifteenHoursDeclared?`, `WeeklyHoursIneligibleReason`, `weeklyHoursIneligibleReason`)와
공용 컴포넌트 껍데기(`components/calculator/{SectionCard,UsageGuide,IntroSection,FaqAccordion}.tsx`)
를 그대로 사용해 구현했다. 계산 공식(1~8단계, 금액 계산 부분)은 전혀 건드리지 않았다 — 변경은
지급요건 판정 분기와 UI/검증 레이어에 한정된다.

**1. 지급요건 판정 로직 (`logic.ts`, `validation.ts`)**
- `logic.ts`에 `determineWeeklyHoursEligibility(weeklyScheduledHours, underFifteenHoursDeclared)`
  함수를 신설해 FORMULA.md "판정 로직 (우선순위)" 3단계를 그대로 구현했다: ①
  `underFifteenHoursDeclared === true`면 숫자 입력 여부와 무관하게 즉시 미충족(`reason:
  "declared"`), ② 숫자가 입력됐으면 `>= 15` 기준으로 판정(미만이면 `reason: "belowThreshold"`),
  ③ 둘 다 미입력이면 판정을 생략하고 충족으로 간주(reason 없음). `isEligibleForSeverancePay`와
  `calculateSeverancePay`의 지급요건 분기를 이 함수를 쓰도록 재작성했고, 반환값에
  `weeklyHoursIneligibleReason`을 채워 넣는다. `tsc --noEmit`이 지적하던 logic.ts 2곳(
  `weeklyScheduledHours`가 `number | undefined`인데 `number`를 요구하는 함수에 그대로 전달하던
  지점)은 타입 캐스팅/억지 우회 없이 이 분기 로직 재작성으로 자연히 해소됐다.
- `validation.ts`: `RawSeverancePayFormInput`에 `underFifteenHoursDeclared?: boolean`을
  추가하고, `weeklyScheduledHours` 검증을 `validateRequiredAmount`(필수)에서
  `validateOptionalAmount`(선택)로 전환했다. `validateOptionalAmount`에 `allowDecimal` 옵션을
  추가해(기존엔 금액 필드 전용이라 정수만 허용) 소수 입력(FORMULA.md: "시간(정수/소수 모두
  허용)")을 계속 지원한다. 상한(168시간) 검증은 값이 실제로 입력된 경우에만 여전히 적용된다.

**2. UI 재구성 (`ui.tsx`)**
- 주당 소정근로시간 입력을 기존 필수 텍스트 필드에서, 체크박스("저는 4주 평균 주 15시간 미만으로
  근무합니다") + 그 아래 선택적 숫자 입력으로 교체했다. 체크박스 미선택·숫자 미입력인 기본
  상태에서는 "정규 근로자로 가정합니다(4주 평균 주 15시간 이상 근무 가정)."라는 안내를 보여준다.
  체크박스를 선택하면 숫자 입력 대신 "계산을 진행하지 않고 지급대상 여부만 안내합니다" 경고를
  보여준다(FORMULA.md 권고 — 체크박스를 눈에 띄게 배치).
- 화면 전체를 `IntroSection`(FORMULA.md "소개 문구" 원문 그대로) → `UsageGuide`(4단계: 입사일·
  퇴사일 입력, 3개월 임금총액 입력, 주당 소정근로시간 기본값 안내, 결과·계산 근거 확인) → 입력 →
  결과 → 계산 근거(`SectionCard`로 감싼 "계산 상세"/"적용된 입력값"/"계산 방법" 3개 카드, 각각
  아이콘 부여) → 정책 안내 → `FaqAccordion`(FORMULA.md "FAQ 콘텐츠" 5문항 답변 원문을 그대로
  옮김, 새로 작성하지 않음) 순서로 재구성했다. docs/DESIGN_SYSTEM.md 공통 순서(입력→결과→계산
  근거→정책안내)는 그대로 유지하고 앞뒤로 소개/사용안내/FAQ만 덧붙였다.
- 페이지 바깥쪽을 `space-y-8`(주요 섹션 간), 각 카드 내부는 `space-y-3~6` 등으로 여백을 명시해
  텍스트 블록이 따닥따닥 붙지 않도록 했고, 정책 안내 섹션도 문단마다 별도 `<p>`로 나눠 `space-y-2`
  간격을 줬다(v2 신규로 "주 15시간 미만 초단시간 근로자는 대상에서 제외될 수 있다"는 FORMULA.md
  권고 문구도 정책 안내에 추가했다).
- 결과 화면 카피를 능동·확정 어투로 바꿨다: 지급대상인 경우 "입력하신 조건으로 아래와 같이
  계산을 진행합니다.", "계속근로기간 …및 주당 소정근로시간 요건을 충족해 계산을 진행합니다."
  지급대상이 아닌 경우 "…계산을 진행하지 않습니다." 자진신고/숫자판정 두 사유를 결과 화면에서
  구분해 보여준다(`weeklyHoursIneligibleReason` 활용).
- "관련 도구" 섹션은 SPEC.md v2 "범위 밖" 항목에 따라 추가하지 않았다.

**3. 테스트**
- `logic.test.ts`에 새 describe 블록("주당 소정근로시간 기본값 정책 (v2, FORMULA.md 판정 로직
  우선순위)")을 추가해: (a) `underFifteenHoursDeclared=true`(숫자 40 입력해도 즉시 미충족,
  reason "declared") 2개 케이스(숫자 있음/없음), (b) 둘 다 미입력이면 충족 간주(근속 1년 이상 →
  `eligible:true`, 금액도 예제 3과 동일하게 정상 계산됨), (c) 자진신고 없이
  `weeklyScheduledHours=10`만 입력 시 숫자 기준(`belowThreshold`)으로 미충족, (d) 기존 예제 4·5를
  v2 필드 구조로 재확인(예제 4는 reason 없음, 예제 5는 `belowThreshold`)하는 테스트를 추가했다.
- 기존 예제 5, 경계값 14.9시간, "둘 다 미충족" 테스트 3건은 `weeklyHoursIneligibleReason:
  "belowThreshold"` 필드가 결과에 새로 추가되면서 `toEqual` 비교가 깨져 기대값을 갱신했다(계산
  로직이 아니라 반환 타입에 필드가 늘어난 데 따른 자연스러운 갱신 — 판정 결과 자체는 변경 없음).
- `registry.test.ts`가 이번 v2 작업과 무관하게 이미 깨져 있던 것을 발견했다: `registry.ts`의
  `severance-pay` status는 v1 최종 PASS(위 "최종 종합 판정") 이후 `published`로 전환됐는데,
  테스트는 여전히 `status`가 `"draft"`라고 기대하고 있었다(과거 라운드에서 상태 전환 시 테스트를
  갱신하지 않은 누락). `npm test` 전체 통과가 확인 기준이므로, 이 테스트를 현재 사실(published)에
  맞게 정정했다 — `getPublishedCalculators()`가 "status가 published인 항목만 반환한다"는 필터
  로직 자체를 일반적으로 검증하는 테스트와, "severance-pay는 published 상태"라는 사실을 확인하는
  테스트로 나눠 갱신했다. 계산 공식/로직 변경이 아니라 사실관계가 바뀐 테스트를 현실에 맞게
  고친 것이다.

**4. 확인 결과**
- `npm test -- --run`: **51/51 통과**(logic.test.ts 27개[Golden 7 + Edge Case 14 + v2 신규 6],
  validation.test.ts 21개, registry.test.ts 3개, `--reporter=verbose`로 개별 테스트명까지 직접
  확인).
- `npx tsc --noEmit`: **에러 0건**(작업 시작 시점의 logic.ts 2곳·ui.tsx 1곳 에러 모두 해소).
- `npm run build`(`next build`, Turbopack): **성공**, 정적 페이지 7/7 생성.
- `npm run lint`: **에러 0건**.
- **Golden Test 7개(FORMULA.md 예제 1~7) 값 불변 확인**: `logic.test.ts`의 예제 1~7 테스트 코드를
  전혀 수정하지 않았고(지급요건 미충족 예제 4·5는 반환 타입에 필드가 늘어난 것 외 기대 금액
  자체가 없음, 나머지 금액 계산 예제 1·2·3·6·7은 단 한 글자도 건드리지 않음), 5~8단계 계산 코드
  (`averageDailyWageJeon` 올림, `baseDailyWageJeon` 비교, `severancePayJeonExact` 곱셈,
  `Math.round` 최종 반올림)도 전혀 수정하지 않았다 — 변경은 오직 지급요건 판정 분기(`return`
  이전, 금액 계산이 시작되기 전에 조기 종료하는 코드)에 한정된다. 실행 결과도 7,868,434원 /
  9,994,521원 / 3,000,000원(예제 3·6) / 653,068원(예제 7)이 그대로 유지됨을 테스트 통과로
  재확인했다.
- Builder는 이 "테스트 통과" 결과가 최종 정확성 판정이 아님을 다시 강조한다 — Calculation
  Auditor·QA의 독립 재검증이 필요하다(.claude/agents/builder.md).

## Calculation Auditor

### 1차 감사 (2026-09-02) — 아래 원문 그대로 보존(이력)

#### 1. 구현 ↔ FORMULA.md 일치 여부: 대체로 일치 (세부 사항 아래)

`logic.ts`/`validation.ts`/`formatting.ts`를 코드로 직접 읽고 FORMULA.md "공식"/"계산 순서"/"정밀도·반올림 정책"/"예외" 절과 1:1 대조했다.

- **8단계 공식**: `logic.ts`가 FORMULA.md의 1~8단계를 순서·연산 그대로 구현. 임의 변형 없음.
- **전 단위 스케일링 + 완전정밀도 보존**: `toJeon`/`jeonToWon`으로 원↔전 변환하되, 5~7단계(1일 평균임금 → 퇴직금 exact)는 반올림 없이 float 그대로 이어감. `formatAverageDailyWageDetailed`(전 단위 올림 표시)는 `formatting.ts`에만 있고 `logic.ts`는 이를 호출하지 않는다 — **"표시용 반올림값이 계산에 재사용되는" 흔한 버그 패턴은 코드에 없음을 직접 추적으로 확인**(logic.ts 203~222행, formatting.ts는 logic.ts를 import하지 않고 반대로만 import됨).
- **나눗셈 최종 1회 원칙**: 7단계 `(baseDailyWageJeon * 30 * totalServiceDays) / 365` — 분자를 모두 곱한 뒤 마지막에 1회만 나눔. FORMULA.md 요구사항과 일치.
- **최종 반올림**: `Math.round(jeonToWon(...))` — 사사오입, FORMULA.md 8단계와 일치.
- **예외 처리**: `validation.ts`가 FORMULA.md "예외" 절의 모든 항목(필수값 누락, 날짜 순서, 음수, 소수 제한, 168시간 상한, 0/빈값→선택필드 undefined)을 실제로 막는지 코드 추적 + `validation.test.ts` 18개 케이스로 확인. 일치.
- **Golden Test 6개 + Edge Case 8개, 총 30개 테스트 전부 `npx vitest run` 통과**(직접 실행 확인, 2025-09-02).
- **독립 재계산(핵심 검증)**: 테스트가 "통과한다"는 사실이 아니라 기댓값 자체를 Node로 처음부터 다시 계산해 대조했다.
  - 예제1(moel 예시): baseDays=92, bonusAdd=1,000,000, leaveAdd=75,000, avgDaily=88,641.304347826..., exact=7,868,433.591..., round=**7,868,434** → 코드/테스트 값과 일치.
  - 예제2(민주노총): baseDays=90, avgDaily=69,666.666..., baseDaily=max(.,80000)=80,000, final=**9,994,521** → 일치.
  - 예제3/6: baseDays=92, avgDaily=100,000(정수), final=**3,000,000** → 일치.
  - 윤년 경계(2024-03-01 퇴사): baseStart=2023-12-01, baseDays=91(12월31+1월31+2월29) → 일치.
  - 거액 입력(3억원대): safeInteger 유지, 부동소수점 오버플로 없음(직접 계산해 확인) → 일치.
  - `formatAverageDailyWageDetailed`의 전 단위 올림(EPSILON=1e-6 보정)도 별도 스크립트로 재현해 "88,641원 31전" 등 기대 문자열과 일치함을 확인. 이 계산기의 baseDays 범위(89~92)·3/12 가산 구조상 실제로 나타날 수 있는 최소 분수 크기(~1/1104 jeon)가 EPSILON보다 훨씬 크므로, EPSILON 보정이 "진짜 미세 분수"를 잘못 삼킬 위험은 없음을 확인.
- **날짜/timezone**: `parseIsoDateUtc`가 `Date.UTC()`로만 날짜를 만들고 `new Date(문자열)`(로컬 timezone 의존)을 쓰지 않음을 코드로 확인. KST 자정 근처 경계에서도 문제 없음(대한민국은 DST 없음).

**미해결 구현 이슈 1건(아래 "발견된 이슈" Medium 참고)**: `calendarMonthsBefore`(logic.ts 91~99행)가 "월 이동 시 해당 일자가 없는 경우"(예: 5월 31일의 3개월 전 = 2월 31일 → 존재하지 않음)를 JS Date의 자동 오버플로 정규화(다음 달로 밀림)에 그대로 맡긴다. Builder는 이를 코드 주석으로 이미 정직하게 고지했고 FORMULA.md도 이 경계를 명시하지 않았으므로 **Builder 결함이 아니라 FORMULA.md 미명시 공백**으로 분류한다 — 근거는 아래 2번 항목에서 실제 정부 계산기 소스코드로 교차 검증했다.

#### 2. FORMULA.md ↔ 실제 근거 일치 여부: 부분 일치 — 조사 중 신규 근거 확보, 정책 충돌 1건 발견

FORMULA.md가 이미 "확인 필요"로 남긴 3개 항목을 재조사했다. 이전 조사(Formula Analyst)는 moel.go.kr이 "자바스크립트 폼 제출형이라 WebFetch로 결과를 가져올 수 없다"고 결론지었는데, **WebFetch는 HTML을 마크다운으로 변환하며 `<script>` 태그를 제거하기 때문에 실패한 것**이었다. 이를 우회해 `curl`로 페이지 원문 HTML을 가져와 `<script src>` 참조를 추출하고, 실제 계산 로직이 담긴 외부 JS 파일(`https://www.moel.go.kr/assets/calc/js/retire_cal.js`, `retire_util.js`)을 직접 다운로드해 읽었다. **이는 moel.go.kr의 실제 클라이언트 사이드 계산 알고리즘 원문이며, 추정이 아니라 소스코드 확인이다.**

**(a) moel.go.kr 최종 퇴직금 출력값 — 이번 조사로 확인(신규 해소)**
`retire_cal.js`의 `calRet()` 함수를 그대로 재현해 예제1 입력을 실행한 결과 **7,868,434원**이 나왔다(아래 (c) 참고 — moel은 평균임금을 전 단위 올림한 값을 최종식에 재사용하는데, 이 예제에서는 우연히 완전정밀도 방식과 같은 반올림 결과가 나왔다). FORMULA.md가 순수 산술로 추정했던 값과 결과적으로 일치하지만, **알고리즘 자체는 FORMULA.md/구현과 다르다**(아래 신규 발견 참고). "확인 필요" → **해소(단, 알고리즘 불일치는 별도 이슈로 신규 등록)**.

**(c) 최종 반올림 방식의 법적 강제 여부 — 실무적으로 격상 확인**
`retire_cal.js` 578~579행:
```js
reCalcSal = Math.round(reCalcSal);
reCalcSal = Math.floor(reCalcSal);
```
(두 번째 줄은 이미 정수인 값에 대한 무의미한 연산 — 순net 효과는 `Math.round`, 즉 사사오입.) 법 조문상 명문 규정은 여전히 못 찾았지만(그 점은 FORMULA.md 결론과 동일), **정부 공식 계산기의 실제 구현이 "사사오입"이라는 사실은 이제 추정이 아니라 소스코드로 확인됨**. FORMULA.md의 "확인 필요"를 "실무 확인됨(공식 계산기 소스코드 대조, 법령 명문 규정은 여전히 미발견)"으로 격상할 것을 권고한다.

**(b) 연차수당 3/12 가산의 행정해석 문서번호 — 여전히 확인 필요, 그리고 FORMULA.md의 추정 인용이 부정확할 가능성 발견**
FORMULA.md는 "근로기준과-3295(1994.5.24)"로 추정했으나, 이번 웹서치에서 실제로 존재가 확인되는 근접 문서는 **임금근로시간정책팀-3295(2007.11.5)**이며, 그 취지가 **임금근로시간과-2861(2021.12.15)**까지 유지되고 있는 것으로 나타났다(2차 출처 worklaw.co.kr 요약, 원문 미열람 — 여전히 부분 확인). 부서명·연도가 FORMULA.md의 추정과 다르다 — "-3295"라는 번호만 우연히 일치했을 가능성이 있다. 또한 이 해석의 실체 내용은 FORMULA.md/구현이 가정한 "연차수당 총액 × 3/12" 단순식보다 복잡하다 — **"퇴직으로 인해 비로소 발생하는 연차수당은 제외하고, 퇴직 전년도分 미사용수당 전환분의 3/12만 산입"**이 행정해석 취지다. v1 SPEC 범위(사용자가 `annualLeavePay12m`을 직접 입력)에서는 이 구분을 사용자가 스스로 해야 한다는 한계가 있다. 대법원 판례 사건번호는 이번 조사에서도 특정하지 못했다("확인 필요" 유지, 검색된 96누5469는 별개 쟁점(3개월 기산일)으로 보인다.

**신규 발견(가장 중요) — FORMULA.md의 "표시용 반올림 분리" 정책이 실제 moel.go.kr 알고리즘과 다르다**
FORMULA.md 51행/65행은 "화면 표시용 올림값을 7단계 계산에 재사용하지 말고 완전정밀도 값을 그대로 이어야 한다"고 명시하고, 이 원칙을 Builder가 정확히 구현했다(위 1번 참고). 그런데 `retire_cal.js`를 읽어보면 **moel.go.kr 공식 계산기 자신은 정확히 그 "재사용" 패턴을 그대로 쓰고 있다**:
```js
// avrPayCal(): 1일 평균임금을 소수 둘째자리(전 단위)에서 올림해 화면(main.avrPay.value)에 표시
rounding = myCeil((totalPay/sumday), 2) + "";
main.avrPay.value = rounding;
// calRet(): 위에서 표시한 "올림된" avrPay 값을 그대로 다시 파싱해 최종 계산에 사용
var calPay = delCom(main.avrPay.value, ...);   // = 올림된 표시값, 완전정밀도 아님
let reCalcSal = calPay * 30 * main.termDays.value / 365;
```
즉 moel.go.kr은 "전 단위 올림된 1일 평균임금"을 최종 퇴직금 공식에 그대로 대입한다 — FORMULA.md가 "지양해야 할 버그 패턴"이라고 명시한 바로 그 방식이다.

두 방식(완전정밀도 vs 올림 재사용)이 실제로 얼마나 자주 다른 결과를 내는지 Node로 직접 대조했다(baseDays 89~92 × wage3m 다양한 값 × termDays 다양한 값, 총 525,552개 조합 샘플):
- **41.5%의 조합에서 최종 원 단위 금액이 서로 다르게 나왔다.**
- 차이의 방향은 **항상 한쪽으로 편향**된다 — `ceil(avg,2)`가 완전정밀도보다 항상 크거나 같으므로, moel 방식(올림 재사용) 결과가 완전정밀도 방식(FORMULA.md/구현) 결과보다 **작아지는 경우는 0건**이었고, 41.5%는 moel 쪽이 더 크거나 같았다(샘플에서 실제로 관측된 것은 "같음" 58.5% + "moel이 1원 이상 더 큼" 41.5%).
- 즉, **본 계산기(완전정밀도 방식)는 예제 1처럼 우연히 일치하는 입력을 빼면, 실제 사용자 입력의 상당수(표본상 40%대)에서 moel.go.kr 공식 계산기보다 낮은(또는 같은) 금액을 보여줄 것으로 예상된다.** 사용자가 두 계산기를 직접 대조하면 "우리 사이트가 정부 계산기보다 적게 나온다"는 불일치를 실제로 발견할 가능성이 높다.

이는 Builder의 구현 오류가 아니다(Builder는 FORMULA.md를 정확히 구현했다). **FORMULA.md 자체가 채택한 반올림 분리 원칙이, 이 계산기가 벤치마크로 삼는 정부 공식 계산기의 실제 산출값과 구조적으로 다른 결과를 낼 수 있다는 사실이 이번 조사에서 처음 확인된 것**이므로, Formula Analyst 재검토가 필요한 High 등급 "공식 재검토 요청"으로 분류한다.

#### 3. 발견된 이슈 (등급별, 1차)

| # | 등급 | 분류 | 내용 |
|---|---|---|---|
| 1 | **High** | 공식 재검토 요청 (Builder 결함 아님) | FORMULA.md의 "완전정밀도 유지" 반올림 정책이 moel.go.kr 실제 계산기의 "전 단위 올림값 재사용" 알고리즘과 구조적으로 다르다. 샘플 표본 41.5%에서 최종 금액이 다르며, 항상 본 계산기 쪽이 moel.go.kr보다 낮거나 같게 나온다. "정부 공식 계산기와 결과가 다를 수 있다"는 사용자 신뢰 리스크. Formula Analyst가 정책 결정 필요(moel 알고리즘을 그대로 따라갈지, 완전정밀도 원칙을 유지하되 화면에 그 차이를 고지할지). |
| 2 | Medium | 공식 재검토 요청 (FORMULA.md 미명시 공백, Builder는 code comment로 이미 고지) | `calendarMonthsBefore`가 월 이동 대상에 해당 일자가 없을 때(예: 5/31의 3개월 전=2/31) JS Date의 자동 정규화(다음 달로 밀림)를 그대로 사용해 baseDays가 실무 기대치보다 짧아진다. **moel.go.kr 소스코드에도 정확히 이 케이스(5월 29/30/31, `idx=3` 분기)에 대한 명시적 특수 처리가 있음을 확인**해 이 경계가 실제로 유의미한 문제임이 재확인됐다. 다만 moel의 패치도 5월 29~31만 다루고 7월 31일(→4월 30일 초과)·12월 31일(→9월 30일 초과) 같은 유사 케이스는 다루지 않아, "정답"이 무엇인지 자체가 정부 계산기 안에서도 완전히 일관되지 않는다. Formula Analyst 재검토 대상으로 유지하되, 최소한 moel과 동일하게 5월 29~31일 케이스는 맞출 것을 권고. |
| 3 | Low | 공식 재검토 요청 | 연차수당 3/12 가산 근거로 FORMULA.md가 인용한 "근로기준과-3295(1994.5.24)"는 이번 조사에서 실체를 확인하지 못했고, 대신 발견된 근접 문서는 "임금근로시간정책팀-3295(2007.11.5)"(부서·연도가 다름, "-3295" 번호만 일치)다. 인용 정정 필요. 부수적으로 이 해석의 실체는 "퇴직으로 비로소 발생한 연차수당 제외" 등 단순 3/12보다 복잡함 — v1 SPEC 범위 한계로 문서화만 권장. |
| 4 | Low | 공식 재검토 요청 | 연차수당 3/12 산입과 배치되는 대법원 판례의 정확한 사건번호는 이번 조사에서도 특정하지 못했다("확인 필요" 유지, FORMULA.md 상태 변동 없음). |

구현 자체(Builder 산출물)에서는 **Critical/High/Medium/Low 이슈를 발견하지 못했다** — 위 4건은 모두 FORMULA.md/근거 문서 수준의 "공식 재검토 요청"이며 `.claude/agents/calculation-auditor.md`·본 작업지시에 따라 Builder FAIL 사유로 집계하지 않는다.

#### 4. 판정 (1차)

- **구현 ↔ FORMULA.md 일치**: PASS (Builder는 FORMULA.md를 임의 변경 없이 정확히 구현했고, Golden Test 6개 + Edge Case 8개를 독립 재계산으로 100% 재검증함)
- **FORMULA.md ↔ 실제 근거 일치**: 부분 PASS — 이전 "확인 필요" 2건(moel 최종값, 최종 반올림 방식)은 이번 조사로 신규 근거(정부 계산기 실제 JS 소스코드)를 확보해 해소/격상했으나, 그 과정에서 **FORMULA.md의 반올림 분리 정책 자체가 실제 정부 계산기와 다른 결과를 낼 수 있다는 High 등급 신규 이슈**를 발견했다.
- **종합 판정**: **FAIL** (Critical 0, High 1 — 위 표 #1 — 이 해소되기 전까지는 docs/EVALUATION.md PASS 기준 "High 0"을 충족하지 못한다). Formula Analyst가 표 #1(반올림 정책 vs moel.go.kr 실제 알고리즘 불일치)에 대해 명시적 결정을 내린 뒤 재감사할 것을 권고한다. 표 #2~#4는 Medium/Low로 병행 검토 가능.

---

### 2차 감사 (2026-09-02, Formula Analyst 재검토 + Builder 재구현 이후)

Formula Analyst가 FORMULA.md 반올림 정책을 "moel.go.kr 전 단위 올림값 재사용" 방식으로 전환하고 baseDays 월말 clamp 정책을 명문화한 뒤, Builder가 `logic.ts`를 재구현했다. 1차 FAIL 사유(High #1)가 실제로 해소됐는지, 그리고 그 과정에서 새로운 문제가 생기지 않았는지를 독립적으로 재검증했다.

#### 1. High #1(반올림 정책) 해소 여부 — **해소 확인**

`logic.ts` 225~253행을 직접 읽었다. 5단계에서 `Math.ceil(averageDailyWageJeonExact - EPSILON)`으로 전 단위(jeon) 정수를 확정하고, 그 `averageDailyWageJeon` 값을 6단계(`baseDailyWageJeon` 산출)·7단계(`severancePayJeonExact` 곱셈)까지 그대로 재사용한다. 5단계 이후로는 완전정밀도 값이 코드 어디에도 남지 않는다(1차 감사 때 지적했던 "완전정밀도를 계속 이어가는" 옛 방식은 코드에서 완전히 제거됨). FORMULA.md 5~7단계 서술과 1:1 일치.

moel.go.kr의 실제 계산 스크립트를 다시 `curl`로 받아 재확인했다(`https://www.moel.go.kr/assets/calc/js/retire_util.js`, `retire_cal.js`, 확인일 2026-09-02, 1차 감사와 동일 URL — 내용 변경 없음 재확인):
- `retire_util.js`의 `myCeil(num,pos){ return Math.ceil(num*posV)/posV; }` — FORMULA.md/logic.ts의 "전 단위 올림"과 정확히 같은 연산.
- `retire_cal.js`의 `avrPayCal()`이 `rounding = myCeil(totalPay/sumday, 2)`를 `main.avrPay.value`(화면 표시값)에 저장하고, `calRet()`이 그 값을 다시 파싱해(`calPay`) `calPay * 30 * termDays / 365`로 최종 계산 후 `Math.round`로 마무리하는 구조를 재확인 — FORMULA.md가 인용한 발췌·1차 감사의 확인과 100% 동일.

**Node로 두 알고리즘(moel 재현 vs v1/logic.ts 재현)을 대량 대조했다** — 이번엔 1차보다 더 엄밀하게, moel의 실제 클라이언트 코드가 `avrPay`를 **문자열로 저장했다가 다시 `parseFloat`으로 파싱**하는 구체적인 방식(위 코드 발췌 그대로)까지 재현한 참조 구현을 새로 작성해 비교했다(1차 감사의 525,552-조합 대조는 이 문자열 왕복 디테일까지는 재현하지 않았을 가능성이 있다 — 아래 5번 신규 발견 참고).
- baseDays 89~92 × 다양한 wage3m/bonus12m/leave12m/termDays/ordinaryDailyWage 조합 약 31.6만 건 샘플: **원래 41.5% 수준이던 불일치가 0.019%(60/316,512건)로 급감**했고, 남은 불일치는 정책 차이가 아니라 순수 부동소수점 표현 문제로 판명됐다(아래 5번).
- **결론: 1차에서 지적한 "완전정밀도 vs moel 올림-재사용"이라는 구조적·정책적 불일치(41.5%, 항상 본 계산기가 낮게 나옴)는 완전히 해소됐다.** High #1은 **해소**로 판정한다.

#### 2. baseDays 월말 clamp 재검증 — **정책·구현 모두 정확함을 손계산으로 확인**

`calculateBaseDays`/`calendarMonthsBefore`(logic.ts 94~120행)를 코드로 추적한 뒤, "테스트 통과"가 아니라 **직접 손으로 날짜를 계산해** 기대값 자체를 검증했다(모두 요일-무관 순수 달력일수 계산).

| 퇴사일 | 3개월 전(clamp 적용) | 손계산 근거 | baseDays 기대값 | 테스트 값 |
|---|---|---|---|---|
| 2024-05-31(윤년) | 2024-02-29 | 2월(29,윤년 나머지)+3월(31)+4월(30)+5월(31일 중 31) → day-of-year 152−60=92 | 92 | 92 (일치) |
| 2023-05-31(평년) | 2023-02-28 | day-of-year 151−59=92 | 92 | 92 (일치) |
| 2024-07-31 | 2024-04-30(4월엔 31일 없음→30일 clamp) | day-of-year 213−121=92 | 92 | 92 (일치) |
| 2024-12-31 | 2024-09-30(9월엔 31일 없음→30일 clamp) | day-of-year 366−274=92 | 92 | 92 (일치) |
| 2024-03-01(윤년 경계) | 2023-12-01(1일은 clamp 불필요) | 12월(31)+1월(31)+2월(29,윤년)=91 | 91 | 91 (일치) |
| 2023-03-01(평년 대조군) | 2022-12-01 | 12월(31)+1월(31)+2월(28,평년)=90 | 90 | 90 (일치) |

6개 경계 모두 FORMULA.md의 "모든 월말 경계에 동일하게 clamp" 정책과 정확히 일치하는 값이 나온다. 5월(윤년/평년)뿐 아니라 moel이 처리하지 않는 7월·12월 경계까지 동일 규칙으로 정확히 처리됨을 직접 확인했다. moel.go.kr 소스(`retire_cal.js` 234행 `if((emon+eday=='529'&&!isLeafYear)||...=='530'||...=='531')`)를 재확인한 결과 여전히 5월 29~31일만 하드코딩 처리하고 7월·12월엔 대응 분기가 없음을 재확인 — FORMULA.md가 "moel의 부분 패치를 의도적으로 따르지 않는다"고 명시한 판단의 근거가 유효함을 재확인했다. **Medium #2(1차)는 해소.**

#### 3. 예제 7(회귀 테스트) 검산 — **653,068원 확인, 구 정책 653,067원도 확인**

FORMULA.md 예제 7(wage3m=1,000,000원, baseDays=92, totalServiceDays=731일)을 처음부터 분수로 직접 검산했다.
- `averageDailyWage_exact = 1,000,000/92 = 10,869.565217...원` (92×10,869=999,948, 잔여 52, 52/92=0.565217...) → `ceil(.,2) = 10,869.57원`. 코드/테스트 값과 일치.
- v1 정책: `exact = 10,869.57 × 30 × 731 / 365`. `10,869.57×30 = 326,087.1`. `326,087.1×731 = 238,369,670.1`. `÷365 = 653,067.589...원`(365×653,067=238,369,455, 잔여 215.1, 215.1/365=0.58932...) → `round → 653,068원`. **테스트 기대값과 일치.**
- 구 정책(완전정밀도) 가정치: `exact = (1,000,000×30×731)/(92×365) = 21,930,000,000/33,580`. 장제산으로 직접 계산: `33,580×653,067=21,929,989,860`, 잔여 `10,140`, `10,140/33,580=0.30197...` → `653,067.302...원 → round → 653,067원`. **FORMULA.md 주장과 일치** — 신·구 정책이 정확히 1원 차이로 갈리는 것을 손계산으로 직접 재현했다.

이 예제는 실제로 두 정책을 구분하는 유효한 회귀 테스트임을 확인했다.

#### 4. EPSILON 트릭 검증 — **문제 없음(대량 스트레스 테스트)**

`Math.ceil(averageDailyWageJeonExact - EPSILON)`(EPSILON=1e-6)이 부동소수점 오차로 오작동하지 않는지 Node로 별도 스트레스 테스트를 수행했다(BigInt 정수 연산으로 만든 "수학적 정답"과 대조):
- **정확히 나누어떨어지는 80만 건**(baseDays 89~92 × wage3m을 baseDays의 배수로 구성, k=1~200,000)에서 전부 정답과 일치 — EPSILON이 "정수 경계를 실수로 반내림"시키는 사례는 0건.
- **일반 랜덤 조합 87,600건**(baseDays 89~92 × wage3m 0~500,000원 137원 간격 × bonus/leave 다양한 값)에서도 전부 BigInt 정답과 일치 — EPSILON이 "진짜 미세 분수"를 잘못 삼키는 사례는 0건.
- 이 계산기의 분수 구조(bonus/leave가 ÷4 단위, wage3m 합산 후 ÷baseDays)상 실제 발생 가능한 최소 0이 아닌 분수 크기는 `1/(4×baseDays) ≈ 0.0027 jeon`으로 EPSILON(1e-6)보다 약 2,700배 크다 — 1차 감사의 결론과 동일하게, EPSILON이 안전한 크기임을 재확인.
- **거액 입력(3억원대, extreme test와 동일 자릿수)**에서도 844건 전수 대조 결과 이상 없음 — 안전 정수 범위 내에서 오버플로 없음.
- **결론: EPSILON 트릭 자체는 새로운 버그를 만들지 않았다.**

#### 5. 신규 발견 — moel.go.kr 실제 라이브 계산기와 극희귀 부동소수점 경계에서 완전히 일치하지 않음 (Medium, 신규)

작업 지시("완전히 일치하는지... 정직하게 확인하라")에 따라 1차보다 더 엄밀한 대조를 수행한 결과, **아주 드물게(약 0.02~0.03%) v1 구현이 moel.go.kr 실제 라이브 계산기와 1원 차이가 나는 경우를 발견했다.**

원인: moel.go.kr의 `calRet()`은 `avrPay`(올림 확정값)를 **화면 표시용 문자열로 저장했다가 다시 `parseFloat`으로 파싱**해(`16899.85` 같은 십진 리터럴 → JS double) 그 값을 `calPay * 30 * termDays / 365`처럼 **단계적으로** 곱셈·나눗셈한다. 반면 v1(`logic.ts`)은 올림 확정값을 **정수 jeon**으로 유지하고 `(baseJeon × 30 × totalServiceDays)`를 정수 곱셈으로 먼저 계산한 뒤 **최종에 딱 한 번만** 365로 나눈다(FORMULA.md 7단계 "나눗셈은 마지막에 한 번만" 원칙을 오히려 더 엄격히 지킨 결과).

두 접근 모두 "올림값 재사용 → 30×termDays/365 → 최종 사사오입"이라는 **같은 알고리즘**을 구현하지만, 계산이 진행되는 부동소수점 경로가 다르기 때문에 **최종 결과가 정확히 X.5000...원(반올림 경계)에 걸리는 극히 드문 입력**에서 서로 다른 반올림 결과가 나올 수 있다. 실제 사례로 직접 검증했다(Node, `baseDays=89, wage3m=670,753원, bonus12m=3,333,333원, leave12m=0, termDays=365`):
- 수학적으로 정확한 값(분수 연산): `severancePay(exact) = 506,995.5원` — 정확히 반올림 경계.
- **v1(logic.ts) 결과**: 정수 jeon 경로로는 `50,699,550/100 = 506,995.5`가 부동소수점으로도 정확히 표현되어(0.5는 이진수로 정확히 표현 가능) `Math.round(506,995.5) = 506,996원`(사사오입 정책대로 올바르게 올림).
- **moel.go.kr 실제 경로**: `avrPay=16899.85`(정확한 값)를 다시 `parseFloat`한 뒤 `×30`하면 `506,995.49999999994`(부동소수점 표현 오차로 정확한 0.5보다 미세하게 작은 값)가 되어 `Math.round(...) = 506,995원`(1 낮게 나옴) — **moel 자신의 클라이언트 스크립트에 존재하는 부동소수점 표현 오차 버그**다.

이 케이스를 실제 moel 알고리즘(문자열 왕복까지 재현)과 v1을 대량 대조(baseDays 89~92 × 실사용 가능한 범위의 wage3m/bonus/leave/termDays/ordinaryDailyWage 조합 316,512건 및 "10,000원 단위로 끊어지는 현실적 임금" 41,632건 별도 샘플)로 검증한 결과:
- 불일치 발생률 약 **0.019~0.029%**(약 3,000~5,000건 중 1건 꼴).
- 방향은 **표본 전부(60/60, 12/12)에서 v1이 moel보다 정확히 1원 더 높게** 나왔다 — moel이 더 높게 나오는 경우는 0건. 즉 1차 High #1의 "본 계산기가 항상 정부 계산기보다 낮게 나온다"는 사용자 신뢰 리스크의 **반대 방향**이며, 사용자에게 불리한 방향이 아니다.
- 근본 원인은 v1의 설계 결함이 아니라 **moel.go.kr 자신의 클라이언트 스크립트가 "올림값을 문자열로 저장했다가 재파싱해서 단계적으로 곱하는" 방식 때문에 겪는 부동소수점 정밀도 손실**이다. v1이 채택한 "정수 jeon 유지 + 최종 1회 나눗셈"은 오히려 FORMULA.md 7단계 원칙과 일반적인 수치해석 관행("나눗셈을 최대한 늦게 한 번만 수행해 오차를 줄인다")에 더 부합하는 더 견고한 구현이다.

**평가**: 이는 "moel.go.kr과 완전히 100% 비트 단위로 동일하다"는 주장이 엄밀하게는 사실이 아님을 보여주는 실증적 반례이므로 정직하게 이슈로 등록한다. 다만 1차 High #1(41.5%, 구조적·정책적 불일치, 항상 사용자에게 불리한 방향)과는 성격이 전혀 다르다 — 발생 빈도가 약 2,000배 낮고(41.5% → 0.02%), 방향이 사용자에게 불리하지 않으며(오히려 유리), 원인이 이 프로젝트의 설계 결함이 아니라 moel.go.kr 자체의 부동소수점 버그다. **Medium으로 등급을 매긴다** — Critical/High가 아니므로 PASS를 막지 않지만, FORMULA.md/코드 주석의 "moel.go.kr과 완전히 일치" 서술은 "알고리즘(연산 순서)은 동일하나, moel 자신의 부동소수점 표현 오차로 인해 극희귀 경계(약 0.02%, 1원, 항상 v1이 더 높음)에서는 비트 단위로 완전히 일치하지 않을 수 있다"는 단서를 다는 것을 권고한다(Formula Analyst 재량, 차기 재검토 시 처리 권장 — 이번 판정을 블로킹하지 않음).

#### 6. 1차 Medium/Low 이슈 처리 현황

| 1차 # | 등급 | 2차 확인 결과 |
|---|---|---|
| 1(High) | High | **해소** — 위 1번 참고 |
| 2(Medium) | Medium | **해소** — 위 2번 참고 |
| 3(Low, 연차수당 인용) | Low | FORMULA.md가 "임금근로시간정책팀-3295(2007.11.5)"로 인용 정정 완료(FORMULA.md "기준/출처" 절). 다만 정부 원문 PDF는 여전히 미열람("부분 확인" 상태 유지) — **등급 Low 그대로 유지**(완전 해소 아님, 인용 자체는 정정됨). |
| 4(Low, 판례 사건번호) | Low | FORMULA.md도 "확인 필요로 유지"라고 스스로 명시. 이번 감사에서도 별도 조사하지 않음(범위 밖) — **등급 Low 그대로 유지**. |

#### 7. 다른 PASS 기준 확인

- `npm test -- --run`: **39개 테스트 전부 통과**(직접 실행 확인, 2026-09-02). Golden Test 7개(FORMULA.md 예제 1~7) + Edge Case 12개 포함.
- `npx tsc --noEmit`: **에러 0건**.
- `npm run build`(`next build`, Turbopack): **성공**(TypeScript 통과, 정적 페이지 생성 6/6 완료). 콘솔/빌드 에러 0건.

#### 8. 종합 판정 (2차)

- **1차 FAIL 사유(High #1)**: **해소 확인**(정책 전환 + moel.go.kr 실제 알고리즘과의 대량 대조로 구조적 불일치 41.5%→0.02% 이하로 축소, 남은 잔차는 성격이 다른 신규 Medium으로 별도 등록).
- **1차 Medium #2**: **해소 확인**(월말 clamp 손계산 6건 전부 일치).
- **1차 Low #3, #4**: 등급 유지(Low) — 완전 해소는 아니나 PASS를 막는 등급 아님.
- **신규 발견**: Medium 1건(moel.go.kr 라이브 계산기와의 극희귀(~0.02%) 부동소수점 경계 불일치, 방향은 사용자에게 유리, 원인은 moel 측 부동소수점 버그) — Critical/High 아님.
- **Critical 0, High 0, Medium 1(신규, 비차단), Low 2(유지, 비차단)**. Golden Test 100% 통과, TS/빌드 에러 0.
- **최종 판정: PASS.** docs/EVALUATION.md 기준(Critical 0, High 0)을 충족한다. Medium/Low 항목은 PASS를 막지 않으며, 각각 문서화 개선(신규 Medium: FORMULA.md에 "비트 단위 완전 일치는 아님" 단서 추가 권고) 및 원문 확인(기존 Low 2건, 정부 PDF 열람 시도)을 후속 과제로 남긴다.

---

### 3차 재검증 (2026-09-02, Optimizer가 UX/UI Critic High H1·Medium M1~M3·Low L1~L2 및 QA
Medium/Low 대응으로 `types.ts`/`logic.ts`/`validation.ts`를 수정한 이후)

Optimizer는 산출물 기록(위 "Optimizer 수정 내역")에서 "계산 공식(1~8단계 산식, 반올림 정책)은
전혀 건드리지 않았다"고 주장했다. 이번 3차는 그 주장을 형식적으로 재검증하는 것이 목적이다 —
테스트가 통과한다는 사실이 아니라 `logic.ts` 원문을 diff 관점에서 직접 다시 읽고, 2차 감사 때
PASS 판정했던 5~8단계 코드(평균임금 올림/6~7단계 재사용/최종 곱셈/최종 반올림)가 문자 그대로
동일한지 확인했다.

#### 1. 계산 공식(5~8단계) 무변경 여부 — **확인, 한 글자도 바뀌지 않음**

`src/calculators/severance-pay/logic.ts`(238~261행)를 2차 감사가 인용한 원문과 1:1 대조했다.

```ts
const averageDailyWageJeonExact =
  (wage3mJeon + bonusAdditionJeon + leavePayAdditionJeon) / baseDays;
const averageDailyWageJeon = Math.ceil(averageDailyWageJeonExact - EPSILON);

const baseDailyWageJeon =
  ordinaryDailyWageJeon != null
    ? Math.max(averageDailyWageJeon, ordinaryDailyWageJeon)
    : averageDailyWageJeon;

const severancePayJeonExact =
  (baseDailyWageJeon * SEVERANCE_DAYS_PER_YEAR * totalServiceDays) /
  DAYS_PER_YEAR;

const severancePay = Math.round(jeonToWon(severancePayJeonExact));
```

이는 2차 감사가 "logic.ts 225~253행"으로 인용했던 내용(5단계 `Math.ceil(...- EPSILON)` 올림
확정 → 6단계 `Math.max` 기준임금 비교 → 7단계 정수 곱셈 후 365 최종 1회 나눗셈 → 8단계
`Math.round` 사사오입)과 연산자·상수·순서·괄호 구조까지 완전히 동일하다. `calculateBaseDays`/
`calendarMonthsBefore`(월말 clamp, 94~120행)도 2차 감사 인용 원문과 동일함을 확인했다. 이 저장소는
git 저장소가 아니라(`Is directory a git repo: No`) 실제 `git diff`를 뜰 수는 없었으나, 2차
EVALUATION.md가 남긴 원문 인용이 사실상의 스냅샷 역할을 했고 그와 바이트 단위로 대조 가능했다 —
"형식적 diff 재검증"의 목적은 이 방법으로 충분히 달성됐다고 판단한다.

**변경된 부분은 정확히 한 곳, 지급요건 미충족 분기(196~209행)뿐이다**:
```ts
if (!isEligibleForSeverancePay(totalServiceDays, input.weeklyScheduledHours)) {
  return {
    eligible: false,
    insufficientServicePeriod: totalServiceDays < MIN_SERVICE_DAYS_FOR_ELIGIBILITY,
    insufficientWeeklyHours: input.weeklyScheduledHours < MIN_WEEKLY_HOURS_FOR_ELIGIBILITY,
  };
}
```
`isEligibleForSeverancePay()` 자체(136~144행, 판정 조건식)는 1글자도 바뀌지 않았고, 새로 추가된
두 필드는 **이미 계산되어 있던** `totalServiceDays`/`input.weeklyScheduledHours` 값을 기존 판정
임계값(`MIN_SERVICE_DAYS_FOR_ELIGIBILITY`/`MIN_WEEKLY_HOURS_FOR_ELIGIBILITY`, 상수도 무변경)과
다시 비교한 boolean 파생값일 뿐이다. 이 분기는 `baseDays`/`wage3mJeon`/평균임금/최종 곱셈 등
`eligible: true` 경로의 어떤 변수도 계산하기 **이전에** `return`으로 함수를 종료시킨다 — 즉
금액이 계산되는 코드 경로(3~8단계 전체)는 이 분기가 실행될 때 아예 실행되지 않으며, 반대로
`eligible: true`로 빠지는 입력에서는 이 분기 자체가 실행되지 않는다. 두 경로가 서로 배타적이므로
사유 필드 추가가 금액 계산 결과에 영향을 줄 수 있는 경로 자체가 코드 구조상 존재하지 않는다.
**Golden Test 7개(FORMULA.md 예제 1~7) 전부 기존 기댓값 그대로 통과**(아래 4번)하는 것도 이를
실행 결과로 재확인한다. `types.ts`의 변경도 `SeverancePayIneligibleResult`에 필드 2개를 추가한
것뿐, 기존 필드/`SeverancePayEligibleResult`(금액 관련 타입)는 무변경이다.

**결론: Optimizer 주장대로 계산 공식은 정확히 무변경이다.**

#### 2. `validation.ts` 콤마 파싱 검증 — **정확함, 사소한 비영향 엣지케이스 1건 관찰**

`toOptionalNumber()`(85~92행, `value.replace(/,/g, "")` 후 `Number()`)를 코드와 동일하게
Node로 재현해 13개 케이스를 직접 실행했다: `"9,200,000"→9200000`, `"9200000"→9200000`,
`"1,000"→1000`, `"10,000,000,000"→10000000000`, `"1,234.5"→1234.5`(소수 콤마도 정상),
`"-1,000"→-1000`, `""→undefined`, `undefined→undefined`, `"abc"→NaN`,
`"1,000abc"→NaN`(errors로 잡힘) — 전부 기대대로 정확했다.

관찰 1건(비영향, 참고용): 입력이 콤마로만 이루어진 경우(`","`,`",,,"` 등) `replace`가 빈 문자열을
만들고 `Number("")`가 `0`을 반환해 `toOptionalNumber(",,,")`가 `NaN`이 아니라 `0`(유효한 값)이
된다. 콤마 스트리핑을 추가하기 전에는 `Number(",,,")`가 바로 `NaN`이었으므로 이번 변경이 만든
사소한 신규 분기이지만, `ui.tsx`의 `handleAmountChange`가 입력 중 숫자 아닌 문자를 이미 걸러내
콤마만 남는 문자열이 실제 UI 경로로는 만들어지지 않는다(코드 확인, `ui.tsx` `handleAmountChange`
—숫자 제거 정규식이 콤마도 함께 제거 후 재포맷). 계산 정확성에 영향 없는 이론적 엣지케이스라
Low로도 등록하지 않고 기록만 남긴다.

#### 3. `validation.ts` 금액 상한(100억원) 검증 — **정상 범위를 막지 않음, 경계값 정확**

`validateRequiredAmount`/`validateOptionalAmount`의 `options.max`/`num > options.max` 로직을
그대로 재현해 직접 실행했다:
- `10,000,000,000`(상한 정확히) → 통과(차단 아님). `validation.test.ts`("wage3m이 상한(100억원)과
  정확히 같으면 통과한다") 기댓값과 일치.
- `10,000,000,001`(상한+1) → 차단. `validation.test.ts`("wage3m이 상한을 초과하면 실패한다")과 일치.
- `9,999,999,999`(상한-1) → 통과.
- 실사용 정상 범위 샘플(`wage3m=9,200,000`, `3,000,000` 등 SPEC/FORMULA 예제 값)은 상한의
  1/1000 수준에 불과해 오탐(false block) 위험이 전혀 없음을 확인했다.

**부수 발견(Low, 비차단, 이번 변경의 회귀 아님)**: `MAX_AMOUNT_WON`(100억원)이 `wage3m`(3개월
총액)과 `ordinaryDailyWage`(1일 통상임금)에 동일하게 적용된다. 1일 통상임금이 실제로 100억원에
근접하는 값(연봉 약 3.6조원 수준, 현실에서 불가능)으로 입력되고 동시에 `totalServiceDays`가
수백~수만 일(수년~수십 년, `hireDate`/`retireDate`에 범위 제한이 없어 이론상 가능)에 이르는
극단적 조합에서는, `severancePayJeonExact` 계산의 중간 곱셈(`baseDailyWageJeon * 30 *
totalServiceDays`)이 `Number.MAX_SAFE_INTEGER`(2^53)를 넘어 부동소수점 정밀도를 잃을 수 있다.
BigInt 완전정밀도 값과 대조하는 스트레스 테스트(Node, 이번 감사에서 직접 작성·실행)로 확인한
결과, `baseDailyWageJeon`이 상한 근방(90~100%)이고 근속일수가 단 775일(약 2.1년)만 되어도
±1원 불일치가 나타나기 시작하며(50만 샘플 중 294건, 0.06%), 상한 전체 범위 기준으로는 20万건
샘플 중 230건(0.115%)에서 항상 정확히 ±1원 차이가 관찰됐다. 다만 `1일 통상임금`을 현실적인
극단값(1,000만원/일, 심지어 1억원/일)으로 제한해 같은 스트레스 테스트를 반복하면 60년 범위
전체에서 불일치가 **0건**이었다 — 즉 이 문제는 `ordinaryDailyWage`가 필드의 실제 의미(1일
임금)로는 도달 불가능한 상한 근방 값을 취할 때만 발생한다. 이는 **이번 3차 변경으로 새로
생긴 회귀가 아니다** — 이 필드는 이번 라운드 이전에는 아예 상한이 없어 오히려 더 넓은 범위에서
같은 정밀도 손실이 가능했고, 이번 `MAX_AMOUNT_WON` 추가는 위험 범위를 줄이는 방향의 개선이다.
계산 공식 자체의 결함이 아니라 "3개월 총액용 상한을 1일 임금 필드에도 그대로 재사용한" 상한값
설계의 여유값 선택 문제이므로, Formula Analyst/Architect가 `ordinaryDailyWage`에 더 타이트한
별도 상한(예: 실사용 가능 범위를 감안한 1천만~1억원대)을 두는 것을 후속 개선으로 권고한다.
Critical/High가 아니며 실사용 입력 범위에서는 재현 불가능하므로 PASS를 막지 않는다.

#### 4. 자동 테스트 재실행 결과

- `npm test -- --run`: **44/44 통과**(직접 실행 확인). Golden Test 7개(FORMULA.md 예제 1~7)를
  포함한 기존 39개 전부 기존 기댓값 그대로 통과 — 계산 공식이 실행 결과 수준에서도 무변경임을
  재확인. 신규 5개(지급요건 미충족 사유 1개, validation 콤마/상한 4개)도 전부 통과.
- `npx tsc --noEmit`: 에러 0건.
- `npm run build`(`next build`, Turbopack): 성공, 정적 페이지 6/6 생성 정상.

#### 5. 신규 "지급대상 아님" 사유 테스트 검증 — **정확함**

`logic.test.ts`에 추가/갱신된 사유 테스트를 코드로 읽고 직접 손으로 재검산했다.

| 테스트 | 입력 | 기대 사유 | 검산 |
|---|---|---|---|
| 예제 4 | 2024-01-01~2024-06-30(181일), 40시간 | `insufficientServicePeriod:true, insufficientWeeklyHours:false` | 181<365(미충족), 40≥15(충족) → 일치 |
| 예제 5 | 2022-01-01~2024-01-01(730일), 10시간 | `insufficientServicePeriod:false, insufficientWeeklyHours:true` | 730≥365(충족), 10<15(미충족) → 일치 |
| 경계값 364일 | 2023-01-02~2024-01-01, 40시간 | `insufficientServicePeriod:true, insufficientWeeklyHours:false` | 364<365(365 미만, 미충족 경계 바로 아래) → 일치 |
| 경계값 14.9시간 | 40→14.9시간 | `insufficientServicePeriod:false, insufficientWeeklyHours:true` | 14.9<15 → 일치 |
| 신규(둘 다 미충족) | 2024-01-01~2024-06-30(181일), 10시간 | `insufficientServicePeriod:true, insufficientWeeklyHours:true` | 181<365이고 10<15, 두 조건 동시 성립 → 일치 |

5건 모두 `MIN_SERVICE_DAYS_FOR_ELIGIBILITY=365`/`MIN_WEEKLY_HOURS_FOR_ELIGIBILITY=15` 임계값과
정확히 일치하는 사유를 반환한다. 경계값(364일 vs 365일, 14.9시간 vs 15시간)과 "두 요건 동시
미충족" 케이스까지 포함되어 있어 사유 판정 로직의 네 가지 조합(둘 다 충족은 `eligible:true`
경로이므로 사유 필드 자체가 없음, 근속만 미충족, 시간만 미충족, 둘 다 미충족)을 전부 커버한다.
`npm test`로 실제 실행 결과도 통과함을 재확인했다(위 4번).

#### 6. 종합 판정 (3차)

- **계산 공식(1~8단계, 특히 2차 PASS 대상이었던 5~8단계) 무변경**: **확인**. 유일한 로직 변경은
  `eligible:false` 조기 반환 분기에 이미 계산된 값의 파생 boolean 2개를 추가한 것뿐이며, 이는
  금액 계산 경로와 코드 구조적으로 완전히 분리되어 있다.
- **콤마 파싱**: 정확함. 계산 결과에 영향 없는 이론적 엣지케이스(콤마만 입력 시 0) 1건 관찰,
  UI 경로로는 도달 불가.
- **금액 상한(100억원)**: 정상 범위 입력을 막지 않으며 경계값(100억원 통과/100억원+1원 차단)도
  정확하다. 부수적으로 `ordinaryDailyWage`(1일 임금)에 3개월 총액용 상한을 그대로 적용한 설계가
  극단적·비현실적 조합(1일 임금이 상한 근방 + 장기 근속)에서 이론적 부동소수점 ±1원 오차를
  만들 수 있음을 발견했다(Low, 비차단, 이번 변경 이전부터 존재했고 오히려 이번 상한 추가로
  위험 범위가 줄어든 사안 — Formula Analyst/Architect 후속 검토 권고).
- **테스트**: `npm test` 44/44, `tsc --noEmit` 0 에러, `npm run build` 성공.
- **신규 사유 필드 테스트**: 5건 전부 손으로 재검산해 정확함을 확인.
- **Critical 0, High 0, Medium 0(신규), Low 1(신규, 비차단, `ordinaryDailyWage` 상한 설계 여유).**
- **최종 판정: PASS.** Optimizer의 주장("계산 공식 자체는 무변경")은 코드 원문 대조로 사실임이
  확인됐고, 새로 추가된 사유 필드/콤마 파싱/금액 상한 로직도 모두 정확하다.

---

### v2 재검증 (2026-09-02, Builder가 주당 소정근로시간을 필수→선택으로 전환하고 3단계 판정
우선순위(자진신고→숫자판정→미입력 시 충족간주)를 구현한 이후)

Builder는 "계산 공식(5~8단계)은 전혀 건드리지 않았다"고 주장했다. 이번 재검증은 그 주장과 신규
판정 로직(`determineWeeklyHoursEligibility`) 자체의 정확성을 독립적으로 확인하는 것이 목적이다.
`tasks/severance-pay/FORMULA.md`("주당 소정근로시간 기본값 정책" 절), `logic.ts` 전체,
`logic.test.ts` 신규 v2 테스트 6개, `validation.ts`, `types.ts`를 코드로 직접 읽었다.

#### 1. 금액 계산 공식(5~8단계) 무변경 여부 — **확인, 문자 그대로 동일**

`logic.ts` 283~311행(5~8단계: `averageDailyWageJeonExact`/`Math.ceil(...-EPSILON)` 올림 확정 →
`baseDailyWageJeon` `Math.max` 비교 → `severancePayJeonExact` 정수 곱셈 후 365 최종 1회 나눗셈 →
`Math.round` 사사오입)을 3차 감사가 인용한 원문(위 "3차 재검증" 절, 당시 "logic.ts 238~261행"으로
인용)과 한 줄씩 대조했다 — 연산자·상수·괄호 구조·변수명까지 완전히 동일하다. `calculateBaseDays`/
`calendarMonthsBefore`(월말 clamp 로직, logic.ts 115~222행)도 2차/3차 감사가 검증한 원문과
동일함을 확인했다.

변경된 부분은 정확히 지급요건 판정 분기(`calculateSeverancePay` 239~259행)뿐이다 — 기존
`isEligibleForSeverancePay(totalServiceDays, weeklyScheduledHours < 15 비교)`가 신설된
`determineWeeklyHoursEligibility()` 호출로 교체됐다. 이 분기는 `baseDays`/`wage3mJeon`/평균임금
등 `eligible: true` 경로의 어떤 변수도 계산하기 **이전에** `return`으로 함수를 종료시키므로,
판정 로직 변경이 금액 계산 코드 경로에 영향을 줄 수 있는 구조적 경로 자체가 존재하지 않는다(3차
감사가 확인한 것과 동일한 구조적 논리 — 이번에도 코드로 재확인). **Builder 주장대로 5~8단계는
무변경이다.**

#### 2. `determineWeeklyHoursEligibility` 3단계 우선순위 정확성 — **FORMULA.md와 정확히 일치**

`logic.ts` 152~167행을 그대로 옮기면:
```ts
function determineWeeklyHoursEligibility(weeklyScheduledHours, underFifteenHoursDeclared) {
  if (underFifteenHoursDeclared === true) {
    return { insufficientWeeklyHours: true, reason: "declared" };
  }
  if (weeklyScheduledHours != null) {
    if (weeklyScheduledHours < MIN_WEEKLY_HOURS_FOR_ELIGIBILITY) {
      return { insufficientWeeklyHours: true, reason: "belowThreshold" };
    }
    return { insufficientWeeklyHours: false };
  }
  return { insufficientWeeklyHours: false }; // 우선순위 3번: 둘 다 미입력 — 충족 간주
}
```
FORMULA.md "판정 로직 (우선순위)" 1~3번과 분기 순서·조건식이 정확히 1:1 대응한다:
- **①** `underFifteenHoursDeclared === true`가 함수 최상단에서 **가장 먼저** 검사되고, 참이면
  `weeklyScheduledHours` 값을 전혀 들여다보지 않고 즉시 `return`한다 — 숫자가 얼마가 입력됐든
  (심지어 40시간처럼 요건을 넉넉히 충족하는 값이어도) 자진신고가 무조건 우선한다는 FORMULA.md
  "①이 우선한다" 서술과 정확히 일치. 우선순위가 뒤바뀔 여지가 코드 구조상 없다(첫 `if`가 통과되지
  않아야만 두 번째 분기에 도달).
- **②** "숫자가 입력됐는데 동시에 declared=false인 일반적인 경우"를 직접 추적했다 —
  `underFifteenHoursDeclared === true`가 거짓이면(즉 `false` 또는 `undefined`) 첫 분기를 그냥
  지나치고, `weeklyScheduledHours != null`(loose inequality라 `null`과 `undefined` 둘 다 걸러짐)
  검사로 넘어간다. 여기서 다른 분기로 실수로 새는 경로가 없음을 확인했다 — `declared`가 `false`인
  일반적인 입력(예: 체크박스 미선택 + 숫자 10 입력)은 반드시 이 두 번째 `if`로 들어가
  `belowThreshold` 판정을 받는다(테스트 (c)로 실행 결과까지 재확인, 아래 3번).
- **③** 첫 번째 `if`도, 두 번째 `if`의 `!= null` 조건도 모두 거짓일 때만(즉 자진신고 없음 **and**
  숫자 미입력) 마지막 `return`(충족 간주)에 도달한다 — FORMULA.md "둘 다 미입력 → 충족 간주"와
  정확히 일치.

`isEligibleForSeverancePay()`(177~187행)와 `calculateSeverancePay()`(246~249행) 모두 이 함수
하나만 호출해 판정하므로, 두 진입점 사이에 판정 로직이 갈라지거나 중복 구현되는 위험도 없다.

**결론: 우선순위 순서가 뒤바뀔 여지가 없고, 코드가 FORMULA.md 정책을 정확히 구현했다.**

#### 3. 독립 재계산 — v2 신규 테스트 6개 — **전부 기대값 정확함**

테스트가 통과한다는 사실이 아니라 기대값 자체를 손으로 재계산했다.

| 테스트 | 입력 | 손계산 | 기대값 일치 |
|---|---|---|---|
| (a) declared=true, hours=40, 2022-01-01~2024-01-01(730일), wage3m=6,000,000 | declared 최우선 → 즉시 미충족 | 730≥365(근속 충족), declared=true→즉시 미충족·reason="declared" | 일치 |
| (a-2) declared=true, hours 미입력, 나머지 동일 | declared는 숫자 유무와 무관 | 동일하게 즉시 미충족·"declared" | 일치 |
| (b) hours·declared 둘 다 미입력, 2023-01-01~2024-01-01(365일), wage3m=9,200,000 | 우선순위③ 충족 간주 | 365≥365(충족), 판정 생략→eligible, baseDays=92, avgDailyWage=9,200,000/92=100,000(정수)→severancePay=100,000×30×365/365=**3,000,000원** | 일치(Node 독립 재현으로도 3,000,000 확인, 아래) |
| (c) declared 없음, hours=10, 2022-01-01~2024-01-01(730일) | 우선순위② 숫자 판정 | 730≥365(충족), 10<15→미충족·"belowThreshold" | 일치 |
| (d) 예제4 재확인, hours=40, 2024-01-01~2024-06-30(181일) | 근속만 미충족 | 181<365(미충족), 40≥15(충족)→`insufficientWeeklyHours:false, reason:undefined` | 일치 |
| (d) 예제5 재확인, hours=10, 2022-01-01~2024-01-01(730일) | 시간만 미충족 | 730≥365(충족), 10<15→"belowThreshold" | 일치 |

(b)의 금액 부분은 Node로 별도 스크립트를 작성해 `logic.ts`를 import하지 않고 공식만으로
재현했다: `wage3mJeon=920,000,000jeon ÷ baseDays 92 = 10,000,000jeon(정수, 나누어떨어짐)` →
`Math.ceil(10,000,000-1e-6)=10,000,000` → `baseDailyWageJeon=10,000,000` →
`exact=10,000,000×30×365/365=300,000,000jeon` → `round(300,000,000/100)=3,000,000원`. 코드/테스트
기대값과 정확히 일치.

#### 4. Golden Test 1~7 회귀 확인 — **전부 동일 기대값, 무변경**

`logic.ts`를 import하지 않고 5~8단계 공식만 별도 Node 스크립트로 독립 재현해 예제 1·2·3/6·7을
재계산했다:

```
예제1(moel.go.kr): avgDailyWage=88,641.31원, severancePay=7,868,434원
예제2(민주노총, 통상임금 채택): avgDailyWage=69,666.67원, baseDailyWage=80,000원, severancePay=9,994,521원
예제3/6(항등 케이스): avgDailyWage=100,000원, severancePay=3,000,000원
예제7(회귀 테스트): avgDailyWage=10,869.57원, severancePay=653,068원
```

`totalServiceDays`/`baseDays` 중간값(예제1: 1,080일/92일, 예제2: 1,520일, 예제7: 731일, v2(b):
365일)도 순수 날짜 차이(`Date.UTC` 기반) 스크립트로 별도 재계산해 전부 일치함을 확인했다.
2차/3차 감사가 도달한 값(7,868,434 / 9,994,521 / 3,000,000 / 653,068)과 이번 v2 재검증의 독립
재계산 결과가 **글자 하나 다르지 않고 일치**한다 — 금액 계산 공식이 이번 v2 라운드에서도 회귀
없이 그대로 유지됐음을 재확인.

#### 5. Edge Case 검증

- **`weeklyScheduledHours=15`(경계값, declared=false)**: FORMULA.md "15시간 이상"이 요건이므로
  충족(`eligible:true`)이어야 한다. 코드 추적: `determineWeeklyHoursEligibility`에서
  `weeklyScheduledHours != null`(15는 null이 아님) → `15 < 15`는 거짓 → `insufficientWeeklyHours:
  false` → 충족. `logic.test.ts`의 기존 Edge Case Test("주당 소정근로시간 정확히 15시간이면
  지급요건을 충족한다")가 이 경계를 이미 다루고 있고 `npm test` 실행 결과 실제로 통과함을
  확인했다(아래 6번). **정확함.**
- **`weeklyScheduledHours=0`이고 `underFifteenHoursDeclared=false`(사용자가 실수로 0 입력)**:
  "0시간 입력"이 "미입력"과 구분되는지를 `validation.ts`→`logic.ts` 경로 전체로 추적했다.
  - `validation.ts`의 `toOptionalNumber()`(91~98행): `value === undefined || value === null ||
    value === ""`일 때만 `undefined`를 반환한다. 문자열 `"0"`(또는 숫자 `0`)은 이 조건에 걸리지
    않으므로 `Number("0") = 0`이 그대로 반환된다 — **0은 "미입력"으로 뭉개지지 않고 실제 값
    0으로 정확히 살아남는다.**
  - `logic.ts`의 판정 조건은 `weeklyScheduledHours != null`이다(엄격 동등이 아닌 loose
    inequality를 의도적으로 사용 — `null`/`undefined`만 걸러내고 `0`은 통과시킨다). `0 != null`은
    `true`이므로 0은 "숫자가 입력됨" 분기(②)로 들어가 `0 < 15` → **`insufficientWeeklyHours:
    true, reason: "belowThreshold"`**로 판정된다.
  - 즉 **0시간은 "미입력"(③번, 충족 간주)이 아니라 "숫자가 입력되어 15시간 미만으로 미충족"(②번)
    으로 정확히 구분 처리된다.** 이는 FORMULA.md "예외 > 주당 소정근로시간 극단값" 절의 "0시간
    입력 시 지급요건 미충족으로 자동 처리(위 지급요건 판정에서 걸러짐)"라는 명시적 서술과 정확히
    일치한다 — 임의 동작이 아니라 FORMULA.md가 이미 정한 정책을 코드가 그대로 구현한 것이다.
  - `underFifteenHoursDeclared`가 `false`로 명시적으로 전달된 경우도 `validation.ts`(272~273행)가
    `raw.underFifteenHoursDeclared === true ? true : undefined`로 정규화해 `false`를 `undefined`와
    동일하게 만들지만, `logic.ts`의 조건도 `=== true`만 검사하므로 `false`/`undefined` 두 값이
    항상 동일하게 취급된다 — 정규화 여부와 무관하게 판정 결과가 달라지지 않는다.

#### 6. 자동 테스트 재실행 결과

- `npm test -- --run`: **51/51 통과**(logic.test.ts 33개[Golden 7 + Edge Case 20 + v2 신규 6],
  validation.test.ts 21개 등, 직접 실행 확인, 2026-09-02).
- `npx tsc --noEmit`: **에러 0건**.
- `npm run build`(`next build`, Turbopack): **성공**, 정적 페이지 7/7 생성.

#### 7. 종합 판정 (v2 재검증)

- **금액 계산 공식(5~8단계) 무변경**: **확인**(문자 그대로 동일, 3차 감사 인용 원문과 대조).
- **3단계 판정 우선순위**: **FORMULA.md와 정확히 일치**. 우선순위가 뒤바뀌는 코드 경로 없음(자진
  신고가 숫자보다 항상 우선, 숫자가 있으면 반드시 그 값으로 판정, 둘 다 없을 때만 충족 간주).
- **독립 재계산**: v2 신규 테스트 6개 전부 손계산·Node 재현으로 기대값 정확함을 확인.
- **회귀**: Golden Test 1·2·3/6·7 전부 이전 감사와 동일한 최종값(7,868,434 / 9,994,521 /
  3,000,000 / 653,068원)으로 재확인, 변경 없음.
- **Edge Case**: `weeklyScheduledHours=15`(경계, declared=false) → 충족 확인. `weeklyScheduledHours
  =0`(declared=false) → "미입력"과 명확히 구분되어 "숫자 0 입력 → 15시간 미만 → 미충족
  (belowThreshold)"로 정확히 처리됨을 `validation.ts`→`logic.ts` 전체 경로로 추적 확인 — FORMULA.md
  예외 절의 명시적 정책과 일치.
- **신규 이슈**: 없음(Critical 0, High 0, Medium 0, Low 0).
- **최종 판정: PASS.** Builder의 주장("계산 공식은 무변경") 및 신규 판정 로직 정확성 모두
  코드 원문 대조·독립 재계산으로 사실임이 확인됐다. 이전 1~3차 PASS 판정은 그대로 유효하다.

## UX/UI Critic
(2026-09-02, Calculation Auditor 2차 PASS 이후 평가. `docs/DESIGN_SYSTEM.md`, `tasks/severance-pay/SPEC.md`,
`src/calculators/severance-pay/{ui.tsx,validation.ts,formatting.ts,logic.ts,types.ts}`, `tasks/severance-pay/FORMULA.md`를
직접 읽고 코드 근거로만 평가했다. Edit 권한이 없어 코드는 수정하지 않았다.)

### 자체 평가 질문 (최소 10개)

1. "지급대상 아님"이 나왔을 때, 사용자가 두 요건(계속근로기간 1년 / 주당 소정근로시간 15시간) 중 정확히 어느 쪽 때문인지, 혹은 둘 다인지 알 수 있는가?
2. "3개월 임금총액"을 사용자가 직접 합산해서 한 번에 입력하라는 요구가, 급여명세서의 어떤 항목을 더해야 하는지 구체적으로 안내되는가, 아니면 사용자가 스스로 판단해야 하는가?
3. `bonus12m`(12개월 상여금 총액)과 `wage3m`(3개월 임금총액) 사이에 상여금을 이중으로 넣거나 빠뜨릴 위험을 UI가 방지·안내하는가?
4. 결과 화면의 법령 라벨들이 조항번호만 나열하는 것이 아니라 그 의미를 일반 사용자가 이해할 수 있는 방식으로 서술되어 있는가?
5. 계산 근거 breakdown에 내부 조사·불확실성 상태를 나타내는 문구("확인 필요", "추정")가 사용자에게 그대로 노출되는 곳이 있는가?
6. "기준임금" 계산 시 통상임금 비교가 실제로 적용됐는지 여부를 사용자가 결과에서 한눈에 알 수 있는가?
7. 입력 오류 메시지가 "무엇이 왜 잘못됐는지" 구체적으로 알려주는가, 아니면 모호한 일반 문구인가?
8. 결과 화면의 정보 순서(핵심 결과 → 계산 상세 → 적용된 입력값 → 계산 방법 설명 → 정책 안내)가 `docs/DESIGN_SYSTEM.md`가 요구하는 순서와 실제 코드에서 그대로 일치하는가?
9. 좁은 모바일 화면(320~390px)에서 입력 필드·결과 그리드가 잘리거나 가로 스크롤을 유발할 만한 마크업 구조가 있는가?
10. 큰 금액(예: 9,200,000원)을 입력할 때 자릿수를 눈으로 확인하기 쉬운가(입력 중에도 천 단위 구분자가 보이는가)?
11. Reset/Sample 기능이 실제로 존재하며, 샘플 값이 유효한(지급대상에 해당하는) 계산 결과를 만들어내는가?
12. 접근성 측면에서 스크린리더 사용자가 필수/선택 여부·오류·결과 갱신을 색상에만 의존하지 않고 알 수 있는가?

### 질문별 답변

1. **아니오 — 원인을 구분해 주지 않는다.** `ui.tsx` 325~336행의 "지급대상 아님" 섹션은 두 요건("계속근로기간 1년 이상 및 4주 평균 주 소정근로시간 15시간 이상")을 한 문장에 나열만 하고 어느 쪽이 실패했는지 말하지 않는다. 구조적으로도 이는 불가능하다 — `logic.ts`의 `isEligibleForSeverancePay()`(136~144행)는 `boolean`만 반환하고, `types.ts`의 `SeverancePayIneligibleResult`(41~43행)는 `{ eligible: false }` 외에 어떤 필드도 없어 재직일수·근로시간 값 자체가 결과 객체에 실려 오지 않는다. 예를 들어 3년 근무했지만 주 10시간만 일한 사용자도, 6개월만 근무한 사용자도 똑같은 문구를 본다. SPEC.md가 명시한 "왜 그 금액인지까지 이해시키는 것을 목표로 한다"는 철학이 "지급대상 아님" 케이스에는 적용되지 않았다.
2. **부분적으로만 명확하다.** `wage3m` 필드의 label은 "퇴사일 이전 3개월 임금총액", helpText는 "퇴사일 이전 3개월간 통화로 지급된 임금총액을 합산해 입력해 주세요"(ui.tsx 88~94행)다. "퇴사일 이전 3개월"이라는 기간 자체는 명확하지만, 급여명세서의 어떤 항목(기본급+제수당 합계인지, 세전인지, 이미 지급된 정기상여가 포함되는지)을 더해야 하는지는 전혀 언급이 없다. SPEC.md가 v1에서 상세 모드(월별 항목 입력)를 의도적으로 제외했으므로 이 부담 자체는 Product Owner 단계에서 받아들인 트레이드오프이지만, 최소한 helpText에서 "급여명세서 세전 지급총액(기본급+각종 수당) 기준"처럼 조금 더 구체적으로 안내할 여지가 있다.
3. **안내하지 않는다.** `wage3m`과 `bonus12m`은 서로 다른 helpText를 갖고 있지만("3개월간 통화로 지급된 임금총액" vs "12개월 상여금 총액"), 두 필드 사이의 경계(예: 3개월 이내에 지급된 상여금이 `wage3m`에 이미 포함돼야 하는지, `bonus12m`으로 따로 빼야 하는지)에 대한 안내가 UI 어디에도 없다. 계산 방법 설명 4단계(ui.tsx 147~150행)의 legalBasis에도 이 구분 기준은 나오지 않는다. 이중계산/누락 위험을 사용자가 스스로 판단해야 한다.
4. **대체로 그렇다 — 단, 예외 1건.** `buildFormulaSteps`(ui.tsx 129~173행)의 각 단계는 법령 조항 뒤에 괄호로 의미를 풀어 쓴다(예: "근로기준법 제2조 제2항(평균임금 < 통상임금이면 통상임금 적용)"). 이 패턴은 6~7단계까지 일관되게 지켜진다. 그러나 4단계 legalBasis 문구 하나는 아래 5번 답변에서 다루는 대로 조항번호도 부정확하고 불확실성 표현이 그대로 노출돼 있어 이 원칙이 깨진다.
5. **그렇다 — 실제로 노출되는 곳이 있다(가장 심각한 발견).** `ui.tsx` 148~150행, "4. 상여금·연차수당 가산액 계산" 단계의 legalBasis는 다음과 같다: `"고용노동부 행정해석 임금 68207-120(2003.02.24) / 근로기준과-3295로 추정(1994.5.24, 확인 필요)"`. "-로 추정", "확인 필요"라는 내부 조사 상태 표현이 그대로 최종 사용자 화면에 노출된다. 게다가 이 문구는 최신 근거와도 어긋난다 — `tasks/severance-pay/FORMULA.md`(6~8행, 215행)는 2차 재검토에서 이 인용을 "임금근로시간정책팀-3295(2007.11.5)"로 이미 정정했고, `logic.ts` 216~217행의 내부 주석도 이 정정된 문구를 반영하고 있다. 그런데 실제 사용자에게 보이는 `ui.tsx`의 `buildFormulaSteps`만 구 문구를 그대로 갖고 있다 — Builder의 2차 재구현이 `logic.ts`는 갱신했지만 `ui.tsx`의 표시 문구는 갱신하지 않은 것으로 보인다. 일반 사용자는 "확인 필요"라는 표현의 맥락(내부 조사 진행 상태)을 전혀 알 수 없고, 법정 금액을 계산해 준다는 도구가 자신의 근거를 "추정"이라고 말하는 것을 보면 계산 전체의 신뢰도를 의심하게 될 수 있다. 8단계("실무 관행(원 단위 반올림/사사오입) — 명문 법령 규정은 확인되지 않음", ui.tsx 168~169행)도 FORMULA.md가 2차 재검토에서 "moel.go.kr 소스코드로 확인됨"으로 격상한 사실을 반영하지 못해 다소 오래된 문구이지만, 이쪽은 최소한 "확인 필요" 같은 표현을 쓰지 않아 4단계만큼 심각하지 않다.
6. **그렇다.** `ui.tsx` 379~390행 "기준임금(최종 적용)" 항목은 `appliedInput.ordinaryDailyWage != null && result.baseDailyWage > result.averageDailyWage`일 때만 "(통상임금 적용)" 라벨을 덧붙이고, 통상임금을 입력하지 않은 경우 408~412행에서 "통상임금 비교 미적용(1일 통상임금 미입력 — 평균임금만 사용했습니다)"라는 별도 안내를 보여준다. 어느 값이 왜 채택됐는지 결과 화면만으로 파악 가능하다.
7. **대체로 구체적이다.** `validation.ts`의 오류 메시지는 필드 라벨을 그대로 포함해 "입사일을 입력해 주세요.", "퇴사일은 입사일보다 늦어야 합니다.", "주당 소정근로시간은 168 이하여야 합니다." 처럼 무엇이 왜 잘못됐는지 즉시 알 수 있다. 각 오류는 `aria-describedby`로 해당 입력 필드와 연결되고 `role="alert"`가 붙어 있다(ui.tsx 270~294행). 다만 "퇴사일 형식이 올바르지 않습니다"처럼 날짜 형식 자체는 `type="date"` 네이티브 입력이라 실사용자가 이 오류를 볼 일은 드물 것으로 보인다.
8. **그렇다 — 코드와 정확히 일치한다.** `ui.tsx` 342~488행을 순서대로 읽으면 "핵심 결과"(예상 퇴직금, 342~349행) → "계산 상세"(재직일수·평균임금 등 부가 수치, 352~413행) → "적용된 입력값"(416~470행) → "계산 방법"(단계별 수식+법령 라벨, 473~488행) → (결과 영역 밖) "정책 안내"(494~510행) 순서로 정확히 `docs/DESIGN_SYSTEM.md`의 요구 순서를 따른다.
9. **구조적으로 큰 문제는 보이지 않는다.** 최상위 컨테이너가 `max-w-2xl`에 `px-4`(223행)로 좁은 화면에서도 여백을 확보하고, 입력 필드는 전부 `w-full`(50행), 결과 `dl`은 `grid-cols-1 sm:grid-cols-2`(354, 418행)로 기본이 1열이라 좁은 화면에서 잘리지 않는다. 버튼 영역은 `flex flex-wrap gap-3`(299행)라 버튼이 좁은 화면에서 줄바꿈된다. 고정 px 폭이나 `overflow`를 유발할 만한 요소는 발견하지 못했다. (단, 이는 마크업 구조 기준 판단이며 실제 브라우저 렌더링 확인은 QA Engineer 단계 몫이다.)
10. **아니오.** `wage3m`을 포함한 모든 금액 입력 필드는 `type="text"`(263행)의 순수 텍스트 입력이며, `handleChange`(188~192행)는 `event.target.value`를 가공 없이 그대로 state에 저장한다 — 입력 중 콤마 포맷팅이 전혀 없다. 결과 화면은 `formatWon`(formatting.ts 19~21행, `Intl.NumberFormat`)으로 "9,200,000원"처럼 콤마가 붙어 표시되는 것과 대조적으로, 입력 단계에서는 사용자가 "9200000386"처럼 콤마 없는 긴 숫자열을 직접 읽어야 한다. `docs/DESIGN_SYSTEM.md` "입력 UX" 절이 명시한 "천 단위 구분 표시" 요구와 어긋난다.
11. **그렇다.** "초기화"(handleReset, 208~213행)와 "샘플 값 채우기"(handleFillSample, 215~220행) 버튼이 모두 존재한다. `SAMPLE_FORM`(39~47행, hireDate 2023-01-01/retireDate 2024-01-01/weeklyScheduledHours 40/wage3m 9,200,000)은 재직일수 정확히 365일(지급요건 충족 경계값 통과)·주 40시간으로 두 요건을 모두 만족해 실제로 "지급대상 아님"이 아닌 정상 계산 결과(FORMULA.md 예제 3 계열, 3,000,000원)를 만들어낸다 — 샘플이 형식적으로 채워지기만 하는 게 아니라 실제로 유의미한 결과를 보여준다는 점에서 좋은 설계다.
12. **대체로 그렇다.** 모든 입력에 `<label htmlFor>`가 연결되고(245~262행), `aria-required`·`aria-invalid`·`aria-describedby`가 오류/도움말 id와 정확히 매핑된다(269~275행). 필수 표시(`*`)는 `aria-hidden="true"`로 장식 요소 처리되어 있고 대신 `aria-required`가 실제 정보를 전달하며, 선택 필드는 "(선택)"이라는 텍스트를 별도로 표시해(253~256행) 필수/선택 구분이 색상 하나에만 의존하지 않는다. 결과 영역 전체가 `aria-live="polite"`(324행)로 감싸여 있어 계산 완료 시 스크린리더에 안내된다. 색상 대비 자체(WCAG AA 수치)는 코드만으로 확정할 수 없어 QA 단계 확인이 필요하다.

### 발견된 이슈 (등급별)

**High**
- **[H1] 계산 근거 breakdown(4단계)에 내부 조사 상태 문구("확인 필요", "-로 추정")가 최종 사용자 화면에 그대로 노출되고, 그 내용도 FORMULA.md 2차 재검토 결과와 어긋나 있다.** `src/calculators/severance-pay/ui.tsx` 148~150행:
  ```ts
  legalBasis:
    "고용노동부 행정해석 임금 68207-120(2003.02.24) / 근로기준과-3295로 추정(1994.5.24, 확인 필요)",
  ```
  `tasks/severance-pay/FORMULA.md`(6~8행, 215행)는 이미 이 인용을 "임금근로시간정책팀-3295(2007.11.5)"로 정정했고 `logic.ts`(216~217행) 주석도 정정된 내용을 담고 있으나, 사용자에게 실제로 보이는 `ui.tsx`의 문구만 구버전 그대로 남아 있다. (1) 법정 퇴직금 계산 근거를 보여준다는 이 계산기의 핵심 신뢰 요소에서 사실관계가 최신 문서와 불일치하는 오래된 인용을 보여주고, (2) "확인 필요"/"추정"이라는, 일반 사용자가 맥락을 알 수 없는 내부 작업 상태 표현을 그대로 노출해 계산기 전체의 신뢰도를 해칠 수 있다. Optimizer 단계에서 `ui.tsx`의 해당 legalBasis 문구를 FORMULA.md의 최신 인용("임금근로시간정책팀-3295(2007.11.5)")로 갱신하고, 사용자에게 "확인 필요"/"추정" 같은 내부 상태어를 직접 노출하지 않는 방식(예: 정책 안내 섹션에 "일부 행정해석 출처는 2차 자료로 교차확인했습니다" 정도로 순화)으로 수정할 것을 권고한다.

**Medium**
- **[M1] 지급대상 아님 판정 시 두 요건 중 어느 쪽이 미충족인지 구분해 안내하지 않는다.** `logic.ts`의 `isEligibleForSeverancePay()`(136~144행)가 `boolean`만 반환하고 `SeverancePayIneligibleResult` 타입(types.ts 41~43행)에 사유·근접값 필드가 아예 없어 UI가 구조적으로 원인을 표시할 수 없다(ui.tsx 325~336행). "1년 넘게 일했는데 왜 안 되지?"처럼 사용자가 혼란스러워할 수 있는 지점이며, SPEC.md의 "왜 그 금액인지 이해시킨다"는 목표가 지급대상 판정 실패 케이스에는 적용되지 않았다. UI만으로는 고칠 수 없고 `types.ts`/`logic.ts` 수정이 필요한 사안이라 Optimizer(및 필요 시 Architect) 검토 대상이다.
- **[M2] 금액 입력 필드에 천 단위 구분 콤마가 실시간으로 표시되지 않는다.** `docs/DESIGN_SYSTEM.md` "입력 UX" 절이 "천 단위 구분 표시"를 요구하지만, `wage3m` 등 모든 금액 필드는 순수 `type="text"`(ui.tsx 263~284행)로 입력 중 포맷팅이 전혀 없다. 결과 화면(`formatWon`)은 콤마가 표시되는 것과 대조적이라 입력↔결과 사이 UX 일관성이 떨어진다. 특히 `wage3m`처럼 자릿수가 큰 필수 필드에서 오타(자릿수 실수)를 자각하기 어렵다.
- **[M3] "3개월 임금총액" 입력의 구성 요소(무엇을 합산해야 하는지)와 `bonus12m`과의 경계가 helpText에 구체적으로 안내되지 않는다.** ui.tsx 88~94행, 96~102행. SPEC.md가 v1에서 상세 모드(월별 항목 자동 합산)를 의도적으로 제외한 트레이드오프이므로 근본적 해결(자동 합산 모드 추가)은 v1 범위 밖이지만, 최소한 helpText를 "급여명세서의 세전 지급총액(기본급+제수당 등 통화 지급분) 기준, 이 3개월 안에 받은 상여금은 여기에 포함하고 그 외 기간 상여금만 아래 12개월 상여금란에 입력하세요"처럼 구체화하면 사용자 부담과 이중계산 위험을 줄일 수 있다.

**Low**
- **[L1] 계산 방법 8단계(최종 반올림) legalBasis 문구도 FORMULA.md 2차 재검토 결과를 반영하지 못해 다소 오래됐다.** ui.tsx 168~169행("실무 관행 ... 명문 법령 규정은 확인되지 않음")은 FORMULA.md가 이미 "moel.go.kr 소스코드로 확인됨"으로 격상한 사실(FORMULA.md 108행)을 담지 못한다. H1만큼 "확인 필요" 같은 표현을 직접 쓰진 않아 사용자 혼란은 적지만, 일관성 차원에서 H1과 함께 갱신할 것을 권고한다.
- **[L2] `weeklyScheduledHours` helpText에 15시간 미만이면 지급대상이 아니라는 사전 안내가 없다.** ui.tsx 80~86행. 결과를 제출한 뒤에야 "지급대상 아님"을 알게 되므로, helpText에 기준값을 미리 언급하면 더 친절할 것.

### 판정: **FAIL**

High 등급 이슈(H1)가 1건 존재해 `docs/EVALUATION.md`의 PASS 기준("Critical 0, High 0")을 충족하지 못한다. H1은 `ui.tsx`의 하드코딩된 문구 1곳을 FORMULA.md 최신 인용으로 교체하는 비교적 단순한 수정이므로, Optimizer가 이를 수정한 뒤 Critic 재검증을 받으면 빠르게 해소될 것으로 예상한다. Medium 3건(M1~M3)은 PASS를 막지는 않으나 Optimizer 개선 loop에서 함께 처리할 것을 권고하며, 특히 M1(지급대상 아님 사유 미구분)은 `types.ts`/`logic.ts` 변경이 필요해 Optimizer 단독으로 처리 가능한지, Architect·Formula Analyst 재검토가 필요한지 판단이 필요하다.

### 재검증 (2026-09-02, Optimizer가 1차 지적사항 High 1건·Medium 3건·Low 2건을 전부 수정했다고
보고한 이후)

Optimizer의 "Optimizer 수정 내역"(위 참고)이 주장한 수정 내용을 `src/calculators/severance-pay/ui.tsx`
(및 M1 관련 `types.ts`/`logic.ts`) 원문을 직접 다시 읽어 1차 지적 6건 각각에 대해 재검증했다.
Edit 권한이 없어 코드는 수정하지 않았다.

#### 1. High H1(legalBasis 불확실성 표현·구 인용) — **해소 확인**

`ui.tsx` 150~153행(4단계 legalBasis)을 직접 읽었다:
```ts
legalBasis:
  "고용노동부 행정해석 임금 68207-120(2003.02.24, 상여금) / 임금근로시간정책팀-3295(2007.11.5, 연차수당)",
```
"-로 추정"/"확인 필요" 표현이 완전히 사라졌고, FORMULA.md 2차 재검토가 확정한 최신 인용("임금근로시간정책팀-3295(2007.11.5)")으로 정확히 교체됐다. **해소.**

#### 2. Low L1(8단계 legalBasis도 함께 갱신) — **해소 확인**

`ui.tsx` 171~174행(8단계 legalBasis):
```ts
legalBasis:
  "정부 공식 계산기(고용노동부 moel.go.kr) 소스코드로 확인된 실무 방식(원 단위 사사오입) — 명문 법령 규정은 없음",
```
FORMULA.md가 "moel.go.kr 소스코드로 확인됨"으로 격상한 사실을 반영했고, "실무 관행"/"확인되지 않음" 같은 애매한 구 표현이 사라졌다. **해소.**

#### 3. Medium M1(지급대상 아님 사유 구분) — **해소 확인**

`types.ts` 45~50행에 `SeverancePayIneligibleResult.insufficientServicePeriod`/`insufficientWeeklyHours` 필드가 추가됐음을 직접 확인했다. `logic.ts` 199~209행이 기존 판정 임계값(`MIN_SERVICE_DAYS_FOR_ELIGIBILITY=365`, `MIN_WEEKLY_HOURS_FOR_ELIGIBILITY=15`, 41/44행에서 재확인)을 그대로 재사용해 두 필드를 채운다(판정식 `isEligibleForSeverancePay()` 자체는 무변경). `ui.tsx` 356~363행:
```tsx
<ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
  {result.insufficientServicePeriod && (
    <li>계속근로기간 1년 이상 — 미충족</li>
  )}
  {result.insufficientWeeklyHours && (
    <li>4주 평균 주당 소정근로시간 15시간 이상 — 미충족</li>
  )}
</ul>
```
근속기간만 미충족/근로시간만 미충족/둘 다 미충족을 실제로 구분해 안내한다. 임계값(365일/15시간)이 로직·표시 문구 양쪽에서 일치함을 직접 확인했다. **해소.**

#### 4. Medium M2(실시간 천 단위 콤마) — **기능 구현은 확인, 그 부작용으로 신규 문제 발견**

`ui.tsx` 204~212행 `handleAmountChange`가 `unit === "원"`인 4개 필드(wage3m/bonus12m/annualLeavePay12m/ordinaryDailyWage)에 실제로 연결되어(262행 `isAmount` 판정, 289~291행 `onChange` 분기) 입력마다 `event.target.value.replace(/[^0-9]/g, "")` → `Number(...).toLocaleString("ko-KR")`로 즉시 콤마를 붙인다. 값의 끝에서부터 순서대로 입력하는 가장 흔한 플로우에서는 정상 동작한다. **기능 자체는 해소로 판정**하되, 이 핸들러가 만든 새로운 부작용을 아래 "신규 발견"에서 별도로 지적한다.

#### 5. Medium M3("3개월 임금총액" helpText) — **해소 확인**

`ui.tsx` 90~95행:
> "퇴사일 이전 3개월간 급여명세서에 통화로 지급된 금액의 합계(기본급+제수당 등 세전 지급총액. 일시적으로 지급된 금품·현물 지급은 제외)를 입력해 주세요. 이 3개월 안에 지급된 상여금이 있다면 이 금액에 포함하고, 그 외 기간의 상여금은 아래 '12개월 상여금 총액'에 별도로 입력해 상여금이 이중 계산되지 않도록 해 주세요."

구성 요소(기본급+제수당, 세전, 일시 지급·현물 제외)를 구체화했고, `bonus12m`과의 경계(3개월 이내 상여금은 포함, 그 외는 `bonus12m`)까지 명시했다. `bonus12m` helpText(102~103행)도 "위 3개월 임금총액에 이미 포함한 상여금은 제외하고"로 반대 방향 설명을 갖춰 양방향으로 이중계산 위험을 줄였다. 문장이 다소 길지만(2문장, helpText치고는 정보량이 많음) 일반 사용자가 "무엇을 더해야 하는지/경계가 어디인지"를 판단할 수 있는 수준으로 실질적으로 개선됐다. **해소.**

#### 6. Low L2(weeklyScheduledHours 사전 안내) — **해소 확인**

`ui.tsx` 84~86행: "4주 평균 1주간 소정근로시간. 소수 입력 가능(예: 14.5). 4주 평균 15시간 미만이면 법정 퇴직금 지급대상이 아닙니다."로 제출 전 사전 안내가 추가됐다. **해소.**

### 신규 발견 — 실시간 콤마 포맷팅이 입력 문자열 중간을 편집할 때 커서 위치를 예측 불가능하게 이동시킬 수 있음 (Medium, 신규)

`handleAmountChange`(ui.tsx 204~212행)는 매 입력마다 필드 값 전체를 새로 포맷팅해 `setForm`으로 통째로 교체하지만, `event.target`의 `selectionStart`/`selectionEnd`를 읽거나 재설정하는 코드가 전혀 없다(해당 함수 전체를 읽어 확인 — `useRef`나 `setSelectionRange` 호출 없음). React 컨트롤드 인풋에서 값을 프로그래밍적으로 교체하면 브라우저는 커서를 "같은 글자(콤마 포함)를 기준으로" 유지하는 것이 아니라 "같은 문자 오프셋(인덱스)"으로 유지하려 한다. 그런데 콤마는 세 자리마다 삽입되므로, 문자열 앞쪽에서 숫자를 추가·삭제하면 그 뒤에 있는 모든 콤마의 위치(및 개수)가 통째로 바뀐다 — 그 결과 오프셋 기준 커서 복원은 편집 지점 이후의 글자들과 더 이상 대응되지 않는다.

구체적 시나리오(코드 추적으로 재구성한 논리적 추론 — 이 세션에는 브라우저가 없어 실제 렌더링 확인은 불가능했으므로 PLAUSIBLE로 표시한다):
- `wage3m`에 `"200,000"`이 입력돼 있고, 사용자가 앞자리 오타를 고치려 `"2"` 바로 뒤(콤마 앞)에 커서를 두고 `"9"`를 입력한다.
- 브라우저가 만드는 중간 raw value는 `"2009,000"`이고, 이 시점 커서는 방금 입력한 "9" 바로 뒤(오프셋 2).
- `handleAmountChange`가 이를 `digitsOnly="2009000"` → `formatted="2,009,000"`으로 재포맷해 `setForm`한다.
- React가 input의 `value`를 `"2,009,000"`으로 교체하면, 별도 지시가 없는 한 브라우저는 커서를 "같은 오프셋(2)"에 두려 한다 — 즉 사용자가 방금 타이핑한 지점(`"9"` 뒤)이 아니라 `"2,"` 바로 뒤 근처의 다른 위치로 커서가 튄다.
- 자릿수가 3의 배수 경계를 넘나들며 콤마 개수 자체가 바뀔 때 어긋남이 가장 커지며, `wage3m`처럼 자릿수가 큰(보통 7~8자리) 필수 금액 필드에서 오타를 고치려 문자열 중간을 클릭해 수정하는 흔한 상호작용마다 재현될 수 있다.

계산 결과 자체에는 영향이 없다(`validation.ts`가 콤마를 제거하고 파싱하므로 최종 숫자값은 항상 정확 — Calculation Auditor 3차 감사가 이미 이 경로를 별도로 확인했다). 그러나 이는 M2가 원래 해결하려던 문제("큰 금액 자릿수 확인의 어려움")를 부분적으로 다시 악화시킬 수 있는 순수 UX 회귀다 — 커서가 예상과 다른 곳으로 튀면 사용자가 큰 금액을 정확히 수정하기 어려워지고, 특히 이 계산기가 타깃으로 하는 "계산법을 몰라도 쓸 수 있는 일반 사용자"에게는 더 큰 혼란 요인이 될 수 있다.

**등급: Medium.** 데이터 정확성에는 영향이 없어 Critical/High는 아니지만, 값 끝에서부터 순서대로 입력하는 가장 흔한 플로우 밖에서(중간 수정) 재현되는 문제이고 그 상호작용 자체가 드물지 않아 Low보다는 Medium으로 분류한다. 수정 방향 제안: input DOM 노드를 `useRef`로 잡고, 재포맷 전후 "커서 앞쪽 구간에 있던 숫자(콤마 제외)의 개수"를 세어 재포맷된 문자열에서 그 개수만큼 숫자를 지난 위치로 `setSelectionRange`를 호출해 커서를 명시적으로 복원할 것을 권고한다(다음 Optimizer 라운드 또는 QA 단계의 실제 브라우저 확인과 함께 처리 권장).

### 재검증 종합

| 1차 # | 등급 | 재검증 결과 |
|---|---|---|
| H1 (legalBasis 불확실성 표현) | High | **해소** |
| M1 (지급대상 아님 사유 구분) | Medium | **해소** |
| M2 (실시간 천 단위 콤마) | Medium | **해소**(기능 구현 확인) — 단, 그 구현의 부작용으로 신규 Medium 이슈 발견(아래) |
| M3 (3개월 임금총액 helpText) | Medium | **해소** |
| L1 (8단계 legalBasis) | Low | **해소** |
| L2 (주당 소정근로시간 사전 안내) | Low | **해소** |

**신규 발견**: Medium 1건 — 실시간 콤마 포맷팅이 입력 문자열 중간 편집 시 커서 위치를 잘못 이동시킬 수 있음(계산 결과에는 영향 없음, PLAUSIBLE — 코드 추론 기반이며 실제 브라우저 확인은 QA 영역).

**Critical 0, High 0, Medium 1(신규, 비차단), Low 0(신규).** 1차 지적 6건은 전부 실제로 해소됐다.

### 재검증 판정: **PASS**

`docs/EVALUATION.md` PASS 기준(Critical 0, High 0)을 충족한다. 1차 지적 6건(High 1, Medium 3, Low 2)이 모두 코드 수준에서 실제로 해소됐음을 원문 대조로 확인했다. 신규 Medium 1건(콤마 포맷팅 커서 이동)은 PASS를 막지 않으나, 다음 Optimizer 라운드 또는 QA의 실제 브라우저 테스트에서 커서 위치 보정 로직 추가를 권고한다.

---

### v2 평가 (2026-09-02, Calculation Auditor v2 재검증 PASS 이후. 사용자 피드백 5가지 — 주당
소정근로시간 선택입력, 사용안내/소개/FAQ 추가, 카드 디자인, 문구 톤 변경 — 반영 여부를 이번
라운드 변경사항에 특화된 질문으로 평가했다. `tasks/severance-pay/SPEC.md`(v2)/`FORMULA.md`,
`docs/DESIGN_SYSTEM.md`, `src/calculators/severance-pay/{ui.tsx,validation.ts}`,
`components/calculator/{SectionCard,UsageGuide,IntroSection,FaqAccordion}.tsx`를 직접 읽고 코드
근거로만 평가했다. Edit 권한이 없어 코드는 수정하지 않았다.)

#### 자체 평가 질문 (최소 10개, 이번 v2 변경사항 특화)

1. 주당 소정근로시간이 정말 선택 입력으로 바뀌었고, 기본 가정("정규 근로자로 가정")이 사용자에게 명확히 전달되는가? 체크박스 문구가 이해하기 쉬운가?
2. 안내 텍스트 블록 사이 여백/구분이 실제로 개선됐는가(SectionCard 사용 여부, 텍스트가 여전히 따닥따닥 붙어있는 부분은 없는가)?
3. 소개(IntroSection)·사용안내(UsageGuide)·FAQ가 실제로 화면 순서(소개→사용안내→입력→결과→계산근거→정책→FAQ)대로 렌더링되는가?
4. 결과 화면 문구가 실제로 확정적 어투("계산을 진행합니다" 류)로 바뀌었는가, 아니면 여전히 수동태/서비스 대행 느낌이 남아있는가?
5. FAQ 답변이 일반 사용자가 읽기에 이해 가능한가(법령 조항만 나열하고 끝나지 않는가)?
6. 카드/시각적 계층이 실제로 "디자인이 살아있다"는 인상을 주는가, 아니면 여전히 텍스트 뭉치에 카드 테두리만 두른 수준인가?
7. 체크박스("주 15시간 미만")와 그 아래 조건부 숫자 입력의 조합이 사용자를 헷갈리게 하지 않는가(두 입력 경로가 서로 모순되는 상태를 만들 수 있는가)?
8. FAQ 아코디언이 키보드/스크린리더로 조작 가능하고, 펼침 상태가 색상에만 의존하지 않는가?
9. 소개(IntroSection) 문단과 페이지 최상단 헤더 부제가 서로 내용이 겹쳐 같은 말을 두 번 읽게 만들지 않는가?
10. 체크박스 토글로 화면 하단 콘텐츠(숫자 입력 ↔ 경고 문구)가 바뀔 때, 이 변화가 접근성 있게(aria-live 등) 전달되는가?
11. "지급대상 아님" 판정 시, v2에서 새로 생긴 "자진신고"와 "숫자 기준 미달" 두 사유가 여전히 구분되어 안내되는가(v1 PASS 항목의 회귀 여부)?

#### 질문별 답변

1. **그렇다 — 확실히 선택 입력으로 전환됐고, 기본 가정도 반복해서 명시된다.** `validation.ts` 221~227행이 `weeklyScheduledHours`를 `validateRequiredAmount`가 아니라 `validateOptionalAmount`로 검증한다(미입력 시 `undefined`, 오류 아님). `ui.tsx` `FIELDS` 배열(81~132행)에도 이 필드가 더 이상 포함되지 않고, 별도 블록(438~499행)으로 분리됐다. 기본 가정은 세 곳에서 반복 고지된다 — ① 블록 상단 설명("입력하지 않으면 정규 근로자로 가정합니다", 447~451행), ② 숫자 입력 미입력 시 바로 아래 보조 문구("정규 근로자로 가정합니다(4주 평균 주 15시간 이상 근무 가정).", 492~496행), ③ 결과 화면 "적용된 입력값"의 "미입력(정규 근로자로 가정)"(654~658행), ④ 정책 안내 문단(732~737행). 체크박스 문구("저는 4주 평균 주 15시간 미만으로 근무합니다.", 461행)는 1인칭 평서문으로 판정 기준 수치(15시간)까지 포함해 명확하다.
2. **그렇다 — SectionCard가 실제로 도입됐고 여백도 체계적이다.** `IntroSection`/`UsageGuide`/`FaqAccordion`이 모두 공통 `SectionCard`(`components/calculator/SectionCard.tsx`)를 감싸 쓰고(각 파일에서 확인), 결과 화면의 "계산 상세"/"적용된 입력값"/"계산 방법" 세 블록도 `SectionCard`로 교체됐다(`ui.tsx` 578, 640, 699행, 각각 아이콘 📊/📝/🧮 부여). 페이지 최상위 컨테이너가 `space-y-8`(405행)로 주요 섹션 사이 2rem 간격을 확보하고, FAQ 답변은 `item.answer` 배열을 문단별로 나눠 `space-y-2`로 렌더링하며(FaqAccordion.tsx 86~91행), 정책 안내도 문단마다 별도 `<p>`+`space-y-2`(720행)로 분리돼 있다. 확인한 범위에서 텍스트가 "따닥따닥 붙은" 곳은 발견하지 못했다 — 단, 소개(IntroSection) 카드 내부는 문단 하나뿐이라 그 자체의 시각적 계층은 부족하다(아래 6번 참고).
3. **그렇다 — JSX 순서가 요구 순서와 정확히 일치한다.** `ui.tsx`를 위에서 아래로 읽으면 `<IntroSection>`(417행) → `<UsageGuide>`(423행) → `<form>`(입력, 429행) → 결과 `<div aria-live>`(530행, 핵심 결과+계산 근거 SectionCard 3개) → 정책 안내 `<section>`(720행) → `<FaqAccordion>`(745행) 순서다. 파일 상단 주석(6~12행)도 이 순서를 명시적으로 문서화하고 있어 코드와 주석이 일치한다.
4. **그렇다 — 핵심 결과 문구가 확정적 어투로 바뀌었다.** 지급대상인 경우 "예상 퇴직금" 아래 "입력하신 조건으로 아래와 같이 계산을 진행합니다."(571~573행), 계산 방법 1단계 설명도 "…요건을 충족해 계산을 진행합니다."(216행)로 SPEC.md가 예시로 든 "계산을 진행합니다" 패턴을 그대로 쓴다. 지급대상이 아닌 경우도 "…요건을 충족하지 않아 계산을 진행하지 않습니다."(536~538행)로 대칭적으로 확정적이다. "계산이 진행되었습니다"류의 수동태·서비스 대행 어투는 결과 화면 전체에서 발견하지 못했다.
5. **그렇다.** `FAQ_ITEMS`(164~200행) 5개 항목 모두 먼저 일반 사용자가 이해할 수 있는 설명 문단(예: 1번 문항은 "계속근로기간이 1년 미만이면 법정 퇴직금을 받을 법적 권리가 발생하지 않습니다"로 결론부터 평이하게 서술)을 두고, 그 뒤에 별도 문단으로 "근거: 000법 제0조"를 덧붙이는 구조를 5개 항목 모두 일관되게 따른다. 조항 번호만 나열하고 끝나는 답변은 없다. 5번(세금) 문항처럼 답변이 짧은 경우도 "세전 법정 퇴직금만 계산", "범위 밖"이라는 평이한 설명을 담고 있다.
6. **부분적으로만 그렇다 — 카드 대부분은 개선됐지만, 소개(IntroSection) 카드는 여전히 "텍스트 뭉치 + 테두리" 수준에 가깝다.** `SectionCard`를 쓰는 4개 지점 중 UsageGuide(번호 매긴 원형 배지, `UsageGuide.tsx` 44~49행), 계산 근거 3카드(아이콘 📊/📝/🧮), FaqAccordion(펼침/접힘 화살표 애니메이션)은 내부에 실질적인 시각적 계층(아이콘·배지·상호작용)을 갖췄다. 그런데 `ui.tsx`가 `<IntroSection title="퇴직금 계산기란 무엇인가요?" paragraphs={INTRO_PARAGRAPHS} />`(417~420행)만 호출해 `icon` prop을 넘기지 않고, `highlights`(불릿 요약, `IntroSection.tsx`가 지원하는 선택 prop)도 넘기지 않는다 — 그 결과 소개 카드는 제목 하나 + 긴 문단 하나로만 구성된다(`INTRO_PARAGRAPHS`는 길이 1 배열, 135~137행). SPEC.md가 "카드/시각적 계층"을 명문으로 요구한 대상은 "사용 안내"와 "계산 근거" 두 섹션뿐이라 이 지점이 SPEC 위반은 아니지만, 사용자가 페이지에 진입해 가장 먼저 보는 카드가 이번 라운드가 목표로 한 "디자인이 살아있다"는 인상과는 가장 거리가 멀다.
7. **그렇다 — 헷갈릴 만한 모순 상태를 만들지 않는다.** 체크박스가 켜지면(`underFifteenDeclared`) 숫자 입력 자체가 DOM에서 사라지고 경고 문구로 대체된다(`ui.tsx` 464~498행 조건부 렌더링) — 두 입력이 동시에 화면에 보이며 서로 다른 값을 암시하는 상황이 생기지 않는다. 체크박스를 켰다가 다시 끄면 이전에 입력했던 숫자값은 보존된다(코드 주석 293~298행이 이를 의도적 설계로 명시). 판정 우선순위(체크박스 우선, `FORMULA.md` "판정 로직")도 화면에 두 입력이 동시에 노출되지 않는 구조 덕에 실제로 모순을 겪을 여지가 구조적으로 차단된다.
8. **그렇다.** `FaqAccordion.tsx` 63~79행 각 질문이 `<button aria-expanded={isOpen} aria-controls={panelId}>`이고 네이티브 버튼이라 키보드 포커스·Enter/Space 조작이 기본 지원된다. 펼침 상태는 `aria-expanded`(스크린리더용)와 화살표 회전(`rotate-180`, 시각적)을 병행해 색상에만 의존하지 않는다(74~76행). 답변 패널은 `role="region" aria-labelledby={buttonId}`로 질문과 연결된다(83~85행).
9. **부분적으로 겹친다 — 완전한 중복은 아니지만 같은 내용을 연속으로 두 번 읽게 된다.** 페이지 헤더 부제(`ui.tsx` 410~413행: "입사일·퇴사일과 최근 3개월 임금으로 법정 퇴직금 예상액과 산출 근거를 계산합니다.")와 바로 아래 IntroSection 첫 문단(136행: "입사일·퇴사일과 최근 3개월간 지급된 임금총액만 입력하면 법정 퇴직금(일시금) 예상액을 계산해 줍니다…")이 문장 구조와 핵심 정보("입사일·퇴사일 + 3개월 임금 → 퇴직금 예상액")를 거의 그대로 반복한다. 두 텍스트가 화면상 몇 줄 간격으로 붙어 있어(header 바로 다음이 IntroSection), 사용자가 페이지 진입 직후 유사한 문장을 두 번 연속으로 읽게 된다.
10. **아니오 — 이 전환은 접근성 있게 전달되지 않는다.** 결과 영역만 `aria-live="polite"`로 감싸여 있고(530행), 체크박스가 있는 입력 블록(438~499행)에는 `aria-live`가 전혀 없다. 체크박스 토글에 따라 숫자 입력 필드가 사라지고 경고 박스가 나타나는 것(또는 그 반대)은 순수 조건부 렌더링일 뿐 스크린리더에 이 변화를 알리는 장치가 없다. 다만 이 변화는 스크린리더 사용자 자신이 방금 클릭한 체크박스 바로 다음에 일어나므로(포커스가 이미 그 근처에 있을 가능성이 높음), 결과 갱신처럼 화면 다른 곳에서 일어나는 변화보다 실질적 영향은 제한적이다.
11. **그렇다 — v1에서 해소됐던 M1 개선이 v2에서도 유지된다(회귀 없음).** `ui.tsx` 540~554행이 `result.insufficientServicePeriod`/`insufficientWeeklyHours`로 여전히 사유를 구분해 `<li>`로 나열하고, v2에서 새로 추가된 `weeklyHoursIneligibleReason`(`"declared"` vs `"belowThreshold"`)에 따라 "(자진신고하신 내용에 따라 판정)" 또는 "(입력하신 주당 소정근로시간 기준)"이라는 부가 설명까지 덧붙인다(546~552행). v1 PASS 시점보다 오히려 사유 구분이 더 세분화됐다.

#### 발견된 이슈 (등급별)

**Critical**: 없음
**High**: 없음

**Medium**
- **[M1] 소개(IntroSection) 카드가 시각적 계층 없이 "제목 + 긴 문단 하나"로만 구성돼, 이번 라운드가 목표로 한 카드 디자인 개선의 인상이 페이지 첫 화면에서부터 약해진다.** `ui.tsx` 417~420행이 `IntroSection`을 호출하며 `icon`도 `highlights`(불릿 요약, `IntroSection.tsx`가 이미 지원하는 선택 prop)도 넘기지 않는다. 같은 라운드에서 개선된 UsageGuide(번호 배지)·계산 근거 카드(아이콘)·FaqAccordion(펼침 상호작용)과 비교하면 소개 카드만 "카드 테두리를 두른 텍스트 뭉치" 수준에 머물러 있다. SPEC.md가 "카드/시각적 계층"을 명문으로 요구한 대상이 "사용 안내"·"계산 근거"뿐이라 SPEC 미준수는 아니지만, 사용자가 가장 먼저 접하는 섹션이라는 점에서 개선 여지가 크다. 수정 제안: `INTRO_PARAGRAPHS`의 마지막 문장("다만 이 계산기가 계산하는 값은 세전 법정 퇴직금이며…")을 `highlights` 불릿 1~2개로 분리하거나, `IntroSection`에 `icon`(예: "📋" 또는 "ℹ️")을 넘기는 정도의 낮은 비용으로 해소 가능하다.

**Low**
- **[L1] 페이지 헤더 부제와 IntroSection 첫 문단이 핵심 정보("입사일·퇴사일 + 3개월 임금 → 퇴직금 예상액 계산")를 거의 동일한 문장으로 반복해, 사용자가 페이지 진입 직후 유사한 내용을 두 번 연속으로 읽는다.** `ui.tsx` 410~413행(헤더 부제)과 136행(IntroSection 첫 문단)을 대조하면 확인된다. 헤더 부제를 더 짧게 줄이거나(예: 계산기 이름만 보완하는 한 줄) IntroSection과 역할을 분담시키는 것을 권고한다.
- **[L2] 체크박스 토글에 따른 조건부 콘텐츠 전환(숫자 입력 ↔ 경고 문구)이 `aria-live` 영역 밖에 있어, 스크린리더 사용자에게 이 변화가 명시적으로 안내되지 않는다.** `ui.tsx` 438~499행 블록에는 `aria-live`가 없다(결과 영역 530행에만 있음). 사용자 자신의 클릭 직후 일어나는 변화라 영향은 제한적이지만, `docs/DESIGN_SYSTEM.md` 접근성 원칙("결과 업데이트 aria-live 검토")의 취지를 이 블록에도 확장 적용할 여지가 있다.

#### v2 판정: **PASS**

Critical 0, High 0 — `docs/EVALUATION.md` PASS 기준을 충족한다. 사용자가 요청한 5가지 피드백은 모두 코드 수준에서 실제로 반영됨을 직접 확인했다: (1) 주당 소정근로시간 선택 입력 전환 — 확인(질문 1), (2) 사용 안내(UsageGuide)·소개(IntroSection)·FAQ(FaqAccordion) 추가와 화면 순서 — 확인(질문 3), (3) 카드 디자인 — 대부분 확인되나 소개 카드 1곳은 미흡(질문 6, Medium M1), (4) 문구 톤 변경 — 확인(질문 4), (5, 암묵적으로 함께 요청된 FAQ 콘텐츠 품질) — 확인(질문 5). Medium 1건(M1, 소개 카드 시각적 계층 부족)과 Low 2건(L1 헤더/소개 중복, L2 체크박스 전환 aria-live 부재)은 PASS를 막지 않으나, 다음 Optimizer 라운드에서 함께 처리할 것을 권고한다. v1에서 PASS했던 지급대상 아님 사유 구분(M1, 구 번호)도 v2에서 회귀 없이 유지됨을 확인했다(질문 11).

## 점수
| 항목 | 배점 | 획득 |
|---|---|---|
| 계산 정확성 | 35 | |
| 예외/경계값 처리 | 15 | |
| UX/사용 편의성 | 15 | |
| 모바일/반응형 | 10 | |
| 접근성 | 5 | |
| 성능/안정성 | 5 | |
| 설명/계산 근거 | 5 | |
| SEO/페이지 완성도 | 5 | |
| 코드 품질/유지보수성 | 5 | |
| **총점** | 100 | |

## 최종 판정
PASS 기준(docs/EVALUATION.md): 총점 92+, 계산정확성 33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0

판정: PASS / FAIL / NEEDS HUMAN REVIEW
개선 Loop 횟수: N/5

## Optimizer 수정 내역
(2026-09-02, UX/UI Critic FAIL(High 1건 + Medium 3건 + Low 2건) + QA PASS(Medium 1건 + Low 1건) 대응.
`.claude/agents/optimizer.md`에 따라 두 보고서에 지적된 문제만 수정했고, 보고서에 없는 새 기능은
추가하지 않았다. FORMULA.md의 계산 공식·반올림 정책 자체는 건드리지 않았다.)

1. **(Critic High H1 / QA Medium — 동일 이슈) 계산 근거(legalBasis) 문구 최신화.**
   `src/calculators/severance-pay/ui.tsx`의 `buildFormulaSteps` 중:
   - 4단계("상여금·연차수당 가산액 계산") legalBasis를 `"고용노동부 행정해석 임금
     68207-120(2003.02.24) / 근로기준과-3295로 추정(1994.5.24, 확인 필요)"`에서
     `"고용노동부 행정해석 임금 68207-120(2003.02.24, 상여금) / 임금근로시간정책팀-3295
     (2007.11.5, 연차수당)"`로 정정했다. FORMULA.md(2026-09-02 재검토본, "기준/출처" 절)가
     확정한 최신 인용을 그대로 반영했고, "-로 추정"/"확인 필요" 같은 내부 조사 상태 표현은
     사용자 화면에서 완전히 제거했다(FORMULA.md 자체도 이 인용을 "부분 확인"으로 남기고
     있으므로, "확인됨"이라고 과장하지 않고 문서번호·날짜만 담담히 인용하는 방식을 택했다 —
     남은 불확실성은 FORMULA.md/logic.ts 주석에만 남아 있다).
   - 8단계("최종 반올림") legalBasis(Critic Low L1과 동일 지점)를 `"실무 관행(원 단위
     반올림/사사오입) — 명문 법령 규정은 확인되지 않음"`에서 `"정부 공식 계산기(고용노동부
     moel.go.kr) 소스코드로 확인된 실무 방식(원 단위 사사오입) — 명문 법령 규정은 없음"`으로
     갱신했다. FORMULA.md가 이 방식을 "moel.go.kr 소스코드로 확인됨"으로 격상한 사실(1차
     출처, 추정이 아님)을 반영하되, 명문 법령 자체는 여전히 없다는 사실도 그대로 유지했다.

2. **(Critic Medium M1) "지급대상 아님" 사유 구분.** 계산 공식(지급요건 판정 자체)은 바꾸지
   않고, 판정 결과를 어떤 요건이 원인인지로 분해해 노출하기만 했다.
   - `types.ts`: `SeverancePayIneligibleResult`에 `insufficientServicePeriod: boolean`,
     `insufficientWeeklyHours: boolean` 두 필드를 추가했다.
   - `logic.ts`: 지급요건 미충족 시 반환하는 객체에 위 두 필드를 채워 넣었다(각각
     `totalServiceDays < 365`, `weeklyScheduledHours < 15`로 판정 — 기존 `isEligibleForSeverancePay`
     판정 로직 자체는 그대로 재사용).
   - `ui.tsx`: "지급대상 아님" 섹션이 이제 미충족된 요건만 `<li>` 목록으로 구체적으로
     안내한다("계속근로기간 1년 이상 — 미충족" / "4주 평균 주당 소정근로시간 15시간 이상 —
     미충족", 둘 다 미충족이면 둘 다 표시). 근거 조문(근로자퇴직급여 보장법 제4조 제1항)
     문구는 그대로 유지했다.
   - `logic.test.ts`: 기존 4개 지급요건 미충족 테스트(예제 4·5, Edge Case 364일/14.9시간)의
     `toEqual({ eligible: false })` 단언을 새 필드까지 포함하도록 갱신하고, 두 요건이
     **동시에** 미충족인 케이스(근속 181일 + 주 10시간)를 검증하는 신규 테스트를 추가했다.

3. **(Critic Medium M2) 금액 입력 필드 실시간 천 단위 콤마 표시.**
   - `ui.tsx`에 `handleAmountChange` 핸들러를 추가해, `unit === "원"`인 필드(wage3m,
     bonus12m, annualLeavePay12m, ordinaryDailyWage)는 입력 중 숫자가 아닌 문자를 제거한 뒤
     `Number(...).toLocaleString("ko-KR")`로 즉시 다시 포맷팅해 "9,200,000"처럼 콤마가 붙은
     상태로 보이게 했다(날짜·소정근로시간 필드는 기존 `handleChange` 그대로 사용).
     `SAMPLE_FORM.wage3m`도 `"9,200,000"`으로 맞춰 일관성을 유지했다.
   - `validation.ts`의 `toOptionalNumber`가 파싱 전에 콤마를 제거하도록 수정해, 화면에 콤마가
     표시되어도 검증·계산 결과(숫자값)에는 아무 영향이 없도록 했다.
   - `validation.test.ts`에 콤마 포함 입력("9,200,000")이 9,200,000으로 올바르게 정규화되는지
     확인하는 테스트를 추가했다.

4. **(Critic Medium M3) "3개월 임금총액" helpText 구체화.** `ui.tsx`의 `wage3m` helpText를
   FORMULA.md 입력값 정의(통화로 지급된 임금, 임시 지급 임금·현물 지급 제외)를 반영해 "급여
   명세서에 통화로 지급된 금액의 합계(기본급+제수당 등 세전 지급총액, 일시 지급 금품·현물
   지급 제외)"로 구체화하고, 이 3개월 안에 받은 상여금은 `wage3m`에 포함하고 그 외 기간
   상여금만 `bonus12m`에 입력하라고 명시해 이중 계산 위험을 줄였다. `bonus12m`의 helpText도
   "위 3개월 임금총액에 이미 포함한 상여금은 제외하고" 문구를 추가해 두 필드의 경계를 양쪽에서
   설명하도록 했다.

5. **(Critic Low L1)** 항목 1에서 8단계 legalBasis를 함께 갱신 완료.

6. **(Critic Low L2)** `weeklyScheduledHours` helpText에 "4주 평균 15시간 미만이면 법정 퇴직금
   지급대상이 아닙니다."라는 사전 안내를 추가했다.

7. **(QA Low) 금액 입력 필드 상한 검증 추가.** `validation.ts`에 `MAX_AMOUNT_WON =
   10_000_000_000`(100억원) 상수를 추가하고 `wage3m`(`validateRequiredAmount`)과
   `bonus12m`/`annualLeavePay12m`/`ordinaryDailyWage`(`validateOptionalAmount`, `max` 옵션
   신규 지원)에 모두 적용했다. 100억원은 실제 발생 가능한 임금 범위를 수십~수백 배 넘으면서도
   안전 정수 범위(2^53)에는 한참 못 미쳐, 이후 전 단위(×100) 스케일링·곱셈을 거쳐도 정밀도가
   붕괴하지 않는 크기라는 근거를 코드 주석에 남겼다(계산 정확성과 무관한 UX/안전장치 문제이므로
   재량으로 결정, FORMULA.md "예외" 절이 이 판단을 Architect/Builder 재량으로 명시). 경계값
   (정확히 100억원 통과, 100억원+1원 차단) 테스트를 `validation.test.ts`에 추가했다.

### 완료 후 검증 결과
- `npm test -- --run`: **44/44 통과**(기존 39개 + 신규 5개: logic.test.ts 지급요건 미충족
  사유 테스트 1개, validation.test.ts 상한/콤마 파싱 테스트 4개). 기존 Golden Test 7개 +
  Edge Case 전부 그대로 통과 — logic.ts의 계산 공식(5~8단계) 자체는 변경하지 않았고, 지급요건
  미충족 시 반환 객체에 필드만 추가했음을 재확인.
- `npx tsc --noEmit`: 에러 0건.
- `npm run build`(Next.js Turbopack): 성공, 정적 페이지 생성 정상.
- `npx eslint .`(`npm run lint`): 에러/경고 0건.

### 재검증 필요 영역
- **Calculation Auditor 재검증: 원칙적으로 불필요하지만 권장.** `logic.ts`의 8단계 계산
  공식(1~8단계 산식, 반올림 정책)은 전혀 건드리지 않았다 — 유일한 로직 변경은 "지급요건
  미충족" 분기에서 이미 계산된 `totalServiceDays`/`weeklyScheduledHours`를 두 개의 boolean
  필드로 노출한 것뿐이며, 금액이 계산되는 `eligible: true` 경로는 한 줄도 바뀌지 않았다. Golden
  Test 7개(FORMULA.md 검증 예제)가 기존 기댓값 그대로 통과하는 것으로 이를 확인했다. 다만
  `types.ts`/`logic.ts` 두 파일이 수정된 것은 사실이므로, `.claude/agents/optimizer.md`의
  "수정 후 Calculation Auditor → Critic → QA 순서로 다시 검증" 절차상 형식적으로는 Calculation
  Auditor 재검증 단계를 거치는 것을 권장한다(실질적 재작업은 거의 필요 없을 것으로 예상).
- **UX/UI Critic 재검증: 완료.** 위 "UX/UI Critic > 재검증" 절 참고 — High 1건·Medium 3건·
  Low 2건 전부 해소를 코드 원문 대조로 확인했고, 판정은 PASS다. 다만 재검증 과정에서 신규
  Medium 1건(콤마 포맷팅 커서 이동)을 발견해 다음 라운드 처리 항목으로 남긴다.
- **QA 재검증: 권장.** Medium 1건(legalBasis, Critic H1과 동일 지점 — 함께 해소됨)과 Low
  1건(금액 상한)을 수정했다. 특히 금액 입력에 실시간 콤마 포맷팅을 새로 추가했으므로, 붙여넣기
  (paste)·모바일 숫자 키패드 등 QA가 이전에 다루지 않았던 입력 경로에서 콤마 포맷팅이 오작동하지
  않는지 실제 브라우저(가능하면 Playwright 설치 후)로 확인할 것을 권장한다(이번 Optimizer
  단계는 코드 정적 확인 + 자동 테스트로만 검증했다). 이번 재검증에서 발견한 신규 Medium(커서
  위치 이동)도 QA의 실제 브라우저 확인 대상에 포함할 것을 권고한다.

## 최종 종합 판정 (2026-09-02)

> 참고: 이 종합 점수는 Calculation Auditor(3차 PASS)·UX/UI Critic(재검증 PASS)·QA(재검증 PASS)
> 세 보고서를 취합해 오케스트레이션 단계에서 계산했다. 현재 역할 체계(.claude/agents/*.md)에는
> 최종 100점 종합을 명시적으로 담당하는 역할이 없다 — 이는 프로세스 설계의 공백으로 남겨두며,
> 향후 계산기가 늘어나면 이 종합 단계를 누가 맡을지 별도로 정할 것을 권고한다.

| 항목 | 배점 | 획득 | 근거 |
|---|---|---|---|
| 계산 정확성 | 35 | 35 | 3차에 걸친 독립 감사, moel.go.kr 실제 소스코드 대조까지 수행, Golden Test 7개 100% 통과 |
| 예외/경계값 처리 | 15 | 14 | 월말 clamp·경계값 전부 검증됨. Low 1건(ordinaryDailyWage 상한 설계 여유) 잔존 |
| UX/사용 편의성 | 15 | 13 | Critic PASS. Medium 1건(콤마 입력 커서 위치, 실브라우저 미검증) 잔존 |
| 모바일/반응형 | 10 | 8 | 코드/마크업 정적 분석으로만 확인(Playwright 미설치로 실기기 미검증) |
| 접근성 | 5 | 5 | label/aria-live 구조 SSR HTML로 확인 |
| 성능/안정성 | 5 | 5 | build/lint/typecheck 전부 클린, 콘솔 에러 0 |
| 설명/계산 근거 | 5 | 5 | 단계별 breakdown + 정정된 법령 라벨 |
| SEO/페이지 완성도 | 5 | 5 | 레지스트리 기반 sitemap/robots/메타데이터 정상 동작 확인(Builder/QA) |
| 코드 품질/유지보수성 | 5 | 5 | logic/validation/formatting/ui 분리, 의사결정 근거 문서화 |
| **총점** | **100** | **95** | |

### PASS 기준 대조 (docs/EVALUATION.md)
- 총점 92점 이상: **95점 — 충족**
- 계산 정확성 33/35 이상: **35/35 — 충족**
- Critical 0: **충족**
- High 0: **충족** (1차 발견 High 1건은 2차에서 해소 확인)
- Golden Test 100% PASS: **충족** (7/7)
- Console Error 0, TypeScript Error 0: **충족**
- Mobile Critical Issue 0: **충족** (단, 코드 정적 분석 기준 — 실기기 검증은 아직 없음, 위 모바일 점수에 반영)

### 최종 판정: **PASS**

남은 비차단 이슈(Medium 2건, Low 3건)는 위 각 섹션 및 `QA.md`에 기록되어 있으며, 후속 라운드에서 처리 권장. 이 판정에 따라 `src/calculators/registry.ts`의 `severance-pay` 항목 status를 `draft`→`published`로 전환한다.

### v2 라운드 (2026-09-02, 사용자 피드백 5건 반영 후)
Product Owner(SPEC v2) → Formula Analyst(기본값 정책·FAQ 근거) → Architect(타입·공용 컴포넌트) → Builder → Calculation Auditor(PASS) → UX/UI Critic(PASS, Medium 1·Low 2) → QA(PASS, Medium 1·Low 1 신규 발견— 공백 입력 오판정 버그 포함) → Optimizer(5건 전부 수정) 순으로 재순환했다. 계산 공식(1~8단계)은 전 라운드에서 한 글자도 변경되지 않았음을 매 단계 재확인했다. 최종 판정 **PASS** 유지. 남은 비차단 이슈는 위 표 + QA.md v2 섹션 참고.

## Optimizer v2 수정 내역

(2026-09-02, v2 라운드에서 Calculation Auditor v2(PASS)·UX/UI Critic v2 평가(PASS, Medium 1건·
Low 2건)·QA v2 재검증(PASS, Medium 1건·Low 1건)이 모두 PASS했으나 새로 발견된 비차단 Medium/Low
이슈 5건에 대응했다. `.claude/agents/optimizer.md`에 따라 두 보고서(QA.md "v2 재검증", EVALUATION.md
"UX/UI Critic > v2 평가")에 지적된 문제만 수정했고, 보고서에 없는 새 기능은 추가하지 않았다.
계산 공식(`logic.ts` 5~8단계)과 `determineWeeklyHoursEligibility`의 3단계 우선순위 분기 구조는
전혀 건드리지 않았다 — 오직 입력 파싱(trim)만 고쳤다.)

1. **(QA v2 Medium, 실질 버그) `weeklyScheduledHours` 공백 입력 trim 처리.**
   `src/calculators/severance-pay/validation.ts`의 `toOptionalNumber()`가 문자열 입력을
   `.trim()` 없이 그대로 `Number()`에 넘겨, 공백만 있는 문자열(`"   "`)이 `NaN`이 아니라
   JS `Number()`의 특이 동작으로 `0`이 되어버리는 결함을 고쳤다. `hireDate`/`retireDate`가 이미
   쓰는 패턴(`raw.hireDate?.trim()`)을 그대로 따라, 문자열이면 먼저 trim하고 빈 문자열이면
   `undefined`를 반환하도록 재작성했다(숫자 타입 입력은 trim 대상이 아니므로 별도 분기). 이
   필드는 `handleAmountChange`(공백을 입력 즉시 걸러냄)가 아니라 `handleChange`를 쓰기 때문에
   공백만 남은 값이 실제 UI 경로로 `validateSeverancePayInput`까지 도달할 수 있었고, 그 결과
   `determineWeeklyHoursEligibility`가 "미입력→충족 간주"가 아니라 "숫자 0 입력→미충족"으로
   오판정했다(오류 메시지 없이 조용히). `validation.ts`의 다른 검증 로직(0/음수/상한/소수 허용
   등)은 전혀 건드리지 않았다.

2. **(QA v2 Low) `weeklyScheduledHours` 보조 안내문 `aria-describedby` 연결.**
   `src/calculators/severance-pay/ui.tsx`의 체크박스 아래 선택적 숫자 입력 블록은 공용
   `renderField()` 경로를 쓰지 않는 별도 코드라 helpText 배선이 빠져 있었다. `weeklyHoursInputId`/
   `weeklyHoursErrorId`/`weeklyHoursHelpId`를 만들고, 입력의 `aria-describedby`가 오류 메시지(뜬
   경우)와 "정규 근로자로 가정합니다..." 보조 문구(미입력 시에만 노출)의 id를 `renderField()`와
   동일한 패턴(존재하는 것만 공백으로 join)으로 연결하도록 했다.

3. **(Critic v2 Medium M1) `IntroSection`에 `highlights` prop 적용.**
   `IntroSection`(`components/calculator/IntroSection.tsx`)이 이미 지원하는 `highlights` prop을
   `ui.tsx`가 넘기지 않아 소개 카드가 "제목 + 긴 문단 하나"로만 렌더링되던 문제를 고쳤다.
   FORMULA.md "소개 문구" 절의 원문 한 문단을 그대로 3개 사실로 나눠(① 입사일·퇴사일+3개월
   임금총액만 입력하면 계산됨, ② 최종 금액뿐 아니라 산출 과정·근거 법령까지 보여줌, ③ 세전
   법정 퇴직금이며 실제 지급액은 다를 수 있음) `INTRO_HIGHLIGHTS` 배열로 만들고
   `<IntroSection highlights={INTRO_HIGHLIGHTS} />`로 넘겼다. 새 사실을 지어내지 않았다 — 기존
   `INTRO_PARAGRAPHS` 한 문단에 있던 문장을 문단(도입부)과 highlights(핵심 포인트)로 재구성한
   것뿐이다. `IntroSection.tsx`/`SectionCard.tsx` 컴포넌트 자체는 수정하지 않았다(이미 `highlights`
   prop을 지원하고 있었으므로 호출부만 고치면 충분했다). Critic이 대안으로 제시한 `icon` prop은
   `IntroSection`이 실제로는 지원하지 않아(SectionCard만 지원, IntroSection은 title만 전달)
   컴포넌트 공개 API를 확장하는 추가 변경이 필요했을 것이므로, 이미 지원되는 `highlights`만
   활용하는 더 보수적인 경로를 택했다.

4. **(Critic v2 Low L1) 헤더 부제와 IntroSection 중복 축소.**
   페이지 헤더 부제("입사일·퇴사일과 최근 3개월 임금으로 법정 퇴직금 예상액과 산출 근거를
   계산합니다.")가 IntroSection 첫 문단과 거의 동일한 문장을 반복하던 것을, 헤더는 "법정 퇴직금
   예상액과 산출 근거를 확인하세요."라는 짧은 한 줄로 줄이고, 입력 항목("입사일·퇴사일과 최근
   3개월간 지급된 임금총액")과 상세 설명은 IntroSection 문단·highlights가 전담하도록 역할을
   나눴다. 정보를 삭제한 것이 아니라 — 동일한 사실이 여전히 IntroSection에 남아 있다 — 중복되던
   서술만 헤더에서 걷어냈다.

5. **(Critic v2 Low L2) 체크박스 조건부 안내에 `aria-live="polite"` 추가.**
   체크박스("주 15시간 미만 근무") 토글에 따라 바뀌는 조건부 블록(체크 시 경고 문구 / 미체크 시
   숫자 입력+보조 안내)이 결과 영역의 `aria-live="polite"`(530행) 밖에 있어 스크린리더가 전환을
   인지하기 어렵다는 지적에 따라, 이 블록 전체를 `<div aria-live="polite">`로 새로 감쌌다. 다른
   접근성 배선(라벨 연결, `role="alert"` 등)은 그대로 유지했다.

### 완료 후 검증 결과
- `npm test -- --run`: **53/53 통과**(기존 51개 + 신규 2개: `validation.test.ts`에
  "weeklyScheduledHours에 공백 문자열만 입력하면 미입력(undefined)으로 처리된다",
  "wage3m 앞뒤 공백은 trim되어 정상적으로 숫자로 정규화된다"). Golden Test 7개 포함 기존 테스트는
  전부 기존 기댓값 그대로 통과 — `logic.ts` 계산 공식과 `determineWeeklyHoursEligibility` 분기
  구조는 한 글자도 바뀌지 않았다(변경은 `validation.ts`의 trim 처리 한 곳과 `ui.tsx`의 UI 레이어
  뿐).
- `npx tsc --noEmit`: 에러 0건.
- `npm run build`(Next.js Turbopack): 성공, 정적 페이지 7/7 생성 정상.
- `npm run lint`: 에러/경고 0건.
- SSR HTML 직접 확인(`npm run build && npm run start` 후 `curl`): `aria-live="polite"` 2개
  (결과 영역 + 체크박스 조건부 블록), `weeklyScheduledHours` input의 `aria-describedby`가 help
  paragraph id와 실제로 매칭됨, IntroSection highlights 문구("최종 금액뿐 아니라...")와 새 헤더
  문구("법정 퇴직금 예상액과 산출 근거를 확인하세요")가 각각 정확히 1회 렌더링됨을 바이트 단위로
  확인했다.

### 재검증 필요 영역
- **Calculation Auditor 재검증: 불필요.** `logic.ts`/`types.ts`는 이번 라운드에서 전혀 수정하지
  않았다 — 유일하게 손댄 검증 로직(`validation.ts` `toOptionalNumber()`)도 계산에 쓰이는 숫자값
  자체(파싱 성공 시 반환값)는 그대로이고, 오직 "공백 문자열을 어떻게 취급할지"(0 vs undefined)만
  바뀌었다. `determineWeeklyHoursEligibility`의 3단계 우선순위 분기 구조도 무변경이다. Golden
  Test 7개가 기존 기댓값 그대로 통과하는 것으로 금액 계산 경로 무변화를 재확인했다. 다만
  `validation.ts`를 건드린 것은 사실이므로, 절차상 형식적 재확인은 권장하되 실질적 재작업은
  필요 없을 것으로 예상한다.
- **UX/UI Critic 재검증: 권장.** M1(highlights 미사용)·L1(헤더/소개 중복)·L2(aria-live 부재) 세
  건 모두 수정했으나, 이번 Optimizer 단계는 코드 정적 확인 + SSR HTML 텍스트 매칭으로만
  검증했다(브라우저 부재로 실제 렌더링 시각적 계층·명도 대비·스크린리더 실동작은 확인 못함).
  특히 highlights 불릿이 실제로 "카드 디자인이 살아있다"는 인상을 주는지는 시각적 판단이
  필요하므로 Critic 재검증을 권장한다.
- **QA 재검증: 권장.** 신규 테스트 2건을 포함해 `npm test`/`tsc`/`build`/`lint` 전부 통과를
  확인했으나, weeklyScheduledHours 필드의 trim 수정이 다른 입력 경로(붙여넣기, 모바일 키패드
  등)에서 의도치 않은 부작용을 만들지 않는지, 그리고 새로 추가된 `aria-live` 블록이 실제
  스크린리더에서 어떻게 낭독되는지는 실제 브라우저(Playwright 설치 시)로 확인할 것을 권장한다.

## Optimizer — 날짜 연도 자릿수 버그 수정 (2026-09-02)

### 배경 — 실사용자 버그 리포트
사용자가 실제 사용 중 입사일/퇴사일 `<input type="date">` 필드에서 버그를 발견했다: 연도
서브필드에 키보드로 직접 숫자를 계속 입력하면 4자리를 넘어서까지 입력이 억제되지 않아
"123411-09-01" 같은 비정상적으로 긴 연도 값이 만들어진다(스크린샷 확인). 이는 Chromium
계열 브라우저에서 `<input type="date">`에 `min`/`max` 속성이 없을 때 나타나는 알려진 네이티브
동작이다 — HTML5 date 값 포맷 자체가 4자리 이상의 연도도 문법적으로 "유효한 날짜 문자열"로
허용하기 때문이다. 계산 공식(`logic.ts` 1~8단계)은 이번 수정 대상이 아니며 전혀 건드리지
않았다.

### 원인 분석
- `src/calculators/severance-pay/ui.tsx`의 입사일/퇴사일 `<input type="date">`에 `min`/`max`
  속성이 전혀 없어, 브라우저가 연도 서브필드의 자릿수를 UI 차원에서 억제하지 못했다.
- `src/calculators/severance-pay/validation.ts`의 기존 정규식(`ISO_DATE_RE`,
  `/^(\d{4})-(\d{2})-(\d{2})$/`)은 연도가 정확히 4자리가 아닌 값(예: 6자리 "123411", 5자리
  "12345")은 형식 불일치로 이미 걸러내고 있었다(`isValidIsoDate` → "형식이 올바르지
  않습니다" 오류). 그러나 **형식은 4자리이지만 값 자체가 비현실적인 연도**(예:
  `0001-01-01`, `9999-12-31`, 또는 브라우저의 다른 네이티브 동작으로 만들어질 수 있는
  4자리이지만 터무니없는 연도)는 형식 검증만으로는 걸러지지 않는 사각지대였다. `min`/`max`
  HTML 속성은 브라우저 UI 힌트일 뿐 실제 제출 값을 보장하지 않으므로(프로그래밍적 조작, 다른
  브라우저의 다른 동작 등 우회 경로 가능), 값 자체를 검증하는 로직이 없다는 것이 근본
  원인이었다.

### 수정 내용
1. **`src/calculators/severance-pay/ui.tsx`**: 입사일·퇴사일 `<input type="date">`에
   `min`/`max` 속성을 추가했다.
   - `min="1970-01-01"`(`validation.ts`의 `MIN_ALLOWED_DATE` 상수): 근로기준법 체계가
     실질적으로 자리 잡은 시기 이후로, 이보다 이른 입사일은 이 계산기의 사용 시나리오(현재
     시점에 법정 퇴직금 예상액을 확인하려는 근로자)에 해당하지 않는다고 재량으로 판단했다.
   - `max`: 오늘로부터 1년 후(`validation.ts`의 `getMaxAllowedDate()` 함수, 매 렌더링 시점
     기준 동적 계산). 퇴사일은 아직 도래하지 않은 예정 퇴사일일 수 있으므로(사직서를 미리
     제출하고 미리 계산해보는 경우 등) 오늘 날짜로 완전히 막지는 않되, 1년을 훌쩍 넘는 먼
     미래 날짜는 비현실적인 오입력(연도 자릿수 버그 포함)으로 보아 차단했다.
   - 정한 값과 근거는 코드 주석으로 남겼다(인라인 주석, `ui.tsx` 해당 `<input>` 위).
2. **`src/calculators/severance-pay/validation.ts`**: `min`/`max` HTML 속성은 브라우저 UI
   힌트일 뿐 실제 값 검증을 보장하지 않는다는 전제 하에, 파싱된 연도 값 자체를 검증하는
   로직을 추가했다.
   - `MIN_ALLOWED_DATE`(`"1970-01-01"`) 상수와 `getMaxAllowedDate()`(오늘+1년) 함수를
     export해 `ui.tsx`와 검증 로직이 동일한 기준을 공유하도록 했다(값 불일치 방지).
   - `hasPlausibleYearDigits()`: 파싱된 연도가 4자리(1000~9999) 범위인지 확인한다.
     `ISO_DATE_RE`가 이미 정확히 4자리만 매치하므로 사실상 항상 참이지만, 형식 검증 로직과
     독립적으로 값 자체를 방어하는 명시적 안전장치로 추가했다.
   - `isDateWithinAllowedRange()`: 파싱된 날짜가 `[MIN_ALLOWED_DATE, getMaxAllowedDate()]`
     범위 안인지 ISO 문자열 비교로 확인한다.
   - `validateSeverancePayInput()`의 hireDate/retireDate 검증 분기에 위 두 검증을
     추가했다 — 형식 검증(`isValidIsoDate`)을 통과했더라도 연도가 비현실적이면
     `"입사일 연도를 확인해주세요."` / `"퇴사일 연도를 확인해주세요."`라는 명확한 오류
     메시지를 반환한다.
3. **기존 "예외" 처리와의 통합**: 필수값 검사 → 형식 검사(`isValidIsoDate`) → **신규: 연도
   자릿수/범위 검사** → 날짜 순서 검사(`retireDate > hireDate`) 순서로 자연스럽게 이어지도록
   기존 `if/else if` 체인에 분기를 추가했을 뿐, 기존 필수값·형식·순서 검증 로직은 전혀
   수정하지 않았다. 여러 오류가 동시에 존재하면 기존과 동일하게 모두 모아 반환하는 동작도
   그대로 유지된다.

### 테스트
`validation.test.ts`에 6개 케이스를 추가했다:
- hireDate 6자리 연도("123411-09-01") → 실패
- retireDate 5자리 연도("12345-09-01") → 실패
- hireDate가 형식은 맞지만(4자리) 허용 하한(1970-01-01)보다 이른 경우("1969-12-31") → 실패,
  메시지 "입사일 연도를 확인해주세요." 확인
- retireDate가 허용 상한(오늘로부터 1년 후)보다 하루라도 늦은 경우 → 실패, 메시지
  "퇴사일 연도를 확인해주세요." 확인
- hireDate가 허용 하한(1970-01-01)과 정확히 같은 경계값 → 통과
- retireDate가 허용 상한(오늘로부터 1년 후)과 정확히 같은 경계값 → 통과

### 완료 후 검증 결과
- `npm test -- --run`: **59/59 통과**(기존 53개 + 신규 6개). Golden Test 7개(`logic.test.ts`)
  포함 기존 테스트는 전부 기존 기댓값 그대로 통과 — `logic.ts` 계산 공식은 한 글자도 바뀌지
  않았다(변경은 `validation.ts`의 날짜 검증 로직과 `ui.tsx`의 `<input>` 속성뿐).
- `npx tsc --noEmit`: 에러 0건.
- `npm run build`(Next.js Turbopack): 성공, 정적 페이지 7/7 생성 정상 —
  `/calculators/severance-pay`가 SSG로 정상 프리렌더링되어, `getMaxAllowedDate()`가 서버
  렌더링 시점에 계산해도 빌드가 깨지지 않음을 확인했다.
- `npm run lint`: 에러/경고 0건.

### 재검증 필요 영역
- **Calculation Auditor 재검증: 불필요.** `logic.ts`/`types.ts`는 이번 라운드에서 전혀
  수정하지 않았다. Golden Test 7개가 기존 기댓값 그대로 통과하는 것으로 금액 계산 경로
  무변화를 재확인했다.
- **UX/UI Critic 재검증: 권장.** 실제 브라우저(Chromium 계열)에서 연도 서브필드에 5~6자리를
  입력하려는 시도가 `min`/`max` 속성으로 실제로 억제되는지, 그리고 `max`가 오늘로부터 1년
  후로 제한되는 것이 실제 사용 시나리오(예정 퇴사일 입력)에서 UX 마찰을 일으키지 않는지는
  실제 브라우저 렌더링 확인이 필요하다(이번 Optimizer 단계는 코드 정적 확인 + 자동 테스트로만
  검증했다).
- **QA 재검증: 권장.** 신규 테스트 6건을 포함해 `npm test`/`tsc`/`build`/`lint` 전부 통과를
  확인했으나, `getMaxAllowedDate()`가 요청 시점(서버)과 렌더링 시점(클라이언트)에 자정 근처
  경계를 걸쳐 계산될 경우 하이드레이션 시점에 `max` 속성 값이 하루 차이로 다르게 계산될
  이론적 가능성이 있다(속성 값이므로 React 하이드레이션 경고 대상이 되지는 않으나, 실제
  브라우저에서 콘솔 경고 유무는 QA가 확인할 것을 권장한다). 극히 드문 자정 경계 케이스이며
  기능적 영향(검증 실패)은 없다 — `validation.ts`의 실제 값 검증은 서버/클라이언트 시각차와
  무관하게 매 제출 시점에 새로 계산되므로 안전하다.
