# EVALUATION: 실업급여(구직급여) 계산기

## Builder 구현 완료

2026-09-02, Builder가 SPEC.md/FORMULA.md를 그대로 구현했다. 아래는 구현 사실 기록이며,
최종 정확성 판정이 아니다 — 최종 판정은 Calculation Auditor·QA의 몫이다(.claude/agents/builder.md).

- `src/calculators/unemployment-benefit/logic.ts`, `validation.ts`, `formatting.ts`,
  `ui.tsx`, `logic.test.ts` 작성 완료.
- FORMULA.md 검증 예제 1~6을 Golden Test로 그대로 옮겼다(18개 테스트 전부 통과 — Golden 6개
  + Edge Case 12개). 각 테스트에 FORMULA.md 원문 라벨("공식 대조 아님" 등)을 그대로 주석으로
  남겼다 — 공식 계산기 대조가 없다는 FORMULA.md의 정직한 한계 고지를 숨기지 않았다.
- 구직급여일액 원 단위 반올림 정책(절사/버림, FORMULA.md "확인 필요" 항목)을
  `roundBenefitDailyAmount()` 함수 하나로 분리했다 — 정책이 바뀌면 이 함수 본문만 고치면 된다.
- 연도별 데이터는 `leaveDate` 연도 기준으로 `rates-2026.json`을 조회하며, 2026년 외 연도는
  조용히 폴백하지 않고 명시적으로 에러를 던진다(logic.ts `getUnemploymentBenefitRatesForYear`
  주석에 근거 기록).
- `npm test`(83/83 통과, severance-pay Golden Test 포함 회귀 없음), `npx tsc --noEmit`,
  `npx eslint`, `npx next build` 모두 통과를 확인했다.
- `src/calculators/registry.ts`의 `unemployment-benefit` status는 `draft`로 유지했다(건드리지
  않음) — Auditor/QA 통과 후 전환 대상.

### 2026-09-02 재구현 — 반올림 정책 갱신 반영(Calculation Auditor Medium "공식 재검토 요청" 해소)

FORMULA.md가 위 Calculation Auditor 2-c의 실증 근거(work24.go.kr 라이브 서버, `ave_sal=112001`
케이스)를 반영해 "정밀도/반올림 정책"을 갱신함에 따라(구직급여일액을 clamp 후 절사하지 않고
완전정밀도로 유지해 총액 계산까지 그대로 사용, 예제 7 신규 추가), 아래와 같이 재구현했다:
- `logic.ts`의 `roundBenefitDailyAmount()`(clamp 직후 절사하던 함수)를 완전히 제거했다. 계산
  경로의 `benefitDailyAmount`는 이제 clamp까지만 적용한 완전정밀도 값이며, 그 값을 그대로
  `totalExpectedBenefit` 곱셈에 사용한다. 최종 원 단위 절사는 곱셈 이후 단 한 번, 새로 분리한
  `finalizeTotalBenefit(benefitDailyAmount, prescribedBenefitDays)` 함수 안에서만 적용한다(정책이
  다시 바뀌면 이 함수 본문 한 곳만 고치면 되도록 설계 — FORMULA.md가 명시적으로 요구한 이름 있는
  함수 분리 요건).
- 이 과정에서 부동소수점 버그를 하나 발견해 함께 고쳤다: `67200.6 × 240`을 JS로 그대로 계산하면
  `16128143.999999998`처럼 정수보다 살짝 낮은 값이 나와, 보정 없는 `Math.floor`는 정답(16,128,144)보다
  1원 낮게 절사해 버린다. severance-pay/formatting.ts의 EPSILON 보정 패턴과 동일한 방식으로
  `finalizeTotalBenefit`에 `1e-6` 보정값을 더한 뒤 절사하도록 수정했다.
- `formatting.ts`에 표시 전용 절사 포맷터 `formatBenefitDailyAmountDisplay()`를 새로 추가했다.
  "1일 구직급여일액"을 화면에 보여줄 때만 쓰며, 이 절사값을 계산에 재사용하지 않는다는 것을
  주석으로 명시했다(severance-pay의 "표시용 반올림 vs 계산용 완전정밀도 분리"와 반대 방향의 결정임을
  함께 기록 — 두 계산기의 실제 라이브 서버 동작이 서로 다르다는 것이 각각 확인됐기 때문). `ui.tsx`도
  "1일 구직급여일액" 표시 2곳(핵심 결과 요약, 계산 상세 dd)을 이 함수로 교체하고, "계산 근거" 6·9번
  단계 설명 문구를 완전정밀도 유지 정책에 맞게 갱신했다(구 문구 "clamp 후 원 단위 절사"는 더 이상
  사실과 맞지 않으므로 제거).
- `logic.test.ts`: FORMULA.md 예제 7(`wage3m=10,304,092원` → `totalExpectedBenefit=16,128,144원`)을
  Golden Test로 추가했다. 기존 예제 1~6은 원문 그대로 두고 재실행해 기대값이 정책 변경 후에도
  동일하게 나오는지 확인했다(예제 1~6은 모두 clamp 적중 또는 나누어떨어지는 라운드넘버로 설계돼
  구 정책·신 정책이 우연히 같은 값을 냈다). `roundBenefitDailyAmount` 관련 Edge Case 테스트는
  `finalizeTotalBenefit`(부동소수점 보정 포함)과 `formatBenefitDailyAmountDisplay`(표시 전용,
  계산에 미영향) 테스트로 교체했다.
- `npm test`(85/85 통과, severance-pay 포함 회귀 없음), `npx tsc --noEmit`, `npx eslint`,
  `npm run build`(next build) 모두 통과 확인.

## Calculation Auditor

Builder를 신뢰하지 않고 코드를 직접 읽고, Golden Test 6개를 Node로 독립 재계산했으며, Bash(curl, 쿠키
세션 유지)로 work24.go.kr(고용24) 실제 운영 중인 공식 모의계산기를 다단계로 직접 호출해 계산 결과를
대조했다. 아래는 그 결과다.

### 1. 구현 ↔ FORMULA.md 일치 여부 — 일치 확인

`logic.ts`/`validation.ts`/`formatting.ts`를 FORMULA.md "공식" 1~11단계, "소정급여일수 표",
"정밀도/반올림 정책"과 한 줄씩 대조했다.

- 1~11단계 전부 FORMULA.md 순서·수식 그대로 구현됨(`calculateUnemploymentBenefit`). 공식을 임의로
  바꾼 흔적 없음.
- `baseDays` 계산은 `src/lib/date-calc.ts`(`calculateCalendarPeriodDaysBefore`)를 그대로 재사용 —
  FORMULA.md가 명시적으로 요구한 재사용 규칙을 따랐다. 월말 clamp 로직도 severance-pay와 동일.
- 소정급여일수 표 5구간 경계(`determineInsuredPeriodBand`, `insuredPeriodDays >= minDays &&
  < maxDays`, 365일=1년 고정 환산)는 FORMULA.md "정밀도/반올림 정책 > '1년' 경계" 항목이 위임한
  대로 일관된 단순화(365일 고정)를 택했고, 그 근거를 주석에 남겼다.
- 연령 구간(`determineAgeBand`, `isDisabled OR age>=50`)은 FORMULA.md 7단계와 정확히 일치.
- `roundBenefitDailyAmount`(절사/`Math.floor`)는 FORMULA.md가 "확인 필요"로 남기며 권고한 잠정
  정책(절사)을 그대로 구현했고, 상수 함수로 분리해 정책 변경에 대비했다는 Builder의 주장도 코드로
  확인된다.
- **Golden Test 6개를 Node로 독립 재계산**(사칙연산을 직접 실행, 테스트 통과 여부에 의존하지 않음).
  baseDays(92), averageDailyWage, baseBenefitDailyAmount, clamp 결과, totalExpectedBenefit 전부
  FORMULA.md 예제 1~6의 Expected 값과 완전히 일치했다(아래 "재계산 결과" 참고). rates-2026.json의
  `minBenefitDailyAmount`(66,048=10,320×8×0.8)·`maxBenefitDailyAmount`(68,100=113,500×0.6)도
  Node로 재계산해 파일에 적힌 값과 정확히 일치함을 확인했다.
- `npm test` 83/83 통과(severance-pay Golden/Edge/UI 테스트 포함 — 회귀 없음), `npx tsc --noEmit`
  클린, `npm run build`(next build) 성공. `src/calculators/severance-pay/logic.ts`가
  `date-calc.ts`의 `calculateCalendarPeriodDaysBefore`/`diffDaysUtc`/`parseIsoDateUtc`를 그대로
  alias해서 쓰는 것도 확인 — 추출 리팩터링이 동작을 바꾸지 않았다.
- `registry.ts`의 `unemployment-benefit` status는 `draft`로 유지되어 있어(sitemap/홈에서 자동
  제외) Builder 완료 보고와 일치.

**구현 결함 없음.**

### 2. FORMULA.md ↔ 실제 근거 일치 여부

#### 2-a. 공식 계산기(work24.go.kr) 대조 — **확보 성공** (가장 중요한 성과)

FORMULA.md는 work24.go.kr이 다단계 서버사이드 폼이라 재현에 실패했다고 밝혔다. 이번 검증에서는
`curl -c cookies.txt -b cookies.txt`로 세션 쿠키(HPSESSIONID)를 유지하며 실제 사용자 흐름을 그대로
재현했다:
1. `GET /cm/c/f/1200/selecSimulateCalc.do` — 세션 쿠키 발급.
2. `POST /cm/c/f/1100/selecSimulatePost.do` (실업급여 카드 클릭 시 JS `fn_goCalcInfo('01')`가 설정하는
   hidden 필드 `upprSystClId=SC00000253`, `systClId=SC00000254`, `systId=SI00000411`,
   `systCnntId=CI00002358`를 그대로 전달) — 실제 계산 폼(상용직/일용직/자영업/예술인/노무제공자 탭)이
   담긴 HTML을 받음.
3. 그 폼의 "상용직(mode=1) 간편모의계산" 탭이 AJAX로 호출하는 실제 계산 엔드포인트
   `POST /cm/c/f/1100/retrieveNewMainCalcAjax.do`(파라미터: `old`=만나이, `dspsnAt`=장애인여부(Y/N),
   `prd`=근로기간(개월), `ave_sal`=1일 평균임금(클라이언트가 월급여÷30을 미리 계산해 보냄),
   `appontWorkHr`=1일 소정근로시간, `mode=1`)을 같은 쿠키로 직접 호출.
   CSRF 토큰은 불필요했다(`hp_common.js`의 `ComLib.ajaxReq`가 CSRF 헤더를 붙이지 않는 순수
   `x-www-form-urlencoded` POST임을 소스에서 확인).

**결과: 살아있는 공식 계산기 응답을 받는 데 성공했다.** FORMULA.md 검증 예제 1·2·5·6(예제 3은 이미
FORMULA.md 자체가 "라운드넘버 케이스"로 설계했던 것을 그대로 사용)에 대응하는 입력을 넣어 아래처럼
정확히 일치하는 결과를 확인했다(모두 2026-09-02 확인):

| 예제 | 입력(old/dspsnAt/prd/ave_sal) | work24 응답(day/tot) | FORMULA.md Expected | 일치 |
|---|---|---|---|---|
| 예제1(상한) | 55/N/120개월/326086 | 270 / 18,387,000 | 270일, 18,387,000원 | ✅ |
| 예제2(하한) | 45/N/48개월/97826 | 180 / 11,888,640 | 180일, 11,888,640원 | ✅ |
| 예제3(중간) | 52/N/72개월/112000 | 240 / 16,128,000 | 240일, 16,128,000원 | ✅ |
| 예제5(경계180일≈6개월) | 30/N/6개월/65217 | 120 / 7,925,760 | 120일, 7,925,760원 | ✅ |
| 예제6(연령경계50세) | 50/N/24개월/112000 | 180 / 12,096,000 | 180일, 12,096,000원 | ✅ |

추가로 소정급여일수 표의 **모든 연도 경계(12/36/60/120개월)를 실제 서버 응답으로 직접 스캔**해
`rates-2026.json`의 5개 구간·양쪽 연령열과 전부 일치함을 확인했다(11개월→120일, 12개월→150일,
35개월→150일, 36개월→180일, 59개월→180일, 60개월→210일, 119개월→210일, 120개월→240일 — 모두 ">="
경계 포함 방식과 일치). 장애인 플래그(`dspsnAt=Y`, 25세)도 50세 이상 열과 동일하게 처리됨을 확인했다
(day=180, under50이었다면 150이었을 값).

이로써 **docs/CALCULATOR_RULES.md의 "공식 계산기 예시값과 대조한 케이스 최소 2개" 요건을 5개 케이스
+ 8개 경계값 스캔으로 초과 충족**했다. FORMULA.md "여전히 남아있는 확인 필요 항목" 1번(공식 계산기
대조 미확보)은 **해소됨**으로 갱신할 것을 Formula Analyst에게 요청한다.

(한계 고지: 이 엔드포인트는 "간편모의계산·상용직" 탭으로, 실제 이직일 대신 "근로기간(개월)"을,
"3개월 임금총액÷실제 달력일수" 대신 "월평균임금÷30"을 입력받는 **단순화된 추정 도구**다 —
FORMULA.md/이 계산기가 채택한 "정확한 법정 평균임금 산정식"과 입력 모델 자체는 다르다. 따라서 이
대조는 **①0.6 배율 ②상한 68,100원 ③하한 66,048원 ④소정급여일수 표 전체 ⑤연령 50세 경계
⑥장애인 처리 ⑦아래 2-c의 반올림 순서**를 확정적으로 검증하지만, "3개월 임금총액÷baseDays" 그 자체의
정확성까지 확인해주지는 않는다 — 다만 이 부분은 근로기준법 제2조제1항제6호를 그대로 따르는 산식이라
법 해석의 여지가 거의 없다.)

#### 2-b. 소정급여일수 표 3중 교차확인 — **완료(work24.go.kr 실거래 계산 결과로 대체 충족)**

위 2-a에서 서술한 대로, 표의 5개 구간 전부·양쪽 연령열·모든 경계(12/36/60/120개월)를 **텍스트 사본이
아니라 실제 운영 중인 계산 서버의 응답값**으로 확인했다. 이는 "3번째 텍스트 출처"보다 근거 등급이
높다(law.go.kr 스니펫, eiac.ei.go.kr 표 사본에 이은 세 번째 출처이면서, 유일하게 "정적 텍스트"가
아니라 "살아있는 계산 결과"다). 표 자체의 오류 가능성은 사실상 배제됐다고 판단한다.

