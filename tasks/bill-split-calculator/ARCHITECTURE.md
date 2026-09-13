# ARCHITECTURE: 더치페이 계산기 (bill-split-calculator)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-07.
계산/알고리즘 공식 자체는 정의하지 않는다(Formula Analyst 소관 — 균등 분배 나머지 처리,
`Math.floor(Math.random()*n)` 몰아주기 선정, Fisher-Yates shuffle을 바꾸지 않았다). 여기서는
코드 배치, 타입, 라이브러리 선택, UI/애니메이션 구조만 정한다.

관련 문서: docs/ARCHITECTURE.md, docs/CALCULATOR_RULES.md, docs/DESIGN_SYSTEM.md.
참고 선례: `tasks/loan-interest-calculator/ARCHITECTURE.md`(판별 유니온, `logic/` 분할 판단
기준, Builder 인수인계 형식), `src/calculators/business-days/types.ts`(가장 단순한 판별
유니온 스타일), `tasks/housing-subscription-score/ARCHITECTURE.md`(승격 유보 판단 기준 —
"아직 사례 2개뿐이라 승격하지 않는다").

이 계산기는 이 사이트 최초로 (a) 정책·법령이 전혀 없고 "공정성(편향 없음)"이 정확성의
정의이며, (b) RNG를 쓰는 로직이 있고, (c) 이미지 저장(다운로드) 기능이 필요하고, (d) 룰렛·
사다리타기라는 진행형 애니메이션이 결과 확정 이후에 재생된다는 네 가지 특징을 동시에 가진
계산기다. 아래 결정 대부분이 이 특징들 때문에 새로 필요해진 판단이다.

---

## 0. 레지스트리 상태 확인

`src/calculators/registry.ts` 확인 결과 `bill-split-calculator` slug는 등록되어 있지 않다.
이번 Architect 라운드에서도 등록하지 않는다(아래 "10. 계산기 등록 전략" 참고) — Builder가 UI
구현을 완료할 때 `status: "draft"`로 등록한다.

`src/calculators/bill-split-calculator/` 폴더는 이번 라운드에서 `types.ts` 하나만
생성했다(아래 "3." 참고). `logic.ts` 등 실제 계산 코드는 아직 없다(Builder 몫).

---

## 1. 숫자 정밀도 전략 — 일반 `Number`, 스케일링/`BigInt`/`decimal.js` 불필요 (확정)

FORMULA.md "정밀도/반올림 정책"의 판단을 그대로 확정한다.

- 모든 금액은 원 단위 **정수**로만 다룬다. 균등 분배의 `floor(totalAmount / n)`,
  `totalAmount % n`은 입력 자체가 정수 원 단위이고 상한이 1억 원, 인원수가 최대 20명이라
  부동소수점이 개입할 여지가 없다(정수 나눗셈·나머지 연산 자체가 JS에서 정확하다).
  `Number.MAX_SAFE_INTEGER`(약 9.007×10^15) 대비 다루는 값(최대 1억 원, 20명 합산해도
  20억 원 수준)은 비교가 무의미할 정도로 작다.
- 몰아주기(`Math.floor(rng() * n)`)와 사다리타기(Fisher-Yates의 `Math.floor(rng() * (i+1))`)
  모두 정수 인덱스를 만들어내는 연산이며 금액 자체를 반올림하지 않는다 — "반올림 정책"이라는
  개념 자체가 이 계산기의 핵심 로직(선정·매칭)에는 적용되지 않는다(균등 분배의 나머지 처리
  1건만 해당, 이미 FORMULA.md가 결정론적으로 확정함).
- `BigInt`/`decimal.js`/`big.js`는 이 규모에서 실익이 없어 채택하지 않는다
  (docs/ARCHITECTURE.md "모든 계산기에 무조건 무거운 decimal 라이브러리를 쓰지 않는다").
- 화면 표시는 다른 계산기와 동일하게 `Intl.NumberFormat('ko-KR')`.

---

## 2. 로직 폴더 구조 및 RNG 주입 인터페이스 (핵심 결정 3)

### 2.1 단일 `logic.ts` vs `logic/` 디렉터리 — **단일 파일로 확정**

`loan-interest-calculator`가 세운 판단 기준을 그대로 적용해 확인했다: "여러 변형이 짧고
서로 독립적인 연산의 나열이면(`four-major-insurance`) 한 함수 안의 분기로 충분하다. 반대로
같은 모양의 복잡한 다단계 절차 여러 벌이면(`loan-interest-calculator`의 상환방식 3종 — 앵커값
계산 → 회차 반복 → 마지막 회차 보정 → 연도별 집계) 파일 단위로 분리한다."

이 계산기의 세 방식을 실제로 뜯어보면:

| 방식 | 알고리즘 모양 | 대략적 코드 길이 |
|---|---|---|
| 균등 | `floor`/`%` 한 번씩, 반복문 없음 | ~5줄 |
| 몰아주기 | RNG 1회 호출 + `shares[]` 조립 | ~5줄 |
| 사다리타기 | Fisher-Yates 반복문(O(n), 최대 19회 스왑) + `matches[]` 조립 | ~10줄 |

세 방식은 **"짧고 독립적인 연산의 나열"**이지 loan-interest-calculator처럼 "회차 반복 +
마지막 회차 강제 보정 + 연도별 집계"라는 다단계 절차를 세 벌 반복하는 구조가 아니다 — 공유할
"반복 골격" 자체가 없다(균등은 반복문이 없고, 몰아주기는 반복문이 없고, 사다리타기의
반복문은 오직 그 방식 안에서만 의미가 있는 셔플 루프다). 따라서 `four-major-insurance`/
`business-days` 선례(단일 `logic.ts`, 그 안에서 짧은 분기)가 이 계산기에 더 맞는 선례이고,
`loan-interest-calculator`의 `logic/` 디렉터리 분할은 **채택하지 않는다**.

```
src/calculators/bill-split-calculator/logic.ts
  calculateEqualSplit(input: EqualSplitInput): EqualSplitResult
  calculateWinnerTakeAll(input: WinnerTakeAllInput, rng?: RandomSource): WinnerTakeAllResult
  calculateLadderSplit(input: LadderSplitInput, rng?: RandomSource): LadderSplitResult
  pickWinnerIndex(memberCount: number, rng?: RandomSource): number
  fisherYatesShuffle<T>(items: readonly T[], rng?: RandomSource): T[]
  buildWinnerTakeAllShares(members: string[], totalAmount: number, selectedIndex: number): Share[]
  buildLadderMatches(members: string[], amounts: number[], permutation: number[]): LadderMatch[]
  restoreBillSplitResult(state: BillSplitShareState): BillSplitResult
```

세 `calculate*` 함수는 공개 진입점이고, `pickWinnerIndex`/`fisherYatesShuffle`은 그 내부에서
쓰이는 이름 있는 RNG 원시 함수(아래 "2.2"), `buildWinnerTakeAllShares`/`buildLadderMatches`는
"이미 정해진 결과를 조립"하는 RNG-프리 헬퍼(아래 "2.3"), `restoreBillSplitResult`는 공유
URL 복원 전용 진입점이다. 하나의 파일 안에 있지만 각 함수는 독립적으로 export되어 있어
Calculation Auditor가 방식별로 원하는 함수만 골라 대량 호출할 수 있다 — "파일 분리"가 아니라
"함수 분리"만으로 loan-interest-calculator가 파일 분리로 얻으려던 이점(독립 감사 가능성)을
충분히 얻는다.

### RNG 원시 함수를 `src/lib/`로 승격하지 않는 이유

`pickWinnerIndex`/`fisherYatesShuffle`은 도메인 의미가 전혀 없는 범용 알고리즘(균등 정수
난수, 균등 무작위 순열)이라, `housing-subscription-score` Architect 라운드가 세분화한
공용화 기준("함수 자체가 도메인 의미 없는 순수 산술인가")을 문자 그대로 적용하면 `src/lib/`
승격 후보처럼 보인다. 그러나 그 기준은 날짜 산술(`date-calc.ts`)에 대해 세워진 것이고, 이
사이트에 셔플·무작위 선택이 필요한 **두 번째 계산기가 아직 없다**(위 SPEC/작업 지시가 명시한
"아직 사례가 1개뿐이면 승격하지 않는다" 원칙 — `loan-interest-calculator`의 "년+개월 입력"
UI 패턴에도 동일하게 적용됐다). 두 함수는 각각 5~10줄로 매우 작아 지금 계산기 전용 코드에
둬도 유지 비용이 낮다. **다음에 무작위 선택/셔플이 필요한 계산기가 나오면 그때
`src/lib/random.ts`로 승격을 재검토한다** — 지금은 `logic.ts` 안에 둔다.

### 2.2 RNG 주입 타입 시그니처 (types.ts에 확정 반영함)

```ts
export type RandomSource = () => number; // [0,1) 구간, 기본값 Math.random

// logic.ts
export function pickWinnerIndex(memberCount: number, rng: RandomSource = Math.random): number {
  return Math.floor(rng() * memberCount);
}

export function fisherYatesShuffle<T>(items: readonly T[], rng: RandomSource = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

- `fisherYatesShuffle`은 FORMULA.md "구현 시 유의"에 따라 **항상 인덱스 배열
  (`[0, 1, ..., n-1]`)에 적용**한다 — `calculateLadderSplit`이
  `fisherYatesShuffle(members.map((_, i) => i), rng)`를 호출해 그 결과를 그대로
  `permutation`으로 쓴다. 값(`amounts`)을 직접 셔플하지 않으므로 중복 금액이 있어도
  `permutation`이 항상 명확하다.
- 이 두 시그니처는 **Calculation Auditor의 대량 시뮬레이션 테스트가 그대로 가져다 쓸
  계약**이다(작업 지시 "핵심 결정 3"). Builder는 인자 순서·기본값·반환 타입을 임의로 바꾸지
  않는다 — 바꾸면 Auditor가 FORMULA.md "공정성 통계 검증 공통 절차"에 따라 작성한 테스트
  코드(예: `for (let i=0;i<100000;i++) counts[pickWinnerIndex(n)]++`)가 깨진다.
- 결정적 단위 테스트(`logic.test.ts`)는 고정 시퀀스를 반환하는 `rng`를 주입해 FORMULA.md
  검증 예제 10·11(손 추적)을 그대로 재현한다(예: `let calls=[0,1]; const rng=()=>calls.shift()!`
  같은 패턴으로 `j` 값을 강제).

### 2.3 "결과 확정"과 "확정된 결과 재구성"의 분리 — 공유 복원이 RNG를 다시 호출하지 않게 하는 구조

FORMULA.md "계산 순서"의 "먼저 결과를 계산 → 그 다음 애니메이션에 전달"이라는 원칙과, SPEC.md
"계산 후 공유는... 실제로 확정된 결과값까지 함께 인코딩해 복원해야 한다"는 요건을 동시에
만족시키려면, "RNG로 값을 결정하는 단계"와 "이미 결정된 값으로 결과 객체를 조립하는 단계"를
반드시 별도 함수로 나눠야 한다 — 그래야 공유 URL 복원 시 후자만 재실행하고 RNG를 다시 호출하지
않을 수 있다.

```ts
export function buildWinnerTakeAllShares(
  members: string[], totalAmount: number, selectedIndex: number,
): Share[] { /* RNG 없음 — selectedIndex만 totalAmount, 나머지 0 */ }

