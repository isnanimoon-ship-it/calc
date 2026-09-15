# ARCHITECTURE: 최저임금·시급↔월급 계산기 (minimum-wage-calculator)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-14.
계산 공식 자체(월 환산 시간 산식, 반올림 정책, 최저임금 비교식)는 정의하지 않는다
(Formula Analyst 소관) — 이 문서는 그 공식을 "그대로 구현 가능한 구조"로 옮기는 작업만
한다.

관련 문서: `docs/ARCHITECTURE.md`, `docs/CALCULATOR_RULES.md`, `docs/DESIGN_SYSTEM.md`.
참고 선례: `tasks/weekly-holiday-allowance/ARCHITECTURE.md`(주휴시간 산식, `laborStandards`
스키마, `APPLICABLE_RATE_YEAR` 패턴), `tasks/annual-leave-allowance/ARCHITECTURE.md`(raw/
display 분리, 정책 데이터를 계산기 전용으로 두지 않는 판단, 문서 형식), `tasks/loan-
interest-calculator/ARCHITECTURE.md` / `src/calculators/business-days/types.ts`(discriminated
union 설계), `docs/ARCHITECTURE.md` "계산 로직 공용화" 절(`src/lib/date-calc.ts`,
`src/lib/social-insurance.ts` 추출 기준).

---

## v2 개정 (2026-09-14) — FORMULA.md v2(Calculation Auditor "공식 재검토 요청" 반영) 대응

### 배경 요약

`tasks/minimum-wage-calculator/FORMULA.md`가 v1→v2로 개정됐다. 핵심 변경: 월 환산 시간
(`monthlyEquivalentHours`)을 **정수로 반올림한 뒤 곱하던 정책(v1, 예: `209`시간)을 폐기**하고,
**소수 둘째 자리까지 유지하는 정밀값 정책(v2, 예: `208.57`시간)**으로 교체했다. 근거는
Calculation Auditor가 고용노동부 실시간 최저임금 판정 도구(`moel.go.kr` `wageResultNew()`)의
실제 배포 코드가 정수 반올림을 쓰지 않고 `toFixed(2)`만 적용한다는 것을 확인했고, 이 정책
불일치가 실제 월급(예: 2,154,000원) 사례에서 "위반/정상"이 뒤바뀌는 반례를 만든다는 것을
증명했기 때문이다(`EVALUATION.md` "Calculation Auditor" 절, "우선순위 항목 2").

이번 라운드에서 Architect가 실제로 변경한 파일은 **`src/calculators/minimum-wage-calculator/
types.ts` 하나뿐**이다. `logic.ts`/`formatting.ts`/`validation.ts`/`content.ts`/`ui.tsx`와
테스트 파일들은 이번 라운드에서 건드리지 않았다(Builder 몫, 아래 "체크리스트" 참고).
`rates-2026.json`도 이번에도 수정하지 않았다(아래 "5.").

### 1. types.ts 실제 변경 내용

1. **`monthlyEquivalentHours` JSDoc 전면 갱신** — "정수(예: `209`)로 반올림"이라는 v1 서술을
   "소수 둘째 자리(예: `208.57`)까지 반올림"으로 교체하고, 이 필드가 **더 이상 항상 정수가
   아니라는 점**을 명시했다. "표시=계산 단일값" 원칙(아래 "2.")은 그대로 유지된다는 점도
   함께 기록했다.
2. **`minWageMonthlyEquivalent` JSDoc 갱신** — v1에서는 `round()`가 "정수×정수라 사실상
   무연산"이었지만, v2에서는 **실질적으로 반올림이 필요한 연산**이 된다는 점을 명시했다(아래
   "3.").
3. **신규 필드 `minimumWageJudgmentMismatch: boolean` 추가** — `hourlyMeetsMinimumWage !==
   monthlyMeetsMinimumWage`. FORMULA.md v2가 "이번 정책 변경으로 해소되지 않는다"고 못박은
   이중 배지 불일치(EVALUATION.md 항목 6)를 UI가 구조적으로 다룰 수 있게 하는 파생 플래그다
   (아래 "4.").

### 2. raw/display 분리 원칙 재검토 결론 — **원칙 자체는 v1과 동일하게 유지된다**

