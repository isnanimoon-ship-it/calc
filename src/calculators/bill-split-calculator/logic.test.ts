import { describe, expect, it } from "vitest";
import {
  buildLadderMatches,
  buildWinnerTakeAllShares,
  calculateEqualSplit,
  calculateLadderSplit,
  calculateWinnerTakeAll,
  fisherYatesShuffle,
  pickWinnerIndex,
  restoreBillSplitResult,
} from "./logic";
import type { EqualSplitInput, LadderSplitInput, RandomSource, WinnerTakeAllInput } from "./types";

/**
 * Golden Test — tasks/bill-split-calculator/FORMULA.md "검증 예제 (Golden Test 후보, 13개)"를
 * 그대로 옮긴다. 예제 8·9(몰아주기 수학적 논증/통계 검증 방법론 시연)와 13(사다리타기 통계
 * 검증 절차)은 Formula Analyst가 "실제 수치는 Calculation Auditor가 재현"이라고 명시했으므로
 * 대량 시뮬레이션은 여기 포함하지 않는다(ARCHITECTURE.md "11.3") — 대신 예제 10·11의 손
 * 추적을 고정 시퀀스 rng로 정확히 재현하고, `pickWinnerIndex`/`fisherYatesShuffle`을 export해
 * Auditor가 별도 스크립트로 대량 호출할 수 있게 유지한다.
 */

/** `Math.floor(x * rangeSize) === index`가 되도록 구간 중앙값을 계산한다(경계 반올림 회피). */
function valueForIndex(index: number, rangeSize: number): number {
  return (index + 0.5) / rangeSize;
}

/** 고정 시퀀스를 순서대로 반환하는 가짜 RNG(호출 횟수 이상 소비하면 에러를 던진다). */
function sequenceRng(values: number[]): RandomSource {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error("fixed rng sequence exhausted");
    return values[i++];
  };
}

describe("calculateEqualSplit — Golden Test (FORMULA.md 예제 1~7)", () => {
  it("예제 1 — 나누어떨어지는 경우(10,000원/2명)", () => {
    const input: EqualSplitInput = { mode: "equal", totalAmount: 10_000, members: ["A", "B"] };
    const result = calculateEqualSplit(input);
    expect(result.baseShare).toBe(5_000);
    expect(result.remainderCount).toBe(0);
    expect(result.shares.map((s) => s.amount)).toEqual([5_000, 5_000]);
    expect(result.shares.reduce((sum, s) => sum + s.amount, 0)).toBe(10_000);
  });

  it("예제 2 — 나머지 1(10,000원/3명)", () => {
    const input: EqualSplitInput = { mode: "equal", totalAmount: 10_000, members: ["A", "B", "C"] };
    const result = calculateEqualSplit(input);
    expect(result.baseShare).toBe(3_333);
    expect(result.remainderCount).toBe(1);
    expect(result.shares.map((s) => s.amount)).toEqual([3_334, 3_333, 3_333]);
    expect(result.shares.reduce((sum, s) => sum + s.amount, 0)).toBe(10_000);
  });

  it("예제 3 — 나머지 = N-1(10,002원/7명, 앞 6명만 +1원)", () => {
    const members = ["A", "B", "C", "D", "E", "F", "G"];
    const input: EqualSplitInput = { mode: "equal", totalAmount: 10_002, members };
    const result = calculateEqualSplit(input);
    expect(result.baseShare).toBe(1_428);
    expect(result.remainderCount).toBe(6);
    expect(result.shares.map((s) => s.amount)).toEqual([1_429, 1_429, 1_429, 1_429, 1_429, 1_429, 1_428]);
    expect(result.shares.reduce((sum, s) => sum + s.amount, 0)).toBe(10_002);
  });

  it("예제 4 — 소액(100원/3명)", () => {
    const input: EqualSplitInput = { mode: "equal", totalAmount: 100, members: ["A", "B", "C"] };
    const result = calculateEqualSplit(input);
    expect(result.shares.map((s) => s.amount)).toEqual([34, 33, 33]);
    expect(result.shares.reduce((sum, s) => sum + s.amount, 0)).toBe(100);
  });

  it("예제 5 — 총액 < 인원수 경계(1원/2명, 0원 발생은 정상)", () => {
    const input: EqualSplitInput = { mode: "equal", totalAmount: 1, members: ["A", "B"] };
    const result = calculateEqualSplit(input);
    expect(result.shares.map((s) => s.amount)).toEqual([1, 0]);
    expect(result.shares.reduce((sum, s) => sum + s.amount, 0)).toBe(1);
  });

  it("예제 6 — 최대 인원(20명), 나머지 1(10,001원)", () => {
    const members = Array.from({ length: 20 }, (_, i) => `M${i + 1}`);
    const input: EqualSplitInput = { mode: "equal", totalAmount: 10_001, members };
    const result = calculateEqualSplit(input);
    expect(result.baseShare).toBe(500);
    expect(result.remainderCount).toBe(1);
    expect(result.shares[0].amount).toBe(501);
    expect(result.shares.slice(1).every((s) => s.amount === 500)).toBe(true);
    expect(result.shares.reduce((sum, s) => sum + s.amount, 0)).toBe(10_001);
  });

  it("예제 7 — 최대 인원(20명), 나누어떨어지는 경우(1,000,000원)", () => {
    const members = Array.from({ length: 20 }, (_, i) => `M${i + 1}`);
    const input: EqualSplitInput = { mode: "equal", totalAmount: 1_000_000, members };
    const result = calculateEqualSplit(input);
    expect(result.remainderCount).toBe(0);
    expect(result.shares.every((s) => s.amount === 50_000)).toBe(true);
    expect(result.shares.reduce((sum, s) => sum + s.amount, 0)).toBe(1_000_000);
  });

  it("불변식 — 다양한 입력에서 shares 합계가 항상 totalAmount와 정확히 일치한다", () => {
    const cases: Array<{ totalAmount: number; n: number }> = [
      { totalAmount: 1, n: 20 },
      { totalAmount: 99, n: 7 },
      { totalAmount: 100_000_000, n: 20 },
      { totalAmount: 12_345, n: 13 },
      { totalAmount: 7, n: 2 },
    ];
    for (const { totalAmount, n } of cases) {
      const members = Array.from({ length: n }, (_, i) => `M${i}`);
      const result = calculateEqualSplit({ mode: "equal", totalAmount, members });
      expect(result.shares.reduce((sum, s) => sum + s.amount, 0)).toBe(totalAmount);
      expect(result.shares.length).toBe(n);
    }
  });
});