export function calculateWinnerTakeAll(
  input: WinnerTakeAllInput, rng: RandomSource = Math.random,
): WinnerTakeAllResult {
  const selectedIndex = pickWinnerIndex(input.members.length, rng); // RNG 호출은 여기 1곳뿐
  return {
    mode: "winner-take-all", totalAmount: input.totalAmount, members: input.members,
    selectedIndex, selectedName: input.members[selectedIndex],
    shares: buildWinnerTakeAllShares(input.members, input.totalAmount, selectedIndex),
  };
}

export function buildLadderMatches(
  members: string[], amounts: number[], permutation: number[],
): LadderMatch[] { /* RNG 없음 — permutation을 그대로 인덱싱만 함 */ }

export function calculateLadderSplit(
  input: LadderSplitInput, rng: RandomSource = Math.random,
): LadderSplitResult {
  const permutation = fisherYatesShuffle(input.members.map((_, i) => i), rng); // RNG 호출은 여기뿐
  return {
    mode: "ladder", members: input.members, amounts: input.amounts,
    matches: buildLadderMatches(input.members, input.amounts, permutation), permutation,
  };
}

export function restoreBillSplitResult(state: BillSplitShareState): BillSplitResult {
  switch (state.mode) {
    case "equal":
      return calculateEqualSplit({ mode: "equal", totalAmount: state.totalAmount, members: state.members }); // 결정적이라 재계산 안전
    case "winner-take-all":
      return {
        mode: "winner-take-all", totalAmount: state.totalAmount, members: state.members,
        selectedIndex: state.selectedIndex, selectedName: state.members[state.selectedIndex],
        shares: buildWinnerTakeAllShares(state.members, state.totalAmount, state.selectedIndex),
      };
    case "ladder":
      return {
        mode: "ladder", members: state.members, amounts: state.amounts,
        matches: buildLadderMatches(state.members, state.amounts, state.permutation),
        permutation: state.permutation,
      };
  }
}
```

`restoreBillSplitResult`는 세 분기 모두 `Math.random`을 단 한 번도 호출하지 않는다(균등은
애초에 결정적이라 재계산이 안전하고, 나머지 둘은 `build*` 헬퍼만 호출한다) — 공유 링크로 들어온
사용자가 다른 결과를 보는 일이 구조적으로 불가능하다.

---

## 3. 결과 타입 설계 (핵심 결정 4) — `mode` 판별 유니온, `types.ts`로 확정함

이번 라운드에서 `src/calculators/bill-split-calculator/types.ts`를 작성해 확정했다(전체
내용은 파일 참고). 핵심 결정:

- **`business-days`/`loan-interest-calculator`의 판별 유니온 선례를 그대로 따라 `mode`를
  판별 태그로 쓴다.** SPEC.md가 세 방식의 핵심 결과 모양이 확실히 다르다고 명시했다(균등:
  `shares[]`, 몰아주기: `selectedIndex`+`shares[]`, 사다리타기: `matches[]`+`permutation[]`)
  — 하나의 인터페이스에 옵션 필드로 세 세트를 다 넣지 않는다.
- **교차 타입(`&`) 베이스는 쓰지 않고 `business-days`처럼 세 분기를 그대로 나열했다** —
  `loan-interest-calculator`는 공통 필드가 7개나 돼 반복 비용이 컸지만, 이 계산기는 세 방식이
  공유하는 필드가 `members: string[]` 정도뿐이다(`totalAmount`도 사다리타기에는 없다 — SPEC.md
  "총 금액 입력 필드는 없다"). 공유 필드가 이렇게 적을 때 억지로 베이스 타입을 뽑으면 오히려
  "실제로는 거의 공유하지 않는다"는 사실이 타입 구조에서 가려진다.
- **입력 타입도 결과 타입과 동일하게 `mode` 판별 유니온으로 설계했다**(`EqualSplitInput`/
  `WinnerTakeAllInput`/`LadderSplitInput`) — SPEC.md/FORMULA.md가 세 방식의 입력 필드
  구성 자체도 다르다고 명시하므로(사다리타기만 `amounts[]`가 있고 `totalAmount`가 없음)
  입력 단계부터 하나의 유니온으로 통일하는 편이 `ui.tsx`의 폼 상태 관리와도 자연스럽게
  대응한다(방식 선택 라디오 = `mode` 값 선택).
- **`BillSplitShareState`(공유 상태)도 같은 `mode` 판별 유니온 스키마를 그대로 재사용한다**
  (아래 "6." 참고) — `restoreBillSplitResult`가 `calculate*` 함수들과 동일한 `switch(mode)`
  하나로 처리되게 하기 위함이다.
- `housing-subscription-score`/`loan-interest-calculator`가 확립한 "로직 값만, 문장 조립은
  formatting.ts" 경계를 그대로 따른다 — `types.ts`에는 "OO님이 전액 부담" 같은 문구를 넣지
  않는다. `formatting.ts`가 `result.mode`로 분기해 방식별 표시 문자열을 조립한다.

---

## 4. 이미지 저장 라이브러리 선택 (핵심 결정 1) — `html-to-image` 채택

### 후보 비교 (`npm view`로 실측, 2026-09-07 기준)

| 패키지 | 최신 버전 | 최근 배포일 | unpacked size | 런타임 의존성 |
|---|---|---|---|---|
| `dom-to-image` | 2.6.0 | **2022-06-15**(4년 이상 정체) | - | 0 |
| `html2canvas` | 1.4.1 | 2025-11-13 | 3.38MB | 2개(`css-line-break`, `text-segmentation`) |
| `html-to-image` | 1.11.13 | 2025-04-19 | 315KB | **0개** |

- **`dom-to-image`는 즉시 제외한다.** 마지막 배포가 2022-06-15로 4년 넘게 정체되어 있다
  (`docs/ARCHITECTURE.md`가 다른 계산기 선정 때 늘 확인하는 "유지보수 활발한지" 기준을
  명백히 만족하지 못한다). `html-to-image` 자체가 `dom-to-image`의 유지보수 중단 문제를
  해결하기 위해 만들어진 포크 계열 프로젝트이므로, 후자를 쓰면 `dom-to-image`가 갖고 있던
  실익(같은 렌더링 방식)을 유지보수 상태만 개선해서 그대로 얻는다.
- **`html2canvas` vs `html-to-image` — 렌더링 방식 자체가 다르다는 점이 결정적이다.**
  - `html2canvas`는 DOM 트리를 순회하며 **자체 렌더링 엔진**으로 캔버스에 다시 그린다(CSS
    파서·레이아웃 계산을 직접 구현). 이 방식은 모든 CSS 기능(그라디언트, box-shadow 근사,
    backdrop-filter 미지원 등)을 라이브러리가 일일이 재구현해야 하고, 실제로 최신 CSS
    기능에 대한 커버리지 격차가 꾸준히 보고돼 왔다(예: `backdrop-filter` 미지원, 복잡한
    `box-shadow`/그라디언트의 근사 렌더링). 의존성 2개를 포함해 unpacked 3.38MB로 이
    사이트의 다른 어떤 의존성보다도 훨씬 무겁다.
  - `html-to-image`(그리고 원조인 `dom-to-image`)는 DOM을 클론하고 각 노드의
    **`getComputedStyle` 결과를 그대로 인라인**한 뒤 SVG `<foreignObject>`로 직렬화해,
    **브라우저 자신의 렌더링 엔진**으로 그 SVG를 캔버스에 그리게 한다. 즉 CSS 기능을
    라이브러리가 재구현할 필요가 없다 — 브라우저가 이미 렌더링을 지원하는 모든 것(둥근
    모서리, box-shadow, 그라디언트, 웹폰트)이 그대로 캡처된다.
- **다크모드(CSS 커스텀 프로퍼티) 정확도 — 이 사이트의 구조와 정확히 맞아떨어진다.**
  `app/globals.css`는 다크모드를 `<html>`의 `.dark` 클래스로 전환하고, 실제 색상은
  `--primary` 같은 CSS 커스텀 프로퍼티를 Tailwind v4 `@theme inline`으로 매핑한다. 캡처
  시점에는 브라우저가 이미 `var(--primary)` 같은 참조를 구체적인 `rgb(...)` 값으로
  **완전히 해석(resolve)한 뒤**이므로, "커스텀 프로퍼티를 얼마나 잘 이해하는가"보다는
  "브라우저가 최종적으로 계산한 값(`getComputedStyle`)을 얼마나 충실히 그대로 옮기는가"가
  관건이다. `html-to-image`는 노드마다 `getComputedStyle`을 그대로 인라인하므로 이 부분에서
  구조적으로 안전하다. `html2canvas`는 자체 스타일 해석 레이어를 거치며, 중첩된
  가상요소·`currentColor` 연쇄 참조 등 일부 경계 케이스에서 완전한 `getComputedStyle`
  결과와 어긋나는 사례가 알려져 있다.
- **이 사이트의 아이콘 관례(인라인 `<svg>`, `docs/DESIGN_SYSTEM.md` "아이콘")가
  `html-to-image`의 가장 흔한 약점을 원천적으로 없앤다.** `foreignObject` 방식의 알려진
  한계는 "이미지·폰트가 CORS-safe해야 한다"는 것인데, 이 계산기의 결과 카드는 외부 `<img>`를
  전혀 쓰지 않고(아이콘도 전부 인라인 SVG, 폰트도 `next/font`로 자체 호스팅) 캡처 대상 안에
  CORS 위험이 있는 리소스가 애초에 없다.
- **번들 크기·의존성**: `html-to-image`는 런타임 의존성 0개, unpacked 315KB로
  `html2canvas`(3.38MB, 의존성 2개)의 약 1/10 수준이다. `main`/`module`/`types` 필드가 모두
  있어 ESM 트리쉐이킹도 가능하다.
- **유지보수**: 두 패키지 모두 활발하다(`html2canvas` 2025-11, `html-to-image` 2025-04 — 둘 다
  `dom-to-image`처럼 수년간 정체된 상태가 아니다). 유지보수 활발도만으로는 우열이 크지 않아,
  위 렌더링 방식·번들 크기·다크모드 정확도가 최종 결정 근거다.

### 결정 및 사용 가이드

- **`html-to-image` 채택, `npm install`로 `package.json`에 실제 반영 완료**(버전
  `^1.11.13`, `dependencies`에 추가 — devDependency 아님, 프로덕션 런타임에서 쓰이므로).
- **동적 `import()`로 지연 로드한다** — "이미지 저장" 버튼 클릭 핸들러 안에서만
  `const { toPng } = await import("html-to-image")`로 불러온다. 균등 분배처럼 애니메이션 없이
  즉시 결과를 보여주는 경로를 포함해 세 방식 모두 이미지 저장이 Must Have이므로 이 의존성은
  결국 로드되지만, 페이지 최초 진입/계산 시점의 메인 번들에는 포함하지 않아 계산 자체의
  체감 속도에 영향을 주지 않는다(Next.js 코드 스플리팅 활용, 다른 계산기들이 무거운
  의존성을 쓰지 않아 왔던 것과 달리 이 계산기가 처음으로 이 패턴이 필요해졌다).
- **포맷: PNG**(`toPng`, 손실 없는 텍스트/단색 배경 카드에 적합, JPEG 압축 아티팩트 회피).
  `pixelRatio: 2` 정도로 레티나 대응 해상도를 권장하되 구체적 수치는 Builder 재량.
- **캡처 대상 (2026-09-07 갱신 — 문제 2, 결정 뒤집음)**: 최초 결정은 SPEC.md "화면 구성"
  7번(핵심 결과 카드)만 감싸는 컨테이너였으나, 실제 브라우저 테스트에서 사용자가 "이미지
  저장 영역에 룰렛/사다리타기 그림도 포함됐으면 좋겠다"고 명시적으로 요청해 이를 뒤집는다.
  **캡처 대상 컨테이너를 SPEC.md 화면 구성 6번(애니메이션 재생 영역 — `RouletteWheel`/
  `LadderAnimation`을 감싸는 `SectionCard`)과 7번(핵심 결과 카드)을 함께 감싸는 하나의
  `ref`로 확장한다.** 균등 분배는 원래도 애니메이션이 없으므로(6번 자체가 렌더링되지 않음)
  기존과 동일하게 7번(결과 카드)만 캡처된다 — 이 변경은 몰아주기·사다리타기 두 방식에만
  실질적 영향을 준다.
  - **새로운 기술적 문제는 없다는 점을 확인함**: "이미지 저장" 버튼은 애니메이션 종료
    (`onAnimationEnd` 호출, `revealed=true`) 이후에만 활성화된다는 기존 결정(아래 "5.4"/
    "5.5")을 그대로 유지한다 — 즉 캡처가 실제로 실행되는 시점에는 룰렛의 `<g
    transform="rotate(...)">`도, 사다리타기 경로의 `stroke-dashoffset`도 이미 CSS 트랜지션이
    끝난 **최종 정지 상태**다. `html-to-image`는 캡처 시점의 `getComputedStyle` 결과를 그대로
    인라인하므로(위 "다크모드 정확도" 논거와 동일한 메커니즘), 진행 중인 애니메이션의 중간
    프레임이 찍힐 위험 자체가 구조적으로 없다. 두 SVG 모두 인라인 `<svg>`(외부 `<img>`/
    `<canvas>` 아님)이므로 "알려진 한계"에 적어 둔 `<canvas>`/외부 도메인 이미지 CORS 특수
    처리도 필요하지 않다(아래 "알려진 한계" 그대로 유지, 새 리스크 아님).
  - 캡처 대상 확장으로 이미지 자체의 정보량이 늘지만(SPEC.md Must Have 요건 (1)~(3)은
    이미 7번에 다 있으므로 필수 정보 누락 문제는 원래도 없었다), 룰렛/사다리타기 SVG가
    사용자가 "결과가 어떻게 나왔는지"를 이미지 한 장으로 공유할 때 시각적 근거를 함께
    보여주는 효과가 있다 — 이번 변경의 실질적 동기(사용자 요청)와 부합한다.
- **에러 처리**: `toPng`가 실패(예: 구형 브라우저의 `foreignObject`→canvas 변환 보안 제약,
  `SecurityError`)하면 예외를 잡아 사용자에게 실패를 알리고, SPEC.md Should Have "결과 텍스트
  클립보드 복사"를 대체 경로로 안내한다(이미지 저장의 성능/호환성 대체재가 아니라 SPEC이
  이미 별도 기능으로 요구한 것을 자연스러운 폴백으로도 겸용).

### 알려진 한계 (Builder/QA가 확인할 것)

- SVG `foreignObject`→canvas 변환은 구형 WebKit(오래된 iOS Safari)에서 캔버스가 "오염
  (tainted)"되어 내보내기가 실패하는 사례가 알려져 있다. 현재 대다수 사용자가 쓰는 최신
  Safari(15+)는 문제 없으나, 이 사이트가 320~390px 모바일 대응을 명시적으로 요구하므로
  QA 단계에서 **iOS Safari 실기기(또는 최신 시뮬레이터) 스모크 테스트를 반드시 포함**한다.
- 캡처 컨테이너 안에 `<canvas>` 요소나 외부 도메인 이미지가 추가되면(현재 계획에는 없음)
  별도 CORS/특수 처리가 필요해진다 — 향후 이 컨테이너에 새 요소를 추가할 때 이 제약을
  기억해야 한다.

---

## 5. 애니메이션 컴포넌트 구조 (핵심 결정 2)

### 5.1 렌더링 기술: **SVG + CSS 트랜지션/키프레임** (Canvas 배제)

세 방식을 비교 검토한 결과:

| 기준 | SVG + CSS | Canvas(imperative) | 순수 DOM 박스 + CSS |
|---|---|---|---|
| 다크모드 토큰 대응 | Tailwind 클래스/`currentColor` 그대로 사용, `.dark` 토글에 자동 반응 | `getComputedStyle`로 CSS 변수 값을 직접 읽어 매 프레임 `ctx.fillStyle`에 수동 반영 필요, 테마 토글마다 재계산 필요 | 자동 반응 |
| `prefers-reduced-motion` | CSS `@media` 하나로 트랜지션/키프레임 자체를 끄면 끝(선언적) | `matchMedia` 체크를 애니메이션 루프 안에 수동 분기(명령형) | CSS와 동일하게 쉬움 |
| 이미지 캡처(html-to-image) | DOM 요소라 특별 처리 없이 그대로 캡처됨 | `<canvas>`는 html-to-image가 "현재 비트맵을 그려 넣는" 별도 처리를 거침 — 캡처 시점이 애니메이션 종료 후라 문제는 없지만 특별 취급 경로가 하나 더 생김 | 그대로 캡처됨 |
| 원형 룰렛 표현 | 부채꼴(`<path>` arc)·원형 배치가 SVG의 기본 도형 문법 | 수동으로 삼각함수 계산해 매 프레임 그려야 함 | `border-radius`/`clip-path`로 부채꼴을 흉내내야 해 기하학적으로 번거로움 |

**결론: SVG 도형 + CSS `transform`/`stroke-dasharray` 트랜지션(키프레임 필요 시 병행)으로
두 애니메이션을 모두 구현한다. `<canvas>` 기반 명령형 렌더링은 채택하지 않는다.** 다크모드
대응이 "토큰 클래스를 그대로 쓰면 자동으로 되는가, 매 프레임 수동으로 다시 계산해야 하는가"의
차이가 가장 크고, `prefers-reduced-motion`도 선언적 CSS 쪽이 "애니메이션 유무와 무관하게
결과가 같아야 한다"는 요건을 지키기 쉽다(분기 로직이 적을수록 결과-표시 불일치 버그가 줄어든다).

- **룰렛(몰아주기)**: 원 하나를 `members.length`개의 부채꼴로 나눈 SVG(`<path>` arc 명령).
  전체 부채꼴 그룹을 하나의 `<g transform="rotate(...)">`로 감싸고, 이 `transform` 값을
  "여러 바퀴 회전 + `selectedIndex`가 상단 고정 포인터에 오는 최종 각도"로 계산해 CSS
  트랜지션(감속 이징, 예: `cubic-bezier(0.15, 0.85, 0.35, 1)`류)으로 애니메이션한다. 회전이
  끝나는 지점은 **이미 확정된 `selectedIndex`로부터 역산한 각도**이지 애니메이션이 스스로
  결정하는 값이 아니다(FORMULA.md "계산 순서" 원칙 그대로).
- **사다리타기**: 세로선(`<line>`, `members.length`개)과 가로선(rung)을 정적으로 먼저 그린
  뒤, 각 멤버의 최종 경로를 나타내는 `<path>` `members.length`개를 `stroke-dasharray`/
  `stroke-dashoffset` "그려지는" 애니메이션(고전적 SVG line-drawing 기법)으로 순차 또는
  동시에 드러낸다. FORMULA.md가 명시적으로 허용한 "매칭 결과를 먼저 정하고 사다리 형태로만
  시각화하는 방식"을 그대로 유지한다 — 실제 가로줄 경로를 물리적으로 시뮬레이션해 매칭을
  도출하지 않는다(이미 확정된 `matches`/`permutation`으로부터 시각적 경로만 역산해서 그린다).
  **가로선(rung) 배치는 2026-09-07부로 더 이상 무작위 장식이 아니다** — FORMULA.md "사다리타기
  시각화 경로 재구성 알고리즘"이 정의한 `buildLadderRungs(permutation)`으로부터 결정적으로
  유도되는 값이며, 그 가로줄을 실제로 타고 내려가는 경로가 매칭 곡선이 된다(아래 "5.1.1"
  참고). 다만 이 값은 여전히 `permutation`을 읽기만 할 뿐 바꾸지 않는 순수 함수의 출력이므로,
  "RNG 주입/Calculation Auditor 통계 검증 대상이 아니다"라는 결론 자체는 그대로 유지된다(위
  결론이 바뀐 것은 "무작위인가"가 아니라 "장식(결과 무관)인가" 쪽이다 — 이제는 장식이 아니라
  결과를 시각적으로 설명하는 값이지만, 여전히 통계적으로 검증할 대상은 아니다).

### 5.1.1 사다리타기 가로줄(rung) 결정론적 재구성 — 2026-09-07 갱신 (문제 1)

실제 브라우저 테스트에서 사용자가 "그려진 선을 따라 이동하는 게 아니라 마음대로 꽂히는
것처럼 보인다"고 지적했다. 기존 구현은 (a) `generateDecorativeRungs`가 회색 가로줄을
`Math.random()`으로 완전히 무작위 생성하고, (b) 매칭 곡선은 그 가로줄과 무관하게 시작점→
목표열까지 직접 베지어 곡선 하나로 그렸다 — 좌표상 도착 지점은 정확했지만 "사다리를 타고
내려간다"는 시각적 설득력이 없었다. FORMULA.md가 새로 정의하고 오케스트레이터가 Python으로
독립 재검증까지 마친(N=2~20 전 구간, 핵심 불변식 100% 성립) `buildLadderRungs(permutation)`/
`simulateFinalColumn(rungs, startColumn)` 알고리즘을 그대로 채택해 이 문제를 고친다.

**함수 배치 — 계산기 전용 신규 파일 `ladder-layout.ts`(logic.ts에 얹지 않음, types.ts에
타입만 추가)**:

- `buildLadderRungs`/`simulateFinalColumn`(및 내부 2단계 `generateAdjacentSwaps`/
  `scheduleSwapsIntoRows`)은 `src/calculators/bill-split-calculator/ladder-layout.ts`라는
  새 파일에 둔다. `logic.ts`에 추가하지 않는 이유:
  1. **도메인 경계**: `logic.ts`는 "돈 계산 + RNG 원시 함수 + 공유 복원"(위 "2.")이 명확한
     범위다. `buildLadderRungs`는 이미 확정된 `permutation`을 **읽기 전용 입력**으로 받아
     화면 표시용 좌표 데이터(`LadderRung[]`)만 만들 뿐 금액도 RNG도 다루지 않는다 —
     `logic.ts`에 섞으면 "Calculation Auditor가 통계 검증해야 할 함수가 어디까지인가"가
     다시 흐려진다(FORMULA.md가 이 절에서 정확히 이 혼동을 우려해 "여전히 RNG 주입/통계
     검증 대상이 아니다"를 반복해서 명시한 이유와 같다). 별도 파일로 분리하면 "이 파일의
     함수는 애초에 Auditor 감사 대상이 아니다"가 파일 경계만으로 드러난다.
  2. **테스트 성격이 다르다**: FORMULA.md는 이 알고리즘에 대해 결정적 Golden Test 7개
     (L1~L7)를 정의했다 — React 렌더링이나 `Math.random` 모킹이 전혀 필요 없는 순수 함수
     테스트다. `LadderAnimation.tsx`(`"use client"`, React 훅 보유)에 묻으면
     `LadderAnimation.test.tsx`가 컴포넌트 렌더링을 거쳐야만 이 값을 검증할 수 있다 —
     `logic.test.ts`가 `calculate*`를 순수 함수로 직접 호출해 Golden Test를 돌리는 것과
     동일한 방식으로 `ladder-layout.test.ts`가 `buildLadderRungs`/`simulateFinalColumn`을
     직접 호출해 L1~L7을 재현할 수 있어야 한다.
  3. **`logic.ts` 쪽 선례와의 구조적 유사성**: `ladder-layout.ts`는 `logic.ts`처럼 "타입은
     `types.ts`에서 가져오고, 이 파일은 그 타입을 채우는 순수 함수만 담는다"는 동일한
     패턴을 따른다(RouletteWheel/LadderAnimation의 컴포넌트 로컬 Props 타입과는 다른
     선례 — Props는 "그 컴포넌트만의 외부 계약"이라 컴포넌트 파일에 남겨 두지만,
     `LadderRung`/`LadderRungLayout`은 "순수 함수가 만드는 데이터 모양"이라 `logic.ts`의
     결과 타입들(`Share`/`LadderMatch` 등)과 같은 층위로 보고 `types.ts`에 넣었다 — 위
     "3." 참고).
  4. 파일명은 `use-prefers-reduced-motion.ts`와 같은 케밥 표기 선례를 따라
     `ladder-layout.ts`로 한다(계산기의 "3대 핵심 방식" 중 하나가 아니라 보조 모듈이라는
     성격이 `logic.ts`의 단순 소문자 이름보다 이 표기와 더 맞는다).
- `generateAdjacentSwaps`/`scheduleSwapsIntoRows`도 함께 export한다 — FORMULA.md 검증
  예제(L2~L6)가 1단계 스왑 목록(`swaps=[1,0,1]` 등)까지 손으로 추적해 명시했으므로,
  `ladder-layout.test.ts`가 중간 단계까지 화이트박스로 재현·검증할 수 있게 한다.
- `LadderAnimation.tsx`는 `import { buildLadderRungs } from "./ladder-layout"`로 가져와
  `useMemo(() => buildLadderRungs(permutation), [permutation])`로 한 번만 계산한다 —
  `generateDecorativeRungs`가 쓰던 `useState` 지연 초기값(마운트 시 1회 난수 고정) 패턴은
  더 이상 필요 없다(입력이 결정적이므로 `useMemo`로 충분하고, 매 렌더 안정성도 자동으로
  보장된다 — 부수효과로 `LadderAnimation.test.tsx`가 `Math.random`을 모킹할 필요도 사라진다).

**`generateDecorativeRungs`/`DecorativeRung`는 삭제 대상으로 확정한다.** `buildLadderRungs`가
만드는 `{ rungs, rowCount }`(types.ts `LadderRungLayout`)로 완전히 대체된다 — 두 함수가
공존할 이유가 없다(장식용 가로줄과 실제 경로가 다시 어긋나는 예전 버그를 재도입하게 된다).

**렌더링 — Y좌표 매핑**: 기존 `TOP_Y=26`은 유지하되, `BOTTOM_Y`를 `rowCount`에 비례해
동적으로 계산한다. 임의의 행 `row`(0-indexed)의 Y좌표는

```
rowY(row) = TOP_Y + (row + 1) * (BOTTOM_Y - TOP_Y) / (rowCount + 1)
```

로 `TOP_Y`~`BOTTOM_Y` 구간을 `rowCount + 1`등분한다. **분모를 항상 `rowCount + 1`로
고정하면(`rowCount` 단독이 아니라) `rowCount = 0`(예제 L1, 항등순열)에서도 0으로 나누는
계산 자체가 발생하지 않는다** — 다만 `rowCount = 0`이면 `rungs` 배열도 비어 있으므로
`rowY`가 실제로 호출될 일 자체가 없다(가로줄이 없으니 좌표 계산도 없음). 그럼에도
FORMULA.md가 명시적으로 요구한 방어 코드이므로, `rungs.length === 0`이면 가로줄 렌더링
루프 자체를 건너뛰는 조기 분기를 명시적으로 둔다(방어적 코딩 — 세로선만 그려진 사다리도
정상 케이스임을 코드로도 드러낸다).

**렌더링 — SVG 높이 동적 확장(N=20 역순 37행 대응)**: 현재 고정값(`BOTTOM_Y=220`, CSS
`h-64 sm:h-72`)은 37행을 수용하기엔 좁다. 다음 두 값을 모두 `rowCount`에 비례해 늘리되
상한을 둔다(구체적 상수는 가이드라인 — Builder가 실제 렌더링으로 미세조정 가능, 다른
계산기 선례와 동일한 재량 범위):

- **viewBox 내부 높이**: `BOTTOM_Y = TOP_Y + Math.max(BASE_HEIGHT, (rowCount + 1) *
  MIN_ROW_GAP)`(예: `BASE_HEIGHT ≈ 194`(기존 고정폭 유지), `MIN_ROW_GAP ≈ 16` — 가로줄
  사이 간격이 라벨·터치 여백 없이도 시각적으로 구분될 최소값). `rowCount ≤ 11` 정도까지는
  `BASE_HEIGHT`가 그대로 유지되고, 그 이상부터 `MIN_ROW_GAP` 기준으로 늘어난다. N=20 역순
  (`rowCount=37`)이면 `(37+1)×16=608` → `BOTTOM_Y ≈ 634`.
- **렌더링 CSS 높이**: 고정 `h-64 sm:h-72`를 `rowCount`에 비례해 늘어나되 상한이 있는 값
  (예: `Math.min(520, 220 + rowCount * 8)`px)으로 바꾼다 — 이렇게 하면 (a) 37행을 기존의
  작은 고정 박스에 욱여넣어 가로줄 간격이 안 보일 정도로 압축되는 문제와 (b) 페이지 레이아웃이
  통제 불가능하게 늘어나는 문제를 모두 피한다. `preserveAspectRatio="xMidYMid meet"`는
  그대로 유지해 viewBox 종횡비와 실제 렌더링 박스 종횡비가 정확히 일치하지 않아도(레터박싱)
  깨지지 않게 한다.
- N=20(members=20)에서 viewBox 너비(`PADDING×2 + COLUMN_WIDTH×19 ≈ 800px대`)가 위 높이
  (`~634`)보다 여전히 크므로(가로가 세로보다 김), N이 커져도 "매우 좁고 긴" 종횡비가 되는
  문제는 생기지 않는다 — 열 수(N)와 행 수(`2N-3`, FORMULA.md)가 거의 같은 자릿수로 함께
  늘어나지만 `COLUMN_WIDTH(40)`이 `MIN_ROW_GAP(16)`보다 커서 너비가 항상 더 빠르게 늘어난다.

**렌더링 — 매칭 경로(꺾은선) 구성**: "완전 직각" vs "완전 곡선" 중 **절충안을 채택한다 —
각 rung 교차 지점(row)에서만 작은 반경으로 둥글게 처리한 꺾은선(rounded-corner polyline)**.

- 순수 직각(90도) 꺾은선은 `buildLadderRungs`가 만든 좌표와 정확히 일치해 가장
  "사다리답게" 보이지만, N=20(최대 37개 교차)에서 한 경로에 코너가 여러 개 몰리면 픽셀
  단위로 각진 "계단" 인상이 강해져 가독성이 떨어질 수 있다. 완전한 곡선(예: 각 구간을
  통째로 스무스 스플라인)은 부드럽지만 "정확히 이 행에서 넘어간다"는 시각적 근거가
  흐려진다(FORMULA.md의 시뮬레이션 규칙 — "row 오름차순으로 rung을 지날 때만 열이 바뀐다" —
  과의 대응 관계가 그림만 봐서는 애매해진다).
- 절충안: 각 멤버의 경로를 `row` 오름차순으로 순회하며(정확히 `simulateFinalColumn`과 같은
  순회 규칙) 그 멤버에 실제로 영향을 준 교차만 모아 "현재 열 유지(수직 구간) → 교차 지점
  근처에서 작은 반경 코너(`Q` 등 짧은 2차 베지어) → 수평 이동 → 다음 수직 구간"을 반복하는
  `d` 문자열을 만든다. 코너 반경은 작게(예: 4~6px, `MIN_ROW_GAP`보다 확실히 작게 — 위아래
  다른 교차와 겹치지 않도록) 고정한다. 이 방식은 FORMULA.md 시뮬레이션 규칙과 픽셀 단위로
  어긋나지 않으면서(코너는 "어디서 도는지"를 바꾸지 않고 그 지점의 렌더링만 부드럽게 한다)
  37개 교차가 몰려도 시각적 노이즈를 줄인다.
- **경로 길이(`strokeDasharray`) 재계산 필요**: 기존 `approxPathLength(dx, dy)`는 시작점→
  목표열까지의 직선 거리(유클리드 거리)를 근사한 값으로, 베지어 곡선 하나짜리 경로에만
  맞는 근사치였다. 이제 경로가 실제로 여러 번 꺾이므로(수직 구간 합 + 수평 구간 합), 새
  경로 길이는 **각 수직/수평 직선 구간 길이의 합**(코너의 곡선 보정은 무시해도 되는
  수준 — 반경이 작으므로)으로 다시 계산해야 한다. 기존 주석("line-drawing 애니메이션의
  dash 길이 산정용이라 정밀도가 픽셀 단위로 정확할 필요는 없다")의 허용 오차 기준은
  그대로 유지한다 — 다만 계산 방식 자체(유클리드 직선 거리 → 꺾은선 구간 합)는 바뀌어야
  한다는 점을 명시해 둔다(그대로 재사용하면 실제보다 훨씬 짧게 나와 애니메이션이 절반도
  안 그려진 것처럼 보이는 회귀가 생긴다).
- **`stroke-dasharray`/`stroke-dashoffset` line-drawing 기법 자체는 그대로 유지한다** —
  경로의 `d` 속성만 바뀔 뿐 애니메이션 메커니즘은 바꿀 이유가 없다(다크모드/
  `prefers-reduced-motion` 대응 방식도 위 "5.1"/"5.4" 결정 그대로 유지).
- FORMULA.md가 "선택적, 필수 아님"으로 남긴 "`c` 루프 방향 뒤집기로 시각적 다양성 주기"는
  **이번 라운드에서 채택하지 않는다** — Golden Test(L1~L7)가 오름차순 버블링 기준으로만
  작성되어 있고, 지금 도입해도 사용자 체감 이득이 크지 않다(장식적 다양성일 뿐). 필요해지면
  별도 라운드에서 재검토한다.

**요약**: `generateDecorativeRungs`/베지어 직선 경로 → `buildLadderRungs`(결정적) + rung
기반 꺾은선(절충 렌더링) + 동적 SVG 높이로 전면 교체한다. `permutation` 자체나 그 값을 만드는
Fisher-Yates 로직은 이 절 어디에서도 건드리지 않는다(FORMULA.md 범위 제약 그대로 준수).

### 5.2 컴포넌트 배치: 계산기 전용 폴더 안에 둔다 (공용화 보류)

이 사이트에 룰렛·사다리타기 애니메이션이 필요한 계산기가 아직 이것 하나뿐이다.
`housing-subscription-score`/`loan-interest-calculator`가 세운 "아직 사례가 1개뿐이면
승격하지 않는다" 원칙(예: `loan-interest-calculator`의 "년+개월 입력" UI를
`components/calculator/`로 승격하지 않고 `ui.tsx` 로컬 서브컴포넌트로 둔 판단)을 그대로
적용한다.

- **위치: `src/calculators/bill-split-calculator/RouletteWheel.tsx`,
  `src/calculators/bill-split-calculator/LadderAnimation.tsx`.** `components/calculator/`
  (사이트 전역 공용 컴포넌트 자리)가 아니라 계산기 전용 폴더 안에 둔다.
- 기존 `logic.ts`/`validation.ts`/`formatting.ts`/`ui.tsx`/`types.ts` 5분할은 "계산기 하나 =
  기본 5개 파일"이라는 **기본값**이지, 그 이상의 파일을 추가하는 것을 막는 규칙이 아니다 —
  `loan-interest-calculator`도 `content.ts`를 추가한 전례가 있다. 이번엔 애니메이션 UI가
  `ui.tsx` 하나에 다 들어가기엔 복잡도가 높아(각각 SVG 기하 계산 + 트랜지션 상태 관리) 별도
  파일로 뺀다 — 여전히 "이 폴더 하나만 수정하면 된다"는 원칙(docs/ARCHITECTURE.md "계산 로직
  / UI 분리")은 지켜진다.
- **다음에 룰렛·사다리타기류 애니메이션이 필요한 계산기가 나오면 그때 `components/calculator/`
  승격을 재검토한다**(2번째 사례가 생기는 시점 — housing-subscription-score 라운드가 남긴
  "3번째 계산기에서 재검토 후보로 남긴다"는 관례와 동일한 유예 방식).

### 5.3 데이터 흐름 / Props 계약

두 컴포넌트 모두 **"이미 계산된 결과를 입력받아 그 결과에 맞는 목표 상태로 애니메이션할 뿐,
내부에서 결과를 결정하지 않는다"**는 계약을 props 타입으로 강제한다 — RNG 관련 인자를 아예
받지 않는다(받을 이유가 없다).

```ts
// RouletteWheel.tsx
export interface RouletteWheelProps {
  members: string[];        // 부채꼴 라벨(표시용) — 순서 = 인덱스
  selectedIndex: number;    // 이미 확정된 결과(calculateWinnerTakeAll의 출력)
  playAnimation: boolean;   // false면 회전 없이 최종 각도로 즉시 정지된 상태를 렌더링
  onAnimationEnd: () => void; // playAnimation=false면 마운트 시 즉시 호출
}