작업 지시가 던진 핵심 질문("정밀값 자체가 표시값이자 계산값이 됐으니 raw/display 분리를
버려야 하는가")에 대한 답은 **아니다, 그대로 유지한다**이다. 이유는 FORMULA.md v2를 정확히
읽으면 이 개정이 만든 것이 "raw와 display를 합친 것"이 아니라 "raw와 display 사이의
반올림 자릿수를 바꾼 것"이기 때문이다.

- v1·v2 공통으로 실제로는 **2계층 구조**가 있었다: (a) 완전 무한정밀값
  `monthlyEquivalentHoursExact`(예: `208.571428571...`, 순환소수) — logic.ts 내부 지역
  변수로만 존재하고 어떤 출력에도 노출되지 않는다. (b) 그 값을 반올림한 **단일 공용값**
  `monthlyEquivalentHours` — 화면 표시와 모든 후속 계산(환산·비교) 양쪽에 동일하게 쓰인다.
- v1은 (b)를 "정수로" 반올림했고, v2는 (b)를 "소수 둘째 자리로" 반올림한다 — **바뀐 것은
  (b)를 만드는 반올림 함수(정수 `round` → `round2`)뿐, (a)를 아예 만들지 않거나 노출하는
  방식으로 바뀐 것이 아니다.**
- FORMULA.md v2가 말하는 "화면에 보이는 값과 계산에 쓰이는 값이 일치해야 한다"는 투명성
  요구는 정확히 (b) 하나만 쓰는 기존 raw/display 분리 설계가 **원래부터 만족시키던 성질**이다
  (v1도 "표시=계산"이었다, 단지 그 공통값이 정수였을 뿐). 오히려 v2가 폐기한 "옵션 A"(표시는
  약 209시간, 비교 판정에만 정밀값)야말로 raw/display를 **잘못 분리**해서 문제가 생긴
  사례였다 — 이건 이 계산기가 채택한 raw/display 분리(무한정밀 vs 반올림된 단일 공용값)와는
  다른 종류의 "분리"(반올림 자릿수가 다른 두 개의 공용값)였다.
- **결론: `monthlyEquivalentHoursExact`를 `types.ts`에 노출하지 않는다는 결정은 그대로
  유지한다.** 이번 라운드에서 이 필드를 타입에 추가하지 않았다 — Golden Test가 무한정밀값
  자체를 검증해야 하면 v1과 동일하게 `calculateMonthlyEquivalentHoursExact` 헬퍼를 직접
  호출한다.

### 3. 반올림 시점 재확인 — `minWageMonthlyEquivalent`의 `round()`가 v2부터 "진짜 연산"이 된다

현재 `logic.ts` 154행은 다음과 같다(v1 상태, 아직 미수정):

```ts
const minWageMonthlyEquivalent = minWageHourly * monthlyEquivalentHours;
```

v1에서는 `minWageHourly`(정수)와 `monthlyEquivalentHours`(v1: 항상 정수)의 곱이 항상
정수였으므로 `round()`를 아예 호출하지 않아도 결과가 우연히 정수였다. **v2에서
`monthlyEquivalentHours`가 소수 둘째 자리를 가지면 이 곱이 대부분 소수(예:
`10,320 × 208.57 = 2,152,442.4`)가 된다** — Builder는 이 줄을
`Math.round(minWageHourly * monthlyEquivalentHours)`로 반드시 고쳐야 한다(FORMULA.md v2
"최종 표시 반올림" 절, 위 "1.2"). `convertedMonthlyPay`/`convertedHourlyWage`는 이미
`Math.round(...)`를 쓰고 있어 이 두 줄 자체는 변경이 필요 없다 — 곱해지는
`monthlyEquivalentHours`의 정밀도만 달라질 뿐 반올림 호출 구조는 그대로다.

`calculateMonthlyEquivalentHours` 함수 본문(`Math.round(calculateMonthlyEquivalentHoursExact(...))`)
도 정수 반올림에서 소수 둘째 자리 반올림으로 바꿔야 한다(예:
`Math.round(x * 100) / 100`, 또는 `Number(x.toFixed(2))`). **부동소수점 주의**: 두 방식
모두 특정 경계값(예: `x`가 정확히 `*.*x5`로 끝나는 경우)에서 이진 부동소수점 표현 오차로
아주 드물게 예상과 다른 반올림 방향이 나올 수 있다 — 이 계산기의 `weeklyHours` 유효 범위
(1~168, 0.5 단위 UI 힌트)에서 실제로 문제가 되는 값이 있는지는 Builder가
`calculateMonthlyEquivalentHours`에 대한 별도 부동소수점 회귀 테스트로 확인할 것을 권고한다
(정확한 반올림 함수 구현·부동소수점 방어는 Architect 권한 밖의 구현 세부사항이므로 강제하지
않는다).

### 4. 이중 배지 불일치(EVALUATION.md 항목 6) 처리 방안

FORMULA.md v2 결론(재확인): 반올림 자릿수를 바꿔도 이 불일치 구간의 폭(`M/2`)은 거의 줄지
않는다(104개 → 103개). 이 문제는 FORMULA.md 권한 밖이며 "UX/Architect가 재설계"하라고
명시적으로 위임됐다.

- **채택한 대응(최소 침습)**: `types.ts`에 `minimumWageJudgmentMismatch` 파생 플래그를
  추가해, `ui.tsx`가 이 값이 `true`일 때만 "시급 기준 판정과 월급 기준 판정이 다른 이유"를
  설명하는 문구를 조건부로 보여줄 수 있게 한다. 계산값 자체(핵심 카드가 어떤 배지를
  기준으로 삼는지 — HOURLY 모드는 `monthlyMeetsMinimumWage`, MONTHLY 모드는
  `hourlyMeetsMinimumWage`)는 이번 라운드에서 바꾸지 않는다.
- **왜 더 큰 재설계(EVALUATION.md 옵션 (a), "핵심 카드 배지를 두 판정 모두 고려해 재정의")를
  택하지 않았는가**: 그 변경은 이 계산기의 핵심 결과 카드가 "무엇을 강조해서 보여줄지"에
  대한 제품 설계 자체를 바꾸는 것이라, 이번 v2 개정의 범위("반올림 정책 변경에 따른 값
  재계산")를 벗어난다고 판단했다. 최소한 사용자가 "왜 화면에 상반된 배지가 동시에 보이는지"를
  이해할 수 있게 하는 설명 문구 추가가, 이번 라운드에서 결정할 수 있는 범위 안의 안전한
  대응이다. 더 근본적인 재설계가 필요한지는 UX/UI Critic이 실제 화면에서 재검토할 것을
  권고한다(EVALUATION.md도 이미 "Medium, UX/설계 이슈"로 남겨 뒀다).
- **Builder 구현 지침**: `calculateFromHourlyWage`/`calculateFromMonthlyWage` 각각이
  `hourlyMeetsMinimumWage`/`monthlyMeetsMinimumWage`를 확정한 직후
  `minimumWageJudgmentMismatch: hourlyMeetsMinimumWage !== monthlyMeetsMinimumWage`를 계산해
  반환 객체에 포함한다. `formatting.ts`에 `buildBelowMinimumWageWarning`과 같은 층위의 조립
  함수(예: `buildJudgmentMismatchNotice(result)`)를 추가해 안내 문구를 만들고, `ui.tsx`
  456~484행 "시급·월급 비교" `SectionCard` 안(또는 그 직후)에 `result.minimumWageJudgmentMismatch`
  가 `true`일 때만 이 문구를 노출할 것을 권고한다(새 공용 컴포넌트로 승격하지 않는다 — 이
  계산기 하나에만 등장하는 안내이므로 기존 "카드 안 조건부 문구" 패턴 재사용).

### 5. `rates-2026.json` 재검토 — 이번에도 신규 필드 추가 없음(v1 결정 유지)

FORMULA.md v2 "정책 데이터 요구사항" 절은 `minimumWage.monthlyReference`(선택 필드)의
`note`/`actualComputedNote` 문구를 강화하자고 제안했다. 그러나 ARCHITECTURE.md v1 "6."이
이미 이 필드 자체를 **추가하지 않기로 결정**했으므로, "문구를 강화하자"는 제안은 애초에
적용할 대상이 없다 — 스키마 변경을 요구하는 근거로 보지 않는다.

- v1 "6."의 근거(파생값이라 SSOT 위반, 매년 갱신 시 드리프트 위험, 캐싱 불필요, FAQ는
  정적 카피로 충분)는 v2에서도 전부 그대로 유효하다.
- 오히려 v2는 이 결정을 **사후적으로 더 강하게 뒷받침한다**: v1 시점에는 "40시간 기준
  참고값"(2,156,880원)이 계산기의 실제 계산 결과와 우연히 같았지만, v2부터는 실제 계산
  결과(2,152,442원)와 참고값이 **항상 다르다**. 만약 이 참고값을 데이터 필드로 저장해
  뒀다면, 그 필드 자체가 "계산기의 실제 계산값"으로 오인되어 로직에 잘못 흘러들어갈 위험이
  v1보다 커진다 — 애초에 데이터 파일에 존재하지 않으므로 이 위험 자체가 없다.
- **반올림 정밀도(소수 둘째 자리)라는 상수도 데이터 파일에 넣지 않는다.** 이 값은
  `housing-acquisition-tax`의 "10원 절사"처럼 이 계산기 고유의 반올림 규칙이지, 여러
  계산기가 공유하거나 독립적으로 고시되는 정책값이 아니다 — 기존 관례(계산기 고유 반올림
  규칙은 로직 코드 상수로 취급)를 그대로 따른다. Builder는 `logic.ts` 내부에 `round2` 같은
  이름의 로컬 헬퍼를 두면 된다.
- **결론: `rates-2026.json`은 v2에서도 수정하지 않는다.**

### 6. 부수 확인 — 0 붕괴 임계값(ARCHITECTURE.md v1 "4.")이 v2에서 오히려 더 안전해진다

v1 "4."가 발견한 버그(`monthlyEquivalentHours`가 극단적으로 작은 `weeklyHours`에서 반올림에
의해 `0`으로 무너지는 문제)의 임계값을 v2 기준으로 다시 계산했다. v1(정수 반올림)의 임계값은
`monthlyEquivalentHoursExact >= 0.5`(⇔ `weeklyHours ⪆ 0.096`)였다. v2(소수 둘째 자리
반올림)는 `monthlyEquivalentHoursExact >= 0.005`만 있으면 `0.00`으로 무너지지 않는다
(⇔ `weeklyHours ⪆ 0.00096`) — 임계값이 약 **100배 낮아져(더 안전해져)** `MIN_WEEKLY_HOURS=1`
과의 안전 여유가 기존 약 10배에서 약 1,000배로 커졌다. **`validation.ts`의
`MIN_WEEKLY_HOURS=1` 하한은 변경할 필요가 없다** — v1의 안전장치가 v2에서도 여전히
(오히려 더 넉넉하게) 유효하다.

### 7. Builder 인계 체크리스트

**tsc 컴파일 에러(실제 실행 결과, 2026-09-14 `npx tsc --noEmit`)** — types.ts 변경만으로
발생한 에러는 정확히 2개이며, 둘 다 신규 필수 필드 `minimumWageJudgmentMismatch` 누락이다:

```
src/calculators/minimum-wage-calculator/logic.ts(186,3): error TS2322:
  Type '{ mode: "HOURLY"; ... }' is not assignable to type
  'MinimumWageComparisonBase & { mode: "HOURLY"; convertedMonthlyPay: number; }'.
  Property 'minimumWageJudgmentMismatch' is missing in type '{ ... }'
  but required in type 'MinimumWageComparisonBase'.

src/calculators/minimum-wage-calculator/logic.ts(212,3): error TS2322:
  Type '{ mode: "MONTHLY"; ... }' is not assignable to type
  'MinimumWageComparisonBase & { mode: "MONTHLY"; convertedHourlyWage: number; }'.
  Property 'minimumWageJudgmentMismatch' is missing in type '{ ... }'
  but required in type 'MinimumWageComparisonBase'.
```

**중요 — tsc가 잡아주지 않는 변경이 훨씬 더 많다.** TypeScript의 `number` 타입은 정수와
소수를 구분하지 않으므로, "정수 반올림 → 소수 둘째 자리 반올림"이라는 이번 개정의 본론은
**컴파일 에러로 드러나지 않는다.** `npx vitest run --no-file-parallelism`을 그대로
실행하면 90개 파일·1,267개 테스트가 **전부 통과한다**(이번 라운드는 `logic.ts`를 건드리지
않았으므로 아직 v1 로직 그대로이기 때문이다 — 착시에 주의). Builder는 아래 항목을 tsc/vitest
결과와 무관하게 직접 확인·수정해야 한다:

1. `logic.ts`
   - `calculateMonthlyEquivalentHours`: `Math.round(...)` → 소수 둘째 자리 반올림
     (`round2`)으로 교체(위 "3.").
   - `computeSharedComparison`의 `minWageMonthlyEquivalent = minWageHourly *
     monthlyEquivalentHours` 줄에 `Math.round(...)` 명시적으로 추가(위 "3." — 현재 이 줄엔
     반올림 호출이 전혀 없다).
   - `calculateFromHourlyWage`/`calculateFromMonthlyWage` 각각에
     `minimumWageJudgmentMismatch: hourlyMeetsMinimumWage !== monthlyMeetsMinimumWage`
     추가(위 tsc 에러 2건 해소, "4.").
2. `formatting.ts`
   - 헤더 주석의 "금액 필드는 logic.ts가 이미 정수로 반환한다"는 가정은 위 1번을 지키면
     v2에서도 그대로 유효하다(금액 필드는 여전히 정수) — 이 부분은 다시 쓸 필요 없다.
   - 다만 68~70행(`월 환산 시간` breakdown 행)·78행·84행이 `result.monthlyEquivalentHours`를
     `formatHours()`를 거치지 않고 `${result.monthlyEquivalentHours}시간` 템플릿 리터럴로
     그대로 출력한다 — v2에서 이 값이 소수를 가지면 부동소수점 표현 오차(예:
     `208.57000000000001`)나 후행 0 생략으로 인한 들쭉날쭉한 자릿수(정수로 딱 떨어지는
     `weeklyHours` 조합은 "209"처럼, 아닌 경우는 "208.57"처럼 표시)가 그대로 노출될 위험이
     있다. `formatHours(result.monthlyEquivalentHours)`로 통일하거나 `toFixed(2)` 고정
     표시를 적용할지 검토할 것.
   - `buildJudgmentMismatchNotice` 신규 함수 추가 검토(위 "4.").
3. `validation.ts` — 변경 불필요(`MIN_WEEKLY_HOURS=1` 유지, 위 "6.").
4. `content.ts` — FORMULA.md v2 FAQ 1·2 답변, 소개 문구(이미 v2로 갱신된 원문, FORMULA.md
   "FAQ 콘텐츠"·"소개 문구" 절)를 그대로 옮긴다. 기존 v1 텍스트("약 209시간, 2,156,880원"만
   언급)는 v2 문구("208.57시간·2,152,442원과의 차이 설명 포함")로 교체해야 한다.
5. `ui.tsx` — 모드 전환·체이닝 방지 등 기존 구조는 변경 없음. `minimumWageJudgmentMismatch`
   조건부 안내 문구만 추가(위 "4.").
6. 테스트 전면 재구현 — FORMULA.md v2 "검증 예제"(총 **20개**: A1~A3, B1~B4, C1~C2, D1~D2,
   E1, F1~F8 — B4가 신규)를 golden 값으로 삼는다.
   - `logic.test.ts`: 로직 레벨 11개(A1~A3, B1~B3, **B4 신규**, C1~C2, D1~D2, E1) 기댓값을
     전부 v2 값으로 교체(예: A1의 `convertedMonthlyPay` `2,156,880` → `2,152,442`). A1↔B1
     교차검증 테스트의 입력값(B1의 `monthlyWage`)도 `2,152,442`로 갱신.
   - `formatting.test.ts` — breakdown 행의 기대 문자열(예: "209시간" 포함 여부) 갱신.
   - `validation.test.ts` — 입력 검증 자체는 FORMULA.md "예외" 절 그대로라 F1~F8 케이스는
     변경 없음(값 무관 오류 케이스이므로). `MIN_WEEKLY_HOURS` 관련 경계 테스트도 위 "6."에
     따라 변경 불필요.
   - `logic.shared-import.test.ts` — 주휴시간 산식 자체는 v1·v2 공통이라 변경 없음.
7. Builder 완료 후 `npx tsc --noEmit`(에러 0건이어야 함) · `npx vitest run
   --no-file-parallelism`(전체 스위트 통과) 재확인, 그 다음 Calculation Auditor 재검증
   (`EVALUATION.md` "Calculation Auditor" 절 결론: "그 전까지 이 계산기는 QA 단계로
   진행하지 않는다").

---

## 0. 레지스트리 상태 / 이번 라운드 산출물

`src/calculators/registry.ts`에 `minimum-wage-calculator` slug는 아직 없다(SPEC.md
"슬러그/카테고리"의 중복 확인과 일치). **이번 라운드에서도 등록하지 않는다** —
`housing-acquisition-tax`·`d-day-calculator`·`national-pension-benefit-estimate`·
`bmr-calculator`·`annual-leave-allowance` Architect 라운드가 확립한 최근 관례(등록은
Builder 구현 완료 후)를 그대로 따른다.

이번 라운드에서 실제로 변경/작성한 파일:
1. **`src/lib/labor-standards.ts`(신규)** — `weekly-holiday-allowance`와 공유하는 주휴시간
   산식 순수 함수(아래 "1.").
2. **`src/calculators/weekly-holiday-allowance/logic.ts`(리팩터링)** — 위 공유 함수를
   호출하도록 수정. 로직은 한 글자도 바꾸지 않았다(순수 이동). 회귀 없음을 전체 테스트
   스위트로 확인(아래 "8.").
3. **`src/calculators/minimum-wage-calculator/types.ts`(신규)** — 입력/결과 타입 전체
   확정(아래 "2."~"5.").
4. `src/data/rates-2026.json`은 **수정하지 않았다** — 신규 필드를 추가하지 않기로 결정했다
   (아래 "6.").
5. 이 문서.

`logic.ts`/`validation.ts`/`formatting.ts`/`content.ts`/`ui.tsx`는 아직 없다(Builder 몫).

---

## 1. weekly-holiday-allowance와의 코드 공유 — `src/lib/labor-standards.ts`로 추출한다

### 1.1 결론

FORMULA.md가 "새로 조사하지 않고 그대로 재사용한다"고 명시한 주휴시간 산식
(`weeklyHolidayHours = min(weeklyHours/40*8, 8)`)을 **`src/lib/labor-standards.ts`의
`calculateWeeklyHolidayHours(weeklyHours, statutoryWeeklyHours, statutoryDailyHours)`로
추출해 두 계산기가 같은 구현을 import해 쓴다.** `weekly-holiday-allowance/logic.ts`도 이번
라운드에서 즉시 이 함수를 쓰도록 리팩터링했다(뒤로 미루지 않음 — `date-calc.ts` 추출
선례와 동일한 절차).

### 1.2 이 프로젝트의 기존 원칙과 충돌하지 않는가 — "계산기 전용 로직은 로컬에 둔다"는
반복된 선례(housing-acquisition-tax 10원 절사, annual-leave-allowance date-utils.ts)와
비교

작업 지시가 정확히 지적한 대로, 이 프로젝트는 지금까지 "계산기 전용 로직은 로컬에 둔다"는
판단을 여러 번 반복해 왔다. 그런데도 이번엔 공유가 맞다고 판단한 이유는, 그 선례들이
전부 **"겉보기엔 같아 보이지만 실제로는 알고리즘/정책이 다르거나(annual-leave-allowance
의 clamp 발산), 그 계산기 하나에만 등장하는 절사 규칙(housing-acquisition-tax 10원
절사)"**이었기 때문이다. 이번 사례는 그 반대다.

- **annual-leave-allowance가 `date-calc.ts` 기존 함수를 재사용하지 않은 이유**는 "이름은
  비슷하지만 실제 clamp 알고리즘이 달라 조용히 틀린 값을 낸다"는 것이었다(월말·윤년
  경계에서 발산). 이번 사례는 정반대다 — `weekly-holiday-allowance`와 이 계산기가 쓰는
  주휴시간 산식은 **완전히 동일한 수식, 완전히 동일한 상수(40시간·8시간), 완전히 동일한
  법적 근거**(근로기준법 제55조제1항·시행령 제30조제1항·시행령 별표2 제4호)다. FORMULA.md
  자신이 "재조사하지 않는다"고 명시한 것도 이 동일성을 전제로 한다. 발산 위험이 있는
  로직을 억지로 합치는 것과, 이미 완전히 같은 로직을 두 곳에 복붙해 두는 것은 다른
  문제다 — 후자만 드리프트 위험이 실재한다.
- **housing-acquisition-tax의 10원 절사**는 그 세목(취득세·지방교육세·농특세) 계산에만
  등장하는 표시 단계 규칙이라 다른 계산기가 재사용할 근거가 없었다(`docs/ARCHITECTURE.md`
  "정책 데이터를 언제 계산기 전용 policy.ts에 두는가"의 판단 기준 — "이 값을 다른
  계산기가 재사용할 근거가 실제로 있는가"). 반면 주휴시간 산식은 **지금 당장 두 계산기가
  동시에 필요로 한다**(annual-leave-allowance의 `calendarFullYearsBetweenUtc` 사례처럼
  "미래에 필요할 수도 있는" 잠재적 재사용이 아니라, 이번 라운드에 실제로 발생한 확정적
  재사용이다).
- **결론**: `docs/ARCHITECTURE.md`가 "날짜 계산 유틸 공용화"·"4대 보험 근로자 부담분
  공용화"에서 확립한 일반 기준 — **"두 계산기가 동일한 법적 정의를 공유하는 순수
  계산이면 도메인이 날짜든 금액이든 `src/lib/`로 추출한다"** — 을 그대로 적용하는 것이
  이번 사례의 올바른 판단이다. "로컬에 둔다"는 원칙은 기본값이지, 절대 규칙이 아니다 —
  이 프로젝트가 이미 두 차례(날짜, 금액) 예외를 인정했고, 이번이 세 번째(시간/시수) 예외다.

### 1.3 왜 함수가 `rates-{year}.json`을 직접 읽지 않고 매개변수로 받는가

`src/lib/social-insurance.ts`는 `rates2026`을 직접 import해서 쓰지만, 이 함수는
그렇게 하지 않는다.

- **차이**: `social-insurance.ts`를 쓰는 두 계산기(`four-major-insurance`,
  `annual-salary-take-home-pay`)는 지금 시점에 이미 **똑같이 2026년 데이터 하나만**
  지원한다 — 직접 import가 자연스러웠다. 반면 이 함수를 쓰는 두 계산기는 각자 독립적인
  `APPLICABLE_RATE_YEAR` 상수·`RATES_BY_YEAR` 맵을 갖고 있고(아래 "7."), 향후 한쪽만
  먼저 `rates-2027.json`으로 갱신되는 과도기가 충분히 생길 수 있다(실제로 최저임금은
  연 1회 1월 갱신, weekly-holiday-allowance와 minimum-wage-calculator가 반드시 같은
  타이밍에 배포된다는 보장이 없다).
- 이 함수 자체는 **"두 수를 나누고 곱해서 상한을 씌우는" 순수 산술**이라 어떤 연도 데이터를
  쓰든 의미가 달라지지 않는다 — `src/lib/date-calc.ts`가 지켜온 "도메인 의미 없는 순수
  산술만 담는다, 데이터/정책 조회는 호출부에 남긴다"는 원칙과 정확히 같은 이유로, 데이터
  조회 책임은 각 계산기의 `logic.ts`에 그대로 남겼다.

### 1.4 회귀 확인

- `weekly-holiday-allowance/logic.ts`의 기존 계산식(`Math.min((weeklyHours /
  statutoryWeeklyHours) * statutoryDailyHours, statutoryDailyHours)`)을 **한 글자도
  바꾸지 않고** `calculateWeeklyHolidayHours` 함수 본문으로 그대로 옮겼다. 호출부는
  동일한 인자 3개를 그대로 전달하는 얇은 wrapper 형태다.
- `npx tsc --noEmit`: 클린.
- `npx vitest run --no-file-parallelism`: **86개 테스트 파일 · 1,199개 테스트 전부
  통과**(리팩터링 전후 회귀 없음 — `weekly-holiday-allowance/logic.test.ts`의 7개 Golden
  Test + Edge Case 전부 포함).
- `src/calculators/weekly-holiday-allowance/`의 다른 파일(`types.ts`/`validation.ts`/
  `formatting.ts`/`ui.tsx`)은 전혀 건드리지 않았다.

### 1.5 minimum-wage-calculator가 이 함수를 쓰는 방식(Builder 지침)

```ts
// src/calculators/minimum-wage-calculator/logic.ts (Builder 작성)
import { calculateWeeklyHolidayHours } from "@/src/lib/labor-standards";

const weeklyHolidayHours = calculateWeeklyHolidayHours(
  weeklyHours,
  rates.laborStandards.statutoryWeeklyHours.value, // 40
  rates.laborStandards.statutoryDailyHours.value,  // 8
);
```

- **월 환산 계수(`× 365/84`) 자체는 공유 함수로 추출하지 않는다.** `weeklyPaidHours *
  daysPerYear / (monthsPerYear * daysPerWeek)`는 이미 `rates-2026.json`의
  `laborStandards.monthlyWeekFactor` 세 필드로부터 나온 한 줄짜리 산술이고, 각 계산기가
  이 값을 쓰는 방식이 서로 다르다(weekly-holiday-allowance는 **금액**에 반올림 없이
  적용, 이 계산기는 **시간**에 적용한 뒤 즉시 반올림해 그 결과를 재사용 — 반올림 시점
  자체가 다르다). 한 줄짜리 산술을 함수로 감싸는 것은 오히려 간접 참조만 늘릴 뿐 드리프트
  방지 효과가 크지 않다("짧고 독립적인 연산이면 굳이 추출하지 않는다",
  `docs/ARCHITECTURE.md` "결정 사례: `logic/` 디렉터리 분할 기준 재확인"과 같은 계열의
  판단). 계수 자체(365/84)의 SSOT는 이미 `rates-2026.json` 데이터 파일이 담당한다.

---

## 2. 모드(HOURLY/MONTHLY) discriminated union 설계

`src/calculators/minimum-wage-calculator/types.ts`에 이미 확정했다(아래는 요약, 상세
근거는 타입 파일의 JSDoc 참고).

- **입력**: `HourlyModeInput | MonthlyModeInput`(`mode`가 판별 태그) — `business-days`의
  `RangeInput | OffsetInput` 패턴을 그대로 따른다. 필드 이름 자체가 다르다
  (`hourlyWage` vs `monthlyWage`) — 이것이 "3. 체이닝 금지" 방어의 일부가 된다(아래).
- **결과**: `MinimumWageCalculatorResult = (Base & {mode:"HOURLY"; convertedMonthlyPay})
  | (Base & {mode:"MONTHLY"; convertedHourlyWage})`. 공통 필드는
  `MinimumWageComparisonBase`(비공개) 교차 타입으로 합성 — `LoanCalculationBase`와
  동일한 반복 제거 패턴.
- **왜 판별 유니온인가(optional 필드 두 개 방식을 쓰지 않은 이유)**: `convertedMonthlyPay`/
  `convertedHourlyWage`는 "둘 다 있을 수도 없을 수도 있는 독립 조건"이 아니라 "정확히
  하나만 존재해야 하는 상호배타 값"이다 — `housing-acquisition-tax`의 4구간,
  `loan-interest-calculator`의 상환방식 3종과 같은 논리다. optional 필드 방식이었다면
  `result.mode` 확인 없이 `result.convertedHourlyWage`에 접근해도 컴파일이 통과해
  `undefined` 렌더링 버그가 컴파일 타임에 잡히지 않는다.
  - `bmr-calculator`의 `tdee?`/`annual-leave-allowance`의 `allowance?`처럼 "선택적으로
    존재하는 부가 정보"였다면 optional 필드가 맞았겠지만, 여기서는 "둘 중 하나가 항상,
    무조건 존재"하므로 그 패턴이 아니라 discriminated union 쪽이 맞다.
- **`displayHourlyWage`/`displayMonthlyPay`(공통 필드)와 `convertedMonthlyPay`/
  `convertedHourlyWage`(분기 전용 필드)가 값이 겹치는 것은 의도적이다.** FORMULA.md
  "출력값" 표가 네 필드를 전부 별도로 정의했고, 용도가 다르다 — `display*`는 "모드와
  무관하게 항상 시급 한 줄·월급 한 줄을 보여주는 비교/breakdown 로직"에, `converted*`는
  "SPEC이 요구하는 핵심 결과 카드가 정확히 무엇을 강조해야 하는지"에 각각 쓰인다(아래
  "9. UI 레이아웃" 참고). logic.ts는 이 네 값을 **각 모드 분기 안에서 한 번에 함께
  확정**해야 한다(예: HOURLY 분기에서 `convertedMonthlyPay`를 계산한 직후
  `displayMonthlyPay = convertedMonthlyPay`, `displayHourlyWage = hourlyWage`로 대입 —
  별도 재계산 금지, 아래 "3.").

---

## 3. "환산값 재입력(체이닝) 금지"를 구조로 강제하는 방법

FORMULA.md가 "구현 시 반드시 지켜야 할 설계 제약"이라고 못박은 항목이다. 완벽하게 타입
시스템만으로 강제할 수는 없지만(자바스크립트/타입스크립트가 "이 숫자가 어디서 왔는지"를
런타임에 추적하지 않는 한 궁극적으로는 불가능하다), 아래 세 겹의 구조적 장치로 실수가
"우연히" 발생할 가능성을 최대한 낮춘다.

### 3.1 함수 시그니처를 모드별로 완전히 분리한다 (1차 방어선)

```ts
// logic.ts (Builder 작성)
export function calculateFromHourlyWage(input: HourlyModeInput): HourlyModeResult { ... }
export function calculateFromMonthlyWage(input: MonthlyModeInput): MonthlyModeResult { ... }

export function calculateMinimumWageComparison(
  input: MinimumWageCalculatorInput,
): MinimumWageCalculatorResult {
  return input.mode === "HOURLY"
    ? calculateFromHourlyWage(input)
    : calculateFromMonthlyWage(input);
}
```

- **하나의 함수가 "mode에 따라 분기하며 반대 방향 계산까지 함께 수행"하는 형태를 만들지
  않는다.** `calculateFromHourlyWage`는 오직 `hourlyWage → convertedMonthlyPay` 방향만
  계산할 수 있고, 그 반대(월급을 받아 시급을 계산)를 할 수 있는 코드 경로 자체가 이 함수
  안에 존재하지 않는다 — "체이닝"을 하려면 애초에 없는 코드 경로를 새로 만들어야 한다.
- **`ui.tsx`가 호출해야 하는 함수는 오케스트레이터(`calculateMinimumWageComparison`)
  하나뿐이다.** 이 함수는 사용자가 지금 선택한 `mode`에 해당하는 원본 입력값만 받아
  **한 번** 호출된다(폼 제출 1회 = 계산 함수 호출 1회). "환산된 값을 다시 계산에
  넣는다"는 것은 이 오케스트레이터를 **두 번째로 호출하면서 그 인자에 이전 결과의
  필드를 넣는 행위**인데, 아래 3.2가 이를 타입 레벨에서 어색하게 만든다.

### 3.2 입력 타입과 결과 타입의 필드 이름이 겹치지 않는다 (2차 방어선, 이미 types.ts에 반영됨)

`MinimumWageCalculatorResult`의 어떤 분기에도 `hourlyWage`·`monthlyWage`라는 이름의
필드가 없다(입력 타입에만 존재하는 이름이다 — 결과에는 `displayHourlyWage`/
`convertedMonthlyPay` 등 항상 접두사가 붙은 이름만 있다). 따라서:

```ts
// 이런 코드는 컴파일 에러가 난다 — result에 hourlyWage/monthlyWage 필드 자체가 없음
const chained = calculateMinimumWageComparison({
  mode: "MONTHLY",
  monthlyWage: result.hourlyWage, // ❌ Property 'hourlyWage' does not exist
  weeklyHours,
});
```

체이닝을 하려면 `result.convertedMonthlyPay`(또는 `displayMonthlyPay`)처럼 **의도가
분명한 필드명을 의식적으로 골라 재키(re-key)해야 한다** — 실수로 자동완성하다 잘못
연결되는 사고를 막지는 못하지만, 적어도 "무심코 같은 이름의 필드를 그대로 통과시키다
체이닝이 되어버리는" 가장 흔한 사고 패턴은 원천 차단한다.

### 3.3 UI 레벨 규칙(Builder에게 명시적으로 요구) — 모드 전환 시 입력 필드 값을 이어받지 않는다

가장 현실적인 체이닝 발생 지점은 로직 내부가 아니라 **UI 사용성**이다 — "환산 월급
2,156,880원"을 보여준 뒤 사용자가 모드를 "월급으로 계산"으로 전환했을 때, 그 입력창에
방금 본 환산값을 편의상 미리 채워 넣고 싶은 유혹이 생길 수 있다. 이렇게 하면 사용자
입장에서는 "시급→월급→(같은 값으로)다시 시급"이라는 왕복이 화면에서 암묵적으로
일어나는 것처럼 보여 FORMULA.md가 우려한 "반올림 손실을 숨기지 않고 애초에 발생시키지
않는다"는 설계 의도와 어긋난다.

- **규칙: 모드를 전환하면 금액 입력 필드는 항상 빈 값으로 초기화한다.** 직전 결과의
  환산값을 새 모드의 입력 필드에 자동으로 채워 넣지 않는다. `weeklyHours`(공통 입력)는
  유지해도 무방하다(모드와 무관한 값이므로 체이닝 우려가 없다).
- 이 규칙은 SPEC.md가 요구하지 않았지만, FORMULA.md의 설계 제약을 제품 동작으로 옮기려면
  반드시 필요하다고 Architect가 판단해 여기 명시한다. UX/UI Critic 검토 시 이 규칙이
  지켜졌는지 확인할 것.

---

## 4. `weeklyHours` 하한을 1로 좁힌 이유 (0 나눗셈/0 환산 방지) — Architect가 직접 발견한 경계 버그

FORMULA.md의 `weeklyHours` 허용 범위는 `> 0, <= 168`이다. 하지만 이 하한을 문자 그대로
구현하면 **0으로 나누거나 결과가 0이 되는 계산 오류**가 발생할 수 있다는 것을 직접
재계산으로 확인했다 — Formula Analyst의 검증 예제(D1: `weeklyHours=1`)는 이 경계보다
안전한 값만 다뤄서 이 문제를 드러내지 않는다.

- **문제**: `weeklyHours`가 아주 작으면(`weeklyHours <= 40`이므로 `weeklyHolidayHours =
  weeklyHours × 0.2`) `weeklyPaidHours = weeklyHours × 1.2`도 아주 작아지고,
  `monthlyEquivalentHoursExact = weeklyPaidHours × 365/84`가 0.5 미만이면
  `monthlyEquivalentHours = round(...)`가 **0**이 된다.
  - 임계값 계산: `monthlyEquivalentHoursExact >= 0.5`이려면 `weeklyPaidHours >= 0.5 ×
    84/365 ≈ 0.11507`, 즉 `weeklyHours >= 0.11507 / 1.2 ≈ 0.0959`.
  - `weeklyHours`가 이 임계값(약 0.096) 미만이면 `monthlyEquivalentHours = 0`이 되어,
    **MONTHLY 모드에서는 0으로 나누어 `Infinity`가 나오고, HOURLY 모드에서는
    `hourlyWage × 0 = 0`이라는 명백히 잘못된 환산 월급이 나온다.**
- **이것은 FORMULA.md의 공식 자체가 틀렸다는 뜻이 아니다** — 시행령 제5조 산식 자체는
  이 극단 구간에서도 수학적으로 잘 정의된다(예: weeklyHours=0.05 → 정밀값 약 0.0217시간).
  문제는 이 계산기가 **의도적으로 채택한 "정수로 반올림 후 사용" 정책**(FORMULA.md
  "정밀도/반올림 정책")이 이 극단 구간에서 0으로 무너진다는 것이다 — 정밀값을 그대로
  썼다면(weekly-holiday-allowance처럼) 이런 붕괴가 없었을 것이다. 즉 이 문제는 **Formula
  Analyst가 놓친 것이 아니라, 이 계산기 고유의 반올림 정책이 만들어낸 부작용**이며
  Architect가 구조 설계 단계에서 짚어야 할 지점이다.
- **결정: `validation.ts`의 `weeklyHours` 하한을 FORMULA.md 원안의 `> 0`보다 좁혀
  `>= MIN_WEEKLY_HOURS`(권장값 **1**)로 둔다.** `weeklyHours=1`은 FORMULA.md 자신의 D1
  예제가 이미 "정상 동작"으로 검증한 값이고(`monthlyEquivalentHours=5`), 임계값(0.096)보다
  10배 이상 여유가 있어 안전하다. 이 이상은 계산 결과의 정확성 문제이지 UX 편의 문제가
  아니므로, Architect가 형식적 허용 범위(SPEC이 위임한 "입력 오류/극단값 방어" 영역)
  안에서 직접 정한다 — FORMULA.md의 공식·반올림 정책 자체를 바꾸는 것이 아니라, 그
  정책이 안전하게 성립하는 입력 구간으로 검증 범위를 좁히는 것이다.
- **Formula Analyst/Calculation Auditor에게 남기는 메모**: FORMULA.md "허용 범위" 표의
  `weeklyHours > 0`은 이 계산기의 반올림 정책과 결합하면 0.096 미만 구간에서 정확성이
  깨진다는 사실이 이번에 새로 발견됐다. 다음 FORMULA.md 개정 시 이 하한을 공식 문서에도
  반영할 것을 권고한다(지금은 Architect가 validation.ts 단에서만 방어).
- **`weeklyHours` 상한은 FORMULA.md 그대로 168 유지**(`MAX_WEEKLY_HOURS = 168`,
  weekly-holiday-allowance와 동일 상수 값 — 단, 아래 "8."에서 설명하듯 파일 간
  cross-import는 하지 않고 이 계산기 `validation.ts`에 독립적으로 재정의한다).

---

## 5. raw/display 분리 — `monthlyEquivalentHoursExact`는 결과 타입에 아예 존재하지 않는다

### 5.1 결정

`types.ts`의 `MinimumWageComparisonBase`에는 `monthlyEquivalentHours`(반올림된 정수)만
있고 `monthlyEquivalentHoursExact`(정밀값)는 없다. `annual-leave-allowance`의
`unusedLeaveAllowanceRaw`, `housing-acquisition-tax`의 절사 전 raw 세액, `national-
pension-benefit-estimate`의 `basicPensionMonthlyRaw`와 동일한 "raw는 logic.ts 내부
지역 변수로만 존재, 타입에 노출하지 않는다"는 이 프로젝트의 표준 관례를 따른다.

### 5.2 왜 weekly-holiday-allowance와 다른 판단인가 — 이 계산기가 유일하게 다른 지점

`weekly-holiday-allowance`는 정반대로 "완전정밀도 값을 결과 타입에 그대로 담고, 반올림은
`formatting.ts`가 표시 직전에만 한다"는 정책이다(그 계산기의 `weeklyHolidayPay` 등은
`Won` 타입으로 결과에 그대로 노출된다). 이 계산기는 **의도적으로 반대 방향**을 택한다 —
이유는 두 계산기의 반올림 정책 자체가 다르기 때문이다(FORMULA.md가 이미 이 차이를
명시적으로 설명함, "정밀도/반올림 정책" 절 1~4번).

- weekly-holiday-allowance: "표시 직전에만 반올림" → 정밀값이 계속 화면·후속 계산에
  살아있어야 하므로 결과 타입에 노출하는 것이 맞다.
- minimum-wage-calculator: "`monthlyEquivalentHours`를 중간 계산 단계에서 이미 반올림하고,
  그 반올림된 정수만 이후 모든 계산(환산 시급/월급, 월 환산 최저임금)에 쓴다" → 정밀값은
  **애초에 후속 계산에 쓰이지 않고, 화면에도 노출되지 않는다**(FORMULA.md "출력값" 표가
  `monthlyEquivalentHoursExact`에 "중간 계산용, 화면에는 반올림된 값만 노출"이라고 명시).
  이 값을 타입에 넣어 두면 Builder/UI가 "혹시 이 정밀값을 뭔가에 써야 하나"라고
  헷갈릴 여지를 만들 뿐이다 — 애초에 만들지 않는 편이 FORMULA.md의 의도("정부 계산
  관행 재현")를 코드 구조로 가장 정확히 반영한다.

### 5.3 그래도 정밀값을 검증해야 하는 Golden Test는 어떻게 하는가

`logic.ts`는 `monthlyEquivalentHours`(반올림 정수)를 만드는 과정에서 정밀값을 지역
변수로 한 번 거친다. Calculation Auditor가 FORMULA.md의 "208.571..." 같은 정밀값 자체를
검증하고 싶다면, 오케스트레이터(`calculateFromHourlyWage` 등)가 아니라 그 정밀값을
만드는 **독립적으로 export된 헬퍼 함수**를 직접 호출해서 검증한다:

```ts
// logic.ts (Builder 작성) — FORMULA.md "계산 순서" 4~5단계를 두 함수로 분리
export function calculateMonthlyEquivalentHoursExact(
  weeklyPaidHours: number,
  monthlyWeekFactor: { daysPerYear: number; monthsPerYear: number; daysPerWeek: number },
): number {
  const { daysPerYear, monthsPerYear, daysPerWeek } = monthlyWeekFactor;
  return (weeklyPaidHours * daysPerYear) / (monthsPerYear * daysPerWeek);
}

export function calculateMonthlyEquivalentHours(
  weeklyPaidHours: number,
  monthlyWeekFactor: { daysPerYear: number; monthsPerYear: number; daysPerWeek: number },
): number {
  return Math.round(calculateMonthlyEquivalentHoursExact(weeklyPaidHours, monthlyWeekFactor));
}
```

`annual-leave-allowance`가 `determineContinuousServiceRegime`/`calculateAccruedDays`를
오케스트레이터와 분리해 "이 함수 하나만으로 경계값을 검증 가능하게" 한 것과 같은 목적의
분리다(아래 "7. 함수 분리" 참고).

---

## 6. 정책 데이터 — `rates-2026.json`에 `minimumWage.monthlyReference`를 추가하지 않는다

### 6.1 결정

FORMULA.md가 제안한 신규 필드(`minimumWage.monthlyReference`, 40시간 기준 참고 월
환산액 2,156,880원)를 **추가하지 않는다.** `rates-2026.json`은 이번 라운드에서 전혀
수정하지 않았다.

### 6.2 근거

FORMULA.md 스스로 이 필드를 "선택 사항, 없어도 정확성에 문제없다"고 명시했다. Architect가
그 판단을 그대로 확정하는 근거는 다음과 같다.

1. **이 값은 독립적인 법정 수치가 아니라 파생값이다.** FORMULA.md "공식 > 5." 자신이
   "시간급과 별도로 독립 고시되는 법정 최저임금은 없다"고 결론 냈다 — 즉
   `monthlyReference`는 `minimumWage.hourly.value`(SSOT)로부터 매번 정확히 재계산 가능한
   **파생값**이다. `docs/ARCHITECTURE.md` "정책 데이터를 언제 계산기 전용 policy.ts에
   두는가"가 데이터 파일에 저장하는 값의 기준으로 삼는 것은 "독립적으로 고시/개정되는
   정책값"이지, "다른 필드로부터 계산 가능한 파생값"이 아니다.
2. **파생값을 별도로 저장하면 매년 갱신 시 드리프트 위험이 생긴다.** 매년 1월
   `minimumWage.hourly.value`를 갱신할 때(예: 2027년 10,700원) `monthlyReference`도 함께
   손으로 갱신해야 하는데, 이 필드는 "화면 표시용 참고값"이라 계산 로직 어디에도 강제
   검증 지점이 없다 — 갱신을 깜빡해도 `tsc`/테스트가 잡아주지 못하고, 화면에 작년 값이
   조용히 남을 위험이 있다(예: `rates-2027.json`을 만들면서 `hourly.value`만 갱신하고
   `monthlyReference`를 깜빡하는 실수). 반대로 이 필드 없이 매번
   `minWageHourly × monthlyEquivalentHours(weeklyHours=40)`로 직접 계산하면, `hourly.value`
   하나만 갱신해도 파생값이 자동으로 맞는다 — SSOT 원칙에 더 부합한다.
3. **이 필드가 제공하는 두 가지 이점(FORMULA.md가 스스로 든 근거) 모두 이 필드 없이도
   똑같이 달성된다.**
   - "화면에 즉시 표시할 때 매번 재계산하지 않는 편의값" — 이 계산은 곱셈 한 번(`10,320 ×
     209`)에 불과해 성능상 캐싱할 이유가 전혀 없다(loan-interest-calculator의 480회
     반복 계산처럼 캐싱이 실제로 의미 있는 사례와 다르다).
   - "Golden Test A1의 기대값과 코드 계산 결과가 일치하는지 검증하는 앵커 값" — 이
     프로젝트의 다른 모든 Golden Test가 그렇듯, 기대값(2,156,880)을 **테스트 코드에 직접
     리터럴로 적으면 된다**(`weekly-holiday-allowance/logic.test.ts`가 이미 이렇게 한다 —
     예: `expect(roundWon(result.weeklyHolidayPay)).toBe(82_560)`). 데이터 파일에 별도
     필드를 만들어야만 앵커 검증이 가능한 것이 아니다.
4. **FAQ 콘텐츠("올해 최저임금은 얼마인가요?" 답변에 등장하는 "약 2,156,880원")는 정적
   카피(`content.ts`)에 문자열로 직접 쓰면 된다** — 다른 계산기들의 FAQ 답변도 이미
   구체적인 예시 숫자를 정적 텍스트로 담고 있다(계산 로직과 무관한 설명용 카피는 데이터
   파일 참조 없이 직접 서술해도 된다는 것이 이 프로젝트의 기존 관례다).

### 6.3 대신 이렇게 계산한다 (Builder 지침)

`minWageMonthlyEquivalent`는 항상 다음 한 줄로 직접 계산한다 — 저장된 참고값을 대신
쓰지 않는다:

```ts
const minWageMonthlyEquivalent = rates.minimumWage.hourly.value * monthlyEquivalentHours;
```

여기서 `monthlyEquivalentHours`는 **이 계산의 실제 `weeklyHours`로 산출된 값**이다(위
"5.3"의 헬퍼로 계산). `weeklyHours=40`이면 결과가 정확히 2,156,880원이 되어 FORMULA.md
예제 A1과 일치하는지는 Golden Test로 검증하고, 데이터 파일의 별도 필드로 검증하지 않는다.

---

## 7. `minWageMonthlyEquivalent`가 항상 실제 `weeklyHours` 기준이어야 한다는 점을 로직에서 강제하는 방법

설계 질문 4번. 이 계산기가 저지르기 가장 쉬운 실수는 "40시간 기준 209시간이라는 유명한
숫자에 이끌려, `weeklyHours`가 40이 아닌 경우에도 209를 하드코딩하거나 참고 데이터의
고정값을 가져다 쓰는 것"이다(바로 위 "6."에서 참고 데이터 자체를 없애기로 한 이유이기도
하다).

- **강제 방법 1 — 데이터 흐름 자체를 한 방향으로만 만든다**: `monthlyEquivalentHours`는
  오직 "이 호출에서 검증을 통과한 `weeklyHours`"로부터만 계산된다(위 "5.3" 헬퍼 함수의
  유일한 입력이 `weeklyPaidHours`이고, 그 값은 다시 이 호출의 `weeklyHours`로부터만
  나온다 — 상수 40이 이 경로 어디에도 끼어들 자리가 없다. `statutoryWeeklyHours`(40)는
  오직 `weeklyHolidayHours`의 **비례식 분모**로만 쓰이지, `monthlyEquivalentHours`
  계산에 직접 대입되지 않는다).
- **강제 방법 2 — 참고 상수를 원천적으로 없앤다**: 위 "6."의 결정으로 "40시간 기준
  2,156,880원"이라는 고정값이 코드베이스 어디에도 데이터로 존재하지 않으므로, 실수로
  그 상수를 가져다 쓸 방법 자체가 없다(피할 대상이 아예 없다).
- **강제 방법 3 — 이름에 이미 정보가 있다**: 필드 이름을 `minWageMonthlyEquivalent209`
  같은 식으로 짓지 않고 `minWageMonthlyEquivalent`로만 두어(FORMULA.md 그대로) 특정
  숫자(209)를 필드 이름에 각인시키지 않는다 — 이름 자체가 "이건 40시간 전용값"이라는
  암시를 주지 않게 한다.
- **Calculation Auditor에게 권고하는 검증**: FORMULA.md 예제 C1(주 20시간 →
  `minWageMonthlyEquivalent(20h) = 1,073,280원`)과 C2(주 30시간 →
  `1,609,920원`)를 반드시 Golden Test에 포함해, "40시간이 아닌 입력에서도
  `minWageMonthlyEquivalent`가 비례해 달라지는지"를 직접 검증할 것(예제 A1 하나만으로는
  이 요구사항이 검증되지 않는다 —40시간 케이스는 우연히도 유명한 상수와 값이 같아서
  하드코딩 버그를 숨길 수 있다).

