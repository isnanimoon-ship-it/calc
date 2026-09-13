/**
 * 더치페이 계산기 타입 — tasks/bill-split-calculator/FORMULA.md 기준.
 *
 * Architect 스캐폴딩이다 — 공식/알고리즘 자체는 정의하지 않는다(Formula Analyst 영역,
 * 균등 분배 나머지 규칙·Fisher-Yates shuffle 등을 바꾸지 않았다). 여기서는 입력/출력
 * "계약"(모양)과 RNG 주입 인터페이스만 고정한다. 상세 근거는
 * tasks/bill-split-calculator/ARCHITECTURE.md를 참고한다.
 *
 * 설계 근거 요약(ARCHITECTURE.md 참고 절):
 * - "3. 결과 타입 설계" — `business-days`/`loan-interest-calculator`의 판별 유니온 선례를
 *   그대로 따라 `mode`를 판별 태그로 쓴다. 세 방식(균등/몰아주기/사다리타기)의 핵심 결과
 *   필드가 서로 다르기 때문(SPEC.md). 다만 세 방식이 공유하는 필드가 `members` 정도뿐이라
 *   (loan-interest-calculator처럼 7개가 아님) 교차 타입(`&`) 베이스를 만들지 않고
 *   `business-days`처럼 세 분기를 그대로 나열했다 — 억지로 공통 베이스를 뽑으면 오히려
 *   "공유 필드가 거의 없다"는 사실을 가리게 된다.
 * - "2. RNG 주입 인터페이스" — `RandomSource`는 FORMULA.md "RNG를 함수 인자로 주입
 *   가능하게 설계"의 구체적 타입 시그니처다. Calculation Auditor가 대량 시뮬레이션
 *   테스트(10,000~100,000회)에서 이 시그니처 그대로 `pickWinnerIndex`/`fisherYatesShuffle`
 *   (logic.ts에 구현)를 직접 호출한다 — 이 타입을 바꾸면 Auditor의 테스트 코드도 함께
 *   깨지므로 Builder는 이 시그니처를 임의로 바꾸지 않는다.
 * - "5. ShareActions 인코딩" — `BillSplitShareState`는 계산 후 공유 URL에 저장되는
 *   페이로드의 구체 스키마다. RNG로 결정된 값(`selectedIndex`/`permutation`)을 URL에
 *   그대로 담아, 복원 시 RNG를 다시 호출하지 않고 결과를 재구성한다.
 */

export type Won = number;

export type BillSplitMode = "equal" | "winner-take-all" | "ladder";

/**
 * `[0, 1)` 구간의 실수를 반환하는 난수 함수. 기본값은 `Math.random`이며, 결정적 단위
 * 테스트는 고정 시퀀스를 반환하는 대체 함수를 주입하고, Calculation Auditor의 대량 통계
 * 시뮬레이션은 실제 `Math.random`을 그대로 주입해 같은 함수를 두 목적 모두에 쓴다
 * (FORMULA.md "공통 설계 원칙").
 */
export type RandomSource = () => number;

// ── 입력 ─────────────────────────────────────────────────────────────────

export interface EqualSplitInput {
  mode: "equal";
  /** 나눌 총 비용(원, 정수). FORMULA.md 허용 범위: 1 이상 100,000,000 이하. */
  totalAmount: Won;
  /**
   * 참여자 이름. **배열 인덱스가 내부 식별자다**(FORMULA.md "멤버 식별 기준" — 이름
   * 문자열이 아니라 인덱스로 알고리즘이 동작하므로 이름 중복이 정확성에 영향 없음).
   * 길이 2 이상 20 이하(ARCHITECTURE.md "7. 멤버 최대 인원수" 재확인 결과 20 유지).
   */
  members: string[];
}

export interface WinnerTakeAllInput {
  mode: "winner-take-all";
  totalAmount: Won;
  members: string[];
}

export interface LadderSplitInput {
  mode: "ladder";
  members: string[];
  /** 길이 = `members.length`(항상 동일, 불일치 시 계산 차단). 매칭 전 금액 후보 목록. */
  amounts: Won[];
}

export type BillSplitInput = EqualSplitInput | WinnerTakeAllInput | LadderSplitInput;

// ── 결과 ─────────────────────────────────────────────────────────────────

export interface Share {
  index: number;
  name: string;
  amount: Won;
}

export interface EqualSplitResult {
  mode: "equal";
  totalAmount: Won;
  members: string[];
  shares: Share[];
  /** `floor(totalAmount / n)`. */
  baseShare: Won;
  /** `totalAmount % n` — 1원씩 더 받은 인원 수(입력 순서상 앞쪽 `remainderCount`명). */
  remainderCount: number;
}