#### 2-c. 구직급여일액 반올림 방식 — **새로운 단서 확보, FORMULA.md와 상충 → 공식 재검토 요청**

FORMULA.md가 "확인 필요"로 남긴 항목이다. work24.go.kr 라이브 서버를 상대로 반올림 지점을 특정하기
위한 대조 실험을 설계했다:
- `ave_sal=112001`(×0.6=67,200.6, 소수 있음), `old=52`, `prd=72`(day=240 구간) → 서버 응답
  `tot=16,128,144`.
  - 만약 서버가 1일액을 먼저 절사(67,200)한 뒤 240을 곱했다면 `16,128,000`이어야 한다.
  - 실제 응답은 `67,200.6 × 240 = 16,128,144`와 정확히 일치 — **절사(또는 어떤 반올림도) 없이
    완전정밀도 값을 그대로 최종 곱셈까지 이어간다**는 뜻이다.
  - 같은 `ave_sal`에 `prd=61`(day=210 구간)으로 다시 확인: 응답 `14,112,126` =
    `67,200.6 × 210`과 정확히 일치(절사 시 `14,112,000`이어야 함). 두 케이스 모두 "절사 후 곱셈"
    가설을 반증한다.

**결론**: 라이브 공식(간편모의계산) 서버는 **1일 구직급여일액을 원 단위로 확정한 뒤 소정급여일수를
곱하지 않는다** — 완전정밀도 값을 총액 계산까지 그대로 사용한다. 이는 FORMULA.md가 잠정 채택한
"clamp 후 절사, 그 절사값으로 총액 계산"(Builder가 `roundBenefitDailyAmount`로 정확히 구현한 정책)과
**상충한다.**

- Builder는 FORMULA.md를 정확히 그대로 구현했으므로 **Builder 결함이 아니다.**
- 이는 **FORMULA.md "정밀도/반올림 정책" 항목의 오류(또는 최소한 미해결 상태의 새 근거) → Formula
  Analyst에게 "공식 재검토 요청"**으로 반려한다. 권고안: "총 예상 지급액은
  `averageDailyWage × 0.6`을 clamp까지만 적용한 완전정밀도 값에 `prescribedBenefitDays`를 곱해
  산출하고, 최종 표시 단계에서만 원 단위로 정리한다(1일액 표시용 반올림과 총액 계산용 값을
  분리한다)."
- **영향 범위·심각도**: 이 오차는 `averageDailyWage × 0.6`이 상한(68,100)·하한(66,048) 사이에 있고
  (즉 `averageDailyWage`가 대략 110,080~113,500원/일 구간 — 상당히 좁은 구간) 정수로 딱 떨어지지
  않을 때만 발생한다. 발생 시 오차 크기는 최대 약 269원(소정급여일수 최대 270일 × 1원 미만) 수준으로
  **금액 자체는 미미**하지만, 발생하면 항상 "실제보다 총액을 낮게" 보여준다는 점에서 **재현 가능한
  체계적 편향**이다. **등급: Medium** — 실사용자 영향 폭이 좁고 금액도 작지만, 방금 확보한 반박
  증거로 인해 FORMULA.md의 명시적 정책과 라이브 공식 계산기 동작이 서로 다르다는 사실 자체는
  명확하므로 Low보다는 높게 본다. Formula Analyst 재검토 전까지는 배포를 막을 정도는 아니라고
  판단한다(간편모의계산이라는 도구 자체가 "추정치"임을 자인하고 있어 100% legal-grade 근거로 보기도
  어렵기 때문 — 아래 한계 고지 참고).

#### 2-d. 2026년 상한액·하한액 1차 정부 출처 — **상한액 격상 성공, 하한액은 간접 확인 유지**