---

## 8. 파일 구조 / 함수 분리 (Builder 인수인계)

FORMULA.md "계산 순서" 1~9단계는 반복 루프나 회차별 보정 같은 "공유 가능한 복잡한
다단계 절차"가 없다 — `loan-interest-calculator`처럼 `logic/` 디렉터리로 분할할 근거가
없다(`housing-acquisition-tax`/`annual-leave-allowance`와 같은 판단, 단일
`logic.ts`로 충분).

```
src/calculators/minimum-wage-calculator/
  types.ts              # 완성(Architect). 위 "2.","5.","6.","7." 반영.

  logic.ts              # Builder 작성, 단일 파일
    APPLICABLE_RATE_YEAR / RATES_BY_YEAR / getApplicableRates()
      // weekly-holiday-allowance와 동일한 패턴(날짜 입력이 없는 계산기 — 아래 "9." 참고).
      // 이 계산기 전용으로 독립 정의한다(cross-import 금지, annual-leave-allowance
      // ARCHITECTURE.md "6.3"의 관례와 동일).

    calculateWeeklyPaidHours(weeklyHours, statutoryWeeklyHours, statutoryDailyHours)
      -> { weeklyHolidayHours, weeklyPaidHours, cappedAtStatutoryLimit }
      // FORMULA.md 계산순서 2~3단계. weeklyHolidayHours는
      // src/lib/labor-standards.ts:calculateWeeklyHolidayHours()를 호출(위 "1.").

    calculateMonthlyEquivalentHoursExact(weeklyPaidHours, monthlyWeekFactor) -> number
    calculateMonthlyEquivalentHours(weeklyPaidHours, monthlyWeekFactor) -> number (반올림)
      // FORMULA.md 계산순서 4~5단계. 위 "5.3" 그대로. Exact 버전은 Golden Test 전용으로만
      // 쓰이고 오케스트레이터의 반환값 조립에는 관여하지 않는다(타입에 노출 안 함).

    calculateFromHourlyWage(input: HourlyModeInput): HourlyModeResult
    calculateFromMonthlyWage(input: MonthlyModeInput): MonthlyModeResult
      // FORMULA.md 계산순서 6~9단계, 모드별로 완전히 분리(위 "3.1" 체이닝 방지 설계).
      // 각 함수 내부에서: 위 두 함수 호출 → 환산값 산출(round) → 최저임금 조회·비교
      // → displayHourlyWage/displayMonthlyPay/convertedX 전부 이 함수 하나 안에서 확정.

    calculateMinimumWageComparison(input: MinimumWageCalculatorInput): MinimumWageCalculatorResult
      // 오케스트레이터. mode로 위 두 함수 중 하나만 호출(위 "3.1"). ui.tsx가 호출하는
      // 유일한 진입점.

  logic.test.ts          # FORMULA.md 검증 예제 19개(A1~F8) + 위 "4." 경계(weeklyHours
                          # 임계값 0.096 부근) + 위 "7." C1/C2 비례 검증
  validation.ts           # 아래 "10."
  validation.test.ts
  formatting.ts           # breakdown 수식 문자열, 원 단위 포맷, 소수 시간 포맷
  formatting.test.ts
  content.ts              # 소개/FAQ/정책 고지 문구(FORMULA.md 원문 그대로 옮김)
  ui.tsx                  # 아래 "9." 레이아웃
```