// LadderAnimation.tsx
export interface LadderAnimationProps {
  members: string[];
  amounts: number[];
  permutation: number[];    // 이미 확정된 결과(calculateLadderSplit의 출력 필드 그대로)
  playAnimation: boolean;
  onAnimationEnd: () => void;
}
```

- 두 컴포넌트 모두 `selectedIndex`/`permutation`을 **`types.ts`에 이미 정의된 결과 타입의
  필드와 동일한 이름·모양**으로 받는다 — `ui.tsx`가 `WinnerTakeAllResult`/`LadderSplitResult`를
  그대로 구조분해해 넘기면 되고, 컴포넌트 내부에서 별도 변환·재계산이 필요 없다.
- **장식용 난수(연출 전용)는 컴포넌트 내부에 있어도 된다** — 예: 룰렛이 "몇 바퀴 도는지"(예:
  4~6바퀴). 이런 값은 `selectedIndex`라는 실제 결과에 전혀 영향을 주지 않는 순수 시각
  효과이므로 FORMULA.md의 "RNG를 함수 인자로 주입 가능하게 설계" 요건(공정성 검증 대상)
  밖이다 — Calculation Auditor가 통계 검증할 대상이 아니라는 점을 Builder/Auditor 모두
  혼동하지 않도록 이 문서에 명시해 둔다. 다만 가독성을 위해 이런 장식용 난수도 컴포넌트의
  `useRef`/`useState` 초기값 계산에서 한 번만 생성하고(리렌더마다 바뀌지 않게), 애니메이션
  재생과 무관하게 결정된 실제 결과에는 절대 관여하지 않는다는 것만 지키면 된다.
  **(2026-09-07 갱신)** 사다리타기의 가로줄(rung) 배치는 더 이상 이 항목의 예시가 아니다 —
  위 "5.1.1"에서 확정한 대로 `buildLadderRungs(permutation)`이 결정적으로 유도하는 값으로
  바뀌었으므로(장식용 난수 아님, 그러나 여전히 RNG 주입/통계 검증 대상도 아님), 이 절이
  다루는 "연출 전용 난수" 범주에서는 빠진다.
- **N이 클 때(위 "7." 참고) 두 다이어그램 모두 "번호/색상 키 + 별도 범례 목록" 패턴을
  따른다** — SVG 도형 안에는 멤버 번호(또는 색상)만 표시하고, 실제 이름 전체는 다이어그램
  바깥의 결과 목록(핵심 결과 카드, SPEC.md 화면 구성 7번)에서 온전히 보여준다. 자세한 근거는
  "7. 멤버 최대 인원수 재검토" 참고.

### 5.4 `prefers-reduced-motion` 처리 지점 — 오케스트레이터(`ui.tsx`)가 한 곳에서 판단한다

`playAnimation` 값은 애니메이션 컴포넌트 내부가 아니라 **`ui.tsx`가 계산해 props로
내려준다**(`window.matchMedia("(prefers-reduced-motion: reduce)").matches`를 계산기 전용
훅 하나(`usePrefersReducedMotion()`, 이 계산기 폴더 안 로컬 — 아직 두 번째 사용처가 없어
`src/lib/` 승격 보류, 위 "5.2"와 같은 판단 기준)로 한 번만 읽는다). 두 애니메이션 컴포넌트
안에 각각 `matchMedia` 체크를 중복 구현하지 않는다 — 판단 지점을 하나로 모아야 "애니메이션
유무와 무관하게 결과가 같아야 한다"는 불변식을 검증하기도 쉽다(`ui.test.tsx`가
`playAnimation={false}`를 직접 주입해 두 컴포넌트를 독립적으로 테스트할 수 있고, jsdom에서
`matchMedia`를 모킹할 필요가 없다).

- `playAnimation=false`일 때 두 컴포넌트는 **트랜지션 없이 최종 상태를 즉시 렌더링**하고
  (룰렛: 최종 회전각으로 고정, 사다리타기: 모든 경로를 `stroke-dashoffset: 0`으로 즉시 표시),
  마운트 직후(`useEffect`) `onAnimationEnd()`를 호출한다 — 부모의 "결과 카드 표시" 단계가
  애니메이션 재생 여부와 무관하게 항상 같은 타이밍 모델(콜백 1회 호출)로 진행된다.
- `onAnimationEnd` 호출 시점은 실제 CSS `transitionend`/`animationend` DOM 이벤트가 아니라
  **CSS 트랜지션 시간과 값이 같은 JS 상수 기반 `setTimeout`을 권장한다**(jsdom은 실제 CSS
  트랜지션을 실행하지 않아 `transitionend`가 발생하지 않으므로, 이 방식이 아니면
  `ui.test.tsx`에서 결정적으로 테스트하기 어렵다 — vitest의 fake timers로 정확히 검증
  가능해진다). 구체적 지속시간·이징 값은 Builder 재량.

### 5.5 이미지 캡처와의 상호작용

**(2026-09-07 갱신 — 문제 2, 위 "4. 캡처 대상" 결정 뒤집음에 따른 갱신)** 이미지 저장 캡처
대상은 더 이상 애니메이션 컴포넌트를 제외하지 않는다 — 애니메이션 재생 영역(6번)과 결과
카드(7번)를 함께 감싸는 하나의 컨테이너가 캡처 대상이다(위 "4." 참고). `ui.tsx`는 여전히
"이미지 저장" 버튼을 애니메이션 종료(`onAnimationEnd` 호출) 이전에는 비활성화하거나 숨겨,
캡처 시점에 항상 정적으로 확정된 상태(결과 카드 + 최종 정지 상태의 SVG)만 존재하게 한다
(SPEC.md 화면 구성 순서 6→7→8이 이미 이 순서를 보장하므로, 버튼의 활성화 조건만 그 순서를
UI 레벨에서도 강제하면 된다). 이 활성화 조건 자체는 바뀌지 않았다 — 바뀐 것은 "캡처
컨테이너가 6번도 포함하는가"뿐이다. 버튼이 활성화된 시점에는 룰렛의 회전 `transform`도
사다리타기의 `stroke-dashoffset`도 이미 트랜지션이 끝난 값으로 고정돼 있으므로, 캡처가
진행 중인 애니메이션의 중간 프레임을 찍을 가능성은 구조적으로 없다.

---

## 6. ShareActions 인코딩 스키마 (핵심 결정 5)

### 스키마

`types.ts`의 `BillSplitShareState`(위 "3." 참고)를 그대로 인코딩 대상으로 쓴다:

```ts
type BillSplitShareState =
  | { mode: "equal"; totalAmount: number; members: string[] }
  | { mode: "winner-take-all"; totalAmount: number; members: string[]; selectedIndex: number }
  | { mode: "ladder"; members: string[]; amounts: number[]; permutation: number[] };
