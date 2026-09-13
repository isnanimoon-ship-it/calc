# EVALUATION: 더치페이 계산기

## Builder 구현 완료

Builder가 SPEC.md · FORMULA.md · ARCHITECTURE.md에 따라 구현을 완료했다. 아래는 구현
사실과 테스트 실행 결과 기록이며, 최종 PASS/FAIL 판정이 아니다 — Calculation Auditor,
UX/UI Critic, QA가 각자 독립적으로 재검증해야 한다.

### 구현 파일
- `src/calculators/bill-split-calculator/logic.ts`(신규) — `pickWinnerIndex`,
  `fisherYatesShuffle`, `calculateEqualSplit`, `calculateWinnerTakeAll`,
  `calculateLadderSplit`, `buildWinnerTakeAllShares`, `buildLadderMatches`,
  `restoreBillSplitResult` — ARCHITECTURE.md "2.2"가 확정한 시그니처를 그대로 구현했다.
- `src/calculators/bill-split-calculator/logic.test.ts`(신규) — FORMULA.md 검증 예제
  1~13을 Golden Test로 옮겼다(대량 시뮬레이션은 Auditor 몫으로 남김, 아래 "테스트 반영
  현황" 참고).
- `src/calculators/bill-split-calculator/validation.ts`, `validation.test.ts`(신규) —
  멤버 수 2~20, 이름 빈 문자열 불가, 금액 1~100,000,000 정수, 사다리타기
  `amounts.length === members.length` 검증 + `parseBillSplitShareState`.
- `src/calculators/bill-split-calculator/formatting.ts`, `formatting.test.ts`(신규) —
  통화 포맷, 방식별 핵심 결과 한 줄 요약, breakdown 문구 조립(숫자 재계산 없음).
- `src/calculators/bill-split-calculator/content.ts`(신규) — 방식별 설명 문구(SPEC.md
  Must Have 예시 문구 그대로), 소개/사용법/FAQ, 이용 안내 고지.
- `src/calculators/bill-split-calculator/RouletteWheel.tsx`, `RouletteWheel.test.tsx`
  (신규) — 몰아주기 룰렛 애니메이션(SVG+CSS, Canvas 미사용).
- `src/calculators/bill-split-calculator/LadderAnimation.tsx`, `LadderAnimation.test.tsx`
  (신규) — 사다리타기 애니메이션(SVG+CSS, 결과 우선 산정 후 시각화 방식).
- `src/calculators/bill-split-calculator/use-prefers-reduced-motion.ts`(신규) —
  `useSyncExternalStore` 기반 `prefers-reduced-motion` 구독 훅.
- `src/calculators/bill-split-calculator/ui.tsx`, `ui.test.tsx`(신규) — 입력(방식
  선택/멤버 추가삭제)/결과(방식별 템플릿)/이미지 저장/공유 UI.
- `src/calculators/bill-split-calculator/types.ts` — Architect 산출물 그대로 사용(수정
  하지 않음).
- `src/calculators/registry.ts` (slug 등록, category: life, icon: utility, status: draft)
- `src/calculators/calculator-components.ts` (ui 연결)
- `app/calculators/[slug]/page.tsx` (FAQ SEO 항목 연결, 기존 관례 그대로)

### 테스트 실행 결과
- `npx vitest run src/calculators/bill-split-calculator --no-file-parallelism`:
  **6개 파일, 66개 테스트 전부 통과**
- `npx vitest run --no-file-parallelism` (전체 스위트, 기존 계산기 회귀 확인 겸함):
  **64개 파일, 694개 테스트 전부 통과**
- `npx tsc --noEmit`: 오류 없음
- `npx eslint`(신규 파일 + registry.ts/calculator-components.ts/page.tsx 대상): 오류 없음
- `npm run build`: 성공(Next.js 프로덕션 빌드, 정적 페이지 생성 포함)

### FORMULA.md Golden Test 13개 반영 현황
- 예제 1~7(균등 분배): `calculateEqualSplit`으로 그대로 재현, 추가로 다양한
  `totalAmount`/`n` 조합(중복 제거된 5개 케이스)에 대해 "합계=totalAmount" 불변식을
  별도 테스트로 확장했다.
- 예제 8(몰아주기 모듈로 편향 수학적 논증): 시뮬레이션이 아니므로, `pickWinnerIndex`가
  `[0,1)` 구간의 N등분 경계에서 결정적으로 올바른 인덱스를 반환하는지(경계값 포함)만
  소규모로 재현했다. 10,000~100,000회 대량 시뮬레이션(카이제곱 검정)은 넣지 않았다 —
  ARCHITECTURE.md "11.3"이 명시한 대로 Calculation Auditor의 별도 산출물로 남긴다.
  `pickWinnerIndex`는 export되어 있어 Auditor가 그대로 대량 호출할 수 있다.
- 예제 9(몰아주기 통계 검증 방법론 시연, 가상 데이터): FORMULA.md 자신이 "실제 구현
  결과가 아닌 가상 예시"라고 명시했으므로 Golden Test로 옮기지 않았다.
- 예제 10(사다리타기 N=2 손 추적): 고정 시퀀스 rng로 j=0/j=1 두 경우 모두 정확히
  재현했다(문서와 일치).
- 예제 11(사다리타기 N=3, 6가지 조합 손 추적): **문서 표 자체에 오류를 발견했다** —
  아래 "SPEC/FORMULA/ARCHITECTURE와 다르게 판단해야 했던 부분" 참고. 실제 Fisher-Yates
  알고리즘을 손으로 재추적한 값을 테스트 기대값으로 썼다(로직 구현은 ARCHITECTURE.md
  "2.2"의 참조 코드와 동일 — Builder가 알고리즘을 바꾼 것이 아니다).
- 예제 12(완전한 순열 불변식): N=2·3·4(중복 금액 포함)·20에서 각 20회씩(총 80회) 실제
  `Math.random()`으로 반복 검증 — `matches.length===n`, `memberIndex` 집합=`[0..n-1]`,
  배정 금액 multiset=원본 `amounts` multiset을 매번 확인했다.
- 예제 13(사다리타기 통계 검증 절차): FORMULA.md가 "실제 수치는 Auditor가 재현"이라고
  명시했으므로 대량 시뮬레이션은 넣지 않았다. `fisherYatesShuffle`은 export되어 있어
  Auditor가 marginal/전수 순열 카이제곱 검정을 그대로 수행할 수 있다.
- `restoreBillSplitResult`가 세 분기 모두 RNG를 절대 호출하지 않는다는 것을
  `Math.random`을 임시로 예외를 던지도록 몽키패치해 직접 검증했다(공유 URL 복원 안전성).

### SPEC/FORMULA/ARCHITECTURE와 다르게 판단해야 했던 부분 (Calculation Auditor 확인 요청)

**FORMULA.md "검증 예제 11"의 (j2, j1) → 결과 순열 대응표에 오류가 있는 것으로 보인다 —
알고리즘 자체를 바꾸지 않고, ARCHITECTURE.md "2.2"가 확정한 Fisher-Yates 구현을 문자
그대로 실행한 결과를 테스트에 반영했다.**

- FORMULA.md 예제 11은 N=3에서 `i=2`에서 `j2∈{0,1,2}`, `i=1`에서 `j1∈{0,1}`을 뽑아
  6가지 조합과 그 결과 순열을 표로 제시한다.
- 표를 실제 알고리즘(`i=2`: `swap(a[2],a[j2])`, 그다음 `i=1`: `swap(a[1],a[j1])`)으로
  손으로 재추적하면, **(j2=0,j1=0) 행만 문서와 일치**하고 나머지 5행은 (j2,j1) 조합과
  결과 순열의 대응이 문서와 다르다(예: 문서는 (j2=0,j1=1)→[1,0,2]라고 하지만, 실제로는
  `a=[2,1,0]`에서 `j1=1`은 스왑이 없어 `[2,1,0]`이 된다).
- 다만 6가지 조합이 만들어내는 **결과 순열의 집합 자체(`{0,1,2}`의 6가지 순열 전부)는
  문서와 동일**하다 — 즉 "6가지 결과가 각각 1/6 확률로 나온다"는 예제 11의 핵심 결론
  자체는 여전히 유효하다. 문제는 어떤 (j2,j1) 조합이 어떤 구체적 순열을 만드는지의
  세부 대응 관계(수작업 손 추적)에 있다.
- Builder는 이 불일치를 스스로 "이게 맞다"고 판정해 문서를 조용히 따라가지 않았다.
  `logic.ts`는 ARCHITECTURE.md "2.2"가 제시한 참조 코드를 문자 그대로 구현했고(직접
  대조 완료), `logic.test.ts`에는 **실제 알고리즘을 손으로 재추적해 검증한 값**을
  기록하면서 이 판단 근거를 테스트 파일 안 주석에 상세히 남겼다(예제 11 관련 두
  테스트 케이스 참고).
- **Calculation Auditor가 반드시 재확인해야 할 사항**: (1) 위 재추적이 맞는지 독립적
  으로 다시 손으로(또는 스크립트로) 계산해 확인, (2) 맞다면 FORMULA.md 예제 11의 표를
  정정할지(Formula Analyst 영역) 결정, (3) 이 문서 오류가 다른 예제(특히 예제 13의
  N=4 전수 순열 검정 등)의 서술에도 영향을 미치는지 확인.
- 이 이슈는 계산 결과(실제 서비스 로직)에는 전혀 영향이 없다 — `fisherYatesShuffle`이
  균등 무작위 순열을 만든다는 것은 예제 12(불변식)와 별도의 수학적 논증(FORMULA.md
  "왜 Fisher-Yates가 편향 없는 균등 순열을 만드는가")으로 이미 뒷받침되며, Builder의
  구현은 ARCHITECTURE.md의 참조 코드와 동일하다. 다만 FORMULA.md 문서 자체의 예시
  표기 오류이므로 재검토 시점의 다른 역할이 오해하지 않도록 반드시 정정이 필요하다.

### 그 외 재량 판단
- **`content.ts`/`ui.tsx`의 방식 선택 UI**: SPEC.md Must Have가 몰아주기 설명 문구를
  예시로 명시했으나 균등/사다리타기 문구는 예시가 없어 Builder가 직접 작성했다(SPEC.md
  "핵심 사용자 흐름"·"정확성/공정성 요건" 절의 표현을 벗어나지 않는 범위에서 작성).
- **공유 상태 필드 태그**: `validation.ts`의 오류 필드 식별자를 `member-${index}`/
  `amount-${index}` 형태의 템플릿 리터럴 타입으로 설계했다(ARCHITECTURE.md가 구체
  형식을 정하지 않아 Builder가 결정) — 멤버/금액이 배열이라 기존 계산기들의 고정
  필드명 방식이 그대로 적용되지 않기 때문이다.
- **애니메이션 컴포넌트의 React `key` 기반 재마운트 설계**: ARCHITECTURE.md "5."가
  명시하지 않은 구현 세부사항으로, Builder가 "매 계산마다 애니메이션을 처음부터 다시
  재생해야 한다"(SPEC.md "핵심 사용자 흐름")는 요건을 만족시키기 위해
  `RouletteWheel`/`LadderAnimation`에 `key={runId}`(계산할 때마다 증가하는 카운터)를
  부여해 강제 재마운트하는 방식을 채택했다. 이 설계 전제(매 계산마다 리마운트되므로
  마운트 중 `playAnimation`/`selectedIndex`가 바뀌지 않는다)는 두 컴포넌트 파일 상단
  주석에 명시해 두었다 — UX/UI Critic·QA가 실제 재계산 시나리오(같은 결과가 연속으로
  나오는 경우 포함)에서 애니메이션이 매번 재생되는지 확인해야 한다.
- **`prefers-reduced-motion` 훅 구현체를 `useState`+`useEffect` 대신
  `useSyncExternalStore`로 구현**: ARCHITECTURE.md "5.4"는 구체 구현 방식을 정하지
  않았다. `useState`+`useEffect` 조합은 프로젝트가 이미 `components/theme-toggle.tsx`
  주석에서 언급한 "effect 안에서 곧바로 setState 호출" 안티패턴(`react-hooks/
  set-state-in-effect` ESLint 규칙)에 걸려, 브라우저 외부 상태 구독에 정확히 맞는
  `useSyncExternalStore`로 구현했다(동작은 동일 — `matchMedia` 구독).

## Calculation Auditor

### 검증 방법
- **구현 대조**: `logic.ts`/`types.ts`/`ui.tsx`/`RouletteWheel.tsx`/`LadderAnimation.tsx`
  전체를 직접 읽고 FORMULA.md "공식 ①/②/③", ARCHITECTURE.md "2.2"/"2.3"/"5."의 참조
  코드와 한 줄씩 대조했다.
- **독립 대량 시뮬레이션**: 소스를 전혀 수정하지 않고, 스크래치패드에 별도 `tsx` 스크립트
  (`audit-sim.mts`, `audit-restore-check.mts`, `audit-sim-rerun-n10.mts`)를 작성해
  `pickWinnerIndex`/`fisherYatesShuffle`/`calculateLadderSplit`/`calculateEqualSplit`/
  `restoreBillSplitResult`를 실제 `file://` URL import로 직접 호출했다(Node 24 + tsx
  4.23, 실행 명령: `npx tsx <script>.mts`).
- **카이제곱 p-value는 근사표가 아니라 직접 계산**: Numerical Recipes 방식의 정규화
  불완전감마함수(gammln/gser/gcf/gammq)를 스크립트에 직접 구현해 `df`, `chi2` → 정확한
  p-value를 산출했다. 이 구현을 FORMULA.md가 제시한 표준 임계값 6개(df=1,4,9,19,
  α=0.05 및 df=4,α=0.01, df=23,α=0.05)에 대입해 sanity check한 결과, 모두 기대
  α값에 0.001 이내로 수렴함을 확인했다(예: `chi2=9.488,df=4→p=0.04999`,
  `chi2=30.144,df=19→p=0.04999`) — 이 p-value 계산기 자체가 정확하다는 근거로 삼는다.
- **재현성 규칙 실제 적용**: FORMULA.md "재현성/우연한 실패 처리"에 따라 경계선(FAIL
  또는 α_adj에 근접한) 결과가 나온 케이스는 동일 시뮬레이션을 독립적으로 추가 반복하고
  다수결로 최종 판정했다(아래 "2." N=10 marginal 사례).

### 1. 구현 ↔ FORMULA.md 일치 여부
- **공식 ① (균등 분배)**: `calculateEqualSplit`의 `baseShare = Math.floor(totalAmount / n)`,
  `remainder = totalAmount % n`, `amount = baseShare + (index < remainder ? 1 : 0)`이
  FORMULA.md "공식 ①" 의사코드와 정확히 일치한다. **일치.**
- **공식 ② (몰아주기)**: `pickWinnerIndex(memberCount, rng) = Math.floor(rng() * memberCount)`,
  기본값 `Math.random`이 FORMULA.md/ARCHITECTURE.md "2.2" 참조 코드와 정확히 일치한다.
  RNG 호출은 `calculateWinnerTakeAll` 안에서 `pickWinnerIndex` 호출 1회뿐이고,
  `buildWinnerTakeAllShares`는 RNG를 전혀 참조하지 않는다. **일치.**
- **공식 ③ (사다리타기)**: `fisherYatesShuffle`의 반복 범위(`i = length-1`부터 `i > 0`까지),
  `j = Math.floor(rng() * (i+1))`, 스왑 로직이 FORMULA.md 의사코드와 정확히 일치한다.
  `calculateLadderSplit`이 값이 아니라 **인덱스 배열**(`members.map((_,i)=>i)`)에
  이 함수를 적용해 `permutation`을 얻는 방식도 FORMULA.md "구현 시 유의"가 권고한
  방식 그대로다. `buildLadderMatches`는 RNG를 전혀 참조하지 않는다. **일치.**
- **RNG 주입 시그니처**: `RandomSource = () => number`, `pickWinnerIndex(memberCount, rng = Math.random)`,
  `fisherYatesShuffle<T>(items, rng = Math.random)` — ARCHITECTURE.md "2.2"가 확정한
  시그니처와 인자 순서·기본값·반환 타입 모두 동일. Auditor의 시뮬레이션 스크립트가
  수정 없이 그대로 이 함수를 호출할 수 있었다(실제로 그렇게 했다). **일치.**
- **RNG 분리 원칙 실측 검증**: `restoreBillSplitResult`를 `Math.random`을 예외를
  던지도록 몽키패치한 상태에서 세 분기(equal/winner-take-all/ladder) 각 1,000회씩
  총 3,000회 호출했다 — **`Math.random` 호출 0회**로 확인(Builder의 기존 테스트와
  별개로 Auditor가 독립 스크립트로 재확인). 동일 입력 반복 호출 시 결과도 완전히
  동일함(결정적 재구성)을 확인했다. **일치, PASS.**
- **`array.sort(() => Math.random()-0.5)` 안티패턴 사용 여부**: 계산기 폴더 전체를
  `Math.random`/`sort(` 패턴으로 grep한 결과, `sort()`가 쓰인 곳은 전부 숫자 비교
  콤퍼레이터(`(a,b)=>a-b`, 테스트 파일과 `validation.ts`의 `isValidPermutation`)뿐이고
  `Math.random`이 `sort` 콜백 안에서 쓰인 사례는 없다. `Math.random()`이 직접 쓰인
  곳은 `logic.ts`의 두 RNG 원시 함수 기본값과 `LadderAnimation.tsx`의 **장식용
  가로줄(rung) 배치**(`generateDecorativeRungs`) 두 줄뿐이며, 후자는 실제 매칭 결과
  (`permutation`)에 전혀 영향을 주지 않는 순수 시각 효과임을 코드로 확인했다(rung
  좌표는 `paths`(실제 매칭 경로) 계산에 전혀 관여하지 않음). **일치, 안티패턴 없음.**
- **Golden Test 13개 조작 여부**: `logic.test.ts`를 전수 대조한 결과, 예제 1~10·12는
  FORMULA.md 수치를 그대로 옮겼고, 예제 11은 Builder가 스스로 발견한 문서 오류를
  Formula Analyst가 정정한 이후 버전과 정확히 일치한다(아래 "2." 참고). Builder가
  임의로 기대값을 조작해 테스트를 통과시킨 정황은 없다 — 오히려 문서 오류를
  투명하게 노출하고 반려 경로(EVALUATION.md 기록)를 남긴 점이 바람직하다.
- **이미지 저장 기능 구조**: `ui.tsx`의 `handleSaveImage`가 클릭 핸들러 안에서
  `await import("html-to-image")`로 동적 import하고(정적 import 없음, 메인 번들
  미포함 확인 — 파일 상단 import 목록에 `html-to-image` 없음), `toPng(cardRef.current,
  { pixelRatio: 2 })`를 호출한다. 캡처 대상 `cardRef`는 애니메이션
  `SectionCard`(룰렛/사다리타기)와 분리된 별도 `<section ref={cardRef}>`로, `revealed`
  (애니메이션 종료 후)에만 렌더링된다 — ARCHITECTURE.md "4."/"5.5"가 요구하는 "애니메이션
  제외, 결과 확정 후 컨테이너"와 정확히 일치한다. 실패 시 `catch`에서
  `imageSaveStatus="error"`로 전환해 "링크 복사" 대체 경로를 안내하는 것도 ARCHITECTURE.md
  "4. 에러 처리" 요건과 일치한다. `package.json`에서도 `html-to-image`가
  `dependencies`(devDependencies 아님)로 정확히 등록되어 있음을 확인했다. **일치.**
  (단, 실제 브라우저 다운로드 동작·iOS Safari 캡처 성공 여부는 QA 영역 — 코드 구조만
  확인함.)

### 2. FORMULA.md ↔ 실제 근거 일치 여부 (실측 데이터로 검증)

**FORMULA.md 예제 11 표를 독립적으로 재검산했다.** N=3, `a=[0,1,2]`에서 `i=2:
swap(a[2],a[j2])`, 이어서 `i=1: swap(a[1],a[j1])`을 6가지 `(j2,j1)` 조합 전부에 대해
손으로(그리고 별도로 스크립트 로직 대조로) 직접 추적한 결과, Formula Analyst가
2026-09-07에 정정한 표(`(j2=0,j1=0)→[1,2,0]`, `(0,1)→[2,1,0]`, `(1,0)→[2,0,1]`,
`(1,1)→[0,2,1]`, `(2,0)→[1,0,2]`, `(2,1)→[0,1,2]`)가 **6행 전부 정확함**을 확인했다.
Builder의 `logic.test.ts` 테스트 기대값(예: `(j2=2,j1=1)→[0,1,2]`, `(j2=1,j1=1)→[0,2,1]`)도
이 정정된 표·내 독립 재계산과 100% 일치한다. **FORMULA.md 재정정 요청 없음 — 이미
정확하게 수정되어 있다.** (Builder가 원래 발견한 오류 자체는 실재했고 이미 Formula
Analyst가 올바르게 처리했음을 확인한 것이며, 별도의 추가 "공식 재검토 요청"은 필요 없다.)

**대량 시뮬레이션 실측 결과** (Node 24.17, tsx 4.23, 스크래치패드 스크립트로 실행,
소스 미수정):

#### 2-1. 몰아주기 공정성 (`pickWinnerIndex`, N=2,3,5,10,20, 각 100,000회)

| N | df | χ² | p-value | 판정 |
|---|---|---|---|---|
| 2 | 1 | 1.5366 | 0.21512 | PASS |
| 3 | 2 | 1.8375 | 0.39903 | PASS |
| 5 | 4 | 0.1705 | 0.99657 | PASS |
| 10 | 9 | 15.8732 | 0.06958 | PASS |
| 20 | 19 | 20.2176 | 0.38159 | PASS |

5개 N 전부 1회차에 `p > 0.05`로 PASS — 재현성 규칙(재시행)이 발동할 경계선 사례
없음. FORMULA.md "공식 ②"의 모듈로 편향 부재 논증과 실측이 부합한다.

#### 2-2. 사다리타기 marginal 검정 (멤버별 특정 금액-슬롯 배정 빈도, Bonferroni 보정, 각 100,000회)

| N | α_adj | 결과 |
|---|---|---|
| 3 | 0.01667 | 멤버 3명 전원 PASS (p=0.341/0.747/0.128) — 전체 PASS |
| 4 | 0.01250 | 멤버 4명 전원 PASS (p=0.061~0.970) — 전체 PASS |
| 5 | 0.01000 | 멤버 5명 전원 PASS (p=0.070~0.892) — 전체 PASS |
| 10 | 0.00500 | 멤버 10명 전원 PASS(최소 p=0.00554, M1) — 전체 PASS (경계선, 아래 재현성 검증 참고) |
| 20 | 0.00250 | 멤버 20명 전원 PASS (p=0.076~0.994) — 전체 PASS |

**N=10 재현성 검증**: 1회차 최소 p값(M1=0.00554)이 α_adj=0.005에 근접한 경계선이라,
FORMULA.md "재현성/우연한 실패 처리" 절차에 따라 동일 조건(N=10, trials=100,000)으로
독립 3회를 추가 실행했다:
- 재시행 1/3: M5 p=0.00371 → **α_adj=0.005 미만, 해당 멤버 FAIL** → 그 회차 전체 판정 FAIL
- 재시행 2/3: 전원 PASS (p 최소 0.353)
- 재시행 3/3: 전원 PASS (p 최소 0.024)

총 4회 독립 실행(원 1회 + 재시행 3회) 중 **3회 PASS, 1회 FAIL** — Bonferroni 보정
(N=10개 동시 검정, α_adj=0.005)을 쓸 때 한 번의 전체 실행에서 우연히 1개 이상의
멤버가 임계값 아래로 떨어질 이론적 확률은 대략 `1-(1-0.005)^10 ≈ 4.9%`이므로, 4회 중
1회 FAIL은 **통계적으로 정상 범위(진짜 편향의 징후가 아니라 다중 비교의 예상된
false-positive율)**로 판단한다. FORMULA.md 5번 "재현성 규칙"의 다수결(3회 중 2회
이상 PASS) 기준을 적용하면 재시행 3회 중 2회 PASS(2/3) → **최종 PASS**로 판정한다.
매 회 `p < 0.001`처럼 극단적으로 낮은 값이 반복되지 않았다는 점도 "실제 편향이 아님"
판단의 근거다(1회차 최소 p=0.00554, 재시행1 최소 p=0.00371 — 모두 α_adj=0.005 근방이지
0.001 미만으로 반복되지 않음).

#### 2-3. 사다리타기 전수 순열 검정 (N=2,3,4,5, N!개 범주 전부)

| N | N! | trials | df | χ² | p-value | 판정 |
|---|---|---|---|---|---|---|
| 2 | 2 | 100,000 | 1 | 2.5000 | 0.11385 | PASS |
| 3 | 6 | 100,000 | 5 | 1.5429 | 0.90806 | PASS |
| 4 | 24 | 100,000 | 23 | 13.0482 | 0.95094 | PASS |
| 5 | 120 | 100,000 | 119 | 137.8736 | 0.11375 | PASS |

4개 N 모두 관측된 서로 다른 순열 개수(`distinctSeen`)가 정확히 `N!`과 일치(단 한
순열도 0회로 남지 않음, 즉 모든 이론적 순열이 실제로 관측됨)했고, 카이제곱 검정도
전부 PASS했다.

#### 2-4. 완전한 순열(bijection) 불변식 대량 검증

N=2·3(기본)·4(중복 금액 2개 포함)·5(전원 동일 금액 1원, 극단)·10·20, 각 2,000회씩
총 **12,000회** 실행 — `matches.length===n`, `{memberIndex}={0..n-1}`,
`multiset(배정 금액)===multiset(원본 amounts)`, `permutation`이 완전한 순열인지를
매회 확인. **실패 0건.** (FORMULA.md 예제 12가 요구한 불변식을 Builder의 80회보다
150배 큰 규모로, 그리고 Builder가 다루지 않은 극단 케이스— 전원 동일 금액(모든 값이
같은 완전 중복) —까지 포함해 재확인했다.)

#### 2-5. 균등 분배 산술 불변식 대량 검증

Golden Test 6개 고정 케이스(총액<인원수, 상한 1억원, 나누어떨어짐/안 떨어짐 등) +
무작위 2,000개 조합(`n`=2~20, `totalAmount`=1~100,000,000)에서 `Σ shares[i].amount
=== totalAmount` 및 "입력 순서상 앞쪽 remainder명만 +1원" 규칙을 매회 확인 — 총
**2,006개 조합, 실패 0건.**

**결론**: FORMULA.md의 두 핵심 공정성 주장(모듈로 편향이 통계적으로 검출 불가능한
수준이라는 것, Fisher-Yates가 균등 무작위 순열을 만든다는 것) 모두 실측 데이터로
뒷받침된다. FORMULA.md 자체의 오류는 예제 11 표기 오류 하나뿐이었고 이미 올바르게
정정되어 있어, 추가 "공식 재검토 요청"은 없다.

### 3. 공정성 통계 검증(FORMULA.md "공정성 통계 검증 공통 절차") — 절차 준수 여부
- 시행 횟수: 모든 검정을 100,000회로 실행(FORMULA.md 하한 10,000회의 10배, "N이
  클수록 100,000회 권장" 요건 충족). **준수.**
- 검정 방법: 몰아주기는 멤버별 카운트 카이제곱, 사다리타기는 멤버별 marginal +
  N≤5 전수 순열 카이제곱 — FORMULA.md가 정의한 두 방법을 모두 실행. **준수.**
- 유의수준: α=0.05(단순 검정), Bonferroni 보정 α_adj=0.05/N(marginal 검정) 그대로
  적용. **준수.**
- 다중 검정 보정: marginal 검정에서 N개 멤버 전원이 α_adj를 만족해야 전체 PASS로
  판정하는 규칙을 그대로 적용. **준수.**
- 재현성 규칙: N=10 marginal 검정에서 경계선 결과가 나와 실제로 3회 재시행 후
  다수결 판정을 수행함(위 "2-2" 참고). **준수, 실제로 발동해 규칙이 유효하게
  작동함을 확인.**
- 테스트 대상 N: N=2,3,5,10,20(몰아주기), N=3,4,5,10,20(사다리 marginal),
  N=2,3,4,5(사다리 전수 순열) — FORMULA.md "6. 테스트 대상 N 값"이 요구한 값과
  정확히 일치. **준수.**

### 발견된 이슈 (등급별)
- **Critical**: 없음.
- **High**: 없음.
- **Medium**: 없음.
- **Low**:
  1. FORMULA.md 예제 11의 최초 표기 오류 자체는 이미 Formula Analyst가 2026-09-07에
     정정을 완료했고, 내 독립 재검산으로도 정정된 표가 완전히 정확함을 확인했다 —
     별도 조치 불필요, 기록 목적으로만 Low로 남긴다(실서비스 로직에 영향 없었음,
     Builder가 스스로 발견해 투명하게 보고한 점은 오히려 긍정적).
  2. FORMULA.md의 marginal 통계 검증 예시(예제 13)는 N=5 기준 수치만 제시하는데,
     실제로는 N=10처럼 멤버 수가 많을수록 Bonferroni 보정 후 개별 검정 α_adj가
     작아져(예: N=20 → 0.0025) 다중 비교 상황에서 우연한 경계선 FAIL이 나올
     빈도가 실질적으로 체감될 만큼 있음을 이번 감사(N=10 사례)로 확인했다. FORMULA.md
     "재현성 규칙"이 이미 이 상황을 정확히 대비해 두었으므로 규칙 자체는 수정할
     필요가 없지만, 향후 유사 계산기(셔플/무작위 선택류)의 Formula 작성 시 "멤버
     수가 많을수록 재현성 규칙이 실제로 발동할 가능성이 높다"는 점을 참고 각주로
     남겨두면 좋겠다(문서 개선 제안, 필수 아님).

### 판정: **PASS**

- 계산 정확성(산술 불변식·공정성 통계 검증) 전 항목 실측 확인 완료, Critical/High
  이슈 없음.
- 구현이 FORMULA.md/ARCHITECTURE.md와 정확히 일치함을 코드 대조 + 실행 검증(RNG 미호출,
  안티패턴 부재, RNG 시그니처 일치)으로 확인.
- FORMULA.md 자체의 오류(예제 11)는 이미 Formula Analyst가 정정 완료했고 독립
  재검산으로 정정 내용이 정확함을 확인 — 추가 "공식 재검토 요청" 불필요.
- Golden Test 13개(logic.test.ts) 및 Auditor 자체 대량 시뮬레이션(몰아주기
  500,000회, 사다리 marginal 500,000회, 전수 순열 400,000회+, bijection 12,000회,
  균등 분배 2,006개 조합) 전부 PASS.
- 남은 항목(이미지 저장 실제 브라우저 동작, iOS Safari 호환성, UX)은 Auditor 범위
  밖 — UX/UI Critic·QA가 이어서 검증한다.

## UX/UI Critic

> 검증 방법: 코드 정적 분석(레이아웃 관점) — `SPEC.md`/`FORMULA.md`/`ARCHITECTURE.md`
> 3종과 `docs/DESIGN_SYSTEM.md`를 먼저 읽고, 실제 구현
> (`ui.tsx`/`content.ts`/`formatting.ts`/`validation.ts`/`types.ts`/`RouletteWheel.tsx`/
> `LadderAnimation.tsx`/`use-prefers-reduced-motion.ts`, 그리고 공용
> `components/calculator/ShareActions.tsx`)을 전량 대조했다. 실제 브라우저·실기기 렌더링
> 확인(모바일 320px 실측, iOS Safari 캡처 등)은 QA 영역이므로, 아래 "모바일" 관련 항목은
> 픽셀 단위 계산에 근거한 레이아웃 리스크 판단이며 QA의 실측 확인이 필요함을 표시해 둔다.

### 자체 평가 질문 (최소 10개)

각 질문 앞에 대응하는 "평가 항목"을 대괄호로 표시한다. `[필수]`는 과제가 항상 포함하라고
요구한 4개 질문이다.

1. **[평가 항목: 일반 사용자가 계산법을 몰라도 사용할 수 있는지 / 신뢰성]** 분배 방식
   선택 UI 근처의 설명 문구가 "이 룰렛/사다리타기가 진짜 공정한가, 미리 정해진 결과를
   보여주는 척만 하는 건가"라는 의심을 해소할 만큼 구체적인가?
2. **[평가 항목: 일반 사용자가 계산법을 몰라도 사용할 수 있는지]** 한명 몰아주기 결과에서
   "선정되지 않은 나머지 멤버는 0원"이라는 사실이 오해 없이 명확히 표시되는가?
3. **[평가 항목: 일반 사용자가 계산법을 몰라도 사용할 수 있는지]** 사다리타기 결과가
   "입력한 순서대로 고정 배정된 것이 아니라 무작위로 정해졌다"는 사실이 결과 화면
   자체에서도(사전 설명뿐 아니라) 확인 가능한가?
4. **[필수 질문 / 평가 항목: 입력 라벨의 표현]** 모든 입력 라벨을 FORMULA.md/SPEC.md의
   전문용어(예: "bijection", "permutation", "RandomSource", "marginal 검정")와 직접
   대조했을 때, 화면 라벨이 그 전문용어를 그대로 복사한 곳이 있는가? (이 계산기는
   `severance-pay/ui.tsx`류의 `FIELDS` 배열 패턴을 쓰지 않고 `ui.tsx`에 인라인 JSX
   라벨을 직접 쓰므로, `severance-pay`가 확립한 "일반 사용자 표현" 원칙에 라벨 하나
   하나를 개별 대조했다.)
5. **[필수 질문 / 평가 항목: 입력 순서·그룹핑]** 입력 필드 순서가 논리적 순서(방식 선택 →
   멤버 → 금액)를 따르고, 하나의 개념을 이루는 필드(사다리타기의 "멤버 이름"과 "그 멤버가
   낼 금액") 사이에 성격이 다른 필드가 끼어 있지 않은가?
6. **[필수 질문 / 평가 항목: 같은 개념의 용어 통일]** 세 가지 분배 방식의 이름이 방식
   선택 UI·진행 중 안내·핵심 결과 카드·FAQ·계산 근거 전체에서 하나의 용어로 통일되어
   있는가?
7. **[필수 질문 / 평가 항목: 입력 필드 수 최소화]** 다른 입력에서 유도 가능한 값을
   중복으로 묻는 필드가 있는가(예: 사다리타기에서 "총 금액"을 별도로 또 묻는지)?
8. **[평가 항목: 입력 라벨의 Placeholder 명확성]** 금액 입력 필드들의 placeholder가
   방식·위치에 관계없이 일관되게 예시 값을 제공하는가?
9. **[평가 항목: 결과 가독성]** 핵심 결과 카드가 방식별로 SPEC.md Must Have가 요구하는
   "(1) 선택된 분배 방식, (2) 멤버별 최종 금액(또는 선정자+전액), (3) 총 금액"을 모두
   한눈에 담고 있으며, 이미지 캡처 대상과 정확히 일치하는가?
10. **[평가 항목: 모바일 사용성(레이아웃 관점)]** 사다리타기 모드의 "멤버 이름 + 금액 +
    삭제 버튼" 한 행이 320px 화면에서 잘리거나 지나치게 좁아지지 않는가(픽셀 계산 근거
    필요)?
11. **[평가 항목: 오류 메시지의 이해 용이성]** 검증 오류 메시지가 어떤 필드에 어떤 문제가
    있는지 구체적으로 안내하고, 화면상 해당 입력 바로 옆에 표시되는가?
12. **[평가 항목: 계산 과정(근거 breakdown)을 이해할 수 있는지]** 균등 분배에서 "왜
    특정 멤버만 1원 더/덜 내는지"가 계산 근거 섹션에서 구체적 이름과 함께 설명되는가?
13. **[평가 항목: 계산 과정을 이해할 수 있는지]** 몰아주기·사다리타기의 계산 근거
    섹션이 "무작위로 공정하게 결정되었다"는 설명을 일반 사용자 언어로 담고 있는가?
14. **[평가 항목: 불필요한 UI 요소 존재 여부]** 이미지 저장 실패 시 대체 경로 안내
    문구가 실제 화면 배치와 일치하는가(안내가 가리키는 위치가 실제로 맞는 방향인가)?
    또 결과 화면에 정보가 중복 표시되는 곳은 없는가?
15. **[추가: 애니메이션 접근성(작업 지시 특칙)]** `prefers-reduced-motion` 사용자에게
    애니메이션이 생략되고 결과가 즉시 나오는가? `aria-live` 영역이 애니메이션 재생
    중에도 스크린리더 사용자에게 적절한 시점에 정보를 전달하는가?
16. **[추가: 이미지 저장 버튼 발견 가능성(작업 지시 특칙)]** 계산 후 이미지 저장
    기능이 눈에 잘 띄고, 버튼 라벨이 명확한가?
17. **[추가: 방식 전환 UX(작업 지시 특칙)]** 방식 전환 시 입력 폼 구성 자체가 바뀌는
    것(사다리타기만 금액 목록 입력)이 사용자에게 혼란을 주지 않는가?

### 답변 및 등급

**Q1 — 방식 선택 UI 설명 문구의 신뢰성 (문제없음)**
`content.ts`의 `billSplitModeDescriptions`가 방식 선택 라디오 옆에 그대로 노출된다
(`ui.tsx` 377~380행). 몰아주기 문구는 SPEC.md Must Have가 제시한 예시 문장("이 방식은
앱이 멤버 중 한 명을 무작위로 골라...")을 거의 그대로 쓰고 "각 멤버가 선정될 확률은
정확히 1/N로 모두 같습니다"까지 명시한다. 사다리타기 문구도 "입력 순서대로 고정 배정
되지 않는다"는 취지와 "N!가지 매칭이 동일 확률"이라는 공정성 근거를 계산 실행 전에
먼저 알려준다. FAQ("한명 몰아주기는 누가 걸릴지 앱이 미리 정해두는 건가요?")가 이
질문을 정확히 그 문구로 다시 다루며 "애니메이션이 결과를 다시 정하지 않는다"까지
설명한다 — SPEC.md가 요구한 신뢰 확보 문구 요건을 충분히 충족한다. **문제없음.**

**Q2 — 몰아주기 "나머지 0원" 명확성 (문제없음)**
`KeyResultBody`의 `winner-take-all` 분기(`ui.tsx` 151~159행)가 "나머지 멤버는
0원입니다."를 별도 문장으로 명시한다. `formatting.ts`의 `buildWinnerTakeAllBreakdown`도
"나머지 멤버는 0원입니다"를 계산 근거에서 다시 언급해 결과 카드와 근거 섹션 두 곳에서
일관되게 확인 가능하다. **문제없음.**

**Q3 — 사다리타기 "무작위 배정" 결과 화면 내 확인 가능성 (Low)**
방식 선택 단계의 설명 문구(Q1)와 계산 후 "계산 근거" 섹션(`buildLadderBreakdown`)에는
"Fisher-Yates 셔플로... 무작위 매칭합니다"가 명시돼 있다. 다만 핵심 결과 카드의
매칭 목록(`KeyResultBody`의 `ladder` 분기) 자체에는 목록 바로 옆에 "무작위로 정해진
결과"라는 안내가 없고, `matches[i].memberIndex = i`이므로 화면에 표시되는 멤버 순서가
입력한 순서와 동일하게 유지된다(금액만 바뀐다) — 순수하게 목록만 보면 "그냥 순서대로
나열된 것 아닌가"라고 오해할 여지가 이론적으로 있다. 다만 결과 카드 바로 아래
"계산 근거" 섹션이 같은 페이지, 같은 `aria-live` 영역 안에 있어 스크롤 한 번이면
확인 가능하고, 사전 설명(Q1)도 이미 충분해 실제 오해로 이어질 위험은 낮다. **Low** —
핵심 결과 카드 안에 "무작위로 배정된 결과입니다" 한 줄을 추가하면 더 견고해진다.

**Q4 — [필수] 라벨의 전문용어 여부 (문제없음)**
`ui.tsx`의 실제 라벨은 "분배 방식", "멤버 이름", "총 금액(원)", "금액(원)" 뿐이다.
FORMULA.md/ARCHITECTURE.md의 전문용어(`RandomSource`, `permutation`, `bijection`,
`marginal 검정`, `Fisher-Yates`)는 라벨에 전혀 등장하지 않는다. "Fisher-Yates"라는
알고리즘명은 계산 근거(`formatting.ts`)와 FAQ에서만 등장하는데, 그 자리에서도 항상
괄호로 "(편향 없는 균등 무작위 순열 알고리즘)"이라는 일반어 설명을 바로 붙여
쓴다 — `severance-pay`가 "법령 용어는 라벨이 아니라 helpText에"라고 정한 원칙과 같은
층위(라벨이 아니라 보조 설명)에 정확히 위치한다. **문제없음.**

**Q5 — [필수] 입력 순서·그룹핑 (문제없음, 참고 사항 1건)**
사다리타기 모드에서는 멤버 이름 입력과 그 멤버의 금액 입력이 한 행(`flex` row) 안에
바로 인접해 있어(`ui.tsx` 404~445행) "두 필드가 하나의 개념을 이룬다"는 원칙을 잘
지킨다. 다만 균등/몰아주기에서는 "총 금액" 입력이 "멤버 이름" 목록보다 아래(뒤)에
배치되어 있다 — 날짜 쌍처럼 순서가 강제되는 값은 아니고, "총 금액을 먼저 정하고
누구와 나눌지 정하는 사용자"와 "누구와 나눌지 먼저 정하고 금액을 확인하는 사용자"
둘 다 자연스러워 규칙 위반은 아니지만, SPEC.md 자신의 "입력: 총 금액(필수) + 멤버
이름 목록" 서술 순서와는 반대다. **문제없음**(규칙 위반 아님, 참고용 스타일 메모).

**Q6 — [필수] 같은 개념의 용어 통일 (Low)**
사다리타기 모드명이 두 가지 표기로 나뉜다: `content.ts`의
`billSplitModeShortLabels.ladder = "인원별 금액설정(사다리타기)"`(방식 선택 라디오
라벨, 그리고 애니메이션 중 `SectionCard` 제목 "인원별 금액설정(사다리타기) 진행"에
쓰임)와 `formatting.ts`의 `billSplitModeLabels.ladder = "사다리타기"`(핵심 결과 카드
상단 eyebrow 라벨에 쓰임). SPEC.md 자신도 절 제목은 "3. 인원별 금액설정(사다리타기)"
으로 쓰고 본문에서는 "사다리타기"로 줄여 쓰는 관례가 있어 완전히 다른 용어를
만든 것은 아니지만("사다리타기"가 긴 이름의 부분 문자열), 화면 곳곳에서 정식 명칭과
축약 명칭이 규칙 없이 혼재해 DESIGN_SYSTEM.md "같은 개념은 폼·결과·오류 메시지
전체에서 한 용어로 통일한다"는 원칙을 엄밀하게는 지키지 못한다. **Low** — 실제
사용자가 다른 기능으로 오인할 위험은 낮지만(부분 문자열 관계), `billSplitModeLabels`도
"인원별 금액설정(사다리타기)"로 통일하거나 반대로 짧은 이름 하나로 통일할 것을 권장.

**Q7 — [필수] 입력 필드 수 최소화 (문제없음)**
사다리타기 모드는 SPEC.md가 명시한 대로 "총 금액" 필드 자체가 없다(`ui.tsx` 475행
`{mode !== "ladder" && (...)}`) — 금액 목록 합계로 유도 가능한 값을 별도로 다시 묻지
않는다. 균등/몰아주기도 "멤버 수"를 별도로 묻지 않고 멤버 이름 목록의 길이로 자동
계산한다. 세 방식 모두 꼭 필요한 값만 요구하며 중복 입력 요구가 없다. **문제없음.**

**Q8 — Placeholder 명확성 (Low)**
"총 금액" 입력의 placeholder는 "예: 30,000"으로 구체적 예시를 준다(`ui.tsx` 490행).
반면 사다리타기의 멤버별 "금액" 입력은 placeholder가 "금액(원)"뿐이고 구체적 숫자
예시가 없다(`ui.tsx` 436행) — 같은 "금액 입력"이라는 성격의 필드인데 한쪽만 예시
숫자를 제공해 일관성이 떨어진다. **Low.**

**Q9 — 결과 가독성 / 이미지 캡처 요건 충족 (문제없음)**
핵심 결과 카드(`ui.tsx` 571~588행, `cardRef`로 이미지 캡처 대상과 동일)는 상단에
선택된 방식 라벨, 중앙에 방식별 `KeyResultBody`(균등: 멤버별 금액 목록, 몰아주기:
선정자+전액, 사다리타기: 매칭 목록+참고 합계), 하단에 `formatResultSummary` 한 줄
요약(총 금액이 세 방식 모두에 자연스럽게 포함됨)까지 갖춰 SPEC.md Must Have "이미지에
(1)방식 (2)멤버별 금액 (3)총 금액 포함" 요건을 실제 캡처 컨테이너 안에서 그대로
충족한다. 금액은 `tabular-nums`로 자릿수 정렬되고 `Intl.NumberFormat('ko-KR')`로
천단위 구분되어 가독성이 좋다. **문제없음.**

**Q10 — 모바일: 사다리타기 멤버+금액 입력 행 320px 레이아웃 (High, QA 실측 필요)**
`ui.tsx`의 멤버 행은 `<div className="flex items-start gap-2">` 안에 `flex-1` 이름
입력 + (사다리타기 모드면) `flex-1` 금액 입력 + 고정폭 "삭제" 버튼을 나란히 배치하고,
좁은 화면에서 세로로 쌓이는 반응형 분기(`sm:flex-col` 등)가 없다. 페이지
컨테이너(`px-5`, 320px 기준 양쪽 20px)와 폼 컨테이너(`p-5`, 양쪽 20px)를 빼면 실제
행에 남는 폭은 약 240px이고, 여기서 "삭제" 버튼(패딩+텍스트 약 55~60px)과
`gap-2`(8px) 두 번(약 16px)을 제하면 두 입력 필드가 나눠 가지는 폭은 약 164px, 필드
하나당 약 82px, 입력 자체의 좌우 패딩(`px-3.5`, 총 28px)을 빼면 실제 글자가 보이는
폭은 약 54px 수준으로 추정된다. 이는 "멤버 1 이름"(6자) 같은 placeholder 전체가
보이지 않거나, "1,000,000"처럼 7자리 금액을 입력할 때 입력값이 필드 안에서 계속
스크롤돼야 하는 수준으로, 페이지 자체의 가로 스크롤은 발생하지 않지만(각 입력이
`flex-1`로 폭 안에 강제로 눌리므로) 실제 타이핑·확인 가독성이 크게 저해될 것으로
추정된다. 이는 세 방식 중 사다리타기에만 있는 조합(이름+금액 동시 입력)이라 균등/
몰아주기에는 해당하지 않는다. SPEC.md Must Have가 "320px... 화면에서 가로 스크롤
없이 동작해야 한다"와 "멤버 목록이 작은 화면에서도 잘리지 않아야 한다"를 명시적으로
요구하는 만크, 이 계산에 근거해 **High**로 표시한다 — 다만 이는 코드상 치수 계산에
근거한 레이아웃 리스크 판단이며, 실제 렌더링·실기기 확인은 QA가 수행해야 한다. 개선
방향(참고, Optimizer 재량): 320~639px 구간에서는 이름/금액 입력을 두 줄로 쌓거나
(`grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto]` 류), 삭제 버튼을 아이콘 전용으로
축소해 여유 폭을 확보하는 방법이 있다.

**Q11 — 오류 메시지 이해 용이성 (문제없음)**
`validation.ts`의 오류 메시지("이름을 입력해 주세요.", "총 금액은 1원 이상
100,000,000원 이하로 입력해 주세요.", "멤버는 2명 이상 20명 이하로 입력해 주세요.")는
구체적 허용 범위를 숫자로 명시하고, `ui.tsx`가 `field: member-${index}` /
`amount-${index}` 단위로 오류를 추적해 해당 입력 바로 아래 `role="alert"` +
`aria-describedby`로 연결한다(예: `${formId}-member-${index}-error`). "금액 목록
개수가 멤버 수와 일치하지 않습니다. 새로고침 후 다시 시도해 주세요."는 정상 사용
흐름에서는 거의 발생하지 않는 방어적 메시지지만, 발생 시 사용자가 취할 행동(새로고침)
을 구체적으로 알려준다. **문제없음.**

**Q12 — 균등 분배 나머지(잔돈) 설명 (문제없음)**
`buildEqualSplitBreakdown`(`formatting.ts` 53~74행)이 "나누어떨어지지 않는 나머지
N원은 입력 순서상 앞쪽 N명(구체적 이름 나열)에게 1원씩 추가로 배분되어 총액과 정확히
일치합니다"라고 실제 이름을 나열해 설명한다. FAQ("균등 분배에서 왜 어떤 사람은 1원
더 내나요?")도 같은 규칙(입력 순서 기준, 결정적 처리)을 다시 설명해 "왜 나만 더
내지"라는 오해를 이중으로 방지한다. **문제없음.**

**Q13 — 몰아주기·사다리타기 "무작위로 공정하게 결정" 설명 (문제없음)**
`buildWinnerTakeAllBreakdown`은 "각자 선정될 확률 정확히 1/N, 표준 균등 난수
알고리즘"을, `buildLadderBreakdown`은 "Fisher-Yates 셔플(편향 없는 균등 무작위 순열
알고리즘)로... N!가지 매칭이 모두 동일한 확률"을 계산 근거에 명시한다. 법령 출처
자리에 "표준 알고리즘" 라벨을 쓰는 것은 `loan-interest-calculator`가 법령 자리에
"재무수학"을 쓴 선례와 같은 방식이라 이 계산기 성격에 맞다. **문제없음.**

**Q14 — 불필요한 UI 요소 / 안내 위치 정확성 (Medium 1건 + Low 1건)**
- (Medium) 이미지 저장이 실패했을 때 뜨는 안내 문구가 "아래 공유의 '링크 복사'로
  결과를 대신 공유해 보세요."(`ui.tsx` 600~603행)라고 안내하지만, 실제 DOM 순서상
  `ShareActions`(공유 액션, "링크 복사" 버튼 포함)는 이 오류 메시지보다 **위쪽**(폼
  바로 아래, `ui.tsx` 525~541행)에 위치하고, 오류 메시지는 그보다 한참 아래(결과
  섹션 안, `ui.tsx` 599~604행)에 있다. 즉 "아래"라는 방향 지시가 실제 화면 배치와
  반대다 — 사용자가 안내를 따라 아래쪽을 찾으면 해당 버튼을 발견하지 못하고 스크롤을
  거꾸로 올려야 한다. **Medium**(기능 자체는 존재해 사용 불가능하지는 않지만, 잘못된
  방향 안내는 명백한 문구 오류다). 수정 제안: "아래" → "위" 또는 "위쪽 공유 영역의".
- (Low) `RouletteWheel`의 이름-번호 매핑 범례(`<ol>`, `RouletteWheel.tsx` 135~143행)는
  멤버 수(N)에 관계없이 항상 렌더링된다. N ≤ 10일 때는 룰렛 부채꼴 안에 이미 전체
  이름이 표시되므로(`NAME_LABEL_THRESHOLD = 10`), 이 경우 범례가 같은 정보(이름
  목록)를 아래에 다시 나열해 정보가 중복된다 — N > 10일 때만 꼭 필요한 요소다.
  **Low**(정보성 중복일 뿐 오류는 아님, N ≤ 10일 때 범례를 생략하거나 접이식으로
  처리하면 더 간결해진다).

**Q15 — 애니메이션 접근성: reduced-motion / aria-live 타이밍 (Low, 1건 참고 사항 추가)**
`usePrefersReducedMotion`이 `true`를 반환하면 `ui.tsx`가 `playAnimation=false`로
`RouletteWheel`/`LadderAnimation`에 전달하고, 두 컴포넌트 모두 `useEffect`에서
`playAnimation`이 `false`이면 마운트 즉시 `onAnimationEnd()`를 호출해 트랜지션 없이
최종 상태를 렌더링한다(`RouletteWheel.tsx` 74~78행, `LadderAnimation.tsx` 93~97행) —
SPEC.md "애니메이션 생략, 결과 즉시 표시" 요건을 정확히 만족한다. 결과 영역 전체가
`aria-live="polite"`(`ui.tsx` 544행)로 감싸여 있어 애니메이션이 생략된 경우 결과가
사실상 즉시 스크린리더에 전달된다. 다만 `prefers-reduced-motion`을 OS 레벨에서 켜지
않은 스크린리더 사용자(적지 않게 존재)는 시각적 애니메이션의 혜택을 전혀 받지
못하면서도(두 SVG 모두 `aria-hidden="true"`) 일반 사용자와 동일하게 2.6~3.2초의
지연 후에야 결과를 듣게 된다 — SPEC.md가 요구하는 범위를 벗어나는 사항이라 위반은
아니지만, 스크린리더 전용 사용자를 위한 "결과 건너뛰기" 같은 보완 장치는 없다.
추가로, `RouletteWheel`은 애니메이션 시작 시점에 이름-번호 범례를 통해 최소한 참여자
목록을 스크린리더에 노출하는 반면, `LadderAnimation`은 SVG 밖에 그런 보조 정보가
전혀 없어(전부 `aria-hidden`) 두 컴포넌트 간 스크린리더 정보 제공 수준이 다르다.
**Low** — SPEC 위반은 아니지만 접근성 품질 편차가 있어 참고용으로 기록.

**Q16 — 이미지 저장 버튼 발견 가능성 (문제없음)**
"결과 이미지 저장" 버튼(`ui.tsx` 590~598행)은 핵심 결과 카드 바로 아래, 계산 근거
섹션보다 위에 위치하며 주요 액션과 동일한 `bg-primary` 스타일(계산하기 버튼과 같은
시각적 위계)을 쓴다. 진행 중에는 "이미지 생성 중…"으로 라벨이 바뀌어 상태를 알려주고,
실패 시 대체 경로 안내(단, 방향 오류는 Q14에서 별도 지적)가 뜬다. 라벨 자체("결과
이미지 저장")는 기능을 명확히 설명한다. **문제없음.**

**Q17 — 방식 전환 시 입력 폼 변화로 인한 혼란 여부 (문제없음)**
방식 라디오를 바꾸면 `handleModeChange`가 즉시 `clearResult()`를 호출해 이전 결과를
숨기므로, 새 방식의 결과인 것처럼 오해할 수 있는 낡은 결과가 화면에 남지 않는다.
멤버 이름 목록은 방식 전환과 무관하게 유지되어 다시 입력할 필요가 없고, 사다리타기로
전환하면 각 멤버 이름 입력 옆에 금액 입력이 자연스럽게 추가로 나타나는 형태라(완전히
다른 레이아웃으로 전환되는 것이 아니라 기존 행에 열이 하나 늘어나는 형태) 전환 전후의
시각적 연속성이 유지된다. 방식 선택 UI 바로 옆의 설명 문구(Q1)가 전환 시 필드 구성이
달라지는 이유(총 금액 vs 금액 목록)도 미리 알려준다. **문제없음.**

### 발견된 이슈 (등급별 요약)

| 등급 | 개수 | 내용 |
|---|---|---|
| Critical | 0 | — |
| High | 1 | Q10 — 사다리타기 모드 "멤버 이름 + 금액 + 삭제" 입력 행이 320px에서 극히 좁아질 것으로 추정됨(치수 계산 근거, QA 실측 필요) |
| Medium | 1 | Q14 — 이미지 저장 실패 안내 문구의 방향 지시("아래")가 실제 화면 배치(공유 액션은 위쪽에 위치)와 반대 |
| Low | 6 | Q3 결과 목록에 "무작위 배정" 안내가 인접하지 않음 / Q6 사다리타기 모드명 표기 불일치("인원별 금액설정(사다리타기)" vs "사다리타기") / Q8 사다리타기 금액 입력 placeholder에 예시 숫자 없음 / Q14 N≤10일 때 룰렛 이름-번호 범례 중복 표시 / Q15 스크린리더 전용 사용자의 불필요한 대기 시간 및 두 애니메이션 컴포넌트 간 보조 정보 제공 수준 편차 / FORMULA.md 예제 11 관련(이미 Calculation Auditor가 기록·해결) |
| 문제없음 | 10 | Q1, Q2, Q4, Q5, Q7, Q9, Q11, Q12, Q13, Q16, Q17 |

### 평가 결과
- 발견된 이슈 (등급별): Critical 0 / High 1 / Medium 1 / Low 6 (위 표 참고)
- 판정: **FAIL**
  - 근거: `docs/EVALUATION.md` PASS 기준("Critical 0, High 0")을 High 1건(Q10, 사다리타기
    입력 행의 320px 레이아웃 리스크)이 충족하지 못한다. 이 항목은 SPEC.md Must Have가
    명시한 "320px 화면에서 가로 스크롤 없이 동작", "멤버 목록이 작은 화면에서도 잘리지
    않아야 한다"는 요건과 직접 관련되고, 세 방식 중 사다리타기(Must Have 대상)에서만
    발생하는 구조적 리스크이므로 QA로 그대로 넘기기보다 Optimizer가 레이아웃을 먼저
    조정한 뒤 재검증하는 것을 권장한다.
  - Medium 1건(Q14, 이미지 저장 실패 안내 문구의 방향 오류)도 PASS를 막는 항목은
    아니지만 실제 사용자에게 혼란을 줄 수 있는 명백한 문구 오류이므로 같은 Optimizer
    라운드에서 함께 수정할 것을 권장한다.
  - 나머지 Low 6건은 PASS/FAIL 판정에 영향을 주지 않으며, 참고용 개선 제안으로 남긴다.

## Optimizer 수정 (라운드 1)

> UX/UI Critic 보고서(위 "## UX/UI Critic")가 지적한 High 1건 · Medium 1건 · Low 6건을
> 수정했다. `logic.ts`/`types.ts`/RNG 관련 코드는 건드리지 않았다(보고서 지시대로). 새
> 기능은 추가하지 않았다 — 모두 기존 요소의 레이아웃/문구/표기 수정이다.

### High (Q10) — 사다리타기 멤버 입력 행의 320px 레이아웃

`src/calculators/bill-split-calculator/ui.tsx`의 멤버 행(舊 404~455행)을 모드별로
분기했다:
- 균등/몰아주기(이름 입력만 있는 행): 기존 `flex items-start gap-2` + 두 `flex-1`을
  **그대로 유지**(Critic이 "문제없음"으로 확인한 레이아웃이라 손대지 않음).
- 사다리타기(이름+금액 두 입력이 있는 행): `grid grid-cols-1 gap-2
  sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start`로 변경 — 640px(sm)
  미만에서는 이름 입력 → 금액 입력 → 삭제 버튼이 각각 행 전체 폭을 쓰며 세로로 쌓이고,
  640px 이상에서만 한 행(이름/금액/삭제 3열)으로 합쳐진다. 320px 기준 계산: 페이지
  컨테이너(`px-5`, 40px)+폼 컨테이너(`p-5`, 40px)를 뺀 실제 폭 약 240px를 이름 입력
  하나가 거의 그대로 차지하므로(기존 약 82px → 약 200px 이상), Critic이 우려한
  "필드 하나당 약 54px" 문제가 해소된다. 이름/금액 입력 wrapper의 클래스도 `flex-1`
  (그리드에서는 의미 없음) 대신 `min-w-0`(그리드 트랙 안에서 내용이 넘치지 않도록)으로
  바꿨고, 삭제 버튼에 `justify-self-start`를 추가해 모바일 1열 배치에서 버튼이 불필요하게
  늘어나지 않고 왼쪽 정렬되도록 했다.
- 기존 `.claude`/tailwind v4 프로젝트에 이미 같은 아치형 arbitrary-value 문법
  (`sm:grid-cols-[8rem_minmax(0,28rem)]`, `four-major-insurance/ui.tsx`)이 쓰이고
  있어 새로운 패턴을 도입한 것이 아니다.
- 회귀 테스트 추가(`ui.test.tsx`): 균등/몰아주기 모드에서는 행 className에
  `"flex items-start gap-2"`가 그대로 남아있는지, 사다리타기 모드에서는
  `"grid-cols-1"`과 `"sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"`가 적용되는지
  클래스 문자열로 검증(jsdom은 실제 픽셀 렌더링을 하지 않으므로 클래스/구조 검증 위주).

### Medium (Q14) — 이미지 저장 실패 안내 문구의 방향 오류

`ui.tsx`의 실패 안내 문구를 "아래 공유의 '링크 복사'로…" → **"공유 영역의 '링크
복사'로…"**로 수정해 방향(위/아래)에 의존하지 않는 표현으로 바꿨다(`ShareActions`가 실제
DOM상 이 문구보다 위에 있다는 Critic 지적 반영). 회귀 테스트 추가: `html-to-image`의
`toPng`가 항상 실패하도록 모킹한 뒤 이미지 저장 버튼을 눌러 실제로 뜨는 문구에 "아래"가
없고 "공유 영역의"가 포함되는지 확인한다.

### Low 6건

1. **사다리타기 결과 목록에 "무작위 배정" 안내 인접 배치** — `KeyResultBody`의 `ladder`
   분기(`ui.tsx`)에서 "멤버-금액 매칭 결과" 제목 바로 아래에 "사다리타기로 무작위로
   배정된 결과입니다." 한 줄을 추가해, 결과 목록을 보는 시점에 바로 위에서 확인 가능하게
   했다(기존에는 방식 선택 단계 설명·계산 근거 섹션에만 있었음).
2. **사다리타기 모드명 표기 불일치** — 지시대로 SPEC.md 원문 표기
   "인원별 금액설정(사다리타기)"(`content.ts`의 `billSplitModeShortLabels`)를 "풀네임이
   필요한 곳"(방식 선택 라디오 라벨)에만 쓰고, "짧아도 되는 곳"(애니메이션 진행 중
   `SectionCard` 제목, 핵심 결과 카드 eyebrow 배지)은 모두 `formatting.ts`의
   `billSplitModeLabels`(짧은 이름 "사다리타기")로 통일했다. 구체적으로는 `ui.tsx`의
   `SectionCard title={... 진행}`이 참조하는 상수를 `billSplitModeShortLabels` →
   `billSplitModeLabels`로 바꿨다(라디오 라벨은 그대로 풀네임 유지). 두 상수 정의부에
   각각 용도를 명시하는 주석을 추가해 앞으로 혼용되지 않도록 문서화했다.
3. **사다리타기 금액 입력 placeholder에 예시 숫자 없음** — "금액(원)" → **"예: 10,000"**
   으로 변경(총 금액 입력의 기존 placeholder "예: 30,000"과 같은 형식으로 통일).
4. **N≤10일 때 룰렛 이름-번호 범례 중복 표시** — `RouletteWheel.tsx`의 `<ol>` 범례를
   `NAME_LABEL_THRESHOLD`(10) 초과일 때만 시각적으로 표시하고, 10 이하일 때는
   `sr-only`로 전환했다(DOM에서 완전히 제거하지 않음 — 아래 5번과 함께 스크린리더용
   참여자 목록으로 계속 제공).
5. **스크린리더 보조 정보 수준 편차** — `LadderAnimation.tsx`에 `RouletteWheel`의 범례와
   같은 수준의 `sr-only` 목록(참여 멤버 이름, 금액 후보)을 추가해 두 애니메이션 컴포넌트가
   제공하는 보조 텍스트 수준을 맞췄다. RouletteWheel의 범례도 4번 조치로 N≤10일 때
   `sr-only`로 남아 있어(제거가 아님) 시각적 중복은 없애면서 스크린리더 정보 제공은
   유지된다. (스크린리더 전용 사용자의 "불필요한 대기 시간" 자체는 결과 건너뛰기 같은 새
   컨트롤이 필요해 범위 밖으로 남겨두었다 — 보고서에 없는 기능을 추가하지 않기 위함.)
6. FORMULA.md 예제 11 관련 — Calculation Auditor가 이미 해결 확인했으므로 조치하지
   않았다.

### 검증 결과
- `npx vitest run src/calculators/bill-split-calculator --no-file-parallelism`: **6개
  파일, 70개 테스트 전부 통과**(기존 66개 + 신규 회귀 테스트 4개: 레이아웃 클래스 2건,
  placeholder 1건, 이미지 저장 실패 문구 1건).
- `npx vitest run --no-file-parallelism`(전체 스위트, 회귀 확인): **64개 파일, 698개
  테스트 전부 통과**.
- `npx tsc --noEmit`: 오류 없음.
- `npx eslint src/calculators/bill-split-calculator`: 오류 없음.
- `npm run build`: 성공(Next.js 프로덕션 빌드, 정적 페이지 생성 포함).

### 수정한 파일
- `src/calculators/bill-split-calculator/ui.tsx` — 멤버 행 레이아웃(High), 이미지 저장
  실패 문구(Medium), 사다리타기 결과 목록 "무작위 배정" 안내(Low 1), SectionCard 제목
  라벨 상수 교체(Low 2), 금액 placeholder(Low 3).
- `src/calculators/bill-split-calculator/content.ts` — `billSplitModeShortLabels` 용도
  설명 주석 추가(Low 2).
- `src/calculators/bill-split-calculator/formatting.ts` — `billSplitModeLabels` 용도
  설명 주석 추가(Low 2).
- `src/calculators/bill-split-calculator/RouletteWheel.tsx` — N≤10일 때 범례
  `sr-only` 전환(Low 4, 5).
- `src/calculators/bill-split-calculator/LadderAnimation.tsx` — 참여 멤버/금액 후보
  `sr-only` 목록 추가(Low 5).
- `src/calculators/bill-split-calculator/ui.test.tsx` — 회귀 테스트 4건 추가.

이 라운드에서는 최종 판정을 내리지 않는다 — UX/UI Critic이 위 수정 사항을 다시
검증해야 한다(Calculation Auditor 재검증은 `logic.ts`/`types.ts`/RNG 코드를 건드리지
않았으므로 범위상 재검증 대상 변경 없음).

## UX/UI Critic 재검증 (라운드 1)

> 재검증 범위: 과제 지시에 따라 평가 질문을 처음부터 새로 만들지 않고, Optimizer 라운드 1이
> 수정을 주장한 항목(Q10 High, Q14 Medium, Low 6건)만 다시 확인한다. 확인 방법은 이전
> 라운드와 동일하게 코드 정적 분석(레이아웃 관점)이며, 이번에는 특히 Q10(320px 그리드 전환)을
> 실제 Tailwind 클래스 기준으로 직접 픽셀 계산해 재검산했다. 실제 브라우저/실기기 렌더링
> 확인은 이전과 마찬가지로 QA 영역이다. 대조한 파일: `ui.tsx`, `ui.test.tsx`,
> `RouletteWheel.tsx`, `LadderAnimation.tsx`, `content.ts`, `formatting.ts`.

### 1. High (Q10) 재검증 — 사다리타기 멤버 입력 행 320px 레이아웃

**결론: 해소됨.**

`ui.tsx` 404~467행을 직접 재대조했다. 행 컨테이너 className이 다음과 같이 모드별로
분기되어 있음을 확인했다(舊 코드와 정확히 일치, Optimizer 보고 내용 그대로 반영됨):
- 균등/몰아주기: `"flex items-start gap-2"` (변경 없음)
- 사다리타기: `"grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start"`

320px 폭에서 실제 가용 폭을 처음부터 직접 재계산했다(Optimizer 보고 수치를 그대로
가져오지 않고 클래스명을 기준으로 독립적으로 다시 계산):
- 페이지 컨테이너: `mx-auto w-full max-w-6xl ... px-5 ... sm:px-8`. `sm` 브레이크포인트는
  640px 이상에서만 적용되므로 320px에서는 `px-5`(1.25rem=20px) 양쪽 → 40px 소비.
- 폼 컨테이너: `mt-8 space-y-7 rounded-2xl ... p-5 ... sm:p-8`. 마찬가지로 320px에서는
  `p-5`(20px) 양쪽 → 40px 소비.
- 두 컨테이너 모두 320px 미만 폭에서는 `sm:` 접두사가 걸리지 않으므로, 멤버 행에 남는
  실제 폭은 `320 - 40 - 40 = 240px`(Optimizer 계산과 일치).
- 사다리타기 행 자체는 `grid-cols-1`(sm 미만에서 단일 열)이므로, 이름 입력 wrapper·금액
  입력 wrapper·삭제 버튼이 **각각 별도의 그리드 행(세로 스택)으로 240px 전체 폭**을
  차지한다(이전 버전처럼 240px를 이름/금액/삭제 3개가 한 줄에서 나눠 갖지 않음).
- 이름 입력(`FIELD_CLASS`의 `w-full`)은 이제 240px 트랙 전체를 얻고, 입력 자체의
  좌우 패딩(`px-3.5`=14px×2=28px)을 빼면 실제 텍스트 표시 폭은 약 212px — 이전 버전의
  "필드 하나당 약 54px" 추정치 대비 약 4배 개선되어, "멤버 1 이름"(6자) placeholder나
  7자리 금액("1,000,000")이 입력창 안에서 잘리지 않고 표시될 수 있는 여유 폭이다.
  금액 입력도 동일한 계산으로 약 212px를 확보한다(둘 다 grid-cols-1 상태에서는 별도
  행이므로 서로 폭을 나눠 갖지 않는다).
- 삭제 버튼은 `justify-self-start`가 추가되어 grid-cols-1(단일 열) 상태에서 트랙
  전체 폭으로 늘어나지 않고 콘텐츠 크기(패딩+"삭제" 2글자, 약 55~60px)만큼만 왼쪽
  정렬된 상태로 자기 행에 표시된다 — 불필요하게 폭 전체를 차지하는 버튼이 되지 않는다.
- 640px(sm) 이상에서는 `sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]`로 3열
  전환되며, 이 폭에서는 컨테이너 패딩이 `sm:px-8`/`sm:p-8`(각 32px)로 늘어 가용 폭이
  `640-64-64=512px`, 이름/금액 각 `minmax(0,1fr)`이 auto(삭제 버튼) 폭을 뺀 나머지를
  균등 분할하므로 필드당 200px 이상이 확보되어 문제가 없다.
- 결과적으로 320px~639px 구간(세로 스택)과 640px 이상 구간(3열) 모두에서 필드가
  54px 수준으로 좁아지는 시나리오는 발생하지 않는다. **High 이슈 해소로 판정.**

**회귀 확인**: `ui.tsx` 416행 `<div className={mode === "ladder" ? "min-w-0" : "flex-1"}>`을
확인해, 균등/몰아주기 모드에서는 여전히 `mode === "ladder"`가 `false`이므로 금액 입력
div 자체가 조건부 렌더링(`{mode === "ladder" && (...)}`, 435행)으로 아예 나타나지
않고, 이름 입력 wrapper는 이전과 동일하게 `flex-1`을 그대로 유지한다 — 균등/몰아주기
모드의 레이아웃(Critic이 원래 "문제없음"으로 판정한 부분)에 회귀가 없음을 코드 대조로
확인했다. `ui.test.tsx` 110~127행의 신규 회귀 테스트 2건(균등/몰아주기는 `flex items-start
gap-2` 유지, 사다리타기는 `grid-cols-1`+`sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]`
적용)도 클래스 문자열을 정확히 검증하고 있음을 확인했다(실제 실행은 QA/Builder 스위트
결과에 의존하며, 클래스 문자열 자체는 코드 대조로 이미 확인됨).

등급: **문제없음** (기존 High → 해소).

### 2. Medium (Q14) 재검증 — 이미지 저장 실패 안내 문구의 방향 오류

`ui.tsx` 614~618행을 확인했다. 문구가 "이미지를 저장하지 못했습니다. 공유 영역의
'링크 복사'로 결과를 대신 공유해 보세요."로 변경되어 있다 — "아래"라는 방향 지시어가
완전히 제거되고 "공유 영역의"라는 위치 무관 표현으로 대체되었다. `ShareActions`가
실제 DOM상 이 문구보다 위쪽(536~552행)에 있다는 원래 지적과 무관하게, 새 문구는 어느
방향에 있든 오해를 일으키지 않는다. `ui.test.tsx` 135~144행 회귀 테스트가 "아래"가
포함되지 않고 "공유 영역의 '링크 복사'로 결과를 대신"이 포함됨을 확인한다.

등급: **문제없음** (기존 Medium → 해소).

### 3. Low 6건 재검증

1. **Q3 — 사다리타기 결과 목록에 "무작위 배정" 안내 인접 배치**: `ui.tsx` 163~164행,
   `KeyResultBody`의 `ladder` 분기에서 제목("멤버-금액 매칭 결과") 바로 아래
   `<p className="mt-0.5 text-xs opacity-80">사다리타기로 무작위로 배정된
   결과입니다.</p>`가 추가되어 있음을 확인했다. 결과 목록을 보는 시점에 바로 위에서
   "무작위" 사실을 확인할 수 있어 원래 지적(사전 설명에만 있고 결과 카드 자체에는
   없음)이 해소되었다. **문제없음.**
2. **Q6 — 사다리타기 모드명 표기 불일치**: 위 "billSplitModeShortLabels|billSplitModeLabels"
   전체 사용처를 grep으로 재확인한 결과, `billSplitModeShortLabels`(풀네임 "인원별
   금액설정(사다리타기)")는 `ui.tsx` 378행 방식 선택 라디오 라벨 **한 곳에서만** 쓰이고,
   그 외 모든 곳(애니메이션 진행 중 `SectionCard` 제목 562행, 핵심 결과 카드 eyebrow
   595행)은 짧은 이름 `billSplitModeLabels`("사다리타기")로 통일되어 있다.
   `content.ts`/`formatting.ts` 각 상수 정의부에 용도를 구분하는 주석도 추가되어
   향후 재혼용을 방지한다. 두 상수가 규칙 없이 혼재하던 원래 문제가 "풀네임은 방식
   선택 한 곳, 짧은 이름은 그 외 모든 곳"이라는 명확한 규칙으로 정리되었다. **문제없음.**
3. **Q8 — 사다리타기 금액 입력 placeholder**: `ui.tsx` 447행 `placeholder="예: 10,000"`로
   변경되어 총 금액 입력의 `placeholder="예: 30,000"`(501행)과 동일한 형식(예: 숫자)이
   되었다. **문제없음.**
4. **Q14 Low — 룰렛 이름-번호 범례 중복**: `RouletteWheel.tsx` 140~145행에서 `<ol>`
   className이 `n > NAME_LABEL_THRESHOLD ? "grid ... text-xs text-muted sm:grid-cols-3" :
   "sr-only"`로 조건부 처리되어 있다. N≤10일 때는 시각적으로 숨겨지되(`sr-only`) DOM에는
   남아 스크린리더에는 계속 노출된다 — 시각적 중복은 사라지고 접근성 정보는 유지된다.
   **문제없음.**
5. **Q15 — 스크린리더 보조 정보 수준 편차**: `LadderAnimation.tsx` 176~182행에
   `<ul className="sr-only"><li>참여 멤버: {members.join(", ")}</li><li>금액 후보:
   {...}</li></ul>`가 추가되어, `RouletteWheel`의 이름-번호 범례와 동등한 수준의
   스크린리더 전용 참여자/금액 정보를 제공한다 — 두 컴포넌트 간 접근성 정보 제공
   수준 편차가 해소되었다. 다만 이 sr-only 추가에 대한 전용 단위 테스트
   (`LadderAnimation.test.tsx`/`RouletteWheel.test.tsx`)는 grep 결과 발견되지
   않았다(회귀 테스트는 `ui.test.tsx`의 레이아웃/문구 항목에만 추가됨) — 기능
   자체는 코드상 존재가 확인되므로 이 자체가 새로운 문제는 아니지만, 테스트
   커버리지 공백은 참고로 남긴다. **Low → 문제없음(기능), 테스트 공백은 별도
   참고사항(신규 이슈 아님, QA/Builder 영역).**
6. **FORMULA.md 예제 11** — Calculation Auditor가 이미 해결·재검산 완료를 확인한
   항목으로, 이번 재검증 범위(UX/UI) 밖이다. 조치 여부에 변화 없음. **해당 없음.**

### 4. 회귀(새로운 문제) 점검

- **균등/몰아주기 모드 레이아웃**: 변경 없음을 코드 대조로 확인(위 "1." 참고). 회귀 없음.
- **`billSplitModeShortLabels`/`billSplitModeLabels` 재배치가 다른 화면에 영향을
  주는지**: `content.ts`의 FAQ·소개 문구·사용법 단계는 이번 변경과 무관한 하드코딩
  텍스트이며 여전히 "사다리타기"/"인원별 금액설정(사다리타기)" 표기를 기존과 동일하게
  사용한다 — 새로운 불일치가 생기지 않았다.
- **삭제 버튼 단독 행 배치(신규 관찰, 심각도 없음)**: 사다리타기 모드가 320~639px에서
  `grid-cols-1`로 전환되면 삭제 버튼이 이름·금액 입력 아래 자기 행에 왼쪽 정렬로 홀로
  표시된다. 이는 의도된 동작(Optimizer가 `justify-self-start`로 명시적으로 설계)이며
  터치 영역(`px-3 py-3`)도 충분해 사용성 문제로 보지 않는다. 다만 시각적으로 버튼이
  "붕 떠 보이는" 느낌을 줄 수 있다는 점은 향후 개선 여지로만 참고 기록한다(등급 부여
  대상 아님 — 새로운 결함이 아니라 스타일 취향 수준).
- **`ui.test.tsx`/전체 테스트 스위트**: Optimizer 보고서가 명시한 신규 회귀 테스트
  4건(110~144행)이 실제로 파일에 존재함을 코드로 확인했다(실행 결과 자체는 Builder/
  Optimizer 보고를 신뢰 — UX/UI Critic은 정적 코드 검증이 범위).
- 그 외 새로운 UX 문제는 발견되지 않았다.

### 재검증 결과 요약

| 항목 | 라운드 1 등급 | 재검증 결과 | 근거 |
|---|---|---|---|
| Q10 (사다리타기 320px 레이아웃) | High | **해소** | grid-cols-1 세로 스택으로 필드당 가용 폭 약 54px → 약 212px로 개선(직접 재계산) |
| Q14 방향 오류 | Medium | **해소** | "아래" 제거, "공유 영역의"로 대체 확인 |
| Q3 무작위 배정 안내 미인접 | Low | **해소** | 결과 카드 제목 바로 아래 안내 문구 추가 확인 |
| Q6 모드명 표기 불일치 | Low | **해소** | 풀네임/짧은 이름 용도 분리 규칙으로 정리, grep으로 전체 사용처 확인 |
| Q8 placeholder 예시 없음 | Low | **해소** | "예: 10,000"으로 통일 확인 |
| Q14 룰렛 범례 중복 | Low | **해소** | N≤10 sr-only 전환 확인 |
| Q15 접근성 수준 편차 | Low | **해소**(기능), 테스트 공백은 참고 | LadderAnimation sr-only 목록 추가 확인, 전용 테스트는 없음(신규 이슈 아님) |
| FORMULA.md 예제 11 | Low | 범위 밖(Auditor 기존 해결) | 변경 없음 |
| 신규 회귀 | — | **없음** | 균등/몰아주기 레이아웃·다른 화면 문구 영향 없음을 코드 대조로 확인 |

### 최종 판정: **PASS**

- Critical 0, High 0(기존 1건 해소), Medium 0(기존 1건 해소) — `docs/EVALUATION.md`
  PASS 기준("Critical 0, High 0")을 충족한다.
- Low 6건 중 5건은 실제로 코드 변경이 확인되어 해소로 판정하고, 나머지 1건(Q15의 테스트
  커버리지 공백)은 새로운 결함이 아니라 참고 기록으로만 남긴다 — Low 항목은 원래도
  PASS/FAIL 판정에 영향을 주지 않는다.
- 새로운 UX 문제(회귀)는 발견되지 않았다(균등/몰아주기 레이아웃 불변, 문구 일관성 유지
  확인).
- 남은 항목(실제 320px 실기기 렌더링 확인, iOS Safari 등)은 이전과 마찬가지로 QA
  영역이며, 이번 재검증은 코드 정적 분석 기준의 판정이다.

## 점수 (오케스트레이터, 2026-09-07)

| 항목 | 배점 | 획득 | 근거 |
|---|---|---|---|
| 계산 정확성 | 35 | **34** | Calculation Auditor PASS. 실제 대량 통계 시뮬레이션(카이제곱 검정, N=2/3/5/10/20 전수, 실제 p-value 산출, N=10 경계선 사례에 FORMULA.md 재현성 규칙 실제 발동)으로 공정성을 검증한 것은 이 사이트에서 가장 엄격한 계산 정확성 검증 방식이었다. RNG 분리 원칙(공유 URL 복원이 `Math.random`을 재호출하지 않음)도 몽키패치로 실측 확인. Builder가 FORMULA.md 예제 11 표 오류를 스스로 발견해 정정까지 이어졌다. 다만 시뮬레이션은 Node.js(V8 엔진) 환경에서만 수행되어 Safari(JavaScriptCore)·Firefox(SpiderMonkey) 등 다른 브라우저 엔진의 `Math.random()` 실측은 이뤄지지 않아 −1. |
| 예외/경계값 처리 | 15 | **15** | 멤버 2~20명 경계, 나머지 처리 다양한 조합(2,006개), 완전한 순열 불변식(중복 금액·전원 동일 금액 포함 12,000회), 사다리타기 개수 불일치 차단 등 전부 실측 검증. |
| UX/사용 편의성 | 15 | **14** | UX/UI Critic 최초 FAIL(High 1건: 320px 사다리타기 레이아웃) → Optimizer 수정 → 재검증 PASS. Low 1건(sr-only 보조정보 테스트 커버리지 공백)만 잔존, 실사용성 결함은 아님. |
| 모바일/반응형 | 10 | **7** | 코드·픽셀 계산 기반 반응형 검증은 통과했으나, **이 계산기의 핵심 기능(이미지 저장)이 실제 브라우저에서 한 번도 검증되지 못했다** — 이 세션 환경에 실제 브라우저(Playwright 등)가 없어 `html-to-image`의 실제 PNG 변환·파일 다운로드·다크모드 캡처 정확도·iOS Safari 호환성(ARCHITECTURE.md가 "반드시 포함"으로 명시한 QA 항목)을 전혀 실측하지 못했다. 코드 구조상 문제는 없어 보이나 "확인했다"고 말할 수 없는 상태라 다른 계산기들의 통상적 "−1"보다 크게 감점한다. |
| 접근성 | 5 | **4** | aria-hidden(장식 SVG), aria-live, sr-only 보조 정보는 갖췄으나 QA가 멤버 이름/사다리타기 금액 입력에 `aria-required` 누락을 지적(Low, loan-interest-calculator에서도 있었던 동일 유형의 사소한 공백). |
| 성능/안정성 | 5 | **5** | Console Error 0, TypeScript Error 0, `npm run build` 성공, `html-to-image`가 별도 청크로 분리되어 다른 계산기 번들에 영향 없음을 실측 확인. |
| 설명/계산 근거 | 5 | **5** | 방식별 상세 설명, 공정성 논증을 일반 사용자 문장으로 순화, 균등 분배 나머지 처리 설명, 이용 안내 고지(참고·재미 목적). |
| SEO/페이지 완성도 | 5 | **5** | registry 등록(`status: draft`), FAQ JSON-LD, canonical, 공통 페이지 구조 준수. |
| 코드 품질/유지보수성 | 5 | **5** | RNG "결정"과 "조립" 함수 분리로 공유 URL 복원의 재현성을 구조적으로 보장, 판별 유니온 타입, 신규 라이브러리 도입 근거(버전/크기/유지보수 상태 실측)를 투명하게 기록, 문서 오류 자체 발견·정정 이력 관리. |
| **총점** | 100 | **94** | |

## 최종 판정

PASS 기준(docs/EVALUATION.md): 총점 92+, 계산정확성 33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0

| 기준 | 결과 |
|---|---|
| 총점 92+ | 94 ✅ |
| 계산 정확성 33/35+ | 34 ✅ |
| Critical 0 / High 0 | Auditor·Critic·QA 전부 최종 재검증에서 0 ✅ |
| Golden Test 100% | 13/13 ✅ |
| Console Error 0 / TypeScript Error 0 | ✅ |
| Mobile Critical 0 | 코드상 발견된 Critical 없음(단, 실기기 미검증 — 아래 참고) |

**판정: PASS(단, 실제 브라우저 이미지 저장 검증 전이라는 단서 포함)**
개선 Loop 횟수: 1/5

### 남은 후속 과제 (발행 전 강력 권고)

- **이미지 저장 기능의 실제 브라우저 검증(최우선)**: `html-to-image`의 실제 PNG 변환·다운로드·
  다크모드 캡처 정확도·iOS Safari 호환성이 이 세션 환경(실제 브라우저 부재)에서 전혀
  검증되지 못했다. 이 계산기의 핵심 Must Have 기능이므로, 실제 데스크톱/모바일 브라우저에서
  "이미지 저장" 버튼을 눌러 파일이 정상 다운로드되고 다크모드에서도 색이 깨지지 않는지
  최소 1회 수동 확인을 강력히 권고한다(ARCHITECTURE.md "4. 알려진 한계"가 이미 이 위험을
  예견하고 대체 실패 처리까지 마련해 뒀으나, 성공 여부 자체는 미확인).
- 다른 브라우저 엔진(Safari/Firefox)에서의 `Math.random()` 공정성 실측(현재는 V8/Node.js만
  검증).
- 접근성 Low 1건(`aria-required` 누락)은 발행을 막지 않으나 다음 라운드에서 반영 권고.
- 이 계산기는 정책형이 아니므로 정기 재검토 없음 — 공정성 알고리즘 오류 발견 시에만 재검토.

## Optimizer 수정 (라운드 2 — 사다리타기 렌더링 재설계 + 이미지 캡처 범위 확장)

> 이 라운드는 위 "개선 Loop"(Auditor→Critic→QA 반복)와는 별개로, 사용자가 실제 브라우저
> 테스트에서 발견한 두 가지 문제(1. 사다리타기 애니메이션이 실제로 그려진 가로줄과 무관하게
> "마음대로 꽂히는 것처럼 보임", 2. 이미지 저장 범위에 룰렛/사다리타기 그림이 빠짐)를
> 수정한 것이다. Formula Analyst가 FORMULA.md에 "사다리타기 시각화 경로 재구성 알고리즘"
> (Golden Test L1~L7 포함)을 추가하고, Architect가 ARCHITECTURE.md "4."/"5.1"/"5.1.1"/
> "5.3"/"5.5"/"8."/"9."/"11."/"12."를 갱신해 함수 배치·렌더링 방식을 확정한 뒤, 이 라운드가
> 그 설계를 그대로 구현했다. 새 기능을 임의로 추가하지 않았고, `logic.ts`(균등/몰아주기/
> Fisher-Yates 계산)와 `types.ts`는 건드리지 않았다.

### 구현 내역

1. **`src/calculators/bill-split-calculator/ladder-layout.ts`(신규)** — FORMULA.md
   의사코드를 그대로 옮겼다: `generateAdjacentSwaps(permutation)`(1단계, 선택정렬 스타일
   버블링), `scheduleSwapsIntoRows(swaps, n)`(2단계, 그리디 행 스케줄링),
   `buildLadderRungs(permutation)`(두 함수의 합성), `simulateFinalColumn(rungs,
   startColumn)`(검증용 시뮬레이션). RNG를 전혀 쓰지 않는 순수 함수이며 `permutation`
   인자를 바꾸지 않는다. `logic.ts`에 얹지 않고 별도 파일로 분리한 이유는 ARCHITECTURE.md
   "5.1.1"의 "함수 배치" 근거(도메인 경계, 컴포넌트 없이 순수 함수로 Golden Test 가능,
   `logic.ts` 선례와의 구조적 유사성)를 그대로 따랐다.
2. **`src/calculators/bill-split-calculator/ladder-layout.test.ts`(신규)** — FORMULA.md
   Golden Test L1~L7(N=2 항등/역순, N=3 역순/비역순 순환, N=4 역순 4명 전원 시뮬레이션,
   N=5 역순 5명 전원 시뮬레이션, N=20 역순 행 수 상한 37행)을 예제 수치 그대로 옮겼다.
   각 예제의 중간값(`swaps`, `rungs` 배열 전체, `rowCount`)까지 정확히 검증한다(예를
   들어 L6은 `swaps=[3,2,1,0,3,2,1,3,2,3]`, 10개 rung을 순서대로 전부 assert). 추가로
   핵심 불변식(`simulateFinalColumn(buildLadderRungs(permutation).rungs, i) ===
   permutation[i]`, 모든 `i`)을 N=2~20 각각 결정적 시드 PRNG(mulberry32)로 생성한 무작위
   순열 200개씩(총 3,800회 순열, 순열마다 N개 인덱스 전부 검증) 반복 검증하는 테스트를
   추가했다. 시드를 고정한 이유는 CI 재현성(같은 커밋이면 항상 같은 무작위 입력으로
   테스트) 확보이며, Calculation Auditor가 더 대량으로(예: 실제 `Math.random` 기반,
   N=2~20 전 구간 수천~수만 회) 독립 재검증하는 것을 막지 않는다(오케스트레이터가 이미
   Python으로 5,700회 독립 재검증했다고 지시문에 명시됨). 같은 행에 배정된 두 rung이
   열을 공유하지 않는다는 요구사항 4번도 무작위 순열 기반으로 별도 검증했다.
3. **`src/calculators/bill-split-calculator/LadderAnimation.tsx` 재작성** —
   `generateDecorativeRungs`/`DecorativeRung`/`useState<DecorativeRung[]>`를 삭제하고
   `const { rungs, rowCount } = useMemo(() => buildLadderRungs(permutation), [permutation])`로
   교체했다. Y좌표 매핑은 `rowY(row) = TOP_Y + (row+1) * (BOTTOM_Y - TOP_Y) /
   (rowCount+1)`(분모를 `rowCount+1`로 고정해 `rowCount=0`에서도 0으로 나누지 않음,
   ARCHITECTURE.md "5.1.1" 그대로). SVG 내부 높이는 `BOTTOM_Y = TOP_Y + max(BASE_HEIGHT=194,
   (rowCount+1)*MIN_ROW_GAP=16)`(N=20 역순 rowCount=37이면 634), 렌더링 CSS 높이는
   `min(520, 220 + rowCount*8)`px로 상한을 뒀다(둘 다 ARCHITECTURE.md가 제시한 가이드라인
   수치를 그대로 채택 — 하드 스펙이 아니라고 명시돼 있어 조정 재량이 있었으나 그대로 썼다).
   매칭 경로는 각 멤버별로 `row` 오름차순 순회(정확히 `simulateFinalColumn`과 같은 순회
   규칙)로 실제 rung 교차점을 waypoint로 모아("현재 열 유지(수직) → 인접 열로 교차(수평)"의
   반복) SVG `d` 문자열을 만들고, 각 교차점(코너)마다 반경 5px(`CORNER_RADIUS`, `MIN_ROW_GAP`
   16px보다 작아 겹치지 않음)의 짧은 2차 베지어(`Q`)로 둥글게 처리한 절선(polyline)으로
   그렸다 — "가독성 우선, 완전 직각도 완전 곡선도 아닌 절충안"이라는 ARCHITECTURE.md
   "5.1.1"의 결정을 그대로 따랐다. `approxPathLength`(유클리드 직선 거리 근사)는 폐기하고
   각 waypoint 사이 유클리드 거리의 합(`pathLength`, 코너의 둥근 보정은 무시)으로 다시
   계산해 `stroke-dasharray`/`stroke-dashoffset` line-drawing 애니메이션이 새 경로 길이에
   맞게 정상 동작하도록 했다. 가로줄(rung)은 `rungs` 배열을 그대로 순회해 렌더링하며,
   `rungs.length === 0`이면(항등순열) 렌더링 루프 자체를 건너뛰는 조기 분기를 명시적으로
   뒀다(방어적 코딩, ARCHITECTURE.md 요구 그대로).
4. **`src/calculators/bill-split-calculator/LadderAnimation.test.tsx` 갱신** — 기존
   "장식용 가로줄" 가정 테스트(`generateDecorativeRungs` 관련 없음, 실제로는 렌더링된
   `<line>` 개수만 느슨하게 확인하던 테스트)를 유지하되(`playAnimation` 타이밍, N=2 경계값,
   aria-hidden), 다음을 신규 추가했다: (a) 항등순열(rowCount=0)이면 가로줄이 0개 렌더링,
   (b) `permutation=[3,2,0,1]`(손으로 재검증: rungs 5개, rowCount=4)에서 렌더링된 가로줄
   개수가 `buildLadderRungs(permutation).rungs.length`와 정확히 일치, (c) 가로줄의 실제
   `y1` 좌표들이 ARCHITECTURE.md의 `rowY` 공식으로 계산한 기대값 집합과 정확히 일치
   (블랙박스 오라클 — 컴포넌트 내부 함수를 import하지 않고 문서화된 공식을 테스트에서
   독립적으로 재구현해 대조), (d) 각 멤버 경로 `d`가 자기 시작 열(`M ${xFor(i)} ${TOP_Y}`)로
   시작해 실제 도착 열(`L ${xFor(permutation[i])} ${bottomY}`)로 끝남을 확인(이것이 "경로가
   실제로 permutation과 일치하는 목적지에 도달한다"는 요구사항의 컴포넌트 레벨 검증),
   (e) N=20 역순(rowCount=37) 최악 케이스에서도 정상 렌더링되고 SVG 높이가 상한(520px)
   이내에서 기본값(220px)보다 커짐, (f) rowCount가 작을 때(N=2) SVG 높이가 기본값 그대로
   유지됨(회귀 방지 — 작은 사다리가 불필요하게 커지지 않는지).
5. **`src/calculators/bill-split-calculator/ui.tsx` — 이미지 캡처 범위 확장** —
   `cardRef`를 기존 "핵심 결과 카드(`<section>`)"에서 "애니메이션 재생 `SectionCard`(6번)와
   핵심 결과 카드(7번)를 함께 감싸는 `<div ref={cardRef}>`"로 옮겼다. 균등 분배는 애니메이션
   섹션 자체가 렌더링되지 않으므로(`computed.result.mode !== "equal"` 조건) 기존과 동일하게
   결과 카드만 캡처된다. "이미지 저장" 버튼의 활성화 조건(`canSaveImage`, `revealed` 이후만
   활성화)은 전혀 바꾸지 않았다 — ARCHITECTURE.md "5.5"가 명시한 대로 캡처 시점에는 이미
   두 SVG(룰렛 회전각/사다리타기 `stroke-dashoffset`)가 트랜지션이 끝난 정지 상태이므로
   진행 중인 애니메이션의 중간 프레임이 찍힐 위험은 구조적으로 없다.

### FORMULA.md 의사코드와 다르게 판단해야 했던 부분

**`scheduleSwapsIntoRows`의 반환 타입**만 FORMULA.md 의사코드 문면과 다르게 구현했다 —
알고리즘(행 배정 규칙 자체)은 한 글자도 바꾸지 않았다. FORMULA.md 의사코드는
`scheduleSwapsIntoRows(swapsInTimeOrder, n)`이 `rungs`(배열)만 반환하고, `rowCount` 계산은
별도로 `buildLadderRungs` 안에서 `rungs.length === 0 ? 0 : max(rungs.map(r => r.row)) + 1`로
수행하도록 되어 있다. 그런데 작업 지시가 명시적으로 요구한 TypeScript 시그니처는
`scheduleSwapsIntoRows(swaps: number[], n: number): LadderRungLayout`(즉 `{ rungs, rowCount
}`를 반환)이었다. 두 요구사항이 충돌하길래, "행 배정 규칙"(핵심 알고리즘, 정확성 증명의
대상)은 FORMULA.md 그대로 두고 "반환값을 어떻게 묶어 담는가"(부가적인 자료구조 선택)만
작업 지시의 명시적 시그니처를 따르기로 했다 — `scheduleSwapsIntoRows`가 `rowCount`까지
함께 계산해 반환하고, `buildLadderRungs`는 `generateAdjacentSwaps` → `scheduleSwapsIntoRows`
호출 결과를 그대로 반환하는 얇은 합성 함수가 됐다. `rowCount` 산출 공식(`rungs.length===0
? 0 : max(row)+1`) 자체는 FORMULA.md가 정의한 공식과 완전히 동일하며 단지 계산 위치만
옮겼을 뿐이다 — Golden Test L1~L7이 각 단계의 중간값(`swaps`, `rungs`, `rowCount`)을 모두
정확히 재현하는 것으로 이 판단이 알고리즘 자체에 영향을 주지 않았음을 확인했다.

### 검증 결과
- `npx vitest run --no-file-parallelism src/calculators/bill-split-calculator`: **7개
  파일(신규 `ladder-layout.test.ts` 포함), 106개 테스트 전부 통과.**
- `npx vitest run --no-file-parallelism`(전체 스위트, 회귀 확인): **65개 파일, 734개
  테스트 전부 통과** — 다른 계산기에 영향 없음.
- `npx tsc --noEmit`: 오류 없음.
- `npm run build`: 성공(Next.js 프로덕션 빌드, 정적 페이지 생성 포함).
- `ladder-layout.test.ts`의 핵심 불변식 테스트(N=2~20 각 200회 무작위 순열, 총 3,800회
  순열 × 순열당 N개 인덱스 전수 검증)가 전부 통과해, FORMULA.md "정확성 증명"이 주장하는
  `simulateFinalColumn(buildLadderRungs(permutation).rungs, i) === permutation[i]` 불변식이
  실제 구현에서도 깨지지 않음을 확인했다.

### 수정/추가한 파일
- `src/calculators/bill-split-calculator/ladder-layout.ts`(신규)
- `src/calculators/bill-split-calculator/ladder-layout.test.ts`(신규)
- `src/calculators/bill-split-calculator/LadderAnimation.tsx`(전면 재작성)
- `src/calculators/bill-split-calculator/LadderAnimation.test.tsx`(갱신)
- `src/calculators/bill-split-calculator/ui.tsx`(이미지 캡처 대상 `ref` 위치 변경)

이 라운드에서는 최종 판정을 내리지 않는다 — Calculation Auditor(알고리즘 구현 대조 +
독립 대량 시뮬레이션 재검증) → UX/UI Critic(렌더링/레이아웃 재검토) → QA(실제 브라우저
렌더링·이미지 캡처 확인) 순서로 다시 검증해야 한다.

## Calculation Auditor 재검증 (라운드 2)

> 범위: 이번 라운드는 핵심 배분 로직(균등/몰아주기/Fisher-Yates)을 전혀 바꾸지 않았다 —
> `permutation`이 결정되는 방식은 그대로이고, 그 결정된 `permutation`을 화면에 "어떻게
> 보여줄지"(rung 배치, 경로 그리기)만 새로 설계했다. 오케스트레이터가 이미 FORMULA.md
> 의사코드를 Python으로 독립 재구현해 N=2~20 전 구간 5,700회로 핵심 불변식을 확인했으므로,
> 이번 감사는 (1) 그 검증된 알고리즘이 실제 TypeScript 구현(`ladder-layout.ts`)에 정확히
> 옮겨졌는지, (2) `LadderAnimation.tsx`가 그 결과를 실제로 화면에 일치하게 그리는지, (3)
> 이미지 캡처 범위 확장이 코드로 확인되는지, (4) 회귀가 없는지에 집중했다. 검증 방법은
> 코드 대조 + **소스 미수정** 독립 스크립트(스크래치패드, `tsx`/`react-dom/server`로 실제
> export 함수·컴포넌트를 직접 import해 실행)다.

### 1. `ladder-layout.ts` 구현 ↔ FORMULA.md 의사코드 대조

`generateAdjacentSwaps`/`scheduleSwapsIntoRows`/`buildLadderRungs`/`simulateFinalColumn`
네 함수를 FORMULA.md "사다리타기 시각화 경로 재구성 알고리즘" 의사코드와 한 줄씩 대조했다.

- **`generateAdjacentSwaps`**: `target[permutation[i]] = i` 역함수 계산, `current`를
  `[0..n-1]`로 초기화, `for c` 루프 안의 `while (current[p] !== target[c]) p++`와
  `while (p > c) { swapsInTimeOrder.push(p-1); swap; p--; }` 구조가 의사코드와 정확히
  일치한다. RNG 없음, `permutation` 인자를 변경하지 않음(별도 스냅샷 비교로 확인, 아래
  "2." 참고)도 확인했다. **일치.**
- **`scheduleSwapsIntoRows`**: `lastUsedRow` 배열 초기화(-1로 채움), 각 스왑에
  `row = max(lastUsedRow[c], lastUsedRow[c+1]) + 1` 배정, 갱신 순서까지 의사코드와
  정확히 일치한다. **다만 반환 타입이 의사코드(rungs 배열만 반환)와 다르게
  `{ rungs, rowCount }`(LadderRungLayout)를 반환하도록 되어 있다** — Optimizer가
  보고한 대로다. `rowCount` 계산식(rungs.length===0 ? 0 : max(rungs.map(r=>r.row))+1)
  자체는 FORMULA.md의 buildLadderRungs가 정의한 것과 완전히 동일한 공식이고, 단지
  계산 위치를 buildLadderRungs에서 scheduleSwapsIntoRows 내부로 옮긴 것뿐이다 —
  **행 배정 규칙(핵심 알고리즘) 자체는 한 글자도 바뀌지 않았고, buildLadderRungs는
  scheduleSwapsIntoRows(generateAdjacentSwaps(permutation), n)을 그대로 반환하는
  얇은 합성 함수로 남아 있다**(코드 111~114행 직접 확인). 아래 "2. 독립 재현" 대량
  시뮬레이션이 이 리팩터링이 결과에 영향을 주지 않음을 실측으로 뒷받침한다(9,538개
  순열에서 rowCount 불일치 0건). **알고리즘 결과에 영향 없음, 사소한 시그니처 차이로
  판단 — 문제없음.**
- **`buildLadderRungs`**: generateAdjacentSwaps → scheduleSwapsIntoRows 합성. 의사코드와
  일치(위 참고). **일치.**
- **`simulateFinalColumn`**: rungs를 row 오름차순 정렬 후 col을 시작값으로 순회하며
  rung.column===col이면 col+1, rung.column+1===col이면 col-1, 그 외 유지 —
  의사코드와 정확히 일치한다. **일치.**

### 2. 독립 재현 — 대량 무작위 시뮬레이션 (핵심)

소스를 전혀 수정하지 않고 스크래치패드에 tsx 스크립트를 작성해 ladder-layout.ts에서
export된 buildLadderRungs/simulateFinalColumn을 **실제 파일 경로로 직접 import**해서
호출했다(Node 24.17, tsx 4.23, 실행 명령: `npx tsx <script>.ts`).

- **시행 규모**: N=2부터 N=20까지 각 N마다 역순 순열 1개 + 항등 순열 1개(경계값) +
  결정적 시드 PRNG(mulberry32, seed 고정으로 재현 가능)로 생성한 무작위 순열 500개 —
  총 **9,538개 순열**(과제가 요구한 "N당 최소 500개 + 역순 명시 포함"을 충족).
- **핵심 불변식 검증**: 각 순열의 **모든 멤버 i**(총 시행 수 × 평균 N 규모의 개별
  `simulateFinalColumn` 호출)에 대해 `simulateFinalColumn(rungs, i) === permutation[i]`를
  확인 — **불일치 0건**.
- **요구사항 4번(같은 행 배정 rung의 열 비공유) 실측**: 모든 9,538개 순열에서 각 row에
  배정된 rung들의 column 집합을 직접 계산해 겹침 여부를 확인 — **위반 0건**.
- **rowCount 정합성**: `rowCount === (rungs.length===0 ? 0 : max(row)+1)`을 모든
  순열에서 재확인 — **불일치 0건**(위 "1."의 시그니처 변경이 결과에 영향 없음을
  실측으로 뒷받침).
- **N=20 역순 특별 확인**: buildLadderRungs에 permutation=[19,18,...,0]을 넣은 결과
  rowCount=37, rungs.length=190 — FORMULA.md "행 수 상한 분석"/예제 L7이 주장한
  값과 정확히 일치.

```
N=20 역순 rowCount: 37 (기대값 37)
N=20 역순 rungs.length: 190 (기대값 190)
총 시행 수(순열 개수, 역순+항등+무작위 합산): 9538
핵심 불변식/rowCount 불일치 수: 0
행-열 공유 위반 수: 0
모든 검증 통과 (실패 0건)
```

**판정: 핵심 불변식 100% 성립 확인(Critical 없음).** 오케스트레이터의 Python 독립
재검증(5,700회)과 이번 TypeScript 실제 구현 직접 호출(9,538개 순열, 멤버별 전수 검증
포함)이 서로 다른 언어·다른 시드로 같은 결론에 도달했다.

### 3. `LadderAnimation.tsx` 경로 렌더링 — 실제 rung을 지나가는지

**코드 대조**: buildMemberPathPoints(LadderAnimation.tsx 129~157행)는 sortedRungs를
row 오름차순으로 순회하며 `rung.column === col → nextCol = col+1`, `rung.column+1 ===
col → nextCol = col-1`(그 외 무관, 유지)이라는 조건문을 쓰는데, 이는 simulateFinalColumn의
조건문과 **글자 단위로 동일**하다 — 같은 sortedRungs(둘 다 `[...rungs].sort((a,b)=>a.row-
b.row)`)를 순회하므로 두 함수가 항상 같은 최종 col을 낸다는 것이 코드 구조로 보장된다.
또한 rung 렌더링(rowY(rung.row, rowCount, TOP_Y, bottomY), 232행)과 waypoint 계산
(buildMemberPathPoints 내부의 rowY(rung.row, rowCount, topY, bottomY), 149행)이
**완전히 동일한 함수·동일한 TOP_Y/bottomY 변수**를 참조한다 — "경로가 실제로 그 위치에서
가로줄과 만난다"는 것이 별도 좌표 재계산 없이 구조적으로 보장된다.

**독립 렌더링 검증(react-dom/server, jsdom/vitest 미사용 — 소스 미수정 원칙 유지)**:
스크래치패드 스크립트가 LadderAnimation 컴포넌트를 renderToStaticMarkup으로 실제
렌더링하고, 출력 HTML의 `<line>`/`<path>` 요소 좌표를 정규식으로 파싱해 다음을 직접
확인했다(FORMULA.md 예제 L3·L4·L5 + N=2 항등/역순 + N=20 역순 총 6개 케이스):

- 렌더링된 세로줄 개수 = members.length, 가로줄(rung) 개수 = rungs.length.
- 가로줄 `<line>`의 y1 좌표 집합이 rowY 공식으로 독립 계산한 기대값 집합과 **정확히
  일치**(정렬 후 배열 비교).
- 각 멤버 path의 시작 좌표 = (xFor(memberIndex), TOP_Y), **끝 좌표 =
  (xFor(permutation[memberIndex]), bottomY)** — 문자열 접두/접미 비교가 아니라 d
  속성의 모든 M/L/Q 좌표를 파싱해 수치로 비교(오차 1e-6 이내).
- 각 경로의 **중간 waypoint**(코너 처리 전 원좌표)가 실제 렌더링된 rung y좌표 중
  하나와 6px 이내(코너 반경 5px + 여유)로 근접함을 확인 — "경로가 진짜로 그 rung을
  지나간다"는 것의 좌표 단위 직접 증거.
- N=20 역순: rowCount=37, SVG 렌더링 높이 516px(상한 MAX_SVG_HEIGHT_PX=520px 이내).

```
=== L3 N=3 역순 ===  세로줄 3개, 가로줄 3개, path 3개 검사 완료
=== L4 N=3 비역순 순환 ===  세로줄 3개, 가로줄 2개, path 3개 검사 완료
=== L5 N=4 역순 ===  세로줄 4개, 가로줄 6개, path 4개 검사 완료
=== N=2 항등 ===  세로줄 2개, 가로줄 0개, path 2개 검사 완료
=== N=2 역순 ===  세로줄 2개, 가로줄 1개, path 2개 검사 완료
=== N=20 역순(최악 케이스) ===  세로줄 20개, 가로줄 190개, path 20개 검사 완료
N=20 역순: rowCount=37, 기대 SVG 높이=516px (상한 520px)
모든 렌더링 검증 통과 (실패 0건)
```

추가로 N=2~20, 각 N당 31개 순열(역순 1 + 무작위 30, 총 589개)에 대해 "path 마지막 좌표 =
xFor(permutation[memberIndex]), y = bottomY" + "simulateFinalColumn과 일치"를
대량으로 재확인했다 — **589개 순열 전체, 실패 0건.**

**판정: `LadderAnimation.tsx`가 실제로 확정된 permutation을 정확한 좌표로 렌더링하며,
그려진 경로가 실제 rung과 좌표 단위로 일치함을 확인(Critical 없음).**

### 4. N=20 역순 케이스의 실제 동작

위 "2."/"3."에서 이미 확인: buildLadderRungs에 N=20 역순 순열을 넣으면 실제로
**37행**(rowCount=37, rungs.length=190)이 나온다. LadderAnimation.tsx의 SVG 높이
계산도 이 경우 `bottomY = TOP_Y + max(194, 38×16=608) = 634`, 렌더링 CSS 높이
`min(520, 220+37×8=516) = 516px`로 상한(MAX_SVG_HEIGHT_PX=520px) 이내에 들어오고
기본값(220px)보다는 확실히 커져 37행이 압축되지 않고 표시될 여지가 있음을 확인했다.
viewBox 너비(N=20이면 24×2+40×19=808)가 높이(660=bottomY+26)보다 커서 "매우 좁고
긴" 종횡비 문제도 생기지 않는다(ARCHITECTURE.md "5.1.1" 분석과 일치). **문제없음.**

### 5. 이미지 캡처 범위 확장 (코드 대조)

`ui.tsx` 561행 `<div ref={cardRef} className="space-y-5">`가 애니메이션
SectionCard(562~590행, `computed.result.mode !== "equal"`일 때만 렌더링)와 핵심 결과
카드(592~604행, `revealed`일 때만 렌더링)를 **함께** 감싸는 것을 코드로 직접 확인했다.
균등 분배는 `mode !== "equal"` 조건이 거짓이라 애니메이션 섹션 자체가 렌더링되지 않으므로
cardRef 안에는 결과 카드만 남는다 — ARCHITECTURE.md "4."/"9."가 요구한 "균등 분배는
영향 없음"과 정확히 일치한다. handleSaveImage(320행)가 여전히 `cardRef.current`
하나만 toPng에 넘기므로 캡처 대상이 이 컨테이너 전체임도 확인했다.

**참고(Low, 테스트 커버리지 공백)**: 이 불변식(캡처 컨테이너가 실제로 두 섹션을 함께
포함하는지)을 검증하는 전용 자동화 테스트가 ui.test.tsx에 없다(grep 결과 cardRef/
"캡처" 관련 assertion 없음). 코드 정적 대조로는 명확하지만, 향후 회귀(예: 누군가
실수로 cardRef를 다시 결과 카드 하나로 좁히는 변경)를 자동으로 잡아낼 수단이 없다.
**Low** — QA/Optimizer가 "몰아주기/사다리타기 모드에서 cardRef 컨테이너 안에
`<svg>`와 핵심 결과 카드가 모두 존재하고, 균등 분배 모드에서는 `<svg>`가 없다"는 assert를
ui.test.tsx에 추가할 것을 권장한다(기능 자체는 코드 대조로 이미 확인했으므로 발행을
막을 사안은 아니다).

### 6. 회귀 확인

- `npx vitest run --no-file-parallelism`(전체 스위트): **65개 파일, 734개 테스트 전부
  통과.**
- `npx tsc --noEmit`: 오류 없음.
- `npm run build`: 성공(Next.js 프로덕션 빌드, 정적 페이지 생성 포함).
- **logic.ts 무변경 재확인**: pickWinnerIndex/fisherYatesShuffle의 시그니처(인자
  순서·기본값·반환 타입)와 Math.random 호출 위치를 grep으로 재확인한 결과 라운드 1
  Auditor가 검증한 것과 완전히 동일하다 — 균등/몰아주기/Fisher-Yates 로직, RNG 분리
  원칙(공유 URL 복원), N=2~20 카이제곱 통계적 공정성 검증(라운드 1에서 이미 100,000회
  단위로 실측 완료)은 이번 변경으로 영향받지 않는다. generateDecorativeRungs/
  DecorativeRung가 코드베이스에서 완전히 삭제되었음도 grep으로 확인(요구사항대로
  장식용 무작위 가로줄이 결정적 buildLadderRungs로 전면 대체됨).

### 발견된 이슈 (등급별)

- **Critical**: 없음.
- **High**: 없음.
- **Medium**: 없음.
- **Low**: 1건 — 이미지 캡처 컨테이너(cardRef)가 애니메이션 섹션+결과 카드를 함께
  감싸는지를 검증하는 전용 자동화 테스트가 없음(위 "5." 참고, 기능 자체는 코드 대조로
  확인됨 — 발행을 막지 않음).

### FORMULA.md 자체에 대한 판단

이번 라운드의 새 알고리즘("사다리타기 시각화 경로 재구성 알고리즘")은 독립 대량
시뮬레이션(9,538개 순열, 핵심 불변식 100% 성립)과 렌더링 레벨 좌표 검증(589개 순열 +
Golden Test 6종)으로 **문서 자체의 수학적 주장(정확성 증명)이 실제로 성립함을 확인했다**
— "공식 재검토 요청"으로 반려할 사유 없음.

### 판정: **PASS**

- ladder-layout.ts 구현이 FORMULA.md 의사코드와 정확히 일치함을 함수 단위로 대조
  확인(scheduleSwapsIntoRows의 반환 타입 차이는 알고리즘에 영향 없음을 대량 시뮬레이션
  으로 실측 확인).
- 핵심 불변식(simulateFinalColumn(rungs,i)===permutation[i])이 N=2~20 전 구간
  9,538개 순열(역순 포함)에서 100% 성립, 요구사항 4번(행-열 비공유)도 위반 0건.
- LadderAnimation.tsx의 렌더링이 실제로 확정된 permutation과 좌표 단위로 일치함을
  react-dom/server 기반 독립 렌더링 검증(6개 Golden Test 케이스 + 589개 대량 순열)으로
  확인.
- N=20 역순 케이스의 실제 행 수(37)·SVG 높이(516px, 상한 이내)를 실측 확인.
- 이미지 캡처 범위 확장(cardRef)이 균등 분배에는 영향 없이 몰아주기/사다리타기에만
  적용됨을 코드로 확인(Low 1건 — 전용 회귀 테스트 부재만 지적, PASS를 막지 않음).
- 전체 테스트 스위트(734/734)·tsc --noEmit·npm run build 모두 통과, 회귀 없음.
- Critical/High/Medium 0건 — docs/EVALUATION.md PASS 기준을 충족한다.

## 사용자 실브라우저 확인 (2026-09-07, 최종)

라운드 2 수정 이후, 위 "## 점수" 절이 남겨둔 "남은 후속 과제 최우선" 항목(이미지 저장
기능의 실제 브라우저 검증)을 **사용자가 직접 개발 서버에서 확인**했다 — 사다리타기
애니메이션이 실제로 그려진 가로줄을 따라 내려가는 것으로 보이는지, 저장된 이미지에
룰렛/사다리타기 그림이 포함되는지 두 가지를 모두 확인했고, "잘된다"는 답을 받았다.

이 확인으로 이 세션의 샌드박스 환경(실제 브라우저 도구 부재)이 만들었던 핵심 공백 —
"`html-to-image`가 실제로 PNG를 만들고 다운로드하는지 한 번도 실측하지 못했다" — 이
실질적으로 해소됐다(사용자의 실제 브라우저 1회 확인으로, ARCHITECTURE.md가 요구한
"iOS Safari 등 실기기 확인"까지 전부 커버된 것은 아니지만, 이 계산기의 핵심 Must Have
기능이 최소 1개의 실제 브라우저에서 정상 동작함은 이제 실측으로 확인됐다).

### 점수 갱신 (위 "## 점수" 절 대체)

| 항목 | 배점 | 획득(기존→갱신) | 근거 |
|---|---|---|---|
| 계산 정확성 | 35 | 34 (변경 없음) | 라운드 2는 순수 렌더링 변경이라 배분 로직과 무관. |
| 예외/경계값 처리 | 15 | 15 (변경 없음) | — |
| UX/사용 편의성 | 15 | 14 (변경 없음) | — |
| 모바일/반응형 | 10 | 7→**9** | 이미지 저장(이 계산기의 핵심 Must Have)이 실제 브라우저에서 정상 동작함을 사용자가 직접 확인했다. iOS Safari 전용 확인·다크모드 캡처 색상 정확도까지 명시적으로 보고받지는 않아 만점은 아니지만, 핵심 위험(기능이 아예 작동하지 않을 가능성)은 해소됐다. |
| 접근성 | 5 | 4 (변경 없음) | — |
| 성능/안정성 | 5 | 5 (변경 없음) | — |
| 설명/계산 근거 | 5 | 5 (변경 없음) | — |
| SEO/페이지 완성도 | 5 | 5 (변경 없음) | — |
| 코드 품질/유지보수성 | 5 | 5 (변경 없음) | 라운드 2에서 새 알고리즘(사다리타기 rung 재구성)을 FORMULA.md에 수학적 증명과 함께 정식으로 추가하고, 오케스트레이터·Calculation Auditor가 각각 독립적으로 대량 시뮬레이션(5,700회 + 9,538회)으로 재검증한 점도 이 항목의 근거를 강화한다. |
| **총점** | 100 | 94→**96** | |

### 최종 판정 (갱신)

| 기준 | 결과 |
|---|---|
| 총점 92+ | 96 ✅ |
| 계산 정확성 33/35+ | 34 ✅ |
| Critical 0 / High 0 | Auditor(라운드 1·2)·Critic·QA 전부 0 ✅ |
| Golden Test 100% | 13/13(배분 로직) + 7/7(L1~L7, 사다리타기 렌더링) ✅ |
| Console Error 0 / TypeScript Error 0 | ✅ |
| Mobile Critical 0 | ✅ |

**판정: PASS.** 이전 판정에 붙였던 "실제 브라우저 이미지 저장 검증 전" 단서는 사용자의
직접 확인으로 해소되어 제거한다.

개선 Loop 횟수: 2/5 (라운드 1: UX/UI Critic FAIL→수정→PASS, 라운드 2: 사용자 발견
버그(사다리타기 렌더링, 이미지 캡처 범위)→Formula Analyst/Architect/Optimizer→
Calculation Auditor 재검증 PASS)

### 남은 후속 과제 (발행 비차단)

- 다른 브라우저 엔진(Safari/Firefox)에서의 `Math.random()` 공정성 실측(현재는 V8/Node.js +
  사용자의 1회 수동 확인만 검증됨).
- iOS Safari 전용 확인·다크모드 캡처 색상 정확도의 명시적 재확인(기능 자체는 확인됐으나
  이 두 세부 항목은 별도로 보고받지 않음).
- 접근성 Low 1건(`aria-required` 누락), cardRef 캡처 범위 전용 회귀 테스트 부재(Low) —
  다음 라운드에서 반영 권고.
- 이 계산기는 정책형이 아니므로 정기 재검토 없음 — 공정성 알고리즘 오류 발견 시에만 재검토.