---

## 9. 숫자 정밀도 전략 — 일반 `Number`, 스케일링/BigInt/decimal 전부 불필요

`docs/ARCHITECTURE.md`의 다른 라운드와 동일한 방법론(Formula Analyst 의견을 그대로 받지
않고 최악 조합을 Architect가 직접 재계산)을 적용한다.

- **입력 상한(권장, validation.ts)**: `hourlyWage <= 1,000,000`(weekly-holiday-allowance와
  동일 값 — 두 계산기가 같은 사용자층을 다루므로 상한도 통일), `monthlyWage <=
  1,000,000,000`(FORMULA.md 예시 10억 원), `weeklyHours ∈ [1, 168]`(위 "4.").
- **최악 조합 재계산**:
  - `convertedMonthlyPay = hourlyWage × monthlyEquivalentHours`: `1,000,000 × 765`(주
    168시간 최댓값, FORMULA.md D2) `= 765,000,000`.
  - `convertedHourlyWage = monthlyWage ÷ monthlyEquivalentHours`: 분모가 가장 작은 경우는
    `weeklyHours=1`(하한) → `monthlyEquivalentHours=5`(FORMULA.md D1) → `1,000,000,000 ÷
    5 = 200,000,000`.
  - `minWageMonthlyEquivalent = minWageHourly × monthlyEquivalentHours`: 시급 자체는
    고시값(10,320원 수준)으로 고정이라 `hourlyWage`보다 훨씬 작다 — 위 계산보다 항상
    작다.
  - 전부 `Number.MAX_SAFE_INTEGER`(약 9.007×10^15)에 4~5자리(10^4~10^5배) 이상 여유가
    있다. `average-cost-calculator`가 `BigInt`를 채택해야 했던 "정상 입력 범위에서 이미
    Number가 틀릴 수 있는" 상황과 무관하다.