export interface WinnerTakeAllResult {
  mode: "winner-take-all";
  totalAmount: Won;
  members: string[];
  /**
   * `pickWinnerIndex(members.length, rng)`의 결과. RNG는 이 값이 정해지는 단계에서
   * 정확히 1회만 호출된다(FORMULA.md "계산 순서").
   */
  selectedIndex: number;
  selectedName: string;
  /** `selectedIndex`만 `totalAmount`, 나머지는 0(`buildWinnerTakeAllShares`로 생성). */
  shares: Share[];
}

export interface LadderMatch {
  memberIndex: number;
  memberName: string;
  amount: Won;
}

export interface LadderSplitResult {
  mode: "ladder";
  members: string[];
  /** 원본(매칭 전) 금액 목록 — 공유 상태 복원 시 그대로 재사용한다. */
  amounts: Won[];
  /** 입력 멤버 순서를 유지한다. `matches[i].amount === amounts[permutation[i]]`. */
  matches: LadderMatch[];
  /**
   * `fisherYatesShuffle([0..n-1], rng)`의 결과(인덱스 순열). `permutation[i]`는
   * `matches[i].amount`가 원래 `amounts` 배열의 몇 번째 값이었는지를 가리킨다
   * (FORMULA.md "구현 시 유의" — 값이 아니라 인덱스를 셔플해야 중복 금액에서도
   * permutation이 명확히 정의된다).
   */
  permutation: number[];
}

export type BillSplitResult = EqualSplitResult | WinnerTakeAllResult | LadderSplitResult;

// ── 사다리타기 시각화 레이아웃(뷰 전용, BillSplitResult 아님) ───────────────

/**
 * `LadderRung`/`LadderRungLayout`은 FORMULA.md "사다리타기 시각화 경로 재구성 알고리즘"
 * (2026-09-07 추가)이 정의하는 `buildLadderRungs(permutation)`의 출력 타입이다.
 * `permutation`(위 `LadderSplitResult.permutation`, 이미 확정된 계산 결과)을 읽기 전용으로만
 * 입력받는 순수·결정적 함수가 만들어내는 **화면 표시용 파생 데이터**이며, `BillSplitResult`의
 * 일부가 아니다 — 돈이나 RNG 공정성과 무관하므로 Calculation Auditor의 통계 검증 대상이
 * 아니다(ARCHITECTURE.md "5.1"/"5.1.1" 참고, FORMULA.md도 동일하게 명시).
 * `src/calculators/bill-split-calculator/ladder-layout.ts`가 이 타입으로
 * `buildLadderRungs`/`simulateFinalColumn`을 구현하고, `LadderAnimation.tsx`가 그 출력을
 * 그대로 렌더링한다(`logic.ts`가 아니라 별도 파일에 둔 이유는 ARCHITECTURE.md "5.1.1" 참고).
 */
export interface LadderRung {
  /** 시간축(위→아래) 순서, 0부터 시작. 화면 Y좌표로의 매핑은 렌더링 재량(ARCHITECTURE.md "5.1.1"). */
  row: number;
  /** 이 가로줄이 잇는 두 열 `column`과 `column + 1`의 왼쪽 열 인덱스(0 <= column <= n-2). */
  column: number;
}

export interface LadderRungLayout {
  rungs: LadderRung[];
  /** `rungs`가 비어있으면(항등순열, 예: FORMULA.md 예제 L1) 0. Y좌표 등분 시 분모는 `rowCount + 1`. */
  rowCount: number;
}

// ── 공유(ShareActions) 상태 ───────────────────────────────────────────────

/**
 * `src/lib/share.ts`의 `buildStateShareUrl`/`decodeShareState`가 다루는 `data: unknown`
 * 페이로드의 구체 스키마(ARCHITECTURE.md "5. ShareActions 인코딩").
 *
 * - `equal`: 결과가 입력만으로 결정적으로 재계산되므로 결과 스냅샷을 넣지 않는다.
 * - `winner-take-all`: `selectedIndex` **필수**(FORMULA.md) — 복원 시 RNG를 다시 호출하지
 *   않고 `buildWinnerTakeAllShares(members, totalAmount, selectedIndex)`로 재구성한다.
 * - `ladder`: `permutation` **필수**(FORMULA.md) — 복원 시
 *   `buildLadderMatches(members, amounts, permutation)`로 재구성한다.
 *
 * 세 분기 모두 `mode`로 판별되므로, 복원 로직(`restoreBillSplitResult`, logic.ts)이
 * `calculate*` 함수와 동일한 스위치문 하나로 처리된다.
 */
export type BillSplitShareState =
  | { mode: "equal"; totalAmount: Won; members: string[] }
  | { mode: "winner-take-all"; totalAmount: Won; members: string[]; selectedIndex: number }
  | { mode: "ladder"; members: string[]; amounts: Won[]; permutation: number[] };