```

- **기존 `src/lib/share.ts`의 `buildStateShareUrl(baseUrl, data)`/`encodeShareState`/
  `decodeShareState`를 그대로 재사용한다 — 수정 없음.** 이 인프라는 이미 `data: unknown`을
  받는 범용 Base64URL 인코더라 새 스키마 대응에 어떤 변경도 필요 없다.
- `decodeShareState`는 `unknown`을 반환하므로, `validation.ts`에 이 프로젝트의 기존 관례
  (zod 미사용, 손으로 짠 타입가드 — `severance-pay`/`loan-interest-calculator` 선례 그대로)를
  따라 `parseBillSplitShareState(data: unknown): BillSplitShareState | null`을 추가한다.
  `mode` 필드 존재 여부와 각 분기별 필수 필드(숫자 배열 길이, 범위 등)를 확인하고, 하나라도
  어긋나면 `null`을 반환해 `ui.tsx`가 "공유 링크가 손상되었습니다" 안내로 대체한다(기존
  `decodeShareState`의 "손상된 상태는 화면 오류 대신 null" 원칙과 동일한 층위에서 한 번 더
  검증).
- **복원 로직은 RNG를 다시 호출하지 않는다** — 위 "2.3"의 `restoreBillSplitResult`를 그대로
  호출한다.

### 어떤 모드가 필수 인코딩인지 (FORMULA.md 요건 재확인)

- **균등**: 결과가 입력만으로 결정적이므로 결과 스냅샷이 필수는 아니다. 다만 스키마 통일을
  위해 `mode: "equal"`도 이 유니온에 포함시켜(입력만) `restoreBillSplitResult`가 세 방식을
  하나의 `switch`로 처리하게 한다 — "균등만 특별 취급"하는 분기를 `ui.tsx`에 따로 두지 않는다.
- **몰아주기**: `selectedIndex` 필수 포함 — 만족.
- **사다리타기**: `permutation` 필수 포함(`matches` 전체 대신 `permutation`만 저장해 페이로드를
  더 작게 유지 — `members`/`amounts`는 어차피 입력값으로 이미 포함되므로 `matches`를 별도로
  중복 저장할 이유가 없다).

### URL 길이 실측 (멤버 20명 최악 조건)

`encodeShareState`(Base64URL, `TextEncoder`로 UTF-8 인코딩) 로직을 Node로 직접 재현해
실측했다 — 멤버 20명, 각 이름 8자(한글, "멤버이름테스트0"~19), 금액 8자리(87,654,321원)
조건:

| 모드 | 인코딩된 `s=` 값 길이(문자) |
|---|---|
| 균등 | 764 |
| 몰아주기 | 803 |
| 사다리타기(가장 큼 — `amounts`+`permutation` 둘 다 포함) | 1,079 |

계산기 페이지 URL(`https://.../calculators/bill-split-calculator?s=...`)을 더해도 전체 URL
길이는 약 1,135자 수준이다. `src/lib/share.ts`의 `MAX_ENCODED_STATE_LENGTH = 12_000`(문자)
상한과 비교해도, 그리고 구형 브라우저 호환을 위해 흔히 권장되는 안전 URL 길이(약 2,000자)와
비교해도 **여유가 매우 크다** — 별도 압축이나 페이로드 축소(예: 이름을 인덱스로만 저장하고
별도 사전 테이블을 쓰는 등)가 전혀 필요하지 않다. 카카오톡 공유 등 채널별 URL 길이 제약도
이 규모에서는 문제되지 않는다.

