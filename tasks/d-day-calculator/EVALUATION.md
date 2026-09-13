# EVALUATION: 디데이 계산기

## Builder
- 2026-09-12: Builder 구현 완료. `src/calculators/d-day-calculator/`에 승인된 SPEC.md·
  FORMULA.md·ARCHITECTURE.md를 그대로 구현했다(`types.ts`는 Architect가 이미 작성 완료,
  Builder는 `logic.ts`/`validation.ts`/`formatting.ts`/`content.ts`/`ui.tsx` + 각 테스트
  파일을 추가). 계산 공식·경계값은 FORMULA.md를 임의로 바꾸지 않고 그대로 옮겼다.
  - `logic.ts`: `calculateDday`(모드 A, FORMULA.md 계산 순서 1~5단계) / `calculateDateShift`
    (모드 B, 계산 순서 1~6단계 — 5단계 "결과일 지원 범위 재검증"을 명시적으로 구현, Golden
    Test #23 대상) / `computeWeeksBreakdown`. `src/lib/date-calc.ts`의 기존 함수
    (`parseIsoDateUtc`/`diffDaysUtc`/`addDaysUtc`/`weekdayUtc`/`formatIsoDateUtc`)만 import해
    사용했고, 계산기 전용 날짜 직렬번호 함수를 새로 만들지 않았다(ARCHITECTURE.md "1.3").
  - `validation.ts`: 지원 범위 상수(`MIN_SUPPORTED_DATE`/`MAX_SUPPORTED_DATE` =
    1900-01-01~2200-12-31)와 모드 B 일수 상한(`MAX_SHIFT_DAYS` = 100,000)을 도메인 상수로
    두고, 모드 A/B 입력을 각각 검증. 공유 링크 복원용 `parseDdayCalculatorShareState` 포함.
  - `formatting.ts`: 문장형 설명(SPEC.md 예시 문구 그대로), `YYYY년 M월 D일(요일)` 포맷, 주
    단위 환산 표시(`{n}주 {m}일 후/전`), "오늘" 배지 판정(`isToday`), 계산 근거 조립.
  - `ui.tsx`: 모드 A/B를 완전히 독립된 `useState` 3종 세트로 관리(ARCHITECTURE.md "3.2" —
    모드 전환 시 서로의 입력·결과를 초기화하지 않음), `business-days`의 "스타일 입힌 라디오"
    탭 패턴 재사용, `ShareActions`/`SectionCard`/`UsageGuide`/`IntroSection`/`FaqAccordion`
    재사용, "오늘로 되돌리기" 버튼과 모드 B의 "오늘 기준 D-Day" 보조 배지(Should Have) 포함.
    화면 순서는 `docs/DESIGN_SYSTEM.md` 최신 "공통 화면 순서"(입력→결과→계산근거→소개·
    사용방법→정책안내→FAQ)를 따랐다.
  - `registry.ts`에 `slug: "d-day-calculator", title: "디데이 계산기", category: "date",
    icon: "calendar", status: "draft"`로 등록. `calculator-components.ts`,
    `app/calculators/[slug]/page.tsx`(`faqItemsBySlug`) 배선 완료.
- **테스트**: FORMULA.md Golden Test 26개(모드 A #1~15, 모드 B #16~24, 역함수 #25~26)를
  `logic.test.ts`에 `describe` 3그룹으로 그대로 옮겨 전부 통과 확인(오류 케이스 #14·#15·
  #23·#24 포함, 특히 #23 "일수 상한 통과 + 결과 범위 초과" 케이스를 놓치지 않고 구현·검증).
  `computeWeeksBreakdown`/완료 기준 불변식(모드 A↔B 역함수, N=0~50,000 property 테스트)도
  같은 파일에 포함. `validation.test.ts`/`formatting.test.ts`/`ui.test.tsx`(모드 전환 시
  상태 보존 스모크 테스트 포함)까지 이 계산기 신규 테스트 총 80개 전부 통과.
- **회귀 확인**: `npx vitest run`(전체 스위트) 74개 파일, 922개 테스트 전부 통과(기존
  계산기 회귀 없음 — 이번 Architect 라운드가 수정한 `src/lib/date-calc.ts`를 쓰는
  unemployment-benefit/severance-pay/housing-subscription-score 포함). `npx tsc --noEmit`
  오류 0건. `npm run build` 성공(정적 페이지 생성 포함, d-day-calculator는 draft라 SSG
  목록에는 없지만 라우팅 자체는 정상 동작).
- **이 기록은 Builder 자체 확인 결과일 뿐 최종 PASS 판정이 아니다** — Calculation
  Auditor·UX/UI Critic·QA의 독립 재검증을 거쳐야 하며, "테스트 통과"라는 이 보고를 그대로
  신뢰하지 않고 각 역할이 별도로 재검증할 것을 전제로 한다.
- **Builder가 판단을 내려야 했던 애매한 지점** (다음 역할이 재검토할 것을 권장):
  1. FORMULA.md·ARCHITECTURE.md는 Golden Test 26개가 `calculateDday`/`calculateDateShift`를
     직접 호출해 검증되도록 요구했는데(오류 케이스 포함), 이 사이트의 다른 다수 계산기
     관례(예: average-cost-calculator)는 "logic.ts는 이미 검증된 입력만 받는다"는 전제를
     쓴다. 이 계산기는 ARCHITECTURE.md의 명시적 지시를 따라 `logic.ts` 자체에도 형식·범위
     방어 검증을 두어(`business-days/logic.ts`가 순회 도중 `RangeError`를 던지는 선례와
     동일한 성격) `validation.ts`(UI 친화적 필드별 메시지)와 `logic.ts`(마지막 방어선, 일반
     Error/RangeError) 두 계층이 함께 검증하는 구조가 되었다. 의도적 설계이지만 중복
     검증처럼 보일 수 있어 Calculation Auditor가 이 구조 자체를 확인해 주길 권장한다.
  2. 모드 A 핵심 결과 카드의 D-Day(diff=0) 문장("~은 시작일과 같은 날입니다.")은 SPEC.md가
     구체적 문구를 확정하지 않은 케이스라 Builder가 새로 작성했다(SPEC.md는 D-N/D+N 예시
     문장만 제시). UX/UI Critic이 이 문구의 자연스러움을 검토해 주길 권장한다.
  3. 모드 B "오늘 기준 D-Day" 보조 배지(Should Have)는 SPEC.md가 "기준일이 오늘이 아닐 때도
     유용하다"고만 서술해 정확한 문구·배치를 Builder가 결정했다(`오늘 기준 {ddayLabel}` 한
     줄, 핵심 결과 카드 안). 과도한 정보 노출인지 UX/UI Critic이 판단해 주길 권장한다.

## Calculation Auditor

**검증 방법**: Builder의 "테스트 통과" 보고를 신뢰하지 않고, (1) SPEC.md/FORMULA.md/
ARCHITECTURE.md 전문과 실제 구현 전체(`logic.ts`/`validation.ts`/`formatting.ts`/`types.ts`/
`ui.tsx`, 그리고 이번에 `src/lib/date-calc.ts`에 신규 추가된 `addDaysUtc`/`weekdayUtc`/
`formatIsoDateUtc` 및 기존 `parseIsoDateUtc`/`diffDaysUtc`)를 직접 읽고 FORMULA.md "공식"·
"계산 순서"·"예외" 절과 한 줄씩 대조, (2) FORMULA.md의 Golden Test 26개(요일 앵커 6개 포함)를
프로젝트 코드를 전혀 import하지 않는 독립 Python(`datetime`/`calendar` 모듈, proleptic
그레고리력 구현이 JS `Date.UTC`와 무관한 별도 알고리즘)으로 재계산해 전수 대조, (3) FORMULA.md가
1차 검증 수단으로 제시한 Zeller's Congruence 공식 자체를 손으로 3개 앵커(2000-01-01,
1900-01-01, 2024-02-29)에 직접 대입해 재계산, (4) 실제 구현(`calculateDday`/
`calculateDateShift`)을 별도 vitest 스크립트로 직접 호출해 5,000회(모드 B→A 역함수) +
3,000회(모드 A 라벨 규칙) 무작위 fuzz 테스트 수행, (5) `addDaysUtc`가 항상 `parseIsoDateUtc`가
만든 UTC 자정 Date만 입력받는다는 전제가 깨지는 호출 경로가 있는지 `grep`으로 전수 확인,
(6) Golden Test #23("일수 상한 통과 + 결과 범위 초과")이 실제로 지켜지는지 코드 경로를 직접
추적. fuzz 스크립트는 임시로 `src/calculators/d-day-calculator/_auditor_fuzz_tmp.test.ts`에
작성해 `npx vitest run`으로 실행한 뒤 즉시 삭제했다(소스 코드는 수정하지 않음, 검증 완료 후
`ls`로 삭제 확인). 이 외에는 코드를 전혀 수정하지 않았다.

### 1. 구현 ↔ FORMULA.md 일치 여부 — **PASS**

- **`daySerial`/`fromSerial`과 `addDaysUtc`/`weekdayUtc`/`formatIsoDateUtc`의 수학적 동일성**:
  `src/lib/date-calc.ts`를 직접 읽어 확인했다.
  - `parseIsoDateUtc`(기존, 미수정)는 정규식 `^(\d{4})-(\d{2})-(\d{2})$`으로 형식을 먼저
    검증하고 `Date.UTC` 결과를 `getUTCFullYear/getUTCMonth/getUTCDate`로 왕복 검증한다 —
    FORMULA.md "날짜 → 정수 직렬 번호" 절이 요구한 정확히 그 절차(줄 31-50).
  - `addDaysUtc(date, days) = new Date(date.getTime() + days * MS_PER_DAY)`(신규, 줄
    75-77). `parseIsoDateUtc`가 만드는 Date는 항상 UTC 자정(시:분:초:밀리초 0)이므로
    `date.getTime()`은 항상 `86_400_000`의 정수배다. 즉 `date.getTime()/86_400_000 =
    daySerial(date)`이고, `addDaysUtc`가 계산하는 값은 `(daySerial(date)+days) *
    86_400_000`과 정확히 같다 — FORMULA.md의 `resultSerial = daySerial(baseDate) +
    signedDays; resultDate = fromSerial(resultSerial)`과 대수적으로 동일한 연산이다(밀리초
    산술만 쓰므로 정수 연산, 부동소수점 오차 없음). `military-discharge-date/logic.ts`의
    `daySerial`+`fromSerial` 조합과 시그니처만 다를 뿐 알고리즘은 같다는 ARCHITECTURE.md
    "1.4"의 주장을 코드 직독으로 확인했다.
  - `weekdayUtc(date) = date.getUTCDay()`(신규, 줄 87-89)는 FORMULA.md "요일" 공식
    `new Date(daySerial*86_400_000).getUTCDay()`의 얇은 래퍼와 동일하다(입력 Date 자체가
    이미 `daySerial*86_400_000`시점을 나타내므로 재구성 없이 바로 `getUTCDay()`를 호출해도
    같은 값).
  - `formatIsoDateUtc(date)`(신규, 줄 97-102)는 `getUTCFullYear/getUTCMonth+1/getUTCDate`를
    0-padding해 조립 — `parseIsoDateUtc`의 정확한 역함수이며 FORMULA.md `fromSerial`의
    "YYYY-MM-DD 조립" 단계와 동일하다.
  - `src/lib/date-calc.test.ts`(줄 89-156)에 이 3개 신규 함수의 계약 테스트가 FORMULA.md
    Golden Test #16~#22·#25 및 요일 검증 표 6개 앵커를 그대로 옮겨 포함돼 있음을 확인했다.
- **`calculateDday`(모드 A, `logic.ts` 줄 76-93)**: `parseAndCheckSupportedDate`로 시작일·
  목표일을 각각 형식·실존·범위 검증(FORMULA.md 계산 순서 1~2단계) → `diffDaysUtc`로 `diff`
  계산(3단계) → `diff===0?"D-Day":diff>0?"D-"+diff:"D+"+(-diff)` 분기(4단계, FORMULA.md
  공식과 글자 그대로 일치) → `computeWeeksBreakdown(Math.abs(diff))` + 양쪽 요일(5단계,
  Should Have)까지 순서·내용 모두 FORMULA.md와 정확히 일치한다. 인클루시브 카운트(+1) 경로가
  코드 어디에도 없음을 확인했다.
- **`calculateDateShift`(모드 B, `logic.ts` 줄 103-135)**: 기준일 검증(1단계) →
  `days`가 정수·0 이상인지, `MAX_SHIFT_DAYS` 이하인지 검증(2단계) → `direction`에 따라
  `signedDays` 결정(3단계) → `addDaysUtc` + `formatIsoDateUtc`로 `resultDate` 계산(4단계) →
  **`resultDate`를 문자열 비교(`resultDate < MIN_SUPPORTED_DATE || resultDate >
  MAX_SUPPORTED_DATE`)로 재검증(5단계)** → `weekdayUtc`로 요일(6단계) — FORMULA.md 6단계
  전부가 정확히 이 순서·내용대로 구현돼 있다(아래 "3." Golden Test #23 상세 확인 참고).
  `MIN_SUPPORTED_DATE`/`MAX_SUPPORTED_DATE`가 `YYYY-MM-DD` 고정 폭 문자열이라 사전순 비교가
  곧 날짜 순서 비교와 동치임을 확인했다(자릿수가 항상 4-2-2로 고정되므로 문자열 비교가
  안전하다).
- **`computeWeeksBreakdown`**: `n===0→null`, `weeks=floor(n/7)`, `remainderDays=n-weeks*7` —
  FORMULA.md "주 단위 환산" 공식과 정확히 일치(줄 44-49), 나눗셈에 `Math.floor`만 사용해
  반올림하지 않는다는 FORMULA.md 정밀도 정책과도 일치.
- **`formatting.ts`**: `formatWeeksBreakdown`의 "후"/"전" 어미가 `diffDays` 부호를 따른다는
  FORMULA.md 규칙과 일치(줄 48-61). `formatKoreanDate`/`formatKoreanDateWithWeekday`는
  로직 값을 재계산하지 않고 그대로 문자열로 가공만 한다 — 숫자 재계산 경로가 없음을 확인했다
  (housing-subscription-score의 "로직 값만, 문장 조립은 formatting.ts" 경계 준수).
- **`validation.ts`**: `MIN_SUPPORTED_DATE`/`MAX_SUPPORTED_DATE`/`MAX_SHIFT_DAYS`가
  `logic.ts`가 import해 쓰는 것과 **동일한 상수**(단일 정의)임을 확인했다 — 두 파일이 서로
  다른 하드코딩된 값을 쓸 위험(드리프트)이 구조적으로 없다. `days` 필드 정규식
  `/^\d+$/`가 부호·소수점·공백을 모두 거부해 FORMULA.md "days 음수/소수/비숫자" 예외 규칙과
  일치.
- **`addDaysUtc`가 항상 UTC 자정 Date만 받는다는 전제(Architect가 명시한 리스크) 재확인**:
  `grep`으로 `d-day-calculator` 폴더 전체에서 `addDaysUtc` 호출 지점을 전수 확인한 결과
  `logic.ts` 줄 118 단 한 곳뿐이며, 인자 `base`는 항상 `parseAndCheckSupportedDate(...)` →
  `parseIsoDateUtc(iso)`를 거친 Date다. 폴더 전체에서 `new Date(` 호출은
  `ui.tsx`의 `todayInKorea()`(줄 69, `Intl.DateTimeFormat`으로 Asia/Seoul 날짜 문자열만
  뽑아내는 용도) 단 한 곳뿐이며, 이 `Date` 객체 자체는 `addDaysUtc`나 다른 `date-calc.ts`
  함수에 전달되지 않고 문자열(`today`)로만 변환돼 폼 상태와 `calculateDday`/
  `calculateDateShift` 입력(둘 다 문자열을 받아 내부에서 다시 `parseIsoDateUtc`로 UTC 자정
  Date로 재변환)에 쓰인다. 즉 **로컬 timezone Date가 `addDaysUtc`에 직접 들어가는 경로가
  코드베이스에 존재하지 않는다** — Architect가 우려한 리스크는 현재 구현에서 실현되지
  않았다.
- **이중 검증 구조(Builder가 스스로 지적한 애매한 지점 1번)**: `validation.ts`와 `logic.ts`가
  같은 상수(`MIN_SUPPORTED_DATE` 등)를 공유해 검증하므로 값 자체가 갈릴 위험은 없고,
  `logic.ts`의 검증은 ARCHITECTURE.md가 명시적으로 요구한 "Golden Test가 `calculateDday`/
  `calculateDateShift`를 직접 호출해 오류 케이스까지 검증"을 만족시키기 위한 의도된 설계다.
  계산 정확성 관점에서는 결함이 아니다(중복이지만 안전한 방향의 중복).

### 2. FORMULA.md ↔ 실제 근거 일치 여부 — **PASS** (독립 재계산 결과 전부 일치)

이 계산기는 법령·고시가 아니라 그레고리력 계산 규칙 자체가 근거이므로, "공식 계산기 대조"
대신 프로젝트 코드를 전혀 참조하지 않는 Python `datetime`/`calendar` 모듈(그레고리력을
독립적으로 구현한 표준 라이브러리, JS `Date.UTC`와 코드베이스를 전혀 공유하지 않음)로
FORMULA.md의 모든 수치를 재계산했다.

- **Golden Test #1~#13(모드 A `diff`/라벨)**: Python `(target - start).days`와
  `dday_label()`을 독립적으로 구현해 13개 케이스 전부 FORMULA.md 기대값과 **정확히 일치**
  확인(D-Day/D-N/D+N 부호·크기 전부 일치, 윤년 경계 #7~#11 포함).
- **주 단위 환산(#4·#5)**: `104 → (14, 6)`, `254 → (36, 2)` 독립 계산으로 일치 확인.
- **요일 계산 검증 표(6개 앵커)**: JS `getUTCDay()` 인덱스와 별개로 Python
  `date.weekday()`(월=0~일=6)를 `(py+1)%7`로 변환해 "일=0~토=6" 규약으로 맞춘 뒤 6개 앵커
  전부 대조한 결과 100% 일치(2000-01-01=토(6), 1900-01-01=월(1), 2024-02-29=목(4),
  2028-02-29=화(2), 2026-09-12=토(6), 2026-12-25=금(5)).
  - 추가로 FORMULA.md가 1차 교차검증 수단으로 명시한 **Zeller's Congruence 공식 자체**를
    문서에 적힌 그대로(`h = (q + ⌊13(m+1)/5⌋ + K + ⌊K/4⌋ + ⌊J/4⌋ − 2J) mod 7`, 1·2월을
    전년도 13·14월로 취급) 3개 앵커(2000-01-01, 1900-01-01, 2024-02-29)에 손으로 대입해
    각각 `h=0(토)`, `h=2(월)`, `h=5(목)`를 얻었고 FORMULA.md 표 값과 정확히 일치함을
    확인했다 — FORMULA.md의 "두 방식 100% 일치" 주장이 실제로 성립한다.
- **윤년 규칙**: Python `calendar.isleap()`(ISO 8601과 동일한 4/100/400년 규칙의 독립 구현)로
  1900=평년, 2000=윤년, 2024=윤년, 2028=윤년, 2025=평년을 재확인 — FORMULA.md "공식 출처"
  1번 및 Golden Test #7~#11의 전제와 정확히 일치.
- **Golden Test #16~#22(모드 B `add`/`subtract`)**: Python `timedelta` 기반 독립 계산으로
  7개 케이스(연말·연초 경계 #19, 윤년 경계 #20, 대규모 이동 #21 `2000-01-01+10,000일=
  2027-05-19`, 상한값 이동 #22 `2200-12-31-100,000일=1927-03-18`) 전부 일치 확인. FORMULA.md가
  Howard Hinnant 알고리즘으로 손계산했다고 주장한 #21·#22 값이 Python `timedelta`(별도
  독립 구현)로도 동일하게 재현됨을 확인했다.
- **Golden Test #23("N 상한 근거"의 핵심 케이스)**: Python으로 `2000-01-01 + 100,000일`을
  독립 계산한 결과 **`2273-10-16`**이 정확히 나왔다 — FORMULA.md가 주장한 산술 결과값과
  일치하며, 이 날짜가 지원 상한(2200-12-31)을 명백히 초과함도 확인했다.
- **지원 범위 폭(daySerial)**: Python으로 `daySerial(1900-01-01) = -25567`,
  `daySerial(2200-12-31) = 84370`, 폭 `109937`을 재계산해 FORMULA.md "N 상한 근거" 절의
  수치와 정확히 일치함을 확인했고, `1900-01-01+100,000=74433 < 84370`,
  `2200-12-31-100,000=-15630 > -25567` 부등식도 동일하게 재현했다(FORMULA.md가 "양 끝단
  기준으로는 안전하다"고 주장한 근거 자체가 옳다).
- FORMULA.md 자체의 오류는 발견되지 않았다 — 26개 Golden Test 값, 6개 요일 앵커, 윤년 규칙,
  N 상한 근거 수치 전부가 완전히 독립적인 방법(Python 표준 라이브러리)으로 재현됐다.

### 3. 이 계산기 특유의 중점 검증 항목 결과

- **Golden Test #23(상한 통과 + 결과 범위 초과)이 실제로 지켜지는가 — PASS**:
  `calculateDateShift`는 4단계에서 `resultDate`를 계산한 뒤 **반드시** 5단계에서
  `resultDate < MIN_SUPPORTED_DATE || resultDate > MAX_SUPPORTED_DATE`를 검사해 `RangeError`를
  던진다(줄 121-126). 이 재검증은 `days > MAX_SHIFT_DAYS` 검사(2단계, 상한 자체 검사)와
  **완전히 별개의 코드 경로**이며, 함수 안에 이 5단계를 우회할 수 있는 다른 return 경로가
  없음을 확인했다(단일 함수, 단일 반환문 — 조기 반환이 전부 검증 실패 시 `throw`뿐이다).
  `logic.test.ts` #23이 `expect(() => calculateDateShift({baseDate:"2000-01-01",
  days:100_000, direction:"add"})).toThrow()`로 이를 검증하며 실제로 통과함을 재실행해
  확인했다. 추가로 아래 fuzz 테스트(2,283건의 무작위 범위 초과 케이스)가 이 재검증이
  일반화된 임의의 입력에서도 항상 작동함을 뒷받침한다.
- **`addDaysUtc`의 "항상 UTC 자정 Date만 입력" 전제 — PASS(위반 경로 없음)**: 위 "1."에서
  이미 상세히 확인했듯, `addDaysUtc` 호출은 코드베이스 전체에서 `logic.ts` 1곳뿐이고
  인자는 항상 `parseIsoDateUtc`가 만든 Date다. `ui.tsx`의 `new Date()`(로컬 timezone
  가능성이 있는 유일한 호출)는 `Intl.DateTimeFormat`으로 문자열만 추출하는 데 쓰이고
  `addDaysUtc`에 전달되지 않는다.
- **모드 A ↔ 모드 B 역함수 불변식(Golden Test #25~#26) — 대량 fuzz로 PASS**: 테스트
  파일에 있는 값을 신뢰하지 않고, 실제 구현(`calculateDday`/`calculateDateShift`)을 별도
  vitest 스크립트로 직접 호출해 검증했다(임시 파일 `_auditor_fuzz_tmp.test.ts`, 실행 후
  즉시 삭제).
  - **5,000회** 무작위 `(baseDate, N∈[0,100000], direction)` 조합으로
    `calculateDateShift` → `resultDate`를 얻고, 이를 다시 `calculateDday({startDate:
    baseDate, targetDate: resultDate})`에 넣어 `diffDays`가 항상 `direction==="add"?N:
    (N===0?0:-N)`인지 검증했다. 결과: **2,717건**이 지원 범위 안에 들어와 실제로
    계산됐고(불변식 위반 0건), 나머지 **2,283건**은 `resultDate`가 범위를 벗어나
    `calculateDateShift`가 정상적으로 `throw`해(위 5단계 재검증) 스킵됐다 — 즉 "범위 안이면
    항상 정확히 역함수, 범위 밖이면 항상 명시적으로 거부"라는 완료 기준을 5,000회 전수에서
    확인했다.
  - **3,000회** 무작위 `(startDate, targetDate)` 조합으로 `calculateDday`를 호출해
    `diffDays`의 부호·크기와 `ddayLabel`(`D-Day`/`D-N`/`D+N`)이 항상 FORMULA.md 규칙과
    일치하는지 검증했다 — 위반 0건.
  - `npx vitest run`으로 실행해 2개 테스트 모두 통과(로그: `fuzz: tested=2717
    skippedOutOfRange=2283`)했고, 검증 직후 임시 파일을 삭제해 소스 트리에 남기지 않았다
    (`ls src/calculators/d-day-calculator/`로 삭제 확인).
- **윤년 규칙(100년/400년 예외) — PASS**: 위 "2."에서 Python `calendar.isleap()`으로
  독립 재확인했고, `parseIsoDateUtc`가 쓰는 `Date.UTC`도 ECMAScript 스펙상 동일한 그레고리력
  윤년 규칙을 따른다(JS `Date`는 프롤렙틱 그레고리력을 표준으로 채택 — 별도 커스텀 윤년 로직이
  코드에 없고 오직 `Date.UTC`의 내장 규칙에만 의존하므로, 이 계산기가 윤년 규칙을 잘못
  재구현할 여지 자체가 없다).
- **요일 계산 — PASS**: 6개 앵커 전부 Python 독립 재계산 + Zeller's Congruence 수동 계산
  (3개) 이중으로 교차확인했고, `weekdayUtc`/`date-calc.test.ts`의 계약 테스트가 동일 앵커를
  그대로 검증함을 확인했다.

### 회귀·정적 검증

- `npx vitest run`(전체 스위트, Auditor가 직접 재실행): **74개 파일, 922개 테스트 전부
  통과**(Builder 보고와 동일 수치, 재현 확인).
- `npx tsc --noEmit`: 오류 0건.
- 임시로 추가했던 fuzz 테스트 파일(`src/calculators/d-day-calculator/_auditor_fuzz_tmp.test.ts`)은
  검증 직후 삭제했으며, 이 계산기 소스 코드는 Auditor 검증 과정에서 전혀 수정하지 않았다.

### 발견된 이슈 (등급별)

- **Critical**: 없음.
- **High**: 없음.
- **Medium**: 없음.
- **Low**:
  1. (설계상 이미 인지·수용된 트레이드오프, 재확인만) `validation.ts`(UI 친화적 필드별
     메시지)와 `logic.ts`(마지막 방어선, 일반 `Error`/`RangeError`) 두 계층이 동일한 지원
     범위·상한을 중복 검증한다(Builder가 "애매한 지점 1번"으로 스스로 지적). 두 계층이 같은
     상수(`MIN_SUPPORTED_DATE` 등)를 공유해 값이 갈릴 위험은 없으므로 계산 정확성 결함은
     아니다 — ARCHITECTURE.md가 명시적으로 요구한 설계이며, 유지보수 시 상수 위치만
     계속 단일화하면 된다는 점만 기록해 둔다.
  2. (정보 제공) `validateDateShiftInput`의 `days` 정규식(`/^\d+$/`)은 자릿수 제한이 없어
     예컨대 "00000100" 같은 과도한 선행 0이나 매우 긴 숫자 문자열(예: 20자리)도 형식 검증은
     통과하고 이후 `Number()` 변환 후 `> MAX_SHIFT_DAYS` 비교에서 정상적으로 거부된다(직접
     확인: 매우 큰 자리수 문자열은 `Number()` 오버플로로 `Infinity`가 되어도
     `Infinity > 100_000`이 참이라 안전하게 거부됨). 계산 결과에 영향을 주는 결함은
     아니며, 참고 기록으로만 남긴다.

### 판정: **PASS**

구현이 FORMULA.md의 공식·계산 순서·예외 처리를 임의로 바꾸지 않고 정확히 그대로 옮겼음을
코드 직독(특히 신규 함수 `addDaysUtc`/`weekdayUtc`/`formatIsoDateUtc`가 기존 검증된
`daySerial`/`fromSerial` 알고리즘과 수학적으로 동일함)으로 확인했다. FORMULA.md 자체도
프로젝트 코드와 무관한 독립 재계산(Python `datetime`/`calendar`, Zeller's Congruence 수동
계산)으로 26개 Golden Test·6개 요일 앵커·윤년 규칙·N 상한 근거 수치 전부가 실제 그레고리력과
정확히 일치함을 재확인했다 — "공식 재검토 요청" 사유가 없다. Architect가 "11. 남은 리스크"에서
특별히 지목한 두 지점(Golden Test #23 재검증 단계 누락 여부, `addDaysUtc`의 UTC 자정 Date
전제 위반 경로 존재 여부)을 코드 추적과 `grep` 전수 확인으로 직접 검증한 결과 둘 다 문제없음을
확인했고, 모드 A↔B 역함수 불변식은 테스트 파일의 값을 신뢰하지 않고 실제 구현을 8,000회
(5,000+3,000) 무작위 fuzz로 재검증해 위반 0건을 확인했다. Critical/High/Medium 이슈는
발견되지 않았고, Low 2건은 모두 코드 결함이 아닌 기존 설계 트레이드오프 재확인/정보 제공성
기록이다.

### 재검증 (Optimizer 수정 후)

**검증 범위**: 전체 재검증이 아니라, Optimizer가 "## Optimizer" 절에서 주장한 "`ui.tsx` 한
파일만 수정, 계산 로직은 건드리지 않음"이 사실인지, 그리고 그 수정이 계산 정확성에 영향이
없는지만 확인했다.

- **`ui.tsx` 직접 대조 — PASS(계산 관련 변경 없음)**: 전체 793줄을 직접 읽었다. 변경은 정확히
  Optimizer가 보고한 2건뿐이다. (1) `SelectedCheckIcon` 컴포넌트 추가(줄 126-141)와 방향 토글
  `<label>` 안 `{shiftForm.direction === value && <SelectedCheckIcon />}` 조건부 렌더링(줄
  616) — `aria-hidden="true"`가 붙은 순수 장식 SVG이며, `shiftForm.direction`이라는 기존 상태
  값을 그대로 읽기만 할 뿐 새로운 상태·조건 분기·값 파싱을 추가하지 않았다. (2) 모드 B
  "오늘 기준" 배지에 `formatDdaySentence(shiftResultTodayDday)`를 이어붙인 것(줄 725) —
  `shiftResultTodayDday`를 계산하는 로직(줄 364-371, `calculateDday({startDate: today,
  targetDate: shiftResult.resultDate})` 호출과 try/catch)은 한 글자도 바뀌지 않았고,
  `formatDdaySentence`는 `formatting.ts`가 이미 노출하던 기존 함수를 문자열 조립에 재사용한
  것뿐이다. 두 변경 모두 `handleDdayFieldChange`/`handleDdaySubmit`/`handleShiftSubmit`/
  `handleShiftDaysChange`/`validateDdayInput`/`validateDateShiftInput`/`calculateDday`/
  `calculateDateShift` 호출부와 상태 갱신 흐름을 전혀 건드리지 않았음을 확인했다(모든 핸들러
  함수 본문이 이전 검증 당시와 동일).
- **`logic.ts`/`validation.ts`/`src/lib/date-calc.ts`/`formatting.ts` 무변경 — PASS(직접
  대조, Optimizer 주장을 그대로 믿지 않음)**: 4개 파일 전문을 다시 읽어 이전 Auditor 절이
  인용·서술한 함수 시그니처·상수·계산 순서(예: `calculateDday`의 5단계 분기, `calculateDateShift`
  의 5단계 결과 범위 재검증, `MIN_SUPPORTED_DATE`/`MAX_SUPPORTED_DATE`/`MAX_SHIFT_DAYS` 상수값,
  `formatDdaySentence`/`formatWeeksBreakdown`의 분기 로직)와 한 줄씩 대조한 결과 전부 동일함을
  확인했다. 파일시스템 타임스탬프로도 교차 확인했다: `logic.ts`(19:59)·`validation.ts`
  (20:00)·`formatting.ts`(20:00)·`types.ts`(19:46)·`src/lib/date-calc.ts`(19:44)는 모두
  Builder 구현 시점 그대로이고, `ui.tsx`만 23:48로 최근 수정됐다 — Optimizer의 "수정 범위는
  `ui.tsx` 한 파일뿐" 주장과 정확히 일치한다.
- **전체 스위트 재실행 — PASS**: `npx vitest run` 결과 **74개 파일, 922개 테스트 전부
  통과**(이전 PASS 판정 당시와 정확히 동일한 파일·테스트 수, 회귀 없음). `logic.test.ts`
  (FORMULA.md Golden Test 26개 포함, 이 파일도 20:05로 미수정 확인)가 이 안에 포함돼
  동일한 값으로 통과함을 재확인했다.
- **정적 검증 — PASS**: `npx tsc --noEmit` 오류 0건.

**판정: 재검증 PASS.** Optimizer의 수정 2건은 보고대로 순수 시각적 요소(체크 아이콘)와
기존 문장 조립 함수 재사용(문구 보강)에 국한되며, 계산 상태·조건·값 파싱 로직이나
`logic.ts`/`validation.ts`/`src/lib/date-calc.ts`/`formatting.ts`에는 어떠한 변경도 없었다.
기존 "## Calculation Auditor" 절의 PASS 판정은 그대로 유효하다.

## UX/UI Critic

**검증 방법**: SPEC.md("핵심 사용자 흐름"·"날짜 차이 계산 정의"·"Must Have"·"Should
Have"·"화면 구성"), FORMULA.md("주 단위 환산"), ARCHITECTURE.md("3. 상태 구조", "3.3 탭/
세그먼트 UI 구현"), 그리고 이미 PASS된 위 "Builder"·"Calculation Auditor" 절(계산 정확성은
전제로 삼고 재검증하지 않음)을 먼저 읽었다. 이어서 실제 구현 전체(`ui.tsx`/`types.ts`/
`formatting.ts`/`content.ts`/`validation.ts`/`logic.ts`/`ui.test.tsx`)를 직접 읽고,
`docs/DESIGN_SYSTEM.md` 전체(색상 토큰, 입력 UX, 입력 라벨·순서, 공통 화면 순서, 접근성,
모바일)와 한 줄씩 대조했다. Edit/Bash 권한이 없어 실제 dev서버 렌더링·실기기 테스트는
불가능하므로, 코드 정독(className·조건부 렌더링·상태 갱신 흐름 추적)과 `ui.test.tsx`의
기존 스모크 테스트 결과로 화면 동작을 추론했다 — 픽셀 단위 시각 검증·실제 브라우저 키보드
포커스 이동 확인은 QA 영역으로 남긴다.

### 자체 평가 질문 (16개, 평가 항목 7개 모두 커버, 필수 질문 4개 포함) 및 답변

#### [필수 질문] Q1. (평가 항목: 입력 라벨의 표현) 라벨이 법령·전문 용어나 FORMULA.md/SPEC.md의 변수 식별자를 그대로 복사한 것은 아닌가?
- **근거**: `ui.tsx`의 실제 라벨은 "시작일"(줄 408)·"목표일"(줄 443, 모드 A), "기준일"
  (줄 508)·"일수"(줄 542)·"방향"(줄 567, 모드 B)이다. FORMULA.md의 변수 식별자는 영문
  (`startDate`/`targetDate`/`baseDate`/`days`/`direction`)이므로 화면에 영문 식별자가
  그대로 노출되지는 않는다. 한글 라벨 자체도 "이직일"(법령 문언) → "퇴사일" 같은 순화가
  필요한 법령 전문용어가 원천적으로 존재하지 않는 순수 산술 계산기라는 SPEC.md/FORMULA.md의
  성격과 일치하며("정책 재검토: 해당 없음"), "시작일"·"목표일"·"기준일"·"일수" 모두
  국어사전적 일상어로 계산법을 몰라도 뜻을 바로 알 수 있다. "방향"이라는 단어 자체는
  다소 추상적이지만 실제 선택지 라벨이 "더하기"/"빼기"로 구체적이라 혼동 소지가 없다.
- **등급**: 문제없음.

#### [필수 질문] Q2. (평가 항목: 입력 순서·그룹핑) 입력 필드 순서가 시간 순서(입사일→퇴사일 등)인가? 하나의 기간을 이루는 두 날짜 사이에 성격이 다른 필드가 끼어 있지 않은가?
- **근거**: 모드 A는 시작일(줄 406-440)이 목표일(줄 442-472)보다 앞에 배치되어 시간 순서를
  따르며, 두 날짜 사이에 다른 성격의 필드가 끼어 있지 않다(`grid gap-5 sm:grid-cols-2`
  한 행에 두 날짜만 인접). 모드 B는 기준일(줄 507-538)이 먼저, 그 다음 일수(줄 540-564)와
  그 일수를 조정하는 방향(줄 566-596)이 같은 행에 인접 배치된다 — "일수"와 "방향"은 서로
  다른 개념이 아니라 하나의 이동량(부호 있는 일수)을 두 입력으로 분리한 것이므로 인접
  배치가 SPEC.md "관련된 필드는 인접시킨다" 원칙에 부합한다.
- **등급**: 문제없음.

#### [필수 질문] Q3. (평가 항목: 결과 가독성 / 오류 메시지) 같은 개념이 폼·결과·오류 메시지 전체에서 한 용어로 통일돼 있는가?
- **근거**: "시작일"/"목표일"/"기준일"/"일수"라는 용어가 폼 라벨(`ui.tsx`)·도움말
  (`HELP_CLASS` 문단)·결과 dt(`날짜 요약`/`입력 요약` SectionCard)·계산 근거 라벨
  (`formatting.ts`의 `buildDdayBreakdown`/`buildDateShiftBreakdown`)·오류 메시지
  (`validation.ts`의 `validateSupportedDateField`, `logic.ts`의 `parseAndCheckSupportedDate`
  오류 문구) 전체에서 정확히 동일하게 재사용된다(예: 오류 "시작일을 입력해 주세요."가
  라벨 "시작일"과 동일 표현). `logic.ts`가 던지는 방어적 오류(`RangeError`, 예: "기준일은
  1900-01-01부터 2200-12-31까지만 계산할 수 있습니다")도 `validation.ts`가 미리 걸러내는
  동일 라벨·범위 문구와 일치해 두 계층 사이에 용어 드리프트가 없다.
- **등급**: 문제없음.

#### [필수 질문] Q4. (평가 항목: 불필요한 UI 요소 / 입력 최소화) 입력 필드 수가 최소인가? 다른 입력에서 유도 가능한 값을 중복으로 묻지 않는가?
- **근거**: 모드 A는 2개(시작일·목표일), 모드 B는 3개(기준일·일수·방향)만 입력받는다. 넷 중
  어느 것도 나머지로부터 유도할 수 없다(날짜 차이 계산기의 본질상 두 날짜 모두 사용자
  입력이 필요하고, 이동량은 "일수"와 "방향" 둘로 분리해야 "-100" 직접 입력을 피할 수 있다는
  SPEC.md 요건 자체가 필드 3개를 요구한다). 자산 유형 선택, 별도의 "기간 단위"(주/개월)
  선택 같은 부가 입력 UI가 전혀 없다 — v1 범위에서 배제한 프리셋·음력 변환·달력 월 환산
  기능도 화면에 흔적이 없다.
- **등급**: 문제없음.

#### Q5. (평가 항목: 일반 사용자가 계산법을 몰라도 사용 가능 — 이 계산기 특유 중점 확인 1) 모드 A/B 전환 시 상태 보존이 실제 화면에서 체감되는가?
- **근거**: `ui.tsx`는 `activeMode` 하나만 바꾸는 `setActiveMode`와, 모드 A 전용
  (`ddayForm`/`ddayErrors`/`ddayResult`/`ddayAppliedInput`) 및 모드 B 전용
  (`shiftForm`/`shiftErrors`/`shiftResult`/`shiftAppliedInput`) state를 완전히 분리해서
  갖고 있다(줄 130-148). 모드 탭 `onChange`는 `setActiveMode(value)`만 호출할 뿐 다른
  모드의 state를 건드리는 코드 경로가 없음을 전체 파일에서 확인했다(`setDdayForm`/
  `setDdayResult` 등은 오직 모드 A 핸들러 안에서만, `setShiftForm`/`setShiftResult` 등은
  오직 모드 B 핸들러 안에서만 호출됨). `ui.test.tsx`의 "모드를 전환해도 각 모드의 입력·
  결과가 서로 보존된다" 테스트(줄 42-63)가 실제로 "모드 A 계산 → 모드 B 전환·계산 → 모드
  A로 복귀 시 '디데이' 결과 헤딩이 여전히 존재"함을 검증하며, 이는 코드 추적 결과와 정확히
  일치한다 — SPEC.md Must Have("모드 전환 후에도 각 모드의 입력값과 계산 결과를 서로
  보존")가 실제로 체감 가능한 형태로 구현돼 있다.
- **등급**: 문제없음.

#### Q6. (평가 항목: 일반 사용자가 계산법을 몰라도 사용 가능 / 결과 가독성 — 중점 확인 2) "D-Day"/"D-N"/"D+N" 표기 아래 문장형 설명이 항상 함께 표시되는가? "D+N"(과거) 문장이 자연스럽게 다른가?
- **근거**: 모드 A 핵심 결과 카드(줄 633-650)는 `ddayResult.ddayLabel`(줄 640) 바로
  아래(`mt-4`) `formatDdaySentence(ddayResult)`(줄 643)를 조건 없이 항상 렌더링한다 —
  `ddayResult`가 존재하는 한 문장이 빠지는 경로가 없다. `formatDdaySentence`
  (formatting.ts 줄 69-78)는 세 가지 경우를 모두 다른 문장으로 분기한다: `diffDays===0`
  → "…은 시작일과 같은 날입니다.", `diffDays>0` → "…까지 N일 남았습니다.", `diffDays<0`
  → "…로부터 N일 지났습니다." — SPEC.md가 예시로 든 "…까지 104일 남았습니다"/"…로부터
  254일 지났습니다" 문장 패턴과 정확히 일치하고, "지났습니다"라는 어미가 과거 표기(D+N)의
  의미를 자연스러운 한국어로 전달한다(문법적으로도 "일"로 끝나는 날짜 뒤에 붙는 조사
  "은"/"로부터"가 모두 올바르게 호응한다 — "일"의 받침 'ㄹ'은 "로부터"를 그대로 취하는
  예외 규칙에 해당해 "으로부터"로 바꿀 필요가 없다). 모드 B도 동일하게
  `formatDateShiftSentence`가 핵심 결과 카드에 항상 동반된다(줄 694-696).
- **등급**: 문제없음.

#### Q7. (평가 항목: 입력 라벨·순서·Placeholder의 명확성 — 중점 확인 3) "오늘" 기본값과 "오늘 아님" 배지가 실제로 구현됐는가? 날짜를 바꾸면 배지가 사라지고 실제 날짜가 보이는가?
- **근거**: `today` state는 `todayInKorea()`(Asia/Seoul 기준)로 초기화되고 `ddayForm`/
  `shiftForm`의 시작일·기준일 기본값으로 쓰인다(줄 128, 133, 140). 결과 화면에서
  `formatKoreanDateWithWeekday(ddayAppliedInput.startDate, ...)`(줄 657)/
  `formatKoreanDate(shiftAppliedInput.baseDate)`(줄 709)가 **항상** 실제 날짜를 렌더링하고,
  그 옆에 `isToday(..., today) && <TodayBadge/>`(줄 658, 710)가 오늘일 때만 추가로
  붙는다 — `military-discharge-date/ui.tsx`의 기존 선례(주요 일정 타임라인에서
  `item.state === "today"`일 때만 "오늘" 배지를 실제 날짜 옆에 추가로 붙이는 패턴, 해당
  파일 줄 86)와 동일한 "배지는 항상 보이는 실제 날짜에 추가되는 부가 정보" 방식이다.
  `isToday(dateIso, todayIso)`는 단순 문자열 동등 비교(formatting.ts 줄 64-66)라 사용자가
  날짜를 오늘이 아닌 값으로 바꾸는 즉시(그리고 재계산 시) 배지가 자연스럽게 사라지고
  실제 날짜만 남는다.
- **등급**: 문제없음.

#### Q8. (평가 항목: 일반 사용자가 계산법을 몰라도 사용 가능 / 접근성 — 중점 확인 4) 모드 B의 +/− 방향 토글이 색상만으로 방향을 구분하지 않는가? 실제 라디오 그룹인가? 기본값이 "더하기"인가?
- **근거**: `shiftForm.direction` 초기값은 `"add"`(더하기, 줄 142)이고, `handleShiftReset`도
  다시 `"add"`로 되돌린다(줄 301) — 기본값 요건은 충족한다. 실제 `<input type="radio"
  name="shift-direction">`(줄 584)를 쓰므로 "실제 라디오 그룹" 요건도 충족한다. 그러나
  **선택 상태를 시각적으로 구분하는 유일한 수단이 색상뿐이다**: 선택됨은
  `border-primary bg-primary-soft text-primary`, 선택 안 됨은 `border-border bg-background
  text-muted`(줄 577-581)이며, 라디오 자체는 `className="sr-only"`(줄 589)로 화면에서
  완전히 숨겨져 체크 표시(circle-dot)나 다른 아이콘·굵기·밑줄 변화가 전혀 없다. 즉 텍스트
  ("더하기"/"빼기") 자체는 항상 다르게 표시돼 "무엇을 선택할 수 있는지"는 색맹 사용자도
  알 수 있지만, "지금 어느 것이 선택되어 있는지"를 시각적으로 구분하는 신호는 테두리·배경·
  글자 색상 변화뿐이다. 이는 SPEC.md가 이 토글에 대해 명시적으로 요구한 "색상만으로 선택
  상태를 구분하지 않는다"(Must Have, "접근성·반응형")를 문자 그대로는 충족하지 못한다.
  다만 `bg-primary-soft`가 옅은 배경색 채움 자체를 추가하는 방식이라 완전히 등명도인
  색상 하나만 바뀌는 경우보다는 인지 부담이 낮고, 스크린리더 사용자는 네이티브
  `role="radio"`/`checked` 시맨틱으로 정확한 선택 상태를 인식할 수 있어 실질적 기능 차단은
  없다.
- **등급**: **Medium** — SPEC.md Must Have("색상만으로 선택 상태를 구분하지 않는다")를
  글자 그대로 충족하지 못하는 구체적 지점이며, 체크 아이콘·밑줄·굵기 변화 등 비-색상
  신호를 하나만 추가해도 해결 가능한 개선 여지다. 스크린리더에는 영향 없고 기능이 막히는
  수준은 아니므로 High가 아닌 Medium으로 판단한다.

#### Q9. (평가 항목: 모바일 사용성 — 레이아웃 관점, 접근성 — 중점 확인 5) 탭/세그먼트 UI가 시각적 라디오가 아니라 진짜 `<input type="radio">` 기반이라 키보드로 조작 가능한가?
- **근거**: "계산 모드" 탭(줄 380-387, `name="d-day-mode"`)과 "방향" 토글(줄 584-590,
  `name="shift-direction"`) 모두 실제 `<input type="radio">`이고 같은 `name`으로 그룹화돼
  있어, 브라우저 네이티브 라디오 그룹 동작(Tab으로 그룹에 진입, 방향키로 그룹 내 이동)이
  그대로 적용된다. `ui.test.tsx`가 `screen.getByRole("radio", { name: "날짜 계산" })`로
  이 요소를 실제 `radio` 역할로 조회해 클릭 이벤트를 검증하는데(줄 33, 51, 61), 이는
  Testing Library가 접근성 트리 상에서 이 요소를 진짜 라디오로 인식한다는 것을 방증한다.
  `sr-only`로 라디오 자체는 시각적으로 숨겨지지만 포커스는 여전히 라디오에 위치하므로,
  감싸는 `<label>`에 걸린 `focus-within:ring-2 focus-within:ring-primary
  focus-within:ring-offset-2`(줄 374, 577)가 키보드 포커스 시 시각적 링을 보여준다 —
  키보드 사용자가 현재 포커스 위치를 잃지 않는다.
- **등급**: 문제없음.

#### Q10. (평가 항목: 결과 가독성 — 중점 확인 6) 시작일=목표일(D-Day), 일수=0 같은 "정상이지만 특이한" 케이스가 오류처럼 보이지 않는가?
- **근거**: 두 케이스 모두 `handleDdaySubmit`/`handleShiftSubmit`이 정상적으로
  `calculateDday`/`calculateDateShift`를 호출해 `ddayResult`/`shiftResult`를 채우고,
  렌더링 시 다른 정상 결과와 동일한 `bg-primary`(강조) 카드 스타일로 표시된다(줄 635,
  687) — `text-danger`/`bg-warning-surface` 같은 오류·경고 색상이 전혀 쓰이지 않는다.
  문장도 "…은 시작일과 같은 날입니다."(D-Day, formatting.ts 줄 72), "…에서 0일을 더한
  날짜는 같은 날인 …입니다."(일수=0, 줄 86)로 명시적으로 "정상 결과"임을 서술한다. 또한
  `computeWeeksBreakdown(0)`이 `null`을 반환해(logic.ts 줄 45) D-Day 케이스에서
  "0주 0일 후" 같은 어색하고 혼란스러운 문구가 뜨지 않도록 미리 숨겨진다(FORMULA.md
  "n===0 → 표시하지 않음" 규칙 그대로). FAQ에도 "시작일과 목표일이 같으면 어떻게
  되나요?"/"일수를 0으로 입력하면 어떻게 되나요?" 항목이 별도로 있어(content.ts) 처음
  겪는 사용자의 불안을 사전에 해소한다.
- **등급**: 문제없음.

#### Q11. (평가 항목: 결과 가독성 — 중점 확인 7) 주 단위 환산 표시(Should Have)가 D-day 표기 자체보다 과도하게 부각되어 혼란을 주지 않는가?
- **근거**: 핵심 D-day 라벨은 `text-4xl font-bold ... sm:text-5xl`(줄 639)로 카드에서
  가장 크고 굵은 요소인 반면, 주 단위 환산 문자열(`formatWeeksBreakdown`)은 `mt-2 ...
  text-sm opacity-90`(줄 646)로 문장형 설명(`text-base`, 줄 642)보다도 작고 옅은 글자다.
  즉 시각적 위계가 "라벨(가장 큼) > 문장형 설명 > 주 단위 환산(가장 작고 옅음)" 순으로
  명확히 설계되어 있어, 보조 정보인 주 단위 환산이 핵심 결과보다 부각될 위험이 없다.
- **등급**: 문제없음.

#### Q12. (평가 항목: 오류 메시지의 이해 용이성) `validation.ts`/`logic.ts`의 오류 메시지가 평이한 문구이며 올바른 입력 근처에 `role="alert"`/`aria-describedby`로 연결되는가?
- **근거**: `validation.ts`의 `validateSupportedDateField`(줄 60-74)는 "시작일을 입력해
  주세요.", "올바른 시작일을 입력해 주세요.", "시작일은 1900-01-01부터 2200-12-31까지만
  입력할 수 있습니다." 등 전문 용어 없이 구체적 조건을 평이한 한글로 서술한다. `days`
  검증(줄 121-135)도 "일수를 입력해 주세요.", "일수는 0 이상의 정수로 입력해 주세요.",
  "일수는 100,000일까지 입력할 수 있습니다."로 동일하게 평이하다. `ui.tsx`는 각 오류를
  `role="alert"`(줄 436, 468, 534, 560)와 `aria-describedby`(오류가 있으면 `-error` id,
  없으면 `-help` id로 전환, 줄 420-424 등)로 해당 입력과 연결하고 `aria-invalid`도 함께
  설정한다 — `docs/DESIGN_SYSTEM.md` "접근성" 절 요건과 일치한다. `logic.ts`가 던지는
  방어적 오류(Golden Test #23의 "계산된 날짜(2273-10-16)가 지원 범위(1900-01-01~
  2200-12-31)를 벗어났습니다. 기준일 또는 일수를 다시 확인해 주세요." 등)는
  `handleShiftSubmit`의 catch에서 `shiftErrors.days`로 매핑돼(줄 292-296) 동일하게
  "일수" 필드 아래 `role="alert"`로 노출된다. 이 오류는 실제 원인이 "기준일+일수 조합"일
  수 있는데 "일수" 필드 하나에만 표시되지만, 메시지 본문이 "기준일 또는 일수를 다시 확인해
  주세요"라고 두 필드 모두를 명시적으로 언급해 위치와 무관하게 원인을 오해하지 않도록
  보완한다.
- **등급**: 문제없음(메시지 본문이 이미 두 필드 가능성을 언급해 실질적 혼동 없음).

#### Q13. (평가 항목: 계산 과정(근거 breakdown)을 이해할 수 있는지) "계산 방법" 섹션이 실제 값이 대입된 수식으로 표시되는가?
- **근거**: `buildDdayBreakdown`(formatting.ts 줄 97-112)은 "날짜 차이" 줄에
  `{목표일(요일)} − {시작일(요일)} = {diffDays}일 → {ddayLabel}` 형태로 실제 날짜·요일·
  숫자·라벨을 모두 대입해 보여주고, 주 단위 환산이 있으면 별도 줄로 추가한다.
  `buildDateShiftBreakdown`(줄 115-126)도 "날짜 이동" 줄에 `{기준일} {+/−} {일수}일 =
  {결과일(요일)}` 형태로 실제 값을 대입한다. 두 breakdown 모두 변수명이 아니라 이미 계산된
  실제 값을 보여주므로 "계산법을 몰라도" 대입된 숫자만 보고 "무엇을 어떻게 계산했는지"
  확인할 수 있다. `IntroSection`(D-Day/날짜 계산 개념 설명)과 FAQ가 개념 자체("D-Day가
  무엇인지")까지 보완 설명한다.
- **등급**: 문제없음.

#### Q14. (평가 항목: 모바일 사용성 — 레이아웃 관점) 320px 좁은 화면에서 "날짜 입력 + 오늘로 버튼" 조합이나 결과 카드가 잘리거나 가로 스크롤을 유발할 위험이 코드상 있는가?
- **근거**: 모드 A 시작일, 모드 B 기준일 입력은 각각 `flex gap-2` 컨테이너 안에
  `min-w-0 flex-1`(날짜 입력, `FIELD_CLASS`)과 `shrink-0`(오늘로 버튼,
  `TODAY_BUTTON_CLASS`) 조합으로 배치된다(줄 411-431, 511-529). `shrink-0` 버튼이 고정
  폭을 차지하고 날짜 입력이 `flex-1 min-w-0`으로 나머지 공간을 쓰지만, 네이티브
  `<input type="date">`는 브라우저마다 연-월-일 서브필드를 모두 표시하기 위한 최소 렌더링
  폭이 있어(보통 170~200px대), 320px 폭에서 버튼(패딩 포함 약 60~70px)과 좌우 페이지
  여백(`px-5`)까지 함께 빼면 여유 폭이 빠듯할 수 있다. 이 조합(`날짜 input + 인접 보조
  버튼`)은 코드베이스에서 이 계산기가 처음 도입한 패턴이라(`grep` 결과 "오늘로" 문자열이
  d-day-calculator 외에는 존재하지 않음) 기존에 이미 검증된 선례가 없다. `ShareActions`/
  결과 카드 자체의 긴 텍스트(예: 계산 근거 문장)에는 `break-words`가 없는 요소도 있어
  (`<p className="mt-1 break-words tabular-nums ...">`는 이미 `break-words`를 갖고 있어
  이 부분은 문제 없음) 실제 위험은 주로 "날짜 입력+버튼" 한 줄 배치에 국한된다. 코드
  정독만으로는 실제 렌더링 시 줄바꿈 여부를 확정할 수 없다.
- **등급**: Low — 이 계산기에 새로 도입된 레이아웃 패턴이라 기존 선례로 안전성을 보장할
  수 없으므로, QA가 320px/375px 실기기(또는 브라우저 반응형 도구)에서 시작일·기준일 입력
  행이 잘리거나 줄바꿈되지 않는지 실측 확인할 것을 권장한다.

#### Q15. (평가 항목: 불필요한 UI 요소 존재 여부 / 일반 사용자가 계산법을 몰라도 사용 가능 — Builder가 검토를 요청한 지점) 모드 B의 "오늘 기준 D-Day" 보조 배지가 설명 문장 없이 노출되어 과도한 정보이거나 이해하기 어려운 요소는 아닌가?
- **근거**: `shiftResultTodayDday`가 존재하면 핵심 결과 카드 안에 "오늘 기준
  {ddayLabel}"(예: "오늘 기준 D-45") 한 줄만 추가로 표시된다(줄 697-701, formatting.ts의
  문장 조립 함수를 거치지 않고 `ddayLabel` 원시 값을 그대로 노출). 바로 위에 이미
  `formatDateShiftSentence`로 "{기준일}에서 {일수}일을 {더한/뺀} 날짜는 {결과일}입니다"라는
  완전한 문장이 있어 모드 B의 핵심 질문(그 날짜가 정확히 언제인가)은 이미 평이한 문장으로
  해결된 상태이므로, "오늘 기준 D-45"는 어디까지나 **보충 정보**다. 다만 이 계산기를
  모드 B로 처음 진입해 D-Day 표기 자체를 아직 접해보지 않은 사용자에게는 "D-45"라는
  표기가 무엇을 의미하는지 그 자리에서 설명되지 않는다(같은 페이지 하단 `IntroSection`/
  FAQ가 D-Day 개념을 설명하지만 결과 카드보다 아래에 위치). SPEC.md는 이 배지에 대해
  "기준일이 오늘이 아닐 때도 유용하다"고만 서술했을 뿐 문장형 설명을 요구하지 않았고,
  실제로 핵심 정보 전달(며칠 몇 일)에는 지장이 없으므로 과업 수행을 막는 요소는 아니다.
- **등급**: Low — 기능·과업 완수에는 지장이 없으나, 이 계산기가 모드 A에서는 D-표기에
  항상 문장을 동반시키는 원칙을 세워두고(Q6) 정작 모드 B의 이 보조 배지에서만 그 원칙을
  적용하지 않아 일관성이 다소 아쉽다. "오늘 기준 D-45(45일 후)"처럼 괄호로 짧게 보완하면
  해소 가능한 수준의 개선 여지로 기록한다.

#### Q16. (평가 항목: 입력 라벨·순서 / 불필요한 UI 요소 — DESIGN_SYSTEM 대조) 실제 화면 렌더 순서가 `docs/DESIGN_SYSTEM.md` "공통 화면 순서"(입력→결과→계산근거→소개·사용방법→정책안내→FAQ)와 일치하는가?
- **근거**: `ui.tsx`를 렌더 순서대로 추적한 결과: (1) `<header>`(h1 + 한 문단 소개) → (2)
  모드 선택 `<fieldset>` → (3) 모드별 `<form>`(입력) → (4) `ShareActions` → (5)
  `aria-live="polite"` 결과 영역(핵심 결과 카드 → 요약 SectionCard → "계산 방법"
  SectionCard, 즉 결과 다음에 계산 근거) → (6) `UsageGuide` + `IntroSection`(소개·사용
  방법, 줄 745-748) → (7) "계산 전 확인" SectionCard(정책 안내) + 서버 미전송 안내 → (8)
  `FaqAccordion`. 이는 `docs/DESIGN_SYSTEM.md`가 2026-09-07 `loan-interest-calculator`
  건으로 정정한 최신 "공통 화면 순서"(입력 → 결과 → 계산 근거 → 소개·사용 방법 → 정책
  안내 → FAQ)와 정확히 일치하며, SPEC.md "화면 구성" 절이 명시한 순서(1.모드 선택
  2.입력 3.공유 4.결과 5.계산 근거 6.소개+사용법 7.전제고지+FAQ)와도 일치한다(SPEC.md
  자체도 이미 최신 순서로 작성돼 있어 average-cost-calculator가 겪었던 "SPEC.md 문서가
  구버전 순서로 남아있는" 문제가 이 계산기에는 없다).
- **등급**: 문제없음.

### 발견된 이슈 (등급별)

| 등급 | 개수 | 내용 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 | Q8: 모드 B "방향"(더하기/빼기) 라디오 토글의 선택 상태가 테두리·배경·글자
색상 변화만으로 구분되어 SPEC.md Must Have("색상만으로 선택 상태를 구분하지 않는다")를
문자 그대로 충족하지 못한다(`ui.tsx` 줄 577-590). 스크린리더는 네이티브 라디오 시맨틱으로
정확히 인식하므로 기능 차단은 아니며, 체크 아이콘 등 비-색상 신호 1개 추가로 해소 가능. |
| Low | 2 | 1) Q14: "날짜 입력 + 오늘로 버튼" 인접 배치(`ui.tsx` 줄 411-431, 511-529)가
이 계산기에 처음 도입된 패턴이라 320px 폭에서 잘림·줄바꿈 위험을 코드만으로는 배제할 수
없음(QA 실기기 검증 권장). 2) Q15: 모드 B "오늘 기준 D-Day" 보조 배지(줄 697-701)가
설명 문장 없이 원시 라벨만 노출해, 모드 A에서 확립한 "D-표기는 항상 문장을 동반한다"는
원칙과 일관성이 다소 떨어짐(과업 완수에는 지장 없음). |

### 최종 판정: **PASS**

Critical·High 이슈가 없고, 계산 정확성(Calculation Auditor 영역)은 이미 PASS를 전제로
재검증하지 않았다. 이 계산기 특유의 8개 중점 확인 지점(모드 전환 상태 보존, D-표기 문장
동반, "오늘" 배지, 방향 토글, 탭 키보드 접근성, 특이하지만 정상인 케이스, 주 단위 환산
부각도, DESIGN_SYSTEM 화면 순서·오류 메시지·접근성) 중 7개는 코드 추적과 기존
`ui.test.tsx` 스모크 테스트로 의도대로 구현됐음을 확인했다. Medium 1건(방향 토글의
색상 단독 구분)은 SPEC.md가 이 계산기에 대해서만 명시적으로 요구한 접근성 요건을 문자
그대로 충족하지 못한 구체적 결함이지만, 스크린리더 접근성이나 핵심 기능 수행 자체를
막지는 않으므로 PASS 기준(Critical 0, High 0)에는 영향이 없다. Optimizer가 다음
라운드에서 방향 토글에 비-색상 신호(체크 아이콘 등)를 추가하고, 모드 B 보조 배지에 짧은
설명을 보완하며, QA가 "날짜 입력+오늘로 버튼" 조합을 320px에서 실측 검증할 것을
권장한다.

### 재검증 (Optimizer 수정 후)

**방법**: Edit 권한이 없어 수정된 `ui.tsx`만 직접 정독해(코드 실행·렌더링 없음) Q8·Q15
지점만 재확인했다. 나머지 항목은 이번 변경과 무관하므로 재평가하지 않고, 레이아웃 부작용
여부만 가볍게 확인했다.

**Q8 재검증**: 118-141행에 `SelectedCheckIcon`(인라인 SVG, `aria-hidden="true"`)이
추가됐고, 591-621행 방향 토글에서 `{shiftForm.direction === value && <SelectedCheckIcon />}`
로 **선택된 옵션에만** 조건부 렌더링됨을 확인했다. 기존 색상 클래스(`border-primary
bg-primary-soft text-primary` / `border-border bg-background text-muted`)는 제거되지
않고 그대로 유지된 채 체크마크가 추가 신호로 얹혔다 — 이제 선택 상태가 (a) 테두리·배경·
글자 색상, (b) 체크마크 유무라는 두 개의 독립적 신호로 구분되어 더 이상 "색상만으로
구분"이 아니다. `aria-hidden="true"`이므로 스크린리더에는 중복 정보를 주지 않는다(네이티브
`checked`가 이미 선택 상태를 전달). 두 옵션 모두 `grid-cols-2` 고정 폭이라 아이콘 유무로
버튼 폭이 흔들리지 않음도 확인했다. **등급: 해결됨(문제없음)**.

**Q15 재검증**: 723-727행에 기존 `formatDdaySentence`를 재사용한 문장이 추가됐다 —
"오늘 기준 D-104 · 2026년 12월 25일까지 104일 남았습니다." 형태. 스타일은 모드 A의
보조 정보(주 단위 환산, `mt-2 text-sm opacity-90`)와 동일 클래스를 써서 핵심 문장
(`text-base`)보다 한 단계 낮은 위계로 배치돼 기존 시각 위계와 일관된다. `break-words`가
있어 문장이 길어져도 카드가 깨지지 않는다. 다만 `diffDays===0`인 드문 경우(이동 결과가
정확히 오늘) 재사용된 문장이 "…은 시작일과 같은 날입니다"라는, 모드 B 화면에 없는
"시작일" 용어를 노출해 미세한 표현 아쉬움이 남지만, 바로 앞의 "오늘 기준"이 맥락을 주어
실질적 혼동은 낮다. **등급: 해결됨(문제없음에 가까움) — 잔존하는 드문 edge case 문구는
신규 이슈로 등록하지 않고 참고 기록만 남긴다(정보성, Low 미만)**.

**부작용 점검**: 두 변경 모두 `ui.tsx` 한 파일, 해당 지점에 국한되며 그리드·여백 구조를
바꾸지 않아 기존에 "문제없음"으로 판정한 Q9(라디오 키보드 접근성)·Q11(시각 위계)·
Q14(모바일 레이아웃) 등에 영향이 없다.

**전체 재검증 판정: PASS** — Medium 1건(Q8)·Low 1건(Q15) 모두 해결 확인, 신규 Critical/
High/Medium 이슈 없음.

## Optimizer

**대상**: UX/UI Critic("## UX/UI Critic" 절 Q8·Q15)과 QA(`tasks/d-day-calculator/QA.md`
"UX/UI Critic Medium 1건·Low 2건 — QA 재현 및 독립 등급 판정" 1)·3))이 공통으로 확정한
Medium 1건·Low 1건만 수정했다. 계산 로직(`logic.ts`, `validation.ts`,
`src/lib/date-calc.ts`)은 전혀 건드리지 않았고(`git diff` 대상에 없음), `ui.tsx` 한 파일만
수정했다. 두 보고서가 이미 "재현되지 않음"으로 결론지은 QA 신규 Low(320px "날짜 입력+오늘로
버튼" 잘림 위험, Firefox/Safari 미검증)는 지시 대상이 아니므로 손대지 않았다.

### 1. [Medium] 모드 B "방향"(더하기/빼기) 라디오 토글의 색상 단독 구분 — 수정 완료

- **문제**: `ui.tsx`의 방향 토글(수정 전 줄 577-590 부근)은 선택됨/선택 안 됨을
  `border-primary bg-primary-soft text-primary` ↔ `border-border bg-background text-muted`
  색상 전환만으로 구분했고, 실제 `<input type="radio">`는 `className="sr-only"`로 화면에서
  완전히 숨겨져 있어(체크 표시·아이콘·굵기 변화 없음) SPEC.md Must Have("모드 B의 더하기/
  빼기 방향은 실제 라디오 그룹으로 구현하며 색상만으로 선택 상태를 구분하지 않는다")를 문자
  그대로 위반했다.
- **먼저 확인한 기존 패턴**: `business-days/ui.tsx`의 "스타일 입힌 라디오"(계산 방식 토글,
  줄 68)와 `bmi-calculator`(성별 토글)·`parental-leave-benefit`(적용 유형·배우자 사용 상태
  토글) 전부가 이 계산기와 동일하게 **색상 전환만** 쓰고 있어(`grep`으로
  `border-primary bg-primary-soft` 전수 확인, 9개 파일 모두 동일 패턴), 재사용할 수 있는
  기존 "비-색상 구분 토글" 선례가 코드베이스 어디에도 없음을 먼저 확인했다. 대신
  `docs/DESIGN_SYSTEM.md` "아이콘" 절이 이미 규정한 인라인 SVG 관례(`viewBox="0 0 24 24"`,
  `stroke="currentColor"`, `strokeWidth 1.7~1.8`, 이 계산기 자체의 `SectionIcon`이 이미 그
  관례를 따름)와 DESIGN_SYSTEM.md "접근성" 절이 아코디언에 이미 요구한 원칙("펼침 상태를
  아이콘 회전만이 아니라 `aria-expanded`로도 전달 — 색상/아이콘만으로 상태 표현 금지")의
  취지를 그대로 적용해, "이미 있는 아이콘 언어로 체크마크를 추가"하는 방식을 택했다(작업
  지시가 예시로 든 "체크마크 아이콘" 옵션과 일치, 새 색상·새 컴포넌트 스타일은 추가하지
  않았다).
- **수정 내용** (`src/calculators/d-day-calculator/ui.tsx`):
  1. `TodayBadge` 바로 아래에 `SelectedCheckIcon` 컴포넌트를 새로 추가했다(줄 118-141) —
     `SectionIcon`과 동일한 `viewBox="0 0 24 24"`/`stroke="currentColor"` 관례를 따르는 체크
     아이콘(`<path d="M5 13l4 4L19 7" />`), `aria-hidden="true"`로 스크린리더에는 노출하지
     않는다(실제 선택 상태는 이미 네이티브 `<input type="radio" checked>`가 전달하므로 중복
     알림 방지).
  2. 방향 토글 `<label>`의 className에 `flex items-center justify-center gap-1.5`를 추가해
     아이콘과 라벨 텍스트를 가로로 나란히 배치할 수 있게 했다(기존 `cursor-pointer rounded-xl
     border px-3 py-3 text-center text-sm font-semibold transition
     focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2` 및 선택
     상태별 색상 클래스는 그대로 유지 — 색상 자체를 제거하지 않고 비-색상 신호를
     "추가"했을 뿐이다).
  3. `<input type="radio" ... className="sr-only" />` 바로 다음, `{label}` 바로 앞에
     `{shiftForm.direction === value && <SelectedCheckIcon />}`를 추가했다 — 선택된 옵션에만
     체크 아이콘이 렌더링되고, 선택 안 된 옵션은 텍스트만 남아 레이아웃 폭 변화(체크 아이콘
     자리만큼 좁아지거나 넓어짐)가 없도록 두 옵션 모두 `flex` 컨테이너 폭 자체는 그리드
     `grid-cols-2`로 고정돼 있음을 확인했다.
  - 결과적으로 선택 상태가 이제 (a) 테두리·배경·글자 색상 **그리고** (b) 체크마크 아이콘
    유무라는 두 가지 독립적인 시각 신호로 구분된다 — 색맹·저시력 사용자도 아이콘 유무로
    선택 상태를 알 수 있다.
  - "계산 모드"(디데이 계산/날짜 계산) 탭 토글은 SPEC.md가 색상 단독 구분을 명시적으로 금지한
    대상이 아니고(Must Have 문구가 오직 "모드 B의 더하기/빼기 방향"만 지목) 작업 지시도 이
    토글만 지목했으므로 건드리지 않았다(제약 "이 2건 외의 새 기능/리팩터링을 추가하지
    마라" 준수).

### 2. [Low] 모드 B "오늘 기준 D-Day" 보조 배지의 설명 문장 누락 — 수정 완료

- **문제**: 모드 B 핵심 결과 카드의 보조 배지(수정 전 줄 697-701 부근)가 `오늘 기준
  {ddayLabel}`(예: "오늘 기준 D-104") 형태로 `ddayLabel` 원시 값만 노출했다. 모드 A는 핵심
  결과 카드에서 `ddayLabel` 아래 `formatDdaySentence(ddayResult)` 문장을 조건 없이 항상
  동반시키는데, 모드 B의 이 보조 배지에는 그 원칙이 적용되지 않아 일관성이 떨어진다는
  지적이었다(계산 정확성과 무관, 순수 문구 보완).
- **재사용한 기존 함수**: 새 문구를 짓지 않고 `formatting.ts`의 기존
  `formatDdaySentence(result: DdayCalculationResult): string`을 그대로 재사용했다 —
  `shiftResultTodayDday`(줄 339-346에서 이미 `calculateDday({ startDate: today, targetDate:
  shiftResult.resultDate })`로 계산돼 있던 값)가 정확히 `DdayCalculationResult` 타입이므로
  별도 변환 없이 바로 호출 가능했다. `formatDdaySentence`는 이미 `ui.tsx`에 import돼
  있어(줄 36) 새 import를 추가하지 않았다.
- **수정 내용** (`src/calculators/d-day-calculator/ui.tsx`, 모드 B 핵심 결과 카드): `오늘
  기준 {shiftResultTodayDday.ddayLabel}` 한 줄을 `오늘 기준 {shiftResultTodayDday.ddayLabel}
  · {formatDdaySentence(shiftResultTodayDday)}`로 바꿔, 예를 들어 "오늘 기준 D-104 ·
  2026년 12월 25일까지 104일 남았습니다."처럼 라벨 뒤에 `·` 구분자와 완전한 문장형 설명이
  이어지게 했다. `·` 구분자는 이 파일이 이미 다른 곳(모드 B "일수 · 방향" dt 라벨, 줄
  714)에서 쓰는 표기와 동일해 새 구두점 관례를 만들지 않았다.
  - `diffDays===0`(기준일 계산 결과가 정확히 오늘인 드문 경우, 예: 기준일=어제·일수=1·
    더하기)에는 `formatDdaySentence`가 "…은 시작일과 같은 날입니다."를 반환한다 — 이 경우
    "시작일"이라는 표현이 모드 B 화면 자체에는 없는 용어지만, 배지가 이미 "오늘 기준"이라고
    명시하므로 "시작일 = 오늘"이라는 맥락이 바로 앞 구절에서 주어져 있어 오해 소지는
    낮다고 판단했다(모드 A 문장 조립 함수를 그대로 재사용해 문구 드리프트를 만들지 않는
    이득이 이 드문 edge case의 표현 뉘앙스보다 크다고 판단).

### 회귀 테스트 (수정 후 재실행)

- `npx vitest run`(전체 스위트): **74개 파일, 922개 테스트 전부 통과**(수정 전과 정확히
  동일한 파일·테스트 수 — 회귀 없음). 기존 `ui.test.tsx`의 5개 테스트는 방향 토글의
  className이나 "오늘 기준" 텍스트를 어서션하지 않아 마크업 변경에도 그대로 통과했다(`grep`
  으로 `ui.test.tsx`에 "오늘 기준"/방향 토글 className 문자열이 없음을 사전 확인) — 이번
  수정으로 깨진 기존 어서션은 없어 테스트 파일 자체를 갱신할 필요가 없었다.
- `npx tsc --noEmit`: 오류 0건.
- `npm run build`: Next.js 16.3.4(Turbopack) 프로덕션 빌드 성공, 21개 정적 페이지 생성(기존과
  동일).
- 수정 범위는 `src/calculators/d-day-calculator/ui.tsx` 한 파일뿐이며, `logic.ts`/
  `validation.ts`/`formatting.ts`/`content.ts`/`types.ts`/`src/lib/date-calc.ts`와 각
  테스트 파일은 전혀 수정하지 않았다(계산 결과·검증 규칙에 영향 없음).

### 다음 단계

이 절은 재검증(Calculation Auditor → UX/UI Critic → QA) 결과를 반영하지 않은 Optimizer
자체 기록이다. `docs/EVALUATION.md` 개선 Loop에 따라 Calculation Auditor부터 다시 검증을
받아야 하며, 점수/최종 판정 표는 그 이후에 채운다.

이후 Calculation Auditor·UX/UI Critic·QA 세 역할 모두 재검증(각 섹션의 "### 재검증
(Optimizer 수정 후)" 참고)에서 PASS를 확정했다 — 아래 점수·최종 판정은 그 결과를 반영한다.

## 점수 (오케스트레이터, 2026-09-13)

| 항목 | 배점 | 획득 | 근거 |
|---|---|---|---|
| 계산 정확성 | 35 | **35** | Calculation Auditor PASS(Critical/High/Medium 0) + 재검증 PASS. 프로젝트 코드를 참조하지 않는 독립 Python `datetime`/`calendar` 재계산으로 FORMULA.md 26개 Golden Test·6개 요일 앵커·윤년 100/400년 예외 규칙 전수 재현, Zeller's Congruence 손계산 교차검증, 모드 A↔B 역함수 불변식 8,000회 fuzz 위반 0건. Architect가 지목한 최대 리스크(Golden Test #23 — `days` 상한 통과와 결과 범위 재검증은 별개)를 코드 경로까지 추적해 우회 불가함을 확인. Optimizer 수정(체크마크 아이콘, 문장 추가) 이후에도 `logic.ts`/`validation.ts`/`formatting.ts`/`date-calc.ts` 무변경을 파일 mtime까지 대조해 재확인, Golden Test 26/26 동일 값 유지. |
| 예외/경계값 처리 | 15 | **15** | 지원 범위(1900-01-01~2200-12-31) 상하한 경계 자체가 유효 입력, 존재하지 않는 날짜(2월 30일 등)는 `<input type="date">` 자체가 선차단 + 앱 검증 이중 방어(실브라우저로 확인), 윤년 100/400년 예외(1900 평년/2000 윤년) 정확 처리, 시작일=목표일(D-Day)·일수=0 모두 정상 케이스로 처리, `days` 상한(100,000) 초과 및 상한 통과 후 결과 범위 초과(#23) 양쪽 모두 실제 폼 입력으로 재현해 오류 처리 확인. |
| UX/사용 편의성 | 15 | **14** | UX/UI Critic PASS + 재검증 PASS. Medium 1건(Q8 방향 토글 색상 전용 구분)·Low 1건(Q15 오늘 기준 배지 문장 누락) 모두 재검증에서 해결 확인(체크마크 아이콘 추가로 색상 외 신호 확보, 기존 `formatDdaySentence` 재사용으로 문장 보완). 모드 A/B 상태 완전 보존, D-표기에 항상 문장 동반, "오늘" 배지, D-Day/일수=0 케이스가 오류로 안 보임 등 핵심 UX 요건 전부 실제 렌더로 확인. 재검증에서 발견한 미세한 표현 뉘앙스(재사용 문장이 드문 edge case에서 모드 B 화면에 없는 "시작일" 용어를 씀, 새 이슈로 등록되지 않음)로 −1. |
| 모바일/반응형 | 10 | **9** | QA가 이 프로젝트에서 드물게 실제 headless Chrome/Edge(CDP 직접 구현)로 320/375/390/768/1440px 전 구간 `scrollWidth`/`clientWidth`를 실측해 가로 스크롤 0건을 확인했다 — 코드 치수 계산 추정이 아니라 실제 두 브라우저 엔진 렌더링 결과다. Critic이 지적한 잠재 위험(날짜 입력+"오늘로" 버튼 인접 배치)도 정밀 측정으로 재현되지 않음을 확인. Safari/Firefox 미검증(이 환경의 구조적 한계, 기존 계산기 공통 감점 사유)으로 −1. |
| 접근성 | 5 | **5** | label 연결, `aria-live`, `role="alert"` 상당 처리, 방향 토글이 실제 네이티브 `<input type="radio">`이며 `ArrowRight` 키보드 이벤트로 focus+checked 상태가 함께 이동함을 실제 CDP 테스트로 확인(코드 추론이 아닌 실측), 체크마크 아이콘은 `aria-hidden`으로 스크린리더 중복 없음. |
| 성능/안정성 | 5 | **5** | 실제 headless 브라우저의 CDP `Runtime.consoleAPICalled`/`exceptionThrown` 후킹으로 전체 상호작용 흐름에서 콘솔 에러/경고 0회 확인(프로브 테스트 추정이 아닌 실측), `npx tsc --noEmit` 오류 0, `npm run build` 성공. |
| 설명/계산 근거 | 5 | **5** | 모드 A/B 모두 D-표기·결과 날짜 아래 문장형 설명이 항상 동반(Optimizer 수정으로 모드 B 보조 배지까지 일관성 확보), 계산 근거(실제 값 대입 수식) 제공, FAQ·소개·사용 방법·계산 전제 고지(순수 달력일, Asia/Seoul 기준) 완비. |
| SEO/페이지 완성도 | 5 | **5** | registry 등록(`status: draft`, category `date`, icon `calendar`), `app/calculators/[slug]/page.tsx` 배선, 공통 페이지 구조를 다른 계산기와 동일하게 준수. |
| 코드 품질/유지보수성 | 5 | **5** | `src/lib/date-calc.ts`의 기존 검증된 함수(`parseIsoDateUtc`/`diffDaysUtc`)를 재사용하고 신규 함수(`addDaysUtc`/`weekdayUtc`/`formatIsoDateUtc`)는 기존 계산기를 건드리지 않고 순수 추가만 해 "다섯 번째 중복 구현"을 피했다(Architect 결정). 모드 A/B가 같은 원자 함수를 공유해 역함수 불변식이 구조적으로 보장됨. |
| **총점** | 100 | **98** | |

## 최종 판정

PASS 기준(docs/EVALUATION.md): 총점 92+, 계산정확성 33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0

| 기준 | 결과 |
|---|---|
| 총점 92+ | 98 ✅ |
| 계산 정확성 33/35+ | 35 ✅ |
| Critical 0 / High 0 | Auditor·Critic·QA 전부 최초 판정 + 재검증에서 0 ✅ |
| Golden Test 100% | 26/26 ✅ |
| Console Error 0 / TypeScript Error 0 | ✅ (실제 headless 브라우저 실측 포함) |
| Mobile Critical 0 | ✅ (실제 Chrome/Edge 5개 breakpoint 실측, 가로 스크롤 0건) |

**판정: PASS**
개선 Loop 횟수: 1/5 (Critic Medium 1건 + Low 1건을 Optimizer가 1회 라운드에서 처리, 재검증 전부 PASS)

### 남은 후속 과제 (발행 비차단, 전부 Low 이하)
- 모드 B "오늘 기준" 배지 재사용 문장이 `diffDays===0`인 드문 edge case에서 "시작일"이라는, 모드 B 화면에는 등장하지 않는 용어를 쓴다("오늘 기준"이라는 앞 구절이 맥락을 주므로 실사용 혼동 가능성은 낮음).
- Safari·Firefox 실브라우저 렌더링 미검증(이 환경에 두 브라우저 자동화 도구가 없음 — Chrome/Edge는 실제 CDP로 검증 완료).
- 이 계산기는 정책형이 아니므로 정기 재검토 없음 — 그레고리력 계산 로직 자체의 오류가 발견되거나 지원 날짜 범위 확장이 필요할 때만 재검토.