- **결론: 일반 `Number`. `BigInt`/`decimal.js`/`big.js` 전부 불필요.**
- **중간 반올림 정책은 일반 원칙의 명시적 예외다**(위 "5.2"에서 이미 설명) —
  `monthlyEquivalentHours`만 중간에 반올림하고 그 정수를 재사용한다. 그 외 모든 중간값
  (`weeklyHolidayHours`, `weeklyPaidHours`)은 반올림하지 않는다. 최종 표시 반올림
  (`convertedMonthlyPay`/`convertedHourlyWage`/`minWageMonthlyEquivalent`)은 FORMULA.md
  "최종 표시 반올림" 그대로 사사오입 1회.

---

## 10. 입력 검증 개요 (상세는 Builder 재량, FORMULA.md "예외" 그대로 + 위 "4." 반영)

- `mode`는 `"HOURLY"`/`"MONTHLY"` 중 하나. 아니면 계산하지 않고 오류.
- `hourlyWage`/`monthlyWage`: **정수만 허용**(weekly-holiday-allowance와 동일 결정 —
  "국내 시급·최저임금·채용공고가 전부 원 단위 정수"라는 근거가 월급에도 그대로
  적용된다. 국내 급여명세서에 소수점 원 단위 월급은 존재하지 않는다). `> 0`, 각 모드에
  해당하는 필드만 필수(나머지 모드 필드는 애초에 폼에 존재하지 않음 — discriminated
  union 입력이 이를 구조적으로 보장). 상한은 위 "9." 권장값.
  - **FORMULA.md 예제 E1(`hourlyWage=10,320.5`, 소수점 입력)은 UI/validation.ts
    레벨에서는 거부 대상이 된다**(정수 전용 결정과 충돌) — 하지만 이 예제는 "반올림
    공식 자체가 소수 입력에도 올바르게 동작하는지"를 검증하려는 목적이므로, Golden
    Test에서는 **`validation.ts`를 거치지 않고 `logic.ts`의 `calculateFromHourlyWage`를
    직접 호출**해 순수 계산 함수 레벨에서 검증한다(이 프로젝트가 이미 여러 계산기에서
    "logic.ts는 검증된 입력을 전제하고 방어적 재검증을 반복하지 않는다"는 관심사 분리
    원칙을 쓰고 있으므로, `logic.ts` 자체는 소수 입력을 받아도 정상 동작해야 한다 —
    입력을 정수로 제한하는 것은 validation.ts/UI의 책임이지 logic.ts의 책임이 아니다).
    Calculation Auditor는 이 해석 차이를 인지하고 E1을 "UI 차단 대상이지만 logic 단위
    테스트로는 여전히 유효"로 처리할 것.