describe("pickWinnerIndex / calculateWinnerTakeAll", () => {
  it("예제 8 참고 — pickWinnerIndex는 [0,1) 구간을 N등분한 경계에서 결정적으로 동작한다", () => {
    expect(pickWinnerIndex(5, () => 0)).toBe(0);
    expect(pickWinnerIndex(5, () => 0.1999999)).toBe(0);
    expect(pickWinnerIndex(5, () => 0.2)).toBe(1);
    expect(pickWinnerIndex(5, () => 0.999999)).toBe(4);
    for (let index = 0; index < 5; index++) {
      expect(pickWinnerIndex(5, () => valueForIndex(index, 5))).toBe(index);
    }
  });

  it("calculateWinnerTakeAll — RNG를 정확히 1회 호출하고 selectedIndex만 totalAmount, 나머지는 0", () => {
    let calls = 0;
    const rng: RandomSource = () => {
      calls++;
      return valueForIndex(2, 4); // members.length=4 중 인덱스 2
    };
    const input: WinnerTakeAllInput = { mode: "winner-take-all", totalAmount: 40_000, members: ["A", "B", "C", "D"] };
    const result = calculateWinnerTakeAll(input, rng);
    expect(calls).toBe(1);
    expect(result.selectedIndex).toBe(2);
    expect(result.selectedName).toBe("C");
    expect(result.shares.map((s) => s.amount)).toEqual([0, 0, 40_000, 0]);
  });

  it("buildWinnerTakeAllShares — RNG 없이 이미 정해진 selectedIndex로만 shares를 조립한다", () => {
    const shares = buildWinnerTakeAllShares(["A", "B", "C"], 9_000, 1);
    expect(shares).toEqual([
      { index: 0, name: "A", amount: 0 },
      { index: 1, name: "B", amount: 9_000 },
      { index: 2, name: "C", amount: 0 },
    ]);
  });
});

