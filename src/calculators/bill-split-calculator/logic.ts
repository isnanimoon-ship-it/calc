/**
 * 더치페이 계산기 — 세 방식(균등/몰아주기/사다리타기) 계산 + RNG 원시 함수 + 공유 복원.
 *
 * tasks/bill-split-calculator/FORMULA.md "공식 ①/②/③"과
 * tasks/bill-split-calculator/ARCHITECTURE.md "2. 로직 폴더 구조 및 RNG 주입 인터페이스"를
 * 그대로 구현한다. `pickWinnerIndex`/`fisherYatesShuffle`의 시그니처(인자 순서·기본값·반환
 * 타입)는 Calculation Auditor의 대량 시뮬레이션 테스트가 그대로 호출하는 계약이므로 임의로
 * 바꾸지 않는다(ARCHITECTURE.md "2.2").
 *
 * 핵심 원칙(ARCHITECTURE.md "2.3"): "RNG로 값을 결정하는 단계"와 "이미 결정된 값으로 결과
 * 객체를 조립하는 단계"를 분리한다. `calculateWinnerTakeAll`/`calculateLadderSplit`은 RNG를
 * 정확히 1회만 호출하고, `buildWinnerTakeAllShares`/`buildLadderMatches`/
 * `restoreBillSplitResult`는 RNG를 절대 호출하지 않는다 — 공유 URL 복원 시 다른 결과가
 * 나오면 안 되기 때문이다.
 */

import type {
  BillSplitResult,
  BillSplitShareState,
  EqualSplitInput,
  EqualSplitResult,
  LadderMatch,
  LadderSplitInput,
  LadderSplitResult,
  RandomSource,
  Share,
  WinnerTakeAllInput,
  WinnerTakeAllResult,
} from "./types";

// ── RNG 원시 함수(FORMULA.md "공식 ②"/"공식 ③") ────────────────────────────

/**
 * `n`개 중 하나를 균등 확률로 골라 0..n-1 정수를 반환한다(FORMULA.md "공식 ②").
 * N=2~20 범위에서 모듈로 편향은 통계적으로 검출 불가능한 수준(FORMULA.md 논증 참고).
 */
export function pickWinnerIndex(memberCount: number, rng: RandomSource = Math.random): number {
  return Math.floor(rng() * memberCount);
}

/**
 * Fisher-Yates(Durstenfeld) shuffle — 편향 없는 균등 무작위 순열(FORMULA.md "공식 ③").
 * 원본 배열은 변경하지 않고 새 배열을 반환한다. 호출부(`calculateLadderSplit`)가 값이 아니라
 * **인덱스 배열**에 이 함수를 적용해야 중복 금액이 있어도 permutation이 항상 명확하다
 * (FORMULA.md "구현 시 유의").
 */
export function fisherYatesShuffle<T>(items: readonly T[], rng: RandomSource = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── 균등 분배(FORMULA.md "공식 ①") ──────────────────────────────────────────

export function calculateEqualSplit(input: EqualSplitInput): EqualSplitResult {
  const n = input.members.length;
  const baseShare = Math.floor(input.totalAmount / n);
  const remainder = input.totalAmount % n;

  const shares: Share[] = input.members.map((name, index) => ({
    index,
    name,
    amount: baseShare + (index < remainder ? 1 : 0),
  }));

  return {
    mode: "equal",
    totalAmount: input.totalAmount,
    members: input.members,
    shares,
    baseShare,
    remainderCount: remainder,
  };
}

// ── 한명 몰아주기(FORMULA.md "공식 ②") ──────────────────────────────────────

/** RNG 없음 — 이미 확정된 `selectedIndex`로 shares[]를 조립만 한다(ARCHITECTURE.md "2.3"). */
export function buildWinnerTakeAllShares(
  members: string[],
  totalAmount: number,
  selectedIndex: number,
): Share[] {
  return members.map((name, index) => ({
    index,
    name,
    amount: index === selectedIndex ? totalAmount : 0,
  }));
}

export function calculateWinnerTakeAll(
  input: WinnerTakeAllInput,
  rng: RandomSource = Math.random,
): WinnerTakeAllResult {
  const selectedIndex = pickWinnerIndex(input.members.length, rng); // RNG 호출은 여기 1곳뿐
  return {
    mode: "winner-take-all",
    totalAmount: input.totalAmount,
    members: input.members,
    selectedIndex,
    selectedName: input.members[selectedIndex],
    shares: buildWinnerTakeAllShares(input.members, input.totalAmount, selectedIndex),
  };
}

// ── 사다리타기(FORMULA.md "공식 ③") ─────────────────────────────────────────

/** RNG 없음 — 이미 확정된 `permutation`으로 matches[]를 조립만 한다(ARCHITECTURE.md "2.3"). */
export function buildLadderMatches(
  members: string[],
  amounts: number[],
  permutation: number[],
): LadderMatch[] {
  return members.map((name, memberIndex) => ({
    memberIndex,
    memberName: name,
    amount: amounts[permutation[memberIndex]],
  }));
}

export function calculateLadderSplit(
  input: LadderSplitInput,
  rng: RandomSource = Math.random,
): LadderSplitResult {
  const indices = input.members.map((_, i) => i);
  const permutation = fisherYatesShuffle(indices, rng); // RNG 호출은 여기뿐(인덱스 셔플)
  return {
    mode: "ladder",
    members: input.members,
    amounts: input.amounts,
    matches: buildLadderMatches(input.members, input.amounts, permutation),
    permutation,
  };
}

// ── 공유 상태 복원(ARCHITECTURE.md "2.3"/"6.") ──────────────────────────────

/**
 * 공유 URL로부터 복원된 `BillSplitShareState`로 결과를 재구성한다. **RNG를 단 한 번도
 * 호출하지 않는다** — 균등은 애초에 결정적이라 재계산이 안전하고, 나머지 둘은
 * `build*` 헬퍼만 호출한다. 공유 링크로 들어온 사용자가 다른 결과를 보는 일이 구조적으로
 * 불가능하다(ARCHITECTURE.md "2.3" 핵심 결정).
 */
export function restoreBillSplitResult(state: BillSplitShareState): BillSplitResult {
  switch (state.mode) {
    case "equal":
      return calculateEqualSplit({
        mode: "equal",
        totalAmount: state.totalAmount,
        members: state.members,
      });
    case "winner-take-all":
      return {
        mode: "winner-take-all",
        totalAmount: state.totalAmount,
        members: state.members,
        selectedIndex: state.selectedIndex,
        selectedName: state.members[state.selectedIndex],
        shares: buildWinnerTakeAllShares(state.members, state.totalAmount, state.selectedIndex),
      };
    case "ladder":
      return {
        mode: "ladder",
        members: state.members,
        amounts: state.amounts,
        matches: buildLadderMatches(state.members, state.amounts, state.permutation),
        permutation: state.permutation,
      };
  }
}