- `weeklyHours`: 소수 허용, `step=0.5`(UI 힌트, 강제 아님 — weekly-holiday-allowance와
  동일), `MIN_WEEKLY_HOURS=1`(위 "4."), `MAX_WEEKLY_HOURS=168`. 빈 값이면 기본값 40 적용
  (validation.ts 책임, `types.ts`에 도달한 시점엔 이미 확정된 숫자).
- 위 상수들은 이 계산기 `validation.ts`에 **독립적으로 재정의**한다(weekly-holiday-
  allowance의 `validation.ts`를 import하지 않는다 — `annual-leave-allowance`
  ARCHITECTURE.md "6.3"이 확립한 "같은 상수·같은 근거를 각 계산기 validation.ts에 패턴
  재사용으로 독립 재정의, 파일 간 cross-import는 하지 않음" 관례와 동일. `src/lib/`로
  추출한 것은 "산식"(순수 계산 함수)이지 "입력 검증 상수"가 아니라는 점에 주의 —
  이 둘은 서로 다른 층위다).

---

## 11. 날짜 입력이 없는 계산기의 "적용 연도" — weekly-holiday-allowance와 동일 패턴

이 계산기도 날짜 입력이 없어 "몇 년도 최저임금을 쓸지"를 입력에서 끌어낼 수 없다.
`weekly-holiday-allowance/logic.ts`가 확립한 패턴을 그대로 따른다(다만 파일은 독립
정의 — cross-import 없음).