---

## 7. 멤버 최대 인원수 재검토 — **20명 유지(조건부)**

SPEC.md가 잠정 20명으로 두고 "애니메이션 렌더링 성능/가독성 검증 결과 반영"을 Architect에게
위임했다. 두 애니메이션을 실제 기하 조건으로 검토했다:

- **룰렛**: 320px 화면에서 지름 약 260~280px(패딩 제외) 원을 가정하면 반지름 약
  130~140px, 둘레 약 820~880px. 20등분하면 부채꼴 하나의 호 길이가 약 41~44px — 한글 이름
  2~3자 정도의 라벨이면 표시 가능하지만 4자 이상은 빡빡하다.
- **사다리타기**: 같은 320px 폭을 20개 세로줄로 나누면 한 열의 폭이 약 14~16px — 이름 라벨을
  세로줄 위에 가로쓰기로 얹기에는 매우 부족하다(룰렛의 원주 방향 공간보다 선형 폭이 훨씬
  타이트하다 — 원의 둘레가 지름의 약 π배라 같은 화면 폭 제약에서 룰렛 쪽이 라벨에 쓸 수
  있는 공간이 본질적으로 더 넓다).

**따라서 인원수 상한 자체를 낮추는 대신, 두 다이어그램 모두 "다이어그램 안에는 번호(또는
색상) 키만 표시하고, 실제 이름 전체는 다이어그램 바깥의 별도 목록에서 보여준다"는 렌더링
규칙을 구조적으로 채택해 20명을 유지한다** — 이 패턴을 채택하지 않으면 20명에서 실제로
잘리거나 읽을 수 없는 라벨이 생기므로, SPEC.md가 "잘리지 않아야 한다"고 요구한 조건을
충족시키는 전제 조건이자 이번 재검토의 실질적 결론이다.