describe("fisherYatesShuffle / calculateLadderSplit — 예제 10·11 손 추적", () => {
  it("예제 10 — N=2, j=0(스왑 발생): shuffledIndices=[1,0] → A-2000,B-1000", () => {
    const rng = sequenceRng([valueForIndex(0, 2)]); // i=1에서 j=0
    const shuffled = fisherYatesShuffle([0, 1], rng);
    expect(shuffled).toEqual([1, 0]);

    const input: LadderSplitInput = { mode: "ladder", members: ["A", "B"], amounts: [1000, 2000] };
    const result = calculateLadderSplit(input, sequenceRng([valueForIndex(0, 2)]));
    expect(result.permutation).toEqual([1, 0]);
    expect(result.matches).toEqual([
      { memberIndex: 0, memberName: "A", amount: 2000 },
      { memberIndex: 1, memberName: "B", amount: 1000 },
    ]);
  });

  it("예제 10 — N=2, j=1(스왑 없음): shuffledIndices=[0,1] → A-1000,B-2000", () => {
    const input: LadderSplitInput = { mode: "ladder", members: ["A", "B"], amounts: [1000, 2000] };
    const result = calculateLadderSplit(input, sequenceRng([valueForIndex(1, 2)]));
    expect(result.permutation).toEqual([0, 1]);
    expect(result.matches).toEqual([
      { memberIndex: 0, memberName: "A", amount: 1000 },
      { memberIndex: 1, memberName: "B", amount: 2000 },
    ]);
  });

  it("예제 11 — N=3, (j2=0,j1=0): shuffledIndices=[1,2,0] → A-200,B-300,C-100", () => {
    const rng = sequenceRng([valueForIndex(0, 3), valueForIndex(0, 2)]);
    const input: LadderSplitInput = { mode: "ladder", members: ["A", "B", "C"], amounts: [100, 200, 300] };
    const result = calculateLadderSplit(input, rng);
    expect(result.permutation).toEqual([1, 2, 0]);
    expect(result.matches.map((m) => m.amount)).toEqual([200, 300, 100]);
  });

  /**
   * FORMULA.md 예제 11의 (j2,j1) → 순열 대응표를 실제 Fisher-Yates 알고리즘(공식 ③, i=2에서
   * a[2]<->a[j2] 스왑, i=1에서 a[1]<->a[j1] 스왑)으로 직접 손 추적한 결과, 문서 표의 6행 중
   * (j2=0,j1=0) 행만 실제 알고리즘과 일치하고 나머지 5행은 (j2,j1)과 결과 순열의 대응이
   * 잘못 기재되어 있음을 확인했다(순열 6개 자체의 집합은 동일 — {[1,2,0],[2,1,0],[2,0,1],
   * [0,2,1],[1,0,2],[0,1,2]} 그대로라 "6가지가 각 1/6"이라는 결론은 여전히 유효하다).
   * 예: (j2=0,j1=1)은 문서상 [1,0,2]이지만 실제로는 a=[2,1,0]에서 j1=1(스왑 없음)이라
   * [2,1,0]이 된다. 아래 두 테스트는 문서 표가 아니라 실제 알고리즘을 직접 손 추적한 값을
   * 기대값으로 쓴다 — 이 불일치는 Calculation Auditor/Formula Analyst에게 별도로 보고한다
   * (logic.ts 구현 자체는 ARCHITECTURE.md "2.2"의 참조 코드와 동일하다).
   */
  it("예제 11 — N=3, (j2=2,j1=1): 실제로는 두 단계 모두 스왑이 없어 항등 [0,1,2] → A-100,B-200,C-300", () => {
    const rng = sequenceRng([valueForIndex(2, 3), valueForIndex(1, 2)]);
    const input: LadderSplitInput = { mode: "ladder", members: ["A", "B", "C"], amounts: [100, 200, 300] };
    const result = calculateLadderSplit(input, rng);
    expect(result.permutation).toEqual([0, 1, 2]);
    expect(result.matches.map((m) => m.amount)).toEqual([100, 200, 300]);
  });

  it("예제 11 — N=3, (j2=1,j1=1): 실제로는 [0,2,1] → A-100,B-300,C-200(문서 표는 [0,1,2]로 오기재됨)", () => {
    const rng = sequenceRng([valueForIndex(1, 3), valueForIndex(1, 2)]);
    const input: LadderSplitInput = { mode: "ladder", members: ["A", "B", "C"], amounts: [100, 200, 300] };
    const result = calculateLadderSplit(input, rng);
    expect(result.permutation).toEqual([0, 2, 1]);
    expect(result.matches.map((m) => m.amount)).toEqual([100, 300, 200]);
  });

  it("예제 12 — 완전한 순열(bijection) 불변식이 여러 N·중복 금액에서도 항상 성립한다", () => {
    const cases: Array<{ members: string[]; amounts: number[] }> = [
      { members: ["A", "B"], amounts: [1000, 2000] },
      { members: ["A", "B", "C"], amounts: [100, 200, 300] },
      // 중복 금액(5000원 두 명) — FORMULA.md "예외": 오류가 아니라 permutation이 명확히 정의됨.
      { members: ["A", "B", "C", "D"], amounts: [5000, 5000, 1000, 2000] },
      { members: Array.from({ length: 20 }, (_, i) => `M${i}`), amounts: Array.from({ length: 20 }, (_, i) => (i + 1) * 1000) },
    ];
    for (const { members, amounts } of cases) {
      for (let trial = 0; trial < 20; trial++) {
        const result = calculateLadderSplit({ mode: "ladder", members, amounts }); // 실제 Math.random 사용
        expect(result.matches.length).toBe(members.length);
        expect([...result.matches.map((m) => m.memberIndex)].sort((a, b) => a - b)).toEqual(
          members.map((_, i) => i),
        );
        expect([...result.matches.map((m) => m.amount)].sort((a, b) => a - b)).toEqual(
          [...amounts].sort((a, b) => a - b),
        );
        expect([...result.permutation].sort((a, b) => a - b)).toEqual(members.map((_, i) => i));
      }
    }
  });

  it("buildLadderMatches — RNG 없이 이미 정해진 permutation으로만 matches를 조립한다", () => {
    const matches = buildLadderMatches(["A", "B", "C"], [100, 200, 300], [2, 0, 1]);
    expect(matches).toEqual([
      { memberIndex: 0, memberName: "A", amount: 300 },
      { memberIndex: 1, memberName: "B", amount: 100 },
      { memberIndex: 2, memberName: "C", amount: 200 },
    ]);
  });
});