```ts
export const APPLICABLE_RATE_YEAR = 2026;
const RATES_BY_YEAR: Record<number, typeof rates2026> = { 2026: rates2026 };
export function getApplicableRates(): typeof rates2026 { /* 없으면 throw */ }
```

- `new Date().getFullYear()` 런타임 방식은 쓰지 않는다(2027-01-01 되는 순간 깨짐).
- 결과에 `appliedRateYear`를 실어 보내 정책 고지("이 계산은 2026년 기준")에 쓴다
  (`types.ts`에 이미 반영).
- `rates-2027.json` 생성은 이번 라운드 범위 밖 — Formula Analyst가 별도로 확인 후 진행.

---

## 12. UI 레이아웃

`docs/DESIGN_SYSTEM.md` "공통 화면 순서"(입력 → 결과 → 계산 근거 → 소개·사용 방법 →
정책 안내 → FAQ)를 그대로 따르되, SPEC.md가 명시적으로 요구한 "최저임금 산입범위 고지를
정책 안내 카드 수준으로 눈에 띄게" 배치한다.

```
[모드 토글] — 세그먼트 컨트롤 2개: "시급으로 계산" / "월급으로 계산"
  전환 시 금액 입력 필드는 항상 빈 값으로 초기화(위 "3.3" 체이닝 방지 UX 규칙)

[입력 폼]
  (모드에 따라 하나만 노출) 시급(원) 또는 월급(원) — 정수, 천단위 콤마(severance-pay
    handleAmountChange 패턴)
  주 근무시간(시간, 선택, 기본값 40) — weekly-holiday-allowance와 동일 helpText 패턴
    ("소정근로시간"은 helpText로, 라벨은 "주 근무시간")

[결과 — 핵심 카드] (bg-primary 강조, 계산기당 하나)
  mode="HOURLY" → "환산 월급" = convertedMonthlyPay + "최저임금 이상/미만" 배지
    (monthlyMeetsMinimumWage 기준)
  mode="MONTHLY" → "환산 시급" = convertedHourlyWage + "최저임금 이상/미만" 배지
    (hourlyMeetsMinimumWage 기준)
  카드 안에 작은 라벨로 "직접 입력한 값이 아니라 계산된 환산값입니다" 명시(SPEC Must
  Have "입력값/환산값 구분")

[결과 — 보조 정보 행 2줄] (핵심 카드 아래, 작은 카드/표 형태)
  "시급" 행: result.displayHourlyWage + (mode==="HOURLY" ? "입력값" : "환산값") 배지
    + 최저임금(minWageHourly) 대비 이상/미만
  "월급" 행: result.displayMonthlyPay + (mode==="MONTHLY" ? "입력값" : "환산값") 배지
    + 월 환산 최저임금(minWageMonthlyEquivalent) 대비 이상/미만
  → 이 두 행이 SPEC Must Have "결과 화면에는 시급 얼마/월급 얼마를 함께 보여준다" +
    "입력값/환산값을 명확히 구분 표시"를 동시에 만족한다. 배지 라벨은 result.mode
    하나만으로 결정하고 별도 boolean 필드를 두지 않는다(위 "2." 참고).

[미충족 경고 카드] (조건부, 독립 — hourlyMeetsMinimumWage/monthlyMeetsMinimumWage 중
  하나라도 false면 노출. docs/DESIGN_SYSTEM.md "경고/미충족 카드" 패턴)
  "입력하신 금액이 {appliedRateYear}년 최저임금 기준보다 낮습니다" + 어느 쪽(시급/월급)이
  미달인지 구체적으로 명시. 게이팅 아님 — 위 결과는 이미 전부 계산·표시된 상태.

[SectionCard "계산 근거"] — "라벨 = 값" 형태, 서술형 내레이션 금지, 단계별 카드
  1단계 주휴시간: "주 근무시간 {weeklyHours}시간 → 주휴시간 min({weeklyHours}÷40×8, 8)
    = {weeklyHolidayHours}시간"
    (cappedAtStatutoryLimit===true면 "주 40시간을 초과한 시간은 주휴시간 산정에
    포함되지 않습니다" 고지 추가 — weekly-holiday-allowance와 동일 문구)
  2단계 월 환산 시간: "1주 최저임금 적용기준 시간 수 = {weeklyHours} + {weeklyHolidayHours}
    = {weeklyPaidHours}시간 → 월 환산 시간 = {weeklyPaidHours} × 365/84 → 반올림 →
    {monthlyEquivalentHours}시간" (정밀값 208.571... 같은 소수는 노출하지 않는다 —
    위 "5.2")
  3단계 환산식(모드별로 문구가 다름):
    - HOURLY: "환산 월급 = 시급 {hourlyWage}원 × {monthlyEquivalentHours}시간 =
      {convertedMonthlyPay}원"
    - MONTHLY: "환산 시급 = 월급 {monthlyWage}원 ÷ {monthlyEquivalentHours}시간 =
      {convertedHourlyWage}원"
  4단계 비교식(항상 둘 다 표시):
    "시급 {displayHourlyWage}원 vs {appliedRateYear}년 최저임금 {minWageHourly}원 →
      {이상/미만}"
    "월급 {displayMonthlyPay}원 vs 월 환산 최저임금 {minWageMonthlyEquivalent}원({weeklyHours}시간
      기준) → {이상/미만}"
    → "({weeklyHours}시간 기준)"을 반드시 병기해 40시간 고정이 아님을 매번 상기시킨다
      (위 "7." 강제 방법의 UI 측 대응).

[SectionCard "최저임금 산입범위 안내"] (SPEC Must Have — 정책 안내 카드 수준으로 눈에
  띄게. `bg-surface-subtle`이 아니라 아래 "정책 고지"와 함께 이 계산기에서 가장 강조할
  카드 중 하나로 배치 — 일반 정책 고지보다 위, 결과 바로 아래쪽에 둘 것을 권장)
  "이 계산기는 입력한 금액 전체를 기준으로 비교하며, 실제 최저임금법상 임금 항목별
  산입 여부(상여금·복리후생비 등)는 따지지 않습니다..." (SPEC 원문 그대로)

[SectionCard "정책 고지"] (정책형 계산기, 항상 노출)
  - 기준 연도 {appliedRateYear} + "매년 갱신될 수 있다" 문구
  - 최저임금법 위반 여부의 법적 판정 도구가 아니라는 고지
  - 수습 감액 참고 안내(Should Have)

[IntroSection] [UsageGuide] [FaqAccordion]
  FAQ 7문항(SPEC.md 질문 그대로, 답변은 FORMULA.md "FAQ 콘텐츠" 원문)
```