- **룰렛**: 부채꼴에는 번호(또는 배지 색)만 표시, 멤버 수가 적을 때(예: N ≤ 10)는 원주 공간이
  넉넉하므로 이름 전체를 표시해도 된다 — N에 따라 자동으로 전환하는 규칙을 둔다(N > 10이면
  번호/색상만, N ≤ 10이면 이름까지). 정확한 임계값은 Builder가 실제 렌더링으로 미세조정
  가능(가이드라인일 뿐, 하드 스펙 아님).
  전체 이름-번호 매핑은 회전판 바로 아래(또는 옆)에 목록으로 항상 노출한다.
- **사다리타기**: 세로줄 위에는 번호만, 멤버 전체 이름·최종 배정 금액은 애니메이션 종료 후
  핵심 결과 카드(SPEC.md 화면 구성 7번)에 목록으로 표시한다 — 애니메이션 진행 중에도 최소한
  번호만으로 "어느 줄이 어디로 내려가는지"는 시각적으로 추적 가능해야 한다.
- 이 규칙은 "다이어그램 = 과정을 보여주는 연출", "결과 목록 = 실제 정보 전달"이라는 역할
  분리이기도 하다 — SPEC.md "애니메이션은 결과를 보여주기만 한다"는 원칙과도 부합한다
  (다이어그램이 정보 전달의 유일한 수단이 아니게 설계한다).