describe("restoreBillSplitResult — 공유 URL 복원(ARCHITECTURE.md \"2.3\")", () => {
  it("세 방식 모두 RNG를 단 한 번도 호출하지 않는다(Math.random 호출 시 즉시 실패하도록 감시)", () => {
    const originalRandom = Math.random;
    Math.random = () => {
      throw new Error("restoreBillSplitResult는 RNG를 호출해서는 안 됩니다");
    };
    try {
      const equal = restoreBillSplitResult({ mode: "equal", totalAmount: 10_000, members: ["A", "B", "C"] });
      expect(equal.mode).toBe("equal");
      if (equal.mode === "equal") {
        expect(equal.shares.reduce((sum, s) => sum + s.amount, 0)).toBe(10_000);
      }

      const winner = restoreBillSplitResult({
        mode: "winner-take-all",
        totalAmount: 10_000,
        members: ["A", "B"],
        selectedIndex: 1,
      });
      expect(winner.mode).toBe("winner-take-all");
      if (winner.mode === "winner-take-all") {
        expect(winner.selectedName).toBe("B");
        expect(winner.shares.map((s) => s.amount)).toEqual([0, 10_000]);
      }

      const ladder = restoreBillSplitResult({
        mode: "ladder",
        members: ["A", "B", "C"],
        amounts: [100, 200, 300],
        permutation: [2, 0, 1],
      });
      expect(ladder.mode).toBe("ladder");
      if (ladder.mode === "ladder") {
        expect(ladder.matches.map((m) => m.amount)).toEqual([300, 100, 200]);
      }
    } finally {
      Math.random = originalRandom;
    }
  });

  it("복원 결과는 여러 번 호출해도 항상 동일하다(결정적 재구성)", () => {
    const state = {
      mode: "ladder" as const,
      members: ["A", "B", "C", "D"],
      amounts: [1000, 2000, 3000, 4000],
      permutation: [3, 1, 0, 2],
    };
    const first = restoreBillSplitResult(state);
    const second = restoreBillSplitResult(state);
    expect(first).toEqual(second);
  });
});