- **"입력값"/"환산값" 구분 표시는 별도 컴포넌트 없이 `result.mode`로 조건부 배지
  텍스트만 바꾼다** — `annual-leave-allowance`의 "핵심 카드 내용이 입력 상태에 따라
  바뀐다"(allowance 유무) 패턴의 변형이다. 새 공용 컴포넌트로 승격하지 않는다(사례
  1개뿐).
- **카드/시각적 계층**(SPEC Must Have): "계산 근거" 4단계는 번호 매겨진 단계 카드로
  표현한다(`housing-acquisition-tax`/`annual-leave-allowance`가 이미 쓴 톤 재사용).
  "최저임금 산입범위 안내"는 SPEC이 "작은 각주가 아니라 정책 안내 카드 수준"으로
  요구했으므로, 다른 정책 고지 문구보다 시각적으로 먼저(결과 바로 아래) 배치할 것을
  권장한다 — 정확한 색상/강조 강도는 UX/UI Critic이 화면으로 재검토한다.

---

## 13. 공통 컴포넌트 재사용 검토

- **`ShareActions`**: 그대로 재사용 가능. `MinimumWageCalculatorInput`은 discriminated
  union이지만 필드가 전부 원시 타입(`string`/`number`)이라 직렬화 문제가 없다
  (`business-days`가 이미 같은 모양의 판별 유니온 입력을 URL에 인코딩해 쓰고 있다 —
  선례 확인됨).
- **`SectionCard`/`UsageGuide`/`IntroSection`/`FaqAccordion`**: 그대로 재사용.
- **핵심 결과 카드 / 경고 카드**: 기존 `bg-primary`/`bg-warning-surface` 인라인 패턴을
  `ui.tsx`에 직접 구현(공용 컴포넌트로 승격하지 않음 — 기존 관례).
- **모드 토글(세그먼트 컨트롤)**: 이 사이트에 아직 없는 새 입력 패턴이다(지금까지 모든
  계산기가 라디오/체크박스/단일 입력이었고, "두 모드 중 하나를 선택해 입력 필드 자체가
  바뀌는" 토글은 처음). 다만 `business-days`가 이미 `mode: "range" | "offset"` 값에 따라
  다른 입력 필드 세트를 보여주는 조건부 렌더링을 로컬로 구현한 선례가 있어(로직
  차원에서는 이미 존재하는 패턴), 시각적 세그먼트 컨트롤(버튼 2개 묶음) 마크업만 새로
  추가하면 된다 — 아직 사례가 이걸로 2번째뿐이라 공용 컴포넌트로 승격하지 않고
  `ui.tsx`에 로컬로 구현한다.

---

## 14. 회귀 방지 확인

- **공용 코드 변경 범위**: `src/lib/labor-standards.ts`(신규) +
  `src/calculators/weekly-holiday-allowance/logic.ts`(리팩터링, 로직 불변) 두 곳뿐이다.
  `src/data/rates-2026.json`은 건드리지 않았다(위 "6.").
- `npx tsc --noEmit`: 클린(에러 없음). — 이번 라운드 변경 전체(labor-standards.ts 신규,
  weekly-holiday-allowance/logic.ts 리팩터링, minimum-wage-calculator/types.ts 신규)
  반영 후 재확인 완료.
- `npx vitest run --no-file-parallelism`: **86개 테스트 파일 · 1,199개 테스트 전부
  통과**(리팩터링 전 84개 파일 기준선 대비 회귀 없음 — `weekly-holiday-allowance/
  logic.test.ts`의 Golden Test 7개 + Edge Case 전부 포함해 통과 확인).
- `minimum-wage-calculator` 폴더는 `types.ts` 하나만 존재하고, 다른 어떤 계산기도 이
  폴더를 import하지 않는다 — 이 계산기의 향후 구현이 다른 계산기에 영향을 줄 여지가
  없다.

---

## 15. Builder 체크리스트 (요약)

1. `logic.ts` — 위 "8." 함수 분리 그대로 구현. `calculateWeeklyHolidayHours`는
   `src/lib/labor-standards.ts`에서 import(로컬 재구현 금지). `monthlyEquivalentHours`는
   중간에 반올림해 이후 계산에 재사용(위 "5.", "9." — 일반 반올림 정책의 명시적 예외).
2. `calculateFromHourlyWage`/`calculateFromMonthlyWage`를 분리된 함수로 구현하고,
   `calculateMinimumWageComparison` 오케스트레이터만 `ui.tsx`에 노출한다(위 "3.1").
3. `minWageMonthlyEquivalent`는 매번 `minWageHourly × monthlyEquivalentHours`(이 호출의
   `weeklyHours` 기준)로 직접 계산한다 — 저장된 참고 상수를 쓰지 않는다(위 "6.", "7.").
   Golden Test에 C1(20시간)·C2(30시간) 비례 검증을 반드시 포함한다.
4. `validation.ts`에 `MIN_WEEKLY_HOURS=1`(FORMULA.md 원안 `>0`보다 좁힌 값, 위 "4.")을
   포함한다. `hourlyWage`/`monthlyWage`는 정수 전용(위 "10.").
5. FORMULA.md 예제 E1(소수 시급)은 `validation.ts`가 아니라 `logic.ts`를 직접 호출하는
   단위 테스트로 검증한다(위 "10.").
6. `rates-2026.json`을 수정하지 않는다 — 신규 필드 추가 없음(위 "6.").
7. `ui.tsx`: 모드 전환 시 금액 입력 필드를 초기화한다(위 "3.3", 체이닝 방지). 위 "12."
   레이아웃 순서와 "입력값"/"환산값" 배지 규칙을 그대로 따른다.
8. 새 계산기 완료 후 기존 계산기 Smoke Test 실행(`docs/EVALUATION.md` "회귀 방지") —
   특히 `weekly-holiday-allowance`는 이번 라운드에서 공용 함수로 리팩터링됐으므로 반드시
   포함한다.

## 16. registry.ts 등록 계획 (다음 라운드)

- 이번 Architect 라운드에서는 등록하지 않는다(위 "0.").
- Builder가 구현을 완료하면 다음으로 등록한다(SPEC.md "슬러그/카테고리" 그대로):
  ```
  slug: "minimum-wage-calculator"
  title: "최저임금·시급↔월급 계산기"
  category: "labor"
  status: "draft"
  ```
- **아이콘**: `labor` 카테고리에 이미 `coins`(severance-pay)·`calculator`
  (unemployment-benefit)·`calendar`(weekly-holiday-allowance)·`heart`(parental-leave-
  benefit)·`chart`(annual-leave-allowance)가 쓰이고 있다(registry.ts 2026-09-14 기준).
  Builder가 실제 등록 시점에 다시 확인해 중복을 피할 것 — 남은 키는 `utility`뿐이라
  부족하면 새 아이콘 키 도입을 검토해야 할 수 있다(Architect가 지금 미리 단정하지
  않는다).