- **20명을 넘는 인원(v1 범위 밖)까지 고려한 확장은 하지 않는다** — FORMULA.md가 이미 명시한
  대로 알고리즘 자체는 N에 무관하게 성립하므로, 향후 상한을 올릴 근거(예: 대규모 모임 요청)가
  생기면 이 다이어그램 규칙(번호/색상 키 + 범례)이 그대로 더 큰 N에도 확장 가능하다.

---

## 8. 폴더 구조

```
src/calculators/bill-split-calculator/
  types.ts                # 입력·결과·RandomSource·공유 상태 타입 (Architect 완성 — 이번 라운드)
  logic.ts                # 세 방식 계산 + RNG 원시 함수 + 공유 복원 (위 "2." 전체)
  logic.test.ts            # FORMULA.md 검증 예제 13개 + 불변식 + Auditor 인수용 시뮬레이션 헬퍼
  validation.ts             # 입력 검증(zod 미사용, 기존 관례) + parseBillSplitShareState
  validation.test.ts
  formatting.ts             # 통화 포맷, 방식별 핵심 결과 문구 조립, breakdown
  formatting.test.ts
  content.ts                 # 방식별 한 줄 설명(SPEC.md 예시 문구), 소개/사용법/FAQ, 이용 안내 고지
  RouletteWheel.tsx          # 몰아주기 전용 SVG+CSS 애니메이션 (위 "5.")
  RouletteWheel.test.tsx
  LadderAnimation.tsx        # 사다리타기 전용 SVG+CSS 애니메이션 (위 "5.", "5.1.1")
  LadderAnimation.test.tsx
  ladder-layout.ts           # buildLadderRungs/simulateFinalColumn — rung 결정론적 재구성
                             # 순수 함수(RNG 없음, logic.ts와 분리, 위 "5.1.1" 2026-09-07 추가)
  ladder-layout.test.ts      # FORMULA.md Golden Test L1~L7
  use-prefers-reduced-motion.ts  # 로컬 훅(위 "5.4", 아직 2번째 사용처 없어 승격 보류)
  ui.tsx                     # 입력(방식 선택 포함)/결과(방식별 템플릿)/캡처 컨테이너/공유 UI
  ui.test.tsx
```

`RouletteWheel`/`LadderAnimation`/`use-prefers-reduced-motion`은 이번 계산기에서 처음
등장하는 파일 구성이지만, "계산기 하나 = `src/calculators/{slug}/` 폴더 하나, 다른 계산기에
영향 없이 이 폴더만 수정 가능"이라는 핵심 원칙은 그대로 지켜진다(docs/ARCHITECTURE.md "계산
로직 / UI 분리").

---

## 9. UI 구조 (SPEC.md "화면 구성" 1~12 매핑)

`docs/DESIGN_SYSTEM.md` "공통 화면 순서"의 4개 공용 컴포넌트(`SectionCard`, `UsageGuide`,
`IntroSection`, `FaqAccordion`)를 그대로 재사용한다.

1. **소개**(`IntroSection`): SPEC.md "목적" 요약 — "참고·재미 목적, 법적 효력 없음"을 이미
   여기서부터 언급(SPEC.md "범위 밖" 대응, 반복 고지).
2. **사용 방법**(`UsageGuide`): SPEC.md "핵심 사용자 흐름" 1~5단계를 번호 목록으로.
3. **분배 방식 선택**(`SectionCard` + 라디오/세그먼트): `mode` 3개 값, 각 옆에 SPEC.md가 제시한
   상세 설명 문구(`content.ts`에 보관, 다른 계산기의 "한 줄 요약"보다 김 — SPEC.md 명시).
   방식 전환 시 아래 입력 폼 필드 구성 자체가 바뀐다(사다리타기만 `amounts[]` 필드 세트).
4. **방식별 입력 폼**(`SectionCard`): 멤버 이름 추가/삭제 목록(공통) + 총 금액(균등/몰아주기)
   또는 인원별 금액 목록(사다리타기, 멤버 추가/삭제와 자동 동기화). 초기화/샘플 값 버튼도
   방식별로 배치(`DESIGN_SYSTEM.md` "Reset/Sample").
5. **공유 액션(계산 전)**(`ShareActions`): `url`=계산기 URL, `text`=소개 문구(SPEC.md).
6. **계산 실행**: 균등은 버튼 클릭 즉시 결과 상태로 전환. 몰아주기/사다리타기는 먼저
   `calculateWinnerTakeAll`/`calculateLadderSplit`을 호출해 결과를 확정한 뒤, 그 결과를
   `RouletteWheel`/`LadderAnimation`에 props로 넘겨 재생(위 "5." 데이터 흐름). 이 애니메이션
   재생 영역을 감싸는 `SectionCard`는 **2026-09-07부로 7번(핵심 결과 카드)과 함께 이미지
   캡처 대상 컨테이너에 포함된다**(위 "4."/"5.5" — 균등 분배는 이 영역 자체가 렌더링되지
   않으므로 영향 없음).
7. **핵심 결과 카드**(강조 카드, `bg-primary`, `docs/DESIGN_SYSTEM.md` "핵심 결과 카드" 스타일
   — **6번(애니메이션 재생 영역)과 함께 이미지 캡처 대상 컨테이너를 이룬다, 2026-09-07 갱신,
   위 "4."/"5.5" 참고**): `result.mode`로 분기(TypeScript exhaustiveness 체크 도움):
   - `equal`: 멤버별 동일/±1원 금액 목록. `baseShare`/`remainderCount`로 "왜 일부만 1원 더
     내는지"를 짧게 설명.
   - `winner-take-all`: 선정된 멤버 이름 + 전액, 나머지는 0원임을 명확히(SPEC.md).
   - `ladder`: 멤버-금액 매칭 목록(`matches[]`), 참고용 합계(Should Have)도 이 카드 하단에.
   - 공통: 총 금액(사다리타기는 `amounts` 합으로 대체 표시, 참고용), 선택된 방식 라벨.
8. **결과 이미지 저장 버튼**: 애니메이션 종료 후 활성화(위 "5.5"). 클릭 시 동적 import →
   `toPng(cardRef.current)` → `<a download>` 트리거. `cardRef`는 **6번 애니메이션 영역과
   7번 핵심 결과 카드를 함께 감싸는 컨테이너**에 연결한다(2026-09-07 갱신, 위 "4." 캡처
   대상 결정 뒤집음 — `ui.tsx`가 두 영역을 하나의 래퍼 요소로 묶어야 한다).
9. **공유 액션(계산 후)**(`ShareActions`): `url`=`buildStateShareUrl(calculatorUrl,
   shareState)`(위 "6."), `text`=방식별 핵심 결과 한 줄 요약(`formatting.ts`가 조립, SPEC.md
   Should Have "핵심 결과 문구 공유"와 동일한 문구를 재사용).
10. **계산 근거**(`SectionCard`): 방식별로 다른 breakdown — 균등은 나머지 처리 규칙 설명,
    몰아주기/사다리타기는 "무작위로 공정하게 결정되었다"는 설명(FORMULA.md 논증을 일반
    사용자용 문장으로 순화, 법령 대신 "표준 알고리즘(Fisher-Yates)"류 출처 라벨 사용 —
    `loan-interest-calculator`가 법령 자리에 "재무수학"을 넣은 선례와 동일한 방식).
11. **이용 안내 고지**(`bg-surface-subtle`): 참고·재미 목적, 법적 효력 없음, 브라우저에서만
    계산·이미지 생성하고 서버 전송/저장 없음(SPEC.md Must Have, docs/ARCHITECTURE.md
    "개인정보/데이터 처리" 원칙과 동일 문구 패턴).
12. **FAQ**(`FaqAccordion`): "왜 매번 다른 사람이 걸리나요?"(공정성 설명), "이미지가 저장 안
    돼요"(브라우저 호환성 안내) 등.

### 접근성/반응형

SPEC.md 공통 요건 그대로 — 결과 영역 `aria-live="polite"`, 모든 입력 `label` 연결, 320~1440px
무중단. 애니메이션 SVG는 `aria-hidden="true"` 처리하고(장식/연출이지 스크린리더가 읽어야 할
정보가 아님 — 실제 정보는 핵심 결과 카드의 텍스트가 전달), 결과 확정 문구는 `aria-live`
영역에 텍스트로 별도 노출해 스크린리더 사용자도 애니메이션 재생과 무관하게 결과를 즉시 인지할
수 있게 한다.

---

## 10. 계산기 등록 전략

- 이번 Architect 단계에서는 등록하지 않는다(빈 URL 노출 방지, 기존 관례).
- Builder가 UI 구현을 완료하면 `registry.ts`에 다음으로 등록한다:
  ```
  slug: "bill-split-calculator"
  title: "더치페이 계산기"
  category: "life"
  status: "draft"
  ```
  - **아이콘**: 기존 6개 키(`coins`/`calculator`/`calendar`/`chart`/`heart`/`utility`) 중
    `"utility"`를 제안한다 — `life` 카테고리 설명("할인율, 단위 변환 등 생활 계산")과 가장
    맞닿는 범용 도구 성격이고, 이 계산기가 `life` 카테고리를 실질적으로 채우는 첫 계산기라
    기존 계산기와의 중복 우려 자체가 없다(SPEC.md "슬러그/카테고리" 근거).
- Calculation Auditor(공정성 통계 검증 포함) + UX/UI Critic + QA(이미지 저장 실제 다운로드
  확인 포함) 통과 전에는 `published`로 바꾸지 않는다. SPEC.md "완료 기준"에 따라
  `PROGRESS.md`의 "다음 재검토 예정일"은 "해당 없음(공정성 알고리즘 오류 발견 시에만 재검토)"로
  기록한다(정책형 계산기가 아니므로).

---

## 11. Builder 인수인계 요약

1. `types.ts` — 이미 작성 완료(위 "3." 그대로). 새 필드가 필요하면 이 문서의 설계 원칙
   (판별 유니온, RNG-프리 재구성 헬퍼와의 대응)을 유지한 채 추가한다.
2. `logic.ts` — FORMULA.md "공식 ①/②/③"을 각각 `calculateEqualSplit`/
   `calculateWinnerTakeAll`/`calculateLadderSplit`로 구현. `pickWinnerIndex`/
   `fisherYatesShuffle`은 위 "2.2" 시그니처를 정확히 지킨다(Auditor 테스트가 그대로 이
   시그니처를 호출). `buildWinnerTakeAllShares`/`buildLadderMatches`/
   `restoreBillSplitResult`는 RNG를 전혀 호출하지 않는 순수 조립 함수로 분리한다(위 "2.3").