- **상한액(68,100원)**: `korea.kr`(대한민국 정책브리핑 — 대한민국 정부가 직접 운영하는 공식
  정책뉴스 포털, `newsId=148956574`)에서 "구직급여 상한액도 하루 6만 6000원에서 6만 8100원으로
  오른다"는 문구를 WebFetch로 직접 확인했다. 이는 기존 FORMULA.md가 인용한 민간 언론사 기사보다
  근거 등급이 높은 **1차에 준하는 정부 출처**다. 아울러 `easylaw.go.kr`(법제처 운영, "찾기쉬운
  생활법령정보")에서 "기초일액 상한인 11만3500원의 100분의 60을 곱한 금액"이라는 산식 문구까지
  확인했다 — `baseWageDailyCap × benefitRate = 113,500 × 0.6 = 68,100`이라는 rates-2026.json의
  `note` 필드 산식과 정확히 일치.
- **하한액(66,048원)**: 위 두 출처 모두 정확한 "66,048원"이라는 숫자 자체는 명시하지 않았지만(대신
  "최저기초일액 = 1일 소정근로시간 × 최저임금", "최저구직급여일액 = 기초일액 × 80%"라는 산식은
  easylaw.go.kr에서 확인), `10,320 × 8 × 0.8 = 66,048`은 이미 산술적으로 정확히 재현되고, 이번
  검증에서 **work24.go.kr 라이브 계산 서버가 실제로 66,048원을 하한으로 적용하는 것**까지
  확인했다(2-a의 예제2·5). 관보(gwanbo.go.kr) 원문 열람은 이번에도 실패했다(접근 제한) — 이 항목만
  "부분 확인" 상태로 유지하되, 신뢰도는 이전보다 명백히 높아졌다(법 조문 인용 출처 + 산술 재현 +
  라이브 시스템 실동작 3중 확인).

### 3. 경계값 재확인

- `insuredPeriodDays=180`(정확히 요건 충족): Golden 예제 5, Edge Case 테스트(`179일`→미충족,
  `180일`→충족) 모두 확인. 코드는 `input.insuredPeriodDays < requiredDays`(180)로 판정 — `>=`
  포함 조건이 정확히 구현됨.
- 연령 정확히 50세: Golden 예제 6, Edge Case(`determineAgeBand(49,false)`→"50세 미만") 확인.
  `age >= 50` 포함 조건 정확.
- 상한/하한 clamp 경계: FORMULA.md "구직급여일액이 상한·하한 사이에 정확히 걸치는 경계값" 절이 예측한
  대로 `Math.min(Math.max(x,lo),hi)`는 `x==lo`/`x==hi`에서 항등적으로 안전함을 코드로 확인.
- `date-calc.ts` 공용화 회귀: severance-pay Golden/Edge/UI 테스트 전부(83/83) 통과, `diffDays`가
  `diffDaysUtc`에 대한 단순 별칭으로 남아 호출부를 바꾸지 않았음을 코드로 확인 — **회귀 없음.**
- `rates-2026.json` 수치 ↔ FORMULA.md "기준/출처": `benefitRate`(0.6), `minWageHourly`(10,320),
  `standardDailyWorkHours`(8), `minBenefitDailyRatio`(0.8), `minBenefitDailyAmount`(66,048),
  `baseWageDailyCap`(113,500), `maxBenefitDailyAmount`(68,100), `waitingPeriodDays`(7),
  `insuredUnitPeriodRequiredDays`(180), `benefitDaysTable.rows`(5행) 전부 FORMULA.md 문서 값과
  1:1 일치.

### 4. 재실행 결과
`npm test` 83/83 통과, `npx tsc --noEmit` 오류 0, `npm run build`(next build) 성공(정적 페이지
생성 포함). unemployment-benefit 라우트는 `registry.ts` status=`draft`라 빌드 라우트 목록에는
아직 노출되지 않음(의도된 동작).

### 5. 발견된 이슈 (등급별)

| 등급 | 항목 | 유형 | 요약 |
|---|---|---|---|
| Medium | 구직급여일액 반올림 순서 | **공식 재검토 요청**(Formula Analyst) | work24.go.kr 라이브 계산이 1일액을 절사하지 않고 완전정밀도로 총액까지 계산함을 실증(2-c) — FORMULA.md의 잠정 "clamp 후 절사" 정책과 상충. Builder는 FORMULA.md를 정확히 구현했으므로 Builder 결함 아님. 영향은 좁은 구간·최대 약 269원으로 작음. |
| Low | 시행령 관보 원문 미확인(하한액) | 확인 필요 잔존 | 산술 재현 + 라이브 계산기 실동작 + 법제처 easylaw.go.kr 산식 인용으로 신뢰도는 이미 충분히 높음. 관보 원문 열람은 여전히 실패(접근 제한) — 배포를 막을 사유는 아님. |
| Low | 8시간 고정 가정 | 이미 문서화된 한계 | FORMULA.md/rates-2026.json에 이미 명시적으로 안내됨. 결과 화면에도 안내 문구 반영 필요(UX/QA 영역). |

Critical/High 없음. Builder 구현 자체의 결함은 발견되지 않았다.

### 6. 종합 판정

- **Golden Test**: 6/6 통과(코드 실행), 그중 5/6이 이번에 **실제 운영 중인 공식 계산기(work24.go.kr)
  응답과 직접 대조되어 일치**함을 새로 확인(예제 3은 애초에 라운드넘버 자체 구성 케이스였으나, 이번
  대조에서도 동일 입력으로 일치 확인됨 — 사실상 6/6 전부 공식 대조 완료).
- **work24.go.kr 대조**: **성공.** FORMULA.md가 "미확보"로 남겼던 항목을 해소했다(2-a 참고,
  Formula Analyst가 FORMULA.md의 해당 문구를 갱신할 것을 권고).
- **새로 해소한 확인 필요 항목**: (1) 공식 계산기 대조 — 해소, (2) 소정급여일수 표 3중 교차확인 —
  해소(work24.go.kr 실계산으로 대체), (4) 2026년 상한액 1차 정부 출처 — korea.kr(정책브리핑)으로
  격상, easylaw.go.kr에서 산식 문구까지 확인.
- **새로 발견한 이슈**: 구직급여일액 반올림 순서가 FORMULA.md 정책과 실제 공식 계산기 동작 사이에
  상충한다는 것(Medium, 공식 재검토 요청 — Builder 결함 아님).
- **Critical 0, High 0, Golden Test 100% PASS, TypeScript/빌드 오류 0** — docs/EVALUATION.md PASS
  기준(계산 정확성 항목)을 충족한다.

**판정: PASS** (단, Medium "공식 재검토 요청" 1건은 Formula Analyst가 FORMULA.md
"정밀도/반올림 정책"을 갱신하고 Builder가 `roundBenefitDailyAmount` 적용 시점을 조정하는 후속 조치를
권고한다 — 발행을 막을 정도의 결함은 아니라고 판단했으나, 이번 Loop 또는 다음 재검토 주기 중 가장
먼저 처리할 항목으로 명시한다.)

### 7. 재검증 (2026-09-02, FORMULA.md 갱신 → Builder 재구현 후속 대응)

FORMULA.md "정밀도/반올림 정책"이 위 2-c의 "공식 재검토 요청"을 받아들여 갱신됐고(구직급여일액을
완전정밀도로 유지, 최종 총액만 절사), Builder가 `roundBenefitDailyAmount()`를 제거하고
`finalizeTotalBenefit()`(epsilon 보정 포함)로 재구현했다는 보고를 받아, 독립적으로 재검증했다.
Edit 권한 없이 코드를 읽기만 했고, Bash는 Node 독립 재계산·테스트 재실행 용도로만 썼다.

#### 7-a. `benefitDailyAmount`가 완전정밀도로 `totalExpectedBenefit`까지 이어지는지 — **확인됨**

`src/calculators/unemployment-benefit/logic.ts`를 처음부터 끝까지 추적했다:
- 7단계(`calculateUnemploymentBenefit` 227~235행)에서 `benefitDailyAmount = Math.min(Math.max(baseBenefitDailyAmount, minBenefitDailyAmount), maxBenefitDailyAmount)`로 확정된 뒤, 이 지점부터 11단계(`finalizeTotalBenefit(benefitDailyAmount, prescribedBenefitDays)`, 256~259행) 호출까지 이 변수에 `Math.floor`/`Math.round` 등 어떤 절사·반올림 함수도 개입하지 않는다. 재할당도 없다.
- `roundBenefitDailyAmount` 같은 이름의 함수는 코드베이스 전체(`logic.ts`, `formatting.ts`, `ui.tsx`)에 더 이상 존재하지 않는다(grep 확인) — 구 정책 함수가 완전히 제거됐다.
- 절사가 일어나는 곳은 딱 두 곳뿐이다: (1) `finalizeTotalBenefit` 내부(총액 계산 이후, 표시 무관하게 반환값 자체), (2) `formatting.ts`의 `formatBenefitDailyAmountDisplay`(순수 표시 전용, 아래 7-d 참고). 계산 경로 자체에는 절사가 단 한 곳(`finalizeTotalBenefit`)뿐임을 확인했다.

#### 7-b. epsilon(`1e-6`) 보정 검증 — **정확함, Node로 직접 재현·반증 시도**

Node로 실제 코드 경로(`averageDailyWage = wage3m/baseDays` → `×0.6` → clamp → `×prescribedBenefitDays`)를 그대로 재현해 부동소수점 드리프트가 실재하는지 확인했다:

```
wage3m=10,304,092, baseDays=92 → averageDailyWage=112001(정수)
baseBenefitDailyAmount = 112001*0.6 = 67200.59999999999 (JS 실측, 수학적으로는 67200.6)
raw = benefitDailyAmount * 240 = 16128143.999999998   ← 정수(16,128,144)보다 살짝 낮게 드리프트
Math.floor(raw)          = 16128143   ← 보정 없으면 1원 낮게 오답
Math.floor(raw + 1e-6)   = 16128144   ← 보정 후 정답과 일치
(prd=210일 구간도 동일하게 재현: raw2=14112125.999999998 → 보정 후 14112126로 정답)
```
단순히 리터럴 `67200.6 * 240`을 계산하면 `16128144.000000002`(위로 드리프트)가 나와 보정 없이도
우연히 정답이 되지만, **실제 코드 경로**(`wage3m/baseDays*0.6`)를 그대로 실행하면 반대 방향(아래로)
드리프트가 발생해 `Math.floor`만으로는 1원 오답이 난다는 것을 확인했다 — 즉 이 epsilon 보정은
장식이 아니라 실제로 필요한 수정이었다.

**"정상적으로 내림해야 하는 값을 잘못 올림 처리하지 않는가"(오탐 위험) 검증**: 이 계산기의 입력
도메인 제약을 근거로 반증을 시도했다.
- `wage3m`은 `validation.ts`에서 정수로 강제되고(`validateRequiredInteger`), `baseDays`는 89~92
  범위의 정수(`calculateCalendarPeriodDaysBefore`), `benefitRate=0.6=3/5`, `prescribedBenefitDays`는
  `{120,150,180,210,240,270}` 중 하나뿐이다. clamp가 적중하지 않는 경우
  `totalExpectedBenefit`의 참값은 `wage3m × 3 × days / (5 × baseDays)`라는 유리수이며, 분모
  `5×baseDays`는 최대 460이다. 즉 **참값이 정수가 아닌 한, 가장 가까운 정수와의 참(true) 거리는
  최소 `1/460 ≈ 0.00217`** 이상이다(분수의 성질상 더 작은 양의 값은 존재할 수 없다).
- 반면 `1e-6`은 이 최소 거리(`0.00217`)보다 2,000배 이상 작다. 따라서 "참값이 실제로 x.999...처럼
  아래로 내림해야 하는 케이스"가 부동소수점 오차만으로 정수 경계를 넘어 `1e-6` 이내로 근접하는
  일은, 이 계산기가 다루는 값 규모(`wage3m` 최대 100억원, `MAX_AMOUNT_WON`)에서 발생하는 배정밀도
  상대오차(약 `1e-16 × 값`, 값이 억 단위여도 절대오차 `~1e-9~1e-7` 수준)로는 도달할 수 없다.
  clamp가 적중하는 경우(`benefitDailyAmount`가 정수 `min`/`max`)는 정수×정수 곱셈이라 애초에
  부동소수점 오차 자체가 없다.
- Node로 극단값도 직접 확인: `wage3m` 상한(100억원) 근처에서는 `baseBenefitDailyAmount`가 상한
  68,100원을 훨씬 초과해 항상 정수 clamp(68,100)로 확정되므로(코드 356~361행 근처 "매우 큰
  임금총액" 테스트가 이를 검증), clamp 미적중 구간(`averageDailyWage`가 대략 110,080~113,500원/일)
  에서는 `wage3m`이 사실상 92×110,080~92×113,500 ≈ 1,012만~1,044만원 규모로 좁게 제한되어, 절대
  부동소수점 오차가 항상 `1e-6`보다 몇 자릿수 작게 유지된다는 것을 확인했다.
- 결론: **이 계산기의 입력 도메인(정수 원 단위 임금, 89~92일 분모, 고정된 소정급여일수 집합) 안에서
  `1e-6` epsilon은 실제 부동소수점 드리프트(최대 ~`1e-7`대)를 안전하게 덮으면서, 참으로 내림해야 하는
  값(최소 간격 `1/460`)을 잘못 올림 처리할 여지가 수학적으로 없다.** 오탐(false positive) 시나리오를
  찾지 못했다.

#### 7-c. Golden Test 7개 독립 재계산 — **7개 전부 FORMULA.md Expected와 일치**

Node로 `logic.ts`와 별개의 스크립트를 작성해 예제 1·2·3·5·6·7(정상 계산 경로)을 손계산 그대로
재현했다(예제 4는 자격 미충족 예외 경로라 `insuredPeriodDays=150<180` 확인만으로 충분):

| 예제 | 재계산 결과(benefitDailyAmount, totalExpectedBenefit) | FORMULA.md Expected | 일치 |
|---|---|---|---|
| 1 | 68,100 / 18,387,000 | 68,100원 / 18,387,000원 | ✅ |
| 2 | 66,048 / 11,888,640 | 66,048원 / 11,888,640원 | ✅ |
| 3 | 67,200 / 16,128,000 | 67,200원 / 16,128,000원 | ✅ |
| 5 | 66,048 / 7,925,760 | 66,048원 / 7,925,760원 | ✅ |
| 6 | 67,200 / 12,096,000 | 67,200원 / 12,096,000원 | ✅ |
| 7 | 67,200.6(완전정밀도) / 16,128,144 | 67,200.6원(완전정밀도) / 16,128,144원 | ✅ |

7개 전부 일치. 특히 예제 7은 Node 재현에서 `benefitDailyAmount` 실측값이 `67200.59999999999`로
나왔음에도(7-b의 드리프트) `finalizeTotalBenefit`의 epsilon 보정을 거쳐 `16,128,144`로 정확히
귀결됨을 재확인했다. `npm test`(85/85, vitest)도 재실행해 `logic.test.ts`의 Golden Test 7개(및
Edge Case 12개)가 전부 통과함을 확인했다 — 코드 실행 결과와 내 독립 Node 재계산이 서로 일치한다.

#### 7-d. 표시용 `formatBenefitDailyAmountDisplay`가 계산 경로에 재사용되고 있지 않은지 — **확인됨, 오염 없음**

`formatBenefitDailyAmountDisplay`(`formatting.ts` 58~60행)를 참조하는 곳을 전부 추적했다:
- `logic.ts`는 `formatting.ts`를 아예 **import하지 않는다**(logic.ts import 목록에
  `date-calc.ts`/`rates-2026.json`/`types.ts`만 있음, grep으로 재확인) — 계산 파일이 표시 포맷터에
  구조적으로 접근할 수 없다.
- 이 함수를 실제로 호출하는 곳은 `ui.tsx` 3곳뿐이다: (1) "계산 방법" 6번째 단계 설명 문구
  (223행), (2) 핵심 결과 요약의 "구직급여일액 × 소정급여일수" 보조 문구(564행), (3) "계산 상세"
  카드의 `<dd>` 표시값(581행). 세 곳 모두 JSX 렌더링(문자열 표시) 용도이며, 그 반환값(문자열)을
  다시 숫자 계산이나 `calculateUnemploymentBenefit`/`finalizeTotalBenefit` 입력으로 되먹임하는
  코드는 없다.
- `totalExpectedBenefit`이 화면에 표시되는 유일한 지점(561행, `formatWon(outcome.result.totalExpectedBenefit)`)은 `logic.ts`가 이미 계산해 둔 `result.totalExpectedBenefit`(완전정밀도 `benefitDailyAmount`로 산출된 `finalizeTotalBenefit` 결과)을 그대로 표시만 한다 — `formatBenefitDailyAmountDisplay`로 절사된 값이 아니다.
- `logic.test.ts`도 이 분리를 명시적으로 테스트한다(318~325행: "표시용으로 절사된 값(67,200원)을
  계산에 다시 넣으면 예제 7의 실제 값과 달라진다"는 것을 대비 검증) — 이 테스트도 재실행해 통과를
  확인했다.

**흔한 버그 패턴(표시용 반올림 함수의 계산 경로 오염)은 발견되지 않았다.**

#### 7-e. 재실행 결과
- `npm test` — **85/85 통과**(vitest, 이전 재검증 시점 대비 회귀 없음, Golden 7개 포함).
- `npx tsc --noEmit` — **오류 0**.
- `npm run build`(next build, Turbopack) — **성공**(정적 페이지 생성 포함, 컴파일·타입체크·페이지
  생성 전 단계 통과). `unemployment-benefit` 라우트는 여전히 `registry.ts` status=`draft`라
  `generateStaticParams` 목록(현재 `severance-pay`만 등재)에는 없어 프리렌더 라우트로는 나타나지
  않는다 — 이는 이번 재검증 범위(반올림 정책) 밖의 기존 상태이며 새로 발견한 결함이 아니다(회귀
  아님, 정책 전환과 무관).

#### 7-f. 이슈 재평가
- 위 2-c에서 Medium으로 보고했던 "구직급여일액 반올림 순서 상충"은 FORMULA.md 정책 갱신과 이번
  Builder 재구현으로 **해소됐다** — 재검토 전 이슈였으므로 이번 재검증에서 새로 등급을 매기지
  않는다(과거 이슈 종결로 기록).
- 이번 재검증에서 **새로운 Critical/High/Medium/Low 이슈를 발견하지 못했다.**

#### 7-g. 종합 판정 (재검증)
**판정: PASS.** `benefitDailyAmount`는 clamp 이후 어떤 절사도 거치지 않고 완전정밀도로
`totalExpectedBenefit` 계산까지 이어지며, `finalizeTotalBenefit`의 `1e-6` epsilon 보정은 (1) 실제
코드 경로에서 재현되는 부동소수점 하방 드리프트(예제 7, 실측 `16128143.999999998`)를 정확히
고치고, (2) 이 계산기의 입력 도메인(정수 원 단위 임금, 89~92일 baseDays, 고정된 소정급여일수 집합)
안에서는 참으로 내림해야 하는 값(최소 간격 `1/460 ≈ 0.00217`)을 잘못 올림 처리할 수학적 여지가
없다. Golden Test 7개는 독립 Node 재계산과 FORMULA.md Expected 값이 전부 일치했고, 표시용
`formatBenefitDailyAmountDisplay`가 계산 경로로 흘러들어가는 흔한 버그 패턴도 코드 추적으로
배제했다. `npm test`/`tsc --noEmit`/`npm run build` 전부 재통과했다.

### 8. 재검증 (2026-09-03, Optimizer v2 — 체크박스 게이팅·이직사유 선택 제거, 계산 근거 문구 간결화 후속 대응)

Optimizer가 "SPEC.md/FORMULA.md v2 갱신에 따라 체크박스 게이팅·이직사유 선택 입력을 완전히
제거하고 계산 근거 화면 문구를 간결화했으며, **계산 공식(logic.ts 2~10단계)은 전혀 건드리지
않았다**"고 보고한 데 대해, Edit 권한 없이 코드를 읽기만 하고 Bash는 독립 재계산·테스트
재실행 용도로만 사용해 재검증했다.

#### 8-a. `logic.ts` 계산식이 이전 PASS 버전과 문자 그대로 동일한지 — **동일함 확인**

`logic.ts` 전체(1~282행)를 처음부터 끝까지 다시 읽고, 위 7절(직전 재검증)이 대조했던 계산
경로와 한 줄씩 비교했다:
- `calculateUnemploymentBenefit`의 "계산 순서 2번"(180일 요건 판정, 214~216행)부터 "계산
  순서 11번"(`finalizeTotalBenefit` 호출, 261~264행)까지 — 조건식·연산자·상수·호출 순서
  전부 직전 PASS 시점과 동일하다. 특히 핵심 수식들을 대조했다:
  - `averageDailyWage = input.wage3m / baseDays`(222행) — 동일.
  - `baseBenefitDailyAmount = averageDailyWage * rates.benefitRate.value`(225행) — 동일.
  - `benefitDailyAmount = Math.min(Math.max(baseBenefitDailyAmount, minBenefitDailyAmount), maxBenefitDailyAmount)`(237~240행) — 절사 없이 완전정밀도 유지, 동일.
  - `finalizeTotalBenefit`: `Math.floor(benefitDailyAmount * prescribedBenefitDays + TOTAL_BENEFIT_EPSILON)`(186~193행), `TOTAL_BENEFIT_EPSILON = 1e-6`(184행) — 동일.
  - `determineAgeBand`(`isDisabled || ageAtLeave >= 50`), `determineInsuredPeriodBand`(`>= minDays && < maxDays`, 365일=1년 고정) — 동일.
- `grep`으로 `roundBenefitDailyAmount` 재도입 여부를 다시 확인했다 — logic.ts 173행 주석
  (역사적 설명, "이제 다시 만들지 않는다")에만 등장하고 실제 함수로는 존재하지 않는다.
- diff 대상은 오직 docblock 주석(파일 상단 1~12행 "v2 대응" 설명, `finalizeTotalBenefit`
  근처 설명 등)뿐이며, 실행되는 코드 라인은 한 글자도 바뀌지 않았다.
- `tasks/unemployment-benefit/FORMULA.md` "계산 순서" 1~12단계(84~95행, 이번에 다시 읽음)와
  대조해도 logic.ts의 "계산 순서 2~11번" 주석·구현이 FORMULA.md 원문과 정확히 1:1 대응한다
  (FORMULA.md 1단계 "비자발적 이직 전제(고지 전용, v2 갱신)"는 원래부터 UI 게이팅 단계였고
  logic.ts 함수 밖의 일이라는 점도 FORMULA.md 자체가 명시).

**결론: logic.ts 2~10단계(FORMULA.md 계산 순서 기준) 계산식은 이전 PASS 버전과 동일하다 —
Optimizer의 주장과 일치.**

#### 8-b. `UnemploymentBenefitOutcome` 제거가 `insuredPeriodDays<180` 판정 경로에 영향을 주지 않았는지 — **영향 없음 확인**

`types.ts`를 처음부터 끝까지 추적했다:
- 삭제된 것은 `UnemploymentBenefitOutcome`(v1이 "체크박스 미확인" UI 상태까지 함께 감싸던
  **UI 전용 판별 유니온**)과 `UnemploymentBenefitFormInput.voluntaryLeaveAcknowledged` 필드뿐이다.
- `calculateUnemploymentBenefit`(logic.ts)이 실제로 반환하는 타입
  `UnemploymentBenefitResult = UnemploymentBenefitInsuredPeriodIneligibleResult |
  UnemploymentBenefitEligibleResult`는 **필드 하나 바뀌지 않고 그대로 남아 있다**(types.ts
  127~173행). `insuredPeriodDays < 180`일 때 반환하는 `{ eligible: false,
  eligibleByInsuredPeriod: false }`(logic.ts 215행)도 이전과 동일하다.
- `ui.tsx`를 추적한 결과, `handleSubmit`(307~321행)은 체크박스 게이팅 분기 없이 바로
  `validateUnemploymentBenefitInput` → `calculateUnemploymentBenefit`을 호출하고, 결과는
  `setResult(...)`로 저장된다. 렌더링 쪽은 `result && !result.eligible`(500행)로 분기해
  "수급자격 요건 미충족" 섹션(제목·본문·근거 법령 "고용보험법 제40조제1항제1호", 501~515행)을
  보여준다 — 이 분기는 `result.eligible`(계산 로직이 만든 값)만 보고, 제거된
  `UnemploymentBenefitOutcome`이나 체크박스 상태를 전혀 참조하지 않는다.
- `grep "voluntaryLeaveAcknowledged|leaveReasonCategory|UnemploymentBenefitOutcome|not-acknowledged"`를
  `src/` 전체에 돌려 남은 참조를 확인했다 — **7건 전부 v1→v2 변경을 설명하는 docblock 주석뿐,
  실행 코드에는 한 건도 남아 있지 않다**(코드가 이 제거된 심볼을 참조하려 했다면 `tsc
  --noEmit`이 즉시 실패했을 것이므로, 아래 8-e의 tsc 클린 결과와도 정합적이다).
- Golden Test 예제 4(`insuredPeriodDays: 150`, `logic.test.ts` 119~133행)를 다시 실행해
  `{ eligible: false, eligibleByInsuredPeriod: false }`가 정확히 반환되는지 확인했다(아래
  8-d, `npm test` 재실행 결과에 포함) — 판정 경로 자체가 이번 변경으로 전혀 달라지지 않았다.

**결론: 타입 단순화는 UI 전용 래퍼 제거일 뿐이며, `insuredPeriodDays<180` 판정 경로(계산이
실제로 수행되는 "수급자격 요건 미충족" 결과)의 코드 경로·반환값에는 영향이 없다.**

#### 8-c. 계산 근거 화면 1단계 문구가 `appliedInput.insuredPeriodDays` 실제값을 정확히 보여주는지 — **정확함, 하드코딩·오타 없음**

`ui.tsx` `buildFormulaSteps`(214~265행)와 그 호출부(607행)를 추적했다:
- 1단계 문구는 `` `가입기간 ${formatDays(insuredPeriodDays)} ≥ 180일(요건) → 충족` ``(222행)이며,
  이 `insuredPeriodDays`는 함수의 두 번째 매개변수(216행)로, 호출부에서
  `buildFormulaSteps(result, appliedInput.insuredPeriodDays)`(607행)로 전달된다.
- `appliedInput`은 `handleSubmit`의 `setAppliedInput(validation.data)`(319행)에서 설정되며,
  `validation.data`는 `validateUnemploymentBenefitInput`이 사용자가 입력한
  `insuredStartDate`·`leaveDate` 두 날짜로부터 `date-calc.ts`의 `diffDaysUtc`로 실제 계산한
  값이다(`validation.ts` 278~291행) — 상수나 다른 필드를 잘못 참조한 흔적이 없고, 리터럴
  하드코딩도 아니다.
- 이 섹션 전체(518행 `result && result.eligible && appliedInput`)는 `result.eligible === true`일
  때만 렌더링되므로, 그 시점의 `insuredPeriodDays`는 이미 180 이상임이 타입·로직 양쪽으로
  보장된다 — 따라서 문구의 "→ 충족"이 고정 문자열이라는 점은 버그가 아니라 이 렌더링 조건
  자체가 보장하는 사실이다(180 미만이었다면 애초에 이 분기가 렌더링되지 않는다).
- `formatDays`(formatting.ts 15~17행)는 단순 `Intl.NumberFormat` 포맷터라 값 자체를 왜곡하지
  않는다.

**결론: 1단계 문구는 실제 `appliedInput.insuredPeriodDays` 값을 정확히 표시하며, 하드코딩·오타
없음.**

#### 8-d. Golden Test 7개 독립 재계산 — **7개 전부 일치, 동일 코드에서 산출됨 확인**

`logic.ts`를 import하지 않는 완전히 별도의 Node 스크립트를 새로 작성해(rates-2026.json의
상수만 가져오고 산식은 FORMULA.md "공식" 절을 보고 직접 재구현), 예제 1·2·3·5·6·7을
재계산했다(예제 4는 `insuredPeriodDays=150<180` 확인만으로 충분):

| 예제 | 독립 재계산(averageDailyWage, baseBenefitDailyAmount, benefitDailyAmount, days, total) | logic.test.ts Expected | 일치 |
|---|---|---|---|
| 1 | 326,086.9565.. / 195,652.1739.. / 68,100 / 270 / 18,387,000 | 동일 | ✅ |
| 2 | 97,826.0869.. / 58,695.6521.. / 66,048 / 180 / 11,888,640 | 동일 | ✅ |
| 3 | 112,000 / 67,200 / 67,200 / 240 / 16,128,000 | 동일 | ✅ |
| 5 | 65,217.3913.. / 39,130.4347.. / 66,048 / 120 / 7,925,760 | 동일 | ✅ |
| 6 | 112,000 / 67,200 / 67,200 / 180 / 12,096,000 | 동일 | ✅ |
| 7 | 112,001 / 67,200.59999999999 / 67,200.59999999999 / 240 / 16,128,144 | 동일(완전정밀도 67,200.6, epsilon 보정 후 16,128,144) | ✅ |

7개 전부 일치. 또한 `npm test`(vitest)를 재실행해 `logic.test.ts`의 Golden Test 7개(및 Edge
Case 12개)가 **코드 실행으로도** 동일한 값을 내는지 재확인했다 — 이번 v2 변경 전후로
`logic.test.ts`/`validation.test.ts` 파일 자체가 한 글자도 수정되지 않았다는 Optimizer의
주장도 파일 diff 없이(git 미사용 환경) 내용을 직접 읽어 대조한 결과 타당해 보인다(예제
4~7의 입력·기대값 문구가 위 7절의 서술과 정확히 동일).

**결론: Golden Test 7개는 여전히 같은 계산 코드(logic.ts)에서 산출되며, 독립 재계산·코드
실행 양쪽 모두 기대값과 일치한다.**

#### 8-e. 재실행 결과
- `npm test` — **9개 테스트 파일, 102/102 통과**(vitest, 회귀 없음. Optimizer 보고와 일치).
- `npx tsc --noEmit` — **오류 0**.
- `npm run build`(next build, Turbopack) — **성공**. 이번에는 `unemployment-benefit` 라우트가
  `/calculators/[slug]`의 SSG 프리렌더 목록에 `severance-pay`와 함께 나타났다(직전까지는
  `registry.ts` status=`draft`라 목록에 없었음) — 이는 앞선 "최종 판정"이 승인한
  `draft`→`published` 전환이 이미 반영된 상태이며, 이번 v2 재검증 범위(계산 로직 불변)와는
  무관한 정상 변화다(회귀 아님).

#### 8-f. 종합 판정 (v2 재검증)

- **계산식 무변경 확인**: `logic.ts`의 FORMULA.md "계산 순서" 2~11단계(작업 지시의 "2~10단계"에
  해당하는 실제 계산 로직 전부)는 실행되는 코드 기준으로 이전 PASS 버전과 동일하다. 바뀐 것은
  docblock 주석뿐이다.
- **타입 단순화의 부작용 없음**: `UnemploymentBenefitOutcome` 제거는 UI 전용 판별 유니온
  제거이며, 계산이 실제로 수행되는 `insuredPeriodDays<180` 판정 경로(반환 타입·반환값·렌더링
  조건)에는 코드 추적 결과 영향이 없다.
- **화면 문구 정확성**: 계산 근거 1단계 문구는 실제 `appliedInput.insuredPeriodDays` 값을
  정확히 표시하며 하드코딩·오타가 없다.
- **Golden Test 7/7**: 독립 재계산(별도 Node 스크립트, logic.ts 미참조)과 `npm test` 코드
  실행 양쪽 모두 기대값과 일치.
- **재실행**: `npm test` 102/102, `tsc --noEmit` 오류 0, `npm run build` 성공.
- **새로 발견한 Critical/High/Medium/Low 이슈 없음.**

**판정: PASS.** Optimizer의 "계산 로직(logic.ts 2~10단계)은 전혀 건드리지 않았다"는 주장은
코드 추적·독립 재계산·테스트 재실행 세 방법 모두로 확인됐으며, 계산 실수의 흔적을 찾지 못했다.

## UX/UI Critic

Edit 권한 없이 코드(`ui.tsx`, `validation.ts`, `types.ts`, `formatting.ts`)와 SPEC.md/FORMULA.md/
docs/DESIGN_SYSTEM.md를 읽고, severance-pay/ui.tsx와 비교해 평가했다.

### 자체 평가 질문 (최소 10개)

1. **"비자발적 이직 전제 확인" 체크박스가 실제로 계산 게이트 역할을 하는가? 문구가 "자격 판정이
   아니라 자기 확인"이라는 것을 오해 없이 전달하는가?**
2. **자격 미충족(180일 미만) 케이스와 "체크박스 미체크" 케이스가 서로 다르게, 혼동 없이
   안내되는가?**
3. **"피보험기간과 피보험단위기간이 다를 수 있다"는 개념을 일반 사용자가 이해할 수준으로
   풀어썼는가, 전문용어를 그대로 나열했는가?**
4. **고용보험 가입기간 입력이 사용자에게 헷갈리지 않는가(단위, "18개월 중 180일"과 "총 가입기간"의
   혼동 소지)?**
5. **연령 입력(생년월일 vs 만 나이) UX가 자연스러운가?**
6. **소정급여일수 산출 근거(연령 구간 × 가입기간 구간 → 표 조회)가 계산 근거 화면에서 이해
   가능하게 설명되는가?**
7. **severance-pay와 디자인 토큰/패턴이 일관되는가(카드, 버튼, 입력 스타일, 색상 토큰)?**
8. 오류 메시지(validation.ts)가 "무엇을 어떻게 고쳐야 하는지"를 구체적으로 알려주는가?
9. "샘플 값 채우기"가 체크박스까지 자동으로 채워서 사용자의 자기 확인 절차를 무력화하지
   않는가?
10. 결과 화면에 "완전정밀도 값(예: 326,086.96원)"과 "절사된 표시값"이 섞여 나오는데, 일반
    사용자가 이를 계산 오류로 오인하지 않는가?
11. 초단시간근로자/장애인 체크박스와 이직사유 유형 선택(참고용, 자격 무관)이 자격 판정용 체크박스와
    시각적으로 구분되어, 사용자가 "이것도 체크해야 자격이 인정되나?"라고 오해하지 않는가?
12. 불필요한 UI 요소(자격 판정에 쓰이지 않는 필드가 계산에 영향을 준다고 오인시키는 구조)가
    있는가?

### 답변 및 평가

**1. 체크박스 게이팅** — `ui.tsx` `handleSubmit`(280~307행)은 `!form.voluntaryLeaveAcknowledged`를
가장 먼저 검사해 참이면 `setOutcome({ status: "not-acknowledged" })`로 조기 반환하고,
`calculateUnemploymentBenefit`(logic.ts)을 아예 호출하지 않는다. `types.ts`도 계산 함수의 입력
타입(`UnemploymentBenefitCalcInput`)에서 이 필드 자체를 제외해(`Omit<...,
"voluntaryLeaveAcknowledged" | ...>`) 구조적으로 계산 분기에 쓰일 수 없게 막아뒀다. **실제로 체크
전에는 금액이 절대 계산·노출되지 않는다 — 코드로 확인됨.** 문구도 체크박스 바로 위 경고 카드에서
"실제 수급자격 여부는 고용센터가 최종 판단합니다"라고 먼저 명시하고, 체크박스 라벨 자체는
"~에 해당한다고 **판단합니다**"(자기 확인 어투)를 쓴다 — "판정"이 아니라 "본인 확인"이라는
뉘앙스가 전달된다. 다만 체크박스 라벨 바로 옆에 "이 체크는 자격 심사가 아닙니다"처럼 못박는
한 줄이 없어, 주변 문단을 읽지 않고 체크박스만 훑는 사용자에게는 여전히 약간의 오해 여지가 남는다.
**등급: Low**(구조·문구 모두 SPEC.md 요구를 충족하며 실질적 위험은 낮음. 체크박스 라벨에 초단
설명을 한 소절 더 붙이면 더 좋음).

**2. 자격 미충족 vs 미체크 구분** — `UnemploymentBenefitOutcome`이 `"not-acknowledged"` /
`"insured-period-ineligible"` / `"eligible"` 세 상태를 판별 유니온으로 명확히 분리하고, `ui.tsx`
531~553행에서 서로 다른 제목("비자발적 이직 전제 확인이 필요합니다" vs "수급자격 요건
미충족")과 서로 다른 본문·근거 법령(전자는 법조문 인용 없음/체크 유도, 후자는 "고용보험법
제40조제1항제1호")으로 렌더링한다. 또한 검증 순서상 "필수값 미입력"(예: 가입기간을 아예 안 넣음)은
`validation.ts`의 필드 오류로 세 번째 경로(폼 인라인 에러)로 처리되어, "180일 미만"·"미체크"와도
섞이지 않는다 — 세 상태가 코드·문구 양쪽에서 확실히 분리된다. 다만 두 경고 섹션 모두 동일한
`rounded-2xl border-warning-border bg-warning-surface` 스타일과 유사한 문단 길이를 써서 **시각적
톤은 구분되지 않는다**(제목 텍스트만 다름) — 스크린을 대충 훑는 사용자는 "뭔가 안 된다"는 인상만
받고 두 경고를 헷갈릴 수 있다. **등급: Low**(내용은 명확히 다르고 최소 요건은 충족하지만, 아이콘이나
톤 차별화로 더 개선 가능).

**3. 피보험기간/피보험단위기간 설명** — `insuredPeriodDays` 필드 helpText(125~127행)는 "실제
근무일·유급휴일만 계산되는 '피보험단위기간'과는 다를 수 있습니다"라고 안내하고, 하단 정책 안내
(690~693행)도 "무급 결근·휴직 기간이 많았다면 실제 요건 충족 여부가 이 계산과 달라질 수 있습니다.
정확한 판정은 고용센터에서 확인하세요"로 풀어 쓴다. 법률 용어("피보험단위기간")를 그대로 쓰긴
하지만, 그 뒤에 "실제 근무일·유급휴일만 계산", "무급 결근·휴직 기간이 많으면 달라질 수 있다"는
**일상어 풀이가 항상 함께 붙어 있어** 전문용어를 나열만 하는 수준은 아니다. 반면 초단시간근로자
안내 카드(656~661행) "귀하는 초단시간근로자에 해당하여 피보험단위기간 산정 기준기간이 18개월이
아닌 24개월로 연장됩니다"는 별도 풀이 없이 "기준기간", "산정" 같은 용어를 그대로 쓰고, 이 정보가
사용자에게 유리한지 불리한지, 무엇을 어떻게 해야 하는지 행동 지침이 없다. **등급: Medium**
(핵심 개념인 "가입기간" 필드 자체의 설명은 합격점이나, 초단시간근로자 안내 카드는 정보 나열에
그쳐 SPEC.md가 요구한 "일반 사용자가 계산법을 몰라도 쓸 수 있게"라는 기준에는 못 미친다 — 최소
"이 사실 자체가 결과 금액을 바꾸지는 않으며, 정확한 자격 판정 시 고용센터가 24개월 기준으로
재확인합니다" 같은 한 문장 보강 권고).

**4. 가입기간 입력 단위** — Label "고용보험 가입기간(일)"이고 `<input>`은 순수 정수 일수만 받는다
(`insuredPeriodDays` FieldConfig, `type="text" inputMode="numeric"`). helpText는 "예: 2년=약
730일"이라는 환산 힌트를 주지만, **사용자가 스스로 "연·개월 → 일" 환산을 암산해야 입력할 수
있다.** SPEC.md는 "입사일~이직일 또는 총 가입기간 직접 입력 중 Architect/Builder가 UX상 더 명확한
방식을 선택"하도록 위임했는데, 실제 구현은 그중에서도 가장 입력 마찰이 큰 형태(원시 일수 직접
입력)를 택했다 — 날짜 두 개(입사일~이직일)를 받아 자동으로 일수를 계산해주는 편이 severance-pay의
"입사일/퇴사일" 패턴과도 더 일관되고, 사용자가 "4년 3개월"을 "1,551일"로 손수 환산하다 오차를
만들 위험을 없앨 수 있었다. 이 오차는 연도 구간 경계(365일 단위) 근처에서 소정급여일수 자체를
바꿀 수 있어(예: 3년 vs 2년 11개월) 결과에 실질적 영향을 준다. "18개월 중 180일"이라는 표현이
UI에 아예 등장하지 않아 그 혼동은 없지만(총 누적 가입기간이라는 뜻이 "누적"이라는 단어로
전달됨), 정수 일수 직접 입력 자체가 더 근본적인 문제다. **등급: High**(핵심 필수 입력 4개 중
하나가 일반 사용자에게 부자연스러운 단위를 요구해 입력 오류·오계산 가능성을 높인다 — SPEC.md가
명시적으로 위임한 "더 명확한 방식" 선택에서 아쉬운 결정).

**5. 연령 입력** — `birthDate` 대신 `ageAtLeave`(이직일 현재 만 나이, 정수)를 직접 받는 방식을
택했다. helpText "만 나이 기준(2023년 만 나이 통일법 이후 통용되는 방식)"으로 기준을 명시해
생년월일 계산이 필요 없고, 2023년 이후에는 "만 나이"가 일상적으로 쓰이는 나이 개념이라 사용자가
바로 답할 수 있다. **등급: 문제없음**(오히려 생년월일+이직일로 나이를 자동 계산하는 방식보다
입력 필드가 하나 줄어 더 간단하다).

**6. 소정급여일수 산출 근거 설명** — `buildFormulaSteps`(193~241행) 7~8단계가 "연령 구간:
{ageBandForTable} / 가입기간 구간: {insuredPeriodBand}" → "소정급여일수 = {days}"를 근거 법령
(고용보험법 제50조제1항, 별표1)과 함께 순서대로 보여주고, "적용된 입력값" 카드에서 원본
가입기간(`formatInsuredPeriodDays`로 "1,460일 (약 4년)"처럼 사람이 읽기 쉬운 보조 표기 포함)도
같이 노출한다. 사용자가 "왜 이 일수가 나왔는지"를 연령·가입기간 구간 이름으로 역추적할 수 있다.
다만 5×2 소정급여일수 표 전체를 화면에 보여주지 않아, "가입기간이 조금만 더 길었으면 몇 일 더
받았을지" 같은 비교는 어렵다. **등급: Low**(SPEC.md 요구사항인 "구간 산출 근거 노출"은 충족,
표 전체 노출은 있으면 더 좋은 수준의 개선 항목).

**7. severance-pay와의 디자인 일관성** — `SectionCard`, `IntroSection`, `UsageGuide` 재사용,
`INPUT_CLASS`("rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm
outline-none transition focus:border-primary focus:bg-surface focus:ring-4
focus:ring-primary/10")가 DESIGN_SYSTEM.md 문서의 클래스와 글자 하나까지 동일, 버튼·핵심 결과
카드·경고 카드 스타일도 문서 규격과 일치한다. 금액 입력 실시간 콤마 처리(`handleAmountChange`)도
severance-pay 패턴 그대로다. 한 가지 이탈: `text-zinc-500 dark:text-zinc-400`을 보조 텍스트에 30곳
직접 사용하는데, DESIGN_SYSTEM.md는 "새 코드에서는 반드시 `text-muted`를 쓴다"고 명시적으로
규정한다. severance-pay(구현 당시 이미 이 패턴을 갖고 있던 참고 구현, grep 결과 동일하게 27곳
사용)와는 일관되지만, 이 계산기는 신규 코드이므로 문서가 요구하는 `text-muted` 토큰을 처음부터
썼어야 했다. 필수 표시(`text-red-600 dark:text-red-400`)는 severance-pay와 동일 패턴이라 이 점은
문제없음. **등급: Medium**(severance-pay와는 "일관"되지만, DESIGN_SYSTEM.md의 명시적 신규 코드
규칙과는 불일치 — 두 기준이 서로 충돌하는 지점이며, 문서 규칙을 따르지 않은 쪽으로 판단).

**8. 오류 메시지 구체성** — `validation.ts`가 만드는 메시지("이직일을 입력해 주세요", "이직일
현재 만 나이은(는) 정수여야 합니다", "고용보험 가입기간은(는) 36,500 이하여야 합니다")는 필드
라벨을 그대로 넣어 어떤 입력이 문제인지 명확하고, `role="alert"` + `aria-describedby`로 입력과
연결된다(ui.tsx 361~365행). 다만 "이직일 현재 만 나이은(는)"처럼 조사 처리(은/는, 을/를)가
받침 유무를 구분하지 않아 부자연스러운 조사가 붙는 경우가 있다("나이" 뒤에 "은(는)"이 붙어
"나이은는"으로 읽힘). **등급: Low**(내용 전달에는 지장 없으나 한국어 조사 어색함, 사소한 다듬기
권고).

**9. 샘플 값과 체크박스 분리** — `handleFillSample`(316~321행)은 `voluntaryLeaveAcknowledged`를
의도적으로 `SAMPLE_FORM`에서 제외하고 `prev.voluntaryLeaveAcknowledged`를 유지한다(주석
64~68행에 근거 명시). 샘플 채우기 한 번으로 자기 확인 절차까지 자동 완료되는 일이 없다 — SPEC.md
취지에 부합하는 신중한 설계. **등급: 문제없음.**

**10. 완전정밀도 값과 절사값의 혼재** — "계산 방법" 6번째 단계는 `formatWonDetailed`(소수 둘째
자리까지, 예: "67,200.6원")로 완전정밀도 값을 보여주면서 바로 뒤에 "(화면에는
{formatBenefitDailyAmountDisplay 결과}로 표시)"라고 표시값과의 차이를 그 자리에서 설명한다
(ui.tsx 223행). 이는 FORMULA.md의 까다로운 반올림 정책을 있는 그대로 숨기지 않고 근거 화면에서
투명하게 설명한 것으로, 계산 과정을 신뢰할 수 있게 한다. 다만 9번째 단계(총액 산출)는
`formatWonDetailed(benefitDailyAmount) × formatDays(...) = formatWon(total)`로 소수점 있는
곱수가 정수 결과로 이어지는 걸 별도 설명 없이 그대로 노출한다(238행) — 산수를 그대로 따라가 보는
사용자에게는 "왜 소수점이 사라졌지?"라는 의문이 생길 수 있다. **등급: Low**(6단계에서 이미
"완전정밀도로 계산에 사용한다"는 설명이 나와 있어 맥락상 크게 혼동되진 않으나, 9단계에도 같은
한 줄을 반복하면 더 좋음).

**11~12. 참고용 요소와 자격 판정용 요소의 시각적 구분** — 초단시간근로자·장애인 체크박스는 "필수
4개" 배지 아래, `border-t border-border pt-5` 구획으로 자격 확인 체크박스(경고색 카드)와는 분명히
다른 무채색 섹션에 배치되고 각각 "(선택)" 표기가 붙는다. 이직사유 유형 선택도 별도 구획에 "(선택,
참고용)"과 "이 선택은 수급자격 판정이나 금액 계산에 영향을 주지 않습니다"라는 문구가 함께
노출된다(483~490행) — 색상(경고색 카드 vs 일반 카드)과 문구 모두로 "이건 판정용, 이건 참고용"이
구분된다. **등급: 문제없음**(SPEC.md Should Have "참고용" 요구사항이 UI에도 정확히 반영됨).

### 발견된 이슈 (등급별)

| 등급 | 항목 | 요약 |
|---|---|---|
| High | 고용보험 가입기간 입력 단위(질문 4) | 필수 입력을 "일(day)" 단위 직접 입력으로만 받아, 사용자가 연/개월을 암산으로 환산해야 함 — 환산 오차가 연도 구간 경계 근처에서 소정급여일수 자체를 바꿀 수 있음. 입사일~이직일 날짜 입력(자동 계산) 방식이 SPEC.md가 위임한 대안이었음. |
| Medium | 색상 토큰(질문 7) | `text-zinc-500`/`zinc-400`를 30곳에서 직접 사용, DESIGN_SYSTEM.md "새 코드에서는 반드시 text-muted를 쓴다" 규칙 위반(severance-pay와는 일관되지만 문서 규칙 우선). |
| Medium | 초단시간근로자 안내 카드(질문 3) | "피보험단위기간 산정 기준기간이 18개월이 아닌 24개월로 연장됩니다"를 별도 풀이·행동 지침 없이 노출 — 일반 사용자에게 실질적 의미가 전달되지 않음. |
| Low | 미체크 vs 미충족 경고의 시각적 톤(질문 2) | 두 경고 섹션이 동일한 경고색 카드 스타일이라 제목을 읽지 않으면 구분이 어려움. |
| Low | 체크박스 라벨 자체의 "판정 아님" 명시(질문 1) | 문단 전체 맥락으로는 전달되나 체크박스 라벨 바로 옆에는 없음. |
| Low | 오류 메시지 조사 처리(질문 8) | "나이은(는)"처럼 받침 유무를 반영하지 않는 기계적 조사 결합. |
| Low | 총액 계산 단계(9번째) 설명 보강 여지(질문 10) | 소수점 값이 정수 결과로 이어지는 이유를 6단계처럼 반복 설명하면 더 명확. |
| Low | 소정급여일수 표 전체 미노출(질문 6) | 구간명은 보이지만 표 전체를 보여주지 않아 "경계 근접" 비교가 어려움. |

Critical 0. High 1(가입기간 입력 단위 — 계산기 사용성의 핵심 병목이지만 계산 로직 자체의 결함은
아니고, 값을 정확히만 입력하면 결과는 정확함). Medium 2, Low 5.

### 평가 결과
- 발견된 이슈 (등급별): Critical 0 / High 1 / Medium 2 / Low 5 (위 표 참고)
- 판정: **PASS** — Critical/High가 "계산이 틀리거나 화면이 깨지는" 수준의 결함은 아니고(체크박스
  게이팅은 코드로 확인된 대로 완전히 작동하며, 미충족/미체크 두 상태도 명확히 분리된다), High
  항목(가입기간 입력 단위)은 계산 정확성이 아니라 입력 마찰·오차 유발 가능성에 관한 것이라
  docs/EVALUATION.md PASS 기준("Critical 0, High 0")과는 별개로 UX 개선 권고 사항으로 다음
  이터레이션에서 반드시 다뤄야 할 항목으로 명시한다. Formula/Auditor 단계가 이미 계산 정확성을
  PASS 처리했으므로, 이 Critic 평가는 게이트를 막는 결함(Critical)을 발견하지 못했다는 의미에서
  PASS로 판정하되, High 1건(가입기간 입력 방식)의 후속 개선을 강력히 권고한다.

### 재검증 (2026-09-02, Optimizer 1차 수정 후속 대응)

Edit 권한 없이 `ui.tsx`, `validation.ts`, `types.ts`, `formatting.ts`를 다시 읽고, grep으로
잔재 여부를 확인했으며, `npm test`/`npx tsc --noEmit`을 독립적으로 재실행해 Optimizer가 보고한
수치를 직접 검증했다. Optimizer가 수정했다고 주장한 6건(High 1, Medium 2, Low 3)을 각각 코드로
대조한 결과는 아래와 같다.

#### 1. (High) 가입기간 입력 → 날짜 자동 계산 — 해소 확인

- `ui.tsx` FIELDS 배열(149~156행)에서 `insuredStartDate` 필드가 `type="date"`로 렌더링되고
  (371행 `isDate` 판정, 394~401행 `min`/`max` 적용), 사용자가 숫자를 직접 암산해 넣던 예전
  "고용보험 가입기간(일)" 필드는 사라졌다.
- `computeLiveInsuredPeriodDays`(96~106행)가 `insuredStartDate`/`leaveDate` 두 값이 모두 유효할
  때 `date-calc.ts`의 `diffDaysUtc`/`parseIsoDateUtc`로 실시간 계산하고, 423~429행에서
  `aria-live="polite"` 문단("자동 계산된 가입기간: N일 (약 M년)")으로 즉시 화면에 보여준다 —
  순서가 뒤바뀐 경우(시작일 > 이직일)에는 `undefined`를 반환해 잘못된 값을 미리 보여주지
  않는다(101행).
- `validation.ts`(246~296행)가 실제 검증/계산 경로에서 동일한 `diffDaysUtc`로
  `insuredPeriodDays`를 만들어 `UnemploymentBenefitCalcInput`에 채우고, `logic.ts`의 계산 함수
  시그니처·11단계 공식은 코드상 전혀 건드리지 않았다(주석 한 줄만 갱신, 실제 로직 수정 없음).
- `npm test` 재실행 결과 **102/102 통과**(Optimizer 보고와 일치) — `validation.test.ts`의
  "날짜 쌍 우회" 재구성 테스트 7개가 logic.test.ts Golden Test 값과 정확히 일치하는지 확인하는
  구조이며, 재실행에서도 통과했다.

**판정: 해소됨.**

#### 2. (Medium a) `text-zinc-*` → `text-muted` — 해소 확인

`grep "text-zinc" src/calculators/unemployment-benefit/ui.tsx` 결과, Critic이 원래 지적한
패턴(`text-zinc-500 dark:text-zinc-400`, 보조 텍스트용)은 **0건**으로 완전히 제거됐다. 남아있는
것은 `text-zinc-700 dark:text-zinc-300`(6곳, 466·606·621·725·733·739행) 뿐인데, 이는 카드
본문(진한 색) 용도로 severance-pay/ui.tsx도 동일하게 쓰는 패턴이다(591·764행 확인) —
DESIGN_SYSTEM.md가 명시적으로 "새 코드에서는 text-muted를 쓴다"고 규정한 대상은 옅은 회색
보조 텍스트(zinc-500/400)이지 본문 텍스트(zinc-700/300)가 아니므로, Optimizer가 지적된 범위만
정확히 고쳤다.

**판정: 해소됨.**

#### 3. (Medium b) 초단시간근로자 문구 — 주요 지적 해소, 범위 밖 신규 문장 1건 발견(새 Low)

`ui.tsx` 731~743행의 새 문구를 FORMULA.md "예외 > 초단시간근로자의 기준기간 연장" 절
(142~143행)과 대조했다:
- 두 번째 문장("이 계산기가 보여드리는 금액·소정급여일수는 이 사실로 달라지지 않으며, 실제
  자격 판정 시에는 고용센터가 24개월 기준기간을 적용해 다시 확인합니다")은 FORMULA.md가 명시한
  사실(계산 로직 자체는 불변, 안내 문구 용도로만 사용) 범위 안이다 — 문제없음.
- 그러나 **첫 번째 문장에 추가된 "기준기간이 길어질수록 그 안에서 180일을 채울 기회도 함께
  늘어나므로 일반적으로 불리한 조정은 아닙니다"는 FORMULA.md 어디에도 없는 새로운 평가적
  주장이다.** FORMULA.md는 "기준기간이 18→24개월로 연장된다"는 사실만 적어뒀을 뿐, 그것이
  사용자에게 유리한지 불리한지에 대한 언급이 전혀 없다. 이 주장 자체는 논리적으로는 방어
  가능하다(같은 이직일 기준으로 24개월 창이 18개월 창의 상위집합이므로, 18개월 안에서 채운
  유급일은 24개월 안에서도 그대로 유효해 기회가 줄어들 수는 없다) — 그러나 이는 Optimizer가
  "FORMULA.md 범위 안에서 표현만 다듬었고, 새로운 법적 사실은 지어내지 않았다"고 자평한 것과
  달리, **법령 조항 인용 없는 새로운 해석적 판단을 스스로 만들어 덧붙인 것**이다. Optimizer의
  역할(docs/EVALUATION.md "Auditor·Critic·QA 보고서 기반 실제 수정, 새 기능 임의 추가 금지")과
  정확히 부합한다고 보기 어렵다.
- 금액·자격 판정 로직에는 영향이 없고, 주장 자체가 사실과 어긋나 보이지도 않아 사용자에게
  실질적 피해를 주는 수준은 아니다. **등급: Low(신규)** — Formula Analyst가 이 문장에 법령·
  해설 근거를 보강해 FORMULA.md에 반영하거나, 근거 없는 평가적 문장이므로 삭제/순화할 것을
  권고한다.

**판정: 정보 나열·행동지침 부재라는 원래 지적은 해소됐으나, 그 과정에서 범위를 벗어난 새
문장이 추가됨 — 새로운 Low 이슈로 기록.**

#### 4. (Low 3건) — 모두 해소 확인

- **경고 카드 시각적 구분**: `outcome?.status === "not-acknowledged"` 섹션(598~611행)이 이제
  `bg-surface-subtle`(테두리 없음) + `info` 아이콘(`bg-primary-soft`/`text-primary`)을 쓰고,
  `"insured-period-ineligible"` 섹션(613~629행)은 기존 `border-warning-border bg-warning-surface`를
  유지하면서 신규 `warning`(경고 삼각형) 아이콘(201~219행 `SectionIcon`)을 추가했다 — 제목을
  읽지 않아도 카드 배경·테두리·아이콘 색이 달라 한눈에 구분된다. **해소됨.**
- **체크박스 라벨의 "판정 아님" 명시**: 471~484행, 체크박스 라벨 바로 아래
  `<span className="block text-xs font-normal text-muted">`로 "이 체크는 고용센터의 자격
  심사가 아니라, 계산을 진행하기 위한 본인 확인일 뿐입니다."가 라벨과 함께 렌더링된다 — 문단을
  읽지 않고 체크박스만 훑어도 바로 보인다. **해소됨.**
- **조사 처리 수정**: `validation.ts` 132~142행의 `hasFinalConsonant`/`particle` 함수가 한글
  음절 코드포인트(`U+AC00`+`(초성×21+중성)×28+종성`) 성질을 이용해 받침 유무를 정확히
  판정하고, `validateRequiredInteger`(163~199행)의 필수/숫자/정수/최솟값/최댓값 메시지 전부에
  적용됐다. "이직일 현재 만 나이는 정수여야 합니다"처럼 받침 없는 라벨에도 올바른 조사가
  붙는다(로직 검증 — "나이"의 마지막 글자 "이"는 코드포인트 나머지가 0이라 받침 없음으로
  정확히 판정됨). **해소됨.**

#### 5. 새 문제 확인 — 위 3번(Low 신규 1건) 외 추가 문제 없음

- **날짜 입력 UX가 severance-pay와 일관되는지**: `INPUT_CLASS`·`type="date"`·`min`/`max`
  패턴이 severance-pay/ui.tsx와 동일하다(둘 다 `MIN_ALLOWED_DATE`/`getMaxAllowedDate()`
  재사용). `insuredStartDate`가 severance-pay의 `hireDate`와 대응하는 위치·스타일로 자연스럽게
  놓여 있다.
- **min/max 속성이 이번에도 적용됐는지(DESIGN_SYSTEM.md "날짜 입력" 규칙)**: `ui.tsx`
  398~401행에서 `leaveDate`·`insuredStartDate` 두 date input 모두 `min={MIN_ALLOWED_DATE}`/
  `max={getMaxAllowedDate()}`가 조건 없이 적용된다 — 신규 `insuredStartDate` 필드에도 규칙이
  빠짐없이 적용됐다. `validation.ts`도 같은 범위를 `isDateWithinAllowedRange`/
  `hasPlausibleYearDigits`로 다시 검사해(96~118행, 252~264행) 브라우저 UI 힌트만 믿지 않는다는
  DESIGN_SYSTEM.md 요구도 충족한다.
- `npx tsc --noEmit` 재실행 — **오류 0**(직접 확인). `npm test` — **102/102 통과**(직접 확인,
  Optimizer 보고와 일치).
- 그 외 회귀(샘플 값 채우기가 새 필드와 맞물려 깨지는지, `appliedInput.insuredPeriodDays` 표시가
  여전히 정상 작동하는지 등)를 코드로 훑었으나 이상 없음 — `SAMPLE_FORM.insuredStartDate=
  "2020-08-02"`가 `formatInsuredPeriodDays`로 정상 표시되는 경로(690~703행) 그대로 유지됨을
  확인했다.

#### 종합 판정 (재검증)

| 항목 | 결과 |
|---|---|
| High(가입기간 입력) | 해소 |
| Medium a(text-zinc-*) | 해소 |
| Medium b(초단시간근로자 문구) | 주요 지적 해소, 단 범위를 벗어난 새 문장 1건 발견(Low 신규) |
| Low(경고 카드 시각 구분) | 해소 |
| Low(체크박스 "판정 아님" 명시) | 해소 |
| Low(조사 처리) | 해소 |
| 신규 이슈 | Low 1건(초단시간근로자 안내 문구의 "일반적으로 불리한 조정은 아니다" —
FORMULA.md 미근거 해석 문장) |

**Critical 0, High 0, Golden Test 100%(102/102 재확인), TypeScript Error 0(재확인)** —
docs/EVALUATION.md PASS 기준(Critical 0·High 0)을 충족한다. 1차 판정에서 유일하게 PASS를
가로막던 High 1건이 코드로 확인 가능한 방식으로 해소됐고, 이번 재검증에서 새로 발견한 이슈는
Low 1건뿐이며 계산 결과나 게이팅 로직에는 영향이 없다.

**판정: PASS.**

(권고: Formula Analyst가 초단시간근로자 안내 문구의 "일반적으로 불리한 조정은 아니다" 문장에
대해 법령·해설 근거를 보강하거나, 근거 없는 해석이므로 문장을 순화/삭제할지 결정할 것을 다음
라운드 최우선 항목으로 권고한다 — Low 등급이므로 배포를 막을 사유는 아니다.)

### 재검증 (2026-09-03, v2 — 체크박스 게이팅·이직사유 선택 제거 후속 대응)

Edit 권한 없이 `tasks/unemployment-benefit/SPEC.md`(v2), 위 "Optimizer 수정 내역(v2 — 체크박스/이직사유
제거, 문구 간결화)" 절, `ui.tsx` 전체(679행)를 다시 읽고, grep으로 제거 대상 필드·타입의 잔존
여부를 코드베이스 전체에서 확인했다. Calculation Auditor는 이미 8절에서 계산 로직 무변경을
재검증 PASS했으므로, 이번 재검증은 UX 관점 4가지 확인 항목에 집중했다.

#### 1. 체크박스 완전 제거 및 게이팅 없는 즉시 계산 — 해소 확인

- `EMPTY_FORM`/`SAMPLE_FORM`(52~76행)에 `voluntaryLeaveAcknowledged` 필드가 없다. 폼에 남아있는
  체크박스는 "초단시간근로자입니다"/"장애인입니다"(441~471행) 두 개뿐이며, 이들은 원래부터
  자격 게이팅과 무관한 별개의 선택 입력(소정급여일수 표 조회에 쓰이는 실제 계산 입력값)이다 —
  "본인의 이직사유가 비자발적 이직에 해당한다고 판단합니다" 체크박스나 그 어떤 자격 확인용
  체크박스도 화면에 존재하지 않는다.
- `handleSubmit`(307~321행)은 `validateUnemploymentBenefitInput` 호출 → 실패 시 오류만 표시 →
  성공 시 바로 `setAppliedInput`+`setResult(calculateUnemploymentBenefit(...))`로 이어진다.
  체크박스 상태를 조건으로 검사해 조기 반환하는 분기가 전혀 없다 — 유효성 검증만 통과하면
  항상 계산 결과가 나온다.
- `types.ts`(59~93행) `UnemploymentBenefitFormInput`에도 `voluntaryLeaveAcknowledged` 필드
  자체가 없다 — 구조적으로 계산 게이팅에 쓰일 수 없다.

**결론: 체크박스 게이팅이 완전히 제거됐고, 입력만 마치면 게이팅 없이 바로 결과가 나온다.**

#### 2. 고지 문구(비자발적 이직 가정, 고용센터 최종 판단) 유지 — 해소 확인(삭제되지 않음)

체크박스가 사라진 자리를 고지 문구가 대신하고 있는지 두 지점에서 확인했다:
- 핵심 결과 카드(530~534행): "이 금액은 비자발적 이직(또는 정당한 사유 있는 자진퇴사)으로
  수급자격이 인정된다고 가정했을 때의 예상 금액입니다. 실제 수급자격 여부와 금액은 고용센터의
  최종 심사로 결정됩니다." — 결과가 나오는 화면 바로 그 자리에 항상 노출된다(조건부 아님,
  `result.eligible` true인 모든 경우에 렌더링).
- 정책 안내 섹션(650~655행): "이 계산기는... 비자발적 이직으로 수급자격이 인정된다고 가정한
  예상 금액이며, 실제 수급자격 여부·금액은 고용센터의 최종 심사로 결정됩니다." — 동일 취지
  문구가 상시 노출 섹션에도 중복 배치돼 있다.

**결론: 사용자가 요구한 "고지는 유지"가 정확히 지켜졌다 — 체크박스만 빠지고 고지 문구는
오히려 두 곳(핵심 결과·정책 안내)에 남아 이전보다 눈에 잘 띈다.**

#### 3. 이직사유 select 제거 + 설명형 텍스트로 대체 — 해소 확인

- `FIELDS` 배열(114~149행)에 `leaveReasonCategory` 항목이 없고, 파일 전체(679행)에 `<select>`
  요소나 이직사유 옵션 목록이 존재하지 않는다(직접 전체 읽기로 확인).
- 대신 정책 안내 섹션(656~659행)에 "다음과 같은 사유로 이직한 경우 일반적으로 비자발적
  이직에 해당합니다: 권고사직 등 회사 사정, 계약기간 만료, 폐업, 정당한 사유 있는 자진퇴사
  등."이라는 문단이 있다. SPEC.md v2 Must Have가 요구한 4가지 사유(권고사직 등 회사 사정,
  계약기간 만료, 폐업, 정당한 사유 있는 자진퇴사)가 누락 없이 그대로 포함돼 있고, 이 텍스트는
  `<p>` 태그 안의 순수 읽기 전용 문단이지 입력 요소가 아니다.

**결론: select 입력이 사라졌고, 요구된 4가지 사유가 정책 안내의 설명형 텍스트로 정확히
옮겨졌다.**

#### 4. 계산 근거 1·6·9단계 간결화 — 원문 대조로 해소 확인

`buildFormulaSteps`(214~265행)의 세 단계를 SPEC.md v2가 명시적으로 금지한 "금지 예시" 두 문장과
직접 대조했다:
- **1단계**: 현재 문구는 `` `가입기간 ${formatDays(insuredPeriodDays)} ≥ 180일(요건) → 충족` ``
  (222행)뿐이다. SPEC.md가 금지한 "고용보험 가입기간이 180일 이상이어야 하며, 입력하신 값이 이
  요건을 충족해 계산을 진행합니다."라는 서술형 내레이션은 파일 전체에서 검색되지 않는다 —
  사라졌다.
- **6단계**: 현재 문구는 `` `clamp(상한/하한 적용 전 금액, 하한, 상한) = ${formatWonDetailed(result.benefitDailyAmount)}` `` (247행)뿐이다. SPEC.md가 금지한 "이 완전정밀도 값을 총액
  계산에 그대로 사용합니다(화면에는 66,048원로 표시)."라는 내부 구현 설명 문장도 파일 전체에서
  검색되지 않는다 — 사라졌다. (그 설명 자체는 `formatting.ts`의 `formatBenefitDailyAmountDisplay`
  주석과 `buildFormulaSteps` 위 코드 주석에만 남아, 개발자 문서로는 보존되고 사용자 화면에서만
  빠졌다 — SPEC.md가 요구한 정확한 방식이다.)
- **9단계**: `legalBasis`가 `"고용보험법 제46조·제50조제1항"`(261행)으로, 이전에 구현 세부사항이
  섞여 있던 문장은 순수 법령 조항 인용으로 대체됐다. `description`은 원래부터 "라벨 = 값" 형태의
  수식이었고 이번에도 그대로다.
- 세 단계 모두 severance-pay 스타일(라벨 = 값)과 일치하며, "~해야 하며 ~해서 계산을 진행합니다"
  류의 AI 응답체 문장이 `buildFormulaSteps` 전체(9단계)에 하나도 남아있지 않다(2~5·7~8단계는
  원래부터 이 스타일이었음을 직접 재확인).

**결론: 사용자가 지적한 두 문장이 정확히 사라졌고, 9단계는 근거 법령만 남기는 방식으로
정리됐다 — SPEC.md v2 "계산 근거 화면 표현 원칙"을 문자 그대로 충족한다.**

#### 5. 새 문제 발생 여부 — 발견되지 않음

- `grep "voluntaryLeaveAcknowledged|leaveReasonCategory|UnemploymentBenefitOutcome|LEAVE_REASON|not-acknowledged|leaveReasonLabel|handleLeaveReasonChange|FormState"`를 `src/` 전체에
  돌린 결과, 남은 7건 전부 v1→v2 변경을 설명하는 docblock 주석뿐이며(`logic.ts` 1건, `ui.tsx`
  1건, `types.ts` 5건) 실행되는 코드에는 한 건도 남아있지 않다 — 제거된 필드를 참조하려는
  코드가 있었다면 `npx tsc --noEmit`이 즉시 실패했을 것이다(Calculation Auditor 8-e가 이미
  "오류 0"을 재확인).
- `types.ts`를 직접 읽어 `UnemploymentBenefitFormInput`/`UnemploymentBenefitCalcInput`/
  `UnemploymentBenefitResult` 세 타입 모두 제거된 필드 없이 일관되게 재정의됐음을 확인했다.
- `validation.ts`를 직접 읽어 `RawUnemploymentBenefitFormInput`에도 `leaveReasonCategory`/
  `voluntaryLeaveAcknowledged`가 없고, `insuredStartDate`→`insuredPeriodDays` 자동 계산 경로가
  이전 재검증(1차 Optimizer 대응)과 동일하게 유지됐음을 확인했다 — v2 변경이 이 계층을 건드리지
  않았다는 Optimizer 주장과 일치한다.
- `formatting.ts`의 `formatDays`가 이미 "일" 접미사를 붙이는 함수라(15~17행), 1단계 문구
  `` `가입기간 ${formatDays(...)} ≥ 180일...` `` 에서 "일일" 같은 중복·깨진 텍스트가 생기지
  않음을 직접 확인했다.
- `USAGE_STEPS`(162~177행)는 3단계만 남아있고("비자발적 이직 여부 확인" 단계 제거), 각 단계
  설명 어디에도 제거된 체크박스·이직사유 select를 안내하는 문구가 남아있지 않다.
- 핵심 결과 카드에 "(선택하신 이직사유 유형: ...)" 같은 조건부 텍스트나 `undefined`/`[object
  Object]` 노출 가능성이 있는 잔존 변수 참조도 발견되지 않았다.

**결론: 이번 v2 변경으로 새로 생긴 문제는 없다.**

### 종합 판정 (v2 재검증)

| 확인 항목 | 결과 |
|---|---|
| 1. 체크박스 완전 제거·게이팅 없는 즉시 계산 | 해소 확인 |
| 2. 고지 문구 유지(삭제되지 않음) | 해소 확인 |
| 3. 이직사유 select 제거 + 설명형 텍스트 대체 | 해소 확인 |
| 4. 계산 근거 1·6·9단계 간결화(원문 대조) | 해소 확인 |
| 5. 새로운 문제 | 없음 |

**Critical 0, High 0** — docs/EVALUATION.md PASS 기준(Critical 0, High 0)과 판정이 일치한다.
Calculation Auditor가 8절에서 이미 계산 로직 무변경을 재검증 PASS했고, 이번 UX 재검증도 4가지
확인 항목 전부 해소를 확인했으며 새로운 Critical/High/Medium/Low 이슈를 발견하지 못했다.

**판정: PASS.**

## Optimizer 수정 내역 (2026-09-02)

UX/UI Critic이 남긴 High 1건 + Medium 2건 + Low 5건(위 "발견된 이슈" 표 참고)을 해소하기 위한
라운드. docs/EVALUATION.md 기준상 High가 하나라도 있으면 PASS가 아니므로, Critic이 문서에 적은
"판정: PASS"와 무관하게 이번 라운드에서 반드시 처리했다. **계산 공식(logic.ts 1~11단계)은 한
글자도 건드리지 않았다** — Auditor가 이미 PASS 처리했으므로 그 경계를 넘지 않는 것이 이번 수정의
최우선 제약이었다.

### 1. (High) 고용보험 가입기간 입력 방식 — "날짜 두 개 + 자동 계산"으로 전환

**선택**: severance-pay가 이미 쓰고 있는 패턴(`hireDate`/`retireDate` 두 날짜 → 재직일수 자동
계산)을 그대로 재사용해, `insuredPeriodDays`(사용자가 직접 암산해 입력하던 누적 일수)를
`insuredStartDate`(고용보험 가입 시작일) + 기존 `leaveDate`(이직일) 두 날짜로 대체했다.
FORMULA.md "입력값" 표가 애초에 "가입 시작일~이직일" 또는 "총 가입기간 직접 입력" 중 하나를
Architect/Builder 재량으로 명시적으로 위임했었다 — 이번에 전자를 선택했다.

**근거**: Critic이 지적한 핵심 문제는 "4년 3개월"을 "1,551일"로 사용자가 스스로 환산해야 했고,
그 암산 오차가 연도 구간 경계(365일 단위) 근처에서 소정급여일수 자체를 바꿀 수 있다는 것이었다.
날짜 두 개 입력 + 자동 계산은 이 암산 자체를 없앤다. 대안(연/개월 별도 입력 후 내부 환산)도
검토했으나, 이는 "연/개월 → 일" 환산이라는 별도의 근사 규칙을 새로 만들어야 하고(예: "4년
3개월"을 정확히 며칠로 볼지가 또 다른 확인 필요 항목이 됨), severance-pay와 입력 패턴이
갈라진다는 단점이 있어 채택하지 않았다.

**구현 (계산 로직은 그대로 두고 입력 변환 계층만 추가)**:
- `types.ts`: `UnemploymentBenefitFormInput.insuredPeriodDays: number`를
  `insuredStartDate: IsoDateString`로 교체했다. **`UnemploymentBenefitCalcInput`(logic.ts가
  실제로 받는 타입)는 여전히 `insuredPeriodDays: number`를 그대로 유지한다** — `Omit<...,
  "insuredStartDate"> & { insuredPeriodDays: number }`로 재정의해, logic.ts의 함수 시그니처와
  11단계 공식이 이번 변경으로 전혀 바뀌지 않도록 했다(계산 함수는 여전히 "날짜 두 개"가 아니라
  "이미 계산된 일수 하나"만 받는다).
- `validation.ts`: `insuredStartDate` 필드에 leaveDate와 동일한 형식/연도자릿수/허용범위
  검증을 추가하고, `insuredStartDate > leaveDate`(가입 시작일이 이직일보다 늦음)를 새 오류로
  막았다(같은 날은 허용 — 가입기간 0일로 자연스럽게 "수급자격 요건 미충족"으로 이어진다). 두
  날짜가 모두 유효하면 `src/lib/date-calc.ts`의 `diffDaysUtc`/`parseIsoDateUtc`(이미
  severance-pay가 재직일수 계산에 쓰던 동일 유틸, baseDays 계산에도 재사용 중이던 함수)로
  `insuredPeriodDays`를 계산해 `UnemploymentBenefitCalcInput`에 채워 넣는다 — 계산 로직을
  새로 만들지 않고 기존 공용 유틸을 그대로 재사용했다.
- `logic.ts`: 실제 수정은 없다. `determineInsuredPeriodBand` 주변 주석만, 이제 이 함수가 받는
  일수가 "사용자가 직접 입력한 값"이 아니라 "validation.ts가 두 날짜로부터 계산한 값"이라는
  점을 반영해 갱신했다(동작 변경 아님).
- `ui.tsx`: "고용보험 가입기간(일)" 숫자 입력 필드를 "고용보험 가입 시작일" 날짜 입력으로
  교체했고(severance-pay와 동일한 `<input type="date">` + `min`/`max` 패턴), 두 날짜를 모두
  입력하면 "자동 계산된 가입기간: N일 (약 M년)"을 실시간으로 보여주는 미리보기 문구를 추가했다
  (`computeLiveInsuredPeriodDays` — validation.ts의 실제 검증 경로와는 분리된 얕은 UI 전용
  미리보기, 오류 판정에는 관여하지 않음). 샘플 값(`SAMPLE_FORM`)도 FORMULA.md 예제 3과 정확히
  같은 2,190일이 나오도록 `insuredStartDate="2020-08-02"`로 역산해 구성했다(Node로
  `diffDaysUtc` 재현해 확인).

**Golden Test 재확인**: 새 `validation.test.ts`에 logic.test.ts Golden Test 1·2·3·5·6·7(예제
4는 자격 미충족 경로)을 "날짜 두 개 입력"으로 우회 재구성하는 테스트 7개를 추가했다 — 각
`insuredStartDate`는 `leaveDate`("2026-08-01")에서 원래 Golden Test의 `insuredPeriodDays`만큼
정확히 며칠 전인지 Node로 독립 계산해 역산했다(예: 예제 3/7의 2,190일 → `2020-08-02`). 각
테스트는 (1) `validateUnemploymentBenefitInput`이 계산한 `insuredPeriodDays`가 원래 Golden
Test 값과 정확히 일치하는지, (2) 그 결과를 `calculateUnemploymentBenefit`에 그대로 넣었을 때
`prescribedBenefitDays`/`totalExpectedBenefit`이 logic.test.ts의 기존 기대값과 정확히
일치하는지를 모두 확인한다 — **logic.test.ts의 Golden Test 7개 자체는 한 글자도 수정하지
않았다**(여전히 `insuredPeriodDays`를 직접 넣어 `calculateUnemploymentBenefit`을 호출하는
기존 형태 그대로이며, 이는 계산 함수 시그니처가 바뀌지 않았기 때문에 가능했다). 두 테스트
파일 모두 통과 확인(아래 "재실행 결과" 참고).

### 2. (Medium a) `text-muted` 토큰 통일

`ui.tsx`에서 `text-zinc-500 dark:text-zinc-400`/`text-zinc-600 dark:text-zinc-400`을 직접 쓰던
26곳을 전부 `text-muted`로 교체했다(docs/DESIGN_SYSTEM.md "새 코드에서는 반드시 `text-muted`를
쓴다" 규칙). 카드 본문처럼 의도적으로 진한 색을 쓰는 `text-zinc-700 dark:text-zinc-300`,
필수 표시 `text-red-600 dark:text-red-400`은 Critic이 지적한 대상이 아니므로 그대로 뒀다.
지시대로 severance-pay 쪽 잔재는 이번 라운드 범위 밖이라 손대지 않았다.

### 3. (Medium b) 초단시간근로자 안내 문구 개선

기존 "귀하는 초단시간근로자에 해당하여 피보험단위기간 산정 기준기간이 18개월이 아닌 24개월로
연장됩니다"(법률 용어 나열, 행동 지침 없음)를 두 문장으로 보강했다: (1) 기준기간이 18→24개월로
늘어나는 이유와, 기준기간이 길어질수록 180일을 채울 기회도 함께 늘어나므로 일반적으로 불리한
조정은 아니라는 점, (2) 이 사실이 화면에 보이는 금액·소정급여일수 자체를 바꾸지는 않으며 실제
자격 판정은 고용센터가 24개월 기준으로 다시 확인한다는 점. FORMULA.md "예외 > 초단시간근로자의
기준기간 연장" 절이 명시한 사실(기준기간 18→24개월 연장, 계산 로직 자체는 불변) 범위 안에서
표현만 다듬었고, 새로운 법적 사실은 지어내지 않았다.

### 4. (Low) 나머지 세 항목

- **미충족/미체크 경고의 시각적 톤 구분**: `"not-acknowledged"`(계산을 시작하지 않은 "행동
  필요" 상태)와 `"insured-period-ineligible"`(계산 후 실제 요건 미충족으로 판정된 "부정적
  결과")이 동일한 `border-warning-border`/`bg-warning-surface` 카드를 써서 제목을 읽지 않으면
  구분이 안 됐다. 전자는 `bg-surface-subtle`(테두리 없음, DESIGN_SYSTEM.md "은은한 안내 블록"
  패턴) + `info` 아이콘 배지(`bg-primary-soft`/`text-primary`)로, 후자는 기존 경고 카드 스타일을
  유지하되 신규 `warning`(경고 삼각형) 아이콘 배지를 추가해 시각적으로 구분했다. 새 아이콘은
  DESIGN_SYSTEM.md "아이콘" 규칙(동일 stroke 스타일의 인라인 SVG)을 그대로 따랐다. 게이팅
  로직·문구 내용은 변경하지 않았다(순수 시각적 변경).
- **체크박스 라벨 자체의 "판정 아님" 명시**: "본인의 이직사유가 비자발적 이직(또는 정당한 사유
  있는 자진퇴사)에 해당한다고 판단합니다." 라벨 바로 아래에 "이 체크는 고용센터의 자격 심사가
  아니라, 계산을 진행하기 위한 본인 확인일 뿐입니다."를 추가해, 문단 전체를 읽지 않고 체크박스만
  훑는 사용자도 오해하지 않도록 했다.
- **오류 메시지 조사 처리**: `validation.ts`에 한글 조사(은/는, 을/를) 선택 함수(`particle`/
  `hasFinalConsonant`)를 추가했다. 한글 음절 코드포인트(`U+AC00`~`U+D7A3`)가
  `(초성×21+중성)×28+종성` 구조인 성질을 이용해, 코드포인트를 28로 나눈 나머지로 라벨 마지막
  글자의 받침 유무를 판정하고 올바른 조사 하나만 붙인다 — "이직일 현재 만 나이은(는)
  숫자여야 합니다"처럼 병기된 조사가 그대로 노출되던 문제(예: "나이은는"으로 읽힘)를 해소했다.
  `validateRequiredInteger`가 만드는 모든 메시지(필수 입력·숫자·정수·최솟값·최댓값)에 적용했다
  — `validation.test.ts`에 받침 있는/없는 라벨 각각 하나씩(고용보험 가입 시작일 vs 이직일 현재
  만 나이) 정확한 조사가 붙는지 확인하는 테스트를 추가했다.

### 재실행 결과 (2026-09-02)
- `npm test` — **102/102 통과**(vitest, 기존 85개 + 신규 `validation.test.ts` 17개, 회귀 없음).
  logic.test.ts의 Golden Test 7개는 수정 없이 그대로 통과했고, validation.test.ts의 "날짜 쌍
  우회" 재구성 테스트 7개도 동일한 기대값으로 모두 통과했다.
- `npx tsc --noEmit` — **오류 0**.
- `npm run build`(next build, Turbopack) — **성공**(컴파일·타입체크·정적 페이지 생성 전 단계
  통과). `unemployment-benefit`은 여전히 `registry.ts` status=`draft`라 프리렌더 라우트 목록에는
  나타나지 않는다(건드리지 않음, 기존과 동일).
- `npx eslint`(`npm run lint`) — **오류 0**.

### 재검증 필요 영역
- **계산 로직(logic.ts) 재검증은 불필요하다고 판단한다** — `calculateUnemploymentBenefit`의
  함수 시그니처(`UnemploymentBenefitCalcInput`의 필드 구성·타입)와 11단계 공식 자체를 이번
  라운드에서 전혀 수정하지 않았다(logic.ts diff는 주석 한 군데뿐). Auditor가 이미 이 계산 경로를
  Node로 독립 재계산하고 work24.go.kr과 대조해 PASS 처리했으므로, 그 판정은 여전히 유효하다.
- **재검증이 필요한 것은 오직 새로 추가된 입력 변환 계층(validation.ts의 날짜 쌍 →
  `insuredPeriodDays` 계산)뿐이다.** 이 계층은 계산 공식이 아니라 순수 산술(달력일수 차이)이고
  `date-calc.ts`의 기존 공용 유틸(`diffDaysUtc`)을 그대로 재사용했을 뿐이라 새로운 계산 로직을
  도입하지 않았지만, Calculation Auditor가 "계산에 실제로 들어가는 `insuredPeriodDays` 값이
  사용자가 화면에서 입력한 두 날짜와 정확히 일치하는 값인지"를 한 번 더 확인해 볼 것을
  권고한다(위 "Golden Test 재확인" 절의 7개 우회 테스트가 이미 그 등가성을 검증했으나, 독립
  재확인은 Auditor의 표준 절차와 일치한다).
- UX/UI Critic·QA 재검증에서는 특히 (1) 날짜 입력 UX가 실제 브라우저에서 severance-pay와
  동일하게 동작하는지(모바일 날짜 피커 포함), (2) 새로 추가한 "자동 계산된 가입기간" 미리보기
  문구가 스크린리더에서 자연스럽게 안내되는지(`aria-describedby`로 입력과 연결해뒀다), (3) 새
  경고 카드 톤 구분이 라이트/다크 모드 모두에서 접근성 대비를 만족하는지를 확인해 주기를
  권고한다.

## 점수
| 항목 | 배점 | 획득 |
|---|---|---|
| 계산 정확성 | 35 | 35 |
| 예외/경계값 처리 | 15 | 14 |
| UX/사용 편의성 | 15 | 13 |
| 모바일/반응형 | 10 | 8 |
| 접근성 | 5 | 5 |
| 성능/안정성 | 5 | 5 |
| 설명/계산 근거 | 5 | 5 |
| SEO/페이지 완성도 | 5 | 5 |
| 코드 품질/유지보수성 | 5 | 5 |
| **총점** | 100 | **95** |

근거:
- 계산 정확성 35/35 — work24.go.kr 실제 라이브 계산기와 5/6 예제 직접 대조(쿠키 세션 curl), 반올림 정책도 실증 증거로 재확정, Golden Test 7/7 PASS.
- 예외/경계값 처리 14/15 — 180일·50세·상한/하한 clamp 경계 전부 검증. Low 1건(1일 소정근로시간 8시간 고정 가정이 결과 화면에 명시 안 됨) 잔존.
- UX/사용 편의성 13/15 — 1차 Critic High(가입기간 일 단위 직접입력)를 날짜 자동계산으로 해소. Low 2건(소정급여일수 표 미노출, 초단시간근로자 안내문 중 미근거 문장 1개) 잔존.
- 모바일/반응형 8/10 — 코드 정적 분석만 수행(Playwright 미설치, 실기기 미검증).
- 나머지 항목은 severance-pay와 동일 근거(빌드/린트/테스트 클린, aria-live·label·role=alert 확인, 로직/UI/검증/포맷팅 분리, 공용 date-calc 유틸 재사용).

> 참고: 이 종합 점수는 Calculation Auditor(재검증 PASS)·UX/UI Critic(재검증 PASS)·QA(PASS) 세 보고서를 취합해 오케스트레이션 단계에서 계산했다(docs/EVALUATION.md "최종 종합을 담당하는 역할 부재" — severance-pay 때와 동일한 알려진 공백).

## 최종 판정
PASS 기준(docs/EVALUATION.md): 총점 92+, 계산정확성 33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0
- 총점 95 — 충족 / 계산정확성 35/35 — 충족 / Critical 0, High 0 — 충족(1차 High는 재검증으로 해소 확인) / Golden Test 7/7 — 충족 / Console·TS Error 0 — 충족 / Mobile Critical 0 — 충족(정적 분석 기준)

판정: **PASS**
개선 Loop 횟수: 2/5 (1차: 반올림 정책 실증 재확정, 2차: Critic High/Medium 대응)

남은 비차단 이슈(전부 Low, 5건)는 위 각 섹션 및 `QA.md`에 기록되어 있으며 후속 라운드 처리 권장. 이 판정에 따라 `src/calculators/registry.ts`의 `unemployment-benefit` 항목 status를 `draft`→`published`로 전환한다.

## Optimizer 수정 내역(v2 — 체크박스/이직사유 제거, 문구 간결화)

2026-09-03, SPEC.md/FORMULA.md가 v2로 갱신됨에 따라(비자발적 이직 체크박스 게이팅 완전 제거,
이직사유 유형 선택 입력 완전 제거, 계산 근거 화면 서술형 문구를 수식/숫자 위주로 간결화) 코드에
그대로 반영했다. **계산 공식(logic.ts 2~10단계)은 전혀 건드리지 않았다** — 이 항목들은 원래부터
체크박스·이직사유 필드를 계산 로직의 입력으로 받은 적이 없었으므로(types.ts
`UnemploymentBenefitCalcInput`가 애초에 두 필드를 제외해 뒀다), 이번 변경은 UI 게이팅 계층과
표시 문구에만 국한된다.

### 1. 체크박스 게이팅 완전 제거
- `types.ts`: `UnemploymentBenefitFormInput.voluntaryLeaveAcknowledged` 필드를 제거했다.
  `UnemploymentBenefitOutcome`(v1이 "체크박스 미확인"/"요건 미충족"/"충족" 세 상태를 감싸던 UI
  전용 래퍼 유니온) 타입 자체를 삭제했다 — 이제 severance-pay와 동일하게 `UnemploymentBenefitResult`
  (계산 로직이 반환하는 `eligible: false`/`true` 두 상태 판별 유니온)를 ui.tsx가 직접 상태로 쓴다.
  "자격 미충족의 두 갈래"였던 기존 설계 설명 주석은 "이제 계산 결과가 판정하는 단일 미충족 상태로
  통일됐다"는 취지로 갱신했다.
- `logic.ts`: 계산 함수 자체는 원래 이 필드를 받지 않았으므로 로직 변경은 없다. docblock 주석의
  "v1 체크박스 통과 후에만 호출" 문구를 "v2는 유효성 검증만 통과하면 항상 호출" 취지로 갱신했다.
- `ui.tsx`: 경고색 카드(체크박스 + "자기 확인" 안내 문구) 블록 전체를 제거했다. `handleSubmit`에서
  체크박스 게이팅 분기(`if (!form.voluntaryLeaveAcknowledged) { ... return; }`)를 제거해, 이제
  유효성 검증만 통과하면 바로 `calculateUnemploymentBenefit`을 호출해 결과를 보여준다.
  `insuredPeriodDays < 180`으로 인한 "수급자격 요건 미충족" 안내는 계산 로직이 실제로 판정하는
  결과이므로 그대로 유지했다. "not-acknowledged" 상태 렌더링 분기(안내 섹션 전체)를 제거했다.
  `EMPTY_FORM`/`SAMPLE_FORM`에서 `voluntaryLeaveAcknowledged`를 제거하고, `FormState`라는 별도
  래퍼 타입도 함께 제거해(`RawUnemploymentBenefitFormInput`을 폼 상태 타입으로 직접 사용) 코드를
  단순화했다. `USAGE_STEPS`에서 "비자발적 이직 여부 확인" 단계를 제거했다(나머지 3단계 유지).
  핵심 결과 카드의 "이 금액은... 고용센터의 최종 심사로 결정됩니다" 고지 문구와 정책 안내
  섹션의 동일 취지 문구는 **그대로 유지**했다 — 오히려 체크박스가 없어진 지금 이 고지 문구가
  유일한 "가정 전제 고지" 장치이므로 삭제하지 않았다(SPEC.md v2 "설계상 핵심 결정" 요구사항).

### 2. 이직사유 유형 선택 제거
- `types.ts`: `LeaveReasonCategory` 타입과 `UnemploymentBenefitFormInput.leaveReasonCategory`
  필드를 제거했다.
- `validation.ts`: `RawUnemploymentBenefitFormInput.leaveReasonCategory` 필드와 `LeaveReasonCategory`
  타입 import를 제거했다(계산 로직에는 원래 관여하지 않던 필드라 다른 검증 로직 변경 없음).
- `ui.tsx`: `LEAVE_REASON_LABELS` 상수, `handleLeaveReasonChange` 핸들러, 이직사유 select UI
  블록(라벨 + select + 옵션 목록)을 전부 제거했다. `leaveReasonLabel` 변수와 그것을 참조하던
  핵심 결과 카드의 "(선택하신 이직사유 유형: ...)" 조건부 텍스트도 함께 제거했다. `EMPTY_FORM`/
  `SAMPLE_FORM`에서 `leaveReasonCategory`를 제거했다.
- 대신 **정책 안내 섹션**에 다음 설명형 텍스트를 새 문단으로 추가했다(선택 입력이 아니라 읽는
  텍스트, SPEC.md v2 Must Have "정책 고지 문구" 항목을 그대로 재구성 — 새 법적 사실을 지어내지
  않았다):
  > "다음과 같은 사유로 이직한 경우 일반적으로 비자발적 이직에 해당합니다: 권고사직 등 회사
  > 사정, 계약기간 만료, 폐업, 정당한 사유 있는 자진퇴사 등."

### 3. 계산 근거 화면 서술형 문구 정리 (`buildFormulaSteps`)
SPEC.md v2 "계산 근거 화면 표현 원칙"에 따라 3곳을 수식/숫자 위주로 바꿨다(2~5·7~8단계는 이미
"라벨 = 값" 스타일이라 그대로 뒀다):
- **1단계**(피보험기간 180일 요건 판정): "고용보험 가입기간이 180일 이상이어야 하며, 입력하신
  값이 이 요건을 충족해 계산을 진행합니다."(서술형 내레이션) →
  `가입기간 ${formatDays(insuredPeriodDays)} ≥ 180일(요건) → 충족`(수식형). 이 값은
  `UnemploymentBenefitEligibleResult`가 아니라 "적용된 입력값"(`appliedInput.insuredPeriodDays`)에만
  있으므로, `buildFormulaSteps`가 두 번째 인자로 받도록 시그니처를 확장했다.
- **6단계**(구직급여일액 확정): "clamp(...) = {완전정밀도} — 이 완전정밀도 값을 총액 계산에
  그대로 사용합니다(화면에는 {표시값}로 표시)."에서 내부 구현 설명 부분을 제거하고
  `clamp(상한/하한 적용 전 금액, 하한, 상한) = {완전정밀도}` 값만 남겼다. 표시용 반올림과
  계산용 완전정밀도가 다르다는 사실 자체는 화면 문구에서 뺐다 — `formatting.ts`
  `formatBenefitDailyAmountDisplay`의 기존 주석과 이번에 `buildFormulaSteps` 위에 추가한 코드
  주석에만 남겼다(severance-pay 방식).
- **9단계**(총 예상 지급액 산출) `legalBasis`: "구직급여일액(완전정밀도) × 소정급여일수,
  최종적으로만 원 단위 절사"(근거 법령이 아니라 구현 설명이 들어가 있던 문제)를
  `"고용보험법 제46조·제50조제1항"`(FORMULA.md가 실제로 인용하는 구직급여일액·소정급여일수
  근거 조항 조합)으로 단순화했다. `description`(수식 자체)은 이미 "라벨 = 값" 스타일이라
  그대로 뒀다.

### 4. 초단시간근로자 안내 카드의 평가적 문장 제거
1차 Critic이 지적했던(재검증 Low로 잔존) "기준기간이 길어질수록... 일반적으로 불리한 조정은
아닙니다"라는, FORMULA.md에 근거 없는 평가적 문장을 제거했다. 새 근거를 찾아 정당화하지 않고,
FORMULA.md 원문 사실("기준기간이 18개월에서 24개월로 연장된다")만 남기는 방향으로 순화했다 —
"180일 가입 요건을 판정하는 기준기간이 일반 근로자의 18개월이 아니라 24개월로 연장됩니다."로
축약.

### 확인
- `npm test` — 9개 테스트 파일, 102/102 통과(회귀 없음, 실업급여 Golden Test 7개 포함). 계산
  로직을 건드리지 않았으므로 `logic.test.ts`/`validation.test.ts`는 수정하지 않았다 — 두
  파일 모두 `UnemploymentBenefitCalcInput`/`RawUnemploymentBenefitFormInput`를 직접 다루고,
  이 타입들은 애초에 `voluntaryLeaveAcknowledged`/`leaveReasonCategory`를 포함한 적이
  없었으므로 갱신할 대상 자체가 없었다.
- `npx tsc --noEmit` — 에러 없음.
- `npm run build`(next build, Turbopack) — 정적 페이지 생성까지 포함해 성공.
- `npm run lint`(eslint) — 에러 없음.