3. `logic.test.ts` — FORMULA.md 검증 예제 13개를 Golden Test로 옮긴다. 예제 8·9(몰아주기
   논증/방법론 시연)와 13(사다리타기 통계 검증 절차)은 Formula Analyst가 남긴 "실제 수치는
   Auditor가 재현"이라는 전제를 그대로 따라, 이 파일에는 방법론 그대로의 소규모 재현
   테스트(예: 고정 시퀀스 rng로 예제 10·11의 손 추적 재현)만 넣고, 10,000회 이상 대량
   시뮬레이션은 Calculation Auditor의 별도 산출물로 남긴다(같은 `pickWinnerIndex`/
   `fisherYatesShuffle` 시그니처를 그대로 재사용할 수 있게 export를 유지).
4. `validation.ts` — 멤버 수 2~20, 이름 빈 문자열 불가, 금액 1~100,000,000 정수, 사다리타기
   `amounts.length === members.length` 검증(FORMULA.md "입력값"/"예외"). 손으로 짠 검증
   함수로 작성(zod 미사용, 기존 관례). `parseBillSplitShareState(data: unknown)`도 이 파일에
   추가(위 "6.").
5. `formatting.ts` — `Intl.NumberFormat('ko-KR')` 통화 포맷, `result.mode`별 핵심 결과 한 줄
   요약(공유 텍스트에도 재사용), breakdown 문구 조립. 숫자를 새로 계산하지 않는다(이미
   `logic.ts`가 확정한 값만 문자열로 가공).
6. `RouletteWheel.tsx`/`LadderAnimation.tsx` — 위 "5." props 계약 그대로. SVG + CSS
   트랜지션만 사용(Canvas 금지, 위 "5.1" 근거). `prefers-reduced-motion` 분기는 컴포넌트
   내부가 아니라 `ui.tsx`가 계산해 `playAnimation`으로 주입(위 "5.4"). N에 따른 라벨
   축약(번호/색상 키, 위 "7.") 반영. **`LadderAnimation.tsx`는 위 "5.1.1"(2026-09-07 갱신)에
   따라 `generateDecorativeRungs`/`DecorativeRung`를 삭제하고 `ladder-layout.ts`의
   `buildLadderRungs`가 만드는 `{ rungs, rowCount }`를 실제 가로줄로 렌더링하며, 매칭
   경로도 그 가로줄을 지나는 rounded-corner 꺾은선으로 다시 그린다.** `TOP_Y`/`BOTTOM_Y`,
   렌더링 CSS 높이 모두 `rowCount`에 비례해 동적으로 계산하고(위 "5.1.1" 공식·상수는
   가이드라인), `strokeDasharray` 길이 계산도 새 꺾은선 기준(수직+수평 구간 합)으로
   다시 구현한다(기존 `approxPathLength` 그대로 재사용 금지 — 위 "5.1.1" 참고).
6a. `ladder-layout.ts`(신규, 위 "5.1.1"/"8.") — FORMULA.md "사다리타기 시각화 경로 재구성
    알고리즘"의 `generateAdjacentSwaps`/`scheduleSwapsIntoRows`/`buildLadderRungs`/
    `simulateFinalColumn`을 의사코드 그대로 구현한다. RNG를 전혀 쓰지 않는 순수 함수이므로
    기본 인자·주입 지점이 없다(`logic.ts`의 `RandomSource` 패턴과 무관). `types.ts`의
    `LadderRung`/`LadderRungLayout`을 반환 타입으로 그대로 쓴다.
6b. `ladder-layout.test.ts`(신규) — FORMULA.md Golden Test L1~L7(N=2 항등/역순, N=3 역순/
    비역순, N=4·N=5 전원 시뮬레이션, N=20 역순 행 수 상한)을 그대로 옮긴다. 각 예제가
    명시한 중간값(`swaps`, `rungs`, `rowCount`)과 `simulateFinalColumn`으로 전원 재검증한
    최종열이 `permutation`과 일치하는지까지 확인한다(예제가 이미 손으로 그 값을 다 추적해
    뒀으므로 그대로 assert로 옮기면 된다).
7. `use-prefers-reduced-motion.ts` — `window.matchMedia("(prefers-reduced-motion: reduce)")`
   구독 훅. 로컬 파일(위 "5.2"/"5.4" 승격 보류 근거).
8. `content.ts` — 방식별 상세 설명 문구(SPEC.md가 제시한 예시 그대로, "다른 계산기보다 조금
   더 상세할 수 있다"는 지침 반영), 소개/사용법/FAQ, 이용 안내 고지 문구.
9. `ui.tsx` — 위 "9." 화면 구조 그대로. 방식 선택에 따른 입력 폼 전환, 계산 실행 시
   `calculate*` 호출 → 애니메이션 컴포넌트에 결과 전달 → `onAnimationEnd` 후 핵심 결과 카드
   노출 → 이미지 저장 버튼 활성화. `ShareActions`는 계산 전·후 동일 위치, 계산 후
   `url`은 `buildStateShareUrl` + `BillSplitShareState`. **캡처 대상 `ref`는 2026-09-07
   갱신에 따라 애니메이션 `SectionCard`(6번)와 핵심 결과 카드(7번)를 함께 감싸는 래퍼
   요소에 연결한다**(위 "4."/"9.6~9.8" — 기존에는 7번에만 연결돼 있었다), "이미지 저장"
   클릭 시 `html-to-image`를 동적 import.
10. 레지스트리에 `status: "draft"`로 등록 + 아이콘 `utility`, 카테고리 `life`(위 "10.").
11. 새 계산기 완료 후 기존 계산기 Smoke Test(docs/EVALUATION.md "회귀 방지") — 이번 라운드는
    `src/lib/`의 공용 파일을 전혀 수정하지 않았고(`share.ts`는 그대로 재사용, 수정 없음)
    `package.json`에 `html-to-image`만 추가했으므로 회귀 위험은 낮지만, 원칙대로 전체 테스트
    스위트를 재실행해 확인한다.

---

## 12. 남은 리스크 / 확인 필요

- FORMULA.md "확인 필요 목록" 1번(`Math.random()`의 실제 브라우저 PRNG 품질 실측)과 3번
  (사다리타기 시각화 방식 최종 선택 — 이 문서가 "결과 우선 산정 후 시각화"로 확정함)은 이
  문서에서 답을 냈거나 Calculation Auditor 영역으로 넘어간다. **(2026-09-07 갱신)** 3번은
  이후 FORMULA.md가 "사다리타기 시각화 경로 재구성 알고리즘"(가로줄이 `permutation`으로부터
  결정적으로 유도되는 구체적 알고리즘, N=2~20 오케스트레이터 독립 재검증 완료)으로 더 깊게
  구체화했고, 위 "5.1.1"이 그 알고리즘을 실제 렌더링 결정(함수 배치·SVG 높이·꺾은선 렌더링)
  으로 옮겼다 — 남은 것은 구현(Optimizer)과 그 구현이 FORMULA.md Golden Test L1~L7·핵심
  불변식을 실제로 만족하는지의 검증뿐이다. `2n-3`(N=20일 때 37행) 공식 자체의 완전한 일반
  귀납 증명은 FORMULA.md도 "확인 필요"로 남겨 뒀으므로, 위 "5.1.1"의 SVG 높이 공식에 쓰인
  구체적 상수(`BASE_HEIGHT`, `MIN_ROW_GAP`, CSS 높이 상한 등)는 모두 이 값을 근거로 한
  가이드라인이며 하드 스펙이 아니다 — Builder가 실제 렌더링으로 조정 가능하다(다른 가이드라인
  값들과 동일한 재량 범위, 위 "7." 참고).
- **(2026-09-07 추가)** 캡처 대상 컨테이너를 애니메이션 영역까지 확장한 결정(위 "4."/"5.5")은
  QA 재검증이 필요 없는 순수 구조 변경이다 — 캡처 시점(버튼 활성화 조건)이 바뀌지 않았고,
  인라인 SVG는 애초부터 `html-to-image`의 강점 영역(위 "4." "이 사이트의 아이콘 관례" 논거)
  이라 iOS Safari 실기기 스모크 테스트 항목(위 "4. 알려진 한계")도 그대로 유지하면 된다 —
  새로 추가해야 할 QA 항목은 아니다.
- 이미지 저장 라이브러리(`html-to-image`)의 iOS Safari 실기기 캡처 성공 여부는 이 문서의
  분석(SVG `foreignObject` 방식의 일반적 강점)에 근거한 판단이지 실측이 아니다 — QA 단계에서
  반드시 실기기(또는 최신 iOS 시뮬레이터) 확인이 필요하다(위 "4. 알려진 한계"). 실패할
  경우의 대체 경로(에러 처리 → 텍스트 요약 공유 유도)는 이미 이 문서에 반영해 뒀다. 만약
  QA에서 실제로 캡처 실패가 반복 관찰되면 `html2canvas`로 교체하는 결정은 이번 라운드가
  아니라 그 QA 결과를 받은 뒤 별도로 재검토한다 — 지금은 실측 전 가정임을 남겨 둔다.
- `logic.ts`를 단일 파일로 유지하는 이번 결정은 세 방식이 실제로 짧다는 전제에 근거한다 —
  Builder 구현 중 특정 방식(특히 사다리타기 애니메이션과 결합되는 경로)이 예상보다
  복잡해지면, 그때는 `loan-interest-calculator`의 `logic/` 분할 선례를 다시 참고해 파일
  분리를 재검토할 수 있다(지금은 근거가 없어 분리하지 않을 뿐, 영구히 금지하는 결정은
  아니다).
- 룰렛 다이어그램의 "N ≤ 10이면 이름 전체, N > 10이면 번호만" 임계값은 이 문서의 기하학적
  추정(반지름·둘레 계산)에 근거한 가이드라인이지 확정 스펙이 아니다 — Builder가 실제 폰트
  크기·패딩으로 렌더링해 본 뒤 임계값을 조정해도 된다(위 "7." 참고, 하드 스펙 아님을 이미
  명시함).
